/**
 * Parse a Mermaid flowchart TD string → { nodes, edges } in React Flow format.
 * Used client-side as a fallback if the backend graph model is unavailable.
 */

const CLASSDEF_RE = /classDef\s+(\w+)\s+([^\n]+)/gi
const FILL_RE = /fill:([#\w]+)/i
const ASSIGNMENT_RE = /^class\s+(\w+)\s+(\w+)/i
const NODE_RE = /^(\w+)(\(\[.*?\]\)|\[\(.*?\)\]|\{.*?\}|\[\[.*?\]\]|\[.*?\]|\(.*?\))/
const EDGE_RE = /(\w+)\s*(-[-\.]+>|={2,}>)\s*(?:\|([^|]*)\|)?\s*(\w+)/g

function extractLabel(raw) {
  const s = raw.trim()
  if (s.startsWith('([') && s.endsWith('])')) return s.slice(2, -2)
  if (s.startsWith('[(') && s.endsWith(')]')) return s.slice(2, -2)
  if (s.startsWith('{') && s.endsWith('}')) return s.slice(1, -1)
  if (s.startsWith('[[') && s.endsWith(']]')) return s.slice(2, -2)
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1)
  if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1)
  return s
}

export function mermaidToGraph(mermaidStr, fallbackGraph = null) {
  try {
    const classdefs = {}
    const assignments = {}
    const nodeMap = {}
    const edgeList = []

    let m
    const cdRe = /classDef\s+(\w+)\s+([^\n]+)/gi
    while ((m = cdRe.exec(mermaidStr)) !== null) {
      const fillM = /fill:([#\w]+)/i.exec(m[2])
      const colorM = /(?<![a-z])color:([#\w]+)/i.exec(m[2])
      classdefs[m[1]] = {
        fill: fillM ? fillM[1] : '#555',
        color: colorM ? colorM[1] : '#fff',
      }
    }

    for (const line of mermaidStr.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('flowchart') || trimmed.startsWith('graph') || trimmed.startsWith('classDef')) continue

      const assignM = /^class\s+(\w+)\s+(\w+)/.exec(trimmed)
      if (assignM) {
        assignments[assignM[1]] = assignM[2]
        continue
      }

      if (!trimmed.includes('-->') && !trimmed.includes('-.-') && !trimmed.includes('==>')) {
        const nodeM = /^(\w+)(\(\[.*?\]\)|\[\(.*?\)\]|\{.*?\}|\[\[.*?\]\]|\[.*?\]|\(.*?\))/.exec(trimmed)
        if (nodeM) {
          nodeMap[nodeM[1]] = { label: extractLabel(nodeM[2]) }
        }
      }
    }

    const edgeRe = /(\w+)\s*(-[-\.]+>|={2,}>)\s*(?:\|([^|]*)\|)?\s*(\w+)/g
    const seen = new Set()
    while ((m = edgeRe.exec(mermaidStr)) !== null) {
      const [, src, arrow, label, tgt] = m
      const key = `${src}→${tgt}→${label || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      edgeList.push({ source: src, target: tgt, label: label || '', animated: arrow.includes('.') })
      if (!nodeMap[src]) nodeMap[src] = { label: src }
      if (!nodeMap[tgt]) nodeMap[tgt] = { label: tgt }
    }

    const ids = Object.keys(nodeMap)
    const X_SPACING = 220
    const Y_SPACING = 130
    const nodes = ids.map((id, idx) => {
      const className = assignments[id] || ''
      const styleInfo = classdefs[className] || {}
      return {
        id,
        type: 'default',
        data: { label: nodeMap[id].label },
        position: { x: 0, y: idx * Y_SPACING },
        style: {
          background: styleInfo.fill || '#555',
          color: styleInfo.color || '#fff',
          border: '2px solid #333',
          borderRadius: '6px',
          padding: '10px 16px',
          fontWeight: '500',
        },
      }
    })

    const edges = edgeList.map((e, idx) => ({
      id: `e${idx}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'smoothstep',
      animated: e.animated,
      style: { stroke: '#00d2ff' },
      labelStyle: { fill: '#ccc', fontSize: 11 },
      labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
    }))

    if (nodes.length === 0 && fallbackGraph) return fallbackGraph
    return { nodes, edges }
  } catch (err) {
    console.warn('mermaidToGraph parse failed:', err)
    return fallbackGraph || { nodes: [], edges: [] }
  }
}

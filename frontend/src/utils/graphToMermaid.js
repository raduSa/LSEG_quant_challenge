/**
 * Convert a React Flow graph model { nodes, edges } → Mermaid flowchart TD string.
 */

function colorToClassName(hex) {
  return 'style_' + hex.replace('#', '')
}

function nodeShape(node) {
  const label = node.data?.label || node.id
  // Detect shape hints from original data if stored, else default rect
  const shapeHint = node.data?.shape || 'default'
  if (shapeHint === 'stadium') return `([${label}])`
  if (shapeHint === 'cylinder') return `[(${label})]`
  if (shapeHint === 'diamond') return `{${label}}`
  return `[${label}]`
}

export function graphToMermaid(nodes, edges) {
  if (!nodes || nodes.length === 0) return ''

  const lines = ['flowchart TD']

  // Collect unique colors for classDef
  const colorMap = new Map() // hex -> className
  nodes.forEach((node) => {
    const bg = node.style?.background
    if (bg && !colorMap.has(bg)) {
      colorMap.set(bg, colorToClassName(bg))
    }
  })

  // Node declarations
  nodes.forEach((node) => {
    lines.push(`    ${node.id}${nodeShape(node)}`)
  })

  lines.push('')

  // classDef statements
  colorMap.forEach((className, hex) => {
    lines.push(`    classDef ${className} fill:${hex},color:#fff,stroke:${darken(hex)}`)
  })

  lines.push('')

  // class assignments
  nodes.forEach((node) => {
    const bg = node.style?.background
    if (bg && colorMap.has(bg)) {
      lines.push(`    class ${node.id} ${colorMap.get(bg)}`)
    }
  })

  lines.push('')

  // Edge declarations
  edges.forEach((edge) => {
    const arrow = edge.animated ? '-.->' : '-->'
    const label = edge.label ? `|${edge.label}|` : ''
    lines.push(`    ${edge.source} ${arrow}${label} ${edge.target}`)
  })

  return lines.join('\n')
}

function darken(hex) {
  try {
    const h = hex.replace('#', '')
    const r = Math.max(0, parseInt(h.slice(0, 2), 16) - 30)
    const g = Math.max(0, parseInt(h.slice(2, 4), 16) - 30)
    const b = Math.max(0, parseInt(h.slice(4, 6), 16) - 30)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch {
    return hex
  }
}

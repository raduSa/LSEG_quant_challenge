import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './DiagramCanvas.css'

// ── Unified info panel (node) ─────────────────────────────────────────────────

const NODE_ICONS = {
  user_endpoint: '👤',
  process: '⚙️',
  database: '🗄️',
  guardrail: '🛡️',
  blocked: '⛔',
  classifier: '🔀',
  tool: '🔧',
  formatter: '📋',
}

function NodeInfoPanel({ panel, onClose, onEdit }) {
  const icon = NODE_ICONS[panel.nodeType] || '◉'
  return (
    <div className="info-panel">
      <div className="info-panel__header">
        <span className="info-panel__icon">{icon}</span>
        <span className="info-panel__title">{panel.label}</span>
        <span className="info-panel__badge">{(panel.nodeType || '').replace(/_/g, ' ')}</span>
        <button className="info-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="info-panel__body">
        {panel.summary
          ? <p>{panel.summary}</p>
          : <p className="info-panel__empty">No summary available.</p>}
      </div>
      <div className="info-panel__footer">
        <button onClick={() => onEdit(panel.nodeId)}>Edit label</button>
      </div>
    </div>
  )
}

// ── Unified info panel (edge) ─────────────────────────────────────────────────

function EdgeInfoPanel({ panel, onClose, onLabelCommit, onNudge }) {
  const [labelVal, setLabelVal] = useState(panel.label)
  // Reset when a different edge is opened
  useEffect(() => { setLabelVal(panel.label) }, [panel.edgeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => onLabelCommit(panel.edgeId, labelVal)

  return (
    <div className="info-panel">
      <div className="info-panel__header">
        <span className="info-panel__icon">↔</span>
        <span className="info-panel__title info-panel__title--edge" title={`${panel.source} → ${panel.target}`}>
          {panel.source} → {panel.target}
        </span>
        <button className="info-panel__close" onClick={onClose}>×</button>
      </div>

      <div className="info-panel__field">
        <label className="info-panel__field-label">Label</label>
        <input
          className="info-panel__input"
          value={labelVal}
          onChange={e => setLabelVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') onClose()
            e.stopPropagation()
          }}
        />
      </div>

      <div className="info-panel__body">
        {panel.summary
          ? <p>{panel.summary}</p>
          : <p className="info-panel__empty">No summary available.</p>}
      </div>

      <div className="info-panel__nudge">
        <span className="info-panel__field-label">Move label</span>
        <div className="nudge-grid">
          <div />
          <button className="nudge-btn" onClick={() => onNudge(panel.edgeId, 0, -20)}>↑</button>
          <div />
          <button className="nudge-btn" onClick={() => onNudge(panel.edgeId, -20, 0)}>←</button>
          <button className="nudge-btn nudge-btn--reset" onClick={() => onNudge(panel.edgeId, 0, 0, true)}>⊙</button>
          <button className="nudge-btn" onClick={() => onNudge(panel.edgeId, 20, 0)}>→</button>
          <div />
          <button className="nudge-btn" onClick={() => onNudge(panel.edgeId, 0, 20)}>↓</button>
          <div />
        </div>
      </div>
    </div>
  )
}

// ── Custom edge with repositionable label ─────────────────────────────────────

function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, label, selected, style, markerEnd,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const offsetX = data?.labelOffsetX || 0
  const offsetY = data?.labelOffsetY || 0

  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`edge-label-wrap${selected ? ' edge-label-wrap--selected' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX + offsetX}px,${labelY + offsetY}px)`,
              pointerEvents: 'all',
            }}
            onDoubleClick={e => { e.stopPropagation(); data?.onEdgeDoubleClick?.(id) }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ── Shared editable label (nodes) ─────────────────────────────────────────────

function EditableLabel({ nodeId, label, editing, onCommit, onCancel }) {
  const [value, setValue] = useState(label)
  const inputRef = useRef(null)

  useEffect(() => setValue(label), [label])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (!editing) return <span style={{ pointerEvents: 'none' }}>{label}</span>

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => onCommit(nodeId, value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(nodeId, value) }
        if (e.key === 'Escape') { onCancel(); setValue(label) }
        e.stopPropagation()
      }}
      style={{
        background: 'transparent', border: 'none',
        borderBottom: '1px solid currentColor', color: 'inherit',
        fontFamily: 'Inter, sans-serif', fontSize: 'inherit',
        fontWeight: 'inherit', textAlign: 'center',
        outline: 'none', width: '100%', padding: 0,
      }}
    />
  )
}

// ── Custom node components ────────────────────────────────────────────────────

function ProcessNode({ id, data, selected }) {
  const bg = data.fill || '#edf4fb'
  const border = data.borderColor || '#9fb8ce'
  const color = data.textColor || '#2c3e50'
  return (
    <div className={`cn-process ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <Handle type="target" position={Position.Top} />
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function UserNode({ id, data, selected }) {
  const bg = data.fill || '#eef6fd'
  const border = data.borderColor || '#aac4dd'
  const color = data.textColor || '#2c3e50'
  return (
    <div className={`cn-user ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <Handle type="target" position={Position.Top} />
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DatabaseNode({ id, data, selected }) {
  const bg = data.fill || '#e8f2f9'
  const border = data.borderColor || '#8ab2cc'
  const color = data.textColor || '#2c3e50'
  return (
    <div className={`cn-database ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <div className="cn-database__cap" style={{ background: bg, border: `2px solid ${border}` }} />
      <Handle type="target" position={Position.Top} />
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function GuardrailNode({ id, data, selected }) {
  const bg = data.fill || '#fdf8ef'
  const border = data.borderColor || '#d4a86a'
  const color = data.textColor || '#2c3e50'
  return (
    <div className={`cn-guardrail ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <Handle type="target" position={Position.Top} />
      <span className="cn-icon">🛡</span>
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function BlockedNode({ id, data, selected }) {
  const bg = data.fill || '#f4f5f6'
  const border = data.borderColor || '#b8bdc2'
  const color = data.textColor || '#6b7888'
  return (
    <div className={`cn-blocked ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <Handle type="target" position={Position.Left} />
      <span className="cn-icon">⛔</span>
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
    </div>
  )
}

function ClassifierNode({ id, data, selected }) {
  const bg = data.fill || '#eef9f3'
  const border = data.borderColor || '#8ec4a0'
  const color = data.textColor || '#2c3e50'
  return (
    <div className={`cn-classifier ${selected ? 'cn--selected' : ''}`}
      style={{ background: bg, border: `2px solid ${border}`, color }}>
      <Handle type="target" position={Position.Top} />
      <EditableLabel nodeId={id} label={data.label} editing={data.editing}
        onCommit={data.onLabelCommit} onCancel={data.onEditCancel} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

// ── Registries ────────────────────────────────────────────────────────────────

const NODE_TYPES = {
  process: ProcessNode, user_endpoint: UserNode, database: DatabaseNode,
  guardrail: GuardrailNode, blocked: BlockedNode, classifier: ClassifierNode,
  tool: ProcessNode, formatter: ProcessNode, default: ProcessNode,
}
const EDGE_TYPES = { custom: CustomEdge }

// ── Helpers ───────────────────────────────────────────────────────────────────

function attachNodeCallbacks(nodes, editingId, onLabelCommit, onEditCancel) {
  return nodes.map(n => ({
    ...n,
    data: { ...n.data, editing: n.id === editingId, onLabelCommit, onEditCancel },
  }))
}

function attachEdgeCallbacks(edges, onEdgeDoubleClick) {
  return edges.map(e => ({
    ...e,
    type: 'custom',
    data: { ...(e.data || {}), onEdgeDoubleClick },
  }))
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiagramCanvas({ graphModel, onGraphChange, nodeSummaries, edgeSummaries }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [editingId, setEditingId] = useState(null)
  const [infoPanel, setInfoPanel] = useState(null) // { type: 'node'|'edge', ...data }
  const [locked, setLocked] = useState(false)

  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const edgeTypes = useMemo(() => EDGE_TYPES, [])

  const edgesRef = useRef(edges)
  useEffect(() => { edgesRef.current = edges }, [edges])
  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Sync when parent pushes a new diagram
  useEffect(() => {
    if (!graphModel) return
    setEditingId(null)
    setInfoPanel(null)
    setNodes(graphModel.nodes || [])
    setEdges(graphModel.edges || [])
  }, [graphModel?._syncToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node callbacks ──────────────────────────────────────────────────────────

  const handleLabelCommit = useCallback((nodeId, newLabel) => {
    setEditingId(null)
    setNodes(cur => {
      const next = cur.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n)
      onGraphChange?.({ nodes: next, edges: edgesRef.current })
      return next
    })
  }, [onGraphChange])

  const handleEditCancel = useCallback(() => setEditingId(null), [])

  const onNodeDoubleClick = useCallback((_e, node) => {
    setInfoPanel({
      type: 'node',
      nodeId: node.id,
      label: node.data.label,
      nodeType: node.type,
      summary: nodeSummaries?.[node.id] || null,
    })
  }, [nodeSummaries])

  // ── Edge callbacks ──────────────────────────────────────────────────────────

  const openEdgePanel = useCallback((edgeId) => {
    const edge = edgesRef.current.find(e => e.id === edgeId)
    if (!edge) return
    const srcNode = nodesRef.current.find(n => n.id === edge.source)
    const tgtNode = nodesRef.current.find(n => n.id === edge.target)
    setInfoPanel({
      type: 'edge',
      edgeId: edge.id,
      label: edge.label || '',
      source: srcNode?.data?.label || edge.source,
      target: tgtNode?.data?.label || edge.target,
      summary: edgeSummaries?.[edge.id] || null,
    })
  }, [edgeSummaries])

  // Double-click on edge PATH
  const onEdgeDoubleClick = useCallback((_e, edge) => openEdgePanel(edge.id), [openEdgePanel])

  // Double-click on edge LABEL (via EdgeLabelRenderer in CustomEdge)
  const handleEdgeLabelDoubleClick = useCallback((edgeId) => openEdgePanel(edgeId), [openEdgePanel])

  const handleEdgeLabelCommit = useCallback((edgeId, newLabel) => {
    setEdges(cur => {
      const next = cur.map(e => e.id === edgeId ? { ...e, label: newLabel } : e)
      onGraphChange?.({ nodes: nodesRef.current, edges: next })
      return next
    })
    setInfoPanel(prev => prev?.edgeId === edgeId ? { ...prev, label: newLabel } : prev)
  }, [onGraphChange])

  const handleLabelNudge = useCallback((edgeId, dx, dy, reset = false) => {
    setEdges(cur => {
      const next = cur.map(e => {
        if (e.id !== edgeId) return e
        const nx = reset ? 0 : (e.data?.labelOffsetX || 0) + dx
        const ny = reset ? 0 : (e.data?.labelOffsetY || 0) + dy
        return { ...e, data: { ...(e.data || {}), labelOffsetX: nx, labelOffsetY: ny } }
      })
      onGraphChange?.({ nodes: nodesRef.current, edges: next })
      return next
    })
  }, [onGraphChange])

  // ── Shared ──────────────────────────────────────────────────────────────────

  const closePanel = useCallback(() => setInfoPanel(null), [])
  const editFromPanel = useCallback((nodeId) => { setInfoPanel(null); setEditingId(nodeId) }, [])

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params, type: 'custom',
      style: { stroke: '#9fb8ce', strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fill: '#2c3e50', fontWeight: 500 },
    }
    setEdges(eds => {
      const next = addEdge(newEdge, eds)
      onGraphChange?.({ nodes: nodesRef.current, edges: next })
      return next
    })
  }, [onGraphChange])

  const onNodeDragStop = useCallback(() => {
    onGraphChange?.({ nodes: nodesRef.current, edges: edgesRef.current })
  }, [onGraphChange])

  const onNodesChangeWrapped = useCallback((changes) => {
    onNodesChange(changes)
    if (changes.some(c => c.type === 'remove')) {
      setTimeout(() => onGraphChange?.({ nodes: nodesRef.current, edges: edgesRef.current }), 0)
    }
  }, [onNodesChange, onGraphChange])

  const onEdgesChangeWrapped = useCallback((changes) => {
    onEdgesChange(changes)
    if (changes.some(c => c.type === 'remove')) {
      setTimeout(() => onGraphChange?.({ nodes: nodesRef.current, edges: edgesRef.current }), 0)
    }
  }, [onEdgesChange, onGraphChange])

  const displayNodes = attachNodeCallbacks(nodes, editingId, handleLabelCommit, handleEditCancel)
  const displayEdges = attachEdgeCallbacks(edges, handleEdgeLabelDoubleClick)

  return (
    <div className="canvas-wrapper">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChangeWrapped}
        onEdgesChange={onEdgesChangeWrapped}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        nodesSelectable
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        style={{ background: '#f4f7fa' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d0dce8" />
        <MiniMap
          nodeColor={n => n.data?.fill || '#c8d6e5'}
          maskColor="rgba(210,220,232,0.5)"
          style={{ background: '#eaf0f8', border: '1px solid #ccd8e5' }}
        />
        <Controls onInteractiveChange={interactive => setLocked(!interactive)} />
      </ReactFlow>

      {infoPanel?.type === 'node' && (
        <NodeInfoPanel panel={infoPanel} onClose={closePanel} onEdit={editFromPanel} />
      )}
      {infoPanel?.type === 'edge' && (
        <EdgeInfoPanel
          panel={infoPanel}
          onClose={closePanel}
          onLabelCommit={handleEdgeLabelCommit}
          onNudge={handleLabelNudge}
        />
      )}

      {nodes.length === 0 && (
        <div className="canvas-empty">Generate a diagram from the chat panel.</div>
      )}
      {nodes.length > 0 && !infoPanel && (
        <div className="canvas-hint">
          Double-click a node or edge for info · Delete removes selected
        </div>
      )}
    </div>
  )
}

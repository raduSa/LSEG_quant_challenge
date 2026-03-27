import { useState, useCallback, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'

import Toolbar from './components/Toolbar'
import ChatInput from './components/ChatInput'
import DiagramCanvas from './components/DiagramCanvas'
import MermaidPreview from './components/MermaidPreview'
import { graphToMermaid } from './utils/graphToMermaid'
import { generateDiagram, exportDiagram, clearHistory } from './api'

// Stable session ID for this browser session
const SESSION_ID = `session-${Date.now()}`

export default function App() {
  const [graphModel, setGraphModel] = useState({ nodes: [], edges: [], _syncToken: 0 })
  const [mermaidString, setMermaidString] = useState('')
  const [nodeSummaries, setNodeSummaries] = useState({})
  const [edgeSummaries, setEdgeSummaries] = useState({})
  const [messages, setMessages] = useState([])
  const [viewMode, setViewMode] = useState('edit') // 'edit' | 'preview'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Track sync token to force DiagramCanvas re-sync
  const syncTokenRef = useRef(0)

  async function handleSend(query) {
    setLoading(true)
    setError(null)

    setMessages((prev) => [...prev, { role: 'user', content: query }])

    try {
      const result = await generateDiagram(query, SESSION_ID)

      setMermaidString(result.mermaid)
      setNodeSummaries(result.summaries || {})
      setEdgeSummaries(result.edgeSummaries || {})
      syncTokenRef.current += 1
      setGraphModel({ ...result.graph, _syncToken: syncTokenRef.current })

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Diagram generated successfully.' },
      ])
    } catch (err) {
      const msg = err.message || 'Unknown error'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${msg}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  // When user edits nodes/edges in React Flow → re-serialize to Mermaid
  const handleGraphChange = useCallback((updatedGraph) => {
    setGraphModel((prev) => ({ ...updatedGraph, _syncToken: prev._syncToken }))
    const newMermaid = graphToMermaid(updatedGraph.nodes, updatedGraph.edges)
    if (newMermaid) setMermaidString(newMermaid)
  }, [])

  async function handleExport() {
    if (!mermaidString) return
    try {
      const blob = await exportDiagram(mermaidString, 'png')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'diagram.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Export failed: ' + err.message)
    }
  }

  async function handleClear() {
    try {
      await clearHistory(SESSION_ID)
    } catch (_) {
      // Ignore clear errors — reset state anyway
    }
    setGraphModel({ nodes: [], edges: [], _syncToken: 0 })
    setMermaidString('')
    setNodeSummaries({})
    setEdgeSummaries({})
    setMessages([])
    setError(null)
  }

  return (
    <div className="app">
      <Toolbar
        viewMode={viewMode}
        onToggleView={setViewMode}
        onExport={handleExport}
        onClear={handleClear}
        loading={loading}
        hasDiagram={!!mermaidString}
      />

      {error && (
        <div className="app__error">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="app__body">
        {/* Left — Chat panel */}
        <div className="app__chat">
          <ChatInput messages={messages} onSend={handleSend} loading={loading} />
        </div>

        {/* Center — React Flow canvas (shown in edit mode) */}
        <div className={`app__canvas ${viewMode === 'edit' ? '' : 'app__canvas--hidden'}`}>
          <ReactFlowProvider>
            <DiagramCanvas graphModel={graphModel} onGraphChange={handleGraphChange} nodeSummaries={nodeSummaries} edgeSummaries={edgeSummaries} />
          </ReactFlowProvider>
        </div>

        {/* Right — Mermaid preview (always rendered; shown in preview mode on mobile toggle) */}
        <div className={`app__preview ${viewMode === 'preview' ? 'app__preview--full' : ''}`}>
          <MermaidPreview mermaidString={mermaidString} />
        </div>
      </div>
    </div>
  )
}

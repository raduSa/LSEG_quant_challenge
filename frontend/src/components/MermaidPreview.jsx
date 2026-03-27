import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import './MermaidPreview.css'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontSize: '12px',
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#eef6fd',
    primaryBorderColor: '#aac4dd',
    primaryTextColor: '#2c3e50',
    lineColor: '#9fb8ce',
    edgeLabelBackground: '#ffffff',
    clusterBkg: '#f4f7fa',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 15,
    nodeSpacing: 40,
    rankSpacing: 60,
    useMaxWidth: true,
  },
  securityLevel: 'loose',
})

let idCounter = 0

export default function MermaidPreview({ mermaidString }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!mermaidString || !containerRef.current) return

    const diagramId = `mermaid-diagram-${++idCounter}`
    setError(null)

    mermaid
      .render(diagramId, mermaidString)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          // Make SVG fill container properly
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Mermaid render error')
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }
      })
  }, [mermaidString])

  function handleWheel(e) {
    e.preventDefault()
    setZoom((z) => Math.max(0.3, Math.min(3, z + (e.deltaY < 0 ? 0.1 : -0.1))))
  }

  return (
    <div className="mermaid-preview" onWheel={handleWheel}>
      <div className="mermaid-preview__header">
        <span className="mermaid-preview__title">Mermaid Preview</span>
        <div className="mermaid-preview__zoom">
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
          <button onClick={() => setZoom(1)}>Reset</button>
        </div>
      </div>

      <div className="mermaid-preview__scroll">
        {error ? (
          <div className="mermaid-preview__error">
            <strong>Render error</strong>
            <pre>{error}</pre>
          </div>
        ) : !mermaidString ? (
          <div className="mermaid-preview__empty">
            Mermaid preview will appear here after generation.
          </div>
        ) : (
          <div
            className="mermaid-preview__content"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            <div ref={containerRef} />
          </div>
        )}
      </div>

      {mermaidString && (
        <details className="mermaid-source">
          <summary>View source</summary>
          <pre>{mermaidString}</pre>
        </details>
      )}
    </div>
  )
}

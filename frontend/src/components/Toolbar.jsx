import './Toolbar.css'

export default function Toolbar({ viewMode, onToggleView, onExport, onClear, loading, hasDiagram }) {
  return (
    <div className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">◈</span>
        <span className="toolbar__name">NL → Diagram</span>
      </div>

      <div className="toolbar__actions">
        <div className="toolbar__toggle" role="group">
          <button
            className={`toolbar__btn toolbar__btn--toggle ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => onToggleView('edit')}
            title="Interactive edit mode (React Flow)"
          >
            ✏ Edit
          </button>
          <button
            className={`toolbar__btn toolbar__btn--toggle ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => onToggleView('preview')}
            title="Static Mermaid SVG preview"
          >
            ◉ Preview
          </button>
        </div>

        <button
          className="toolbar__btn toolbar__btn--export"
          onClick={onExport}
          disabled={loading || !hasDiagram}
          title={hasDiagram ? 'Export diagram as PNG' : 'Generate a diagram first'}
        >
          ↓ Export PNG
        </button>

        <button
          className="toolbar__btn toolbar__btn--clear"
          onClick={onClear}
          disabled={loading}
          title="Clear diagram and conversation history"
        >
          ✕ Clear
        </button>
      </div>
    </div>
  )
}

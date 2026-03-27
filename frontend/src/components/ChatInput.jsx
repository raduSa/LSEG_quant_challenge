import { useState, useRef, useEffect } from 'react'
import './ChatInput.css'

export default function ChatInput({ messages, onSend, loading }) {
  const [value, setValue] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Chat</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Describe a system or process and I'll generate an interactive diagram.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${msg.role}`}>
            {msg.role === 'user' && <span className="chat-bubble__label">You</span>}
            {msg.role === 'assistant' && <span className="chat-bubble__label">Assistant</span>}
            <p className="chat-bubble__content">{msg.content}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-bubble--assistant">
            <span className="chat-bubble__label">Assistant</span>
            <p className="chat-bubble__content chat-loading">
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          className="chat-input"
          placeholder="Describe your system…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={loading}
        />
        <button className="chat-send" type="submit" disabled={loading || !value.trim()}>
          {loading ? '…' : '▶'}
        </button>
      </form>
    </div>
  )
}

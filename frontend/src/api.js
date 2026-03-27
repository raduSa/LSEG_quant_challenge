const BASE = 'http://localhost:8000'

export async function generateDiagram(query, sessionId) {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Generation failed')
  }
  return res.json()
}

export async function exportDiagram(mermaid, format = 'png') {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mermaid, format }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Export failed')
  }
  return res.blob()
}

export async function getHistory(sessionId) {
  const res = await fetch(`${BASE}/history?session_id=${sessionId}`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function clearHistory(sessionId) {
  const res = await fetch(`${BASE}/history?session_id=${sessionId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to clear history')
  return res.json()
}

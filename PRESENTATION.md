# NL → Diagram — App Overview

## What Is It?

A full-stack web app that turns a plain-English description of any system into an interactive, editable architecture diagram. You type a sentence, the AI builds the diagram, you interact with it in the browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | **FastAPI** (Python, async) |
| LLM | **GPT-4o** via **OpenRouter** (OpenAI SDK) |
| Conversation DB | **SQLite** + `aiosqlite` |
| HTTP client | **httpx** (for PNG export) |
| Frontend | **React 18** + **Vite** |
| Diagram canvas | **@xyflow/react v12** (React Flow) |
| Mermaid preview | **mermaid.js v10** |
| PNG export | **mermaid.ink** public API |

---

## How It Works — The 3-Pass Pipeline

Every time you send a message, the backend runs three LLM calls in sequence:

```
User text
   │
   ▼
[Pass 1 — Normalize]          normalize.txt prompt
  NL → structured JSON
  (nodes, edges, types, colors)
   │
   ▼
[Pass 2 — Generate]           generate.txt prompt
  JSON → Mermaid flowchart TD
   │
   ▼
[Pass 3 — Summarize]          summarize.txt prompt
  Mermaid + node/edge list
  → { node_id: "description", edge_id: "description" }
   │
   ▼
mermaid_parser.py
  Mermaid string → React Flow graph model
  (nodes with positions, edges with styling)
   │
   ▼
API response: { mermaid, graph, summaries, edgeSummaries }
```

---

## Backend Files

| File | Role |
|---|---|
| `main.py` | FastAPI app, 4 routes: `/generate`, `/export`, `/history`, `/history DELETE` |
| `orchestrator.py` | Runs the 3-pass pipeline, sanitizes labels |
| `llm.py` | Thin async wrapper around the OpenRouter/OpenAI chat API |
| `mermaid_parser.py` | Parses Mermaid syntax → React Flow nodes + edges, computes layout |
| `history.py` | SQLite CRUD for conversation history per session |
| `exporter.py` | Calls `mermaid.ink` API to render PNG/SVG server-side |
| `prompts/normalize.txt` | System prompt for Pass 1 |
| `prompts/generate.txt` | System prompt for Pass 2 |
| `prompts/summarize.txt` | System prompt for Pass 3 |

---

## Frontend Files

| File | Role |
|---|---|
| `App.jsx` | Root: state, API calls, layout |
| `ChatInput.jsx` | Chat panel, message history, send form |
| `DiagramCanvas.jsx` | React Flow canvas with 6 custom node types + custom edge |
| `MermaidPreview.jsx` | Static SVG preview with zoom controls |
| `Toolbar.jsx` | Edit/Preview toggle, Export PNG, Clear |
| `api.js` | `fetch` wrappers for all 4 backend routes |
| `graphToMermaid.js` | Serialises the React Flow graph back to Mermaid after user edits |

---

## 8 Node Types

Each maps to a distinct visual style and React component:

| Type | Shape | Color | Use |
|---|---|---|---|
| `user_endpoint` | Pill / stadium | Soft blue | Users, entry/exit points |
| `process` | Rounded rect | Light blue | Orchestrators, steps |
| `database` | Cylinder | Blue-grey | Storage, history |
| `guardrail` | Hexagon | Warm amber | Safety / policy filters |
| `blocked` | Grey pill | Grey | Rejected / terminal |
| `classifier` | Rect (thick border) | Soft green | Intent classifiers |
| `tool` | Rounded rect | Soft lavender | AI tools |
| `formatter` | Rounded rect | Soft teal | Response formatters |

---

## Interactive Canvas Features

- **Drag** nodes to reposition them
- **Double-click a node** → AI info panel (pre-generated summary + "Edit label" button)
- **Double-click an edge or its label** → Edge info panel (editable label + AI summary + nudge controls to fix label overlap)
- **Arrow nudge buttons (↑←⊙→↓)** in the edge panel reposition the label by 20px per press
- **Delete / Backspace** removes selected nodes or edges
- **Lock button** (via React Flow Controls) freezes the canvas
- **Draw new edges** by dragging from a handle

---

## Mermaid Preview

- Separate panel using `mermaid.js` with `theme: 'base'` (respects `classDef` colors exactly)
- Scroll-wheel + ± buttons for zoom
- "View source" expander shows raw Mermaid code
- Stays in sync: any canvas edit re-serialises to Mermaid in real time

---

## Export

- "Export PNG" calls `POST /export` with the Mermaid string
- Backend base64-encodes the Mermaid, calls `https://mermaid.ink/img/<encoded>?bgColor=ffffff`
- Returns PNG bytes, frontend triggers a browser download

---

## Conversation History

- Each browser tab gets a unique `session-<timestamp>` ID
- Every query + generated diagram is stored in SQLite
- The last 10 messages are prepended to each new prompt as `[CONVERSATION HISTORY]`
- This lets you refine: *"same diagram but add a caching layer"* works correctly

---

## Robustness — Edge Cases Handled

| Problem | Fix |
|---|---|
| LLM uses `end`, `start`, `class` as node IDs (Mermaid reserved words) | `_safe_id()` appends `_node` automatically |
| LLM puts `(Mom)` in a label like `Alice (Mom)` → Mermaid parse error | `_sanitize_mermaid_labels()` strips parenthetical content from rectangle labels before parsing |
| LLM wraps output in markdown fences | `_extract_mermaid()` and `_extract_json()` strip fences and find the first valid block |
| Comma-separated class assignments `class a,b,c styleName` | `_parse_class_assignments()` splits on `,` and maps each ID |
| Edge labels overlap visually | Custom edge uses `EdgeLabelRenderer` + per-edge `labelOffsetX/Y` controllable via nudge panel |

---

## Running the App

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # opens http://localhost:5173
```

Requires a `.env` in `backend/`:
```
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=openai/gpt-4o   # optional, default is gpt-4o
```

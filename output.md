# Diagram Language Comparison: D2 vs Alternatives

## D2 — Is it a good idea?

**D2** is a modern declarative diagram language with genuinely beautiful output and smart layout engines (Dagre, ELK, TALA). However, for this specific challenge it has a critical weakness:

> **LLMs are not well-trained on D2 syntax.** It's a relatively new language (2022) with limited representation in training data. This means Claude/GPT will hallucinate syntax, produce incorrect output, or require heavy prompt engineering to coerce into valid D2.

The core of this challenge is the LLM generating diagram code from natural language — so the LLM's familiarity with the syntax is the most important factor.

---

## Comparison Table

| Language | LLM Reliability | Visual Quality | Python Integration | Shapes/Colors | Verdict |
|---|---|---|---|---|---|
| **Mermaid** | ★★★★★ | ★★★★ | `streamlit-mermaid`, renders in browser | `classDef`, node shapes | **Best fit** |
| **Graphviz/DOT** | ★★★★ | ★★★ | `graphviz` pip package, generates PNG/SVG | `fillcolor`, shapes | Strong fallback |
| **D2** | ★★ | ★★★★★ | Requires CLI binary (`d2`), subprocess call | Yes, good support | Poor fit (LLM gap) |
| **PlantUML** | ★★★ | ★★★ | Requires JVM, complex setup | Limited | Overkill |
| **diagrams (mingrammer)** | ★★★ | ★★★★ | Pure Python | Cloud icons | Wrong domain |

---

## Recommendation: Mermaid

**Why Mermaid wins for this challenge:**

1. **LLM reliability** — Claude and GPT have seen millions of Mermaid examples. Generation is consistent and correct first-try.
2. **Color support** — `classDef` handles the red/green requirement cleanly:
   ```
   classDef red fill:#e74c3c,color:#fff,stroke:#c0392b
   classDef green fill:#27ae60,color:#fff,stroke:#1e8449
   class SentimentTool,SummarizationTool,DrawingTool red
   class IntentClassifier green
   ```
3. **Shapes** — supports `[(cylinder)]` for the history database, `([oval])` for user endpoints — hits the "Technical Accuracy" rubric pillar.
4. **Streamlit integration** — `streamlit-mermaid` renders inline with no external binary required.
5. **Editable in UI** — Mermaid is plain text, so the user can tweak the code in a textarea and re-render live (bonus points per the slides).

---

## When D2 Would Be the Right Choice

D2 makes sense if:
- You have a fixed/templated diagram and the LLM only fills in node names (not structure)
- You pre-generate the D2 code yourself and just render it
- Visual polish is the top priority over reliability

For this challenge, neither of those conditions apply — the LLM must generate the full structure from a messy natural language query.

---

## Secondary Option: Graphviz as Fallback

If Mermaid rendering has issues in Streamlit, Graphviz (`pip install graphviz`) is a reliable fallback:
- LLMs know DOT syntax well
- Generates PNG/SVG directly
- Full color and shape control
- No JavaScript dependency

Could implement both: Mermaid as primary renderer, Graphviz as fallback if parse fails.

---

---

# Architecture Design: NL → Mermaid Diagram App

## Technology Choices

| Layer | Choice | Why |
|---|---|---|
| **UI** | Streamlit | Fast to build, diagram canvas + chat side-by-side. Praised in Product C ("gold standard"). |
| **LLM** | OpenAI `gpt-4o` (primary) / Ollama (fallback) | GPT-4o writes clean Mermaid reliably. Ollama (`llama3`, `mistral`) for local/offline. |
| **Guardrails** | Azure Content Safety API | Required by the challenge spec explicitly. |
| **Diagram syntax** | Mermaid | LLM-friendly, rich shapes, color support, widely rendered. |
| **Rendering** | `mermaid.ink` REST API | No JS runtime needed server-side. |
| **History** | SQLite or in-memory dict | Simple, sufficient for the scope. |
| **Backend** | Python (pure Streamlit or + FastAPI) | Keeps the stack minimal. |

## Key Design Decisions

### 1. LLM Prompt Strategy (Two-Pass)
- **Pass 1 — Normalize**: Clean typos, fix "classificator" → "Classifier", "summarizations" → "Summarization". Extract entities, relationships, color instructions.
- **Pass 2 — Generate**: Produce Mermaid code from the structured representation. More robust than one-shot generation.
- **System prompt** enforces: `flowchart TD`, correct `classDef` color syntax, shape conventions (cylinder for DB, ovals for user endpoints).

### 2. Mermaid Color/Shape Handling
```
classDef tool fill:#e74c3c,color:white
classDef classifier fill:#2ecc71,color:white
class SentimentTool,SummarizationTool,DrawingTool tool
class IntentClassifier classifier
```

### 3. Resilience to Typos
Handled in Pass 1 — a normalization step before any diagram generation.

### 4. Bonus Features
- Editable Mermaid code textarea → re-render live
- PNG export button
- Model selector sidebar (GPT-4o / GPT-4o-mini / Ollama)

## Folder Structure

```
/LSEG
  app.py              # Streamlit entry point
  orchestrator.py     # Main pipeline logic
  guardrails.py       # Azure Content Safety wrapper
  llm.py              # OpenAI/Ollama abstraction
  history.py          # Conversation store
  renderer.py         # Mermaid → image via mermaid.ink
  prompts/
    system_prompt.txt
    normalize_prompt.txt
  requirements.txt
```

---

# App Pipeline & Why Azure Content Safety

## The Pipeline (Step by Step)

```
User Query
    │
    ▼
[1] Streamlit UI          — receives raw natural language input
    │
    ▼
[2] Append History        — prepends prior conversation turns for context continuity
    │
    ▼
[3] Azure Content Safety  — screens the enriched prompt for harmful/policy-violating content
    │ blocked → "Request Blocked" response
    │ approved ↓
    ▼
[4] Normalize (LLM Pass 1) — fixes typos, resolves ambiguous terms, extracts entities + colors
    │
    ▼
[5] Generate Mermaid (LLM Pass 2) — produces valid Mermaid flowchart code
    │
    ▼
[6] Render               — mermaid.ink converts code → SVG/PNG
    │
    ▼
[7] Response Formatter    — packages diagram + explanation for display
    │
    ├──► Store to Conversation History (DB)
    │
    ▼
[8] Streamlit UI          — displays diagram, editable code, export button
```

### Why Two LLM Passes?

| One-shot | Two-pass |
|---|---|
| "Generate Mermaid for this messy query" | First understand, then generate |
| Typos leak into node labels | Node labels are cleaned |
| Hallucination risk higher | Structured intermediate = less drift |
| Harder to debug | Can inspect normalized output separately |

---

## Why Azure Content Safety?

### Short answer: the challenge explicitly requires it.

The spec says: *"applies azure guardrails"* — it's a named component in the required architecture diagram. Removing it would fail **Task Alignment** scoring.

### What it actually does

Azure Content Safety is a multi-category content moderation API. For this app it catches:

| Category | Example |
|---|---|
| **Hate speech** | Diagrams prompted with discriminatory language |
| **Violence** | Queries asking to diagram attack patterns |
| **Prompt injection** | `"Ignore previous instructions and..."` |
| **Jailbreak attempts** | Tie-breaker criterion: *"Resilience to malicious attacks"* |

### Where it sits in the pipeline

It sits **after history append** but **before the LLM call** — so you're screening the fully enriched prompt (user query + previous context), not just the raw one-liner. This is the correct placement because:
- Context from history could shift the meaning of an otherwise safe query
- You guard the full input the LLM will actually see

### What happens on block

A "Request Blocked" terminal node is shown — matching the challenge's reference architecture exactly. No LLM call is made, no tokens wasted.

### Is it strictly necessary technically?

For a vanilla diagram app, no. But for this challenge:
1. It's specified in the rubric architecture
2. It earns points on **Task Alignment** and **Logical Correctness**
3. It directly contributes to the **"Resilience to malicious attacks"** tie-breaker criterion

---

---

# Mermaid vs Graphviz (DOT Syntax)

## Comparison Table

| Factor | Mermaid | Graphviz/DOT |
|---|---|---|
| **LLM reliability** | ★★★★★ | ★★★★ |
| **Visual quality** | ★★★★ | ★★★ |
| **Layout control** | Auto (opinionated) | Fine-grained (but harder) |
| **Color/shape support** | `classDef`, all shapes | `fillcolor`, `shape=cylinder` — very expressive |
| **Python integration** | `streamlit-mermaid`, browser-native | `pip install graphviz` — needs system binary |
| **Streamlit rendering** | Native, no binary needed | Requires `graphviz` binary installed |
| **DB shape (cylinder)** | `[("name")]` syntax | `shape=cylinder` — more semantically correct |
| **Subgraph/grouping** | Basic | Excellent — `subgraph cluster_{}` |
| **Arrow styles** | Limited | Rich: `dashed`, `dotted`, `bold` |
| **LLM training data** | Massive (GitHub READMEs, docs) | Good (older, extensive examples) |

## When Graphviz wins

- Fine-grained layout control (force node positions, custom spacing)
- Semantically correct shapes (actual cylinder for DB, diamond for decisions)
- Rich edge styles — solid vs dashed arrows for "primary flow" vs "background storage" (judges specifically praised this in the slides for "Technical Accuracy")

## When Mermaid wins

- Zero deployment friction — no binary to install
- Native Streamlit rendering via `streamlit-mermaid`
- Maximum LLM reliability — more saturated in training data
- Color requirement (`classDef`) is clean and simple

## Recommendation: Mermaid primary, Graphviz as fallback

For this challenge Mermaid is the better primary choice because:
1. Streamlit renders it natively in the browser — no subprocess, no binary
2. GPT-4o generates valid Mermaid first-try more consistently
3. `classDef` handles the red/green coloring requirement cleanly

**Bonus strategy:** implement Graphviz as an automatic fallback — if LLM-generated Mermaid fails to parse/render, regenerate as DOT and render via the `graphviz` Python package. This demonstrates resilience and multiple rendering backends, which is worth bonus points.

---

---

# User Diagram Editing & Control: Mermaid vs Graphviz

## What Does "Editing" Actually Mean?

### Option A: Text-based editing (simplest)
Both syntaxes work identically — show source in `st.text_area`, user edits, re-render on change. No meaningful difference.

### Option B: Structured UI editing (more powerful)
This is the right approach. **Decouple the internal graph model from the rendering syntax:**

```
User Query
    → LLM → [Graph Model: nodes + edges + styles]  ← source of truth
                    ↓
            Render to Mermaid  ← live preview in Streamlit
            Render to DOT      ← export / fallback
                    ↓
            User edits via structured UI:
              - st.text_input  → rename node labels
              - st.color_picker → change node colors
              - st.button      → add / delete nodes
              - st.multiselect → remove edges
```

The UI acts on the **model**, not the syntax. Both Mermaid and Graphviz are just views of the same model.

## Does Graphviz Give More Control?

**Programmatically: yes, slightly.** The `graphviz` Python package has a clean node-by-node API:

```python
g = graphviz.Digraph()
g.node('Classifier', style='filled', fillcolor='green')
g.edge('Classifier', 'SentimentTool', style='dashed')
```

vs Mermaid which is always string manipulation. However, with the graph model layer this distinction disappears — you build from the model either way.

**For drag-drop visual editing: neither.** Both render static images. True drag-and-drop requires a JS library (React Flow etc.) — out of scope for Streamlit.

## Revised Decision Matrix

| Need | Best choice |
|---|---|
| Text editing of raw source | Either (tie) |
| Structured node/edge editing UI | **Graph model → Graphviz** (cleaner programmatic API) |
| Live re-render in Streamlit | **Mermaid** (no binary dependency) |
| Export to PNG (high quality) | **Graphviz** |
| Dashed vs solid edges (Technical Accuracy score) | **Graphviz** |

## Final Architecture Decision

**Graph model as source of truth** — a simple Python dataclass or dict:
```python
{
  "nodes": [{"id": "Classifier", "label": "Intent Classifier", "color": "green", "shape": "rect"}],
  "edges": [{"from": "Classifier", "to": "SentimentTool", "style": "solid"}]
}
```

- **Mermaid** → live preview, in-browser rendering, fast iteration
- **Graphviz** → export PNG, fallback renderer, fine-grained edge/shape control
- Editing UI acts on the model → re-renders both outputs automatically

---

---

# Real Frontend Architecture (React + FastAPI)

## Does Switching to a Real Frontend Change the Mermaid Decision?

**Mermaid gets stronger with a real frontend.** The main weakness of Mermaid in Streamlit was needing `mermaid.ink` (external API) or `streamlit-mermaid` (limited). In a React app, Mermaid has a **native JavaScript library** that renders directly in the browser with zero server involvement.

```
[React Frontend]  ←──── REST/WebSocket ────→  [FastAPI Backend]
      │                                               │
  mermaid.js                                    LLM (OpenAI)
  React Flow                                    Azure Guardrails
  (drag-drop edit)                              Conversation History
                                                Graph Model (JSON)
```

## Stack Breakdown

### Backend: FastAPI (Python)
Keeps all the intelligence server-side:
- LLM calls (OpenAI / Ollama)
- Azure Content Safety
- Conversation history (SQLite)
- Returns a **Graph Model JSON** — not raw Mermaid string

```python
# API response shape
{
  "mermaid": "flowchart TD\n  ...",   # rendered string for display
  "graph": {                           # structured model for editing
    "nodes": [{"id": "C", "label": "Intent Classifier", "color": "#27ae60", "shape": "rect"}],
    "edges": [{"from": "C", "to": "ST", "style": "solid", "label": "sentiment"}]
  }
}
```

### Frontend: React + Vite

| Library | Purpose |
|---|---|
| `mermaid` (npm) | Render Mermaid syntax natively in-browser, no server call |
| **React Flow** | Drag-and-drop interactive node editing, deletion, reconnection |
| `axios` / `fetch` | Talk to FastAPI backend |
| `react-syntax-highlighter` | Show editable Mermaid source code with syntax highlighting |

## Why React Flow is the Key Piece

React Flow (`reactflow` on npm) is purpose-built for interactive node graphs:
- **Drag nodes** to reposition
- **Click to delete** nodes or edges
- **Click to edit** node labels inline
- Renders from the graph model JSON directly
- The result can be serialized back to Mermaid or DOT for export

This gives you true drag-drop diagram editing — impossible in Streamlit.

## Mermaid's Role in a Real Frontend

Mermaid.js (the npm package) renders directly in `<div>` elements:
```js
import mermaid from 'mermaid';
mermaid.render('diagram', mermaidString).then(({ svg }) => {
  document.getElementById('output').innerHTML = svg;
});
```

No server, no binary, no external API. The backend just returns the string.

## Two UI Modes (Best of Both Worlds)

| Mode | Library | Use case |
|---|---|---|
| **Preview mode** | `mermaid.js` | Fast read-only render of generated diagram |
| **Edit mode** | React Flow | User drags, deletes, reconnects nodes interactively |

Toggle between them with a button. Edit mode exports back to Mermaid/DOT via serialization.

## Is Graphviz Still Relevant with a Real Frontend?

**For rendering: no** — Mermaid.js in-browser is cleaner and faster.
**For export: yes** — use the Python `graphviz` package server-side to generate a high-quality PNG when the user hits "Export."

## Summary: Streamlit vs Real Frontend

| | Streamlit | React + FastAPI |
|---|---|---|
| **Build time** | 1–2 days | 3–5 days |
| **LLM/guardrails** | Python only | FastAPI (same Python) |
| **Mermaid rendering** | Via `mermaid.ink` or plugin | Native `mermaid.js` in browser |
| **Diagram editing** | Text area only | React Flow (full drag-drop) |
| **Visual quality** | Good | Excellent |
| **Bonus points** | Moderate | High (UI/UX criterion) |

**Recommendation:** if you have time, go React + FastAPI. The scoring rubric has a UI/UX tie-breaker, and React Flow interactive editing is a strong differentiator over a Streamlit text area. Mermaid remains the right diagram syntax — it's just rendered on the frontend now instead of the backend.

---

---

# Mermaid: Static vs Dynamic — How It Actually Works

## The Core Truth: Mermaid Output is Always Static SVG

Mermaid takes a text string and produces an SVG image. That SVG is a flat picture — you cannot drag nodes, click edges, or interact with it beyond basic hover CSS. This is fundamental to how Mermaid works.

```
mermaidString → mermaid.js → SVG (static image)
```

There is no way around this. Mermaid is a **renderer**, not an **interactive canvas**.

---

## So How Do You Get Dynamic Behaviour?

### What "Dynamic" means in this context:

| Type of dynamic | How to achieve it |
|---|---|
| Re-render on text change | User edits text area → call `mermaid.render()` again → new SVG replaces old one |
| Re-render on UI action | User clicks "Delete node X" → update graph model → re-render Mermaid |
| True drag-drop editing | **React Flow** — not Mermaid |
| Animate the diagram | CSS animations on the SVG elements (limited) |

### Pattern 1: Live Re-render (pseudo-interactive)

```
[text area with Mermaid source]
         ↓ onChange
   mermaid.render(newCode)
         ↓
   replace <div> with new SVG
```

This feels "live" but it's just regenerating a static image on every keystroke. This is what editors like the Mermaid Live Editor do. Fast enough that users don't notice.

### Pattern 2: React Flow for true interactivity (recommended)

```
LLM → Graph Model JSON
              ↓
       React Flow renders it
       (real DOM nodes, draggable)
              ↓
       User drags / deletes / edits
              ↓
       Serialize back to Graph Model
              ↓
       Generate Mermaid string from model
       → display as read-only preview or export
```

React Flow nodes are actual React DOM elements — fully interactive. The user edits the graph visually, and you serialize the result back to Mermaid text for display/export.

---

## The Right Mental Model

Think of it as two separate layers:

```
┌─────────────────────────────────────────────────────┐
│  INTERACTION LAYER  →  React Flow                   │
│  (drag, delete, rename, add — real DOM elements)    │
├─────────────────────────────────────────────────────┤
│  DISPLAY LAYER      →  Mermaid.js                   │
│  (beautiful static SVG render for preview/export)   │
└─────────────────────────────────────────────────────┘
         Both driven by the same Graph Model JSON
```

- **React Flow** is the editable canvas
- **Mermaid** is the pretty read-only view and the export format
- The **Graph Model** is the source of truth, shared between both

### Concrete UI Flow:
1. User types query → backend returns Graph Model + Mermaid string
2. **Preview tab**: Mermaid renders the SVG → clean, styled diagram
3. **Edit tab**: React Flow loads the same Graph Model → user drags, deletes, edits
4. User hits "Save" → serialize React Flow state → update Graph Model → re-render Mermaid preview
5. User hits "Export PNG" → backend renders Graph Model via Graphviz → high-quality PNG

---

## Does Mermaid vs Graphviz Change with This Model?

No — both are equally static. Graphviz also just produces a PNG/SVG image. Neither can be "dragged." The interactivity **always** comes from React Flow operating on the graph model, not from the diagram renderer.

Mermaid still wins for the **display layer** because it renders natively in the browser. Graphviz stays relevant for **PNG export** (higher quality, run server-side).

---

---

# Intermediate Diagram Languages: Compiling to Interactive Frontends

## Yes — This Concept Exists and It's the Right Architecture

The idea is: **LLM generates a text-based intermediate → parser compiles it to a graph model → interactive frontend renders it.**

```
Natural Language
      ↓
   LLM generates
      ↓
[Intermediate: Mermaid / DOT / JSON]    ← "source language"
      ↓
   Parser / compiler
      ↓
[Graph Model: nodes[], edges[], styles] ← "IR" (intermediate repr.)
      ↓
   Renderer
      ↓
[React Flow / Cytoscape.js / vis.js]    ← interactive frontend
```

---

## The Main Candidates

### 1. Mermaid → React Flow (best fit for this project)

Mermaid has an internal AST you can extract and compile to a React Flow graph model:

```js
import mermaid from 'mermaid';
const { db } = await mermaid.mermaidAPI.parse(mermaidString);
const nodes = db.getVertices();
const edges = db.getEdges();
// → convert to React Flow { id, data, style } format
```

**The killer pipeline**: LLM generates Mermaid → parse to graph model → React Flow for interactive editing → serialize back to Mermaid.

### 2. DOT (Graphviz) → `dotparser` npm → any frontend

DOT is a full graph description language. Parse it with `dotparser` or `@viz-js/viz` in the browser, convert to any interactive renderer.

### 3. Cytoscape.js — JSON as the intermediate

Cytoscape.js takes a JSON graph model natively and renders an **interactive canvas** (drag, zoom, select):

```js
cytoscape({
  elements: {
    nodes: [{ data: { id: 'Classifier' }, style: { 'background-color': 'green' } }],
    edges: [{ data: { source: 'Classifier', target: 'SentimentTool' } }]
  }
});
```

All-in-one solution — no separate rendering/editing split needed. Less React-native but very capable.

### 4. ELK / elkjs — layout engine as compiler

ELK (Eclipse Layout Kernel) is a graph **layout** engine compiled to JS. It takes a graph model and returns `{x, y}` positions. Used internally by React Flow's auto-layout and by Mermaid itself. Use this if you need to control layout independently of rendering.

---

## Comparison for This Project

| Intermediate | LLM generates it? | Interactive frontend | Effort |
|---|---|---|---|
| **Mermaid → React Flow** | ✅ Reliably | ✅ via parser + React Flow | Medium |
| **DOT → Cytoscape.js** | ✅ Well | ✅ Cytoscape is self-contained | Medium |
| **JSON model directly** | ⚠️ Less reliable syntax | ✅ Any renderer | Low (no parser) |
| **ELK JSON** | ❌ LLMs don't know it | ✅ with React Flow | High |

---

## Recommended Pipeline (Compiler Analogy)

```
LLM (gpt-4o)
    ↓  "frontend" of the compiler
Mermaid string          ← LLM knows this syntax best
    ↓  "parsing"
mermaid.parse() → AST   ← built-in, no extra deps
    ↓  "IR"
Graph Model JSON        ← normalize nodes/edges/styles
    ↓  "code generation"
React Flow              ← interactive editing runtime
    ↓  "output targets"
→ Serialize → Mermaid string   (preview / export)
→ Render → Graphviz PNG        (high-quality export, server-side)
```

**Mermaid is the high-level source language. Graph Model is the IR. React Flow is the runtime.** This is a genuine compiler pipeline — and it's the cleanest architecture for this project.

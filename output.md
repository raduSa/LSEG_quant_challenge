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


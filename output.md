# Improvement Prompt (give this to the AI that built the app)

````
I need you to fix and improve the NL→Diagram app. There are several issues across the Mermaid preview, the React Flow edit panel, the export feature, and the overall visual quality.

---

## BUG FIX 1: Export PNG — "Tainted canvases may not be exported"

The "Export PNG" button fails with: `Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.`

This happens because the current export method tries to use `html-to-image` or `canvas.toDataURL()` on the React Flow canvas, which contains external resources (fonts, SVGs) that taint the canvas due to CORS.

**Fix:** Do NOT export via client-side canvas capture. Instead:
1. Use the `@xyflow/react` built-in `toSvg()` / `toPng()` from `@xyflow/react` — these handle cross-origin correctly OR
2. Better approach: use the current Mermaid string to render the export server-side. Send a POST to `/export` with the **mermaid string** (not the graph model), and on the backend use the `mermaid.ink` API to render it as PNG:
   ```python
   import base64, urllib.parse, httpx
   
   async def export_mermaid_png(mermaid_code: str) -> bytes:
       encoded = base64.urlsafe_b64encode(mermaid_code.encode()).decode()
       url = f"https://mermaid.ink/img/{encoded}"
       async with httpx.AsyncClient() as client:
           resp = await client.get(url)
           return resp.content
   ```
3. Alternative client-side fix: use React Flow's `getNodesBounds` + `getViewportForBounds` and render to SVG manually, then convert SVG to PNG with a `<canvas>` element where you inline all styles.

The simplest reliable fix is option 2 (server-side via mermaid.ink). Add `httpx` to requirements.txt.

---

## BUG FIX 2: Edit Panel — Zoom, Fullscreen, Lock buttons

The React Flow `<Controls>` component shows zoom +/-, fullscreen, and lock buttons but they may not be working. Ensure:

1. Import and render `<Controls />` from `@xyflow/react` inside the `<ReactFlow>` component (as a child, not outside)
2. The lock button should toggle `nodesDraggable` and `nodesConnectable` state:
   ```jsx
   const [locked, setLocked] = useState(false);
   <ReactFlow
     nodesDraggable={!locked}
     nodesConnectable={!locked}
     ...
   >
     <Controls onInteractiveChange={(interactive) => setLocked(!interactive)} />
   </ReactFlow>
   ```
3. Fullscreen button: `<Controls>` has fit-view built in. If it doesn't work, ensure the ReactFlow instance has `fitView` prop set
4. Import the Controls CSS: `import '@xyflow/react/dist/style.css';`

---

## VISUAL FIX 1: Mermaid Preview — Smaller text, clearer labels, white background on edge text

The edge labels and node labels in the Mermaid preview are too large and overlap the lines. Fix by adding Mermaid configuration when initializing:

```js
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontSize: '12px',
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#e8f4f8',
    primaryBorderColor: '#2980b9',
    lineColor: '#5d6d7e',
    edgeLabelBackground: '#ffffff',  // KEY: white background behind edge labels
    clusterBkg: '#f8f9fa',
  },
  flowchart: {
    curve: 'basis',         // smooth curved edges instead of angular
    padding: 15,
    nodeSpacing: 30,
    rankSpacing: 50,
    htmlLabels: true,
    useMaxWidth: true,
  }
});
```

Key changes:
- `fontSize: '12px'` — smaller text throughout
- `edgeLabelBackground: '#ffffff'` — gives edge labels a clear white background so they don't overlap lines
- `curve: 'basis'` — smoother curved edges instead of angular ones
- increased `nodeSpacing` and `rankSpacing` for less clutter

---

## VISUAL FIX 2: React Flow Edit Panel — Custom node shapes (UML-style)

The React Flow nodes currently all look like plain rectangles with harsh colors. Create custom node components that use distinct shapes per component type like proper UML/system architecture diagrams:

### Custom Node Types to register:

```jsx
import { Handle, Position } from '@xyflow/react';

// ProcessNode — rounded rectangle with shadow (for orchestrator, append history, etc.)
const ProcessNode = ({ data, style }) => (
  <div style={{
    padding: '10px 20px',
    borderRadius: '8px',
    background: style?.background || '#d6eaf8',
    border: `2px solid ${style?.borderColor || '#2980b9'}`,
    color: style?.color || '#1a252f',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    textAlign: 'center',
    minWidth: '120px',
  }}>
    <Handle type="target" position={Position.Top} />
    {data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// DatabaseNode — cylinder shape via CSS (for Conversation History)
const DatabaseNode = ({ data, style }) => (
  <div style={{
    padding: '18px 18px 10px',
    borderRadius: '0 0 50% 50% / 0 0 20% 20%',
    background: style?.background || '#aed6f1',
    border: `2px solid ${style?.borderColor || '#2e86c1'}`,
    color: style?.color || '#1a252f',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    textAlign: 'center',
    minWidth: '130px',
    position: 'relative',
  }}>
    {/* Cylinder top ellipse */}
    <div style={{
      position: 'absolute', top: '-8px', left: '-2px', right: '-2px',
      height: '16px', borderRadius: '50%',
      background: style?.background || '#aed6f1',
      border: `2px solid ${style?.borderColor || '#2e86c1'}`,
    }} />
    <Handle type="target" position={Position.Top} />
    {data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// UserNode — stadium/pill shape (for User, User Response)
const UserNode = ({ data, style }) => (
  <div style={{
    padding: '8px 24px',
    borderRadius: '50px',
    background: style?.background || '#d6eaf8',
    border: `2px solid ${style?.borderColor || '#3498db'}`,
    color: style?.color || '#1a252f',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    textAlign: 'center',
    minWidth: '100px',
  }}>
    <Handle type="target" position={Position.Top} />
    {data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// BlockedNode — gray pill with stop icon (for Request Blocked)
const BlockedNode = ({ data }) => (
  <div style={{
    padding: '8px 24px',
    borderRadius: '50px',
    background: '#eaecee',
    border: '2px solid #95a5a6',
    color: '#5d6d7e',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    textAlign: 'center',
  }}>
    <Handle type="target" position={Position.Left} />
    ⛔ {data.label}
  </div>
);

// GuardrailNode — hexagon-ish (for Azure Guardrails — safety/checkpoint)
const GuardrailNode = ({ data, style }) => (
  <div style={{
    padding: '10px 24px',
    borderRadius: '4px',
    background: style?.background || '#fdebd0',
    border: `2px solid ${style?.borderColor || '#e67e22'}`,
    color: style?.color || '#1a252f',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    textAlign: 'center',
    minWidth: '130px',
    clipPath: 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
    paddingLeft: '30px',
    paddingRight: '30px',
  }}>
    <Handle type="target" position={Position.Top} />
    🛡️ {data.label}
    <Handle type="source" position={Position.Bottom} />
  </div>
);

// ClassifierNode — diamond/rhombus (for Intent Classifier — decision point)
const ClassifierNode = ({ data, style }) => (
  <div style={{
    padding: '16px 20px',
    background: style?.background || '#d5f5e3',
    border: `2px solid ${style?.borderColor || '#27ae60'}`,
    color: style?.color || '#1a252f',
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    textAlign: 'center',
    minWidth: '100px',
    transform: 'rotate(45deg)',
  }}>
    <div style={{ transform: 'rotate(-45deg)' }}>
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  </div>
);
```

Register them in DiagramCanvas.jsx:
```jsx
const nodeTypes = useMemo(() => ({
  process: ProcessNode,
  database: DatabaseNode,
  user_endpoint: UserNode,
  blocked: BlockedNode,
  guardrail: GuardrailNode,
  classifier: ClassifierNode,
  tool: ProcessNode,         // same shape, different pastel color
  formatter: ProcessNode,
}), []);

<ReactFlow nodeTypes={nodeTypes} ... />
```

---

## VISUAL FIX 3: Use PASTEL colors instead of harsh primary colors

Replace the current harsh flat colors with softer pastels. The fill is soft, the border carries the identity color. Text should be dark on pastel backgrounds.

### New Pastel Palette:

| Node Type | Fill (pastel) | Border (strong) | Text |
|---|---|---|---|
| user_endpoint | `#d6eaf8` (light blue) | `#2980b9` | `#1a252f` |
| process | `#d4e6f1` (soft blue) | `#5dade2` | `#1a252f` |
| database | `#aed6f1` (sky blue) | `#2e86c1` | `#1a252f` |
| guardrail | `#fdebd0` (peach) | `#e67e22` | `#1a252f` |
| blocked | `#eaecee` (light gray) | `#95a5a6` | `#5d6d7e` |
| classifier | `#d5f5e3` (mint green) | `#27ae60` | `#1a252f` |
| tool | `#fadbd8` (blush pink) | `#e74c3c` | `#1a252f` |
| formatter | `#d1f2eb` (mint teal) | `#16a085` | `#1a252f` |

Update these colors in:
1. The `generate.txt` Mermaid prompt → so the Mermaid preview uses pastels
2. The `mermaid_parser.py` → so React Flow nodes get pastel styles
3. The custom node components → as default fallbacks

---

## VISUAL FIX 4: Edge labels with white background in React Flow

In React Flow, edge labels overlap the lines. Fix by adding label background styling to every edge when parsing:

```jsx
// In mermaid_parser.py or wherever edges are created for React Flow:
{
  ...edge,
  type: 'smoothstep',
  animated: edge_style === 'dashed',
  labelStyle: { fontSize: 11, fontFamily: 'Inter', fill: '#2c3e50', fontWeight: 500 },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
  labelBgPadding: [6, 4],
  labelBgBorderRadius: 4,
  style: {
    stroke: edge_style === 'dashed' ? '#7f8c8d' : '#5d6d7e',
    strokeWidth: 1.5,
    strokeDasharray: edge_style === 'dashed' ? '5 5' : undefined,
  },
}
```

---

## PROMPT FIX: Update `generate.txt` for pastel + shapes

Update the Mermaid generate prompt's COLOR RULES section. Replace:
```
COLOR RULES (pastel fills, dark text, strong borders):
- user_endpoint: fill:#d6eaf8,color:#1a252f,stroke:#2980b9,stroke-width:2px
- process:       fill:#d4e6f1,color:#1a252f,stroke:#5dade2,stroke-width:2px
- database:      fill:#aed6f1,color:#1a252f,stroke:#2e86c1,stroke-width:2px
- guardrail:     fill:#fdebd0,color:#1a252f,stroke:#e67e22,stroke-width:2px
- blocked:       fill:#eaecee,color:#5d6d7e,stroke:#95a5a6,stroke-width:2px
- formatter:     fill:#d1f2eb,color:#1a252f,stroke:#16a085,stroke-width:2px
- classifier:    fill:#d5f5e3,color:#1a252f,stroke:#27ae60,stroke-width:2px (default, user can override)
- tool:          fill:#fadbd8,color:#1a252f,stroke:#e74c3c,stroke-width:2px (default, user can override)
```

---

## ALSO: Update `mermaid_parser.py` to set node `type` field

When the parser creates React Flow nodes from the Mermaid AST, it must set the `type` field to match the custom node component names:
- Stadium shapes `([...])` → `type: "user_endpoint"`
- Cylinder shapes `[(...)` → `type: "database"`
- Diamond shapes `{...}` → `type: "classifier"`
- All others → `type: "process"` (or `"tool"`, `"guardrail"`, `"formatter"` if detectable from the classDef assignments)

The node `type` field controls which custom React component renders it.

---

## Summary of ALL changes needed:

1. **Export PNG** → use server-side mermaid.ink rendering instead of client-side canvas capture
2. **Controls** → ensure `<Controls>` is inside `<ReactFlow>`, handle `onInteractiveChange` for lock, import the CSS
3. **Mermaid preview** → initialize with `fontSize: '12px'`, `edgeLabelBackground: '#ffffff'`, `curve: 'basis'`
4. **Custom React Flow nodes** → register `ProcessNode`, `DatabaseNode`, `UserNode`, `BlockedNode`, `GuardrailNode`, `ClassifierNode` with proper UML-style shapes
5. **Pastel colors** → replace harsh fills with soft pastels, keep strong borders, dark text
6. **Edge labels** → add `labelBgStyle: { fill: '#ffffff' }` and `labelBgPadding` to every edge
7. **Update `generate.txt`** → pastel color rules, keep cylinder `[(Label)]` for database
8. **Update `mermaid_parser.py`** → set node `type` field matching custom node type names
````

"""
Parse a Mermaid flowchart TD string into a React Flow compatible graph model.
"""
from __future__ import annotations
import re
from typing import Dict, List, Set, Tuple

# Mermaid reserved keywords that cannot be used as node IDs
_RESERVED: Set[str] = {
    "end", "start", "subgraph", "graph", "flowchart", "direction",
    "default", "class", "classDef", "click", "style", "linkStyle",
    "callback", "href", "call",
}

def _safe_id(node_id: str) -> str:
    if node_id.lower() in _RESERVED:
        return node_id + "_node"
    return node_id


# ── Pastel type palette ───────────────────────────────────────────────────────

TYPE_STYLES: Dict[str, Dict[str, str]] = {
    "user_endpoint": {"fill": "#eef6fd", "color": "#2c3e50", "border": "#aac4dd"},
    "process":       {"fill": "#edf4fb", "color": "#2c3e50", "border": "#9fb8ce"},
    "database":      {"fill": "#e8f2f9", "color": "#2c3e50", "border": "#8ab2cc"},
    "guardrail":     {"fill": "#fdf8ef", "color": "#2c3e50", "border": "#d4a86a"},
    "blocked":       {"fill": "#f4f5f6", "color": "#6b7888", "border": "#b8bdc2"},
    "classifier":    {"fill": "#eef9f3", "color": "#2c3e50", "border": "#8ec4a0"},
    "tool":          {"fill": "#f4effe", "color": "#2c3e50", "border": "#b09ad0"},
    "formatter":     {"fill": "#eef9f7", "color": "#2c3e50", "border": "#84bfad"},
}


def _get_node_type(shape: str, class_name: str) -> str:
    if shape == "stadium":
        return "user_endpoint"
    if shape == "cylinder":
        return "database"
    if shape == "diamond":
        return "classifier"
    cn = class_name.lower()
    if "tool" in cn:
        return "tool"
    if "guardrail" in cn:
        return "guardrail"
    if "fmt" in cn or "formatter" in cn:
        return "formatter"
    if "classifier" in cn:
        return "classifier"
    if "blocked" in cn:
        return "blocked"
    return "process"


# ── Shape detection ───────────────────────────────────────────────────────────

def _detect_shape(raw: str) -> str:
    s = raw.strip()
    if s.startswith("([") and s.endswith("])"):
        return "stadium"
    if s.startswith("[(") and s.endswith(")]"):
        return "cylinder"
    if s.startswith("{") and s.endswith("}"):
        return "diamond"
    return "default"


# Shape label patterns — avoids string slicing
_LABEL_PATTERNS: List[str] = [
    r"^\(\[(.*)\]\)$",    # stadium ([...])
    r"^\[\((.*)\)\]$",    # cylinder [(...)
    r"^\{(.*)\}$",        # diamond {...}
    r"^\[\[(.*)\]\]$",    # double bracket [[...]]
    r"^\[(.*)\]$",        # plain bracket [...]
    r"^\((.*)\)$",        # parentheses (...)
]

def _extract_label(raw: str) -> str:
    s = raw.strip()
    for pat in _LABEL_PATTERNS:
        m = re.match(pat, s)
        if m:
            return m.group(1).strip()
    return s


# ── classDef parsing ──────────────────────────────────────────────────────────

def _parse_classdefs(mermaid: str) -> Dict[str, Dict[str, str]]:
    styles: Dict[str, Dict[str, str]] = {}
    for m in re.finditer(r"classDef\s+(\w+)\s+([^\n]+)", mermaid, re.IGNORECASE):
        name, props = m.group(1), m.group(2)
        fill_m = re.search(r"fill:([#\w]+)", props)
        color_m = re.search(r"(?<![a-z])color:([#\w]+)", props)
        stroke_m = re.search(r"stroke:([#\w]+)", props)
        styles[name] = {
            "fill": fill_m.group(1) if fill_m else "",
            "color": color_m.group(1) if color_m else "",
            "stroke": stroke_m.group(1) if stroke_m else "",
        }
    return styles


def _parse_class_assignments(mermaid: str) -> Dict[str, str]:
    assignments: Dict[str, str] = {}
    for line in mermaid.splitlines():
        line = line.strip()
        if line.startswith("class ") and not line.startswith("classDef"):
            m = re.match(r"^class\s+([\w,\s]+?)\s+(\w+)\s*$", line)
            if m:
                class_name = m.group(2)
                for nid in m.group(1).split(","):
                    safe = _safe_id(nid.strip())
                    if safe:
                        assignments[safe] = class_name
    return assignments


# ── Node declaration parsing ──────────────────────────────────────────────────

def _parse_node_declarations(mermaid: str) -> Dict[str, Dict[str, str]]:
    nodes: Dict[str, Dict[str, str]] = {}
    for line in mermaid.splitlines():
        line = line.strip()
        if (
            not line
            or line.startswith("flowchart")
            or line.startswith("graph")
            or line.startswith("classDef")
            or line.startswith("class ")
            or "-->" in line
            or "-.->" in line
            or "---" in line
        ):
            continue
        m = re.match(
            r"^(\w+)\s*"
            r"(\(\[.*?\]\)|"
            r"\[?\(.*?\)\]?|"
            r"\[\[.*?\]\]|"
            r"\{.*?\}|"
            r"\[.*?\])",
            line, re.DOTALL
        )
        if m:
            node_id = _safe_id(m.group(1))
            raw_shape = m.group(2)
            nodes[node_id] = {
                "label": _extract_label(raw_shape),
                "shape": _detect_shape(raw_shape),
            }
    return nodes


# ── Edge parsing ──────────────────────────────────────────────────────────────

_EDGE_RE = re.compile(
    r"(\w+)\s*"
    r"(-[-\.]+>|={2,}>|--[ox]>?)\s*"
    r"(?:\|([^|]*)\|)?\s*"
    r"(\w+)"
)


def _parse_edges(mermaid: str) -> List[Dict]:
    edges: List[Dict] = []
    seen: Set[Tuple[str, str, str]] = set()
    for line in mermaid.splitlines():
        for m in _EDGE_RE.finditer(line.strip()):
            src = _safe_id(m.group(1))
            arrow = m.group(2)
            label = m.group(3)
            tgt = _safe_id(m.group(4))
            key = (src, tgt, label or "")
            if key in seen:
                continue
            seen.add(key)
            edges.append({
                "source": src,
                "target": tgt,
                "label": (label or "").strip(),
                "dashed": "." in arrow,
            })
    return edges


# ── Layout ────────────────────────────────────────────────────────────────────

def _compute_positions(node_ids: List[str], edges: List[Dict]) -> Dict[str, Dict]:
    in_degree: Dict[str, int] = {n: 0 for n in node_ids}
    children: Dict[str, List[str]] = {n: [] for n in node_ids}
    for e in edges:
        src, tgt = e["source"], e["target"]
        if src in children and tgt in in_degree:
            children[src].append(tgt)
            in_degree[tgt] += 1

    queue: List[str] = [n for n in node_ids if in_degree[n] == 0]
    layer: Dict[str, int] = {}
    while queue:
        node = queue.pop(0)
        for child in children.get(node, []):
            in_degree[child] -= 1
            layer[child] = max(layer.get(child, 0), layer.get(node, 0) + 1)
            if in_degree[child] == 0:
                queue.append(child)

    for n in node_ids:
        if n not in layer:
            layer[n] = len(layer)

    layers: Dict[int, List[str]] = {}
    for n, lv in layer.items():
        layers.setdefault(lv, []).append(n)

    X_SPACING = 240
    Y_SPACING = 140
    positions: Dict[str, Dict] = {}
    for l_idx, nodes_in_layer in sorted(layers.items()):
        total_w = (len(nodes_in_layer) - 1) * X_SPACING
        for i, n in enumerate(nodes_in_layer):
            positions[n] = {
                "x": i * X_SPACING - total_w / 2,
                "y": l_idx * Y_SPACING,
            }
    return positions


# ── Main public function ──────────────────────────────────────────────────────

def parse_mermaid(mermaid: str) -> Dict:
    classdefs = _parse_classdefs(mermaid)
    assignments = _parse_class_assignments(mermaid)
    declared_nodes = _parse_node_declarations(mermaid)
    raw_edges = _parse_edges(mermaid)

    all_ids: List[str] = list(declared_nodes.keys())
    for e in raw_edges:
        for nid in (e["source"], e["target"]):
            if nid not in all_ids:
                all_ids.append(nid)

    positions = _compute_positions(all_ids, raw_edges)

    nodes = []
    for idx, nid in enumerate(all_ids):
        info = declared_nodes.get(nid, {"label": nid, "shape": "default"})
        class_name = assignments.get(nid, "")
        cd = classdefs.get(class_name, {})
        node_type = _get_node_type(info["shape"], class_name)
        defaults = TYPE_STYLES.get(node_type, TYPE_STYLES["process"])

        fill = cd.get("fill") or defaults["fill"]
        text_color = cd.get("color") or defaults["color"]
        border_color = cd.get("stroke") or defaults["border"]

        pos = positions.get(nid, {"x": 0, "y": idx * 140})

        nodes.append({
            "id": nid,
            "type": node_type,
            "data": {
                "label": info["label"],
                "fill": fill,
                "borderColor": border_color,
                "textColor": text_color,
            },
            "position": pos,
            "style": {"background": "transparent", "border": "none", "padding": 0},
        })

    edges = []
    for idx, e in enumerate(raw_edges):
        dashed = e["dashed"]
        edges.append({
            "id": "e" + str(idx) + "-" + e["source"] + "-" + e["target"],
            "source": e["source"],
            "target": e["target"],
            "label": e["label"],
            "type": "smoothstep",
            "animated": dashed,
            "style": {
                "stroke": "#7f8c8d" if dashed else "#5d6d7e",
                "strokeWidth": 1.5,
                "strokeDasharray": "5 5" if dashed else None,
            },
            "labelStyle": {"fontSize": 11, "fill": "#2c3e50", "fontWeight": 500},
            "labelBgStyle": {"fill": "#ffffff", "fillOpacity": 0.9},
            "labelBgPadding": [6, 3],
            "labelBgBorderRadius": 4,
        })

    return {"nodes": nodes, "edges": edges}

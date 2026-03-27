"""
Full pipeline: raw user query → Mermaid string + React Flow graph model.
"""

import json
import re
from pathlib import Path
from typing import Dict, List

from llm import chat
from history import get_history, add_message
from mermaid_parser import parse_mermaid

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text(encoding="utf-8")


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from LLM output."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences
    stripped = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Find first {...} block
    m = re.search(r"\{[\s\S]+\}", text)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"Could not extract JSON from LLM output:\n{text[:300]}")


def _extract_mermaid(text: str) -> str:
    """Extract Mermaid diagram code from LLM output."""
    # Remove markdown fences if present
    m = re.search(r"```(?:mermaid)?\s*([\s\S]+?)```", text)
    if m:
        return m.group(1).strip()
    # If no fences, use text directly (the prompt asks for raw output)
    return text.strip()


def _sanitize_mermaid_labels(mermaid: str) -> str:
    """
    Strip parenthetical content from node labels to prevent Mermaid parse errors.
    e.g.  alice[Alice (Mom)]  →  alice[Alice]
    Leaves cylinder  [(Label)]  and stadium  ([Label])  shape-markers intact.
    """

    def clean_bracket(m: re.Match) -> str:
        inner = m.group(1).strip()
        # Cylinder pattern: entire content is wrapped in (...) — leave alone
        if inner.startswith("(") and inner.endswith(")"):
            return m.group(0)
        cleaned = re.sub(r"\s*\([^)]*\)", "", inner).strip()
        return f"[{cleaned}]" if cleaned else m.group(0)

    result = []
    for line in mermaid.splitlines():
        s = line.strip()
        # Skip non-node-declaration lines
        if (
            not s
            or "-->" in s
            or "-.->" in s
            or "---" in s
            or s.startswith(("flowchart", "graph", "classDef", "class ", "%%"))
        ):
            result.append(line)
            continue
        # Apply to all [...] bracket groups on the line
        result.append(re.sub(r"\[([^\[\]]+)\]", clean_bracket, line))

    return "\n".join(result)


def _build_history_context(history: list[dict]) -> str:
    if not history:
        return ""
    parts = ["[CONVERSATION HISTORY]"]
    for entry in history:
        role = entry["role"].upper()
        parts.append(f"{role}: {entry['content']}")
    return "\n".join(parts)


async def _generate_summaries(
    mermaid_str: str,
    nodes: List[Dict],
    edges: List[Dict],
) -> tuple:
    """Pass 3: ask the LLM to summarise every node and edge given the full diagram context."""
    node_list = [
        {"id": n["id"], "label": n["data"]["label"], "type": n["type"]}
        for n in nodes
    ]
    edge_list = [
        {"id": e["id"], "source": e["source"], "target": e["target"], "label": e.get("label", "")}
        for e in edges
    ]
    context = (
        f"DIAGRAM:\n{mermaid_str}\n\n"
        f"NODES:\n{json.dumps(node_list, indent=2)}\n\n"
        f"EDGES:\n{json.dumps(edge_list, indent=2)}"
    )
    summarize_prompt = _load_prompt("summarize.txt")
    raw = await chat(summarize_prompt, context)
    try:
        result = _extract_json(raw)
        node_summaries = {k: str(v) for k, v in result.get("nodes", {}).items()}
        edge_summaries = {k: str(v) for k, v in result.get("edges", {}).items()}
        return node_summaries, edge_summaries
    except Exception:
        return {}, {}


async def run_pipeline(query: str, session_id: str) -> dict:
    """
    Steps:
      1. Load conversation history
      2. LLM Pass 1 — normalize to structured JSON
      3. LLM Pass 2 — generate Mermaid from JSON
      4. Parse Mermaid → React Flow graph model
      5. Store to DB and return result
    """

    # ── Step 1: load history ──────────────────────────────────────────────────
    history = await get_history(session_id, limit=10)
    history_ctx = _build_history_context(history)

    # ── Step 2: normalize ─────────────────────────────────────────────────────
    normalize_prompt = _load_prompt("normalize.txt")
    user_input_with_history = query
    if history_ctx:
        user_input_with_history = f"{history_ctx}\n\n[CURRENT QUERY]\n{query}"

    raw_json_str = await chat(normalize_prompt, user_input_with_history)
    structured = _extract_json(raw_json_str)

    # ── Step 3: generate Mermaid ──────────────────────────────────────────────
    generate_prompt = _load_prompt("generate.txt")
    mermaid_raw = await chat(generate_prompt, json.dumps(structured, indent=2))
    mermaid_str = _extract_mermaid(mermaid_raw)
    mermaid_str = _sanitize_mermaid_labels(mermaid_str)

    # Ensure it starts with flowchart declaration
    if not mermaid_str.startswith("flowchart") and not mermaid_str.startswith("graph"):
        mermaid_str = "flowchart TD\n" + mermaid_str

    # ── Step 4: parse Mermaid → graph model ──────────────────────────────────
    graph_model = parse_mermaid(mermaid_str)

    # ── Step 5: generate node + edge summaries ───────────────────────────────
    node_summaries, edge_summaries = await _generate_summaries(
        mermaid_str, graph_model["nodes"], graph_model["edges"]
    )

    # ── Step 6: store & return ────────────────────────────────────────────────
    await add_message(session_id, "user", query)
    await add_message(
        session_id,
        "assistant",
        "Diagram generated.",
        mermaid=mermaid_str,
        graph=graph_model,
    )

    return {
        "mermaid": mermaid_str,
        "graph": graph_model,
        "summaries": node_summaries,
        "edgeSummaries": edge_summaries,
    }

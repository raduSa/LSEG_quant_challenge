"""
Export a Mermaid diagram to PNG/SVG via the mermaid.ink public rendering API.
"""

import base64
import httpx  # type: ignore[import-untyped]

MERMAID_INK = "https://mermaid.ink"


async def _fetch_bytes(url: str) -> bytes:
    client = httpx.AsyncClient(timeout=30.0)
    try:
        resp = await client.get(url)
        resp.raise_for_status()
        result: bytes = bytes(resp.content)
    finally:
        await client.aclose()
    return result


async def export_mermaid_png(mermaid_code: str) -> bytes:
    encoded = base64.urlsafe_b64encode(mermaid_code.encode()).decode()
    return await _fetch_bytes(f"{MERMAID_INK}/img/{encoded}?bgColor=ffffff")


async def export_mermaid_svg(mermaid_code: str) -> bytes:
    encoded = base64.urlsafe_b64encode(mermaid_code.encode()).decode()
    return await _fetch_bytes(f"{MERMAID_INK}/svg/{encoded}")

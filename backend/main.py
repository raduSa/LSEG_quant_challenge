from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

from orchestrator import run_pipeline
from history import init_db, get_history, delete_history
from exporter import export_mermaid_png, export_mermaid_svg

app = FastAPI(title="NL-to-Diagram API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


# ── Models ────────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    query: str
    session_id: str = "default"


class ExportRequest(BaseModel):
    mermaid: str
    format: str = "png"  # "png" or "svg"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/generate")
async def generate(req: GenerateRequest):
    try:
        result = await run_pipeline(req.query, req.session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export")
async def export(req: ExportRequest):
    try:
        fmt = req.format.lower()
        if fmt == "svg":
            data = await export_mermaid_svg(req.mermaid)
            media_type = "image/svg+xml"
            filename = "diagram.svg"
        else:
            data = await export_mermaid_png(req.mermaid)
            media_type = "image/png"
            filename = "diagram.png"
        return Response(
            content=data,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
async def history(session_id: str = Query("default")):
    return await get_history(session_id)


@app.delete("/history")
async def clear_history(session_id: str = Query("default")):
    await delete_history(session_id)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

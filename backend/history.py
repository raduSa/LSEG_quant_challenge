import aiosqlite
import json
from datetime import datetime

DB_PATH = "history.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                mermaid TEXT,
                graph TEXT,
                created_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def get_history(session_id: str, limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
    result = []
    for row in reversed(rows):
        entry = {
            "role": row["role"],
            "content": row["content"],
            "mermaid": row["mermaid"],
            "graph": json.loads(row["graph"]) if row["graph"] else None,
        }
        result.append(entry)
    return result


async def add_message(
    session_id: str,
    role: str,
    content: str,
    mermaid: str | None = None,
    graph: dict | None = None,
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO messages (session_id, role, content, mermaid, graph, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                role,
                content,
                mermaid,
                json.dumps(graph) if graph else None,
                datetime.utcnow().isoformat(),
            ),
        )
        await db.commit()


async def delete_history(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM messages WHERE session_id = ?", (session_id,)
        )
        await db.commit()

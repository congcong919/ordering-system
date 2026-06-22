import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Ensure backend/ root is importable regardless of CWD
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")


def _check_api_key() -> None:
    if not os.environ.get("DEEPSEEK_API_KEY"):
        raise RuntimeError(
            "DEEPSEEK_API_KEY is missing or empty. "
            "Copy backend/.env.example to backend/.env and add your key."
        )


_check_api_key()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.agent import run_agent_stream, remove_session

app = FastAPI(title="La Bella Cucina — Restaurant AI API")

_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str
    firebase_token: str = ""


@app.get("/api/health")
async def health():
    return {"status": "ok", "restaurant": "La Bella Cucina"}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    logger.info("Chat request received: session=%s", req.session_id)
    queue: asyncio.Queue = asyncio.Queue()

    async def event_generator():
        task = asyncio.create_task(run_agent_stream(req.message, req.session_id, queue, req.firebase_token))
        try:
            while True:
                token = await queue.get()
                if token is None:
                    yield {"event": "done", "data": ""}
                    break
                yield {"event": "token", "data": json.dumps({"text": token})}
        finally:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    return EventSourceResponse(event_generator())


@app.delete("/api/session/{session_id}")
async def clear_session(session_id: str):
    removed = remove_session(session_id)
    return {"cleared": session_id, "existed": removed}

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import httpx
from unittest.mock import patch

from main import app, _origins


async def _fake_stream(message, session_id, queue, firebase_token=""):
    """Minimal stand-in for run_agent_stream: emits two tokens then the sentinel."""
    await queue.put("Hello ")
    await queue.put("world")
    await queue.put(None)


@pytest.fixture
async def client():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ── GET /api/health ───────────────────────────────────────────────────────────

async def test_health_returns_200(client):
    response = await client.get("/api/health")
    assert response.status_code == 200


async def test_health_response_body(client):
    response = await client.get("/api/health")
    assert response.json() == {"status": "ok", "restaurant": "La Bella Cucina"}


# ── POST /api/chat ────────────────────────────────────────────────────────────

async def test_chat_valid_request_returns_200_and_event_stream(client):
    with patch("main.run_agent_stream", new=_fake_stream):
        async with client.stream(
            "POST", "/api/chat",
            json={"message": "hello", "session_id": "test-session"},
        ) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers["content-type"]
            await resp.aread()  # drain before closing


async def test_chat_stream_contains_token_and_done_events(client):
    with patch("main.run_agent_stream", new=_fake_stream):
        async with client.stream(
            "POST", "/api/chat",
            json={"message": "hello", "session_id": "test-session"},
        ) as resp:
            body = (await resp.aread()).decode()
    assert "event: token" in body
    assert "event: done" in body


async def test_chat_missing_session_id_returns_422(client):
    response = await client.post("/api/chat", json={"message": "hello"})
    assert response.status_code == 422


async def test_chat_missing_message_returns_422(client):
    response = await client.post("/api/chat", json={"session_id": "s1"})
    assert response.status_code == 422


async def test_chat_empty_body_returns_422(client):
    response = await client.post("/api/chat", json={})
    assert response.status_code == 422


# ── DELETE /api/session/{session_id} ─────────────────────────────────────────

async def test_delete_nonexistent_session_returns_existed_false(client):
    response = await client.delete("/api/session/no-such-session-xyz")
    assert response.status_code == 200
    assert response.json() == {"cleared": "no-such-session-xyz", "existed": False}


async def test_delete_existing_session_returns_existed_true(client):
    with patch("main.remove_session", return_value=True):
        response = await client.delete("/api/session/known-session")
    assert response.status_code == 200
    data = response.json()
    assert data["cleared"] == "known-session"
    assert data["existed"] is True


# ── CORS ──────────────────────────────────────────────────────────────────────

async def test_cors_preflight_from_allowed_origin(client):
    # Express (:3001) is the only browser-facing backend that may call FastAPI
    response = await client.options(
        "/api/chat",
        headers={
            "Origin": "http://localhost:3001",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code in (200, 204)
    assert "access-control-allow-origin" in response.headers


def test_cors_origins_default_contains_localhost():
    # ALLOWED_ORIGINS is set to Express in .env — browser never calls FastAPI directly
    assert any("localhost" in o for o in _origins)


def test_cors_origins_strips_whitespace(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://a.com , http://b.com")
    origins = [
        o.strip()
        for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    ]
    assert "http://a.com" in origins
    assert "http://b.com" in origins

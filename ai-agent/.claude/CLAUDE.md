# AI Agent — .claude/CLAUDE.md

Authoritative guidance for this service is in two files:

- **`ai-agent/CLAUDE.md`** — tech stack, architecture, tools, and coding rules for the FastAPI microservice
- **`.claude/CLAUDE.md`** (project root) — shared standards, safety rules, and boundaries for the entire ordering system

## Commands

```bash
# Run from ai-agent/backend/
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/
```

Express (`:3001`) must be running before starting FastAPI — `data.py` and tool files call it at startup and per request. Requires `DEEPSEEK_API_KEY` and `ORDERING_API_URL=http://localhost:3001` in `ai-agent/backend/.env`.

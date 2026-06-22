# AI Agent (OrderUp Assistant) — Backend only

> **Frontend note:** The chat UI that was in `ai-agent/frontend/` has been migrated into `client/src/`. This directory now contains only the FastAPI backend. See `docs/plan-migrate-chat-frontend.md` for the migration plan.

## Tech stack
- **Agent framework:** LangChain `create_agent` — handles tool calling and message processing
- **Conversation memory:** LangGraph `MemorySaver` — per-session history keyed by `thread_id`; used only for checkpointing, not as the agent runtime
- **LLM:** DeepSeek `deepseek-chat` via OpenAI-compatible API (`langchain_openai.ChatOpenAI`)
- **Streaming:** LangChain `astream_events()` with `version="v2"` — emits tokens as SSE

## Architecture

Express is the single browser-facing backend. FastAPI is an internal microservice — the browser never calls it directly.

```
Browser (:5173)
  └── /api/* ──► Express (:3001)
                    ├── existing routes (menu, orders, auth, notifications, logs, reservations)
                    └── /api/ai/* ──► FastAPI (:8000)  [http-proxy-middleware]
                                          ├── GET  http://localhost:3001/api/menu
                                          ├── POST http://localhost:3001/api/orders
                                          └── POST http://localhost:3001/api/reservations
```

## AI tools

| Tool | What it does | Data source | Auth required |
|------|-------------|-------------|--------------|
| `menu_tool` | Browse all menu items, optionally filter by category | `GET /api/menu` via httpx | No |
| `specials_tool` | Show items where `isSpecial: true` | `GET /api/menu` via httpx | No |
| `order_status_tool` | Look up live status of an order by ID | `GET /api/orders/:id` via httpx | Yes — Firebase token |
| `reserve_table_tool` | Book a table in one step: tries the requested time, auto-selects the nearest available slot (±30/60/90/120 min) if unavailable, returns 409 message if no slot found on that date | `POST /api/reservations` via httpx | No — Express writes to Firestore via Admin SDK |
| `calculator_tool` | Safe math evaluation | `asteval` library (no `eval()`) | No |

Opening hours and location are answered from the system prompt — no tool call needed.

Placing orders via chat is **out of scope** — customers order through the standard cart → checkout flow.

## Coding rules

- Tool description strings are read by the LLM — write them for the model, not developers
- All `StructuredTool` fields must have `Field(description=...)` — the agent uses these to extract parameters
- Shared data helpers belong in `backend/src/data.py` — do not duplicate fetch logic in tool files
- Do not add synchronous blocking I/O in async FastAPI route handlers
- Do not add `session_id` or `firebase_token` as LLM-facing tool parameters — inject via ContextVar server-side
- The LangChain agent is a singleton (`_agent` in `agent.py`) — do not create per-request instances
- Do not access `_checkpointer.storage` or `_checkpointer.writes` directly — internal LangGraph attributes; use only public APIs
- One tool per file under `backend/tools/` — do not bundle multiple tools in one file

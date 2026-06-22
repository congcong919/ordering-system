# Technical Design — La Bella Cucina AI Assistant

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│           Browser (port 5173)           │
│                                         │
│  App.tsx                                │
│   ├── useChat.ts  (all state)           │
│   ├── ChatWindow / MessageBubble        │
│   ├── InputBar                          │
│   └── QuickActions                      │
│                                         │
│  api/chat.ts                            │
│   ├── streamChat()  →  POST /api/chat   │
│   └── clearSession() → DELETE /api/...  │
└────────────────┬────────────────────────┘
                 │ SSE token stream
                 │ HTTP (proxied by Vite in dev)
┌────────────────▼────────────────────────┐
│        FastAPI Backend (port 8000)      │
│                                         │
│  main.py                                │
│   ├── POST /api/chat                    │
│   │    └── asyncio.Queue               │
│   │         ├── run_agent_stream()      │
│   │         └── event_generator() SSE  │
│   ├── GET  /api/health                  │
│   └── DELETE /api/session/{id}          │
│                                         │
│  src/agent.py                           │
│   ├── _agent  (singleton)               │
│   └── _checkpointer (MemorySaver)       │
│                                         │
│  tools/                                 │
│   ├── menu_tool       ──┐               │
│   ├── specials_tool   ──┤ reads         │
│   ├── booking_tool    ──┤ reads/writes  │──► data/*.json
│   ├── order_tool      ──┤ reads/writes  │
│   ├── calculator_tool ──┘               │
│   └── file_read_tool  ──► any path ⚠   │
└────────────────┬────────────────────────┘
                 │ HTTPS (OpenAI-compatible)
┌────────────────▼────────────────────────┐
│         DeepSeek API                    │
│         model: deepseek-chat            │
└─────────────────────────────────────────┘
```

---

## Module Responsibilities

### `backend/main.py`
Entry point. Registers FastAPI middleware (CORS), defines the three HTTP routes, and owns the SSE event loop. No business logic — delegates everything to `src/agent.py`.

### `backend/src/agent.py`
Owns the LangGraph agent lifecycle:
- `_get_agent()` — lazy singleton creation. Loads system prompt, initialises `ChatOpenAI` (DeepSeek), and creates the agent with `create_agent()` and the shared `MemorySaver` checkpointer.
- `run_agent_stream()` — runs the agent for one turn, pushes response tokens onto an `asyncio.Queue`, puts `None` as a sentinel when done.
- `remove_session()` — clears checkpoint data for a `thread_id`. Currently uses internal LangGraph attributes (known debt — see `docs/known-issues.md`).

### `backend/src/prompts.py`
Single function `load_prompt(name)` that reads `backend/prompts/{name}.md` and returns its contents. Used by `_get_agent()` to load `restaurant.md`.

### `backend/src/data.py` _(planned — does not exist yet)_
The intended home for all shared data-access helpers: `load_menu()`, `load_reservations()`, `save_reservations()`, `load_orders()`, `save_orders()`, and the canonical `DATA_DIR` path constant. Per the coding standards in `.claude/CLAUDE.md`, shared data helpers must live here and must not be duplicated across tool files. Currently these functions are defined privately inside individual tool files (known issue C1 — see `docs/known-issues.md`). Creation of this module is tracked in `tasks/TASK-011-extract-data-helpers.md`.

### `backend/prompts/restaurant.md`
Bella's system prompt. Defines personality, restaurant details, opening hours, and agent behaviour rules. Contains the `{current_date}` placeholder injected at agent creation. Editable without code changes; requires backend restart to apply.

### `backend/tools/`
Each file contains one tool (or one tool + its private helpers). Tools are plain Python functions — they can be tested without the agent or LLM.

| File | Tool name | Type | Reads | Writes |
|---|---|---|---|---|
| `menu_tool.py` | `menu_tool` | `@tool` | `menu.json` | — |
| `specials_tool.py` | `specials_tool` | `@tool` | `menu.json` | — |
| `booking_tool.py` | `booking_tool` | `StructuredTool` | `reservations.json` | `reservations.json` |
| `order_tool.py` | `order_tool` | `StructuredTool` | `menu.json`, `orders.json` | `orders.json` |
| `calculator_tool.py` | `calculator_tool` | `@tool` | — | — |
| `file_tool.py` | `file_read_tool` | `@tool` | any path ⚠ | — |

### `backend/tools/__init__.py`
Assembles `all_tools = [...]` consumed by `_get_agent()`. The order does not affect agent behaviour.

### `backend/data/`
Three JSON files. `menu.json` is static (edited by hand to update content). `reservations.json` and `orders.json` are runtime data files written by tools. See Data Models below.

### `frontend/src/hooks/useChat.ts`
Single source of truth for all frontend state: `messages`, `isStreaming`, `sessionId`, `error`. Exposes `sendMessage`, `stopStreaming`, `newChat`. All components are stateless relative to this hook.

### `frontend/src/api/chat.ts`
Two functions:
- `streamChat(message, sessionId, signal)` — async generator that POSTs to `/api/chat` and yields text tokens parsed from the SSE byte stream.
- `clearSession(sessionId)` — fires `DELETE /api/session/{id}`.

### `frontend/src/components/`
Presentational only. Receive props from `App.tsx`/`useChat.ts` and render UI. No direct API calls.

---

## Data Flow

### Chat request (happy path)

```
1. User submits message in InputBar
2. useChat.sendMessage(text)
   - Appends user message to messages[]
   - Appends empty assistant message (streaming: true)
   - Sets isStreaming = true
   - Creates AbortController
3. streamChat(text, sessionId, signal) → POST /api/chat
4. FastAPI receives {message, session_id}
   - Creates asyncio.Queue
   - Spawns run_agent_stream(message, session_id, queue) as asyncio task
   - Returns EventSourceResponse backed by event_generator()
5. run_agent_stream()
   - Calls agent.astream_events({messages: [("human", message)]}, config={thread_id: session_id})
   - LangGraph agent reasons about the request
   - If a tool is needed: agent emits tool-call chunk → tool executes → result fed back
   - Final answer tokens arrive as on_chat_model_stream events (not tool_call_chunks)
   - Each token → queue.put(token)
   - queue.put(None) when done
6. event_generator() drains queue
   - Each token → SSE frame: event: token / data: {"text": "..."}
   - None sentinel → SSE frame: event: done / data: (empty)
7. streamChat() parses SSE frames, yields token strings
8. useChat appends each token to the assistant message content
9. MessageBubble re-renders incrementally
10. On done/abort: isStreaming = false, streaming flag cleared on message
```

### New Chat

```
1. User clicks "New Chat"
2. useChat.newChat()
   - Aborts any in-flight request
   - Calls clearSession(sessionId) → DELETE /api/session/{sessionId}
3. FastAPI remove_session(sessionId) → clears _checkpointer data for thread_id
4. useChat resets messages=[], generates new sessionId, clears error
```

### Tool execution (booking example)

```
Agent decides to call booking_tool with extracted parameters:
  {name: "Alice", date: "2026-06-20", time: "19:00", party_size: 2}

booking_tool._make_reservation():
  1. Validates party_size (1–8)
  2. Acquires threading.Lock
  3. Loads reservations.json
  4. Finds all tables already booked for date+time
  5. Finds smallest available table with capacity >= party_size
  6. If none available → returns error string to agent
  7. If available → appends new reservation record, saves file, releases lock
  8. Returns confirmation string with reference ID

Agent incorporates tool result into final response to user.
```

---

## API Flow

See `docs/api-contract.md` for full request/response schemas. Summary:

```
POST   /api/chat          → SSE stream of tokens
GET    /api/health        → {"status": "ok", ...}
DELETE /api/session/{id}  → {"cleared": id, "existed": bool}
```

---

## Data Models

### `menu.json`

```json
{
  "categories": ["Starters", "Mains", "Desserts", "Drinks"],
  "items": [
    {
      "id": "M001",
      "name": "string",
      "category": "Starters | Mains | Desserts | Drinks",
      "price": 0.00,
      "description": "string",
      "allergens": ["gluten", "dairy", "eggs", "fish", "shellfish", "nuts", "sulphites"],
      "available": true,
      "is_special": false
    }
  ]
}
```

`menu.json` is edited by hand to update content. No restart required — loaded fresh per tool call.

### `reservations.json`

```json
{
  "tables": [
    { "number": 1, "capacity": 2 }
  ],
  "reservations": [
    {
      "id": "RXXXXXX",
      "name": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "party_size": 0,
      "table_number": 0,
      "status": "confirmed",
      "notes": "string"
    }
  ]
}
```

`tables` is static configuration. `reservations` is appended to at runtime. No deletion or archiving.

### `orders.json`

```json
{
  "orders": [
    {
      "id": "ORD-XXXXXXXX",
      "session_id": "string (UUID)",
      "items": [
        { "id": "M001", "name": "string", "price": 0.00 }
      ],
      "total": 0.00,
      "status": "received",
      "timestamp": "ISO-8601 UTC"
    }
  ]
}
```

`orders` is appended to at runtime. `session_id` is stored but there is currently no tool to query orders by session — it is recorded for potential future use.

---

## External Services

### DeepSeek API
- **Purpose:** LLM inference for the agent
- **Protocol:** OpenAI-compatible REST API
- **Base URL:** `https://api.deepseek.com`
- **Model:** `deepseek-chat`
- **Auth:** Bearer token (`DEEPSEEK_API_KEY` from `backend/.env`)
- **Client:** `langchain_openai.ChatOpenAI` with `openai_api_base` override
- **Streaming:** Enabled (`streaming=True`); consumed via LangGraph `astream_events`

No other external services are used. No email, SMS, payment, or third-party APIs.

---

## Session and Memory Model

Each browser session generates a `crypto.randomUUID()` client-side. This UUID is sent as `session_id` with every chat request. The backend uses it as a LangGraph `thread_id`:

```python
config = {"configurable": {"thread_id": session_id}}
agent.astream_events(..., config=config)
```

`MemorySaver` stores the full message history per `thread_id` in-process. Multiple threads share one `_agent` instance and one `_checkpointer`.

**Limitations:**
- Memory is lost on backend restart.
- Session ID is React state — lost on page refresh (the old server-side session is orphaned).
- `remove_session()` uses internal `MemorySaver` attributes (`_checkpointer.storage`, `_checkpointer.writes`) — not public API.

---

## Concurrency Model

FastAPI runs in a single async event loop (uvicorn default: one worker). The `asyncio.Queue` pattern in `main.py` connects the async SSE generator to the LangGraph stream correctly.

Tool file I/O is synchronous (`Path.read_text` / `Path.write_text`). This blocks the event loop during file operations. For write-heavy tools (`booking_tool`, `order_tool`), a module-level `threading.Lock` prevents concurrent writes from corrupting JSON — but the lock is threading-level, not async-level.

**Known limitation:** Two simultaneous booking requests can both enter `_make_reservation()` concurrently as coroutines before either acquires the lock. The lock only prevents the actual file write from interleaving — not the availability check from seeing stale data. This is acceptable at very low concurrency but is not safe under load. See `docs/known-issues.md`.

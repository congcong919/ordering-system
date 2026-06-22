# Migration Plan: AI Agent Standalone → Integrated Project

## Goal
Fully integrate the standalone `ai-agent/` sub-project into the main ordering system. After migration:
- One frontend only (`client/`) — chat UI embedded as a floating panel
- Backend tools call Express/Firestore — no more local JSON files
- `ai-agent/frontend/` deleted
- `ai-agent/backend/data/*.json` files deleted or archived

---

## Scope overview

| Area | Status | Phases |
|---|---|---|
| Chat UI — move from `ai-agent/frontend/` to `client/` | **Done** | 1–3 |
| Backend tools — connect to Express + Firebase instead of JSON files | **Done** | 4–6 |
| Cleanup — delete obsolete files | **Done** | 7 |
| Docs — update outdated CLAUDE.md files | **Done** | 8 |

---

## Current state

| | ai-agent standalone | target (integrated) |
|---|---|---|
| Frontend | `ai-agent/frontend/` — standalone Vite app | Removed; chat panel lives in `client/src/` |
| Data storage | Local JSON files (`menu.json`, `reservations.json`, `orders.json`) | Firebase Firestore via Express |
| Auth | None — anonymous session_id only | Anonymous session_id for chat; Firebase Admin SDK for Firestore writes |
| API target | Frontend → FastAPI :8000 directly | Frontend → Express :3001 → FastAPI :8000 |
| Booking | `booking_tool.py` — single tool, reads/writes `reservations.json` | Two tools: `check_availability_tool.py` + `make_reservation_tool.py`, both call Express |
| Menu data | `data.py` reads local `menu.json` | `data.py` calls `GET /api/menu` on Express via httpx |

---

## Critical API URL change

All chat API calls change prefix when moved to the client:

| ai-agent/frontend (current) | client (target) |
|---|---|
| `POST /api/chat` | `POST /api/ai/chat` |
| `DELETE /api/session/:id` | `DELETE /api/ai/session/:id` |

Client proxies to Express; Express proxies `/api/ai/*` to FastAPI. Browser never calls FastAPI directly.

---

## Phase 1 — Chat types, service, and hook

### 1.1 `client/src/types/index.ts`
Verify `ChatMessage` already matches ai-agent's `Message` type:
```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}
```

### 1.2 `client/src/services/chatApi.ts` (new)
Adapt from `ai-agent/frontend/src/api/chat.ts`:
- `/api/chat` → `/api/ai/chat`
- `/api/session/:id` → `/api/ai/session/:id`
- Export: `streamChat(message, sessionId)` and `clearChatSession(sessionId)`
- Use `ChatMessage` from `../types`

### 1.3 `client/src/hooks/useChat.ts` (new)
Adapt from `ai-agent/frontend/src/hooks/useChat.ts`:
- Import `ChatMessage` from `../types`
- Import from `../services/chatApi`
- Logic is identical — message list, streaming, session UUID, abort controller

---

## Phase 2 — Chat UI components

Five components copied from `ai-agent/frontend/src/components/`, custom CSS rewritten as Tailwind.

| Source | Destination | Change |
|---|---|---|
| `ChatWindow.tsx` | `client/src/components/ChatPanel.tsx` | Rename + CSS → Tailwind |
| `MessageBubble.tsx` | `client/src/components/MessageBubble.tsx` | CSS → Tailwind |
| `InputBar.tsx` | `client/src/components/InputBar.tsx` | CSS → Tailwind |
| `QuickActions.tsx` | `client/src/components/QuickActions.tsx` | CSS → Tailwind; update prompts |
| `TypingIndicator.tsx` | `client/src/components/TypingIndicator.tsx` | CSS → Tailwind (`animate-bounce` + stagger) |

**Tailwind colour mapping:**
| Old CSS value | Tailwind replacement |
|---|---|
| `#1a1a2e` (dark header) | `bg-stone-900` |
| `#c8302a` (red accent) | `bg-orange-500` (matches client brand) |
| `#faf9f7` (cream bg) | `bg-white` / `bg-stone-50` |
| `#fff` (assistant bubble) | `bg-stone-100` |

**QuickActions prompts — update to reflect actual AI tools:**
| Old label | New label | Tool |
|---|---|---|
| Today's Specials | Today's Specials | `specials_tool` |
| View Menu | View Menu | `menu_tool` |
| Book a Table | Book a Table | `check_availability_tool` |
| Place Order | Check My Order | `order_status_tool` |
| Opening Hours | Opening Hours | system prompt |

---

## Phase 3 — Wire up ChatbotButton

**`client/src/components/ChatbotButton.tsx`** — rewrite:
- Floating button opens/closes chat panel overlay (slide-in from bottom-right)
- Panel contains `ChatPanel` + `InputBar` + `QuickActions` (shown only when no messages)
- State from `useChat` hook
- "New Chat" button calls `newChat()`; close button hides panel without clearing session

No new route needed.

---

## Phase 4 — Split booking_tool into two tools

Current: `ai-agent/backend/tools/booking_tool.py` — one tool that reads/writes `reservations.json`.

Target: two tools that call Express via httpx.

### 4.1 `ai-agent/backend/tools/check_availability_tool.py` (new)
- Calls `GET /api/reservations/availability?date=&time=&partySize=` on Express
- If unavailable, probes nearby slots (same day ±1 h, ±2 h; next day at same time) by making up to 3 additional GET calls
- Returns confirmation string or a list of up to 3 available alternatives
- No auth header — endpoint is public
- Input schema: `date` (YYYY-MM-DD), `time` (HH:MM), `party_size` (int 1–8)

### 4.2 `ai-agent/backend/tools/make_reservation_tool.py` (new)
- Calls `POST /api/reservations` on Express
- No auth header — Express writes via Admin SDK
- Input schema: `name`, `date`, `time`, `party_size`, `notes`
- Handles 409 (no tables — race condition), 500, and network errors
- Returns confirmation string with booking reference and table details

### 4.3 `ai-agent/backend/tools/__init__.py` (update)
Remove `booking_tool` import; add `check_availability_tool` and `make_reservation_tool`:
```python
from .check_availability_tool import check_availability_tool
from .make_reservation_tool import make_reservation_tool
# remove: from .booking_tool import booking_tool
```

### 4.4 `ai-agent/backend/tools/booking_tool.py` (delete)
Delete once both new tool files are working and tested.

---

## Phase 5 — Update data.py to call Express for menu

Current: `ai-agent/backend/src/data.py` reads `menu.json` from the local `data/` directory.

Target: calls `GET /api/menu` on Express via httpx, normalises camelCase → snake_case.

```python
# Before
def load_menu() -> dict:
    return json.loads((DATA_DIR / "menu.json").read_text(encoding="utf-8"))

# After
import httpx, os

def load_menu() -> dict:
    url = os.environ.get("ORDERING_API_URL", "http://localhost:3001")
    resp = httpx.get(f"{url}/api/menu", timeout=5.0)
    resp.raise_for_status()
    items = resp.json()
    # normalise camelCase fields to snake_case for tool compatibility
    for item in items:
        if "isSpecial" in item:
            item["is_special"] = item.pop("isSpecial")
        if "imageUrl" in item:
            item["image_url"] = item.pop("imageUrl")
    return {"items": items}
```

`menu_tool.py` and `specials_tool.py` are unchanged — they call `load_menu()` which now hits Express.

---

## Phase 6 — Rewrite tests for new tools

### 6.1 `ai-agent/backend/tests/test_booking_tool.py` (rewrite)
Current tests patch `_DATA_DIR` and test JSON file logic — incompatible with httpx-based implementation.

New test approach: mock `httpx.Client` to simulate Express responses.

Tests to cover:
- Happy path → 201 from Express → confirmation string returned
- No availability → 409 from Express → "no tables available" message
- No tables for suggestions → probed slots also unavailable → "no slots found" message
- Invalid date format → validation error (no HTTP call made)
- Invalid time format → validation error (no HTTP call made)
- Party size out of range (0, 9) → validation error
- Express unreachable → `httpx.RequestError` → "service unavailable" message
- Conflict assignment table message contains table number from response

### 6.2 `ai-agent/backend/tests/test_check_availability_tool.py` (new)
- Available slot → returns confirmation with table details
- Unavailable + suggestions found → returns alternatives list
- Unavailable + no suggestions → returns "no slots available" message
- Invalid date/time/party_size → validation errors

### 6.3 `ai-agent/backend/tests/conftest.py` (update)
Remove `_RESERVATIONS_DATA` fixture — no longer needed now that tools use httpx, not JSON files.
Keep `_MENU_DATA` until Phase 5 is done; remove after `data.py` calls Express.

---

## Phase 7 — Delete obsolete files

Once all tools use Express and tests pass:

```
ai-agent/frontend/                         ← delete entire directory
ai-agent/backend/data/reservations.json    ← delete (Firestore is now source of truth)
ai-agent/backend/data/orders.json         ← delete (order_tool.py is out of scope; file unused)
ai-agent/backend/tools/booking_tool.py    ← delete (replaced by two new tool files)
```

Keep `ai-agent/backend/data/menu.json` until Phase 5 is complete and tested; delete after.

---

## Phase 8 — Update docs

### 8.1 `ai-agent/.claude/CLAUDE.md`
This file still describes the original standalone project (JSON files, no auth, no Firebase). Replace its content to reflect the integrated architecture. Point to `ai-agent/CLAUDE.md` as the authoritative reference.

### 8.2 `.claude/CLAUDE.md` project structure block
Remove `ai-agent/frontend/` line.

### 8.3 `ai-agent/CLAUDE.md`
Already up to date — no change needed.

---

## Files summary

### New files
```
client/src/services/chatApi.ts
client/src/hooks/useChat.ts
client/src/components/ChatPanel.tsx
client/src/components/MessageBubble.tsx
client/src/components/InputBar.tsx
client/src/components/QuickActions.tsx
client/src/components/TypingIndicator.tsx
ai-agent/backend/tools/check_availability_tool.py
ai-agent/backend/tools/make_reservation_tool.py
ai-agent/backend/tests/test_check_availability_tool.py
```

### Modified files
```
client/src/types/index.ts                          (verify ChatMessage — likely no change)
client/src/components/ChatbotButton.tsx            (rewrite to use useChat + ChatPanel)
ai-agent/backend/tools/__init__.py                 (swap booking_tool for two new tools)
ai-agent/backend/src/data.py                       (load_menu → httpx call to Express)
ai-agent/backend/tests/test_booking_tool.py        (rewrite for httpx-based tools)
ai-agent/backend/tests/conftest.py                 (remove reservations fixture)
ai-agent/.claude/CLAUDE.md                         (replace outdated standalone content)
```

### Deleted files
```
ai-agent/frontend/                          (entire directory)
ai-agent/backend/data/reservations.json
ai-agent/backend/data/orders.json
ai-agent/backend/data/menu.json             (after Phase 5)
ai-agent/backend/tools/booking_tool.py
```

### No changes
```
client/vite.config.ts
client/package.json
server/
ai-agent/backend/main.py
ai-agent/backend/src/agent.py
ai-agent/backend/prompts/restaurant.md
```

---

## Risks and gotchas

| Risk | Mitigation |
|---|---|
| URL prefix `/api/chat` → `/api/ai/chat` easy to miss | Double-check both endpoints in `chatApi.ts` before running |
| TypeScript strict mode — ai-agent used relaxed settings | Run `npx tsc --noEmit` after each component addition |
| `data.py` camelCase → snake_case normalisation | Verify `is_special` field rename before deleting `menu.json` |
| `check_availability_tool` probes nearby slots — multiple httpx calls | Cap at 3 probes; fail gracefully if Express is slow |
| `conftest.py` `data_dir` fixture still used by other tests | Only remove `_RESERVATIONS_DATA`; keep fixture for menu/order tests |
| CSS animation for `TypingIndicator` bouncing dots | Use `animate-bounce` with Tailwind `delay-100`, `delay-200` on each dot |
| `ORDERING_API_URL` env var must be set in `ai-agent/backend/.env` | Already documented in project env vars; confirm it's set before testing |

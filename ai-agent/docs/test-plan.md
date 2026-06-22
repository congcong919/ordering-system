# Test Plan — La Bella Cucina AI Assistant

---

## Current State

The backend has 3 tests covering only `calculator_tool`. There are no frontend tests. No test framework is installed for the frontend. This plan defines the full testing strategy the project should reach.

---

## How to Run Tests

```bash
# All backend tests
cd backend
pytest tests/

# Verbose output
pytest tests/ -v

# Single test
pytest tests/test_tools.py::test_calculator_basic

# Filter by name keyword
pytest tests/ -k "booking"

# Short tracebacks
pytest tests/ --tb=short
```

---

## Unit Test Strategy

Unit tests target individual tool functions as plain Python callables. They do not make LLM calls, do not run the FastAPI app, and do not require the DeepSeek API key.

### Fixture pattern for file-writing tools

Tools that write to JSON files (`booking_tool`, `order_tool`) use a module-level `_DATA_DIR` path. Tests must redirect this to a `tmp_path` fixture so they do not touch `backend/data/`:

```python
import pytest
from pathlib import Path
from unittest.mock import patch

@pytest.fixture
def data_dir(tmp_path):
    # Copy a minimal fixture JSON to tmp_path, return the path
    (tmp_path / "reservations.json").write_text('{"tables": [...], "reservations": []}')
    return tmp_path

def test_something(data_dir):
    with patch("tools.booking_tool._DATA_DIR", data_dir):
        result = booking_tool.invoke(...)
```

---

### `calculator_tool` — `tests/test_tools.py`

| Test | Input | Expected |
|---|---|---|
| ✅ Basic arithmetic | `"2 + 2"` | `"4"` |
| ✅ Math function | `"sqrt(16)"` | `"4.0"` |
| ✅ Invalid expression | `"import os"` | contains `"Error"` |
| ☐ Division by zero | `"1 / 0"` | contains `"Error"`, no exception raised |
| ☐ Nested math | `"sin(pi / 2)"` | `"1.0"` |
| ☐ Attribute escape attempt | `"().__class__.__bases__[0].__subclasses__()"` | contains `"Error"`, no code executed |

---

### `menu_tool` — `tests/test_menu_tool.py`

| Test | Scenario | Expected |
|---|---|---|
| ☐ No category | `menu_tool.invoke("")` | All available items returned, grouped by category |
| ☐ Valid category (exact case) | `"Mains"` | Only Main items returned |
| ☐ Valid category (lowercase) | `"mains"` | Same result as exact case (case-insensitive) |
| ☐ Invalid category | `"Soups"` | Error string listing valid categories |
| ☐ Unavailable item excluded | Set `available: false` on one item | That item does not appear in output |
| ☐ Allergens present | Item with allergens | Allergen string included in output line |
| ☐ No items available | All `available: false` | Returns "No menu items are currently available" |

---

### `specials_tool` — `tests/test_specials_tool.py`

| Test | Scenario | Expected |
|---|---|---|
| ☐ Specials exist | At least one `is_special: true` item | Those items appear in output |
| ☐ No specials | All `is_special: false` | Returns fallback message |
| ☐ Special with allergens | Special item has allergens | Allergen string appears in output |
| ☐ Unavailable special excluded | `is_special: true` + `available: false` | Not shown in specials |

---

### `booking_tool` — `tests/test_booking_tool.py`

Use `tmp_path` + `patch("tools.booking_tool._DATA_DIR", ...)` for all tests.

| Test | Scenario | Expected |
|---|---|---|
| ☐ Valid booking | Available table, valid inputs | Returns confirmation string with reference ID |
| ☐ Reference ID format | Any successful booking | ID matches `R[A-Z0-9]{6}` |
| ☐ Table selection — smallest fit | Party of 3, 2-tops and 4-tops available | 4-top selected, not 2-top |
| ☐ No tables available | All tables booked for that slot | Returns "no tables available" message |
| ☐ Party size too small | `party_size = 0` | Returns party size error string |
| ☐ Party size too large | `party_size = 9` | Returns party size error string |
| ☐ Booking written to file | Successful booking | Reservation appears in `reservations.json` after call |
| ☐ Conflict detection | Book same slot twice for same table | Second booking gets a different table or fails if none available |
| ☐ Concurrent bookings | Two threads book same last table simultaneously | Only one succeeds; file is not corrupted |

---

### `order_tool` — `tests/test_order_tool.py`

Use `tmp_path` + `patch` for `_DATA_DIR`.

| Test | Scenario | Expected |
|---|---|---|
| ☐ Valid order | All items found and available | Returns confirmation with reference ID and correct total |
| ☐ Reference ID format | Any successful order | ID matches `ORD-[A-Z0-9]{8}` |
| ☐ Case-insensitive item match | `"tiramisù della casa"` (lowercase) | Matches `"Tiramisù della Casa"` in menu |
| ☐ Partial order — some not found | Mix of valid and invalid item names | Valid items confirmed; not-found items listed separately |
| ☐ All items not found | No names match menu | Returns "not found" message; nothing written to `orders.json` |
| ☐ Unavailable item | Item exists but `available: false` | Reported as unavailable; not included in order |
| ☐ Order written to file | Successful order | Order appears in `orders.json` with correct structure |
| ☐ Total is correct | Three items ordered | Total matches sum of individual prices |

---

### `file_read_tool` — `tests/test_file_tool.py`

| Test | Scenario | Expected |
|---|---|---|
| ☐ Valid file | Path to an existing readable file | Returns file contents |
| ☐ File not found | Non-existent path | Returns `"File not found: ..."` string, no exception |
| ☐ Path traversal — relative | `"../../backend/.env"` | **Should be blocked** — currently fails (reads the file) |
| ☐ Path traversal — absolute | `/etc/passwd` or `C:\Windows\System32\...` | **Should be blocked** — currently fails |

These two "should be blocked" tests are expected to **fail** against the current code. They document the security gap and will pass once `file_read_tool` is fixed or removed.

---

## Integration Test Strategy

Integration tests run the FastAPI app in-process using `httpx.AsyncClient`. They mock `run_agent_stream` to avoid real LLM calls.

### Setup

```bash
pip install httpx pytest-asyncio
```

### `tests/test_api.py`

| Test | Endpoint | Scenario | Expected |
|---|---|---|---|
| ☐ Health check | `GET /api/health` | Normal | `200`, body `{"status": "ok", ...}` |
| ☐ Chat — valid request | `POST /api/chat` | Mocked agent pushes two tokens then None | SSE stream contains two `token` events, one `done` event |
| ☐ Chat — missing session_id | `POST /api/chat` | Body has only `message` | `422` |
| ☐ Chat — missing message | `POST /api/chat` | Body has only `session_id` | `422` |
| ☐ Chat — empty body | `POST /api/chat` | `{}` | `422` |
| ☐ Delete existing session | `DELETE /api/session/{id}` | Session was used | `200`, `"existed": true` |
| ☐ Delete non-existent session | `DELETE /api/session/{id}` | Session was never created | `200`, `"existed": false` |

---

## Frontend Tests (TBD — framework not yet installed)

**Recommended stack:**
- `vitest` — test runner compatible with Vite config
- `@testing-library/react` — component behaviour
- `@testing-library/user-event` — simulates keyboard and mouse
- `msw` — intercepts `fetch` calls to mock `/api/chat` SSE and `/api/session/{id}`

**Install:**
```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/user-event jsdom msw
```

### `useChat` hook

| Test | Scenario | Expected |
|---|---|---|
| ☐ sendMessage | User sends a message | User message appended, assistant message created with `streaming: true` |
| ☐ Token streaming | MSW sends three tokens then done | Assistant message content = concatenated tokens |
| ☐ isStreaming lifecycle | During stream, after done | `true` during, `false` after |
| ☐ stopStreaming | Abort mid-stream | `isStreaming` becomes `false`, no further tokens appended |
| ☐ newChat | User clicks New Chat | `DELETE` called, messages cleared, new `sessionId` generated |
| ☐ Error handling | MSW returns 500 | `error` state set, assistant message shows error text |

### `MessageBubble` component

| Test | Scenario | Expected |
|---|---|---|
| ☐ User bubble | `role: "user"` | Has class `bubble-user` |
| ☐ Assistant bubble | `role: "assistant"` | Has class `bubble-assistant` |
| ☐ Typing indicator | `streaming: true`, empty content | `TypingIndicator` rendered |
| ☐ Bold rendering | `**bold**` in content | Rendered as `<strong>` (or as markdown once XSS fix applied) |

### `InputBar` component

| Test | Scenario | Expected |
|---|---|---|
| ☐ Enter submits | User types and presses Enter | `onSend` called with trimmed text |
| ☐ Shift+Enter does not submit | Shift+Enter pressed | `onSend` not called |
| ☐ Empty input | Send button clicked with empty textarea | `onSend` not called, button disabled |
| ☐ Stop button | `isStreaming = true` | Stop button shown, send button hidden |

---

## Manual Testing Checklist

Run through this checklist after any significant change to tools, the agent, or the frontend.

### Menu & Specials
- [ ] Ask "show me the menu" — full menu appears grouped by category
- [ ] Ask "what starters do you have?" — only Starters shown
- [ ] Ask "what are the specials today?" — only `is_special: true` items shown
- [ ] Ask "does the tiramisù contain dairy?" — allergens listed, staff confirmation advised

### Reservations
- [ ] Say "I'd like to book a table" — agent collects name, date, time, party size in sequence
- [ ] Complete booking — confirmation with reference ID returned
- [ ] Try to book a table for 9 people — error message returned
- [ ] Book all tables for a slot, then try to book one more — "no tables available" message

### Orders
- [ ] Say "I'd like to order the Tiramisù della Casa and an Espresso" — order confirmed with total
- [ ] Try to order a dish not on the menu — item flagged as not found
- [ ] Order with a typo in the dish name (e.g., "Tiramisu") — TBD (currently case-insensitive exact match required)

### Conversation
- [ ] Ask two related questions — agent retains context from first answer in second
- [ ] Click "New Chat" — messages cleared, previous context not retained in new session
- [ ] Start a long response, click stop — stream stops, partial response retained in UI
- [ ] Refresh the page — new session starts (session ID changes)

### Error states
- [ ] Stop the backend while a response is streaming — error message shown in UI
- [ ] Submit empty message — send button should be disabled, nothing sent

---

## Edge Cases

| Area | Edge case | Current behaviour |
|---|---|---|
| Booking | Past date requested | Tool accepts it — no date validation |
| Booking | Time outside opening hours | Tool accepts it — only advised in prompt |
| Booking | Non-standard date format (e.g., "June 20") | Tool stores the raw string — may corrupt data |
| Order | Dish name with accented character | Case-insensitive lowercase match — should work if exact name used |
| Order | Same dish ordered twice | Both instances included, total doubled |
| Menu | No items available at all | Returns "No menu items are currently available" |
| Specials | No specials set | Returns fallback message |
| Session | Very long conversation | Memory grows unboundedly in `MemorySaver` — no truncation |
| Streaming | SSE connection dropped mid-stream | Task is cancelled, queue is abandoned — no reconnect logic |
| Calculator | Very large number | Returns result string — no overflow protection |
| Calculator | Empty expression | Returns error string |

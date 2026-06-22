# Development Workflow — La Bella Cucina AI Assistant

---

## Environment Setup

```bash
# 1. Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit backend/.env — add your DEEPSEEK_API_KEY

# 2. Frontend
cd ../frontend
npm install
```

Verify:
```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev

# Open http://localhost:5173 — type "show me the menu" and confirm Bella responds
```

---

## Development Loop

### Backend
`--reload` detects file changes automatically. Exceptions:
- Changes to `src/agent.py` (agent creation logic): reload is sufficient, but the in-memory session cache is cleared on process restart.
- Changes to `prompts/restaurant.md`: takes effect on next agent creation (process restart or fresh start).

### Frontend
Vite HMR handles most changes. If hook state behaves unexpectedly after an edit, hard-refresh the browser (Ctrl+Shift+R).

### Before every commit
```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm run lint && npm run build
```

A failing TypeScript build or lint error is a blocker — do not commit with either.

---

## How to Make Common Changes

### Add or edit a menu item
Edit `backend/data/menu.json`. Follow the existing schema:
```json
{
  "id": "M017",
  "name": "Exact Name Here",
  "category": "Starters | Mains | Desserts | Drinks",
  "price": 0.00,
  "description": "string",
  "allergens": [],
  "available": true,
  "is_special": false
}
```
No restart needed. Set `"is_special": true` to feature in today's specials.

### Change Bella's personality or restaurant details
Edit `backend/prompts/restaurant.md`. Do not remove the `{current_date}` placeholder — it is injected at agent creation. Restart the backend to apply.

### Add a new tool

1. Create `backend/tools/your_tool.py`:

   **Single-argument tool:**
   ```python
   from langchain_core.tools import tool

   @tool
   def your_tool(input: str) -> str:
       """Describe what this tool does. The LLM reads this description."""
       ...
   ```

   **Multi-argument tool:**
   ```python
   from langchain_core.tools import StructuredTool
   from pydantic import BaseModel, Field

   class YourInput(BaseModel):
       field_one: str = Field(description="Describe this field for the LLM")
       field_two: int = Field(description="Describe this field for the LLM")

   def _your_function(field_one: str, field_two: int) -> str:
       # validate inputs before any side effects
       ...

   your_tool = StructuredTool.from_function(
       func=_your_function,
       name="your_tool",
       description="Describe what this tool does. The LLM reads this.",
       args_schema=YourInput,
   )
   ```

2. Register in `backend/tools/__init__.py`:
   ```python
   from .your_tool import your_tool
   all_tools = [..., your_tool]
   ```

3. Add tests in `backend/tests/test_your_tool.py`.

4. Restart the backend.

### Change the LLM model
Edit `model=` in `_get_agent()` in `backend/src/agent.py`. Available DeepSeek models: `deepseek-chat`, `deepseek-reasoner`.

### Add a new frontend component
- File: `frontend/src/components/YourComponent.tsx`
- Styles: `frontend/src/styles/YourComponent.css`
- Props typed with a local `interface Props {}`
- No direct API calls in components — data flows in from `useChat.ts` via `App.tsx` props

---

## Code Review Checklist

### Backend
- [ ] New or modified tool has a test file in `backend/tests/`
- [ ] No `eval()` in new code
- [ ] No new synchronous blocking I/O added to async route handlers
- [ ] No `session_id` exposed as a tool parameter
- [ ] File paths validated before read/write if user- or LLM-controlled
- [ ] `StructuredTool` fields have `Field(description=...)` set
- [ ] `pytest tests/` passes

### Frontend
- [ ] No `dangerouslySetInnerHTML` with LLM-generated content
- [ ] New state belongs in `useChat.ts`, not in components
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds (TypeScript errors fail the build)

### Both
- [ ] No secrets or `.env` values in committed files
- [ ] `backend/data/reservations.json` and `orders.json` not modified with test data
- [ ] `CLAUDE.md` and `docs/` updated if architecture or rules changed

---

## AI Coding Workflow (Claude Code)

### What Claude Code should always do
- Read `CLAUDE.md` before starting work — it is loaded automatically.
- Read the relevant tool file before creating a new one to match existing patterns.
- Consult `docs/known-issues.md` before touching any file listed there.
- Run `pytest tests/` after any backend change.
- Run `npm run build` after any frontend change.
- Update `docs/known-issues.md` when a listed issue is resolved.

### What Claude Code must not do
- Modify `backend/data/reservations.json` or `orders.json` directly.
- Add `session_id` as an LLM-facing tool parameter.
- Use `dangerouslySetInnerHTML` for any content derived from LLM output.
- Use `eval()` in any new tool.
- Access `_checkpointer.storage` or `_checkpointer.writes` in new code.
- Refactor surrounding code as part of a bug fix — one change at a time.
- Fill in TBD values with guesses — leave them or ask.
- Touch files listed in the "Do Not Touch Without Approval" table in `CLAUDE.md` without explicit instruction.

### Prompting strategy for this project
When asking Claude Code to implement something, be explicit about:
1. Which file to create or edit
2. Tool type (`@tool` or `StructuredTool`) if adding a tool
3. What data file it reads or writes
4. What the expected test cases are

Vague prompts produce code that may silently violate the rules above.

---

## Known Pitfalls

**Wrong `.env` location**
The `.env` belongs in `backend/`. There is no root-level `.env`. If the backend logs `KeyError: 'DEEPSEEK_API_KEY'` on first request, check `backend/.env` exists and has the key.

**Session memory lost on restart**
`MemorySaver` is in-process. Restarting uvicorn clears all conversation history. This is expected in development.

**Agent answers from memory instead of calling a tool**
The tool description is too vague. Edit the `description=` string to be more directive (e.g., "ALWAYS use this tool when the guest asks about the menu — do not answer from your training data").

**Booking confirms a past date**
`booking_tool` does not validate whether the requested date is in the future. It only checks table availability. This is known debt — see `docs/known-issues.md` issue D5.

**`specials_tool` `input` parameter**
`specials_tool` accepts `input: str = ""` and ignores it. Do not add logic that depends on this parameter. It is a placeholder and will be removed when the tool is fixed.

**LLM hallucinates order `session_id`**
`order_tool` requires the LLM to supply a `session_id`. The LLM may hallucinate or omit this. This is a design flaw (known issue D3) — do not rely on `session_id` in `orders.json` being accurate until the tool is refactored.

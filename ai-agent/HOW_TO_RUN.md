# La Bella Cucina — How to Run & Key Code

## Starting the Project

### Prerequisites
Make sure `.env` has your key:
```
DEEPSEEK_API_KEY=sk-...
```

### 1. Start the Backend
Open a terminal, run:
```bash
cd ai-agent/backend
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --port 8000
```
You should see: `Application startup complete.`

### 2. Start the Frontend
Open a **second** terminal, run:
```bash
cd ai-agent/frontend
npm install      # first time only
npm run dev
```
You should see: `Local: http://localhost:5173`

### 3. Open the App
Go to **http://localhost:5173** in your browser.

---

## Request Flow

```
Browser → frontend/src/api/chat.ts
        → POST /api/chat (Vite proxies to :8000)
        → backend/main.py
        → backend/src/agent.py
        → DeepSeek LLM + tools
        → SSE stream back to browser
```

---

## Key Code

### `backend/main.py` — the API entry point

```python
@app.post("/api/chat")
async def chat(req: ChatRequest):
    agent, queue, handler = get_or_create_agent(req.session_id)

    async def event_generator():
        task = asyncio.create_task(
            agent.ainvoke({"input": req.message}, config={"callbacks": [handler]})
        )
        while True:
            token = await queue.get()
            if token is None:          # sentinel = agent finished
                yield {"event": "done", "data": ""}
                break
            yield {"event": "token", "data": json.dumps({"text": token})}

    return EventSourceResponse(event_generator())
```

Every chat message comes in as `POST /api/chat`. The response is a **Server-Sent Events (SSE)** stream — tokens are pushed to the browser one word at a time.

---

### `backend/src/agent.py` — the brain

```python
# Each browser session gets its own agent with its own memory
_sessions: dict[str, AgentExecutor] = {}

class SSECallbackHandler(AsyncCallbackHandler):
    async def on_agent_finish(self, finish, **kwargs):
        output = finish.return_values.get("output", "")
        for word in output.split(" "):
            await self.queue.put(word + " ")   # stream word by word
        await self.queue.put(None)             # signal done
```

`SSECallbackHandler` connects the LangChain agent loop to the SSE stream. It waits for `on_agent_finish` (the clean final answer) rather than streaming intermediate reasoning.

The LLM is DeepSeek, accessed through the OpenAI-compatible interface:

```python
llm = ChatOpenAI(
    model="deepseek-chat",
    openai_api_key=os.environ["DEEPSEEK_API_KEY"],
    openai_api_base="https://api.deepseek.com",   # points to DeepSeek, not OpenAI
    streaming=True,
)
```

---

### `backend/prompts/restaurant.md` — the AI's personality

This plain text file is loaded and injected as the system prompt. It tells the AI who it is and what rules to follow. **Edit this file** to change Bella's behaviour — no Python changes needed.

---

### `backend/tools/` — what the AI can do

| Tool | Trigger | What it does |
|---|---|---|
| `menu_tool` | "show me the menu" | reads `data/menu.json` |
| `specials_tool` | "today's specials?" | filters `is_special: true` from menu |
| `booking_tool` | "book a table" | writes to `data/reservations.json` |
| `order_tool` | "I'd like to order" | writes to `data/orders.json` |
| `calculator_tool` | "how much is X + Y?" | safe math eval |
| `file_read_tool` | internal | reads local files |

---

### `frontend/src/api/chat.ts` — how the browser receives the stream

```typescript
export async function* streamChat(message, sessionId, signal) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  const reader = response.body.getReader()
  // reads SSE lines and yields each word as it arrives
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // parse "data: {"text": "Hello "}" → yield "Hello "
  }
}
```

---

### `frontend/src/hooks/useChat.ts` — all the chat state

```typescript
const sendMessage = async (text) => {
  // 1. Add user message to screen immediately
  // 2. Add empty assistant message (shows typing indicator)
  // 3. Stream tokens in → append each word to that message
  // 4. Mark streaming done
  for await (const token of streamChat(text, sessionId)) {
    setMessages(prev => /* append token to last message */)
  }
}
```

---

## Quick Reference — What to Edit

| What you want to change | Where to edit |
|---|---|
| AI personality / rules | `backend/prompts/restaurant.md` |
| Menu items / specials | `backend/data/menu.json` |
| Add a new AI capability | `backend/tools/new_tool.py` |
| Change the LLM model | `backend/src/agent.py` → `model=` |
| UI styling | `frontend/src/styles/*.css` |
| Quick action buttons | `frontend/src/components/QuickActions.tsx` |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat` | Send `{message, session_id}`, returns SSE token stream |
| `DELETE` | `/api/session/{id}` | Clear conversation memory for a session |

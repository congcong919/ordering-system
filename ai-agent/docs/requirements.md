# Requirements — OrderUp AI Assistant

---

## Product Goal

Provide an AI chat assistant embedded in the OrderUp food ordering system. The assistant gives customers a natural-language interface to explore the menu, check specials, ask about opening hours and location, make table reservations, and check the live status of an order — all within the floating chat panel, without leaving the page. The assistant must never invent information; all data must come from the live ordering system or the restaurant's configuration.

---

## User Stories

### 1. Menu Information

- As a customer, I can ask the assistant to show me the full menu so I can browse before deciding.
- As a customer, I can ask to filter the menu by category (e.g. "show me the starters") so I find relevant items quickly.
- As a customer, I can ask about the ingredients, description, or allergens of a specific dish so I can make a safe and informed choice.
- As a customer, the assistant always fetches live menu data — it never answers from memory or guesses.

### 2. Today's Specials

- As a customer, I can ask "what are today's specials?" and receive a list of items marked as specials in the live menu.
- As a customer, I can see the name, price, and description of each special so I can decide whether to order one.
- As a customer, if there are no specials today, the assistant tells me clearly and offers to show the full menu instead.

### 3. Opening Hours & Location

- As a customer, I can ask the assistant about opening hours so I know when the restaurant is open.
- As a customer, I can ask for the restaurant's address and phone number so I can plan my visit or call ahead.
- These answers are served directly from the restaurant configuration — no tool call is needed.

### 4. Table Availability & Reservation

- As a customer, I can ask the assistant to check if a table is available for a given date, time, and party size.
- As a customer, the assistant collects the following before attempting a booking:
  1. My full name
  2. Preferred date (YYYY-MM-DD)
  3. Preferred time (HH:MM, 24-hour)
  4. Number of guests (1–8)
  5. Any special requests (optional)
- As a customer, if a table is available, the booking is confirmed and I receive a booking reference number.
- As a customer, if no table is available for my requested slot, the assistant tells me and I can try a different time or date.
- As a customer, the system assigns the smallest available table that fits my party — I cannot request a specific table.

### 5. Order Status Check

- As a customer, I can provide an order ID in the chat and ask the assistant to look up my order status.
- As a customer, the assistant returns the current status (pending / confirmed / preparing / ready / completed / cancelled) and the item list so I know what was ordered.
- As a customer, if the order ID is not found or does not belong to me, the assistant tells me clearly rather than returning an error.
- As a customer, I do not need to leave the chat window or navigate to `/orders/:id` to get a quick status update.

### Conversation Experience

- As a customer, my conversation history is preserved within a session so I do not have to repeat myself.
- As a customer, I can start a new chat at any time to reset the conversation.
- As a customer, responses appear progressively (streaming) so the interface feels fast.
- As a customer, I can stop a response mid-stream if I no longer need it.
- As a customer, I can use quick-action chips (e.g. "View Menu", "Today's Specials", "Make a Reservation") to start common flows without typing.

---

## In-Scope Features

| Feature | Data source | Notes |
|---------|------------|-------|
| Full menu browsing by category | `GET /api/menu` (live) | AI fetches from ordering system on every call |
| Today's specials | `GET /api/menu` filtered by `isSpecial: true` | |
| Allergen information | `allergens` field on menu items | Agent advises confirming with staff for severe allergies |
| Opening hours | Restaurant config (system prompt / `config/restaurant`) | Answered directly — no tool call |
| Address & phone number | Restaurant config | Answered directly — no tool call |
| Table availability check | Firestore `reservations` via `GET /api/reservations/availability` | Checks for conflicts at requested date + time |
| Reservation creation | `POST /api/reservations` (Express) | Requires Firebase anonymous token; writes to Firestore; returns reference ID |
| Order status check | `GET /api/orders/:id` (Express) | Requires user's Firebase token; returns status and item summary |
| Streaming responses | Token-by-token via SSE through Express proxy | |
| Stop streaming | AbortController cancels in-flight request | |
| New Chat | Clears server-side LangChain session memory and resets UI | |
| Quick-action chips | Predefined prompts rendered in ChatPanel when conversation is empty | |

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reservation cancellation / amendment via chat | Contact restaurant directly |
| Email or SMS booking confirmation | No messaging integration |
| Payment processing via chat | No payment provider integrated |
| Order placement via chat | Handled by the standard cart → checkout flow; AI can recommend items but does not place orders |
| Multi-turn order editing | Not implemented |
| Waitlist for fully-booked slots | Not implemented |
| Dietary filtering (vegan, gluten-free tags) | Partially supported via conversation; no structured filter on menu items |
| Admin tools via chat | No admin actions available through the chatbot |
| Multi-language support | English only |

---

## Constraints

### Authentication
- The chat panel calls `signInAnonymously()` to obtain a Firebase token before each message, enabling order status checks and reservation creation on behalf of the user.
- The Firebase token is sent in the request body (`firebase_token`), forwarded through the Express proxy to FastAPI, and used server-side in tool calls back to Express.

### Reservations
- Party size: 1–8 guests.
- The system assigns the smallest available table — guests cannot choose a specific table number.
- Opening hours are not enforced by the booking tool; the system prompt advises the assistant to check the time is within opening hours before confirming.
- There is no validation that the requested date is in the future (future enhancement).

### Order Status
- The user must provide the exact Firestore order ID.
- The Firebase token must belong to the order's `customerId` — the assistant cannot look up another user's order.

### LLM
- Coupled to DeepSeek API (`deepseek-chat`). Switching providers requires changing `model` and `openai_api_base` in `agent.py`.
- Conversation memory is in-process (LangGraph `MemorySaver`) and lost on FastAPI restart.
- Session memory is per `session_id` UUID generated client-side; it is not persisted to Firestore.

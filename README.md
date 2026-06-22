# OrderUp — Full-Stack Restaurant Ordering System

A food ordering system for **La Bella Cucina** where customers browse the menu and place orders as guests or registered users. An AI chat assistant helps with table bookings, menu queries, and order status lookups. Admins manage the live order queue, menu items, and table reservations through a protected dashboard.

---

## Architecture

Three services that must run simultaneously:

```
Browser (:5173)
  │
  ├── REST mutations / queries ──► Express :3001  (single browser-facing backend)
  │                                    │
  ├── Firestore onSnapshot ────────────│◄── Firebase Admin SDK
  │   (orders, notifications,          │
  │    reservations — real-time)       └──► FastAPI :8000  (internal AI microservice)
  │                                               │
  └── /api/ai/* ──► Express proxy ──────────────►│
                                                  └──► Express :3001  (data reads/writes)
```

**Key decisions:**
- Express is the **only** browser-facing backend — the browser never calls FastAPI directly.
- Real-time reads (orders, notifications, reservations) use Firestore `onSnapshot` directly from the client — no polling through Express.
- Writes with side effects (FCM push, notification documents) go through Express so they happen atomically in one place.
- Firestore Security Rules are the **primary** access layer; Express middleware (`verifyToken`, `requireRole`) is a secondary layer.
- FastAPI owns no database — it calls back to Express for all data reads and writes, keeping business logic and auth in one place.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Routing** | React Router v6 |
| **Data fetching** | TanStack React Query v5 + Firestore `onSnapshot` |
| **Styling** | Tailwind CSS v3 |
| **HTTP client** | Axios (Firebase ID-token interceptor) |
| **Chat rendering** | `react-markdown` + `rehype-sanitize` |
| **Backend (main)** | Node.js, Express 4, CommonJS |
| **Input validation** | Zod |
| **Logging** | Winston + Morgan |
| **Rate limiting** | `express-rate-limit` |
| **Database / Auth / Push** | Firebase (Firestore, Authentication, Cloud Messaging) |
| **AI microservice** | Python, FastAPI, Pydantic |
| **AI agent framework** | LangChain `create_agent` |
| **Conversation memory** | LangGraph `MemorySaver` (per-session, in-process) |
| **LLM** | DeepSeek `deepseek-chat` via OpenAI-compatible API |
| **SSE streaming** | `sse-starlette` (FastAPI → Express → browser) |
| **Service-to-service HTTP** | `httpx` (FastAPI → Express) |
| **Safe math eval** | `asteval` (never `eval()`) |
| **Testing** | Jest + Supertest (server); pytest (AI agent) |

---

## Project Structure

```
ordering-system/
├── client/                        # React 18 + TypeScript (Vite, :5173)
│   └── src/
│       ├── types/index.ts         # all shared domain types
│       ├── services/              # firebase.ts, api.ts, chatApi.ts
│       ├── contexts/              # AuthContext, CartContext, NotificationContext
│       ├── hooks/                 # useOrders, useMenu, useReservations, useChat
│       ├── components/            # NavBar, CartDrawer, MenuCard, ChatPanel, ...
│       └── pages/                 # one file per route
│
├── server/                        # Node.js + Express (CommonJS, :3001)
│   └── src/
│       ├── routes/                # menu, orders, auth, notifications, reservations, tables, ai, logs
│       ├── services/              # orderService, reservationService, notificationService, fcm
│       ├── middleware/            # verifyToken, requireRole, errorHandler
│       └── utils/                 # logger (Winston), AppError
│
├── ai-agent/backend/              # Python + FastAPI (:8000)
│   ├── main.py                    # FastAPI entry — /api/chat, /api/session/:id, /api/health
│   ├── src/
│   │   ├── agent.py               # LangChain agent singleton + LangGraph MemorySaver
│   │   ├── data.py                # load_menu() — fetches from Express GET /api/menu
│   │   └── prompts.py             # loads system prompt from prompts/
│   ├── tools/                     # menu, specials, reserve_table, order_status, calculator
│   └── prompts/restaurant.md      # AI assistant persona + opening hours
│
└── docs/                          # api-contract.md, technical-design.md, requirements.md, ...
```

---

## Development Setup

All three services must run simultaneously. Vite proxies `/api/*` to Express `:3001`; Express proxies `/api/ai/*` to FastAPI `:8000`.

### 1. Client (React + Vite)
```bash
cd client
npm install
npm run dev          # dev server on :5173
npm run build        # production build
npx tsc --noEmit     # type-check only
```

### 2. Server (Express)
```bash
cd server
npm install
npm run dev          # nodemon on :3001
npm test             # Jest + Supertest
```

### 3. AI Agent (FastAPI)
```bash
cd ai-agent/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/        # run all AI agent tests
```

> Express must be running before starting FastAPI — tools call it at startup and per request.

---

## Environment Variables

### `server/.env`
```
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=        # literal \n in .env is restored to real newlines in firebase.js
SETUP_SECRET=                # guards POST /api/auth/set-admin
AI_AGENT_URL=http://localhost:8000
```

### `client/.env`
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=     # optional — enables browser push notifications
VITE_API_BASE_URL=           # empty in dev (Vite proxy); server URL in prod
```

### `ai-agent/backend/.env`
```
DEEPSEEK_API_KEY=            # required
ORDERING_API_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001
```

---

## Routes

### Express API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/menu` | Public | List all menu items |
| POST | `/api/menu` | Admin | Create menu item |
| PUT | `/api/menu/:id` | Admin | Update menu item |
| DELETE | `/api/menu/:id` | Admin | Delete menu item |
| POST | `/api/orders` | Anonymous/Customer | Place an order |
| GET | `/api/orders/:id` | Owner or Admin | Get order by ID |
| PATCH | `/api/orders/:id/status` | Admin | Advance order status |
| GET | `/api/notifications` | Customer | User's notifications |
| PATCH | `/api/notifications/:id/read` | Customer | Mark notification read |
| POST | `/api/auth/set-admin` | `SETUP_SECRET` | Grant admin role |
| POST | `/api/ai/chat` | — | Streaming proxy to FastAPI |
| DELETE | `/api/ai/session/:id` | — | Clear AI chat session |
| GET | `/api/reservations` | Admin | All reservations |
| POST | `/api/reservations` | Public (AI agent) | Book a table |
| PATCH | `/api/reservations/:id` | Admin | Reschedule (date/time) |
| PATCH | `/api/reservations/:id/status` | Admin | Lifecycle update |
| GET | `/api/reservations/availability` | Public | Check slot availability |
| GET | `/api/tables` | Public | Table configuration |
| POST | `/api/tables` | Admin | Add table |
| PUT | `/api/tables/:number` | Admin | Update table |
| DELETE | `/api/tables/:number` | Admin | Remove table |

### Frontend Routes

| Path | Access | Notes |
|---|---|---|
| `/` | Public | Landing page |
| `/menu` | Public | Read-only menu browse |
| `/order-menu` | Public | Full ordering menu with cart |
| `/checkout` | Public | Anonymous auth fires on submit |
| `/orders/:id` | Public | Firestore read gated by anonymous UID |
| `/orders` | Registered customers | `role: 'customer'` required |
| `/admin/orders` | Admin | Live order queue |
| `/admin/menu` | Admin | Menu management |
| `/admin/tables` | Admin | Table + reservation management |

---

## Auth Model

| User | Sign-in method | Role |
|---|---|---|
| Guest | Firebase Anonymous Auth (silent on checkout) | None |
| Customer | Email/Password (`/register`) | `customer` (default) |
| Admin | Google Sign-In | `admin` (custom claim via `POST /api/auth/set-admin`) |

**Granting admin access:** admin signs in → note their Firebase UID from the error → call `POST /api/auth/set-admin` with UID + `SETUP_SECRET` → admin signs out and back in.

---

## AI Assistant

The **OrderUp Assistant** is a LangChain agent (singleton) backed by LangGraph `MemorySaver` for per-session conversation history. Sessions are keyed by UUID; history is lost on FastAPI restart (by design).

The AI receives a Firebase token from the browser so it can make authenticated requests (e.g. checking order status). All traffic routes through Express — FastAPI is never exposed to the browser.

### Tools

| Tool | Does | Auth |
|---|---|---|
| `menu_tool` | Browse all menu items, optionally filter by category | None |
| `specials_tool` | Show items flagged `isSpecial: true` | None |
| `reserve_table_tool` | Book a table: tries requested time, probes ±30/60/90/120 min if taken, 409 if nothing found | None (Admin SDK write) |
| `order_status_tool` | Look up live order status by ID | Firebase token (ContextVar) |
| `calculator_tool` | Safe math via `asteval` | None |

Opening hours and location are answered from the **system prompt** — no tool call needed.

---

## Firestore Collections

| Collection | Created by | Key fields |
|---|---|---|
| `menus` | Manual seed | `name`, `price`, `category`, `available`, `allergens?`, `isSpecial?` |
| `orders` | `POST /api/orders` | `customerId`, `items[]`, `total`, `status`, `tableNumber?`, `completedAt?` |
| `users` | Client (register / FCM save) | `role`, `fcmToken` |
| `notifications` | `notificationService` (server) | `recipientId`, `orderId`, `type`, `read` |
| `reservations` | `reservationService` via `POST /api/reservations` | `customerId` (null for AI bookings), `date`, `time`, `tableNumber`, `status` |
| `config/tables` | Admin UI or manual seed | `tables: [{ number, capacity }]` |
| `config/restaurant` | Manual seed | `name`, `address`, `phone`, `openingHours` |

**Order status flow:** `pending → confirmed → preparing → ready → completed` (or `cancelled`)

**Reservation status flow:** `confirmed → seated → completed` (or `cancelled`)

### Firestore Security Rules Summary

| Collection | Read | Write |
|---|---|---|
| `menus` | Anyone | Admin only |
| `orders` | Owner or Admin | Create: owner; Update: Admin only |
| `users` | Own doc; Admin reads all | Own doc only |
| `notifications` | Own doc | Own doc; server (Admin SDK) unrestricted |
| `reservations` | Owner (if `customerId` set) or Admin | Server (Admin SDK) creates; Update: Admin only |
| `config` | Anyone | Admin only |

> Rules are in `server/firestore.rules` and must be **manually republished** via Firebase Console → Firestore → Rules after any change.

---

## Testing

- **Server:** Jest + Supertest against the real Express app with Firebase Admin SDK mocked. Every service function has at least one happy-path and one failure-path test.
- **AI agent:** 76 pytest tests covering tool units, booking date/time validation, FastAPI integration, startup API-key validation, security (no file-read tool, no `eval()`), and CORS configuration.

```bash
# Server tests
cd server && npm test

# AI agent tests
cd ai-agent/backend && pytest tests/
```

# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project overview
Full-stack food ordering system. Customers browse the menu and place orders as guests. Admins sign in with Google and manage the live order queue. An AI chat assistant (OrderUp Assistant) is powered by a separate FastAPI microservice.

- **Frontend:** React 18 + TypeScript (Vite), React Query, React Context, React Router v6, Tailwind CSS
- **Backend (main):** Node.js, Express (CommonJS) — single entry point for all client traffic
- **Backend (AI):** Python, FastAPI, LangChain, LangGraph `MemorySaver`, DeepSeek LLM — internal microservice, not browser-accessible
- **Database / Auth / Real-time:** Firebase (Firestore, Authentication, Cloud Messaging)
- **Logging:** Winston + Morgan (Express); Python logging (FastAPI)

## Development commands
```bash
# client/  — Vite dev server on :5173
npm run dev
npm run build
npx tsc --noEmit        # type-check without emitting

# server/  — nodemon on :3001
npm run dev
npm test                # Jest + Supertest (single test: npx jest <pattern>)

# ai-agent/backend/  — FastAPI on :8000
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/           # run all AI agent backend tests
```

All three services must run simultaneously in dev. Vite proxies `/api/*` to `:3001`. Express proxies `/api/ai/*` to `:8000`. The browser never speaks directly to FastAPI.

## Project structure

```
client/src/
├── types/
│   └── index.ts          # all shared domain types (MenuItem, Order, CartItem, ChatMessage, etc.)
├── services/
│   ├── firebase.ts       # Firebase app, auth, db, messagingPromise exports
│   ├── api.ts            # Axios instance with Firebase ID-token interceptor
│   └── chatApi.ts        # streamChat() and clearChatSession() — SSE streaming to /api/ai/chat
├── contexts/
│   ├── AuthContext.tsx    # user, role, loading + loginWithGoogle/register/logout
│   ├── CartContext.tsx    # cart reducer + addItem/removeItem/updateQuantity
│   └── NotificationContext.tsx
├── hooks/
│   ├── useOrders.ts        # useMyOrders, useOrder, useAllOrders, usePlaceOrder, useUpdateOrderStatus
│   ├── useMenu.ts          # useMenu, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem
│   ├── useReservations.ts  # useAllReservations, useUpdateReservationStatus, useRescheduleReservation,
│   │                       # useTables, useAddTable, useUpdateTable, useDeleteTable
│   └── useChat.ts          # chat state, session management, Firebase token injection
├── components/           # shared UI (NavBar, CartDrawer, MenuCard, OrderStatusBadge, NotificationBell,
│                         #            PrivateRoute, ChatbotButton, ChatPanel, MessageBubble,
│                         #            InputBar, QuickActions, TypingIndicator)
├── pages/                # one file per route
└── App.tsx

server/src/
├── routes/               # thin — parse body, call service, send response
│   ├── ai.js             # streaming proxy to FastAPI — /api/ai/chat, /api/ai/session/:id
│   ├── reservations.js   # GET /api/reservations (admin), PATCH /:id/status (admin),
│   │                     # GET /availability (public), POST / (AI agent)
│   └── tables.js         # GET /api/tables (public); POST/PUT/:number/DELETE/:number (admin) — full CRUD on config/tables
├── services/
│   ├── firebase.js       # Admin SDK init
│   ├── fcm.js            # sendToUser, sendToAdmins
│   ├── orderService.js   # placeOrder, updateOrderStatus (business logic lives here)
│   ├── notificationService.js  # createNotification (Firestore write)
│   └── reservationService.js   # getAllReservations, checkAvailability, createReservation,
│                                # updateReservationStatus, updateReservation (Firestore via Admin SDK)
├── middleware/           # verifyToken, requireRole, errorHandler
├── utils/                # logger (Winston), AppError
└── app.js

ai-agent/backend/
├── main.py               # FastAPI entry point — /api/chat, /api/session/:id, /api/health
├── requirements.txt
├── src/
│   ├── agent.py          # LangGraph agent singleton, run_agent_stream(), _firebase_token ContextVar
│   ├── data.py           # load_menu() — fetches from Express GET /api/menu via httpx
│   └── prompts.py        # loads system prompt from prompts/
├── tools/
│   ├── __init__.py                  # all_tools list
│   ├── menu_tool.py                 # browse menu items (reads via data.py)
│   ├── specials_tool.py             # show today's specials (reads via data.py)
│   ├── reserve_table_tool.py        # book a table in one step via POST /api/reservations; auto-selects nearest slot if preferred time is taken
│   ├── order_status_tool.py         # look up order status via Express GET /api/orders/:id
│   └── calculator_tool.py
└── prompts/
    └── restaurant.md     # system prompt — OrderUp assistant persona
```

See [`client/CLAUDE.md`](../client/CLAUDE.md) for TypeScript and React conventions.
See [`server/CLAUDE.md`](../server/CLAUDE.md) for Express service layer patterns.
See [`ai-agent/CLAUDE.md`](../ai-agent/CLAUDE.md) for AI agent architecture, tools, and coding rules.

## Auth model
| Who | Sign-in method | How role is set |
|-----|---------------|-----------------|
| Guest | Firebase Anonymous Auth (silent, on checkout) | No role needed |
| Customer | Email/Password (`/register`) | `role: 'customer'` default |
| Admin | **Google Sign-In** (`/login`) | `role: 'admin'` custom claim via `POST /api/auth/set-admin` |

**Granting admin access:** admin signs in → note their Firebase UID from the error → call `POST /api/auth/set-admin` with UID + `SETUP_SECRET` → admin signs out and back in.

**Guest checkout:** `signInAnonymously()` fires silently on checkout submit; `orderId` is saved to `localStorage`.

## Coding standards

- **Named exports only** from component files — no default exports
- **No `console.log`** — use `logger.info/warn/error` on the server; on the client, errors go to `POST /api/logs/client`
- **React hooks** prefixed with `use` (e.g. `useOrders`, `useAuth`)
- **Express route files** export a Router and are mounted in `app.js`
- **Structured errors** via `AppError(message, statusCode)`; caught in `errorHandler` middleware
- **Backend stays CommonJS** (`require`) — do not convert to ESM
- **No inline domain types** — always use `src/types/index.ts`
- **Functions over 80 lines** should be split; prefer small, single-purpose functions
- **No comments that restate what code does** — only comment non-obvious WHY

## Architecture rules

- Firestore Security Rules are the authoritative access layer; Express middleware is a second layer — never rely on only one
- All Firestore writes that belong to an order event (create notification, send FCM) happen inside `orderService`, not in routes
- Real-time reads use Firestore `onSnapshot` directly from the client — do not proxy them through Express
- Menu reads are public (no auth required); all writes are admin-only
- Rate limiting must remain on `/api/orders` (20 req/min) and `/api/auth` (10 req/min)
- `POST /api/auth/set-admin` is intentionally unprotected by `verifyToken` — guarded by `SETUP_SECRET` alone
- Do not add new Firestore collections without updating `server/firestore.rules` and `docs/technical-design.md`
- **Express is the single browser-facing backend** — browser must never call FastAPI directly
- FastAPI calls back to Express for all data reads and writes — keeps business logic in one place

## Testing rules

- Every new server-side service function must have at least one unit test (happy path) and one failure path
- Route-level integration tests use Supertest against the real Express app with Firebase Admin SDK mocked
- Do not mock Zod — validate schemas by passing real payloads
- Frontend component tests use Vitest + `@testing-library/react`
- For bug fixes: document reproduction steps, then write a failing test before fixing
- The test command is `npm test` in `server/`; it must pass before any PR is merged

## Safety rules

- **Do not modify** `server/firestore.rules` without also updating `docs/technical-design.md` and getting a review
- **Do not modify** `.env` files, Firebase credentials, or `SETUP_SECRET` handling
- **Do not run** `firebase deploy`, `gcloud`, or any production deployment command without explicit user confirmation
- **Do not change** the `POST /api/auth/set-admin` response shape — external callers depend on it
- **Do not delete** the `onSnapshot` error handler callbacks in `useOrder`, `useMyOrders`, or `useAllOrders` — causes silent infinite loading spinners
- **Do not remove** rate limiting middleware from `app.js`
- Before changing any API endpoint path, method, or response shape, document the change in `docs/api-contract.md`
- **Do not expose FastAPI directly** to the browser — all AI traffic must route through Express `/api/ai`
- **Do not use `eval()`** in any AI agent tool — use `asteval.Interpreter`
- **Do not render LLM output as raw HTML** — use `react-markdown` + `rehype-sanitize` in all chat components
- **Do not commit** `ai-agent/backend/.env` — it contains the DeepSeek API key

## AI coding workflow

**Before coding:**
1. Read all files relevant to the change
2. Summarise the current implementation in one paragraph
3. Propose a plan and wait for approval if the change touches: Firestore security rules, auth flow, API contracts, or the notification/FCM pipeline

**When coding:** make the smallest reasonable change; do not refactor surrounding code; do not add features beyond what was requested.

**After coding:**
1. Run `npx tsc --noEmit` (frontend) and `npm test` (server) and report results
2. List manual verification steps
3. Note any risks or edge cases introduced

## Files that require approval before changing

| File / path | Reason |
|-------------|--------|
| `server/firestore.rules` | Primary security layer — a mistake exposes all data |
| `server/src/middleware/verifyToken.js` | Every authenticated route depends on this |
| `server/src/middleware/errorHandler.js` | Changes affect all error responses globally |
| `server/src/services/firebase.js` | Admin SDK init — misconfiguration breaks the entire server |
| `server/src/routes/auth.js` | Admin provisioning endpoint — security-sensitive |
| `server/src/routes/ai.js` | Controls all AI traffic routing — misconfiguration breaks chat or exposes FastAPI |
| `client/src/services/firebase.ts` | Firebase client init — misconfiguration breaks auth and real-time |
| `client/src/contexts/AuthContext.tsx` | All role-based access flows through this |
| `ai-agent/backend/prompts/restaurant.md` | Changes the AI assistant's behaviour immediately on restart |
| `ai-agent/backend/src/agent.py` | Agent singleton and ContextVar setup — changes affect all sessions |

## Firestore collections

Full schema: [`docs/technical-design.md — Database Models`](../docs/technical-design.md#database-models-firestore).

| Collection | Created by | Key fields |
|------------|-----------|-----------|
| `menus` | **Manual seed** | name, price, category, description, imageUrl?, available, allergens?, isSpecial? |
| `orders` | Auto — route `POST /api/orders` | customerId, guestName?, **tableNumber?**, items[], total, note, status, createdAt, **completedAt?** (written on status → completed) |
| `users` | Auto — client on register / FCM token save | role, fcmToken |
| `notifications` | Auto — `notificationService.createNotification` | recipientId, orderId, type, message, read, createdAt |
| `reservations` | Auto — `reservationService.createReservation` | customerId (null for AI chat bookings), name, date, time, partySize, tableNumber, **status**, notes, createdAt |
| `config/tables` | Admin UI (`POST/PUT/DELETE /api/tables`) or manual seed | tables[] — array of `{ number, capacity }` |
| `config/restaurant` | **Manual seed** | name, address, phone, openingHours |

Order status flow: `pending → confirmed → preparing → ready → completed` (or `cancelled`)

Reservation status flow: `confirmed → seated → completed` (or `cancelled` at any active state)

## Firestore security rules

Rules file: `server/firestore.rules`. Must be **manually published** via Firebase Console → Firestore → Rules tab.
- `menus`: public read, admin-only write
- `orders`: owner or admin read; owner create; admin-only update
- `users`: each user reads/writes their own doc; admin can read all
- `notifications`: each user reads/writes their own; server creates via Admin SDK (unrestricted)
- `reservations`: admin read-all; owner read if `customerId` is set; server creates via Admin SDK; admin-only update/cancel
- `config`: public read (opening hours, tables); admin-only write

## Known gotchas

- `useOrder`, `useMyOrders`, `useAllOrders` must include an `onSnapshot` error handler — without it a Firestore permission error causes an infinite loading spinner
- `VITE_API_BASE_URL` should be empty in dev (Vite proxy handles routing); set to full server URL in prod
- After granting the `admin` claim, the user must sign out and back in before their token carries the claim
- Menu `available` filtering is done client-side in `MenuPage` — the API returns all items
- LangGraph `MemorySaver` stores history in-process — sessions are lost when FastAPI restarts; by design
- `GET /api/tables` returns `{ tables: [] }` (not an error) when no tables exist yet — the checkout dropdown won't render and the admin Tables page shows an empty state with an Add Table prompt
- `useAllReservations` must include an `onSnapshot` error handler — same silent spinner risk as order hooks
- Table status on `/admin/tables` is derived client-side from live orders + reservations; it is not a stored field — no sync required
- The `GET /api/reservations` route must come before `GET /api/reservations/availability` in Express registration to avoid `:id` wildcard conflicts — do not reorder these routes
- `POST /api/reservations` is now a single atomic book-or-find operation: checks availability, falls back to ±30/60/90/120-min alternate slots, throws 409 only when the full search window is exhausted — the AI no longer calls `GET /api/reservations/availability`
- Table availability for reservations considers active orders: a table with an active order is blocked until `nextHalfHour(createdAt + 90 min)`; a completed order blocks until `nextHalfHour(completedAt)` — `completedAt` is written to the order doc when status → `'completed'`
- Updated `server/firestore.rules` must be **manually republished** in Firebase Console → Firestore → Rules before client reads of `reservations` or `config` take effect

## Route access
| Route | Access | Layout |
|-------|--------|--------|
| `/` | Public — landing page | BrowseLayout |
| `/menu` | Public — read-only menu browse | BrowseLayout |
| `/order-menu` | Public — full ordering menu | MainLayout (navbar + cart) |
| `/checkout` | Public (anonymous auth on submit) | MainLayout |
| `/orders/:id` | Public (Firestore read gated by anonymous uid) | MainLayout |
| `/orders` | Registered (non-anonymous) customers only | MainLayout |
| `/admin/orders` | `role: 'admin'` only | MainLayout |
| `/admin/tables` | `role: 'admin'` only | MainLayout |
| `/admin/menu` | `role: 'admin'` only | MainLayout |

## Environment variables
```
# server/.env
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=      # literal \n in .env is restored to real newlines in firebase.js
SETUP_SECRET=              # guards POST /api/auth/set-admin
AI_AGENT_URL=http://localhost:8000

# client/.env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=   # optional — enables browser push notifications
VITE_API_BASE_URL=         # empty in dev (Vite proxy); server URL in prod

# ai-agent/backend/.env
DEEPSEEK_API_KEY=          # required
ORDERING_API_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001
```

# Technical Design

## Architecture Overview

The system is three separate processes that must run together.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite :5173)                            │
│                                                              │
│  React Query ─── REST ──────► Express :3001                 │
│  (menu, mutations)            │                              │
│                               │  ┌─────────────────────┐    │
│  Firestore onSnapshot ────────┼─►│  Firebase           │    │
│  (orders, notifications)      │  │  Auth / Firestore   │    │
│                               │  │  Cloud Messaging    │    │
│  Firebase Client SDK ─────────┘  └─────────────────────┘    │
│  (auth, FCM token)                                           │
│                               │                              │
│  useChat → POST /api/ai/* ────┤  (all through Express)       │
└───────────────────────────────┼──────────────────────────────┘
                                │
                    Express proxies /api/ai/*
                                │
                                ▼
                         FastAPI :8000   (internal — not browser-accessible)
                                │
                    ┌───────────┴────────────┐
                    │                        │
              GET /api/menu          POST /api/orders
              (public read)          (with Firebase token)
                    │                        │
                    └──────────► Express :3001 ◄──────────┘
```

**Key architectural decisions:**

- Real-time reads (orders, notifications) bypass Express entirely — clients subscribe to Firestore directly via `onSnapshot`. This removes polling and avoids an Express bottleneck for live data.
- Writes that trigger side effects (FCM, notification documents) go through Express so the server can execute them atomically in one place.
- Firestore Security Rules are the primary access control layer. Express middleware (`verifyToken`, `requireRole`) is a second, independent layer.
- **Express is the single browser-facing backend.** The AI chat feature routes through Express (`/api/ai/*`), which uses `http-proxy-middleware` to stream requests to FastAPI. The browser never calls FastAPI directly.
- FastAPI is a stateless microservice for AI — it owns no database and calls back to Express for all data reads (menu) and writes (orders). This keeps business logic and auth in Express.

---

## Provider / Context Tree (Frontend)

```
QueryClientProvider         ← React Query cache
  BrowserRouter             ← routing
    AuthProvider            ← Firebase auth state, role, login methods
      CartProvider          ← localStorage-backed cart reducer
        NotificationProvider ← Firestore onSnapshot for current user's notifications
          <Routes />
```

`AuthProvider` is mounted in `main.tsx` so it wraps the router. `CartProvider` and `NotificationProvider` are mounted in `App.tsx`.

---

## Module Responsibilities

### Frontend

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| Firebase client | `services/firebase.ts` | Initialises Firebase app, exports `auth`, `db`, `messagingPromise` |
| API client | `services/api.ts` | Axios instance; request interceptor attaches Firebase ID token from `auth.currentUser` |
| Auth context | `contexts/AuthContext.tsx` | Wraps Firebase auth state; exposes `user`, `role`, `loading`, `isAnonymous`, `loginWithGoogle`, `register`, `loginAnonymously`, `logout` |
| Cart context | `contexts/CartContext.tsx` | Reducer-based cart (ADD / REMOVE / UPDATE_QTY / CLEAR / LOAD); persists to `localStorage` |
| Notification context | `contexts/NotificationContext.tsx` | `onSnapshot` on `notifications` for logged-in user; exposes `notifications`, `unreadCount`, `markAsRead`, `markAllAsRead` |
| Order hooks | `hooks/useOrders.ts` | `useMyOrders` (customer), `useOrder` (single), `useAllOrders` (admin) via `onSnapshot`; `usePlaceOrder` and `useUpdateOrderStatus` via React Query mutations |
| Menu hooks | `hooks/useMenu.ts` | `useMenu` via React Query; `useCreateMenuItem`, `useUpdateMenuItem`, `useDeleteMenuItem` mutations |
| Reservation hooks | `hooks/useReservations.ts` | `useAllReservations` (admin, `onSnapshot`); `useUpdateReservationStatus` mutation; `useRescheduleReservation` mutation; `useTables` (React Query — public `GET /api/tables`) |
| PrivateRoute | `components/PrivateRoute.tsx` | Blocks routes by `requiredRole`; redirects to `/login` or `/order-menu` based on current role |
| BrowseLayout | `App.tsx` (inline) | Shared layout for `/` and `/menu`; renders the logo-only header and `<Outlet />`; no navbar, no cart drawer — keeps the pre-ordering experience visually separate from the ordering flow |
| MainLayout | `App.tsx` (inline) | Shared layout for `/order-menu` and all account/admin routes; renders `NavBar`, `CartDrawer`, and `<Outlet />` |
| ChatbotButton | `components/ChatbotButton.tsx` | Floating button + opens `ChatPanel`; reads Firebase session for token injection |
| ChatPanel | `components/ChatPanel.tsx` | Messages list, quick action chips, input bar — driven by `useChat` |
| TypingIndicator | `components/TypingIndicator.tsx` | Animated three-dot indicator shown while the assistant is streaming |
| Chat API | `services/chatApi.ts` | `streamChat()` — SSE stream to `POST /api/ai/chat`; `clearChatSession()` — `DELETE /api/ai/session/:id` |
| Chat hook | `hooks/useChat.ts` | Central chat state; manages messages, session ID, streaming flag, abort controller, and Firebase token injection via `signInAnonymously` |
| Domain types | `types/index.ts` | Single source of truth for `MenuItem`, `CartItem`, `OrderItem`, `Order`, `OrderStatus`, `Reservation`, `ReservationStatus`, `Notification`, `ChatMessage` |

### Express Backend

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| Firebase Admin | `services/firebase.js` | Initialises `firebase-admin`; exports `admin`, `auth`, `db`, `messaging` |
| FCM service | `services/fcm.js` | `sendToUser(uid, payload)` — looks up FCM token from `users` collection; `sendToAdmins(payload)` — queries all admin tokens |
| Order service | `services/orderService.js` | `placeOrder` and `updateOrderStatus` — all business logic for the orders domain |
| Notification service | `services/notificationService.js` | `createNotification(payload)` — single function for all notification doc writes |
| Reservation service | `services/reservationService.js` | `checkAvailability(date, time, partySize)` — reads `config/tables` + active `reservations`; `createReservation(data)` — assigns smallest-fit table, writes `reservations/{id}`; `updateReservationStatus(id, status)` — admin lifecycle; `updateReservation(id, { date, time })` — admin reschedule (validates opening hours, excludes own slot from conflict check) |
| Reservations route | `routes/reservations.js` | `GET /` (admin); `PATCH /:id` (admin — reschedule date/time); `PATCH /:id/status` (admin — lifecycle); `GET /availability` (public); `POST /` (AI agent — no auth, Admin SDK write) |
| AI proxy route | `routes/ai.js` | `http-proxy-middleware` streaming proxy; forwards `/api/ai/*` to FastAPI; rewrites path prefix |
| Token verification | `middleware/verifyToken.js` | Extracts Bearer token from `Authorization` header; calls `auth.verifyIdToken`; attaches decoded claims to `req.user` |
| Role guard | `middleware/requireRole.js` | Checks `req.user.role` against a required role string; returns 403 if unmatched |
| Error handler | `middleware/errorHandler.js` | Final Express error middleware; logs via Winston; returns `{ error: message }` JSON; masks non-operational errors as 500 |
| Logger | `utils/logger.js` | Winston instance; JSON format to files (`logs/error.log`, `logs/combined.log`); colourised console in dev |
| AppError | `utils/AppError.js` | `Error` subclass with `statusCode` and `isOperational: true`; used to distinguish known errors from programmer errors |

### FastAPI AI Agent

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| Entry point | `main.py` | FastAPI app; routes `/api/chat`, `/api/session/:id`, `/api/health`; CORS restricted to Express origin |
| Agent | `src/agent.py` | LangChain `create_agent` singleton; `LangGraph MemorySaver` for per-session conversation history; `run_agent_stream()` pushes SSE tokens to a queue; `_firebase_token` ContextVar stores per-request token |
| Data access | `src/data.py` | `load_menu()` — synchronous `httpx.get()` to `GET /api/menu` on Express; normalises camelCase → snake_case |
| Menu tool | `tools/menu_tool.py` | LangChain tool; calls `load_menu()`; formats menu for LLM |
| Specials tool | `tools/specials_tool.py` | LangChain tool; calls `load_menu()`; filters `is_special: true` items |
| Reserve table tool | `tools/reserve_table_tool.py` | LangChain tool; calls `POST /api/reservations` via httpx in one atomic step — tries requested time, falls back to nearest available slot (±30/60/90/120 min); no client Firebase token required (Express writes via Admin SDK) |
| Order status tool | `tools/order_status_tool.py` | LangChain tool; calls `GET /api/orders/:id` via httpx; attaches `Authorization: Bearer <firebase_token>` from `_firebase_token` ContextVar |
| Calculator tool | `tools/calculator_tool.py` | Safe math via `asteval.Interpreter` — never uses `eval()` |

---

## Data Flow

### Guest placing an order

```
1. Guest selects table from dropdown (populated by GET /api/tables) or leaves blank for takeout
2. Guest clicks "Place order" in CheckoutPage
3. If no Firebase user → signInAnonymously() (silent)
4. POST /api/orders  { items, note, total, guestName, tableNumber? }
   Header: Authorization: Bearer <anonymous Firebase ID token>
5. verifyToken decodes token → req.user = { uid, firebase.sign_in_provider: 'anonymous', ... }
6. PlaceOrderSchema (Zod) validates body
7. routes/orders.js writes order doc (includes tableNumber if provided)
   a. db.collection('orders').add(orderDoc) → returns orderId
   b. if tableNumber: query reservations WHERE tableNumber=N, date=today, status='confirmed'
      → update closest-in-time reservation to status='seated'
   c. isAnonymous=true → skip notification doc
   d. sendToAdmins({ title: 'New order', body: '...' })
8. Response: 201 { orderId }
9. Client saves orderId to localStorage
10. Client navigates to /orders/:id
11. useOrder(orderId) → onSnapshot on orders/{orderId} (real-time)
```

### Registered customer placing an order

Same as above except:
- Step 2: user is already signed in (no `signInAnonymously`)
- Step 6b: `isAnonymous=false` → `notificationService.createNotification(...)` writes a notification doc for the customer

### Admin updating an order status

```
1. Admin clicks "Confirm" on an order card in AdminOrdersPage
2. useUpdateOrderStatus mutation → PATCH /api/orders/:id/status  { status: 'confirmed' }
   Header: Authorization: Bearer <admin Google ID token>
3. verifyToken → req.user = { uid, role: 'admin', ... }
4. requireRole('admin') → passes
5. StatusSchema (Zod) validates { status }
6. orderService.updateOrderStatus(orderId, 'confirmed')
   a. db.collection('orders').doc(id).update({ status })
   b. notificationService.createNotification({ recipientId: customerId, ... })
   c. sendToUser(customerId, { title: 'Order update', body: '...' })
7. Response: 200 { orderId, status }
8. All onSnapshot listeners on orders/{id} receive the update automatically
```

### AI assistant placing an order via chat

```
1. User types "Order 2x Bruschetta for Alice" in ChatPanel
2. useChat: no Firebase session → signInAnonymously() → getIdToken()
3. POST /api/ai/chat  { message, session_id, firebase_token }
   (Vite proxy → Express :3001)
4. Express /api/ai proxy → FastAPI POST /api/chat  (body forwarded unchanged)
5. LangGraph agent processes message → invokes order_tool
6. order_tool: load_menu() → GET http://localhost:3001/api/menu (httpx sync)
7. order_tool: matches "Bruschetta" → { id, name, price } → builds order payload
8. order_tool: POST http://localhost:3001/api/orders
              Authorization: Bearer <firebase_token from ContextVar>
              { items: [{id, name, price, quantity: 2}], total, guestName: "Alice" }
9. Express verifyToken → validates anonymous Firebase token
10. orderService.placeOrder → Firestore write → FCM to admins → { orderId }
11. order_tool returns confirmation string with orderId
12. LangGraph streams response tokens → SSE → FastAPI → Express proxy → browser
13. useChat appends tokens to assistant message in real time
```

### AI assistant making a reservation via chat

The agent collects information over one or more turns before calling any tools.

```
--- Conversation turns (no tools yet) ---
1. User: "I'd like to book a table"
2. Agent: "Sure! How many guests, and what date and time were you thinking?"
3. User: "2 people, this Friday at 7pm"
4. Agent: "And your name for the reservation?"
5. User: "Alice"

--- Tool: reserve_table_tool ---
6. Agent invokes reserve_table_tool({ name: "Alice", date: "2026-06-19", time: "19:00", party_size: 2, notes: "" })
7. reserve_table_tool: POST http://localhost:3001/api/reservations
                          { name, date, time, partySize, notes }
   (no auth header — Express writes via Admin SDK)
8. reservationService.createReservation (atomic book-or-find):
   a. reads config/tables + active reservations + recent orders for the requested slot
   b. if the slot is free → assigns smallest-fit table → writes reservations/{id}
   c. if the slot is taken → probes ±30/60/90/120 min in order; books the first free slot found
   d. if no slot is found within the search window → returns 409
9. Express returns:
   201 { id, name, date, time, tableNumber, status: "confirmed", ... }            ← requested time booked
   201 { id, ..., time: "19:30", requestedTime: "19:00", ... }                    ← alternative time booked
   409 { error: "No available tables..." }                                         ← no availability
10. reserve_table_tool returns a confirmation string (booking ref, table, actual date/time)
    — or a "no availability" message if 409
11. LangGraph streams response tokens → SSE → FastAPI → Express proxy → browser
```

### Real-time order updates (admin queue)

```
useAllOrders() mounts →
  onSnapshot(query(collection('orders'), orderBy('createdAt', 'desc')))
    → every Firestore write to any order document triggers the callback
    → React re-renders the order list immediately
    → no polling, no Express involvement
```

### Admin table management

```
AdminTablesPage mounts →
  useTables()           → GET /api/tables (React Query, 5 min stale)
  useAllOrders()        → onSnapshot on orders (real-time)
  useAllReservations()  → onSnapshot on reservations (real-time)

Two view tabs (client-side, no network request) →
  All tab:          all tables; shows live status badge (occupied | available), active orders, Add Order button
                    status = 'occupied'  if any order.tableNumber == N && order.status in [pending/confirmed/preparing/ready]
                    status = 'available' otherwise (reservations do not affect this status)
                    card: orange border for occupied, green border for available
                    subtitle: "{occupied} occupied · {available} available · real-time"

  Reservations tab: all tables; shows only timeslots (confirmed + seated, sorted by date/time); no status badge; neutral white card
                    tables with no bookings show "No upcoming reservations" placeholder
                    active orders and Add Order button are hidden
                    subtitle: "{withBookings} of {total} tables have upcoming reservations"

The two tabs derive status independently — reservations do not affect the All tab's occupied/available count.

Admin: advance reservation status →
  PATCH /api/reservations/:id/status { status: 'seated' | 'completed' | 'cancelled' }
  → updateReservationStatus writes Firestore → onSnapshot triggers re-derive

Admin: reschedule reservation →
  PATCH /api/reservations/:id { date, time }
  → updateReservation validates opening hours + table availability → writes Firestore
  → onSnapshot triggers re-derive; table card timeslot list updates in real-time

Customer/admin places order at a table →
  POST /api/orders { items, total, tableNumber, note, guestName? }
  → order written to Firestore
  → if tableNumber: confirmed reservation for that table today → auto-updated to 'seated'
  → useAllOrders + useAllReservations snapshots fire → table status re-derives to 'occupied'
```

---

## Database Models (Firestore)

Firestore is schemaless. The shapes below are the de-facto contracts enforced by Zod on writes and by TypeScript on reads.

### `menus/{docId}`
```
{
  name:        string          // display name
  price:       number          // positive, in dollars
  category:    string          // e.g. "Main", "Drink"
  description: string          // may be empty string
  imageUrl:    string          // URL or empty string
  available:   boolean         // false hides item from customers
  allergens:   string[]        // optional — e.g. ["gluten", "dairy"]; used by AI assistant
  isSpecial:   boolean         // optional — marks as today's special; used by AI assistant
  createdAt:   string          // ISO 8601, set on creation only
}
```
Must be seeded manually via Firebase Console. Not created by the application. `allergens` and `isSpecial` are optional — documents seeded before their introduction remain valid.

### `orders/{docId}`
```
{
  customerId:  string          // Firebase UID (anonymous or registered)
  guestName:   string | null   // set only for anonymous users
  tableNumber: number | null   // dine-in table; omitted for takeout orders
  items:       OrderItem[]     // snapshot of cart at order time
  total:       number          // sum of item.price * item.quantity
  note:        string          // special instructions, may be empty
  status:      OrderStatus     // 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  createdAt:   string          // ISO 8601
}

OrderItem: { id, name, price, quantity }
```

### `users/{uid}`
```
{
  name:      string    // set on email/password registration
  email:     string    // set on email/password registration
  role:      string    // 'customer' | 'admin'
  fcmToken:  string    // updated on every login if VAPID key is configured
  createdAt: string    // ISO 8601, set on registration only
}
```
Admin users have `role: 'admin'` set both here and as a Firebase custom claim (the claim is authoritative for auth).

### `notifications/{docId}`
```
{
  recipientId: string    // Firebase UID of the recipient
  orderId:     string    // Firestore doc ID of the related order
  type:        string    // 'order_placed' | 'status_update'
  message:     string    // human-readable message shown in the bell
  read:        boolean   // false until marked read by the client
  createdAt:   string    // ISO 8601
}
```
Only created for registered (non-anonymous) users. Anonymous users do not receive notification documents.

### `reservations/{docId}` *(added for AI booking feature)*
```
{
  customerId:  string    // Firebase UID — set server-side from token; null for AI chat bookings
  name:        string    // guest full name collected by AI
  date:        string    // YYYY-MM-DD
  time:        string    // HH:MM (24-hour)
  partySize:   number    // 1–8
  tableNumber: number    // assigned by reservationService (smallest available table)
  status:      string    // 'confirmed' | 'seated' | 'completed' | 'cancelled'
  notes:       string    // special requests, may be empty string
  createdAt:   string    // ISO 8601
}
```

Status lifecycle: `confirmed` → `seated` → `completed`; cancel to `cancelled` from any active state.
Transitions: `confirmed → seated` triggered automatically when a dine-in order is placed at the same table (today only), or manually by admin ("Seat guests"). `seated → completed` is admin-only ("Clear table"). Admin can also cancel from any active state.
Created by `reservationService.createReservation()` called from the Express `POST /api/reservations` route, which is invoked by the AI `booking_tool`. Linked to the user's anonymous Firebase UID so they can look it up later.

### `config/tables` *(manual seed — restaurant table configuration)*
```
{
  tables: [
    { number: 1, capacity: 2 },
    { number: 2, capacity: 2 },
    { number: 3, capacity: 4 },
    { number: 4, capacity: 4 },
    { number: 5, capacity: 6 },
    { number: 6, capacity: 8 }
  ]
}
```
Read by `reservationService` to determine available tables for a given slot. Admin-only write. The table list is treated as static config — changes require admin access.

### `config/restaurant` *(manual seed — restaurant info and opening hours)*
```
{
  name:    string    // e.g. "OrderUp Kitchen"
  address: string    // full street address
  phone:   string    // contact number
  openingHours: {
    monday:    { closed: true }
    tuesday:   { lunch: { open: "12:00", close: "15:00" }, dinner: { open: "18:00", close: "22:00" } }
    wednesday: { lunch: { open: "12:00", close: "15:00" }, dinner: { open: "18:00", close: "22:00" } }
    thursday:  { lunch: { open: "12:00", close: "15:00" }, dinner: { open: "18:00", close: "22:00" } }
    friday:    { lunch: { open: "12:00", close: "15:00" }, dinner: { open: "18:00", close: "23:00" } }
    saturday:  { lunch: { open: "12:00", close: "15:30" }, dinner: { open: "18:00", close: "23:00" } }
    sunday:    { lunch: { open: "12:00", close: "15:00" }, dinner: { open: "18:00", close: "21:30" } }
  }
}
```
Public read. Loaded into the AI system prompt on FastAPI startup so the agent can answer opening-hours and location questions without a tool call. Admin-only write.

---

## Data Structure Plan (AI Agent Integration)

This table is the canonical reference for all Firestore collections introduced or modified as part of the AI agent integration. Use this when seeding Firebase Console or writing Firestore security rules.

| Collection | Status | Purpose | Key fields |
|------------|--------|---------|-----------|
| `menus` | **Updated** | Menu items with AI-facing metadata | +`allergens?: string[]`, +`isSpecial?: boolean` |
| `reservations` | **New** | Table bookings created via AI chat | `customerId`, `name`, `date`, `time`, `partySize`, `tableNumber`, `status`, `notes`, `createdAt` |
| `config/tables` | **New** | Restaurant table configuration — managed via admin UI or manual seed | `tables: [{ number, capacity }]` |
| `config/restaurant` | **New** | Restaurant info and opening hours | `name`, `address`, `phone`, `openingHours` |
| `orders` | Unchanged | Customer orders | existing fields only |
| `users` | Unchanged | User profiles and FCM tokens | existing fields only |
| `notifications` | Unchanged | In-app notification bell | existing fields only |

### Field types reference

```
reservations/{docId}
├── customerId:  string       // Firebase UID (anonymous or registered)
├── name:        string       // guest full name
├── date:        string       // "YYYY-MM-DD"
├── time:        string       // "HH:MM"  (24-hour)
├── partySize:   number       // integer 1–8
├── tableNumber: number       // integer — assigned by reservationService
├── status:      string       // "confirmed" | "cancelled"
├── notes:       string       // may be empty string
└── createdAt:   string       // ISO 8601 UTC

config/tables  (single document)
└── tables: Array<{ number: number, capacity: number }>

config/restaurant  (single document)
├── name:         string
├── address:      string
├── phone:        string
└── openingHours: {
      [day: string]: {          // "monday" … "sunday"
        closed?: boolean        // true = closed all day
        lunch?:  { open: string, close: string }   // "HH:MM"
        dinner?: { open: string, close: string }   // "HH:MM"
      }
    }
```

### Service layer additions

| Service / Route | File | Responsibility | Status |
|----------------|------|----------------|--------|
| `reservationService.js` | `server/src/services/reservationService.js` | `getAllReservations()` — all docs ordered by date; `checkAvailability(date, time, partySize)` — reads `config/tables` + confirmed bookings at slot; `createReservation(data)` — assigns table, writes Firestore doc; `updateReservationStatus(id, status)` — admin lifecycle update; `updateReservation(id, { date, time })` — admin reschedule | **Done** |
| `routes/reservations.js` | `server/src/routes/reservations.js` | `GET /` (admin — all reservations); `PATCH /:id` (admin — reschedule); `PATCH /:id/status` (admin — lifecycle); `GET /availability` (public); `POST /` (AI agent — no auth, Admin SDK write) | **Done** |
| `routes/tables.js` | `server/src/routes/tables.js` | `GET /api/tables` (public); `POST /api/tables`, `PUT /api/tables/:number`, `DELETE /api/tables/:number` (all admin) — full CRUD on `config/tables` | **Done** |

**Auth note — no client Firebase token required for reservations:**
The `check_availability_tool` and `make_reservation_tool` call Express directly via httpx with no `Authorization` header. `GET /api/reservations/availability` is public. `POST /api/reservations` is not protected by `verifyToken` — the route trusts that only the internal FastAPI service calls it, and Express uses its Admin SDK credentials to write to Firestore. `customerId` is stored as `null` for chat-originated reservations (no user session token is available in this flow). Admins can view all reservations regardless.

**Firestore prerequisite — manual seed required before reservations work:**
- Create `config/tables` document with field `tables: [{ number: 1, capacity: 2 }, ...]`
- See the "Database Models" section above for the full seed payload

---

## External Services

### Firebase Authentication
- **Anonymous Auth** — silent `signInAnonymously()` on checkout; produces a short-lived UID used only for Firestore ownership
- **Email/Password** — customer registration and login
- **Google Sign-In** — admin login only; custom claim `role: 'admin'` is set server-side via Admin SDK
- **Custom Claims** — `role` claim is read by `verifyToken` middleware and by the client's `AuthContext` via `getIdTokenResult(true)` (forced refresh)

### Firebase Firestore
- **Database** for all persistent data
- **Security Rules** (file: `server/firestore.rules`) are the primary access layer; must be published manually via Firebase Console
- **`onSnapshot`** used for all real-time reads — orders list (admin), single order (customer), notifications

### Firebase Cloud Messaging (FCM)
- **Push to customer** (`sendToUser`) — looks up `users/{uid}.fcmToken`, sends a targeted message
- **Push to admins** (`sendToAdmins`) — queries all docs where `role == 'admin'`, collects tokens, calls `sendEachForMulticast`
- FCM failures are **non-fatal** — wrapped in try/catch, logged as a warning
- Requires `VITE_FIREBASE_VAPID_KEY` on the client to register a service worker and retrieve the FCM token

### FastAPI AI Agent
- **Agent framework:** LangChain `create_agent` handles tool calling and message processing
- **Conversation memory:** LangGraph `MemorySaver` stores history per `session_id` (used as `thread_id`) in-process — lost on restart; LangGraph is used only for this checkpointing strategy
- **LLM:** DeepSeek `deepseek-chat` via OpenAI-compatible REST API (`langchain_openai.ChatOpenAI`); streaming enabled via `astream_events()`
- **httpx** is used for synchronous service-to-service calls from tool code back to Express
- Tools are synchronous Python functions; blocking I/O is acceptable at current scale
- Agent is a singleton — shared across all sessions; per-session isolation is achieved through LangGraph's per-thread checkpointing

### Winston (logging)
- Structured JSON log format
- Transports: colourised console (dev), `logs/error.log` (errors only), `logs/combined.log` (all levels)
- Request IDs attached to every log line via `req.requestId` (UUID generated in `app.js`)
- No log rotation configured (see Known Issues)

---

## Firestore Security Rules Summary

File: `server/firestore.rules`

| Collection | Read | Write |
|------------|------|-------|
| `menus` | Anyone | Admin only |
| `orders` | Owner (`customerId == request.auth.uid`) or admin | Create: owner; Update: admin only |
| `users` | Own doc only; admin can read all | Own doc only |
| `notifications` | Own doc (`recipientId == request.auth.uid`) | Own doc; server (Admin SDK) unrestricted |
| `reservations` | Owner (`customerId != null && customerId == request.auth.uid`) or admin | Server (Admin SDK) creates (unrestricted); Update: admin only |
| `config` | Anyone (public — opening hours, table list) | Admin only |

These rules must be republished via Firebase Console whenever changed.

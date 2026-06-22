# API Contract

Base URL in dev: `http://localhost:3001` (or via Vite proxy at `http://localhost:5173`)
Base URL in prod: value of `VITE_API_BASE_URL`

All endpoints are prefixed with `/api`. All request and response bodies are JSON unless noted. All authenticated endpoints require:
```
Authorization: Bearer <Firebase ID token>
```

Errors always return:
```json
{ "error": "<message>" }
```

---

## Menu

### `GET /api/menu`

Returns all menu items. **No authentication required.**

**Response `200`**
```json
[
  {
    "id": "abc123",
    "name": "Grilled Chicken",
    "price": 14.99,
    "category": "Main",
    "description": "Served with seasonal vegetables",
    "imageUrl": "https://...",
    "available": true,
    "allergens": ["gluten", "dairy"],
    "isSpecial": false,
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
]
```

Items are ordered by `category` ascending (Firestore `orderBy`). Unavailable items (`available: false`) are currently returned and filtered client-side — see Known Issues.

`allergens` and `isSpecial` are optional fields — they will be absent on menu items seeded before these fields were introduced. Consumers must treat their absence as `allergens: []` and `isSpecial: false`.

---

### `POST /api/menu`

Creates a new menu item. **Requires `role: 'admin'`.**

**Request body**
```json
{
  "name": "Grilled Chicken",
  "price": 14.99,
  "category": "Main",
  "description": "Optional",
  "imageUrl": "",
  "available": true
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–100 chars |
| `price` | number | yes | positive |
| `category` | string | yes | 1–50 chars |
| `description` | string | no | max 300 chars; defaults to `""` |
| `imageUrl` | string | no | valid URL or `""`; defaults to `""` |
| `available` | boolean | no | defaults to `true` |
| `allergens` | string[] | no | list of allergen names (e.g. `["gluten", "dairy"]`) |
| `isSpecial` | boolean | no | marks item as a today's special; used by the AI assistant |

**Response `201`**
```json
{
  "id": "newDocId",
  "name": "Grilled Chicken",
  "price": 14.99,
  "category": "Main",
  "description": "",
  "imageUrl": "",
  "available": true
}
```

**Response `400`** — Zod validation failure
**Response `401`** — missing/invalid token
**Response `403`** — authenticated but not admin

---

### `PUT /api/menu/:id`

Updates an existing menu item. All fields are optional (partial update). **Requires `role: 'admin'`.**

**Request body** — same fields as `POST /api/menu`, all optional.

**Response `200`**
```json
{
  "id": "abc123",
  "available": false
}
```
Returns only the fields that were sent.

**Response `400`** — Zod validation failure
**Response `401`** / **`403`** — auth failure

---

### `DELETE /api/menu/:id`

Deletes a menu item permanently. **Requires `role: 'admin'`.**

**Response `204`** — no body

**Response `401`** / **`403`** — auth failure

---

## Orders

### `GET /api/orders`

Returns orders. Admin gets all orders; non-admin gets their own orders only. **Requires authentication.**

**Response `200`**
```json
[
  {
    "id": "orderId",
    "customerId": "uid",
    "guestName": "Alice",
    "items": [{ "id": "itemId", "name": "Grilled Chicken", "price": 14.99, "quantity": 2 }],
    "total": 29.98,
    "note": "No onions",
    "status": "pending",
    "createdAt": "2024-01-15T12:00:00.000Z"
  }
]
```

Ordered by `createdAt` descending.

**Response `401`** — missing/invalid token

---

### `GET /api/orders/:id`

Returns a single order. Owner or admin only. **Requires authentication.**

**Response `200`** — same shape as a single element from `GET /api/orders`

**Response `403`** — authenticated but not the owner and not admin
**Response `404`** — order not found

---

### `POST /api/orders`

Places a new order. Authenticated users (including anonymous) can place orders. Rate-limited to **20 requests/minute** per IP. **Requires authentication** (anonymous auth accepted).

**Request body**
```json
{
  "items": [
    { "id": "itemId", "name": "Grilled Chicken", "price": 14.99, "quantity": 2 }
  ],
  "note": "No onions",
  "total": 29.98,
  "guestName": "Alice"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `items` | array | yes | min 1 item |
| `items[].id` | string | yes | |
| `items[].name` | string | yes | |
| `items[].price` | number | yes | positive |
| `items[].quantity` | number | yes | positive integer |
| `note` | string | no | max 500 chars; defaults to `""` |
| `total` | number | yes | positive |
| `guestName` | string | no | max 100 chars; included for anonymous/guest orders |
| `tableNumber` | number | no | integer 1–20; omit for takeout orders |

**Response `201`**
```json
{ "orderId": "newOrderId" }
```

**Side effects:**
- Creates `orders/{orderId}` in Firestore
- If `tableNumber` is provided: finds the `confirmed` reservation for that table on today's date (if any) and updates its status to `'seated'` — picks the booking whose time is closest to now if multiple exist
- If the user is not anonymous: creates a `notifications/{id}` doc for the customer (`type: 'order_placed'`)
- Sends FCM push notification to all admin users

**Response `400`** — Zod validation failure
**Response `401`** — missing/invalid token

---

### `PATCH /api/orders/:id/status`

Updates order status. **Requires `role: 'admin'`.**

**Request body**
```json
{ "status": "confirmed" }
```

Valid status values: `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`

**Response `200`**
```json
{ "orderId": "abc123", "status": "confirmed" }
```

**Side effects:**
- Updates `orders/{id}.status` in Firestore; also writes `completedAt` (ISO timestamp) when status is `'completed'` — used by the reservation service to determine when a table is free
- Creates a `notifications/{id}` doc for the customer (`type: 'status_update'`)
- Sends FCM push notification to the customer

**Response `400`** — invalid status value
**Response `401`** / **`403`** — auth failure
**Response `404`** — order not found

---

## Notifications

### `GET /api/notifications`

Returns the current user's notifications, newest first, limited to 50. **Requires authentication.**

**Response `200`**
```json
[
  {
    "id": "notifId",
    "recipientId": "uid",
    "orderId": "orderId",
    "type": "status_update",
    "message": "Your order is now ready.",
    "read": false,
    "createdAt": "2024-01-15T12:05:00.000Z"
  }
]
```

> **Note:** The frontend does **not** use this endpoint. Notifications are read in real-time via Firestore `onSnapshot` in `NotificationContext`. This endpoint exists for completeness and potential future use.

**Response `401`** — missing/invalid token

---

### `PATCH /api/notifications/:id/read`

Marks a single notification as read. **Requires authentication.** Only the notification's `recipientId` can mark it read.

**Response `200`**
```json
{ "id": "notifId", "read": true }
```

**Response `403`** — notification belongs to a different user
**Response `404`** — notification not found

---

### `PATCH /api/notifications/read-all`

Marks all unread notifications as read for the current user, using a Firestore batch write. **Requires authentication.**

**Response `200`**
```json
{ "updated": 3 }
```

> **Routing note:** This route is registered before `/:id/read` in `notifications.js` to prevent `/read-all` being treated as an `:id` value. Do not reorder these route registrations.

---

## Auth

### `POST /api/auth/set-admin`

Grants admin role to a Firebase user by UID. Rate-limited to **10 requests/minute** per IP. **No Firebase token required** — protected only by `SETUP_SECRET`. This endpoint is intentionally open so the first admin can be bootstrapped.

**Request body**
```json
{
  "uid": "firebase-user-uid",
  "secret": "<value of SETUP_SECRET env var>"
}
```

**Response `200`**
```json
{ "message": "User <uid> is now an admin. Ask them to log out and back in." }
```

**Side effects:**
- Sets Firebase custom claim `{ role: 'admin' }` on the user's token (via Admin SDK)
- Sets `users/{uid}.role = 'admin'` in Firestore

**Response `400`** — missing `uid` or `secret`
**Response `403`** — `secret` does not match `SETUP_SECRET`

> **Security note:** This endpoint must not be called in production scripts or exposed in client code. The `SETUP_SECRET` must be rotated or the endpoint disabled after initial admin setup.

---

## Logs

### `POST /api/logs/client`

Accepts a client-side error report and logs it server-side via Winston. **Requires authentication.**

**Request body**
```json
{
  "message": "Uncaught TypeError: ...",
  "stack": "TypeError: ...\n  at ...",
  "url": "https://example.com/menu"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `message` | string | yes | max 1000 chars |
| `stack` | string | no | max 5000 chars |
| `url` | string | no | max 500 chars |

**Response `204`** — no body

---

### `GET /api/logs/health`
### `GET /health` (redirects to `/api/logs/health`)

Health probe. No authentication required.

**Response `200`** — all services healthy
```json
{
  "status": "ok",
  "uptime": 3600.12,
  "timestamp": "2024-01-15T13:00:00.000Z",
  "services": {
    "firestore": "ok",
    "auth": "ok"
  }
}
```

**Response `503`** — one or more services unreachable
```json
{
  "status": "degraded",
  "error": "<Firebase error message>"
}
```

The probe makes real calls: `db.collection('_health').limit(1).get()` and `auth.listUsers(1)`. These count toward Firebase quota.

---

## Reservations

### `GET /api/tables`

Returns the restaurant's table configuration. **No authentication required.**

**Response `200`**
```json
{
  "tables": [
    { "number": 1, "capacity": 2 },
    { "number": 2, "capacity": 2 },
    { "number": 3, "capacity": 4 }
  ]
}
```
Returns `{ "tables": [] }` if no tables have been configured yet. Tables are always returned sorted by `number` ascending.

---

### `POST /api/tables`

Adds a new table to the restaurant configuration. **Requires `role: 'admin'`.**

**Request body**
```json
{ "number": 7, "capacity": 4 }
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `number` | integer | yes | 1–99; must be unique |
| `capacity` | integer | yes | 1–50 |

**Response `201`** — full updated tables array (same shape as `GET /api/tables`)

**Response `400`** — validation failure
**Response `401`** / **`403`** — auth failure
**Response `409`** — table number already exists

---

### `PUT /api/tables/:number`

Updates the capacity of an existing table. **Requires `role: 'admin'`.**

**Request body**
```json
{ "capacity": 6 }
```

**Response `200`** — full updated tables array

**Response `400`** — validation failure
**Response `401`** / **`403`** — auth failure
**Response `404`** — table not found

---

### `DELETE /api/tables/:number`

Removes a table from the restaurant configuration. **Requires `role: 'admin'`.**

The client UI prevents deletion of occupied or reserved tables; the server does not enforce this constraint — callers must check status before calling.

**Response `200`** — full updated tables array

**Response `401`** / **`403`** — auth failure
**Response `404`** — table not found

---

### `GET /api/reservations`

Returns all reservations, ordered by date ascending. **Requires `role: 'admin'`.**

**Response `200`**
```json
[
  {
    "id": "resId",
    "customerId": null,
    "name": "Alice",
    "date": "2026-06-20",
    "time": "19:00",
    "partySize": 2,
    "tableNumber": 3,
    "status": "confirmed",
    "notes": "",
    "createdAt": "2026-06-17T10:00:00.000Z"
  }
]
```

**Response `401`** / **`403`** — auth failure

---

### `PATCH /api/reservations/:id`

Reschedules a reservation by updating its date and/or time. The table assignment stays unchanged. Validates that the new slot is within opening hours and that the table is free (excluding the reservation's own current slot). **Requires `role: 'admin'`.**

**Request body**
```json
{ "date": "2026-06-21", "time": "19:30" }
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `date` | string | yes | YYYY-MM-DD |
| `time` | string | yes | HH:MM (24-hour); must be within opening hours |

**Response `200`** — updated reservation document (same shape as `GET /api/reservations` items)

**Response `400`** — invalid format or time outside opening hours
**Response `401`** / **`403`** — auth failure
**Response `404`** — reservation not found
**Response `409`** — table not available at the requested time

---

### `PATCH /api/reservations/:id/status`

Updates a reservation's status. **Requires `role: 'admin'`.**

**Request body**
```json
{ "status": "seated" }
```

Valid status values: `confirmed`, `seated`, `completed`, `cancelled`

| Status | Meaning |
|--------|---------|
| `confirmed` | Booking accepted, guest not yet arrived |
| `seated` | Guest arrived, table occupied |
| `completed` | Table cleared and available |
| `cancelled` | Booking cancelled |

**Response `200`** — updated reservation document

**Response `400`** — invalid status
**Response `401`** / **`403`** — auth failure
**Response `404`** — reservation not found

---

`POST /api/reservations` is called by the FastAPI AI agent via httpx — it is not called directly by the browser. It requires no client Firebase token; Express writes to Firestore using its own Admin SDK credentials. `POST /api/reservations` has no `verifyToken` middleware — it relies on network-level isolation (FastAPI is an internal service). `customerId` on created reservations is `null` since no user session token is present in the AI chat flow.

`GET /api/reservations/availability` is a public utility endpoint. The AI agent no longer calls it — availability checking and booking are now a single atomic operation in `POST /api/reservations`.

### `GET /api/reservations/availability`

Checks whether a table is available for a given slot. Considers both existing reservations and active orders (for today's date, a table is unavailable until the next 30-minute boundary after `order.createdAt + 90 min`). **No authentication required.**

**Query parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | yes | YYYY-MM-DD |
| `time` | string | yes | HH:MM (24-hour) |
| `partySize` | number | yes | 1–8 |

**Response `200` — available**
```json
{ "available": true, "table": { "number": 3, "capacity": 4 } }
```

**Response `200` — not available**
```json
{ "available": false }
```

**Response `400`** — missing or invalid query parameters

---

### `POST /api/reservations`

Books a table in one atomic operation. Tries the requested time first; if unavailable, automatically searches for the nearest free slot at ±30/60/90/120-minute intervals (bounded to 10:00–22:00, same date). Called by the AI `reserve_table_tool`. **No authentication required** — Express writes to Firestore via Admin SDK.

Availability considers both existing reservations and active orders:
- Active order on a table → table blocked until `nextHalfHour(createdAt + 90 min)`
- Completed order on a table → table blocked until `nextHalfHour(completedAt)`

**Request body**
```json
{
  "name": "Alice",
  "date": "2026-06-20",
  "time": "19:00",
  "partySize": 2,
  "notes": "Window seat if possible"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–100 chars |
| `date` | string | yes | YYYY-MM-DD |
| `time` | string | yes | HH:MM |
| `partySize` | number | yes | 1–8 |
| `notes` | string | no | max 500 chars; defaults to `""` |

**Response `201` — booked at requested time**
```json
{
  "id": "abc123",
  "name": "Alice",
  "date": "2026-06-20",
  "time": "19:00",
  "partySize": 2,
  "tableNumber": 3,
  "status": "confirmed",
  "notes": "Window seat if possible",
  "customerId": null,
  "createdAt": "2026-06-20T17:30:00.000Z"
}
```

**Response `201` — booked at an alternative time** (requested slot unavailable)
```json
{
  "id": "abc123",
  "name": "Alice",
  "date": "2026-06-20",
  "time": "19:30",
  "requestedTime": "19:00",
  "partySize": 2,
  "tableNumber": 3,
  "status": "confirmed",
  "notes": "",
  "customerId": null,
  "createdAt": "2026-06-20T17:30:00.000Z"
}
```

`requestedTime` is only present when the booked `time` differs from what was requested. The AI uses this field to inform the guest of the change.

**Side effects:**
- Writes `reservations/{id}` to Firestore
- Reads `config/tables` and recent orders to determine the best available table

**Response `409`** — no available tables found within ±120 min of the requested time on that date
**Response `400`** — Zod validation failure

---

## AI Chat

All AI endpoints are served by Express and proxied internally to the FastAPI AI agent at `http://localhost:8000`. The browser never calls FastAPI directly.

### `POST /api/ai/chat`

Sends a message to the AI assistant and streams the response as Server-Sent Events. **No authentication required** — the Firebase token is optional and carried in the request body for order operations.

**Request body**
```json
{
  "message": "What are today's specials?",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "firebase_token": "<Firebase ID token>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | yes | User message text |
| `session_id` | string | yes | UUID generated by the client; identifies the conversation; persists across messages in the same session |
| `firebase_token` | string | no | Firebase ID token (anonymous or registered); required only if the user wants the AI to place an order on their behalf — not needed for reservations |

**Response** — `text/event-stream` (Server-Sent Events)

Each token is emitted as:
```
event: token
data: {"text": "Today"}

event: token
data: {"text": "'s specials include..."}

event: done
data:
```

Stream ends when `event: done` is received. Errors from the agent are emitted as a final `event: token` with an error message before `event: done`.

**Response `502`** — FastAPI is unreachable (Express proxy failed)

---

### `DELETE /api/ai/session/:session_id`

Clears all conversation memory for a given session. Call this when the user starts a new chat. **No authentication required.**

**Response `200`**
```json
{ "cleared": "550e8400-e29b-41d4-a716-446655440000", "existed": true }
```

`existed` is `false` if the session ID was not found (e.g. already cleared or never used).

---

### `GET /api/ai/health`

Health probe for the FastAPI AI service. **No authentication required.**

**Response `200`**
```json
{ "status": "ok" }
```

**Response `502`** — FastAPI is unreachable

# Test Plan

## Current State

**As of the engineering audit: zero test files exist.** `server/package.json` lists `jest` as the test runner, but `jest` and `supertest` are not installed as devDependencies. The first task is to make `npm test` runnable before writing any tests.

### Setup required before any tests can run

```bash
# server/
npm install --save-dev jest supertest

# Add jest config to server/package.json:
# "jest": { "testEnvironment": "node" }

# client/ (when frontend tests are added)
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
```

---

## Unit Test Strategy (Server)

Unit tests cover individual service functions in isolation. External dependencies (Firebase Admin SDK) are mocked at the module level.

**Location:** `server/src/services/__tests__/`

**Mocking approach:** Jest module mocks for `../firebase` — replace `db`, `auth`, and `messaging` with Jest mock implementations. Do not mock Zod schemas.

### `orderService` tests

| Test | Input | Expected |
|------|-------|----------|
| `placeOrder` — happy path (anonymous) | valid data, `isAnonymous: true` | calls `db.collection('orders').add()`, skips notification doc, calls `sendToAdmins` |
| `placeOrder` — happy path (registered) | valid data, `isAnonymous: false` | calls `db.collection('orders').add()`, calls `notificationService.createNotification`, calls `sendToAdmins` |
| `placeOrder` — Firestore write fails | `db.add` rejects | propagates the error |
| `updateOrderStatus` — happy path | valid orderId, valid status | calls `orderRef.update`, calls `createNotification`, calls `sendToUser` |
| `updateOrderStatus` — order not found | `orderRef.get()` returns `exists: false` | throws `AppError('Order not found', 404)` |
| `updateOrderStatus` — FCM fails | `sendToUser` rejects | does NOT propagate (FCM is non-fatal) |

### `notificationService` tests

| Test | Input | Expected |
|------|-------|----------|
| `createNotification` — happy path | valid payload | calls `db.collection('notifications').add()` with correct fields including `read: false` and `createdAt` |
| `createNotification` — Firestore fails | `db.add` rejects | propagates the error |

### `fcm` tests

| Test | Input | Expected |
|------|-------|----------|
| `sendToUser` — user has FCM token | `uid` with token in Firestore | calls `messaging.send()` |
| `sendToUser` — user has no FCM token | `users/{uid}.fcmToken` is undefined | returns early, does not call `messaging.send()` |
| `sendToUser` — messaging fails | `messaging.send()` rejects | logs a warning, does NOT throw |
| `sendToAdmins` — no admin tokens | no users with `role: 'admin'` | returns early |
| `sendToAdmins` — messaging fails | `sendEachForMulticast` rejects | logs a warning, does NOT throw |

### `AppError` tests

| Test | Expected |
|------|----------|
| `new AppError('msg', 404)` | `.message === 'msg'`, `.statusCode === 404`, `.isOperational === true` |
| `new AppError('msg')` | `.statusCode === 500` (default) |

---

## Integration Test Strategy (Server)

Integration tests send real HTTP requests to the Express app. Firebase Admin SDK is mocked at the module boundary. Zod validation is exercised with real payloads (not mocked).

**Location:** `server/src/routes/__tests__/`

**Setup:**
```js
// jest.setup.js
jest.mock('../services/firebase', () => ({
  auth: { verifyIdToken: jest.fn(), ... },
  db: { collection: jest.fn(), ... },
  messaging: { send: jest.fn(), ... },
}));
```

### `POST /api/orders`

| Scenario | Setup | Expected response |
|----------|-------|-------------------|
| No Authorization header | — | `401` |
| Invalid token | `verifyIdToken` rejects | `401` |
| Valid token, valid body | mock returns order doc ID | `201 { orderId }` |
| Valid token, missing `items` | — | `400` |
| Valid token, `items: []` (empty array) | — | `400` |
| Valid token, `total: -1` (negative) | — | `400` |
| Valid token, `note` over 500 chars | — | `400` |

### `PATCH /api/orders/:id/status`

| Scenario | Setup | Expected response |
|----------|-------|-------------------|
| No token | — | `401` |
| Valid customer token (role: 'customer') | — | `403` |
| Admin token, invalid status | body `{ status: 'cooked' }` | `400` |
| Admin token, valid status, order exists | mock `orderRef.get()` → exists | `200 { orderId, status }` |
| Admin token, valid status, order not found | mock `orderRef.get()` → not exists | `404` |

### `POST /api/menu`

| Scenario | Expected response |
|----------|-------------------|
| No token | `401` |
| Customer token | `403` |
| Admin token, valid body | `201` with created item |
| Admin token, `price: 0` | `400` |
| Admin token, `name: ""` | `400` |

### `POST /api/auth/set-admin`

| Scenario | Expected response |
|----------|-------------------|
| Wrong secret | `403` |
| Missing `uid` | `400` |
| Correct secret, valid uid | `200` with message |

### `GET /api/logs/health`

| Scenario | Expected response |
|----------|-------------------|
| Firestore and Auth respond | `200 { status: 'ok', ... }` |
| Firestore throws | `503 { status: 'degraded', ... }` |

---

## Frontend Test Strategy

**Status: TBD — test infrastructure not yet installed.**

**Framework:** Vitest + `@testing-library/react` + `@testing-library/user-event`

**Location:** `client/src/__tests__/` or co-located `*.test.tsx` files

**Mocking approach:** Mock `services/firebase.ts` and `services/api.ts` at the module level.

### Planned component tests

| Component | What to test |
|-----------|-------------|
| `CartContext` | ADD increases quantity; REMOVE deletes item; UPDATE_QTY to 0 removes item; CLEAR empties cart; localStorage is updated |
| `PrivateRoute` | Renders children when role matches; redirects to `/login` when no user; redirects to `/menu` when wrong role |
| `OrderStatusBadge` | Renders correct CSS class for each status; renders fallback for unknown status |
| `MenuCard` | Shows "Add to cart" when item not in cart; shows quantity controls when item is in cart; does not render controls when `available: false` |
| `CheckoutPage` | Navigates away when cart is empty; shows guest name field when user is anonymous; shows error banner on failed order |

### Planned hook tests

| Hook | What to test |
|------|-------------|
| `useMenu` | Returns data from `api.get('/api/menu')` |
| `usePlaceOrder` | Calls `api.post('/api/orders')` with correct payload |

---

## Manual Testing Checklist

Run this checklist before merging any significant change.

### Guest flow
- [ ] Navigate to `/menu` — menu loads with category filter tabs
- [ ] Filter by each category — only items from that category appear
- [ ] Add item to cart — cart badge increments; item appears in CartDrawer
- [ ] Increase/decrease quantity in CartDrawer
- [ ] Clear cart — CartDrawer shows empty state
- [ ] Navigate to `/checkout` with items — order summary displays; guest name field appears
- [ ] Submit order without guest name — validation error appears
- [ ] Submit order with guest name — order is created; success screen with order ID
- [ ] Click "Track this order" — navigates to `/orders/:id` and shows live status
- [ ] Close and reopen browser — cart is still populated (localStorage)
- [ ] Navigate to `/orders/:id` with a real order ID — status stepper shows correct step

### Registered customer flow
- [ ] Register at `/register` with name, email, password — redirected to `/menu`
- [ ] Navigate to `/orders` — order history displays
- [ ] Place an order while logged in — notification bell increments
- [ ] Open notification bell — notification message appears
- [ ] Mark as read — notification background changes
- [ ] Mark all as read — all notifications lose unread styling
- [ ] Logout → redirected to `/menu`; NavBar no longer shows "My Orders"

### Admin flow
- [ ] Sign in with a non-admin Google account — see "not authorised" error with UID displayed
- [ ] Call `POST /api/auth/set-admin` with the UID + SETUP_SECRET — 200 response
- [ ] Sign out and back in — land on `/admin/orders`
- [ ] Place a guest order in another tab — admin orders page updates in real-time without refresh
- [ ] Click "Confirm" — order status changes immediately
- [ ] Click through all status steps — status badge updates correctly
- [ ] Cancel an active order — order moves to cancelled tab
- [ ] Navigate to `/admin/menu` — all menu items listed
- [ ] Add a new item — appears in the list
- [ ] Toggle availability — reflects change immediately
- [ ] Edit an item — form pre-fills correctly; save updates the row
- [ ] Delete an item — removed from the list

### Push notifications
- [ ] Grant notification permission in the browser when prompted
- [ ] Place a new order as a guest — admin receives a browser push notification
- [ ] Admin updates order status — customer (registered) receives a browser push notification
- [ ] If VAPID key is not configured — no push notifications; no errors logged

### Error states
- [ ] Start dev server with invalid Firebase credentials — server logs clear error, does not crash silently
- [ ] Disconnect from internet, try to load menu — error message displays (not infinite spinner)
- [ ] Visit `/admin/orders` as a guest — redirected to `/login`
- [ ] Visit `/orders` as an anonymous user — redirected to `/login`

---

## Edge Cases

| Scenario | Expected behaviour |
|----------|-------------------|
| Place order, close tab immediately | Order is created in Firestore; guest can track via `/orders/:id` using saved orderId from localStorage |
| Admin grants role to non-existent UID | Firebase Admin SDK throws; server returns 500 |
| User with stale FCM token | `messaging.send` fails with `invalid-registration-token`; FCM service logs a warning; order write succeeds |
| Two admins update same order simultaneously | Last writer wins (Firestore document update); both will see the final state via `onSnapshot` |
| Cart localStorage is corrupted JSON | `CartContext` catches the parse error and initialises with an empty array |
| `onSnapshot` loses connection | Firebase SDK buffers and retries automatically; existing local state is shown until reconnected |
| Admin tries to advance a `completed` order | `STATUS_FLOW['completed']` is undefined; the "Confirm" button is not rendered |
| `note` field with 500-character string | Accepted by Zod (`max(500)`); stored and displayed correctly |
| Menu item with `imageUrl: ""` | `MenuCard` conditionally renders the image element — `{item.imageUrl && <img />}` |
| Registered user places order, then signs out | Order remains in Firestore; anonymous tracking via localStorage orderId still works |

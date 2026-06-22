# Known Issues

Issues are categorised by severity. All were identified during the engineering audit (June 2026) and reflect the state of the codebase before the TypeScript migration and backend refactor are complete.

---

## Critical

### KI-001 · `npm test` fails immediately — Jest is not installed

**Location:** `server/package.json`
**Detail:** `scripts.test` is `"jest --runInBand"`, but neither `jest` nor `supertest` appear in `devDependencies`. Running `npm test` exits with `command not found`.
**Fix:** `npm install --save-dev jest supertest` in `server/`, then add `"jest": { "testEnvironment": "node" }` to `server/package.json`.

---

### KI-002 · Zero test coverage

**Location:** entire project
**Detail:** No test files exist anywhere (outside of `node_modules`). There are no unit tests for services, no integration tests for routes, and no frontend component tests.
**Fix:** See `docs/test-plan.md` for the full strategy. Start with the test setup in KI-001, then add at minimum the `POST /api/orders` integration test as a proof-of-life.

---

## High

### KI-003 · Business logic mixed into route handlers

**Location:** `server/src/routes/orders.js`
**Detail:** The `POST /` handler (order placement) and `PATCH /:id/status` handler each contain Firestore writes, notification creation, and FCM calls inline. The notification `db.collection('notifications').add(...)` pattern is duplicated across both handlers with no shared abstraction.
**Fix:** Extract `server/src/services/orderService.js` and `server/src/services/notificationService.js` as planned in the refactor. Route handlers should only parse, call a service, and respond.

---

### KI-004 · `App.jsx` uses a default export (violates project convention)

**Location:** `client/src/App.jsx:17`
**Detail:** `export default function App()` contradicts the CLAUDE.md rule "Named exports only from component files." All other component files use named exports. This will cause a linter error once ESLint with the no-default-export rule is added.
**Fix:** Change to `export function App()` and update `main.jsx` import from `import App from './App'` to `import { App } from './App'`.

---

### KI-005 · `OrdersPage` silently discards the error state

**Location:** `client/src/pages/OrdersPage.jsx`
**Detail:** `useMyOrders()` returns `{ orders, loading, error }`. `OrdersPage` uses `loading` and `orders` but never checks or renders `error`. A Firestore permission error or network failure causes the page to show an empty order list with no explanation.
**Fix:** Add an error banner below the page heading, consistent with the pattern used in `AdminOrdersPage`.

---

### KI-006 · Empty-cart redirect is a side effect inside render

**Location:** `client/src/pages/CheckoutPage.jsx:28-31`
**Detail:**
```jsx
if (items.length === 0 && !placedOrder) {
  navigate('/menu', { replace: true });
  return null;
}
```
Calling `navigate()` during render is a side effect. In React 18 Strict Mode, the render function may run twice, causing a double navigation. This can also trigger a React warning about state updates during render.
**Fix:** Move to a `useEffect`:
```ts
useEffect(() => {
  if (items.length === 0 && !placedOrder) navigate('/menu', { replace: true });
}, [items.length, placedOrder]);
```

---

### KI-007 · FCM tokens never cleared on logout

**Location:** `client/src/contexts/AuthContext.jsx` / `server/src/services/fcm.js`
**Detail:** When a user signs out, their FCM token remains in `users/{uid}.fcmToken`. If the same browser/device is used by a different user, the old token is still in Firestore and will receive push notifications until it is overwritten on the next login of any user on that device.
**Fix:** Call `setDoc(doc(db, 'users', uid), { fcmToken: null }, { merge: true })` in the `logout` function in `AuthContext`, and update `fcm.js` to skip `null` tokens.

---

## Medium

### KI-008 · `sendToAdmins` performs a full Firestore read on every order placement

**Location:** `server/src/services/fcm.js:21-35`
**Detail:** Every call to `sendToAdmins` queries `db.collection('users').where('role', '==', 'admin').get()`. For a busy restaurant this runs on every new order, and the result is never cached.
**Fix (short-term):** Cache the admin tokens in memory with a short TTL (e.g. 5 minutes). **Fix (long-term):** Use an FCM topic (`/topics/admins`) and subscribe admin users to the topic on login.

---

### KI-009 · Available menu items filtered client-side only

**Location:** `client/src/pages/MenuPage.jsx:13-14`
**Detail:** `GET /api/menu` returns all items including `available: false`. The client filters them out in `MenuPage`. This wastes bandwidth and exposes unavailable item data to any client that calls the API directly.
**Fix:** Add `.where('available', '==', true)` to the Firestore query in `server/src/routes/menu.js` `GET /` handler. Keep the client-side filter as a safety net.

---

### KI-010 · No pagination on orders lists

**Location:** `client/src/hooks/useOrders.js` — `useAllOrders` and `useMyOrders`
**Detail:** Both functions subscribe to Firestore collections without a `limit()`. As orders accumulate, Firestore will send increasingly large snapshots on every update, causing high read counts and slower renders.
**Fix:** Add `limit(50)` initially. For the admin queue, "active" orders (non-completed, non-cancelled) could be the primary view, with a separate paginated history view for completed orders.

---

### KI-011 · `window.confirm` used for delete confirmation in AdminMenuPage

**Location:** `client/src/pages/AdminMenuPage.jsx:66-68`
**Detail:** `window.confirm('Delete this menu item?')` is not accessible (cannot be focused or styled), is blocked in iframes, and is suppressed in some headless test environments.
**Fix:** Replace with a small controlled modal using existing Tailwind styles (consistent with the existing form modal pattern in the same file).

---

### KI-012 · `AdminMenuPage.handleDelete` has no error handling

**Location:** `client/src/pages/AdminMenuPage.jsx:66-69`
**Detail:** `await deleteItem(id)` is called with no try/catch. If the Firestore delete fails (e.g. permissions error), the UI shows no feedback and the item remains in the list with no explanation.
**Fix:** Wrap in try/catch and set the `error` state with a user-facing message.

---

### KI-013 · Log files have no rotation configured

**Location:** `server/src/utils/logger.js`
**Detail:** Winston writes to `logs/error.log` and `logs/combined.log` with `winston.transports.File`. There is no size limit or rotation. On a long-running server these files will grow unbounded.
**Fix:** Replace `winston.transports.File` with `winston-daily-rotate-file` and set a `maxFiles` retention policy.

---

## Low

### KI-014 · `src/mocks/` is dead code

**Location:** `client/src/mocks/` (referenced in CLAUDE.md as "unused in-memory store, safe to delete")
**Detail:** The directory exists but is not imported anywhere in the application.
**Fix:** Delete the directory.

---

### KI-015 · Health check makes live Firebase calls on every probe

**Location:** `server/src/routes/logs.js:33-42`
**Detail:** `GET /health` calls `db.collection('_health').limit(1).get()` and `auth.listUsers(1)` on every request. If a load balancer probes every 30 seconds, these operations count toward Firebase read and Admin SDK quotas indefinitely.
**Fix:** Cache the health result in memory for 30–60 seconds and only re-probe if the cache is stale, or return 200 immediately and move the probe to a separate internal health route not exposed to the load balancer.

---

### KI-016 · No startup validation of required environment variables

**Location:** `server/src/server.js`
**Detail:** If `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY` are missing, `firebase-admin` throws a cryptic initialisation error at the first API call rather than at startup.
**Fix:** Add a guard at the top of `server.js`:
```js
const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'SETUP_SECRET'];
for (const key of required) {
  if (!process.env[key]) { console.error(`Missing env var: ${key}`); process.exit(1); }
}
```

---

### KI-017 · `imageUrl` field is present in the UI but absent from CLAUDE.md collection schema

**Location:** `client/src/components/MenuCard.jsx:9`, `client/src/pages/AdminMenuPage.jsx:9`
**Detail:** Both `MenuCard` and the admin form include `imageUrl`, but the `menus` collection schema in CLAUDE.md did not originally list it. CLAUDE.md has since been updated, but the field is not validated server-side in `routes/menu.js` — the Zod schema accepts it but defaults to `""` if missing.
**Fix (already partially done):** The field is now in CLAUDE.md. No server-side change required as the Zod schema already handles it.

---

### KI-018 · No `.gitignore` confirmed in the project

**Location:** project root
**Detail:** A `.gitignore` file was not found during the codebase scan. Without it, `node_modules/`, `.env`, `logs/`, and `client/dist/` may be committed accidentally.
**Fix:** Create a `.gitignore` at the project root with at minimum:
```
node_modules/
.env
.env.local
logs/
client/dist/
```

---

## Resolved / Tracked Elsewhere

| ID | Note |
|----|------|
| KI-017 (partial) | `imageUrl` added to CLAUDE.md — documentation now matches code |
| — | TypeScript migration tracked in the main refactor plan (see CLAUDE.md) |
| — | Backend service layer extraction tracked in the main refactor plan |

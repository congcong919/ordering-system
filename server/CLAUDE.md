# Express backend conventions

## Service layer pattern

Route handlers are thin — they only: parse the request body (Zod), call a service function, send the response, and forward errors via `next(err)`.

Business logic lives in `src/services/`:

| Service | Key functions |
|---------|--------------|
| `orderService.js` | `placeOrder(uid, isAnonymous, data)` — creates Firestore order doc, calls `notificationService`, calls FCM; `updateOrderStatus(orderId, status)` — updates doc, creates notification, sends FCM |
| `notificationService.js` | `createNotification(payload)` — single function for all `db.collection('notifications').add(...)` writes |
| `reservationService.js` | `getAllReservations()` — all docs ordered by date; `checkAvailability(date, time, partySize)` — reads `config/tables` + confirmed bookings; `createReservation(data)` — assigns table, writes Firestore doc; `updateReservationStatus(id, status)` — admin lifecycle update; `updateReservation(id, { date, time })` — admin reschedule (validates opening hours, excludes own current slot from conflict check) |
| `fcm.js` | `sendToUser(uid, payload)` — looks up FCM token from `users/{uid}`; `sendToAdmins(payload)` — queries all admin tokens |

Zod schemas stay co-located in the route file (input-validation only, not business logic).

## Route conventions

- Thin routes: parse → service call → respond → `next(err)` on failure
- Zod parse errors: catch `ZodError` and call `next(new AppError(err.errors[0].message, 400))`
- Auth: apply `verifyToken` then `requireRole('admin')` where needed — never skip both
- New routes must be mounted in `app.js` and documented in `docs/api-contract.md`

## Key middleware

| Middleware | What it does |
|-----------|-------------|
| `verifyToken` | Extracts Bearer token, calls `auth.verifyIdToken`, attaches claims to `req.user` |
| `requireRole('admin')` | Checks `req.user.role`; returns 403 if unmatched — must come after `verifyToken` |
| `errorHandler` | Final middleware; logs via Winston; returns `{ error: message }`; masks non-operational errors as 500 |

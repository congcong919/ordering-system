# Development Workflow

## Prerequisites

- Node.js 18 or later
- A Firebase project with Firestore, Authentication, and (optionally) Cloud Messaging enabled
- Firebase service account JSON (for the server)

---

## First-Time Setup

### 1. Install dependencies

```bash
# From project root
cd client && npm install
cd ../server && npm install
```

### 2. Configure environment variables

**Server:** copy `server/.env.example` (if it exists) or create `server/.env`:
```
PORT=3001
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n"
SETUP_SECRET=some-long-random-string
```

> `FIREBASE_PRIVATE_KEY` — paste the raw key with literal `\n` characters. The `server/src/services/firebase.js` initialisation replaces `\\n` with real newlines automatically.

**Client:** copy `client/.env.local.example` or create `client/.env.local`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=        # optional — enables push notifications
VITE_API_BASE_URL=              # leave empty in dev (Vite proxy handles it)
```

Find all values in Firebase Console → Project Settings → General.

### 3. Enable Firebase services

In Firebase Console:
- **Authentication → Sign-in providers** → enable **Email/Password** (customers) and **Google** (admins)
- **Firestore Database** → create in production mode
- **Firestore Database → Rules** → paste the contents of `server/firestore.rules` and publish

### 4. Seed the menu

Firestore does not auto-create the `menus` collection. Add at least one item manually:

Firebase Console → Firestore Database → Data → **Start collection** → Collection ID: `menus` → **Add document** → Auto-ID → add fields:

| Field | Type | Example |
|-------|------|---------|
| `name` | string | `Grilled Chicken` |
| `price` | number | `14.99` |
| `category` | string | `Main` |
| `description` | string | `Served with seasonal vegetables` |
| `imageUrl` | string | *(leave empty or add a URL)* |
| `available` | boolean | `true` |

### 5. Grant the first admin

1. Start both servers (see below)
2. Navigate to `http://localhost:5173/login`
3. Sign in with the Google account that should be admin → you will see an error with a UID
4. Call the set-admin endpoint (replace values):
   ```bash
   curl -X POST http://localhost:3001/api/auth/set-admin \
     -H "Content-Type: application/json" \
     -d '{"uid":"THE-UID-FROM-THE-ERROR","secret":"value-of-SETUP_SECRET"}'
   ```
5. Sign out and sign back in with Google → you should land on `/admin/orders`

---

## Running the Project

Both processes must run simultaneously in separate terminals.

**Terminal 1 — Backend:**
```bash
cd server
npm run dev          # nodemon watches src/, restarts on changes
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev          # Vite dev server on http://localhost:5173
```

Vite proxies all `/api/*` requests to `http://localhost:3001` automatically (configured in `client/vite.config.ts`).

---

## Making Changes

### Frontend changes (TypeScript migration in progress)

- New files: use `.tsx` for React components, `.ts` for non-JSX files
- Run `npx tsc --noEmit` from `client/` after changes to type-check without building
- Tailwind classes: all utility classes are in `client/tailwind.config.js` — the `brand-*` colour is defined there
- Domain types: add or update in `client/src/types/index.ts` first, then implement

### Backend changes

- Route handlers must stay thin — business logic belongs in `server/src/services/`
- New Firestore collections must be added to `server/firestore.rules` and documented in `docs/technical-design.md`
- New endpoints must be documented in `docs/api-contract.md`
- Run `npm test` from `server/` before committing

### Changing Firestore security rules

1. Edit `server/firestore.rules`
2. Test the rules locally using the Firebase Local Emulator Suite (TBD — not yet configured)
3. In Firebase Console → Firestore Database → Rules → paste the new rules and click **Publish**
4. Update `docs/technical-design.md` to reflect the change

### Adding environment variables

- Server: add to `server/.env` and document in CLAUDE.md and `docs/technical-design.md`
- Client: `VITE_` prefix is required for Vite to expose variables to the browser
- Add startup validation in `server/src/server.js` if the variable is required at boot (TBD)

---

## Running Tests

```bash
# Server tests (requires jest + supertest installed)
cd server
npm test

# Run a single test file
cd server
npx jest <pattern>    # e.g. npx jest orderService

# Frontend type-check
cd client
npx tsc --noEmit

# Frontend tests (TBD — Vitest not yet installed)
cd client
npm test
```

See `docs/test-plan.md` for the full test strategy and the setup steps required before tests can run.

---

## Build for Production

```bash
# Frontend — outputs to client/dist/
cd client
npm run build

# Server — no build step; runs directly from src/
# In production, use:
cd server
npm start            # node src/server.js (no nodemon)
```

Set `VITE_API_BASE_URL` in the client build environment to the deployed server URL.

The `client/public/firebase-messaging-sw.js` service worker file must be served at the root of the client domain for push notifications to work.

---

## Code Review Checklist

Before submitting changes for review:

- [ ] `npx tsc --noEmit` passes with no errors (frontend changes)
- [ ] `npm test` passes (server changes)
- [ ] No new `console.log` added (use `logger` on server; `POST /api/logs/client` on client)
- [ ] No `any` types introduced (TypeScript)
- [ ] New domain types added to `src/types/index.ts`, not inlined
- [ ] New API endpoints documented in `docs/api-contract.md`
- [ ] Firestore rule changes published and documented
- [ ] Business logic added to a service file, not a route handler
- [ ] Rate limiting is still active on orders and auth routes
- [ ] `onSnapshot` error handlers are present on any new snapshot subscriptions

---

## Project Constraints

- The backend **stays CommonJS** (`require`). Do not convert to ESM.
- The Firestore Security Rules file (`server/firestore.rules`) is the source of truth for access control — always update it when adding collections or changing access patterns.
- `VITE_API_BASE_URL` must be empty in dev. Setting it to `http://localhost:3001` also works (CORS allows all localhost ports in dev), but the empty value + Vite proxy is preferred.
- The Firebase service worker (`public/firebase-messaging-sw.js`) and `client/dist/firebase-messaging-sw.js` are separate — the `dist` copy is generated at build time; the `public` copy is used in dev.

# Requirements

## Product Goal

Provide a lightweight, QR-code-friendly food ordering experience for a single restaurant. Customers can browse the menu and submit an order without creating an account. Registered customers can track their full order history. Admins manage the live order queue and the menu from a dedicated dashboard, receiving real-time push notifications for new orders.

---

## User Stories

### All Visitors

- As a visitor, I can land on a homepage that introduces the restaurant, so I understand what is being offered before browsing the menu.
- As a visitor, I can see a hero section with the restaurant name, a short tagline, and two calls-to-action: **"View our menu"** and **"Order Now"**.
- As a visitor, I can read a brief "About" or restaurant introduction section on the landing page, so I know the restaurant's story or highlights.
- As a visitor, the landing page has a **logo-only header** (brand mark and name, no links, no cart, no admin controls) — it is otherwise a fully standalone page. The full navigation bar only appears once the visitor navigates to an ordering or account page.
- As a visitor, I can click **"View our menu"** to open a read-only menu display page (`/menu`) that shows all available items grouped by category, with **no** cart, add-to-cart buttons, or ordering functionality — it is for browsing only.
- As a visitor, the `/menu` page uses the same **shared pre-ordering layout** as the landing page: a logo-only header (brand mark only, no nav links, no cart, no admin controls), the same dark/gradient visual style, and consistent typography — both pages feel like one cohesive pre-ordering experience before any ordering begins.
- As a visitor, I can click **"Order Now"** to go directly to the full ordering menu (`/order-menu`) where I can add items to my cart and proceed to checkout.
- As a visitor, I can see a floating chatbot button on every page, so I can access AI assistance at any time.
- As a visitor, I can ask the AI assistant about menu items, today's specials, opening hours, and the restaurant's location without navigating away from the current page.
- As a visitor, I can ask the AI assistant to check the availability of a table and make a reservation through the chat window.
- As a visitor, I can see a **"Make a Reservation"** section on the landing page that invites me to use the AI assistant to book a table.
- As a visitor, I can click a prompt in the reservation section to open the AI assistant chatbot, which collects: full name, preferred date, preferred time, number of guests, and any special requests — then confirms the booking with a reference number.
- As a visitor, I can paste an order ID into the chat window to check the live status of my order without navigating to the order detail page.

### Guest (unauthenticated / anonymous)

- As a guest, I can browse the full menu grouped by category, so I can decide what to order.
- As a guest, I can filter the menu by category using tab buttons, so I can quickly find what I want.
- As a guest, I can add items to a cart and adjust quantities, so I can build my order before committing.
- As a guest, I can proceed to checkout and enter my name, so the kitchen knows who to call.
- As a guest, I can add a special instruction note to my order (e.g. allergies, preferences).
- As a guest, I can place an order without creating an account, so there is no friction.
- As a guest, I am redirected to an order-tracking page immediately after placing my order.
- As a guest, I can see the live status of my order (pending → confirmed → preparing → ready → completed).
- As a guest, my cart persists across page refreshes (stored in `localStorage`).

### Registered Customer

All guest stories, plus:

- As a registered customer, I can create an account with email and password.
- As a registered customer, I can view a history of all my past orders.
- As a registered customer, I can click any past order to see its full detail and current status.
- As a registered customer, I receive in-app notifications when my order status changes.
- As a registered customer, I can mark notifications as read individually or all at once.

### Admin

- As an admin, I can sign in with my Google account.
- As an admin, I am blocked from signing in if my Google account has not been granted the admin role.
- As an admin, I can see all orders in real-time on a live queue page, auto-updating without refresh.
- As an admin, I can filter orders by status (all / pending / confirmed / preparing / ready / completed / cancelled).
- As an admin, I can advance an order to the next status in one click (Confirm → Start Preparing → Mark Ready → Complete).
- As an admin, I can cancel any active order.
- As an admin, I receive a push notification (FCM) when a new order is placed.
- As an admin, I can add, edit, and delete menu items.
- As an admin, I can toggle a menu item's availability on or off without deleting it.
- As an admin, I can see the real-time status of all tables (occupied or available) without refreshing.
- As an admin, I can switch between two views using tabs: "All" (live occupied/available status for today, with active orders and Add Order) and "Reservations" (all upcoming timeslots per table, with reschedule/cancel/advance actions).
- As an admin, I can see all upcoming reservation timeslots per table, sorted by date and time.
- As an admin, I can reschedule a reservation by changing its date and time from the table card.
- As an admin, I can cancel a reservation from the table card.
- As an admin, I can advance a reservation through its lifecycle (Confirmed → Seated → Completed) from the table card.
- When a dine-in order is placed at a table, any confirmed reservation for that table today is automatically advanced to "Seated".

---

## In-Scope Features

| Feature | Notes |
|---------|-------|
| Landing page | Standalone page with a logo-only header (brand mark, no links or cart); hero with "View our menu" → `/menu` and "Order Now" → `/order-menu`; full navbar appears only on ordering/account pages |
| Read-only menu page (`/menu`) | Uses the shared pre-ordering layout (logo-only header, dark/gradient style); shows all available items by category with no cart, no add-to-cart buttons, and no ordering functionality; prominent "Order Now" CTA links to `/order-menu` |
| Shared pre-ordering layout | A reusable layout wrapping both the landing page (`/`) and the read-only menu page (`/menu`); provides the logo-only header and consistent dark/gradient visual style; entirely separate from `MainLayout` which owns the full navbar, cart, and auth controls |
| AI chatbot (live) | Floating button visible on all pages; opens a streaming chat panel powered by LangChain + DeepSeek via the FastAPI microservice |
| Menu info via chat | Ask about any menu item, category, ingredients, or allergens — AI fetches live data from the ordering system |
| Today's specials via chat | AI surfaces items marked `isSpecial: true` from the live menu |
| Opening hours & location via chat | Answered from the restaurant config — no tool call needed |
| Table availability & reservation via chat | AI checks Firestore `reservations` for conflicts, assigns smallest available table, writes booking, and returns reference ID |
| Order status via chat | User provides an order ID; AI calls `GET /api/orders/:id` with their Firebase token and reports the current status |
| Reservation section (landing page) | Landing page section that promotes table booking via the AI assistant; clicking the CTA opens the chatbot panel |
| Public menu browsing | Category filter, available-item-only display |
| Persistent cart | `localStorage`, survives refresh |
| Guest checkout | Silent anonymous Firebase auth on submit |
| Registered customer accounts | Email/password, via `/register` |
| Order placement | Via Express API; Firestore doc created server-side |
| Order status tracking | Firestore `onSnapshot` — real-time, no polling |
| Admin order queue | Live view with status tabs and one-click status advance |
| Admin menu management | CRUD for menu items including availability toggle |
| Admin table management | Two-tab view — **All**: live table grid showing today's real-time status (occupied / available only — reservations do not affect this status) with active orders and Add Order per card; no timeslots shown; **Reservations**: all tables showing upcoming confirmed/seated timeslots with reschedule, cancel, and advance actions; no status badge; "No upcoming reservations" placeholder for empty tables; auto-seats confirmed reservation when a dine-in order is placed at that table |
| In-app notifications | Firestore `onSnapshot` for registered users and admins |
| Browser push notifications | Firebase Cloud Messaging (requires VAPID key and user permission) |
| Admin provisioning | One-time `POST /api/auth/set-admin` guarded by `SETUP_SECRET` |
| Health check endpoint | `GET /health` probes Firestore and Auth liveness |
| Client-side error logging | `POST /api/logs/client` forwards browser errors to Winston |
| Rate limiting | 20 req/min on orders, 10 req/min on auth endpoints |

---

## Out-of-Scope Features

The following are explicitly not part of this system:

| Feature | Reason / Notes |
|---------|---------------|
| Payment processing | No payment gateway integration; no payment status field on orders |
| Table management / QR-per-table | Assigning seated orders to specific tables via QR code — TBD; distinct from the reservation flow |
| Guest reservation self-service | Guests cannot cancel or reschedule a booking via the chatbot — admin handles this via the Tables page |
| Email / SMS booking confirmation | No messaging integration |
| Delivery tracking | System assumes dine-in or counter pickup |
| Loyalty / rewards programme | Not planned |
| Kitchen Display System (KDS) | Admin orders page serves this purpose at small scale |
| Multi-tenant / multi-restaurant | Single restaurant only |
| Customer login via Google / social | Only Google is available for admins; customers use email/password |
| Order editing after submission | Not supported; cancel and re-order |
| Scheduled orders | Not supported |
| Inventory management | Menu availability is a boolean flag only |
| Reporting / analytics dashboard | TBD |
| Email notifications | Only push (FCM) notifications are implemented |
| SMS notifications | Out of scope |


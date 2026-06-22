# Frontend conventions

## TypeScript

**Domain types** — all defined in `src/types/index.ts`, imported from there. Never inline a domain type in a component or hook.

Key types:
```ts
type OrderStatus       = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled';
interface MenuItem     { id: string; name: string; price: number; category: string; description: string; imageUrl?: string; available: boolean; allergens?: string[]; isSpecial?: boolean; }
interface CartItem     extends MenuItem { quantity: number; }
interface OrderItem    { id: string; name: string; price: number; quantity: number; }
interface Order        { id: string; customerId: string; guestName?: string; tableNumber?: number; items: OrderItem[]; total: number; note: string; status: OrderStatus; createdAt: string; }
interface Reservation  { id: string; customerId: string | null; name: string; date: string; time: string; partySize: number; tableNumber: number; status: ReservationStatus; notes: string; createdAt: string; }
interface Notification { id: string; recipientId: string; orderId: string; type: string; message: string; read: boolean; createdAt: string; }
interface ChatMessage  { id: string; role: 'user' | 'assistant'; content: string; timestamp: number; streaming?: boolean; }
```

`allergens` and `isSpecial` on `MenuItem` are optional — existing Firestore docs without these fields remain valid. The AI agent reads them if present.

**Component props** — define `interface Props` co-located in the component file (not in `types/index.ts`).

**Contexts** — each context exports a typed interface for its value (e.g. `AuthContextValue`). Context is created with `createContext<AuthContextValue | null>(null)`; consumer hooks throw if used outside the provider.

**`import.meta.env`** — typed via `src/vite-env.d.ts` (Vite generates this; do not delete it).

**Strict mode** — `tsconfig.json` uses `"strict": true`. Do not use `any`; prefer `unknown` with a type guard if the shape is truly unknown.

## React patterns

- All chat state belongs in `useChat.ts`. Components receive only what they need via props — they do not own state.
- `BrowseLayout` (logo-only header) wraps `/` and `/menu`; `MainLayout` (navbar + cart drawer) wraps all other routes.
- Do not use `dangerouslySetInnerHTML` to render any LLM-generated content — use `react-markdown` + `rehype-sanitize`.
- Real-time Firestore reads use `onSnapshot` directly in hooks (`useOrders`, `useAllOrders`, `useAllReservations`) — never poll through Express.
- Table config mutations (`useAddTable`, `useUpdateTable`, `useDeleteTable`) invalidate the `['tables']` React Query key so `useTables` refetches automatically.

## Chat UI components

The AI chat panel was migrated from `ai-agent/frontend/` into this app. See `docs/plan-migrate-chat-frontend.md` for the full migration record.

| Component / file | Role |
|---|---|
| `hooks/useChat.ts` | Chat state machine — messages list, streaming flag, session UUID, abort controller; `sendMessage`, `stopStreaming`, `newChat` |
| `services/chatApi.ts` | `streamChat(message, sessionId)` — SSE stream to `POST /api/ai/chat`; `clearChatSession(sessionId)` — `DELETE /api/ai/session/:id` |
| `components/ChatbotButton.tsx` | Floating button; opens/closes the chat panel overlay |
| `components/ChatPanel.tsx` | Message list container; auto-scrolls; shows empty state with quick actions |
| `components/MessageBubble.tsx` | Single message — user or assistant; renders markdown via `react-markdown` + `rehype-sanitize`; shows `TypingIndicator` while streaming |
| `components/InputBar.tsx` | Textarea input + send/stop button; Enter sends, Shift+Enter inserts newline |
| `components/QuickActions.tsx` | Suggestion chips shown before first message; maps to actual AI tools (specials, menu, book table, check order, hours) |
| `components/TypingIndicator.tsx` | Animated three-dot indicator shown while the assistant is streaming |

**API routing note:** `chatApi.ts` calls `/api/ai/chat` and `/api/ai/session/:id` — these go through Express (not FastAPI directly). Vite proxies `/api/*` to Express; Express proxies `/api/ai/*` to FastAPI. Do not call FastAPI from the browser.

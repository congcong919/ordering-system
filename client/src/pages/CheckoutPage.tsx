import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlaceOrder } from '../hooks/useOrders';
import { useTables } from '../hooks/useReservations';
import { OrderItem } from '../types';

const LAST_ORDERS_KEY = 'lastOrderIds';

interface PlacedOrder {
  orderId: string;
  items: OrderItem[];
  total: number;
  tableNumber?: number;
}

function saveOrderToHistory(orderId: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(LAST_ORDERS_KEY) || '[]') as string[];
    const updated = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, 10);
    localStorage.setItem(LAST_ORDERS_KEY, JSON.stringify(updated));
  } catch {}
}

export function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user, isAnonymous, loginAnonymously } = useAuth();
  const { mutateAsync: placeOrder, isPending } = usePlaceOrder();
  const navigate = useNavigate();

  const { data: tablesData } = useTables();
  const tables = tablesData?.tables ?? [];

  const [note, setNote] = useState('');
  const [guestName, setGuestName] = useState('');
  const [tableNumber, setTableNumber] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    if (items.length === 0 && !placedOrder) {
      navigate('/menu', { replace: true });
    }
  }, [items.length, placedOrder, navigate]);

  const needsName = !user || isAnonymous;

  async function handleOrder() {
    setError('');
    if (needsName && !guestName.trim()) {
      setError('Please enter your name so we know who to call when your order is ready.');
      return;
    }
    try {
      if (!user) await loginAnonymously();

      const snapshot: OrderItem[] = items.map(({ id, name, price, quantity }) => ({ id, name, price, quantity }));

      const { orderId } = await placeOrder({
        items: snapshot,
        note,
        total,
        ...(needsName && { guestName: guestName.trim() }),
        ...(tableNumber !== '' && { tableNumber }),
      });

      saveOrderToHistory(orderId);
      setPlacedOrder({ orderId, items: snapshot, total, ...(tableNumber !== '' && { tableNumber }) });
      clearCart();
    } catch {
      setError('Failed to place order. Please try again.');
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (placedOrder) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">Order placed!</h1>
          <p className="text-stone-500 text-sm">We've received your order and it's being prepared.</p>
          <p className="text-xs text-stone-400 mt-2 font-mono">#{placedOrder.orderId.slice(-8)}</p>
          {placedOrder.tableNumber && (
            <p className="text-sm font-medium text-stone-700 mt-1">Table {placedOrder.tableNumber}</p>
          )}
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-stone-800 mb-3">Your order</h2>
          <ul className="divide-y divide-stone-50">
            {placedOrder.items.map((item, idx) => (
              <li key={idx} className="py-3 flex justify-between text-sm">
                <span className="text-stone-700">{item.name} × {item.quantity}</span>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-semibold text-stone-900 pt-3 mt-1 border-t border-stone-100">
            <span>Total</span>
            <span>${placedOrder.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            to="/order-menu"
            className="block w-full py-3 rounded-xl bg-brand-500 text-white font-semibold text-center hover:bg-brand-600 transition"
          >
            Order more items
          </Link>
          <Link
            to={`/orders/${placedOrder.orderId}`}
            className="block w-full py-3 rounded-xl border border-stone-200 text-stone-700 font-medium text-center hover:bg-stone-50 transition text-sm"
          >
            Track this order
          </Link>
        </div>
      </main>
    );
  }

  // ── Checkout form ───────────────────────────────────────────────────────────
  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900 mb-6">Checkout</h1>

      {needsName && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Your name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="So we know who to call"
          />
        </div>
      )}

      {tables.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-4">
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Table number <span className="text-stone-400 font-normal">(optional — leave blank for takeout)</span>
          </label>
          <select
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">Select a table…</option>
            {tables.map((t: { number: number; capacity: number }) => (
              <option key={t.number} value={t.number}>
                Table {t.number} — seats up to {t.capacity}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-4">
        <h2 className="font-semibold text-stone-800 mb-3">Order summary</h2>
        <ul className="divide-y divide-stone-50">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex justify-between text-sm">
              <span className="text-stone-700">{item.name} × {item.quantity}</span>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-semibold text-stone-900 pt-3 mt-1 border-t border-stone-100">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-6">
        <label className="block text-sm font-medium text-stone-700 mb-1">Special instructions (optional)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Allergies, preferences…"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      <button
        onClick={handleOrder}
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition disabled:opacity-60"
      >
        {isPending ? 'Placing order…' : `Place order · $${total.toFixed(2)}`}
      </button>

      {needsName && (
        <p className="text-center text-xs text-stone-400 mt-3">
          No account needed.{' '}
          <a href="/login" className="text-brand-500 hover:underline">Sign in</a> to save order history.
        </p>
      )}
    </main>
  );
}

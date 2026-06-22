import { useState } from 'react';
import { useAllOrders, useUpdateOrderStatus } from '../hooks/useOrders';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { Order, OrderStatus } from '../types';

interface StatusFlowEntry {
  next: OrderStatus;
  nextLabel: string;
}

const STATUS_FLOW: Partial<Record<OrderStatus, StatusFlowEntry>> = {
  pending:   { next: 'confirmed',  nextLabel: 'Confirm' },
  confirmed: { next: 'preparing',  nextLabel: 'Start preparing' },
  preparing: { next: 'ready',      nextLabel: 'Mark ready' },
  ready:     { next: 'completed',  nextLabel: 'Complete' },
};

const ALL_TABS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;
type Tab = typeof ALL_TABS[number];

const TAB_COLORS: Record<string, string> = {
  pending:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-orange-50 text-orange-700 border-orange-200',
  ready:     'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-stone-50 text-stone-500 border-stone-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  all:       'bg-stone-50 text-stone-600 border-stone-200',
};

export function AdminOrdersPage() {
  const { orders, loading, error } = useAllOrders();
  const { mutate: updateStatus, isPending } = useUpdateOrderStatus();
  const [tab, setTab] = useState<Tab>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab);

  function advance(order: Order) {
    const next = STATUS_FLOW[order.status]?.next;
    if (!next) return;
    setUpdatingId(order.id);
    updateStatus({ orderId: order.id, status: next }, {
      onSettled: () => setUpdatingId(null),
    });
  }

  function cancel(order: Order) {
    setUpdatingId(order.id);
    updateStatus({ orderId: order.id, status: 'cancelled' }, {
      onSettled: () => setUpdatingId(null),
    });
  }

  const activeCount = orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Live Orders</h1>
          <p className="text-sm text-stone-400 mt-0.5">{activeCount} active · real-time</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {ALL_TABS.map((t) => {
          const count = t === 'all' ? orders.length : orders.filter((o) => o.status === t).length;
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                  : `${TAB_COLORS[t]} hover:opacity-80`
              }`}
            >
              <span className="capitalize">{t}</span>
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/25' : 'bg-white/60'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-100">
          Failed to load orders: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-stone-400 font-medium">No orders in this status.</p>
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((order) => {
          const flow = STATUS_FLOW[order.status];
          const busy = updatingId === order.id || isPending;

          return (
            <li key={order.id} className="bg-white rounded-2xl border border-stone-100 shadow-card hover:shadow-card-hover transition-shadow p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <OrderStatusBadge status={order.status} />
                    {order.tableNumber && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-stone-800 text-white rounded-md px-2 py-0.5">
                        Table {order.tableNumber}
                      </span>
                    )}
                    {order.guestName && (
                      <span className="font-semibold text-stone-700 text-sm">{order.guestName}</span>
                    )}
                    <span className="text-xs text-stone-300">·</span>
                    <span className="text-xs text-stone-400 font-mono">#{order.id.slice(-8)}</span>
                    {order.createdAt && (
                      <>
                        <span className="text-xs text-stone-300">·</span>
                        <span className="text-xs text-stone-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Items */}
                  <div className="flex flex-wrap gap-1.5">
                    {(order.items || []).map((item, idx) => (
                      <span key={idx} className="inline-flex items-center text-xs bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-1 text-stone-700">
                        {item.name}
                        <span className="ml-1 text-stone-400">×{item.quantity}</span>
                      </span>
                    ))}
                  </div>

                  {order.note && (
                    <p className="mt-2 text-xs text-stone-400 italic bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 inline-block">
                      "{order.note}"
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  {order.total != null && (
                    <span className="font-bold text-stone-800 text-lg">
                      ${Number(order.total).toFixed(2)}
                    </span>
                  )}

                  <div className="flex gap-2">
                    {flow && (
                      <button
                        onClick={() => advance(order)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition disabled:opacity-50 shadow-sm"
                      >
                        {busy ? '…' : flow.nextLabel}
                      </button>
                    )}
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => cancel(order)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

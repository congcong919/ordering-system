import { Link } from 'react-router-dom';
import { useMyOrders } from '../hooks/useOrders';
import { OrderStatusBadge } from '../components/OrderStatusBadge';

export function OrdersPage() {
  const { orders, loading, error } = useMyOrders();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900 mb-6">My Orders</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          Failed to load orders: {error}
        </div>
      )}

      {!error && orders.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="mb-4">No orders yet.</p>
          <Link to="/order-menu" className="text-brand-600 font-medium hover:underline">Browse the menu →</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-stone-100 shadow-sm p-5 hover:border-brand-300 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 truncate">
                      {(order.items || []).map((i) => i.name).join(', ')}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <OrderStatusBadge status={order.status} />
                    {order.total != null && (
                      <span className="text-sm font-semibold text-stone-700">
                        ${Number(order.total).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

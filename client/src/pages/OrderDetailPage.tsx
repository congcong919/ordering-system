import { useParams, Link } from 'react-router-dom';
import { useOrder } from '../hooks/useOrders';
import { OrderStatusBadge } from '../components/OrderStatusBadge';

const STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'] as const;

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { order, loading, error } = useOrder(id);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-2">Could not load order: {error}</p>
        <p className="text-stone-400 text-xs">Make sure Firestore security rules are deployed.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-stone-400">
        Order not found.{' '}
        <Link to="/orders" className="text-brand-600 hover:underline">Back to orders</Link>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const currentStep = STEPS.indexOf(order.status as typeof STEPS[number]);

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/orders" className="text-sm text-stone-400 hover:text-stone-600 transition">
            ← Back to orders
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Order details</h1>
          <p className="text-xs text-stone-400 mt-0.5">#{order.id}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Status stepper */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 mb-5">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Progress</h2>
          <div className="relative">
            {/* Line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-100" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-brand-500 transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%`, right: 'auto' }}
            />

            <div className="relative flex justify-between">
              {STEPS.map((step, idx) => {
                const done = idx <= currentStep;
                return (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition ${
                        done ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      {done && idx < currentStep ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs capitalize ${done ? 'text-brand-600 font-medium' : 'text-stone-400'}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5 text-red-700 text-sm font-medium">
          This order was cancelled.
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-stone-800 mb-3">Items</h2>
        <ul className="divide-y divide-stone-50">
          {(order.items || []).map((item, idx) => (
            <li key={idx} className="py-3 flex justify-between text-sm">
              <span className="text-stone-700">{item.name} × {item.quantity}</span>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {order.total != null && (
          <div className="flex justify-between font-semibold text-stone-900 pt-3 mt-1 border-t border-stone-100">
            <span>Total</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>
        )}
      </div>

      {order.note && (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <h2 className="font-semibold text-stone-800 mb-1">Note</h2>
          <p className="text-sm text-stone-600">{order.note}</p>
        </div>
      )}
    </main>
  );
}

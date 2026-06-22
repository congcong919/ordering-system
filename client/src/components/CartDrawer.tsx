import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: Props) {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  function handleCheckout() {
    onClose();
    navigate('/checkout');
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl z-50 flex flex-col drawer-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-stone-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-stone-50 px-5">
              {items.map((item) => (
                <li key={item.id} className="py-4 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 truncate">{item.name}</p>
                    <p className="text-sm text-stone-500">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-stone-300 flex items-center justify-center text-stone-600 hover:border-brand-500 transition"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-1 text-stone-300 hover:text-red-400 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-5 py-4 border-t border-stone-100 space-y-3">
              <div className="flex justify-between font-semibold text-stone-900">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition"
              >
                Proceed to checkout
              </button>
              <button
                onClick={clearCart}
                className="w-full py-2 text-sm text-stone-400 hover:text-red-400 transition"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

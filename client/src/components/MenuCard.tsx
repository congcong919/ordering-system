import { MenuItem } from '../types';
import { useCart } from '../contexts/CartContext';

interface Props {
  item: MenuItem;
}

export function MenuCard({ item }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const cartEntry = items.find((i) => i.id === item.id);

  return (
    <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover border border-stone-100 overflow-hidden flex flex-col transition-shadow duration-200">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover" />
      ) : (
        <div className="h-44 w-full bg-gradient-to-br from-brand-50 to-amber-50 flex items-center justify-center text-4xl select-none">
          🍴
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-semibold text-stone-900 leading-snug">{item.name}</h3>
          <span className="text-brand-600 font-bold whitespace-nowrap text-sm">
            ${Number(item.price).toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-stone-400 line-clamp-2 mb-3">{item.description}</p>
        )}

        {item.category && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-300 mb-3">
            {item.category}
          </span>
        )}

        <div className="mt-auto">
          {!item.available ? (
            <span className="text-xs text-stone-300 font-medium">Currently unavailable</span>
          ) : cartEntry ? (
            <div className="flex items-center justify-between bg-stone-50 rounded-xl p-1">
              <button
                onClick={() => updateQuantity(item.id, cartEntry.quantity - 1)}
                className="w-8 h-8 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-stone-600 hover:border-brand-400 hover:text-brand-600 transition font-semibold text-lg leading-none"
              >
                −
              </button>
              <span className="font-bold text-stone-800 w-6 text-center">{cartEntry.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, cartEntry.quantity + 1)}
                className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition font-semibold text-lg leading-none"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => addItem(item)}
              className="w-full py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:scale-95 transition-all"
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

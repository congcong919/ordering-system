import { useState } from 'react';
import { useMenu } from '../hooks/useMenu';
import { MenuCard } from '../components/MenuCard';
import { MenuItem } from '../types';

const ALL = 'All';

export function MenuPage() {
  const { data, isLoading, error } = useMenu();
  const items: MenuItem[] = data ?? [];
  const [activeCategory, setActiveCategory] = useState(ALL);

  const categories: string[] = [ALL, ...new Set(items.map((i) => i.category).filter(Boolean))];
  const visible: MenuItem[] = activeCategory === ALL
    ? items.filter((i) => i.available !== false)
    : items.filter((i) => i.available !== false && i.category === activeCategory);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">Failed to load menu. Please refresh.</div>
    );
  }

  return (
    <>
      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-amber-400">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <p className="text-brand-100 text-sm font-semibold uppercase tracking-widest mb-2">Welcome to OrderUp</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 leading-tight">
            Fresh food,<br className="sm:hidden" /> made for you.
          </h1>
          <p className="text-brand-100 text-base sm:text-lg max-w-md">
            Pick your favourites, place your order, and we'll take care of the rest.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 fade-in">
        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-7">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-brand-400 hover:text-brand-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🍽</div>
            <p className="text-stone-400 font-medium">No items in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

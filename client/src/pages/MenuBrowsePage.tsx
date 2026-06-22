import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMenu } from '../hooks/useMenu';
import { MenuItem } from '../types';

const ALL = 'All';

export function MenuBrowsePage() {
  const { data, isLoading, error } = useMenu();
  const items: MenuItem[] = data ?? [];
  const [activeCategory, setActiveCategory] = useState(ALL);

  const categories: string[] = [ALL, ...new Set(items.map((i) => i.category).filter(Boolean))];
  const visible: MenuItem[] = activeCategory === ALL
    ? items.filter((i) => i.available !== false)
    : items.filter((i) => i.available !== false && i.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Dark banner (logo from BrowseLayout overlays this) ───────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 pt-28 pb-14 px-6">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-5xl mx-auto text-center">
          <span className="inline-block text-brand-400 text-sm font-semibold uppercase tracking-[0.2em] mb-4">
            Explore
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 leading-tight">
            Our Menu
          </h1>
          <p className="text-stone-400 text-lg max-w-md mx-auto">
            Fresh ingredients, made to order — browse before you decide.
          </p>
        </div>
      </section>

      {/* ── Menu content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 bg-stone-50 px-6 py-10 fade-in">
        <div className="max-w-6xl mx-auto">

          {/* Category filter */}
          {!isLoading && !error && categories.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-8">
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

          {isLoading && (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="text-center py-20 text-red-500">Failed to load menu. Please refresh.</div>
          )}

          {!isLoading && !error && visible.length === 0 && (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🍽</div>
              <p className="text-stone-400 font-medium">No items in this category.</p>
            </div>
          )}

          {!isLoading && !error && visible.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visible.map((item) => (
                <BrowseCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── CTA banner ───────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-brand-500 to-amber-400 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white mb-3">Ready to order?</h2>
          <p className="text-brand-100 mb-8">
            Place your order in under a minute — no account needed.
          </p>
          <Link
            to="/order-menu"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-brand-600 font-bold text-lg hover:bg-brand-50 active:scale-95 transition-all shadow-lg"
          >
            Order Now
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-500 py-8 px-6 text-center text-sm">
        <p className="font-semibold text-stone-300 mb-1">
          🍽 <span className="text-white">Order</span><span className="text-brand-400">Up</span>
        </p>
        <p>Fresh food, made for you.</p>
      </footer>

    </div>
  );
}

interface BrowseCardProps {
  item: MenuItem;
}

function BrowseCard({ item }: BrowseCardProps) {
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
          <p className="text-xs text-stone-400 line-clamp-2 mb-2">{item.description}</p>
        )}
        {item.category && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-300 mt-auto">
            {item.category}
          </span>
        )}
      </div>
    </div>
  );
}

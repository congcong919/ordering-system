import { Link } from 'react-router-dom';

function openReservationChatbot() {
  window.dispatchEvent(new CustomEvent('open-chatbot', { detail: { mode: 'reservation' } }));
}

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 min-h-[90vh]">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative text-center px-6 max-w-3xl mx-auto fade-in">
          <span className="inline-block text-brand-400 text-sm font-semibold uppercase tracking-[0.2em] mb-6">
            Welcome to OrderUp
          </span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.08] mb-6">
            Good food,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-amber-300">
              made to order.
            </span>
          </h1>
          <p className="text-stone-400 text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Fresh ingredients, cooked when you order. No waiting in line —
            pick what you love and we'll have it ready for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/order-menu"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-lg transition-all shadow-lg shadow-brand-500/30"
            >
              Order Now
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              to="/menu"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-stone-600 text-stone-300 hover:border-stone-400 hover:text-white font-semibold text-lg transition-all"
            >
              View our menu
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-stone-600">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── About / Intro ────────────────────────────────────────────────────── */}
      <section id="about" className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">Our story</p>
            <h2 className="text-4xl font-extrabold text-stone-900 mb-4">A kitchen built on passion</h2>
            <p className="text-stone-500 text-lg max-w-2xl mx-auto leading-relaxed">
              We started with one simple belief: great food should be simple to order.
              Every dish is prepared fresh to order using quality ingredients sourced
              from local suppliers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            {FEATURES.map(({ icon, title, body }) => (
              <div key={title} className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-2xl mb-4">
                  {icon}
                </div>
                <h3 className="font-bold text-stone-900 mb-1">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-stone-100 pt-12">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-extrabold text-brand-500 mb-1">{value}</p>
                <p className="text-stone-400 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── View menu CTA ────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-brand-500 to-amber-400 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white mb-3">Curious what's on the menu?</h2>
          <p className="text-brand-100 mb-8">
            Browse our full menu before you order — no account needed.
          </p>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-brand-600 font-bold text-lg hover:bg-brand-50 active:scale-95 transition-all shadow-lg"
          >
            View our menu
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Make a Reservation ───────────────────────────────────────────────── */}
      <section className="bg-stone-900 py-20 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-10">
          {/* Text */}
          <div className="flex-1 text-center sm:text-left">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Book a table</p>
            <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight">
              Make a<br />reservation
            </h2>
            <p className="text-stone-400 text-base leading-relaxed max-w-md">
              Planning to visit us? Let our AI assistant guide you through
              reserving a table in just a few quick questions — no phone call needed.
            </p>
          </div>

          {/* Card */}
          <div className="bg-stone-800 border border-stone-700 rounded-3xl p-8 w-full sm:w-80 shrink-0 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-amber-400 flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg shadow-brand-500/30">
              🤖
            </div>
            <h3 className="text-white font-bold text-lg mb-2">AI Reservation Assistant</h3>
            <p className="text-stone-400 text-sm mb-6 leading-relaxed">
              Our assistant will ask you a few quick questions about your visit.
            </p>

            <div className="space-y-2 text-left mb-6">
              {RESERVATION_STEPS.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-stone-400 text-sm">
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={openReservationChatbot}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold transition-all shadow-md shadow-brand-500/30"
            >
              Reserve a table
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-500 py-8 px-6 text-center text-sm">
        <p className="font-semibold text-stone-300 mb-1">
          🍽 <span className="text-white">Order</span><span className="text-brand-400">Up</span>
        </p>
        <p>Fresh food, made for you.</p>
      </footer>

    </div>
  );
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'Fast ordering',
    body: 'Add items to your cart and place your order in seconds — no account required.',
  },
  {
    icon: '🥗',
    title: 'Fresh every time',
    body: 'Every dish is prepared to order with fresh, quality ingredients.',
  },
  {
    icon: '📍',
    title: 'Live tracking',
    body: 'Watch your order go from pending to ready in real time on any device.',
  },
];

const STATS = [
  { value: '100%', label: 'Fresh ingredients' },
  { value: '<5 min', label: 'Average order time' },
  { value: '0', label: 'Hidden fees' },
  { value: '24/7', label: 'Always open' },
];

const RESERVATION_STEPS = [
  { icon: '👤', label: 'Your name' },
  { icon: '📅', label: 'Preferred date & time' },
  { icon: '👥', label: 'Number of guests' },
  { icon: '✨', label: 'Special requests' },
];

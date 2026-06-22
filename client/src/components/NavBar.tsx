import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { NotificationBell } from './NotificationBell';

interface Props {
  onCartOpen: () => void;
}

export function NavBar({ onCartOpen }: Props) {
  const { user, role, isAnonymous, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/menu');
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors px-1 py-0.5 ${
      isActive ? 'text-brand-600' : 'text-stone-500 hover:text-stone-900'
    }`;

  const isRegisteredCustomer = user && !isAnonymous && role === 'customer';
  const isAdmin = user && role === 'admin';
  const isGuest = !user || isAnonymous;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link to="/order-menu" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">🍽</span>
          <span className="font-extrabold text-stone-900 text-lg tracking-tight">
            Order<span className="text-brand-500">Up</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          <NavLink to="/order-menu" className={linkClass}>Menu</NavLink>

          {isRegisteredCustomer && (
            <NavLink to="/orders" className={linkClass}>My Orders</NavLink>
          )}

          {isAdmin && (
            <>
              <NavLink to="/admin/orders" className={linkClass}>Orders</NavLink>
              <NavLink to="/admin/tables" className={linkClass}>Tables</NavLink>
              <NavLink to="/admin/menu" className={linkClass}>Manage Menu</NavLink>
            </>
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {(isRegisteredCustomer || isAdmin) && <NotificationBell />}

          {/* Cart — guests and customers */}
          {!isAdmin && (
            <button
              onClick={onCartOpen}
              className="relative p-2 rounded-xl hover:bg-stone-100 transition-colors"
              aria-label="Open cart"
            >
              <svg className="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>
          )}

          {isGuest ? (
            <Link
              to="/login"
              className="ml-1 text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-100"
            >
              Admin
            </Link>
          ) : (
            <button
              onClick={handleLogout}
              className="ml-1 text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

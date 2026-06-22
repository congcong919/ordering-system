import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PrivateRoute } from './components/PrivateRoute';
import { NavBar } from './components/NavBar';
import { CartDrawer } from './components/CartDrawer';
import { ChatbotButton } from './components/ChatbotButton';
import { LandingPage } from './pages/LandingPage';
import { MenuBrowsePage } from './pages/MenuBrowsePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MenuPage } from './pages/MenuPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminMenuPage } from './pages/AdminMenuPage';
import { AdminTablesPage } from './pages/AdminTablesPage';

function BrowseLayout() {
  return (
    <div className="relative">
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="text-2xl">🍽</span>
          <span className="font-extrabold text-white text-xl tracking-tight">
            Order<span className="text-brand-400">Up</span>
          </span>
        </Link>
      </header>
      <Outlet />
    </div>
  );
}

function MainLayout() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <NavBar onCartOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <CartProvider>
      <NotificationProvider>
        <ChatbotButton />

        <Routes>
          {/* Pre-ordering pages — logo-only header, dark/gradient style */}
          <Route element={<BrowseLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/menu" element={<MenuBrowsePage />} />
          </Route>

          {/* Ordering and account pages — full navbar + cart */}
          <Route element={<MainLayout />}>
            <Route path="/order-menu" element={<MenuPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route
              path="/orders"
              element={<PrivateRoute requiredRole="customer"><OrdersPage /></PrivateRoute>}
            />
            <Route
              path="/admin/orders"
              element={<PrivateRoute requiredRole="admin"><AdminOrdersPage /></PrivateRoute>}
            />
            <Route
              path="/admin/menu"
              element={<PrivateRoute requiredRole="admin"><AdminMenuPage /></PrivateRoute>}
            />
            <Route
              path="/admin/tables"
              element={<PrivateRoute requiredRole="admin"><AdminTablesPage /></PrivateRoute>}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </CartProvider>
  );
}

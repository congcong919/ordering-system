import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-stone-100 transition"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6 text-stone-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-5-5.917V5a1 1 0 10-2 0v.083A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-stone-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <span className="font-semibold text-stone-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto divide-y divide-stone-50">
            {notifications.length === 0 && (
              <li className="py-8 text-center text-sm text-stone-400">No notifications</li>
            )}
            {notifications.slice(0, 20).map((n) => (
              <li
                key={n.id}
                className={`px-4 py-3 cursor-pointer hover:bg-stone-50 transition ${!n.read ? 'bg-brand-50' : ''}`}
                onClick={() => markAsRead(n.id)}
              >
                <p className="text-sm text-stone-800">{n.message}</p>
                {n.createdAt && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

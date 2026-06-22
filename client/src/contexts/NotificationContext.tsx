import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
        docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setNotifications(docs);
      },
      () => setNotifications([])
    );
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  }

  async function markAllAsRead(): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

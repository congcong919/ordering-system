import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Order, OrderItem, OrderStatus } from '../types';

interface UseOrdersResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
}

interface UseOrderResult {
  order: Order | null;
  loading: boolean;
  error: string | null;
}

interface PlaceOrderPayload {
  items: OrderItem[];
  note: string;
  total: number;
  guestName?: string;
  tableNumber?: number;
}

interface PlaceOrderResponse {
  orderId: string;
}

interface UpdateStatusPayload {
  orderId: string;
  status: OrderStatus;
}

interface UpdateStatusResponse {
  orderId: string;
  status: OrderStatus;
}

/** Customer: live subscription to their own orders */
export function useMyOrders(): UseOrdersResult {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => { setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))); setLoading(false); },
      (err) => { setError(err.message); setLoading(false); }
    );
  }, [user]);

  return { orders, loading, error };
}

/** Customer: live subscription to a single order document */
export function useOrder(orderId: string | undefined): UseOrderResult {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    return onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => { setOrder(snap.exists() ? { id: snap.id, ...snap.data() } as Order : null); setLoading(false); },
      (err) => { setError(err.message); setLoading(false); }
    );
  }, [orderId]);

  return { order, loading, error };
}

/** Admin: live subscription to ALL orders */
export function useAllOrders(): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => { setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))); setLoading(false); },
      (err) => { setError(err.message); setLoading(false); }
    );
  }, []);

  return { orders, loading, error };
}

/** Place a new order via the Express API (triggers FCM + writes notification) */
export function usePlaceOrder() {
  return useMutation<PlaceOrderResponse, Error, PlaceOrderPayload>({
    mutationFn: (orderData) =>
      api.post<PlaceOrderResponse>('/api/orders', orderData).then((r) => r.data),
  });
}

/** Admin: update order status via the Express API */
export function useUpdateOrderStatus() {
  return useMutation<UpdateStatusResponse, Error, UpdateStatusPayload>({
    mutationFn: ({ orderId, status }) =>
      api.patch<UpdateStatusResponse>(`/api/orders/${orderId}/status`, { status }).then((r) => r.data),
  });
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, orderBy, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import api from '../services/api';
import { Reservation, ReservationStatus } from '../types';

interface UseReservationsResult {
  reservations: Reservation[];
  loading: boolean;
  error: string | null;
}

interface UpdateReservationStatusPayload {
  reservationId: string;
  status: ReservationStatus;
}

interface RescheduleReservationPayload {
  reservationId: string;
  date: string;
  time: string;
}

export interface TableConfig {
  number: number;
  capacity: number;
}

/** Admin: live subscription to ALL reservations */
export function useAllReservations(): UseReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)));
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );
  }, []);

  return { reservations, loading, error };
}

/** Admin: update reservation status */
export function useUpdateReservationStatus() {
  return useMutation<Reservation, Error, UpdateReservationStatusPayload>({
    mutationFn: ({ reservationId, status }) =>
      api.patch<Reservation>(`/api/reservations/${reservationId}/status`, { status }).then((r) => r.data),
  });
}

/** Admin: reschedule a reservation (change date and/or time) */
export function useRescheduleReservation() {
  return useMutation<Reservation, Error, RescheduleReservationPayload>({
    mutationFn: ({ reservationId, date, time }) =>
      api.patch<Reservation>(`/api/reservations/${reservationId}`, { date, time }).then((r) => r.data),
  });
}

/** Public: restaurant table configuration */
export function useTables() {
  return useQuery<{ tables: TableConfig[] }>({
    queryKey: ['tables'],
    queryFn: () => api.get<{ tables: TableConfig[] }>('/api/tables').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Admin: add a new table */
export function useAddTable() {
  const queryClient = useQueryClient();
  return useMutation<{ tables: TableConfig[] }, Error, TableConfig>({
    mutationFn: (data) =>
      api.post<{ tables: TableConfig[] }>('/api/tables', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  });
}

/** Admin: update a table's capacity */
export function useUpdateTable() {
  const queryClient = useQueryClient();
  return useMutation<{ tables: TableConfig[] }, Error, TableConfig>({
    mutationFn: ({ number, capacity }) =>
      api.put<{ tables: TableConfig[] }>(`/api/tables/${number}`, { capacity }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  });
}

/** Admin: delete a table by number */
export function useDeleteTable() {
  const queryClient = useQueryClient();
  return useMutation<{ tables: TableConfig[] }, Error, number>({
    mutationFn: (number) =>
      api.delete<{ tables: TableConfig[] }>(`/api/tables/${number}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  });
}

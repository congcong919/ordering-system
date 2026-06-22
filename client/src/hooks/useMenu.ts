import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import api from '../services/api';
import { MenuItem } from '../types';

type CreateMenuItemPayload = Omit<MenuItem, 'id'>;
type UpdateMenuItemPayload = { id: string } & Partial<Omit<MenuItem, 'id'>>;

export function useMenu(): UseQueryResult<MenuItem[], Error> {
  return useQuery<MenuItem[], Error>({
    queryKey: ['menu'],
    queryFn: () => api.get<MenuItem[]>('/api/menu').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation<MenuItem, Error, CreateMenuItemPayload>({
    mutationFn: (item) => api.post<MenuItem>('/api/menu', item).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation<MenuItem, Error, UpdateMenuItemPayload>({
    mutationFn: ({ id, ...data }) => api.put<MenuItem>(`/api/menu/${id}`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/api/menu/${id}`).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu'] }),
  });
}

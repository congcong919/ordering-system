export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled';

export interface Reservation {
  id: string;
  customerId: string | null;
  name: string;
  date: string;
  time: string;
  partySize: number;
  tableNumber: number;
  status: ReservationStatus;
  notes: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl?: string;
  available: boolean;
  allergens?: string[];
  isSpecial?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  guestName?: string;
  tableNumber?: number;
  items: OrderItem[];
  total: number;
  note: string;
  status: OrderStatus;
  createdAt: string;
  completedAt?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  orderId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

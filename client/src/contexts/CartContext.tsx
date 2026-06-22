import { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { MenuItem, CartItem } from '../types';

type CartAction =
  | { type: 'ADD'; item: MenuItem }
  | { type: 'REMOVE'; id: string }
  | { type: 'UPDATE_QTY'; id: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

interface CartContextValue {
  items: CartItem[];
  total: number;
  itemCount: number;
  addItem: (item: MenuItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find((i) => i.id === action.item.id);
      if (existing) {
        return state.map((i) =>
          i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case 'REMOVE':
      return state.filter((i) => i.id !== action.id);
    case 'UPDATE_QTY':
      return state.map((i) =>
        i.id === action.id ? { ...i, quantity: action.quantity } : i
      );
    case 'CLEAR':
      return [];
    case 'LOAD':
      return action.items;
    default:
      return state;
  }
}

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]') as CartItem[];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, loadCart);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const addItem = (item: MenuItem): void => dispatch({ type: 'ADD', item });
  const removeItem = (id: string): void => dispatch({ type: 'REMOVE', id });
  const updateQuantity = (id: string, quantity: number): void => {
    if (quantity < 1) {
      dispatch({ type: 'REMOVE', id });
    } else {
      dispatch({ type: 'UPDATE_QTY', id, quantity });
    }
  };
  const clearCart = (): void => dispatch({ type: 'CLEAR' });

  return (
    <CartContext.Provider value={{ items, total, itemCount, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

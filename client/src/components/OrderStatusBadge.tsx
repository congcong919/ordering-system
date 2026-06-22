import { OrderStatus } from '../types';

interface Props {
  status: OrderStatus | string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready:     'bg-green-100 text-green-800',
  completed: 'bg-stone-100 text-stone-600',
  cancelled: 'bg-red-100 text-red-700',
};

export function OrderStatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status] || 'bg-stone-100 text-stone-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

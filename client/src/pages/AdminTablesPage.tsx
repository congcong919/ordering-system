import { useState } from 'react';
import axios from 'axios';
import { useAllOrders, usePlaceOrder } from '../hooks/useOrders';
import {
  useAllReservations,
  useUpdateReservationStatus,
  useRescheduleReservation,
  useTables,
  useAddTable,
  useUpdateTable,
  useDeleteTable,
} from '../hooks/useReservations';
import { useMenu } from '../hooks/useMenu';
import { Order, MenuItem, Reservation, ReservationStatus, OrderStatus } from '../types';

type AllTabStatus = 'available' | 'occupied';

interface TableSummary {
  number: number;
  capacity: number;
  allTabStatus: AllTabStatus;
  activeOrders: Order[];
  reservations: Reservation[];
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

const STATUS_CARD: Record<AllTabStatus, string> = {
  available: 'border-green-200 bg-green-50',
  occupied:  'border-orange-200 bg-orange-50',
};
const STATUS_BADGE: Record<AllTabStatus, string> = {
  available: 'bg-green-100 text-green-700',
  occupied:  'bg-orange-100 text-orange-700',
};

const RESERVATION_FLOW: Partial<Record<ReservationStatus, { next: ReservationStatus; label: string }>> = {
  confirmed: { next: 'seated',    label: 'Seat guests' },
  seated:    { next: 'completed', label: 'Clear table' },
};

// ── Add Order Modal ──────────────────────────────────────────────────────────

interface AddOrderModalProps {
  tableNumber: number;
  menuItems: MenuItem[];
  onClose: () => void;
}

function AddOrderModal({ tableNumber, menuItems, onClose }: AddOrderModalProps) {
  const { mutateAsync: placeOrder, isPending } = usePlaceOrder();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [guestLabel, setGuestLabel] = useState('');
  const [error, setError] = useState('');

  const available = menuItems.filter((m) => m.available);
  const categories = [...new Set(available.map((m) => m.category))].sort();

  function adjust(id: string, delta: number) {
    setQuantities((prev) => {
      const next = (prev[id] ?? 0) + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  const selectedItems = available.filter((m) => (quantities[m.id] ?? 0) > 0);
  const total = selectedItems.reduce((sum, m) => sum + m.price * quantities[m.id], 0);

  async function handleSubmit() {
    if (selectedItems.length === 0) { setError('Select at least one item.'); return; }
    setError('');
    try {
      await placeOrder({
        items:       selectedItems.map((m) => ({ id: m.id, name: m.name, price: m.price, quantity: quantities[m.id] })),
        total,
        note,
        tableNumber,
        ...(guestLabel.trim() && { guestName: guestLabel.trim() }),
      });
      onClose();
    } catch {
      setError('Failed to place order. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
          <h2 className="font-bold text-stone-900">Add Order — Table {tableNumber}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 transition-colors">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <input
            type="text"
            value={guestLabel}
            onChange={(e) => setGuestLabel(e.target.value)}
            placeholder="Guest name (optional)"
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">{cat}</p>
              <ul className="space-y-2">
                {available.filter((m) => m.category === cat).map((item) => {
                  const qty = quantities[item.id] ?? 0;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                        <p className="text-xs text-stone-400">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => adjust(item.id, -1)} disabled={qty === 0}
                          className="w-7 h-7 rounded-full border border-stone-200 text-stone-600 flex items-center justify-center hover:bg-stone-100 disabled:opacity-30 transition-colors">−</button>
                        <span className="w-5 text-center text-sm font-medium text-stone-800">{qty}</span>
                        <button onClick={() => adjust(item.id, 1)}
                          className="w-7 h-7 rounded-full border border-brand-500 bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition-colors">+</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 pb-2 shrink-0">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Special instructions (optional)"
            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>

        <div className="px-5 pb-5 shrink-0 border-t border-stone-100 pt-3">
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
          <button onClick={handleSubmit} disabled={isPending || selectedItems.length === 0}
            className="w-full py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition disabled:opacity-50">
            {isPending ? 'Placing…' : selectedItems.length === 0 ? 'Select items' : `Place Order · $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function AdminTablesPage() {
  const { data: tablesData, isLoading: tablesLoading } = useTables();
  const { orders, loading: ordersLoading } = useAllOrders();
  const { reservations, loading: resLoading, error: resError } = useAllReservations();
  const { data: menuData } = useMenu();

  const { mutate: updateResStatus, isPending: updatingRes } = useUpdateReservationStatus();
  const { mutateAsync: rescheduleReservation, isPending: updatingReschedule } = useRescheduleReservation();
  const { mutateAsync: addTable,    isPending: addingTable }    = useAddTable();
  const { mutateAsync: updateTable, isPending: updatingTable }  = useUpdateTable();
  const { mutateAsync: deleteTable, isPending: deletingTable }  = useDeleteTable();

  // operational state
  const [addOrderTable,  setAddOrderTable]  = useState<number | null>(null);
  const [updatingResId,  setUpdatingResId]  = useState<string | null>(null);

  // reschedule state
  const [reschedulingId,   setReschedulingId]   = useState<string | null>(null);
  const [rescheduleDate,   setRescheduleDate]   = useState('');
  const [rescheduleTime,   setRescheduleTime]   = useState('');
  const [rescheduleError,  setRescheduleError]  = useState('');

  // filter state
  const [filter, setFilter] = useState<'all' | 'reservation'>('all');

  // table config state
  const [showAddForm, setShowAddForm]     = useState(false);
  const [addNum,      setAddNum]          = useState('');
  const [addCap,      setAddCap]          = useState('');
  const [addError,    setAddError]        = useState('');
  const [editingTable, setEditingTable]   = useState<number | null>(null);
  const [editCap,      setEditCap]        = useState('');
  const [editError,    setEditError]      = useState('');

  const tables    = tablesData?.tables ?? [];
  const menuItems = menuData ?? [];

  // ── Derive helpers ──────────────────────────────────────────────────────────

  function getTableReservations(tableNum: number): Reservation[] {
    return reservations
      .filter((r) => r.tableNumber === tableNum && (r.status === 'confirmed' || r.status === 'seated'))
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time}`).getTime();
        const db = new Date(`${b.date}T${b.time}`).getTime();
        return da - db;
      });
  }

  function deriveAllTabStatus(tableNum: number): AllTabStatus {
    if (orders.some((o) => o.tableNumber === tableNum && ACTIVE_ORDER_STATUSES.includes(o.status))) return 'occupied';
    return 'available';
  }

  function getActiveOrders(tableNum: number): Order[] {
    return orders.filter((o) => o.tableNumber === tableNum && ACTIVE_ORDER_STATUSES.includes(o.status));
  }

  // ── Reservation actions ─────────────────────────────────────────────────────

  function advanceReservation(res: Reservation) {
    const flow = RESERVATION_FLOW[res.status];
    if (!flow) return;
    setUpdatingResId(res.id);
    updateResStatus({ reservationId: res.id, status: flow.next }, { onSettled: () => setUpdatingResId(null) });
  }

  function cancelReservation(res: Reservation) {
    setUpdatingResId(res.id);
    updateResStatus({ reservationId: res.id, status: 'cancelled' }, { onSettled: () => setUpdatingResId(null) });
  }

  function startReschedule(res: Reservation) {
    setReschedulingId(res.id);
    setRescheduleDate(res.date);
    setRescheduleTime(res.time);
    setRescheduleError('');
  }

  async function handleReschedule(resId: string) {
    setRescheduleError('');
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Date and time are required.');
      return;
    }
    try {
      await rescheduleReservation({ reservationId: resId, date: rescheduleDate, time: rescheduleTime });
      setReschedulingId(null);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) && e.response?.data?.error
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : 'Failed to reschedule.';
      setRescheduleError(msg);
    }
  }

  // ── Table config actions ────────────────────────────────────────────────────

  async function handleAddTable() {
    setAddError('');
    const num = parseInt(addNum, 10);
    const cap = parseInt(addCap, 10);
    if (!addNum || isNaN(num) || num < 1) { setAddError('Enter a valid table number (≥ 1).'); return; }
    if (!addCap || isNaN(cap) || cap < 1) { setAddError('Enter a valid capacity (≥ 1).'); return; }
    try {
      await addTable({ number: num, capacity: cap });
      setAddNum(''); setAddCap(''); setShowAddForm(false);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) && e.response?.data?.error
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : 'Failed to add table.';
      setAddError(msg);
    }
  }

  function startEdit(tableNum: number, currentCapacity: number) {
    setEditingTable(tableNum);
    setEditCap(String(currentCapacity));
    setEditError('');
  }

  async function handleUpdateTable(tableNum: number) {
    setEditError('');
    const cap = parseInt(editCap, 10);
    if (isNaN(cap) || cap < 1) { setEditError('Capacity must be ≥ 1.'); return; }
    try {
      await updateTable({ number: tableNum, capacity: cap });
      setEditingTable(null);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) && e.response?.data?.error
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : 'Failed to update table.';
      setEditError(msg);
    }
  }

  async function handleDeleteTable(tableNum: number) {
    try {
      await deleteTable(tableNum);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) && e.response?.data?.error
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : 'Failed to delete table.';
      alert(msg);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const loading = tablesLoading || ordersLoading || resLoading;

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  if (resError) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Reservations could not be loaded</p>
          <p>{resError}</p>
          <p className="mt-2 text-red-500 text-xs">
            Publish the Firestore security rules in Firebase Console → Firestore → Rules, then reload.
          </p>
        </div>
      </main>
    );
  }

  const tableSummaries: TableSummary[] = tables.map((t: { number: number; capacity: number }) => ({
    number:       t.number,
    capacity:     t.capacity,
    allTabStatus: deriveAllTabStatus(t.number),
    activeOrders: getActiveOrders(t.number),
    reservations: getTableReservations(t.number),
  }));

  const occupied  = tableSummaries.filter((t) => t.allTabStatus === 'occupied').length;
  const available = tableSummaries.filter((t) => t.allTabStatus === 'available').length;
  const withBookings = tableSummaries.filter((t) => t.reservations.length > 0).length;

  const FILTERS: { key: 'all' | 'reservation'; label: string; active: string; inactive: string }[] = [
    { key: 'all',         label: 'All',          active: 'bg-stone-800 text-white border-stone-800',  inactive: 'bg-white text-stone-600 border-stone-200 hover:border-stone-400' },
    { key: 'reservation', label: 'Reservations', active: 'bg-blue-600 text-white border-blue-600',    inactive: 'bg-white text-blue-600 border-blue-200 hover:border-blue-400' },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900">Table Management</h1>
          {tables.length > 0 && filter === 'all' && (
            <p className="text-sm text-stone-400 mt-0.5">
              {occupied} occupied · {available} available · real-time
            </p>
          )}
          {tables.length > 0 && filter === 'reservation' && (
            <p className="text-sm text-stone-400 mt-0.5">
              {withBookings} of {tableSummaries.length} tables have upcoming reservations
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
          <button
            onClick={() => { setShowAddForm((v) => !v); setAddError(''); setAddNum(''); setAddCap(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Table
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      {tables.length > 0 && (
        <div className="flex items-center gap-1 mb-5 bg-stone-100 rounded-xl p-1 w-fit">
          {FILTERS.map(({ key, label, active }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === key ? active : 'text-stone-500 hover:text-stone-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Add Table form */}
      {showAddForm && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-5 shadow-sm">
          <p className="text-sm font-semibold text-stone-700 mb-3">New table</p>
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[100px]">
              <label className="text-xs text-stone-500 mb-1 block">Table number</label>
              <input
                type="number" min={1} max={99}
                value={addNum} onChange={(e) => setAddNum(e.target.value)}
                placeholder="e.g. 7"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="text-xs text-stone-500 mb-1 block">Seats (capacity)</label>
              <input
                type="number" min={1} max={50}
                value={addCap} onChange={(e) => setAddCap(e.target.value)}
                placeholder="e.g. 4"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-2 pt-5">
              <button
                onClick={handleAddTable}
                disabled={addingTable}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition disabled:opacity-50"
              >
                {addingTable ? 'Adding…' : 'Add'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
          {addError && <p className="text-red-600 text-xs mt-2">{addError}</p>}
        </div>
      )}

      {/* Empty state */}
      {tables.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          No tables configured yet. Use <strong>Add Table</strong> above to create your first table.
        </div>
      )}

      {/* Table grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tableSummaries.map((t) => {
          const isEditing = editingTable === t.number;
          const canDelete = t.allTabStatus === 'available' && t.reservations.length === 0;
          const cardClass = filter === 'all' ? STATUS_CARD[t.allTabStatus] : 'border-stone-200 bg-white';

          return (
            <div key={t.number} className={`rounded-2xl border-2 p-5 flex flex-col gap-3 ${cardClass}`}>
              {/* Table header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-extrabold text-stone-900">Table {t.number}</p>

                  {/* Capacity — view or inline edit */}
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={1} max={50}
                          value={editCap}
                          onChange={(e) => setEditCap(e.target.value)}
                          className="w-16 px-2 py-1 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          autoFocus
                        />
                        <span className="text-xs text-stone-500">seats</span>
                      </div>
                      <button
                        onClick={() => handleUpdateTable(t.number)}
                        disabled={updatingTable}
                        className="px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition disabled:opacity-50"
                      >
                        {updatingTable ? '…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingTable(null); setEditError(''); }}
                        className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 text-xs font-medium hover:bg-stone-50 transition"
                      >
                        Cancel
                      </button>
                      {editError && <p className="text-red-600 text-xs w-full">{editError}</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">Seats up to {t.capacity}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {filter === 'all' && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[t.allTabStatus]}`}>
                      {t.allTabStatus}
                    </span>
                  )}

                  {/* Edit capacity */}
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(t.number, t.capacity)}
                      title="Edit capacity"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white/60 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete table */}
                  <button
                    onClick={() => canDelete && handleDeleteTable(t.number)}
                    disabled={!canDelete || deletingTable}
                    title={canDelete ? 'Delete table' : t.allTabStatus === 'occupied' ? 'Cannot delete — table is occupied' : 'Cannot delete — table has upcoming reservations'}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-white/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Timeslots — Reservation tab only */}
              {filter === 'reservation' && t.reservations.length === 0 && (
                <p className="text-xs text-stone-400 italic">No upcoming reservations</p>
              )}
              {filter === 'reservation' && t.reservations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Timeslots</p>
                  {t.reservations.map((res) => {
                    const flow        = RESERVATION_FLOW[res.status];
                    const resUpdating = updatingRes && updatingResId === res.id;
                    const isRescheduling = reschedulingId === res.id;

                    return (
                      <div key={res.id} className="bg-white/70 rounded-xl px-3 py-2.5 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 mb-0.5">
                          {res.date} · {res.time}
                        </p>
                        <p className="text-sm font-medium text-stone-800">{res.name}</p>
                        <p className="text-xs text-stone-500">{res.partySize} guests</p>
                        <p className="text-xs font-semibold text-blue-600 mt-0.5 capitalize">{res.status}</p>

                        {isRescheduling ? (
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                              <input
                                type="time"
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                            {rescheduleError && (
                              <p className="text-red-600 text-xs">{rescheduleError}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReschedule(res.id)}
                                disabled={updatingReschedule}
                                className="px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition disabled:opacity-50"
                              >
                                {updatingReschedule ? '…' : 'Save'}
                              </button>
                              <button
                                onClick={() => { setReschedulingId(null); setRescheduleError(''); }}
                                className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-500 text-xs font-medium hover:bg-stone-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {flow && (
                              <button
                                onClick={() => advanceReservation(res)}
                                disabled={resUpdating}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                              >
                                {resUpdating ? '…' : flow.label}
                              </button>
                            )}
                            <button
                              onClick={() => startReschedule(res)}
                              className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50 transition"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => cancelReservation(res)}
                              disabled={resUpdating}
                              className="px-2.5 py-1 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active orders — All tab only */}
              {filter === 'all' && t.activeOrders.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-stone-500">Active orders</p>
                  {t.activeOrders.map((order) => (
                    <div key={order.id} className="bg-white/70 rounded-xl px-3 py-2 border border-orange-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-stone-400">#{order.id.slice(-8)}</span>
                        <span className="text-xs font-semibold text-orange-700 capitalize">{order.status}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                      </p>
                      <p className="text-xs font-semibold text-stone-800 mt-1">${Number(order.total).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Order button — All tab only */}
              {filter === 'all' && (
                <button
                  onClick={() => setAddOrderTable(t.number)}
                  className="mt-auto w-full py-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 text-sm font-medium hover:border-brand-400 hover:text-brand-600 hover:bg-white/50 transition-colors"
                >
                  + Add Order
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Order modal */}
      {addOrderTable !== null && (
        <AddOrderModal
          tableNumber={addOrderTable}
          menuItems={menuItems}
          onClose={() => setAddOrderTable(null)}
        />
      )}
    </main>
  );
}

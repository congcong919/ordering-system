const { db } = require('./firebase');
const AppError = require('../utils/AppError');

// Round a Date up to the next 30-minute boundary
function nextHalfHour(date) {
  const slot = 30 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / slot) * slot);
}

const RESERVATION_DURATION_MS = 90 * 60 * 1000;

// Earliest Date at which a table with this order is considered free
function orderBlockedUntil(order) {
  if (order.status === 'cancelled') return new Date(0);
  if (order.status === 'completed' && order.completedAt) {
    return nextHalfHour(new Date(order.completedAt));
  }
  // Active order (or completed without completedAt): 90 min from placement
  return nextHalfHour(new Date(new Date(order.createdAt).getTime() + 90 * 60 * 1000));
}

// Add minutes to "HH:MM"; returns null if result falls outside 00:00–23:59
function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Valid seating windows: lunch 12:00–14:30, dinner 18:00–21:30
// Last seating is 30 min before each service closes (15:00 / 22:00)
function isWithinOpeningHours(timeStr) {
  return (timeStr >= '12:00' && timeStr <= '14:30') ||
         (timeStr >= '18:00' && timeStr <= '21:30');
}

// Load tables, reservations for the date, and recent orders (only for today)
async function _loadData(date) {
  const today = new Date().toISOString().slice(0, 10);

  const [tablesSnap, resSnap] = await Promise.all([
    db.collection('config').doc('tables').get(),
    db.collection('reservations').where('date', '==', date).get(),
  ]);

  const tables = tablesSnap.exists ? (tablesSnap.data().tables || []) : [];

  // tableNumber → Set of booked times (confirmed or seated reservations)
  const bookedTimesForTable = {};
  resSnap.docs.forEach((d) => {
    const { tableNumber, time, status } = d.data();
    if (status === 'confirmed' || status === 'seated') {
      if (!bookedTimesForTable[tableNumber]) bookedTimesForTable[tableNumber] = new Set();
      bookedTimesForTable[tableNumber].add(time);
    }
  });

  // tableNumber → [orders] for today only (orders can only block same-day slots)
  const ordersByTable = {};
  if (date === today) {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const ordersSnap = await db.collection('orders').where('createdAt', '>=', fourHoursAgo).get();
    ordersSnap.docs.forEach((d) => {
      const o = d.data();
      if (o.tableNumber && o.status !== 'cancelled') {
        if (!ordersByTable[o.tableNumber]) ordersByTable[o.tableNumber] = [];
        ordersByTable[o.tableNumber].push(o);
      }
    });
  }

  return { tables, bookedTimesForTable, ordersByTable };
}

// True if a specific table has no reservation or order conflict at (date, time)
function _isFree(tableNumber, time, date, bookedTimesForTable, ordersByTable) {
  const slotDt = new Date(`${date}T${time}:00`);

  // A reservation blocks the table for RESERVATION_DURATION_MS in either direction
  const reservedTimes = bookedTimesForTable[tableNumber];
  if (reservedTimes) {
    for (const resTime of reservedTimes) {
      const resDt = new Date(`${date}T${resTime}:00`);
      if (Math.abs(slotDt.getTime() - resDt.getTime()) < RESERVATION_DURATION_MS) {
        return false;
      }
    }
  }

  return (ordersByTable[tableNumber] || []).every(
    (order) => orderBlockedUntil(order) <= slotDt
  );
}

async function getAllReservations() {
  const snap = await db.collection('reservations').orderBy('date', 'asc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function checkAvailability(date, time, partySize) {
  const { tables, bookedTimesForTable, ordersByTable } = await _loadData(date);

  const freeTable = tables
    .filter((t) => t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity)
    .find((t) => _isFree(t.number, time, date, bookedTimesForTable, ordersByTable));

  return freeTable ? { available: true, table: freeTable } : { available: false };
}

// Book-or-find: tries the requested slot first, then ±30/60/90/120-min alternates.
// Returns the confirmed reservation; includes requestedTime when an alternate was booked.
// Throws AppError 409 if no slot is found within the search window.
async function createReservation({ name, date, time, partySize, notes = '' }) {
  const { tables, bookedTimesForTable, ordersByTable } = await _loadData(date);

  const suitableTables = tables
    .filter((t) => t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity);

  if (suitableTables.length === 0) {
    throw new AppError('No tables are configured for this party size', 409);
  }

  if (!isWithinOpeningHours(time)) {
    throw new AppError(
      'Requested time is outside opening hours. ' +
      'Lunch seatings: 12:00–14:30. Dinner seatings: 18:00–21:30.',
      400
    );
  }

  // Candidate times: requested first, then expand outward at 30-min intervals
  // Only include times that fall within actual service windows
  const offsets = [0, 30, -30, 60, -60, 90, -90, 120, -120];
  const candidates = offsets
    .map((o) => addMinutesToTime(time, o))
    .filter((t) => t !== null && isWithinOpeningHours(t));

  for (const candidateTime of candidates) {
    const table = suitableTables.find((t) =>
      _isFree(t.number, candidateTime, date, bookedTimesForTable, ordersByTable)
    );
    if (!table) continue;

    const reservation = {
      customerId: null,
      name,
      date,
      time: candidateTime,
      partySize,
      tableNumber: table.number,
      status: 'confirmed',
      notes,
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection('reservations').add(reservation);
    const result = { id: ref.id, ...reservation };
    if (candidateTime !== time) result.requestedTime = time;
    return result;
  }

  throw new AppError('No available tables for your party on this date', 409);
}

async function updateReservationStatus(id, status) {
  const ref = db.collection('reservations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Reservation not found', 404);
  await ref.update({ status });
  return { id, ...snap.data(), status };
}

async function updateReservation(id, { date, time }) {
  if (!isWithinOpeningHours(time)) {
    throw new AppError(
      'Requested time is outside opening hours. Lunch: 12:00–14:30. Dinner: 18:00–21:30.',
      400
    );
  }

  const ref = db.collection('reservations').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('Reservation not found', 404);

  const current = snap.data();
  const { bookedTimesForTable, ordersByTable } = await _loadData(date);

  // Exclude this reservation's own slot so it doesn't conflict with itself
  if (date === current.date && bookedTimesForTable[current.tableNumber]) {
    bookedTimesForTable[current.tableNumber].delete(current.time);
  }

  if (!_isFree(current.tableNumber, time, date, bookedTimesForTable, ordersByTable)) {
    throw new AppError('The table is not available at the requested time', 409);
  }

  await ref.update({ date, time });
  return { id, ...current, date, time };
}

module.exports = { getAllReservations, checkAvailability, createReservation, updateReservationStatus, updateReservation };

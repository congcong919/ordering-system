const { Router } = require('express');
const { z } = require('zod');
const { getAllReservations, checkAvailability, createReservation, updateReservationStatus, updateReservation } = require('../services/reservationService');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const AppError = require('../utils/AppError');

const router = Router();

const RESERVATION_STATUSES = ['confirmed', 'seated', 'completed', 'cancelled'];

const ReservationStatusSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
});

const RescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'),
});

const AvailabilityQuerySchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time:      z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'),
  partySize: z.coerce.number().int().min(1).max(8),
});

const ReservationBodySchema = z.object({
  name:      z.string().min(1).max(100),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time:      z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM'),
  partySize: z.number().int().min(1).max(8),
  notes:     z.string().max(500).optional().default(''),
});

// GET /api/reservations — admin only, returns all reservations ordered by date
router.get('/', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    res.json(await getAllReservations());
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reservations/:id — admin only, reschedule (change date/time)
router.patch('/:id', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const data = RescheduleSchema.parse(req.body);
    const reservation = await updateReservation(req.params.id, data);
    res.json(reservation);
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    if (err.statusCode) return next(err);
    next(err);
  }
});

// PATCH /api/reservations/:id/status — admin only
router.patch('/:id/status', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = ReservationStatusSchema.parse(req.body);
    const reservation = await updateReservationStatus(req.params.id, status);
    res.json(reservation);
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// GET /api/reservations/availability?date=&time=&partySize= — public, no auth
router.get('/availability', async (req, res, next) => {
  try {
    const { date, time, partySize } = AvailabilityQuerySchema.parse(req.query);
    const result = await checkAvailability(date, time, partySize);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// POST /api/reservations — no auth; Express writes to Firestore via Admin SDK
router.post('/', async (req, res, next) => {
  try {
    const data = ReservationBodySchema.parse(req.body);
    const reservation = await createReservation(data);
    res.status(201).json(reservation);
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    if (err.statusCode === 400 || err.statusCode === 409) return next(err);
    next(err);
  }
});

module.exports = router;

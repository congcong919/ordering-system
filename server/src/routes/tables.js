const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../services/firebase');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const AppError = require('../utils/AppError');

const router = Router();

const TableSchema = z.object({
  number:   z.coerce.number().int().min(1).max(99),
  capacity: z.coerce.number().int().min(1).max(50),
});

const CapacitySchema = z.object({
  capacity: z.coerce.number().int().min(1).max(50),
});

async function getTablesArray() {
  const snap = await db.collection('config').doc('tables').get();
  return snap.exists ? (snap.data().tables || []) : [];
}

async function saveTablesArray(tables) {
  await db.collection('config').doc('tables').set({ tables });
}

// GET /api/tables — public
router.get('/', async (req, res, next) => {
  try {
    res.json({ tables: await getTablesArray() });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables — admin: add a table
router.post('/', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { number, capacity } = TableSchema.parse(req.body);
    const tables = await getTablesArray();
    if (tables.some((t) => t.number === number)) {
      return next(new AppError(`Table ${number} already exists`, 409));
    }
    const updated = [...tables, { number, capacity }].sort((a, b) => a.number - b.number);
    await saveTablesArray(updated);
    res.status(201).json({ tables: updated });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// PUT /api/tables/:number — admin: update capacity
router.put('/:number', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const tableNumber = parseInt(req.params.number, 10);
    if (isNaN(tableNumber)) return next(new AppError('Invalid table number', 400));
    const { capacity } = CapacitySchema.parse(req.body);
    const tables = await getTablesArray();
    const idx = tables.findIndex((t) => t.number === tableNumber);
    if (idx === -1) return next(new AppError(`Table ${tableNumber} not found`, 404));
    tables[idx] = { number: tableNumber, capacity };
    await saveTablesArray(tables);
    res.json({ tables });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// DELETE /api/tables/:number — admin: remove a table
router.delete('/:number', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const tableNumber = parseInt(req.params.number, 10);
    if (isNaN(tableNumber)) return next(new AppError('Invalid table number', 400));
    const tables = await getTablesArray();
    if (!tables.some((t) => t.number === tableNumber)) {
      return next(new AppError(`Table ${tableNumber} not found`, 404));
    }
    const updated = tables.filter((t) => t.number !== tableNumber);
    await saveTablesArray(updated);
    res.json({ tables: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

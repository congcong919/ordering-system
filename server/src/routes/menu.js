const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../services/firebase');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const AppError = require('../utils/AppError');

const router = Router();

const MenuItemSchema = z.object({
  name:        z.string().min(1).max(100),
  price:       z.number().positive(),
  category:    z.string().min(1).max(50),
  description: z.string().max(300).optional().default(''),
  imageUrl:    z.string().url().optional().or(z.literal('')).default(''),
  available:   z.boolean().optional().default(true),
});

// Public — anyone can browse the menu
router.get('/', async (req, res, next) => {
  try {
    const snap = await db.collection('menus').orderBy('category').get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Admin only — create
router.post('/', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const data = MenuItemSchema.parse(req.body);
    const ref = await db.collection('menus').add({ ...data, createdAt: new Date().toISOString() });
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// Admin only — update
router.put('/:id', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const data = MenuItemSchema.partial().parse(req.body);
    await db.collection('menus').doc(req.params.id).update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// Admin only — delete
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    await db.collection('menus').doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

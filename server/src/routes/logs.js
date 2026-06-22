const { Router } = require('express');
const { z } = require('zod');
const { db, auth } = require('../services/firebase');
const logger = require('../utils/logger');
const verifyToken = require('../middleware/verifyToken');
const AppError = require('../utils/AppError');

const router = Router();

const ClientLogSchema = z.object({
  message: z.string().max(1000),
  stack:   z.string().max(5000).optional(),
  url:     z.string().max(500).optional(),
});

// POST /api/logs/client — client-side error logging
router.post('/client', verifyToken, async (req, res, next) => {
  try {
    const data = ClientLogSchema.parse(req.body);
    logger.warn('Client error', {
      ...data,
      userId: req.user.uid,
      requestId: req.requestId,
    });
    res.status(204).send();
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// GET /health
router.get('/health', async (req, res, next) => {
  try {
    // Probe Firestore liveness
    await db.collection('_health').limit(1).get();
    // Probe Auth liveness
    await auth.listUsers(1);

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { firestore: 'ok', auth: 'ok' },
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      error: err.message,
    });
  }
});

module.exports = router;

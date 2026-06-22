const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const menuRoutes         = require('./routes/menu');
const ordersRoutes       = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const logsRoutes         = require('./routes/logs');
const authRoutes         = require('./routes/auth');
const aiRoutes           = require('./routes/ai');
const reservationsRoutes = require('./routes/reservations');
const tablesRoutes       = require('./routes/tables');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_ORIGIN
    : /^http:\/\/(localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/, // allow localhost + LAN IPs in dev
}));
app.use(express.json());

// Attach a unique requestId to every request for structured logging
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Morgan → Winston HTTP-level logging
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Rate limiting
const ordersLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
const authLimiter   = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

// ── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/menu',          menuRoutes);
app.use('/api/orders',        ordersLimiter, ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/logs',          logsRoutes);   // also handles GET /api/logs/health
app.use('/api/ai',            aiRoutes);
app.use('/api/reservations',  reservationsRoutes);
app.use('/api/tables',        tablesRoutes);
app.get('/health',            (req, res) => res.redirect('/api/logs/health'));

// ── Error handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;

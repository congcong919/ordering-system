const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../services/firebase');
const { sendToUser, sendToAdmins } = require('../services/fcm');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const AppError = require('../utils/AppError');

const router = Router();

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

const OrderItemSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  price:    z.number().positive(),
  quantity: z.number().int().positive(),
});

const PlaceOrderSchema = z.object({
  items:       z.array(OrderItemSchema).min(1),
  note:        z.string().max(500).optional().default(''),
  total:       z.number().positive(),
  guestName:   z.string().max(100).optional(),
  tableNumber: z.number().int().min(1).max(20).optional(),
});

const StatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

// GET /api/orders — admin gets all, customer gets their own
router.get('/', verifyToken, async (req, res, next) => {
  try {
    let query = db.collection('orders').orderBy('createdAt', 'desc');
    if (req.user.role !== 'admin') {
      query = query.where('customerId', '==', req.user.uid);
    }
    const snap = await query.get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id — owner or admin can fetch a single order
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('orders').doc(req.params.id).get();
    if (!snap.exists) return next(new AppError('Order not found', 404));

    const order = { id: snap.id, ...snap.data() };
    if (req.user.role !== 'admin' && order.customerId !== req.user.uid) {
      return next(new AppError('Forbidden', 403));
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders — any authenticated user (including anonymous) places an order
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const data = PlaceOrderSchema.parse(req.body);

    const order = {
      items:      data.items,
      note:       data.note,
      total:      data.total,
      customerId: req.user.uid,
      status:     'pending',
      createdAt:  new Date().toISOString(),
      ...(data.guestName   && { guestName:   data.guestName }),
      ...(data.tableNumber && { tableNumber: data.tableNumber }),
    };

    const ref = await db.collection('orders').add(order);
    const orderId = ref.id;

    // Auto-seat the active reservation for this table (if any)
    if (data.tableNumber) {
      const today = new Date().toISOString().slice(0, 10);
      const resSnap = await db.collection('reservations')
        .where('tableNumber', '==', data.tableNumber)
        .where('date', '==', today)
        .where('status', '==', 'confirmed')
        .get();

      if (!resSnap.empty) {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        let closest = resSnap.docs[0];
        let minDiff = Infinity;
        resSnap.docs.forEach((doc) => {
          const [h, m] = doc.data().time.split(':').map(Number);
          const diff = Math.abs(h * 60 + m - nowMinutes);
          if (diff < minDiff) { minDiff = diff; closest = doc; }
        });
        await closest.ref.update({ status: 'seated' });
      }
    }

    // Notification for registered (non-anonymous) customers only
    if (!req.user.firebase?.sign_in_provider?.includes('anonymous')) {
      await db.collection('notifications').add({
        recipientId: req.user.uid,
        orderId,
        type:        'order_placed',
        message:     'Your order has been placed and is waiting to be confirmed.',
        read:        false,
        createdAt:   new Date().toISOString(),
      });
    }

    // Firestore notification for every admin so the bell updates in real-time
    const adminSnap = await db.collection('users').where('role', '==', 'admin').get();
    const adminBatch = db.batch();
    const adminMessage = `New order from ${data.guestName || 'Customer'} · ${data.items.length} item(s) · $${data.total.toFixed(2)}`;
    adminSnap.docs.forEach((adminDoc) => {
      const ref = db.collection('notifications').doc();
      adminBatch.set(ref, {
        recipientId: adminDoc.id,
        orderId,
        type:        'new_order',
        message:     adminMessage,
        read:        false,
        createdAt:   new Date().toISOString(),
      });
    });
    await adminBatch.commit();

    await sendToAdmins({
      title: 'New order received',
      body:  adminMessage,
      data:  { orderId },
    });

    res.status(201).json({ orderId });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

// PATCH /api/orders/:id/status — admin only
router.patch('/:id/status', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = StatusSchema.parse(req.body);
    const orderRef = db.collection('orders').doc(req.params.id);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return next(new AppError('Order not found', 404));

    const updateData = { status };
    if (status === 'completed') updateData.completedAt = new Date().toISOString();
    await orderRef.update(updateData);

    const { customerId } = orderSnap.data();
    const message = status === 'cancelled'
      ? 'Your order has been cancelled.'
      : `Your order is now ${status}.`;

    await db.collection('notifications').add({
      recipientId: customerId,
      orderId:     req.params.id,
      type:        'status_update',
      message,
      read:        false,
      createdAt:   new Date().toISOString(),
    });

    await sendToUser(customerId, {
      title: 'Order update',
      body:  message,
      data:  { orderId: req.params.id },
    });

    res.json({ orderId: req.params.id, status });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

module.exports = router;

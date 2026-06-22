const { Router } = require('express');
const { db } = require('../services/firebase');
const verifyToken = require('../middleware/verifyToken');
const AppError = require('../utils/AppError');

const router = Router();

// GET /api/notifications — current user's notifications
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('notifications')
      .where('recipientId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', verifyToken, async (req, res, next) => {
  try {
    const ref = db.collection('notifications').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return next(new AppError('Not found', 404));
    if (snap.data().recipientId !== req.user.uid) return next(new AppError('Forbidden', 403));
    await ref.update({ read: true });
    res.json({ id: req.params.id, read: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('notifications')
      .where('recipientId', '==', req.user.uid)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();

    res.json({ updated: snap.size });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const { Router } = require('express');
const { z } = require('zod');
const { auth, db } = require('../services/firebase');
const AppError = require('../utils/AppError');

const router = Router();

const SetAdminSchema = z.object({
  uid:    z.string().min(1),
  secret: z.string().min(1),
});

/**
 * POST /api/auth/set-admin
 * One-time endpoint to grant admin role to a user.
 * Protected by SETUP_SECRET env var — keep this secret and use it once.
 *
 * Body: { uid: "<firebase-user-uid>", secret: "<SETUP_SECRET value>" }
 */
router.post('/set-admin', async (req, res, next) => {
  try {
    const { uid, secret } = SetAdminSchema.parse(req.body);

    if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
      return next(new AppError('Invalid secret', 403));
    }

    await auth.setCustomUserClaims(uid, { role: 'admin' });
    await db.collection('users').doc(uid).set({ role: 'admin' }, { merge: true });

    res.json({ message: `User ${uid} is now an admin. Ask them to log out and back in.` });
  } catch (err) {
    if (err.name === 'ZodError') return next(new AppError(err.errors[0].message, 400));
    next(err);
  }
});

module.exports = router;

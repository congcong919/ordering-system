const { messaging, db } = require('./firebase');
const logger = require('../utils/logger');

async function sendToUser(uid, { title, body, data = {} }) {
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    const fcmToken = userSnap.data()?.fcmToken;
    if (!fcmToken) return;

    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch (err) {
    // Non-fatal — FCM may fail if the token is stale or notifications are blocked
    logger.warn('FCM send failed', { uid, error: err.message });
  }
}

async function sendToAdmins({ title, body, data = {} }) {
  try {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    const tokens = snap.docs.map((d) => d.data().fcmToken).filter(Boolean);
    if (!tokens.length) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch (err) {
    logger.warn('FCM multicast to admins failed', { error: err.message });
  }
}

module.exports = { sendToUser, sendToAdmins };

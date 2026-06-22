const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // .env stores \n as literal \\n — restore actual newlines
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const auth = admin.auth();
const db = admin.firestore();
const messaging = admin.messaging();

module.exports = { admin, auth, db, messaging };

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Config is injected at runtime — this file must be served from the root.
// The app posts the config via postMessage after SW registration.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      self.registration.showNotification(title ?? 'OrderUp', {
        body: body ?? '',
        icon: '/favicon.svg',
        data: payload.data,
      });
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  if (orderId) {
    event.waitUntil(clients.openWindow(`/orders/${orderId}`));
  }
});

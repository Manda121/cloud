// firebase-messaging-sw.js
// Service Worker pour recevoir les notifications FCM en arrière-plan

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Configuration Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBm-aD-xNstMvirSrHO0vyEQGwia8J-zFk",
  authDomain: "fir-authentification-978a0.firebaseapp.com",
  projectId: "fir-authentification-978a0",
  storageBucket: "fir-authentification-978a0.firebasestorage.app",
  messagingSenderId: "114320752404512342329",
  appId: "1:524999156993:web:your_app_id"
});

const messaging = firebase.messaging();

// Gérer les messages reçus en arrière-plan
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const title = (payload.notification && payload.notification.title) || payload.data?.title || 'Notification';
  const body = (payload.notification && payload.notification.body) || payload.data?.body || '';

  const options = {
    body,
    // utilisez votre icône si vous en avez une
    icon: '/assets/icon.png',
    data: payload.data || {}
  };

  self.registration.showNotification(title, options);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

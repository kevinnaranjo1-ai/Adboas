// Scripts compatíveis com Firebase v10
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Inicialização Firebase no Service Worker
firebase.initializeApp({
  apiKey: atob("QUl6YVN5QmwtalpuWVlmSW10b0ZRRjZWNTJKakhKQTFxUks4bWZZ"),
  authDomain: "ai-studio-applet-webapp-ee85b.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-ee85b",
  storageBucket: "ai-studio-applet-webapp-ee85b.firebasestorage.app",
  messagingSenderId: "911979734768",
  appId: "1:911979734768:web:74a4cee8924ec91832c435"
});

const messaging = firebase.messaging();

// Intercepta mensagens de push em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);
  
  const notificationTitle = payload.notification?.title || 'Novo Relatório Enviado';
  const notificationOptions = {
    body: payload.notification?.body || 'Um novo relatório foi enviado por um líder de departamento.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.reportId || 'new-report',
    data: {
      url: payload.data?.url || '/',
      reportId: payload.data?.reportId
    },
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener de cliques em notificações para abrir a rota correspondente
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver janela aberta, navega até ela
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se nenhuma estiver com foco, abre nova aba
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

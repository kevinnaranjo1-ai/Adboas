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

// 1. Intercepta mensagens de push padrão W3C (Web Push nativo mesmo com app fechado)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Evento push recebido em segundo plano:', event);
  
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'AD Boas Novas', body: event.data.text() };
    }
  }

  const title = payload.title || payload.notification?.title || 'AD Boas Novas - Tenda da Promessa';
  const body = payload.body || payload.notification?.body || 'Você recebeu um novo aviso da igreja.';
  const icon = payload.icon || '/logo.png';
  const badge = payload.badge || '/logo.png';
  const targetUrl = payload.url || payload.data?.url || '/';
  const tag = payload.tag || payload.data?.tag || `push-${Date.now()}`;

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    data: {
      url: targetUrl,
      id: payload.id || payload.data?.id
    },
    vibrate: [300, 150, 300],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Abrir Aplicativo' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 2. Intercepta mensagens de push via Firebase Cloud Messaging (FCM)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);
  
  const notificationTitle = payload.notification?.title || 'Novo Aviso da Igreja';
  const notificationOptions = {
    body: payload.notification?.body || 'Um novo comunicado foi publicado pela igreja.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.reportId || payload.data?.tag || `fcm-${Date.now()}`,
    data: {
      url: payload.data?.url || '/',
      reportId: payload.data?.reportId
    },
    vibrate: [300, 150, 300],
    requireInteraction: true
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

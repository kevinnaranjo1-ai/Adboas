// Importa compatibilidade do Firebase Messaging para segundo plano (FCM)
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
  console.log('[sw.js] Mensagem recebida em segundo plano (FCM):', payload);
  
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

const CACHE_NAME = 'boas-novas-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/favicon.ico'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event (cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event (network falling back to cache, with special handling for SPA routes)
self.addEventListener('fetch', (event) => {
  // We only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Let Firestore/Firebase and internal API requests pass directly to network
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firestore.googleapis.com') || 
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('__aistudio_internal')
  ) {
    return;
  }

  // Handle SPA routing: if requesting an HTML page that's not cached, serve the index.html
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Return resource from network
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache newly requested static resources (JS, CSS, images, fonts)
        const isStaticResource = (
          url.pathname.endsWith('.js') || 
          url.pathname.endsWith('.css') || 
          url.pathname.endsWith('.png') || 
          url.pathname.endsWith('.jpg') || 
          url.pathname.endsWith('.jpeg') || 
          url.pathname.endsWith('.svg') || 
          url.pathname.includes('/assets/')
        );

        if (isStaticResource) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests (HTML/page loads) to index.html to support SPA offline load
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

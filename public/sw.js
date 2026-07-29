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

const CACHE_NAME = 'boas-novas-v2.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/favicon.ico',
  '/manifest.json'
];

// Message listener for force update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install Service Worker and skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event (cleanup old caches and claim clients immediately)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Apagando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Assumindo controle de todas as abas/clientes (clients.claim)');
      return self.clients.claim();
    })
  );
});

// Fetch event (Network-First for navigation and logo, falling back to cache if offline)
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

  // Network-First for main pages, logo, and icons so users get new updates instantly when online
  const isMainAssetOrPage = (
    event.request.mode === 'navigate' || 
    url.pathname === '/' || 
    url.pathname.endsWith('/logo.png') || 
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/manifest.json')
  );

  if (isMainAssetOrPage) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // Stale-while-revalidate / cache-first for secondary resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

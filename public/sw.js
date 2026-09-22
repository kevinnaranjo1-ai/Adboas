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

// 1. Intercepta mensagens de push padrão W3C (Web Push nativo para celular/desktop fechado)
self.addEventListener('push', (event) => {
  console.log('[sw.js] Evento push recebido em segundo plano:', event);
  
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
  console.log('[sw.js] Mensagem recebida em segundo plano (FCM):', payload);
  
  const notificationTitle = payload.notification?.title || 'Novo Aviso da Igreja';
  const notificationOptions = {
    body: payload.notification?.body || 'A igreja enviou um novo comunicado ou lembrete.',
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

// 3. Listener de cliques em notificações para abrir o app diretamente na tela do aviso
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já houver janela da igreja aberta, foca nela e navega se necessário
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Se o app estiver fechado, abre a janela no link indicado
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

const CACHE_NAME = 'boas-novas-v3.6.0-logo-update-force';
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

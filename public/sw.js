// v5 (09/10/2026): troca o nome pra apagar os caches que guardaram HTML no lugar de JS
const CACHE_NAME = 'unv-nexus-v5';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: precache essential assets (NEVER precache '/' — causes Safari to serve stale HTML)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: nuke ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // A página pergunta qual é o cache atual pra limpar só os antigos (ver registerSW.ts).
  if (event.data && event.data.type === 'GET_CACHE_NAME' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ cacheName: CACHE_NAME });
  }
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // API / supabase / lovable runtime: network-only
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('lovable') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/')
  ) {
    return;
  }

  // Navigation requests: ALWAYS network-first, NEVER serve cached HTML
  // (caching index.html is what breaks Safari after deploys)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico)$/);

  // Arquivo que não existe (deploy em andamento, chunk antigo) volta como index.html com 200.
  // Esse HTML não pode entrar no cache no lugar do JS/CSS: o lazy import quebrava para sempre
  // ("Failed to fetch dynamically imported module"). Só guarda o que veio com o tipo certo,
  // e um HTML que já esteja guardado conta como ausente.
  const tipoErrado = (response) => (response.headers.get('content-type') || '').includes('text/html');
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached && !tipoErrado(cached)) return cached;
        return fetch(request).then((response) => {
          if (response.ok && !tipoErrado(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});


// ── Notificações push (18/09/2026) ──
// O servidor manda { id, title, body, url, tag }. Mesmo "tag" substitui a anterior em vez de empilhar.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'UNV Nexus', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'UNV Nexus', {
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.tag || d.id || undefined,
      renotify: !!d.tag,
      data: { url: d.url || '/', id: d.id || null },
    })
  );
});

// Clique: foca a aba do Nexus que já estiver aberta (e navega), senão abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          try { await c.focus(); if ('navigate' in c) await c.navigate(url); return; } catch (e) { /* tenta a próxima */ }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});

// Detect Safari (desktop + iOS)
const isSafari = () => {
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
};

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Em preview/desenvolvimento, um Service Worker antigo pode servir chunks
  // desatualizados do Vite e causar erro de React duplicado (dispatcher null).
  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        if (navigator.serviceWorker.controller && !sessionStorage.getItem('sw-dev-cleaned')) {
          sessionStorage.setItem('sw-dev-cleaned', '1');
          window.location.reload();
        }
      })
      .catch(() => undefined);

    if ('caches' in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith('unv-nexus-')).map((key) => caches.delete(key))))
        .catch(() => undefined);
    }
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      // Check for updates every 15 minutes
      setInterval(() => registration.update(), 15 * 60 * 1000);

      // Force update check on focus (Safari clings to old SW)
      window.addEventListener('focus', () => registration.update());

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready — activate immediately
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      // When the controller changes, reload once to get fresh assets
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Safari-specific: if the SW seems stuck (old cache version), nuke and reload
      if (isSafari()) {
        try {
          const cacheKeys = await caches.keys();
          const hasOldCache = cacheKeys.some(
            (k) => k.startsWith('unv-nexus-') && k !== 'unv-nexus-v3'
          );
          if (hasOldCache) {
            await Promise.all(cacheKeys.map((k) => caches.delete(k)));
            window.location.reload();
            return;
          }
        } catch {}
      }

      console.log('[SW] Service Worker registrado.');
    } catch (error) {
      console.error('[SW] Falha ao registrar:', error);
    }
  });
}

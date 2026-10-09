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
        if (navigator.serviceWorker.controller && !localStorage.getItem('sw-dev-cleaned')) {
          localStorage.setItem('sw-dev-cleaned', '1');
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

  const doRegister = async () => {
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

      // Safari: limpa cache de versão antiga que o SW não conseguiu apagar.
      // A versão atual é perguntada ao próprio SW (nunca fixa aqui): em 08/10/2026 o
      // sw.js passou de v4 pra v5 com "v4" fixo neste arquivo, e todo iPhone entrou
      // num laço de apagar cache + recarregar sem fim ("tela piscando" no lançamento
      // de KPIs). Sem reload: o activate do SW já cuida da troca.
      if (isSafari() && navigator.serviceWorker.controller) {
        try {
          const current = await new Promise<string | null>((resolve) => {
            const channel = new MessageChannel();
            const timer = setTimeout(() => resolve(null), 1500);
            channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data?.cacheName || null); };
            navigator.serviceWorker.controller!.postMessage({ type: 'GET_CACHE_NAME' }, [channel.port2]);
          });
          if (current) {
            const cacheKeys = await caches.keys();
            const old = cacheKeys.filter((k) => k.startsWith('unv-nexus-') && k !== current);
            if (old.length) await Promise.all(old.map((k) => caches.delete(k)));
          }
        } catch (error) {
          console.warn('[SW] Falha ao limpar cache antigo:', error);
        }
      }

      console.log('[SW] Service Worker registrado.');
    } catch (error) {
      console.error('[SW] Falha ao registrar:', error);
    }
  };

  // O registro precisa acontecer mesmo que o evento `load` JÁ tenha disparado.
  // Como registerServiceWorker() roda depois de um bootstrap assíncrono, a página
  // frequentemente já está 'complete' aqui — nesse caso o listener de 'load'
  // nunca dispararia e o SW nunca registraria (PWA deixa de ser instalável).
  if (document.readyState === 'complete') {
    void doRegister();
  } else {
    window.addEventListener('load', () => void doRegister());
  }
}

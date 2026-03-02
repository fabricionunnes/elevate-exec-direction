export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // Check for updates periodically (every 60 min)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // New version available — reload silently on next navigation
              console.log('[SW] Nova versão disponível.');
            }
          });
        });

        console.log('[SW] Service Worker registrado com sucesso.');
      } catch (error) {
        console.error('[SW] Falha ao registrar Service Worker:', error);
      }
    });
  }
}

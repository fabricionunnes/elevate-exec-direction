// Service worker do painel: recebe a notificação de pedido novo mesmo com o app fechado.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Yas Delícias";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    requireInteraction: true,
    icon: "/icon-192.png",
    badge: "/favicon-96.png",
    vibrate: [300, 120, 300, 120, 600],
    data: { url: d.url || "/admin/pedidos" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin/pedidos", self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.location.origin)) {
        try { await c.focus(); } catch (_) { /* sem foco */ }
        try { if ("navigate" in c) await c.navigate(url); } catch (_) { /* não controlado */ }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

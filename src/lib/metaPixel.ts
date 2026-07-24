// Pixel do Meta escopado às páginas do UNV Start (não carregar no app inteiro).
// O Purchase já é disparado server-side via CAPI no gate de pagamento
// (unv-start-checkout); aqui ficam os eventos de navegador do topo do funil.

export const META_PIXEL_ID = "247392077001023";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let initialized = false;

export function initMetaPixel() {
  if (typeof window === "undefined") return;
  if (!window.fbq) {
    const n: any = (window.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  if (!initialized) {
    initialized = true;
    window.fbq("init", META_PIXEL_ID);
  }
  window.fbq("track", "PageView");
}

export function trackMetaEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

// Notificação no celular com o app fechado (Web Push). No iPhone só funciona com o painel
// adicionado à Tela de Início e aberto por lá (iOS 16.4+).
import { supabase } from "./supabase";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function keyBytes(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "Navegador";
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Liga a notificação neste aparelho. Precisa ser chamado num toque (o navegador pede permissão). */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error(isIOS() && !isStandalone() ? "No iPhone, primeiro adicione o painel à Tela de Início e abra por lá." : "Este navegador não recebe notificação.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão negada. Libere as notificações do site nas configurações do celular.");

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const { data, error } = await supabase.functions.invoke<{ publicKey?: string; error?: string }>("yasfood-push", { body: { action: "public_key" } });
  if (error || !data?.publicKey) throw new Error(data?.error ?? "Não consegui falar com o servidor de notificação.");

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // inscrição antiga com outra chave: refaz
    const old = sub.options?.applicationServerKey;
    const same = old && btoa(String.fromCharCode(...new Uint8Array(old))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === data.publicKey;
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) });

  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error("O navegador não devolveu as chaves da inscrição.");
  const { error: upErr } = await supabase.from("push_subscriptions").upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, device: deviceName(), fail_count: 0 },
    { onConflict: "endpoint" },
  );
  if (upErr) throw new Error(upErr.message);
}

/** Desliga a notificação neste aparelho. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<{ sent: number; devices: number }> {
  const { data, error } = await supabase.functions.invoke<{ sent?: number; devices?: number; error?: string }>("yasfood-push", { body: { action: "test" } });
  if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Falhou");
  return { sent: data?.sent ?? 0, devices: data?.devices ?? 0 };
}

/** Pede pro servidor avisar os pedidos novos (idempotente: cada pedido avisa uma vez só). */
export function notifyNewOrders() {
  void supabase.functions.invoke("yasfood-push", { body: { action: "notify" } }).catch(() => undefined);
}

// Push do navegador/PWA: ativa, desativa e confere o estado. A chave pública pode ficar no código.
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BGP7R6X7YFx4K-rDBGRA4XE3zgQLAgmVs6NawWs2zVsVMRfkayCHG-KA_bKd5IoqjkXwYT0M113of-KrjuXqJ7g";

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export type PushState = "unsupported" | "ios_needs_install" | "denied" | "off" | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export async function getPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIOS() && !isStandalone() ? "ios_needs_install" : "unsupported";
  }
  if (isIOS() && !isStandalone()) return "ios_needs_install";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(): Promise<PushState> {
  const st = await getPushState();
  if (st === "unsupported" || st === "ios_needs_install" || st === "denied") return st;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Faça login de novo pra ativar as notificações.");
  const { error } = await (supabase as any).from("push_subscriptions").upsert(
    { auth_user_id: user.id, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user_agent: navigator.userAgent.slice(0, 250) },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* segue */ }
  return "off";
}

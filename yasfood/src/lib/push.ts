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

/** Estado do aparelho, pra diagnóstico. */
export function pushEnv() {
  const iosMatch = navigator.userAgent.match(/OS (\d+)[._](\d+)/);
  return {
    ios: isIOS(),
    ios_version: iosMatch ? `${iosMatch[1]}.${iosMatch[2]}` : null,
    standalone: isStandalone(),
    has_sw: "serviceWorker" in navigator,
    has_push: typeof window !== "undefined" && "PushManager" in window,
    has_notification: typeof window !== "undefined" && "Notification" in window,
    permission: typeof Notification !== "undefined" ? Notification.permission : "indisponivel",
    ua: navigator.userAgent.slice(0, 180),
  };
}

/** Grava um passo da tentativa de ligar (só a admin consegue gravar). Nunca quebra o fluxo. */
export async function logPush(step: string, ok: boolean, extra: Record<string, unknown> = {}) {
  try { await supabase.from("push_debug").insert({ step, ok, info: { ...pushEnv(), ...extra } }); } catch { /* sem log */ }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Liga a notificação neste aparelho. Precisa ser chamado num toque (o navegador pede permissão). */
export async function enablePush(): Promise<void> {
  await logPush("inicio", true);
  if (!pushSupported()) {
    const msg = isIOS() && !isStandalone()
      ? "Abra pelo ícone Yas Painel da Tela de Início (não pelo Safari)."
      : isIOS() ? "Esse iPhone não recebe notificação de site. Precisa do iOS 16.4 ou mais novo (Ajustes > Geral > Atualização de Software)." : "Este navegador não recebe notificação.";
    await logPush("sem_suporte", false, { msg });
    throw new Error(msg);
  }
  // pede a permissão primeiro, ainda dentro do toque (o iPhone exige)
  const perm = await Notification.requestPermission();
  await logPush("permissao", perm === "granted", { perm });
  if (perm !== "granted") {
    throw new Error(perm === "denied"
      ? "A notificação foi bloqueada. No iPhone: Ajustes > Notificações > Yas Painel > Permitir Notificações. Se não aparecer lá, apague o ícone e adicione de novo à Tela de Início."
      : "Você não tocou em Permitir. Toque em Ligar de novo e escolha Permitir.");
  }

  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  } catch (e) {
    await logPush("service_worker", false, { erro: (e as Error).message });
    throw new Error("Não consegui registrar o serviço de notificação neste aparelho.");
  }

  const { data, error } = await supabase.functions.invoke<{ publicKey?: string; error?: string }>("yasfood-push", { body: { action: "public_key" } });
  if (error || !data?.publicKey) {
    await logPush("chave", false, { erro: data?.error ?? error?.message });
    throw new Error(data?.error ?? "Não consegui falar com o servidor de notificação.");
  }

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // inscrição antiga com outra chave: refaz
    const old = sub.options?.applicationServerKey;
    const same = old && btoa(String.fromCharCode(...new Uint8Array(old))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === data.publicKey;
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) });
    } catch (e) {
      await logPush("inscricao", false, { erro: (e as Error).message });
      throw new Error(`O aparelho recusou a inscrição: ${(e as Error).message}`);
    }
  }

  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error("O navegador não devolveu as chaves da inscrição.");
  const { error: upErr } = await supabase.from("push_subscriptions").upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, device: deviceName(), fail_count: 0 },
    { onConflict: "endpoint" },
  );
  if (upErr) { await logPush("salvar", false, { erro: upErr.message }); throw new Error(upErr.message); }
  await logPush("ligado", true, { endpoint_host: new URL(json.endpoint).host });
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

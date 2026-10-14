// Notificação no celular da Yasmim (Web Push), mesmo com o app fechado.
// Ações (POST JSON):
//   { action: "public_key" }  → chave pública VAPID (cria o par na primeira vez)
//   { action: "notify" }      → avisa os pedidos novos ainda não avisados (qualquer um pode chamar; é idempotente)
//   { action: "test" }        → manda uma notificação de teste (só a administradora)
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateVapidKeys, sendPush, type PushSub } from "./webpush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { db: { schema: "yasfood" }, auth: { persistSession: false } });

interface Keys { public_key: string; private_jwk: JsonWebKey }

async function vapidKeys(): Promise<Keys> {
  const { data } = await db.from("push_keys").select("public_key, private_jwk").eq("id", 1).maybeSingle();
  if (data) return data as Keys;
  const k = await generateVapidKeys();
  // corrida entre duas chamadas: quem chegar primeiro grava, a outra relê
  await db.from("push_keys").upsert({ id: 1, public_key: k.publicKey, private_jwk: k.privateJwk }, { onConflict: "id", ignoreDuplicates: true });
  const { data: again, error } = await db.from("push_keys").select("public_key, private_jwk").eq("id", 1).single();
  if (error) throw new Error(`Não consegui guardar a chave: ${error.message}`);
  return again as Keys;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function quando(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const amanha = new Date(hoje.getTime() + 86400000);
  const amanhaIso = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;
  if (dateIso === hojeIso) return "hoje";
  if (dateIso === amanhaIso) return "amanhã";
  return `${WD[dt.getUTCDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

async function broadcast(payload: Record<string, unknown>, topic?: string) {
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, fail_count");
  if (!subs?.length) return { sent: 0, devices: 0 };
  const keys = await vapidKeys();
  const { data: s } = await db.from("settings").select("site_url").eq("id", 1).maybeSingle();
  const subject = (s?.site_url as string | undefined)?.startsWith("https://") ? (s!.site_url as string) : "https://yasfood.unvholdings.workers.dev";
  let sent = 0;
  await Promise.all(subs.map(async (sub: PushSub & { id: string; fail_count: number }) => {
    try {
      const r = await sendPush(sub, payload, { publicKey: keys.public_key, privateJwk: keys.private_jwk, subject }, { urgency: "high", topic });
      if (r.status >= 200 && r.status < 300) {
        sent++;
        await db.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), fail_count: 0 }).eq("id", sub.id);
      } else if (r.status === 404 || r.status === 410) {
        await db.from("push_subscriptions").delete().eq("id", sub.id); // aparelho desinstalou ou desativou
      } else {
        console.error("push falhou", r.status, r.body.slice(0, 200));
        await db.from("push_subscriptions").update({ fail_count: sub.fail_count + 1 }).eq("id", sub.id);
      }
    } catch (e) {
      console.error("push erro", (e as Error).message);
    }
  }));
  return { sent, devices: subs.length };
}

async function isAdmin(auth: string | null) {
  if (!auth) return false;
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "Método não permitido" }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action ?? "notify";

    if (action === "public_key") {
      const k = await vapidKeys();
      return j({ publicKey: k.public_key });
    }

    if (action === "test") {
      if (!(await isAdmin(req.headers.get("Authorization")))) return j({ error: "Só a administradora." }, 403);
      const r = await broadcast({ title: "Teste da Yas Delícias", body: "Notificação funcionando. Pedido novo vai aparecer assim.", url: "/admin/pedidos", tag: "teste" });
      return j(r);
    }

    if (action === "notify") {
      // pega os pedidos novos ainda não avisados e marca antes de enviar (duas chamadas juntas não duplicam)
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: claimed, error } = await db
        .from("orders")
        .update({ push_notified_at: new Date().toISOString() })
        .eq("status", "recebido")
        .is("push_notified_at", null)
        .gte("created_at", since)
        .select("id, code, customer_name, total, scheduled_date, window_label, fulfillment");
      if (error) return j({ error: error.message }, 500);
      let sent = 0;
      for (const o of claimed ?? []) {
        const r = await broadcast({
          title: `Novo pedido ${o.code}`,
          body: `${o.customer_name} · ${brl(Number(o.total))} · ${quando(o.scheduled_date)}${o.window_label ? ` ${o.window_label}` : ""} · ${o.fulfillment === "entrega" ? "entrega" : "retirada"}. Toque pra aceitar.`,
          url: "/admin/pedidos",
          tag: o.id,
        }, o.code);
        sent += r.sent;
      }
      return j({ orders: claimed?.length ?? 0, sent });
    }

    return j({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

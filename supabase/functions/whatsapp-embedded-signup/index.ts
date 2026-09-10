// whatsapp-embedded-signup (Nexus): fecha o Cadastro Incorporado (Embedded Signup) da Meta.
// O front abre a janela da Meta (FB.login com config_id) e recebe {code, waba_id, phone_number_id};
// aqui: troca o code por token de negócio, inscreve o app na WABA (webhooks), registra o número
// na Cloud API (PIN de 2 etapas gerado aqui) e cria a instância oficial.
// Auth: staff master/admin (onboarding_staff). Secrets: META_APP_ID, META_APP_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_ID = Deno.env.get("META_APP_ID") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const GRAPH = "https://graph.facebook.com/v21.0";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function graph(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`${GRAPH}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Graph ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!APP_ID || !APP_SECRET) return j({ error: "meta_nao_configurado", detail: "META_APP_ID/META_APP_SECRET não configurados." }, 500);
    const anon = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return j({ error: "nao_autorizado" }, 401);
    const { data: staff } = await admin.from("onboarding_staff").select("id, role, is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff || !["master", "admin", "head_comercial"].includes(staff.role)) return j({ error: "sem_permissao" }, 403);

    const body = await req.json().catch(() => ({}));
    const { code, waba_id: wabaId, phone_number_id: phoneNumberId, display_name } = body;
    if (!code || !wabaId || !phoneNumberId) return j({ error: "dados_invalidos", detail: "code, waba_id e phone_number_id são obrigatórios." }, 400);

    const tokRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`);
    const tok = await tokRes.json().catch(() => ({}));
    if (!tokRes.ok || !tok.access_token) return j({ error: "token", detail: tok?.error?.message || "Falha ao trocar o código pelo token." }, 502);
    const token: string = tok.access_token;

    await graph(`/${wabaId}/subscribed_apps`, token, { method: "POST" });
    const info = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, token);
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    let registered = false, registerError: string | null = null;
    try {
      await graph(`/${phoneNumberId}/register`, token, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
      registered = true;
    } catch (e) { registerError = (e as Error).message; if (/already/i.test(registerError)) registered = true; }

    const phone = String(info.display_phone_number || "").replace(/\D/g, "");
    const { data: existing } = await admin.from("whatsapp_official_instances").select("id").eq("phone_number_id", phoneNumberId).maybeSingle();
    const row = {
      display_name: display_name || info.verified_name || info.display_phone_number || "WhatsApp Oficial",
      waba_id: wabaId, phone_number_id: phoneNumberId, phone_number: phone || null, access_token: token,
      status: registered ? "connected" : "pending", last_error: registered ? null : registerError, created_by: user.id, show_in_inbox: true,
    };
    let instanceId = existing?.id;
    if (existing) await admin.from("whatsapp_official_instances").update(row).eq("id", existing.id);
    else {
      const { data: ins, error } = await admin.from("whatsapp_official_instances").insert({ ...row, webhook_verify_token: crypto.randomUUID().replace(/-/g, "") }).select("id").single();
      if (error) return j({ error: "db", detail: error.message }, 500);
      instanceId = ins.id;
    }
    return j({ ok: true, instanceId, registered, registerError, phone: info.display_phone_number, name: info.verified_name, quality: info.quality_rating });
  } catch (e) {
    return j({ error: (e as Error)?.message || String(e) }, 500);
  }
});

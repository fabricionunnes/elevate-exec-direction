// asaas-setup-webhooks — confere e ajusta o webhook do Nexus em cada conta do Asaas.
//
// Até 13/11/2026 esta função regravava o webhook com só 7 eventos e authToken null: uma chamada
// apagava os eventos do Pix Automático e de transferência e tirava o token. Agora ela nunca mexe
// em eventos nem recria nada. O que faz:
//   POST {}                         só lista, nada muda: por conta, se o webhook existe, se tem token,
//                                   se a fila está parada e quantos eventos assina.
//   POST { aplicar_token: true }    grava o 1º token de ASAAS_WEBHOOK_TOKEN como authToken do webhook
//                                   (atualização parcial: nome, eventos e o resto ficam como estão).
//   POST { reativar_fila: true }    religa a fila que o Asaas parou depois de falhas seguidas.
//   Os dois podem ir juntos. "contas": ["principal", "social"] limita por nome (trecho, sem acento).
//
// Quem pode chamar: staff master ou admin logado, ou quem manda o próprio token do webhook no
// cabeçalho x-setup-token (quem já tem o token só consegue regravar ele mesmo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_BASE = "https://api.asaas.com/v3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/asaas-webhook`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function iguaisSeguro(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) dif |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return dif === 0;
}
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const tokensDoWebhook = () =>
  (Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "").split(",").map((t) => t.trim()).filter((t) => t.length >= 32);

async function asaas(key: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* noop */ }
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas HTTP ${res.status}`);
  return data;
}

// Mesma ordem das funções de cobrança: chave da conta no banco, depois pelo nome do segredo.
async function chaveDaConta(supabase: any, acc: { id: string; api_key_secret_name: string | null }): Promise<string> {
  const { data: porRef } = await supabase.from("tenant_integration_secrets")
    .select("secret_value").eq("provider", "asaas").eq("reference_id", acc.id).limit(1);
  if (porRef?.[0]?.secret_value) return porRef[0].secret_value as string;
  if (acc.api_key_secret_name) {
    const { data: porNome } = await supabase.from("tenant_integration_secrets")
      .select("secret_value").eq("secret_name", acc.api_key_secret_name).limit(1);
    return (porNome?.[0]?.secret_value as string) || Deno.env.get(acc.api_key_secret_name) || "";
  }
  return "";
}

async function podeChamar(req: Request, supabase: any): Promise<boolean> {
  const enviado = (req.headers.get("x-setup-token") || "").trim();
  if (enviado && tokensDoWebhook().some((t) => iguaisSeguro(enviado, t))) return true;
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  if (iguaisSeguro(jwt, SERVICE_ROLE)) return true;
  const { data: u } = await supabase.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: staff } = await supabase.from("onboarding_staff").select("role")
    .eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
  return !!staff && ["master", "admin"].includes(String(staff.role));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  if (!(await podeChamar(req, supabase))) return j({ ok: false, error: "não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio = só listar */ }
  const aplicarToken = body?.aplicar_token === true;
  const reativarFila = body?.reativar_fila === true;
  const filtro: string[] = Array.isArray(body?.contas) ? body.contas.map((c: unknown) => semAcento(String(c))) : [];

  const token = tokensDoWebhook()[0] || "";
  if (aplicarToken && !token) return j({ ok: false, error: "ASAAS_WEBHOOK_TOKEN não está configurado (mínimo 32 caracteres)" }, 400);

  const { data: accounts, error } = await supabase.from("asaas_accounts")
    .select("id, name, api_key_secret_name, is_active, tenant_id").eq("is_active", true).order("created_at", { ascending: true });
  if (error) return j({ ok: false, error: error.message }, 500);

  const contas: unknown[] = [];
  for (const acc of accounts || []) {
    if (filtro.length && !filtro.some((f) => semAcento(String(acc.name)).includes(f))) continue;
    const linha: Record<string, unknown> = { conta: acc.name, de_tenant: !!acc.tenant_id };
    try {
      const key = await chaveDaConta(supabase, acc);
      if (!key) { linha.situacao = "chave da conta não encontrada"; contas.push(linha); continue; }
      if (aplicarToken && iguaisSeguro(key, token)) { linha.situacao = "token igual à chave da conta, recusado"; contas.push(linha); continue; }

      const lista = await asaas(key, "/webhooks?limit=100", "GET");
      const hooks = (lista?.data || []).filter((h: any) => String(h.url || "") === WEBHOOK_URL);
      linha.webhooks_na_conta = (lista?.data || []).length;
      if (!hooks.length) { linha.situacao = "sem webhook apontando pro Nexus"; contas.push(linha); continue; }

      linha.webhooks = [];
      for (const h of hooks) {
        const antes = { tem_token: !!h.hasAuthToken, fila_parada: !!h.interrupted, ligado: !!h.enabled };
        const patch: Record<string, unknown> = {};
        if (aplicarToken) patch.authToken = token;
        if (reativarFila && h.interrupted) patch.interrupted = false;
        let depois: Record<string, unknown> | null = null;
        if (Object.keys(patch).length) {
          const r = await asaas(key, `/webhooks/${h.id}`, "PUT", patch);
          depois = { tem_token: !!r?.hasAuthToken, fila_parada: !!r?.interrupted, ligado: !!r?.enabled, eventos: (r?.events || []).length };
        }
        (linha.webhooks as unknown[]).push({
          id: h.id, nome: h.name, envio: h.sendType, eventos: (h.events || []).length,
          pix_automatico: (h.events || []).filter((e: string) => String(e).startsWith("PIX_AUTOMATIC_")).length,
          penalizados: h.penalizedRequestsCount ?? null,
          ...antes, alterado: depois,
        });
      }
      linha.situacao = "ok";
    } catch (e) {
      linha.situacao = `erro: ${String((e as Error).message || e).slice(0, 200)}`;
    }
    contas.push(linha);
  }

  console.log("[asaas-setup-webhooks]", JSON.stringify({ aplicarToken, reativarFila, contas }));
  return j({
    ok: true, webhook_url: WEBHOOK_URL, aplicou_token: aplicarToken, reativou_fila: reativarFila,
    token_configurado_no_nexus: !!token, modo: (Deno.env.get("ASAAS_WEBHOOK_AUTH_MODE") || "observar").trim().toLowerCase(),
    contas,
  });
});

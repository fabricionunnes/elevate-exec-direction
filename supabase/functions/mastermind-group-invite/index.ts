import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Normaliza telefone BR -> só dígitos com DDI 55
function normalizePhone(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d; // DDD + número
  if (d.length >= 12) return d;
  return null;
}

async function stevo(baseUrl: string, apiKey: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { "Content-Type": "application/json", apikey: apiKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }); }

  const action = String(body.action || "");
  const instanceName = String(body.instance_name || "fabricionunnes");

  // Resolve a instância (URL + chave)
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, api_url, api_key, status")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!instance?.api_url || !instance?.api_key) {
    return j({ ok: false, error: `Instância '${instanceName}' não encontrada ou sem credenciais` });
  }
  const baseUrl = instance.api_url as string;
  const apiKey = instance.api_key as string;

  // ── Lista grupos da instância pra o admin escolher o Mastermind ──
  if (action === "list_groups") {
    const r = await stevo(baseUrl, apiKey, "GET", "/group/list");
    if (!r.ok) return j({ ok: false, error: `Falha ao listar grupos (HTTP ${r.status})`, detail: r.data });
    let raw = r.data;
    let groups: any[] = Array.isArray(raw) ? raw : (raw?.data || raw?.groups || []);
    if (!Array.isArray(groups) && raw && typeof raw === "object") groups = Object.values(raw);
    const list = (groups || [])
      .map((g: any) => ({
        jid: g.JID || g.jid || g.id || g.groupJid || "",
        name: g.Name || g.name || g.subject || g.Subject || "(sem nome)",
      }))
      .filter((g: any) => g.jid)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));
    return j({ ok: true, groups: list, count: list.length });
  }

  // ── Gera link do grupo e (opcionalmente) dispara pros clientes ──
  if (action === "send" || action === "preview") {
    const groupJid = String(body.group_jid || "");
    if (!groupJid) return j({ ok: false, error: "group_jid obrigatório" });

    // 1) Gera o link de convite do grupo
    const inv = await stevo(baseUrl, apiKey, "POST", "/group/invitelink", { groupJid });
    const link = inv?.data?.data || inv?.data?.link || inv?.data?.inviteLink || "";
    if (!inv.ok || !link) {
      return j({ ok: false, error: "Não consegui gerar o link do grupo. Confirme que a instância é ADMIN do grupo.", detail: inv.data });
    }

    // 2) Clientes ativos com telefone
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name, owner_name, owner_phone, phone, status")
      .eq("status", "active");
    const recipients = (companies || [])
      .map((c: any) => ({ name: c.owner_name || c.name, company: c.name, phone: normalizePhone(c.owner_phone || c.phone) }))
      .filter((c: any) => c.phone);

    const template = String(body.message_template ||
      "Fala, {nome}. Aqui é o Fabrício.\n\nTô te chamando pro grupo do UNV Mastermind — nosso círculo de empresários. Entra por aqui:\n\n{link}");
    const render = (name: string) => template.replace(/\{nome\}/g, (name || "").split(" ")[0] || "").replace(/\{link\}/g, link);

    // Preview / dry-run: devolve link + destinatários sem enviar
    if (action === "preview") {
      return j({ ok: true, link, total: recipients.length, sample: recipients.slice(0, 5).map((r) => ({ name: r.name, company: r.company })), example_message: render(recipients[0]?.name || "Fulano") });
    }

    // 3) Envia pra cada cliente com intervalo (evita bloqueio)
    let sent = 0, failed = 0;
    const errors: { company: string; error: string }[] = [];
    for (const r of recipients) {
      try {
        const res = await stevo(baseUrl, apiKey, "POST", "/send/text", { number: r.phone, text: render(r.name) });
        if (res.ok) sent++; else { failed++; errors.push({ company: r.company, error: `HTTP ${res.status}` }); }
      } catch (e) {
        failed++; errors.push({ company: r.company, error: String((e as Error).message || e) });
      }
      await sleep(900);
    }
    return j({ ok: true, link, total: recipients.length, sent, failed, errors: errors.slice(0, 20) });
  }

  return j({ ok: false, error: "ação inválida (use list_groups, preview ou send)" });
});

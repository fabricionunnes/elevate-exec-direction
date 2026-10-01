// crm-flow-dispatch: a parte dos Fluxos do CRM que fala com fora (01/10/2026).
// O banco decide O QUE fazer (crm_flow_tick / crm_flow_exec_node) e grava em crm_flow_outbox;
// esta função só ENVIA:
//   lead_whatsapp  → bloco "Enviar WhatsApp" (texto já renderizado, janela de horário já aplicada)
//   staff_whatsapp → bloco "Avisar pessoas" no WhatsApp do vendedor/gestor
//   webhook        → bloco "Webhook" (com mapeamento de campos e leitura opcional da resposta)
//
// Quem chama: o próprio crm_flow_tick (pg_cron, a cada minuto), só quando existe item vencido,
// com o header x-flow-secret (secret FLOW_SECRET = app_secrets.flow_secret).
// Corpo opcional: { dry_run: true } lista o que sairia agora (instância, telefone, texto) sem
// reservar nem enviar nada; { limit: n } muda o tamanho do lote.
//
// Travas: item de fluxo desligado nem chega aqui (crm_flow_outbox_claim filtra); item cujo run
// foi cancelado é cancelado; WhatsApp nunca reenvia sozinho depois de uma falha de rede no meio
// (pode ter saído); webhook tenta 3 vezes; destino de webhook em rede interna é recusado.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { "Content-Type": "application/json" } });
const digits = (p: string | null | undefined) => String(p || "").replace(/\D/g, "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOTE = 20;
const PAUSA_ENTRE_ENVIOS_MS = 1200; // não metralhar o número

function brPhone(raw: string | null | undefined): string {
  let p = digits(raw).replace(/^0+/, "");
  if (p && !p.startsWith("55") && (p.length === 10 || p.length === 11)) p = "55" + p;
  return p;
}
function isManagerV2Url(input?: string | null) {
  try { return new URL(String(input || "").replace(/\/+$/g, "")).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { return false; }
}
const normalizeBaseUrl = (u: string) => String(u || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");

type Envio = { ok: boolean; error?: string; remoteId?: string | null; remoteJid?: string; ecoa?: boolean; incerto?: boolean };

// Mesmo envio do crm-scheduled-dispatch / evolution-api action=sendText.
async function sendEvolution(inst: any, phone: string, message: string): Promise<Envio> {
  const apiUrl = inst.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: `Número ${inst.instance_name} sem api_url/api_key` };
  const base = normalizeBaseUrl(apiUrl);
  const v2 = inst.provider_type === "manager_v2" || isManagerV2Url(base);
  let r: Response;
  try {
    r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
      method: "POST",
      headers: v2
        ? { "Content-Type": "application/json", apikey: apiKey }
        : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
      body: JSON.stringify(v2 ? { number: phone, text: message, delay: 0 } : { number: phone, text: message }),
    });
  } catch (e) {
    // a conexão caiu no meio: pode ter saído ou não
    return { ok: false, incerto: true, error: `Servidor do WhatsApp não respondeu: ${String(e).slice(0, 120)}` };
  }
  const text = await r.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  const dataStr = JSON.stringify(data || {});
  if (!r.ok) {
    if (dataStr.toLowerCase().includes("connection closed")) return { ok: false, error: "Instância WhatsApp desconectada no servidor" };
    if (dataStr.includes('"exists":false') || dataStr.includes('"exists": false')) return { ok: false, error: "Este número não possui WhatsApp" };
    return { ok: false, error: String(data?.message || data?.error || `HTTP ${r.status}: ${text.slice(0, 120)}`).slice(0, 300) };
  }
  const remoteId = data?.key?.id || data?.data?.key?.id || data?.messageId || data?.id || null;
  const remoteJid = String(data?.key?.remoteJid || data?.data?.key?.remoteJid || "");
  // Stevo/Manager V2 ecoa pelo webhook o que ele mesmo envia; a Evolution própria não
  return { ok: true, remoteId: remoteId ? String(remoteId) : null, remoteJid, ecoa: v2 };
}

// Mesmo envio do whatsapp-official-api action=sendText. Fora da janela de 24 h a Meta recusa texto livre.
async function sendOfficial(inst: any, phone: string, message: string): Promise<Envio> {
  if (!inst?.phone_number_id || !inst?.access_token) return { ok: false, error: "Número oficial sem phone_number_id/token" };
  let r: Response;
  try {
    r = await fetch(`https://graph.facebook.com/v18.0/${inst.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${inst.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { body: message } }),
    });
  } catch (e) {
    return { ok: false, incerto: true, error: `Meta não respondeu: ${String(e).slice(0, 120)}` };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: String(d?.error?.message || `HTTP ${r.status}`).slice(0, 300) };
  return { ok: true, remoteId: d?.messages?.[0]?.id ? String(d.messages[0].id) : null };
}

type Canal = { kind: "evolution" | "official"; inst: any; nome: string };

async function evolutionConectada(id: string | null | undefined): Promise<Canal | null> {
  if (!id) return null;
  const { data } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, provider_type, status, project_id, phone_number").eq("id", id).maybeSingle();
  // número de projeto de cliente nunca envia por fluxo do CRM
  if (!data || data.project_id || data.status !== "connected") return null;
  return { kind: "evolution", inst: data, nome: data.display_name || data.instance_name };
}
async function oficial(id: string | null | undefined): Promise<Canal | null> {
  if (!id) return null;
  const { data } = await supabase.from("whatsapp_official_instances")
    .select("id, display_name, phone_number_id, access_token, phone_number, status").eq("id", id).maybeSingle();
  if (!data) return null;
  return { kind: "official", inst: data, nome: data.display_name || "API oficial" };
}

// Qual número envia pro lead. Nunca cai num número qualquer: sem regra clara, falha com motivo.
async function canalDoLead(lead: any, p: any): Promise<{ canal: Canal | null; motivo?: string }> {
  const modo = String(p.instance_mode || "conversation");
  if (modo === "fixed") {
    const c = p.instance_kind === "official" ? await oficial(p.instance_id) : await evolutionConectada(p.instance_id);
    return c ? { canal: c } : { canal: null, motivo: "o número escolhido no bloco está desconectado ou não existe mais" };
  }
  if (modo === "conversation") {
    const { data: convs } = await supabase.from("crm_whatsapp_conversations")
      .select("instance_id, official_instance_id").eq("lead_id", lead.id).is("merged_into", null).is("project_id", null)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(3);
    for (const c of convs || []) {
      const canal = c.instance_id ? await evolutionConectada(c.instance_id) : await oficial(c.official_instance_id);
      if (canal) return { canal };
    }
  }
  // dono do lead: o número padrão dele (onboarding_staff.default_whatsapp_instance_id); senão o
  // ÚNICO que ele pode usar pra enviar. Master/admin enxerga vários números: aí não dá pra
  // adivinhar de qual sair, então falha com o motivo em vez de mandar pelo número errado.
  if (lead.owner_staff_id) {
    const { data: staff } = await supabase.from("onboarding_staff").select("default_whatsapp_instance_id").eq("id", lead.owner_staff_id).maybeSingle();
    const padrao = await evolutionConectada(staff?.default_whatsapp_instance_id);
    if (padrao) return { canal: padrao };
    const { data: acc } = await supabase.from("whatsapp_instance_access").select("instance_id").eq("staff_id", lead.owner_staff_id).eq("can_send", true);
    const conectados: Canal[] = [];
    for (const a of acc || []) { const c = await evolutionConectada(a.instance_id); if (c) conectados.push(c); }
    if (conectados.length === 1) return { canal: conectados[0] };
  }
  // reserva escolhida no bloco
  if (p.instance_id) {
    const c = p.instance_kind === "official" ? await oficial(p.instance_id) : await evolutionConectada(p.instance_id);
    if (c) return { canal: c };
  }
  return { canal: null, motivo: modo === "conversation" ? "o lead não tem conversa em número conectado e o dono não tem um número definido (cadastre o número padrão dele ou fixe um número no bloco)" : "o dono do lead não tem um número definido (cadastre o número padrão dele ou fixe um número no bloco)" };
}

/** Grava contato + conversa + mensagem no Atendimento (mesmo formato do crm-cadence-dispatcher). */
async function registrarNoAtendimento(a: { canal: Canal; leadId: string; leadName: string; phone: string; content: string; remoteId: string | null }) {
  const phone = digits(a.phone);
  if (!phone) return;
  let { data: contact } = await supabase.from("crm_whatsapp_contacts").select("id, lead_id").eq("phone", phone).maybeSingle();
  if (!contact) {
    const { data: created, error } = await supabase.from("crm_whatsapp_contacts")
      .insert({ phone, name: a.leadName || phone, lead_id: a.leadId }).select("id, lead_id").single();
    if (error) throw error;
    contact = created;
  }
  const col = a.canal.kind === "evolution" ? "instance_id" : "official_instance_id";
  let { data: conv } = await supabase.from("crm_whatsapp_conversations").select("id, lead_id, merged_into")
    .eq(col, a.canal.inst.id).eq("contact_id", contact!.id).neq("status", "closed")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const { data: created, error } = await supabase.from("crm_whatsapp_conversations")
      .insert({ [col]: a.canal.inst.id, contact_id: contact!.id, lead_id: a.leadId, status: "open" }).select("id, lead_id, merged_into").single();
    if (error) throw error;
    conv = created;
  }
  // o gatilho da tabela sobe a conversa e atualiza a última mensagem
  await supabase.from("crm_whatsapp_messages").insert({
    conversation_id: conv!.merged_into || conv!.id, content: a.content, type: "text", direction: "outbound", status: "sent",
    remote_id: a.remoteId, whatsapp_message_id: a.remoteId, is_ai: false, sent_by: null,
  });
}

// Destino de webhook: só http(s) público. Bloqueia localhost, IP interno e metadados de nuvem.
function urlPermitida(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "URL inválida"; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "só http ou https";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "0.0.0.0" || h === "[::1]" || h === "::1") return "destino interno não é permitido";
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)) return "destino interno não é permitido";
  }
  if (h.startsWith("[") && (h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80"))) return "destino interno não é permitido";
  return null;
}

type Resultado = { status: "sent" | "cancelled" | "failed" | "retry"; erro?: string; detalhe?: Record<string, unknown>; enviouWhats?: boolean };

async function carregarLead(id: string | null) {
  if (!id) return null;
  const { data } = await supabase.from("crm_leads")
    .select("id, name, phone, email, company, owner_staff_id, opportunity_value, pipeline:crm_pipelines(name), stage:crm_stages(name)")
    .eq("id", id).maybeSingle();
  return data as any;
}

async function processar(it: any, dry: boolean): Promise<Resultado> {
  const p = it.payload || {};

  if (it.run_id) {
    const { data: run } = await supabase.from("crm_flow_runs").select("status").eq("id", it.run_id).maybeSingle();
    if (!run) return { status: "cancelled", erro: "execução apagada" };
    if (run.status === "cancelled") return { status: "cancelled", erro: "execução cancelada" };
  }

  if (it.kind === "webhook") {
    const bloqueio = urlPermitida(String(p.url || ""));
    if (bloqueio) {
      if (!dry && it.run_id && p.wait_response) {
        await supabase.rpc("crm_flow_webhook_result", { _run_id: it.run_id, _ok: false, _http: 0, _body: { erro: bloqueio } });
      }
      return { status: "failed", erro: `Webhook: ${bloqueio}` };
    }
    const lead = await carregarLead(it.lead_id);
    const metodo = String(p.method || "POST").toUpperCase();
    const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "UNV-Nexus-Fluxos/1.0" };
    for (const h of (Array.isArray(p.headers) ? p.headers : [])) if (h?.key) headers[String(h.key)] = String(h.value ?? "");
    let body: string | undefined;
    if (p.fields && typeof p.fields === "object") body = JSON.stringify(p.fields);
    else if (typeof p.body === "string" && p.body.trim()) body = p.body;
    else body = JSON.stringify({
      event: p.trigger, flow: p.flow_name, sent_at: new Date().toISOString(),
      lead: lead ? { id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, company: lead.company,
                     value: lead.opportunity_value, pipeline: lead.pipeline?.name ?? null, stage: lead.stage?.name ?? null } : null,
      vars: p.vars ?? {},
    });
    if (metodo === "GET" || metodo === "HEAD") body = undefined;
    if (dry) return { status: "sent", detalhe: { faria: `${metodo} ${p.url}`, corpo: body?.slice(0, 500) } };
    const devolver = async (ok: boolean, http: number, texto: string) => {
      if (!it.run_id || !p.wait_response) return;
      let j: unknown = null;
      try { j = JSON.parse(texto); } catch { j = { raw: texto.slice(0, 2000) }; }
      await supabase.rpc("crm_flow_webhook_result", { _run_id: it.run_id, _ok: ok, _http: http, _body: j });
    };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(String(p.url), { method: metodo, signal: ctrl.signal, headers, body, redirect: "manual" });
      const texto = await r.text().catch(() => "");
      if (r.ok) { await devolver(true, r.status, texto); return { status: "sent", detalhe: { http: r.status } }; }
      if (it.attempts >= 3) await devolver(false, r.status, texto);
      return { status: "retry", erro: `HTTP ${r.status}`, detalhe: { http: r.status } };
    } catch (e) {
      if (it.attempts >= 3) await devolver(false, 0, String((e as Error).message || e));
      return { status: "retry", erro: String((e as Error).message || e).slice(0, 200) };
    } finally { clearTimeout(t); }
  }

  if (it.kind === "staff_whatsapp") {
    const { data: s } = await supabase.from("onboarding_staff").select("name, phone, is_active").eq("id", p.staff_id).maybeSingle();
    const fone = brPhone(s?.phone);
    if (!s?.is_active) return { status: "cancelled", erro: "pessoa inativa" };
    if (fone.length < 12) return { status: "cancelled", erro: `${s?.name || "pessoa"} sem telefone no cadastro` };
    // número que envia os avisos: o escolhido no bloco, senão o de avisos do CRM (Configurações)
    let canal = await evolutionConectada(p.instance_id);
    if (!canal) {
      const { data: cfg } = await supabase.from("crm_settings").select("setting_value").eq("setting_key", "lead_notification_instance_name").maybeSingle();
      const nome = typeof cfg?.setting_value === "string" ? cfg.setting_value : null;
      if (nome) {
        const { data: inst } = await supabase.from("whatsapp_instances").select("id").eq("instance_name", nome).is("project_id", null).maybeSingle();
        canal = await evolutionConectada(inst?.id);
      }
    }
    if (!canal) return { status: "failed", erro: "nenhum número conectado pra mandar avisos (escolha um no bloco ou em Configurações)" };
    if (brPhone(canal.inst.phone_number) === fone) return { status: "cancelled", erro: "o número de avisos é o da própria pessoa" };
    if (dry) return { status: "sent", detalhe: { faria: `aviso pra ${s.name} (${fone}) pelo número ${canal.nome}`, mensagem: String(p.message || "").slice(0, 300) } };
    const r = await sendEvolution(canal.inst, fone, String(p.message || ""));
    return r.ok ? { status: "sent", enviouWhats: true, detalhe: { para: s.name, numero: canal.nome } }
                : { status: "failed", erro: r.error, detalhe: { para: s.name, numero: canal.nome } };
  }

  if (it.kind === "lead_whatsapp") {
    const lead = await carregarLead(it.lead_id);
    if (!lead) return { status: "cancelled", erro: "lead não existe mais" };
    const fone = brPhone(lead.phone);
    if (fone.length < 12) return { status: "cancelled", erro: "lead sem telefone válido" };
    const texto = String(p.message || "");
    if (!texto.trim()) return { status: "cancelled", erro: "mensagem vazia" };
    const { canal, motivo } = await canalDoLead(lead, p);
    if (!canal) return { status: "failed", erro: `Sem número pra enviar: ${motivo}` };
    if (dry) return { status: "sent", detalhe: { faria: `WhatsApp pra ${lead.name} (${fone}) pelo número ${canal.nome}`, mensagem: texto.slice(0, 300) } };
    const r = canal.kind === "evolution" ? await sendEvolution(canal.inst, fone, texto) : await sendOfficial(canal.inst, fone, texto);
    if (!r.ok) return { status: "failed", erro: r.error, detalhe: { numero: canal.nome, incerto: !!r.incerto } };
    // Evolution própria não ecoa o próprio envio: sem gravar aqui a mensagem sai e não aparece no
    // Atendimento. Stevo/V2 ecoa pelo webhook, então lá não grava (gravar dos dois lados duplica).
    if (!r.ecoa) {
      try {
        const jidFone = r.remoteJid ? digits(r.remoteJid.split("@")[0]) : "";
        await registrarNoAtendimento({ canal, leadId: lead.id, leadName: lead.name || "", phone: jidFone || fone, content: texto, remoteId: r.remoteId ?? null });
      } catch (e) {
        console.error("[crm-flow-dispatch] enviou mas não gravou no Atendimento:", (e as Error).message);
      }
    }
    return { status: "sent", enviouWhats: true, detalhe: { numero: canal.nome, telefone: fone } };
  }

  return { status: "cancelled", erro: `tipo desconhecido: ${it.kind}` };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("FLOW_SECRET");
  if (!secret || req.headers.get("x-flow-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const dry = !!body?.dry_run;
  const limite = Math.max(1, Math.min(Number(body?.limit) || LOTE, 50));

  let itens: any[] = [];
  if (dry) {
    // só olha: o que está vencido e sairia agora (inclui item de fluxo desligado, marcado como tal)
    const { data, error } = await supabase.from("crm_flow_outbox").select("*, flow:crm_flows(is_active, name)")
      .eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(limite);
    if (error) return json({ error: error.message }, 500);
    itens = data || [];
  } else {
    const { data, error } = await supabase.rpc("crm_flow_outbox_claim", { _limit: limite });
    if (error) return json({ error: error.message }, 500);
    itens = data || [];
  }

  const resumo: Record<string, number> = {};
  const out: any[] = [];
  for (const it of itens) {
    let res: Resultado;
    try { res = await processar(it, dry); }
    catch (e) { res = { status: it.kind === "webhook" ? "retry" : "failed", erro: String((e as Error).message || e).slice(0, 300) }; }
    if (dry) {
      const seguraria = it.flow && !it.flow.is_active && !it.payload?.manual;
      out.push({ id: it.id, kind: it.kind, fluxo: it.flow?.name, resultado: res.status, erro: res.erro, ...res.detalhe,
                 ...(seguraria ? { obs: "fluxo desligado: fica parado até religar" } : {}) });
    } else {
      await supabase.rpc("crm_flow_outbox_result", { _id: it.id, _status: res.status, _error: res.erro ?? null, _detail: res.detalhe ?? {}, _retry_minutes: null });
      out.push({ id: it.id, kind: it.kind, resultado: res.status, erro: res.erro });
      if (res.enviouWhats) await dormir(PAUSA_ENTRE_ENVIOS_MS);
    }
    resumo[res.status] = (resumo[res.status] ?? 0) + 1;
  }
  return json({ ok: true, dry_run: dry, processados: itens.length, resumo, itens: out });
});

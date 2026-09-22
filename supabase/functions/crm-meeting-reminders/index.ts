// Lembrete de reunião pro CLIENTE (lead) — pedido do Fabrício 22/09/2026.
// Regras em crm_meeting_reminders ("X minutos/horas/dias antes, pela instância Y, com esta mensagem").
// Cron a cada 5 min chama sem body: varre reuniões do CRM (crm_activities type=meeting, pendentes)
// que entraram na janela de cada regra e manda 1 mensagem por regra por reunião (crm_meeting_reminder_runs).
// Da tela: { action: "test", reminder_id | rule, phone } manda uma amostra pro número informado;
// { action: "preview" } lista o que sairia agora sem enviar.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const TZ = "America/Sao_Paulo";
const digits = (p: string) => (p || "").replace(/\D/g, "");
const br = (p: string) => { const d = digits(p); if (!d) return ""; return d.startsWith("55") && d.length >= 12 ? d : (d.length === 10 || d.length === 11) ? `55${d}` : d; };

type Regra = {
  id: string; name: string; is_active: boolean; minutes_before: number; instance_mode: "auto" | "evolution" | "official";
  instance_id: string | null; official_instance_id: string | null; pipeline_ids: string[]; send_from: string; send_until: string; message: string;
};

// ---------- envio (mesma lógica do crm-agent-respond) ----------
async function sendEvolution(instanceId: string, phone: string, message: string) {
  const { data: inst } = await supabase.from("whatsapp_instances").select("id, instance_name, api_url, api_key, provider_type, status").eq("id", instanceId).maybeSingle();
  if (!inst) return { ok: false, error: "instância não encontrada", label: "" };
  const apiUrl = inst.api_url || Deno.env.get("EVOLUTION_API_URL"); const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "instância sem api_url/api_key", label: inst.instance_name };
  if (inst.status !== "connected") return { ok: false, error: `instância ${inst.instance_name} desconectada`, label: inst.instance_name };
  const base = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let v2 = inst.provider_type === "manager_v2";
  try { if (!v2) v2 = new URL(base).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* noop */ }
  const r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
    method: "POST", headers: v2 ? { "Content-Type": "application/json", apikey: apiKey } : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ number: phone, text: message, delay: 0 }),
  });
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`, label: inst.instance_name };
  let remoteId: string | null = null;
  try { const d = await r.json(); remoteId = d?.key?.id || d?.data?.key?.id || d?.messageId || d?.id || null; } catch { /* corpo não-JSON */ }
  return { ok: true, remoteId, label: inst.instance_name };
}
async function sendOfficial(officialId: string, phone: string, message: string) {
  const { data: inst } = await supabase.from("whatsapp_official_instances").select("id, display_name, phone_number_id, access_token").eq("id", officialId).maybeSingle();
  if (!inst?.phone_number_id || !inst?.access_token) return { ok: false, error: "instância oficial sem phone_number_id/token", label: inst?.display_name || "" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${inst.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { body: message } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: d?.error?.message || `HTTP ${r.status}`, label: inst.display_name };
  return { ok: true, remoteId: d?.messages?.[0]?.id || null, label: inst.display_name };
}

// ---------- texto ----------
const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(d);
function hojeBR(d: Date) { return fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" }); }
function quando(reuniao: Date, agora: Date) {
  const hoje = hojeBR(agora), dia = hojeBR(reuniao);
  const amanha = hojeBR(new Date(agora.getTime() + 86400000));
  if (dia === hoje) return "hoje";
  if (dia === amanha) return "amanhã";
  return `${fmt(reuniao, { weekday: "long" })}, dia ${fmt(reuniao, { day: "2-digit", month: "2-digit" })}`;
}
function render(tpl: string, v: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)).replace(/[ \t]+\n/g, "\n").trim();
}
function variaveis(lead: any, act: any, resp: any, agora: Date) {
  const r = new Date(act.scheduled_at);
  const nome = String(lead?.name || "").trim();
  return {
    nome, primeiro_nome: nome.split(/\s+/)[0] || "", empresa: lead?.company || "",
    data: fmt(r, { day: "2-digit", month: "2-digit" }), hora: fmt(r, { hour: "2-digit", minute: "2-digit" }),
    dia_semana: fmt(r, { weekday: "long" }), quando: quando(r, agora), link: act.meeting_link || "",
    responsavel: resp?.name || "", primeiro_nome_responsavel: String(resp?.name || "").split(/\s+/)[0] || "", titulo: act.title || "",
  };
}
function minutosBR(d: Date) { const [h, m] = fmt(d, { hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number); return h * 60 + m; }
const minutosDe = (t: string) => { const [h, m] = String(t || "00:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

// Janela de envio: fora dela só manda se a reunião for ANTES da janela abrir de novo.
function dentroDaJanela(regra: Regra, agora: Date, reuniao: Date) {
  const a = minutosBR(agora), de = minutosDe(regra.send_from), ate = minutosDe(regra.send_until);
  const dentro = de <= ate ? (a >= de && a <= ate) : (a >= de || a <= ate);
  if (dentro) return true;
  // próxima abertura da janela
  const prox = new Date(agora.getTime());
  const faltam = a < de ? de - a : (1440 - a) + de;
  prox.setTime(prox.getTime() + faltam * 60000);
  return reuniao.getTime() <= prox.getTime();
}

// ---------- conversa no Atendimento (pra mensagem aparecer no histórico) ----------
async function registrarNoAtendimento(lead: any, phone: string, inst: { instance_id?: string | null; official_instance_id?: string | null }, texto: string, remoteId: string | null) {
  try {
    let q = supabase.from("crm_whatsapp_conversations").select("id").eq("lead_id", lead.id);
    q = inst.instance_id ? q.eq("instance_id", inst.instance_id) : q.eq("official_instance_id", inst.official_instance_id!);
    let { data: conv } = await q.order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    if (!conv) {
      let { data: contato } = await supabase.from("crm_whatsapp_contacts").select("id").eq("phone", phone).maybeSingle();
      if (!contato) ({ data: contato } = await supabase.from("crm_whatsapp_contacts").insert({ phone, name: lead.name, lead_id: lead.id }).select("id").single());
      ({ data: conv } = await supabase.from("crm_whatsapp_conversations").insert({
        contact_id: contato!.id, lead_id: lead.id, instance_id: inst.instance_id || null, official_instance_id: inst.official_instance_id || null, status: "open",
      }).select("id").single());
    }
    if (!conv) return;
    await supabase.from("crm_whatsapp_messages").insert({ conversation_id: conv.id, content: texto, type: "text", direction: "outbound", status: "sent", remote_id: remoteId, sender_name: "Lembrete automático" });
    await supabase.from("crm_whatsapp_conversations").update({ last_message: texto.slice(0, 255), last_message_at: new Date().toISOString(), last_message_direction: "outbound" }).eq("id", conv.id);
  } catch (e) { console.error("registrarNoAtendimento", e); }
}

// instância: fixa na regra ou a da conversa mais recente do lead
async function escolherInstancia(regra: Regra, lead: any): Promise<{ instance_id?: string | null; official_instance_id?: string | null; erro?: string }> {
  if (regra.instance_mode === "evolution" && regra.instance_id) return { instance_id: regra.instance_id };
  if (regra.instance_mode === "official" && regra.official_instance_id) return { official_instance_id: regra.official_instance_id };
  const { data: conv } = await supabase.from("crm_whatsapp_conversations").select("instance_id, official_instance_id, last_message_at")
    .eq("lead_id", lead.id).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (conv?.instance_id) return { instance_id: conv.instance_id };
  if (conv?.official_instance_id) return { official_instance_id: conv.official_instance_id };
  return { erro: "lead sem conversa no WhatsApp pra saber por qual número mandar" };
}

async function enviar(inst: { instance_id?: string | null; official_instance_id?: string | null }, phone: string, texto: string) {
  return inst.instance_id ? sendEvolution(inst.instance_id, phone, texto) : sendOfficial(inst.official_instance_id!, phone, texto);
}

async function rodar(dry: boolean) {
  const agora = new Date();
  const { data: regras } = await supabase.from("crm_meeting_reminders").select("*").eq("is_active", true).order("position");
  const saida: any[] = [];
  for (const regra of (regras || []) as Regra[]) {
    const limite = new Date(agora.getTime() + regra.minutes_before * 60000).toISOString();
    const { data: acts } = await supabase.from("crm_activities")
      .select("id, lead_id, title, scheduled_at, meeting_link, created_at, responsible_staff_id, lead:crm_leads(id, name, company, phone, pipeline_id, owner_staff_id, closer_staff_id)")
      .eq("type", "meeting").eq("status", "pending").gt("scheduled_at", agora.toISOString()).lte("scheduled_at", limite).not("lead_id", "is", null).limit(200);
    for (const act of (acts || []) as any[]) {
      const lead = act.lead; if (!lead) continue;
      if (regra.pipeline_ids?.length && !regra.pipeline_ids.includes(lead.pipeline_id)) continue;
      const { data: ja } = await supabase.from("crm_meeting_reminder_runs").select("id").eq("reminder_id", regra.id).eq("activity_id", act.id).maybeSingle();
      if (ja) continue;
      const reuniao = new Date(act.scheduled_at);
      const registrar = async (status: string, extra: Record<string, unknown> = {}) => {
        if (dry) { saida.push({ regra: regra.name, lead: lead.name, reuniao: act.scheduled_at, status, ...extra }); return; }
        await supabase.from("crm_meeting_reminder_runs").insert({ reminder_id: regra.id, activity_id: act.id, lead_id: lead.id, status, ...extra });
        saida.push({ regra: regra.name, lead: lead.name, status, ...extra });
      };
      const phone = br(lead.phone || "");
      if (!phone) { await registrar("skipped", { error: "lead sem telefone" }); continue; }
      // reunião marcada DEPOIS do momento do lembrete (ex.: regra "1 dia antes" e reunião marcada há 2h): não faz sentido mandar
      if (new Date(act.created_at).getTime() > reuniao.getTime() - regra.minutes_before * 60000) { await registrar("skipped", { error: "reunião marcada depois do horário do lembrete" }); continue; }
      if (!dentroDaJanela(regra, agora, reuniao)) continue; // espera a janela abrir
      const inst = await escolherInstancia(regra, lead);
      if (inst.erro) { await registrar("skipped", { error: inst.erro, phone }); continue; }
      const resp = act.responsible_staff_id || lead.closer_staff_id || lead.owner_staff_id
        ? (await supabase.from("onboarding_staff").select("name").eq("id", act.responsible_staff_id || lead.closer_staff_id || lead.owner_staff_id).maybeSingle()).data : null;
      const texto = render(regra.message, variaveis(lead, act, resp, agora));
      if (dry) { saida.push({ regra: regra.name, lead: lead.name, reuniao: act.scheduled_at, status: "enviaria", phone, texto }); continue; }
      const r = await enviar(inst, phone, texto);
      await registrar(r.ok ? "sent" : "failed", { phone, instance_label: r.label, message: texto, error: r.ok ? null : r.error });
      if (r.ok) {
        await registrarNoAtendimento(lead, phone, inst, texto, r.remoteId || null);
        await supabase.rpc("crm_meeting_reminder_touch", { p_id: regra.id }).then(() => {}, () => {});
      }
    }
  }
  return saida;
}

function papelDoToken(auth: string): string {
  try { const t = auth.replace(/^Bearer\s+/i, ""); const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return String(p.role || ""); } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const auth = req.headers.get("Authorization") || "";
    const papel = papelDoToken(auth);
    const action = String(body.action || "run");

    if (action === "run") {
      if (!["service_role", "anon"].includes(papel)) return json({ error: "só o agendador roda o envio" }, 403);
      return json({ ok: true, resultado: await rodar(false) });
    }

    // chamadas da tela: precisa ser alguém da equipe logado
    const { data: userData } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } }).auth.getUser();
    const uid = userData?.user?.id;
    const { data: staff } = uid ? await supabase.from("onboarding_staff").select("id, name, phone").eq("user_id", uid).eq("is_active", true).maybeSingle() : { data: null };
    if (!staff) return json({ error: "sem permissão" }, 403);

    if (action === "preview") return json({ ok: true, resultado: await rodar(true) });

    if (action === "test") {
      const regra: Regra = body.rule || (await supabase.from("crm_meeting_reminders").select("*").eq("id", body.reminder_id).maybeSingle()).data;
      if (!regra?.message) return json({ error: "regra sem mensagem" }, 400);
      const phone = br(body.phone || staff.phone || "");
      if (!phone) return json({ error: "informe um telefone pro teste" }, 400);
      const agora = new Date(); const daqui = new Date(agora.getTime() + Math.max(regra.minutes_before || 60, 1) * 60000);
      const texto = render(regra.message, variaveis({ name: staff.name, company: "Empresa Exemplo" }, { scheduled_at: daqui.toISOString(), meeting_link: "https://meet.google.com/abc-defg-hij", title: "Reunião de teste" }, staff, agora));
      let inst: { instance_id?: string | null; official_instance_id?: string | null } = {};
      if (regra.instance_mode === "official" && regra.official_instance_id) inst = { official_instance_id: regra.official_instance_id };
      else if (regra.instance_id) inst = { instance_id: regra.instance_id };
      else {
        const { data: c } = await supabase.from("whatsapp_instances").select("id").eq("status", "connected").order("is_default", { ascending: false }).limit(1).maybeSingle();
        if (!c) return json({ error: "nenhuma instância conectada pro teste" }, 400);
        inst = { instance_id: c.id };
      }
      const r = await enviar(inst, phone, texto);
      return json({ ok: r.ok, error: r.ok ? null : r.error, instancia: r.label, texto, phone });
    }
    return json({ error: "ação desconhecida" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 300) }, 500); }
});

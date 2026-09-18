// meeting-scheduled-notify — avisa no WhatsApp NA HORA em que a reunião é agendada.
// (A crm-activity-notifications só avisa quando a reunião CHEGA; esta cobre o outro
//  momento, pedido do Fabrício em 04/08/2026.)
// Chamada por trigger do banco: crm_activities (type=meeting) e onboarding_meeting_notes.
// CRM: envia pela instância da SDR que agendou (padrão de quem agendou → conversa do lead → Marcelo);
// destinatários = closer (responsável) + quem agendou. Projeto: instância do Marcelo.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (p: unknown, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const isStevo = (u: string) => (u || "").includes("stevo");
const digits = (p: string) => (p || "").replace(/\D/g, "");
const br = (p: string) => {
  const d = digits(p);
  if (!d) return "";
  return d.startsWith("55") ? d : (d.length === 10 || d.length === 11) ? `55${d}` : d;
};

type Inst = { id?: string; instance_name: string; api_url: string | null; api_key: string | null; provider_type: string | null; phone_number?: string | null; display_name?: string | null };

async function instanceById(id: string | null | undefined): Promise<Inst | null> {
  if (!id) return null;
  const { data } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, provider_type, phone_number")
    .eq("id", id).eq("status", "connected").maybeSingle();
  return (data as Inst | null) || null;
}

/** Instância de envio: a da SDR que agendou (pedido do Fabrício 10/09/2026).
 *  Ordem: instância padrão de quem agendou (created_by) → instância da conversa
 *  mais recente do lead (é por ela que a SDR/agente está falando com ele) →
 *  Marcelo → qualquer conectada. Nunca trava o aviso por falta de instância. */
/** Configuração em Configurações → Notificações (crm_settings), Fabrício 17/09/2026:
 *  qual número envia e quem recebe. Sem nada salvo = comportamento de sempre. */
interface Cfg { enabled: boolean; instanceName: string; incluirResponsavel: boolean; incluirQuemAgendou: boolean; extras: string[] }
async function loadCfg(): Promise<Cfg> {
  const cfg: Cfg = { enabled: true, instanceName: "", incluirResponsavel: true, incluirQuemAgendou: true, extras: [] };
  try {
    const { data } = await supabase.from("crm_settings").select("setting_key, setting_value").like("setting_key", "meeting_notify_%");
    // setting_value é jsonb: pode vir string, boolean ou array
    for (const r of (data || []) as { setting_key: string; setting_value: unknown }[]) {
      const raw = r.setting_value;
      const v = raw == null ? "" : typeof raw === "string" ? raw : JSON.stringify(raw);
      if (r.setting_key === "meeting_notify_enabled") cfg.enabled = v !== "false";
      if (r.setting_key === "meeting_notify_instance_name") cfg.instanceName = v.trim();
      if (r.setting_key === "meeting_notify_include_responsible") cfg.incluirResponsavel = v !== "false";
      if (r.setting_key === "meeting_notify_include_scheduler") cfg.incluirQuemAgendou = v !== "false";
      if (r.setting_key === "meeting_notify_extra_staff_ids") { try { const a = Array.isArray(raw) ? raw : JSON.parse(v || "[]"); if (Array.isArray(a)) cfg.extras = a.map(String); } catch { /* valor inválido: ignora */ } }
    }
  } catch (e) { console.error("loadCfg falhou (segue padrão):", e); }
  return cfg;
}
async function instanceByName(name: string): Promise<Inst | null> {
  if (!name) return null;
  const { data } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, provider_type, phone_number")
    .eq("instance_name", name).eq("status", "connected").maybeSingle();
  return (data as Inst | null) || null;
}

async function pickInstance(createdBy: string | null, leadId: string | null, createdAt?: string | null): Promise<{ inst: Inst | null; origem: string }> {
  if (createdBy) {
    const { data: st } = await supabase.from("onboarding_staff").select("default_whatsapp_instance_id").eq("id", createdBy).maybeSingle();
    const i = await instanceById(st?.default_whatsapp_instance_id);
    if (i) return { inst: i, origem: "instância padrão de quem agendou" };
  }
  if (leadId) {
    // conversa ativa NA HORA do agendamento (não a mais nova de agora — depois
    // do aviso o closer também fala com o lead por outra instância)
    let q = supabase.from("crm_whatsapp_conversations")
      .select("instance_id, last_message_at").eq("lead_id", leadId)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(5);
    if (createdAt) q = q.lte("last_message_at", new Date(new Date(createdAt).getTime() + 2 * 60000).toISOString());
    const { data: convs } = await q;
    for (const c of (convs || [])) {
      const i = await instanceById(c.instance_id);
      if (i) return { inst: i, origem: "instância da conversa do lead" };
    }
  }
  const { data: m } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, provider_type, phone_number")
    .eq("instance_name", "marceloalmeida").eq("status", "connected").maybeSingle();
  if (m) return { inst: m as Inst, origem: "Marcelo (fallback)" };
  const { data: fb } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, provider_type, phone_number")
    .eq("status", "connected").limit(1).maybeSingle();
  return { inst: (fb as Inst | null) || null, origem: fb ? "qualquer conectada (fallback)" : "nenhuma" };
}

async function sendWhatsApp(inst: Inst | null, phone: string, text: string): Promise<boolean> {
  if (!inst?.api_url || !inst?.api_key) return false;
  const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  const v2 = inst.provider_type === "manager_v2" || isStevo(base);
  const url = v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { apikey: String(inst.api_key), "Content-Type": "application/json" },
      body: JSON.stringify({ number: phone, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Aviso com a foto do closer (pedido do Fabrício 17/09/2026): manda a imagem com o texto na legenda.
// Só na Evolution (endpoint sendMedia conhecido); Stevo/manager_v2 ou falha → cai no texto puro.
async function sendWhatsAppImage(inst: Inst | null, phone: string, imageUrl: string, caption: string): Promise<boolean> {
  if (!inst?.api_url || !inst?.api_key || !imageUrl) return false;
  const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  const v2 = inst.provider_type === "manager_v2" || isStevo(base);
  if (v2) return false;
  try {
    const r = await fetch(`${base}/message/sendMedia/${inst.instance_name}`, {
      method: "POST",
      headers: { apikey: String(inst.api_key), "Content-Type": "application/json" },
      body: JSON.stringify({ number: phone, mediatype: "image", mimetype: "image/jpeg", media: imageUrl, caption, fileName: "closer.jpg" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const fmt = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const source = String(body.source || "");     // "crm" | "project"
    const id = String(body.id || "");
    if (!id || !source) return json({ error: "source e id obrigatórios" }, 400);

    const staffIds: string[] = [];
    let titulo = "", quando = "", contexto = "", link = "";
    let closerNome = "", closerFoto = "";

    let inst: Inst | null = null;
    let origemInst = "";
    let leadPhone = "", leadLink = "", agendadoPor = "";
    const dryRun = body.dry_run === true;
    const cfg = await loadCfg();
    if (!cfg.enabled && !dryRun) return json({ skip: "aviso de reunião desligado nas configurações" });

    if (source === "crm") {
      let a: any = null;
      // meeting_link pode entrar logo depois do insert (Google Agenda) — espera um pouco antes de desistir do link
      for (let tent = 0; tent < 3; tent++) {
        const { data } = await supabase.from("crm_activities")
          .select("id, title, scheduled_at, type, lead_id, responsible_staff_id, created_by, meeting_link, description, created_at")
          .eq("id", id).maybeSingle();
        a = data;
        if (!a || a.type !== "meeting" || a.meeting_link) break;
        await new Promise((r) => setTimeout(r, 4000));
      }
      if (!a || a.type !== "meeting") return json({ skip: "não é reunião" });
      titulo = a.title || "Reunião";
      quando = fmt(a.scheduled_at);
      link = a.meeting_link || "";
      // destinatário principal = closer (responsável pela reunião); quem agendou também recebe (deduplicado)
      if (cfg.incluirResponsavel && a.responsible_staff_id) staffIds.push(a.responsible_staff_id);
      if (cfg.incluirQuemAgendou && a.created_by && !staffIds.includes(a.created_by)) staffIds.push(a.created_by);
      if (a.responsible_staff_id) {
        const { data: rs } = await supabase.from("onboarding_staff").select("name, avatar_url").eq("id", a.responsible_staff_id).maybeSingle();
        closerNome = rs?.name || "";
        closerFoto = rs?.avatar_url || "";
      }
      if (a.lead_id) {
        const { data: lead } = await supabase.from("crm_leads").select("name, phone, sdr_staff_id").eq("id", a.lead_id).maybeSingle();
        if (lead?.name) contexto = `\n*Lead:* ${lead.name}`;
        leadPhone = lead?.phone || "";
        leadLink = `https://unvholdings.com.br/#/crm/leads/${a.lead_id}`;
        if (a.created_by) {
          const { data: cb } = await supabase.from("onboarding_staff").select("name").eq("id", a.created_by).maybeSingle();
          agendadoPor = cb?.name || "";
        } else if (lead?.sdr_staff_id) {
          const { data: sd } = await supabase.from("onboarding_staff").select("name").eq("id", lead.sdr_staff_id).maybeSingle();
          agendadoPor = sd?.name || "";
        }
      }
      const pick = await pickInstance(a.created_by || null, a.lead_id || null, a.created_at || null);
      inst = pick.inst; origemInst = pick.origem;
      const pelaIA = /agente ia/i.test(String(a.description || ""));
      if (pelaIA) agendadoPor = `Agente IA${inst?.display_name ? ` (${inst.display_name})` : ""}`;
    } else {
      const { data: m } = await supabase.from("onboarding_meeting_notes")
        .select("id, meeting_title, meeting_date, subject, staff_id, scheduled_by, calendar_owner_id, meeting_link, project_id")
        .eq("id", id).maybeSingle();
      if (!m) return json({ skip: "reunião não encontrada" });
      titulo = m.meeting_title || m.subject || "Reunião";
      quando = fmt(m.meeting_date);
      link = m.meeting_link || "";
      for (const s of [cfg.incluirResponsavel ? m.staff_id : null, cfg.incluirResponsavel ? m.calendar_owner_id : null, cfg.incluirQuemAgendou ? m.scheduled_by : null]) {
        if (s && !staffIds.includes(s)) staffIds.push(s);
      }
      const pick = await pickInstance(null, null);
      inst = pick.inst; origemInst = pick.origem;
      if (m.project_id) {
        const { data: proj } = await supabase.from("onboarding_projects")
          .select("product_name, onboarding_companies(name)").eq("id", m.project_id).maybeSingle();
        const emp = (proj as { onboarding_companies?: { name?: string } } | null)?.onboarding_companies?.name;
        if (emp) contexto = `\n*Empresa:* ${emp}`;
      }
    }

    // quem sempre recebe (configurado) + número fixo de envio, se houver e estiver conectado
    for (const e of cfg.extras) if (e && !staffIds.includes(e)) staffIds.push(e);
    if (cfg.instanceName) {
      const fixa = await instanceByName(cfg.instanceName);
      if (fixa) { inst = fixa; origemInst = "número definido nas configurações"; }
      else origemInst += " (o número configurado está desconectado)";
    }
    if (!staffIds.length) return json({ skip: "sem destinatário" });
    const { data: staff } = await supabase.from("onboarding_staff")
      .select("id, name, phone").in("id", staffIds).eq("is_active", true);

    const msg = source === "crm"
      ? `📅 *Reunião agendada*\n\n*${titulo}*${contexto}` +
        (leadPhone ? `\n*Telefone:* ${leadPhone}` : "") +
        (quando ? `\n*Quando:* ${quando}` : "") +
        (closerNome ? `\n*Closer:* ${closerNome}` : "") +
        (agendadoPor ? `\n*Agendada por:* ${agendadoPor}` : "") +
        (link ? `\n\n🔗 *Reunião:* ${link}` : "\n\n(sem link de reunião)") +
        (leadLink ? `\n📋 *Lead no CRM:* ${leadLink}` : "")
      : `📅 *Reunião agendada*\n\n*${titulo}*${contexto}` +
        (quando ? `\n*Quando:* ${quando}` : "") +
        (link ? `\n\n🔗 ${link}` : "");

    const enviados: string[] = [];
    const vistos = new Set<string>();
    const instPhone = digits(inst?.phone_number || "");
    for (const s of (staff || [])) {
      const phone = br(s.phone || "");
      if (!phone || vistos.has(phone)) continue;
      if (instPhone && phone === instPhone) continue; // não manda pra si mesmo (SDR agendou pela própria instância)
      vistos.add(phone);
      if (dryRun) { enviados.push(`[dry] ${s.name} <${phone}>`); continue; }
      // com foto do closer vai como imagem + legenda; sem foto (ou se a mídia falhar) vai texto
      if (closerFoto && await sendWhatsAppImage(inst, phone, closerFoto, msg)) { enviados.push(`${s.name} (com foto)`); continue; }
      if (await sendWhatsApp(inst, phone, msg)) enviados.push(s.name);
    }
    return json({ ok: true, enviados, instancia: inst?.instance_name || null, origem_instancia: origemInst, msg: dryRun ? msg : undefined });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});

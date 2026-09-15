// Disparo de template da API oficial em SEGUNDO PLANO.
// O dialog do CRM só cria o disparo (whatsapp_official_campaigns) e os
// destinatários "pending", chama esta função e fecha. Aqui cada lead é enviado
// pela Graph API, registrado no Atendimento, recebe a etiqueta "Template enviado"
// e vai pra próxima etapa (ou etapa escolhida). Antes o loop rodava no navegador:
// travava a tela e perdia envios ("Failed to send a request to the Edge Function").
//
// - Responde na hora e processa com EdgeRuntime.waitUntil; a cada ~100s chama a si
//   mesma pra continuar (limite de tempo por execução).
// - Destinatário é "reservado" (pending → processing) antes de enviar: duas
//   execuções nunca mandam pro mesmo lead.
// - Status "canceled"/"paused" no disparo interrompe no próximo lote.
// - 3+ recusas por pagamento (131042/141006) pausam o disparo sozinho.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CAMP = "whatsapp_official_campaigns";
const REC = "whatsapp_official_campaign_recipients";
const BUDGET_MS = 100_000;
const BATCH = 5;
const MAX_HOPS = 300;
const TAG_NAME = "Template enviado";

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const campaignId = String(body.campaign_id || "");
  if (!campaignId) return j({ error: "campaign_id obrigatório" }, 400);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token !== SERVICE) {
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return j({ error: "não autorizado" }, 401);
    const { data: st } = await supabase.from("onboarding_staff").select("id").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
    if (!st) return j({ error: "não autorizado" }, 401);
  }

  const hop = Number(body.hop || 0);
  if (hop > MAX_HOPS) return j({ error: "limite de execuções encadeadas" }, 429);
  // @ts-ignore EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(processar(supabase, campaignId, hop, Number(body.err_hops || 0)));
  return j({ ok: true, started: true });
});

async function continuar(campaignId: string, hop: number, errHops: number) {
  await fetch(`${SUPABASE_URL}/functions/v1/official-campaign-dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ campaign_id: campaignId, hop: hop + 1, err_hops: errHops }),
  });
}

async function pausar(supabase: any, campaignId: string, motivo: string) {
  await supabase.from(CAMP).update({ status: "paused", notes: motivo }).eq("id", campaignId).eq("status", "sending");
}

async function processar(supabase: any, campaignId: string, hop: number, errHops: number) {
  const inicio = Date.now();
  try {
    const { data: camp } = await supabase.from(CAMP).select("*").eq("id", campaignId).maybeSingle();
    if (!camp || camp.status !== "sending") return;
    const { data: inst } = await supabase.from("whatsapp_official_instances")
      .select("id, phone_number_id, access_token").eq("id", camp.official_instance_id).maybeSingle();
    if (!inst?.access_token) { await pausar(supabase, campaignId, "Pausado: número da API oficial sem token de acesso."); return; }

    // reservados por uma execução que morreu: não reenvia (evita mandar 2x)
    await supabase.from(REC)
      .update({ status: "error", error_text: "Envio interrompido no servidor; não reenviado pra evitar duplicidade" })
      .eq("campaign_id", campaignId).eq("status", "processing").is("whatsapp_message_id", null)
      .lt("claimed_at", new Date(Date.now() - 5 * 60e3).toISOString());

    const tagId = await tagTemplateEnviado(supabase);
    const stagesCache = new Map<string, any[]>();

    while (Date.now() - inicio < BUDGET_MS) {
      const { data: atual } = await supabase.from(CAMP).select("status").eq("id", campaignId).maybeSingle();
      if (atual?.status !== "sending") return;

      if (await bloqueioPagamento(supabase, campaignId, camp.resumed_at || camp.created_at)) {
        await pausar(supabase, campaignId,
          "Pausado: a Meta está recusando por pagamento pendente na conta do WhatsApp Business (131042). Regularize o pagamento e clique em Retomar.");
        return;
      }

      const { data: prox } = await supabase.from(REC).select("id")
        .eq("campaign_id", campaignId).eq("status", "pending").order("created_at").limit(BATCH);
      if (!prox?.length) break;
      const { data: reservados } = await supabase.from(REC)
        .update({ status: "processing", claimed_at: new Date().toISOString() })
        .in("id", prox.map((p: any) => p.id)).eq("status", "pending")
        .select("id, lead_id, lead_name, phone");
      if (!reservados?.length) continue;
      await Promise.all(reservados.map((r: any) => enviarUm(supabase, camp, inst, r, stagesCache, tagId)));
    }

    const { count: pendentes } = await supabase.from(REC).select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId).eq("status", "pending");
    if ((pendentes || 0) > 0) { await continuar(campaignId, hop, 0); return; }

    await supabase.from(REC)
      .update({ status: "error", error_text: "Envio interrompido no servidor; não reenviado pra evitar duplicidade" })
      .eq("campaign_id", campaignId).eq("status", "processing").is("whatsapp_message_id", null)
      .lt("claimed_at", new Date(Date.now() - 2 * 60e3).toISOString());
    await supabase.from(CAMP).update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", campaignId).eq("status", "sending");
  } catch (e) {
    console.error("[official-campaign-dispatch]", campaignId, e);
    if (errHops < 5) { try { await continuar(campaignId, hop, errHops + 1); } catch { /* sem rede */ } }
    else await pausar(supabase, campaignId, `Pausado por erro no servidor: ${String((e as Error)?.message || e).slice(0, 200)}`);
  }
}

// Só conta recusas de pagamento desde o último "Retomar": as antigas do mesmo
// disparo pausavam de novo na hora, mesmo com a conta já paga (15/09/2026).
async function bloqueioPagamento(supabase: any, campaignId: string, desde: string) {
  const { count } = await supabase.from(REC).select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .gte("sent_at", desde)
    .or("error_text.ilike.131042%,error_text.ilike.141006%");
  return (count || 0) >= 3;
}

const firstName = (name: string) => {
  const f = (name || "").trim().split(/\s+/)[0] || "";
  if (!f) return "";
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
};
/** A Meta recusa variável vazia, quebra de linha, tab e 4+ espaços. */
function resolveVar(v: string, nome: string, staffName: string) {
  const primeiro = firstName(nome) || "tudo bem";
  const out = String(v || "")
    .replace(/\{primeiro_nome\}/gi, primeiro)
    .replace(/\{nome\}/gi, (nome || "").trim() || primeiro)
    .replace(/\{sdr\}/gi, staffName)
    .replace(/[\n\t\r]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return out || "tudo bem";
}
const render = (body: string, vars: string[], nome: string, staffName: string) =>
  body.replace(/\{\{(\d+)\}\}/g, (_, n) => resolveVar(vars[Number(n) - 1] || "", nome, staffName));

async function enviarUm(supabase: any, camp: any, inst: any, r: any, stagesCache: Map<string, any[]>, tagId: string | null) {
  const vars: string[] = Array.isArray(camp.variables) ? camp.variables : [];
  const staffName = camp.created_by_name || "";
  let lead: any = null;
  if (r.lead_id) {
    const { data } = await supabase.from("crm_leads").select("id, name, phone, stage_id, pipeline_id").eq("id", r.lead_id).maybeSingle();
    lead = data;
  }
  const nome = lead?.name || r.lead_name || "";
  try {
    const params = vars.map((v) => ({ type: "text", text: resolveVar(v, nome, staffName) }));
    const resp = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${inst.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: r.phone,
        type: "template",
        template: {
          name: camp.template_name,
          language: { code: camp.template_language || "pt_BR" },
          components: params.length ? [{ type: "body", parameters: params }] : [],
        },
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const er = data?.error || {};
      const det = er.error_data?.details ? ` — ${er.error_data.details}` : "";
      throw new Error(`${er.code ? `${er.code} ` : ""}${er.message || `HTTP ${resp.status}`}${det}`.trim());
    }
    const wamid: string | null = data?.messages?.[0]?.id || null;
    await supabase.from(REC).update({ status: "sent", whatsapp_message_id: wamid, sent_at: new Date().toISOString() }).eq("id", r.id);

    const content = render(camp.template_body || camp.body_preview || "", vars, nome, staffName);
    const reg = await registrarNoAtendimento(supabase, {
      instanceId: inst.id, leadId: r.lead_id, leadName: nome, phone: r.phone, content, wamid, staffId: camp.created_by_staff_id,
    });
    // agente escolhido no disparo: fica FIXO na conversa (trava) e só ele responde,
    // até alguém desligar no Atendimento (Fabrício, 16/09/2026)
    if (camp.agent_id && reg?.conversationId) {
      await supabase.from("crm_ai_agent_conversation_overrides").upsert({
        conversation_id: reg.conversationId, channel: "whatsapp", agent_id: camp.agent_id,
        enabled: true, reply_mode: "auto", locked: true, updated_at: new Date().toISOString(),
      }, { onConflict: "conversation_id,channel" });
    }
    if (r.lead_id && tagId) {
      await supabase.from("crm_lead_tags").upsert({ lead_id: r.lead_id, tag_id: tagId }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    }
    const mv = lead ? await moverLead(supabase, camp, lead, stagesCache) : null;
    const { data: cur } = await supabase.from(REC).update({
      message_id: reg?.messageId || null, conversation_id: reg?.conversationId || null,
      moved_from_stage_id: mv?.from || null, moved_to_stage_id: mv?.to || null,
    }).eq("id", r.id).select("status").maybeSingle();
    // a Meta avisou a falha antes de mover: devolve o lead
    if (mv && mv.from && cur?.status === "failed") {
      const { data: from } = await supabase.from("crm_stages").select("pipeline_id").eq("id", mv.from).maybeSingle();
      await supabase.from("crm_leads").update({ stage_id: mv.from, ...(from?.pipeline_id ? { pipeline_id: from.pipeline_id } : {}) })
        .eq("id", lead.id).eq("stage_id", mv.to);
      await supabase.from(REC).update({ stage_reverted: true }).eq("id", r.id);
    }
  } catch (e) {
    await supabase.from(REC).update({ status: "error", error_text: String((e as Error)?.message || e).slice(0, 500) }).eq("id", r.id);
  }
}

async function stagesOf(supabase: any, pipelineId: string, cache: Map<string, any[]>) {
  if (!cache.has(pipelineId)) {
    const { data } = await supabase.from("crm_stages").select("id, pipeline_id, sort_order, is_final, final_type")
      .eq("pipeline_id", pipelineId).order("sort_order");
    cache.set(pipelineId, data || []);
  }
  return cache.get(pipelineId)!;
}

async function moverLead(supabase: any, camp: any, lead: any, cache: Map<string, any[]>) {
  if (!camp.move_mode || camp.move_mode === "none") return null;
  let to: any = null;
  if (camp.move_mode === "stage" && camp.move_stage_id) {
    const { data } = await supabase.from("crm_stages").select("id, pipeline_id").eq("id", camp.move_stage_id).maybeSingle();
    to = data;
  } else if (camp.move_mode === "next") {
    if (!lead.pipeline_id || !lead.stage_id) return null;
    const list = await stagesOf(supabase, lead.pipeline_id, cache);
    const cur = list.find((s: any) => s.id === lead.stage_id);
    if (!cur || cur.is_final || cur.final_type) return null;
    to = list.find((s: any) => s.sort_order > cur.sort_order && !s.is_final && !s.final_type) || null;
  }
  if (!to || to.id === lead.stage_id) return null;
  const upd: Record<string, string> = { stage_id: to.id };
  if (to.pipeline_id !== lead.pipeline_id) upd.pipeline_id = to.pipeline_id;
  const { error } = await supabase.from("crm_leads").update(upd).eq("id", lead.id);
  if (error) { console.error("mover lead:", lead.id, error.message); return null; }
  return { from: lead.stage_id as string | null, to: to.id as string };
}

async function tagTemplateEnviado(supabase: any): Promise<string | null> {
  const { data: t } = await supabase.from("crm_tags").select("id").ilike("name", TAG_NAME).limit(1).maybeSingle();
  if (t?.id) return t.id;
  const { data: created } = await supabase.from("crm_tags").insert({ name: TAG_NAME, color: "#2563eb", is_active: true }).select("id").single();
  return created?.id || null;
}

/** contato + conversa (official_instance_id) + mensagem — mesmo formato do whatsapp-official-webhook */
async function registrarNoAtendimento(supabase: any, a: {
  instanceId: string; leadId: string | null; leadName: string; phone: string; content: string; wamid: string | null; staffId: string | null;
}): Promise<{ conversationId: string; messageId: string | null } | null> {
  let { data: contact } = await supabase.from("crm_whatsapp_contacts").select("id, lead_id").eq("phone", a.phone).maybeSingle();
  if (!contact) {
    const { data: created } = await supabase.from("crm_whatsapp_contacts")
      .insert({ phone: a.phone, name: a.leadName || a.phone, lead_id: a.leadId }).select("id, lead_id").single();
    contact = created;
  } else if (!contact.lead_id && a.leadId) {
    await supabase.from("crm_whatsapp_contacts").update({ lead_id: a.leadId }).eq("id", contact.id);
  }
  if (!contact) return null;
  let convId: string | null = null;
  const { data: conv } = await supabase.from("crm_whatsapp_conversations").select("id, lead_id")
    .eq("official_instance_id", a.instanceId).eq("contact_id", contact.id).neq("status", "closed")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (conv) {
    convId = conv.id;
    if (!conv.lead_id && a.leadId) await supabase.from("crm_whatsapp_conversations").update({ lead_id: a.leadId }).eq("id", conv.id);
  } else {
    const { data: created } = await supabase.from("crm_whatsapp_conversations")
      .insert({ official_instance_id: a.instanceId, contact_id: contact.id, lead_id: a.leadId, status: "open" })
      .select("id").single();
    convId = created?.id || null;
  }
  if (!convId) return null;
  const { data: msg } = await supabase.from("crm_whatsapp_messages").insert({
    conversation_id: convId, content: a.content, type: "text", direction: "outbound", status: "sent",
    sent_by: a.staffId, whatsapp_message_id: a.wamid,
  }).select("id").maybeSingle();
  await supabase.from("crm_whatsapp_conversations").update({
    last_message: a.content.substring(0, 255), last_message_at: new Date().toISOString(),
  }).eq("id", convId);
  return { conversationId: convId, messageId: msg?.id || null };
}

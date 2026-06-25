// dialer-twiml: TwiML chamado pelo Twilio quando o lead atende.
// Se for secretária eletrônica -> desliga e marca voicemail. Se for humano -> consentimento + conecta na atendente, gravando.
import { createClient } from "@supabase/supabase-js";

// Vazio por padrão: o cliente atende e cai direto na atendente, sem mensagem automática.
// Se a campanha definir uma mensagem de consentimento, ela é tocada antes de conectar.
const DEFAULT_CONSENT = "";

function xmlEscape(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function twiml(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${xml}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");
    const agent = url.searchParams.get("agent") || "";
    const amdOn = url.searchParams.get("amd") === "1"; // detecção de secretária ativa nesta ligação

    // params do Twilio vêm form-encoded
    let answeredBy = "";
    try {
      const form = await req.formData();
      answeredBy = String(form.get("AnsweredBy") || "");
    } catch { /* sem body */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

    const ab = answeredBy.toLowerCase();
    const isMachine = ab.startsWith("machine") || ab === "fax";
    // Com AMD ligada, só conecta a atendente quando for HUMANO confirmado.
    // Máquina/fax = caixa postal; "unknown"/vazio = a Twilio não confirmou humano -> NÃO conecta (evita sentar na caixa postal).
    if (amdOn && ab !== "human") {
      if (callId) {
        const callStatus = isMachine ? "voicemail" : "no-answer";
        const queueStatus = isMachine ? "voicemail" : "no_answer";
        await supabase.from("crm_calls").update({ status: callStatus, answered_by: answeredBy || "unknown" }).eq("id", callId);
        const { data: c } = await supabase.from("crm_calls").select("queue_id").eq("id", callId).maybeSingle();
        if (c?.queue_id) await supabase.from("crm_dialer_queue").update({ status: queueStatus }).eq("id", c.queue_id);
      }
      return twiml(`<Hangup/>`);
    }
    // Sem AMD: ainda corta máquina/fax detectados (caso a Twilio mande), mas sem AMD isso quase nunca vem.
    if (!amdOn && isMachine) {
      if (callId) {
        await supabase.from("crm_calls").update({ status: "voicemail", answered_by: answeredBy }).eq("id", callId);
        const { data: c } = await supabase.from("crm_calls").select("queue_id").eq("id", callId).maybeSingle();
        if (c?.queue_id) await supabase.from("crm_dialer_queue").update({ status: "voicemail" }).eq("id", c.queue_id);
      }
      return twiml(`<Hangup/>`);
    }

    // Humano atendeu: busca a mensagem de consentimento + se a campanha tem monitoria
    let consent = DEFAULT_CONSENT;
    let enableMonitoring = false;
    let fromNumber = "";
    if (callId) {
      const { data: call } = await supabase
        .from("crm_calls")
        .select("queue_id, campaign_id, from_number, campaign:crm_dialer_campaigns(consent_message, enable_monitoring)")
        .eq("id", callId)
        .maybeSingle();
      if ((call as any)?.campaign?.consent_message) consent = (call as any).campaign.consent_message;
      enableMonitoring = (call as any)?.campaign?.enable_monitoring === true;
      fromNumber = (call as any)?.from_number || "";
      await supabase
        .from("crm_calls")
        .update({ status: "in-progress", answered_by: answeredBy || "unknown", answered_at: new Date().toISOString() })
        .eq("id", callId);
      if (call?.queue_id) await supabase.from("crm_dialer_queue").update({ status: "in_call" }).eq("id", call.queue_id);
    }

    const recCb = `${BASE}/dialer-recording?callId=${callId}`;
    // Só toca a mensagem se a campanha definir uma; senão conecta direto na atendente.
    const sayBlock = consent && consent.trim()
      ? `<Say voice="Polly.Camila" language="pt-BR">${xmlEscape(consent)}</Say>`
      : "";

    // ── Fluxo de CONFERÊNCIA (monitoria ligada): lead entra na sala e a SDR é puxada
    // pra mesma sala. Isso permite o gestor escutar/sussurrar. Só quando enable_monitoring. ──
    const staffId = agent.replace(/^agent-/, "");
    if (enableMonitoring && staffId && callId) {
      const conf = `nexus-${staffId}`;
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      let agentCallSid: string | null = null;
      try {
        if (accountSid && authToken && fromNumber) {
          // Origina a perna da atendente (browser client) pra entrar na mesma conferência.
          const p = new URLSearchParams({
            To: `client:${agent}`,
            From: fromNumber,
            Url: `${BASE}/dialer-agent-twiml?conf=${encodeURIComponent(conf)}`,
            Method: "POST",
          });
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
            method: "POST",
            headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`), "Content-Type": "application/x-www-form-urlencoded" },
            body: p.toString(),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok) agentCallSid = d.sid || null;
          else console.error("[dialer-twiml] falha ao puxar atendente:", d?.message);
        }
      } catch (e) {
        console.error("[dialer-twiml] erro ao originar perna da atendente:", e);
      }
      await supabase.from("crm_calls").update({ conference_name: conf, agent_call_sid: agentCallSid }).eq("id", callId);
      // Lead entra na conferência (sala grava aqui). endConferenceOnExit: lead desligou -> acaba.
      return twiml(
        sayBlock +
        `<Dial>` +
          `<Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" ` +
          `record="record-from-start" recordingStatusCallback="${xmlEscape(recCb)}" ` +
          `recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST">` +
          `${xmlEscape(conf)}` +
          `</Conference>` +
        `</Dial>`,
      );
    }

    // ── Fluxo PADRÃO (sem monitoria): conecta a atendente direto, ponta a ponta. ──
    return twiml(
      sayBlock +
      `<Dial answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(recCb)}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST" timeout="30">` +
      `<Client>${xmlEscape(agent)}</Client>` +
      `</Dial>`,
    );
  } catch (_e) {
    // Em erro, evita deixar o cliente no limbo
    return twiml(`<Say voice="Polly.Camila" language="pt-BR">Desculpe, tivemos um problema técnico. Retornaremos em instantes.</Say><Hangup/>`);
  }
});

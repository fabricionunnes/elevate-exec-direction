// dialer-twiml: TwiML chamado pelo Twilio quando o lead atende.
// Se for secretária eletrônica -> desliga e marca voicemail. Se for humano -> consentimento + conecta na atendente, gravando.
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CONSENT =
  "Olá! Esta ligação será gravada para fins de qualidade e treinamento. Aguarde um instante que já vou transferir para um de nossos atendentes.";

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

    // Secretária eletrônica / fax -> não fala com ninguém, marca voicemail
    if (answeredBy && (answeredBy.startsWith("machine") || answeredBy === "fax")) {
      if (callId) {
        await supabase.from("crm_calls").update({ status: "voicemail", answered_by: answeredBy }).eq("id", callId);
        const { data: c } = await supabase.from("crm_calls").select("queue_id").eq("id", callId).maybeSingle();
        if (c?.queue_id) await supabase.from("crm_dialer_queue").update({ status: "voicemail" }).eq("id", c.queue_id);
      }
      return twiml(`<Hangup/>`);
    }

    // Humano atendeu: busca a mensagem de consentimento da campanha
    let consent = DEFAULT_CONSENT;
    if (callId) {
      const { data: call } = await supabase
        .from("crm_calls")
        .select("queue_id, campaign_id, campaign:crm_dialer_campaigns(consent_message)")
        .eq("id", callId)
        .maybeSingle();
      if ((call as any)?.campaign?.consent_message) consent = (call as any).campaign.consent_message;
      await supabase
        .from("crm_calls")
        .update({ status: "in-progress", answered_by: answeredBy || "human", answered_at: new Date().toISOString() })
        .eq("id", callId);
      if (call?.queue_id) await supabase.from("crm_dialer_queue").update({ status: "in_call" }).eq("id", call.queue_id);
    }

    const recCb = `${BASE}/dialer-recording?callId=${callId}`;
    return twiml(
      `<Say voice="Polly.Camila-Neural" language="pt-BR">${xmlEscape(consent)}</Say>` +
      `<Dial answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(recCb)}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST" timeout="30">` +
      `<Client>${xmlEscape(agent)}</Client>` +
      `</Dial>`,
    );
  } catch (_e) {
    // Em erro, evita deixar o cliente no limbo
    return twiml(`<Say voice="Polly.Camila-Neural" language="pt-BR">Desculpe, tivemos um problema técnico. Retornaremos em instantes.</Say><Hangup/>`);
  }
});

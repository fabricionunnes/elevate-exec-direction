// dialer-call: pega o próximo lead da fila (ou um lead específico) e origina a ligação no Twilio.
// Discagem progressiva: liga UM lead por vez. Detecção de secretária eletrônica (AMD) ativa.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toE164BR(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return "+" + d;
  if (d.length >= 10 && d.length <= 11) return "+55" + d;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  return d.startsWith("55") ? "+" + d : "+55" + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const defaultCallerId = Deno.env.get("TWILIO_CALLER_ID");
    if (!accountSid || !authToken) throw new Error("Credenciais Twilio incompletas (ACCOUNT_SID/AUTH_TOKEN)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const BASE = `${supabaseUrl}/functions/v1`;

    const body = await req.json().catch(() => ({}));

    // Modo verificação: confere Auth Token + número (caller id) sem ligar pra ninguém
    if (body.verify) {
      const basic = "Basic " + btoa(`${accountSid}:${authToken}`);
      const accResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, { headers: { Authorization: basic } });
      const accData = await accResp.json().catch(() => ({}));
      let callerIdOwned = false;
      if (accResp.ok && defaultCallerId) {
        const numResp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(defaultCallerId)}`,
          { headers: { Authorization: basic } },
        );
        const numData = await numResp.json().catch(() => ({}));
        callerIdOwned = ((numData?.incoming_phone_numbers as any[]) || []).length > 0;
      }
      return json({
        verify: true,
        auth_token_ok: accResp.ok,
        account_status: accData?.status || null,
        caller_id: defaultCallerId || null,
        caller_id_owned: callerIdOwned,
      });
    }

    const campaignId: string | undefined = body.campaignId;
    let leadId: string | undefined = body.leadId;
    let queueId: string | undefined;
    let agentStaffId: string | undefined = body.agentStaffId;
    let callerId = defaultCallerId;
    let consentMessage: string | undefined;
    let useAmd = false; // detecção de secretária eletrônica (custa ~US$0,0075/ligação)

    // Modo campanha: pega o próximo da fila
    if (campaignId && !leadId) {
      const { data: campaign } = await supabase
        .from("crm_dialer_campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
      if (!campaign) throw new Error("Campanha não encontrada");
      if (campaign.status !== "active") return json({ done: true, reason: "campaign_not_active" });

      // prioriza o agente logado que está discando (passado pelo frontend); cai pro da campanha
      agentStaffId = body.agentStaffId || campaign.agent_staff_id || agentStaffId;
      callerId = campaign.caller_id || defaultCallerId;
      consentMessage = campaign.consent_message;
      useAmd = campaign.use_amd !== false;

      const { data: nextRow } = await supabase
        .from("crm_dialer_queue")
        .select("id, lead_id")
        .eq("campaign_id", campaignId)
        .eq("status", "queued")
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!nextRow) return json({ done: true, reason: "queue_empty" });

      // marca como discando (guarda contra corrida)
      const { data: claimed } = await supabase
        .from("crm_dialer_queue")
        .update({ status: "dialing", last_attempt_at: new Date().toISOString() })
        .eq("id", nextRow.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();
      if (!claimed) return json({ done: false, reason: "race_skip" });

      leadId = nextRow.lead_id;
      queueId = nextRow.id;
      await supabase
        .from("crm_dialer_queue")
        .update({ attempts: (nextRow as any).attempts != null ? (nextRow as any).attempts + 1 : 1 })
        .eq("id", queueId);
    }

    if (!leadId) throw new Error("leadId ou campaignId é obrigatório");
    if (!agentStaffId) throw new Error("agentStaffId é obrigatório (atendente que recebe a ligação)");

    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, name, phone")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead não encontrado");
    const toNumber = toE164BR(lead.phone || "");
    if (!toNumber) throw new Error(`Lead "${lead.name}" sem telefone válido`);
    if (!callerId) throw new Error("Sem número de origem (TWILIO_CALLER_ID ou caller_id da campanha)");

    // cria o registro da ligação
    const { data: call, error: callErr } = await supabase
      .from("crm_calls")
      .insert({
        lead_id: leadId,
        campaign_id: campaignId || null,
        queue_id: queueId || null,
        agent_staff_id: agentStaffId,
        direction: "outbound",
        from_number: callerId,
        to_number: toNumber,
        status: "queued",
      })
      .select("id")
      .single();
    if (callErr) throw callErr;
    const callId = call.id;

    // origina a ligação no Twilio
    const agentIdentity = `agent-${agentStaffId}`;
    const params = new URLSearchParams({
      To: toNumber,
      From: callerId,
      Url: `${BASE}/dialer-twiml?callId=${callId}&agent=${encodeURIComponent(agentIdentity)}`,
      Method: "POST",
      StatusCallback: `${BASE}/dialer-status?callId=${callId}`,
      StatusCallbackMethod: "POST",
    });
    if (useAmd) {
      params.append("MachineDetection", "Enable");
      params.append("MachineDetectionTimeout", "15");
    }
    params.append("StatusCallbackEvent", "initiated");
    params.append("StatusCallbackEvent", "ringing");
    params.append("StatusCallbackEvent", "answered");
    params.append("StatusCallbackEvent", "completed");
    if (consentMessage) {
      // passado pro twiml via query seria grande; o twiml lê do campaign. Guarda no call p/ fallback.
    }

    const twResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    const twData = await twResp.json();
    if (!twResp.ok) {
      await supabase.from("crm_calls").update({ status: "failed", notes: twData?.message || "Twilio error" }).eq("id", callId);
      if (queueId) await supabase.from("crm_dialer_queue").update({ status: "failed" }).eq("id", queueId);
      throw new Error(`Twilio ${twResp.status}: ${twData?.message || "erro ao originar"}`);
    }

    await supabase
      .from("crm_calls")
      .update({ twilio_call_sid: twData.sid, status: "ringing", started_at: new Date().toISOString() })
      .eq("id", callId);

    return json({
      ok: true,
      callId,
      callSid: twData.sid,
      lead: { id: lead.id, name: lead.name, phone: toNumber },
      queueId: queueId || null,
    });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

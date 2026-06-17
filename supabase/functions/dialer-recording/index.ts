// dialer-recording: callback de gravação do Twilio. Salva o áudio no lead, cria a atividade e chama a qualificação.
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");

    const form = await req.formData().catch(() => null);
    const get = (k: string) => (form ? String(form.get(k) || "") : "");
    const recordingUrl = get("RecordingUrl"); // sem extensão
    const recordingSid = get("RecordingSid");
    const recordingDuration = get("RecordingDuration");

    if (!callId || !recordingUrl) return new Response("ok");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const mp3 = `${recordingUrl}.mp3`;

    const { data: call } = await supabase
      .from("crm_calls")
      .select("id, lead_id, agent_staff_id, activity_id, duration_seconds, tenant_id")
      .eq("id", callId)
      .maybeSingle();
    if (!call) return new Response("ok");

    const dur = recordingDuration ? parseInt(recordingDuration, 10) : call.duration_seconds;
    await supabase
      .from("crm_calls")
      .update({ recording_url: mp3, recording_sid: recordingSid, duration_seconds: dur || call.duration_seconds })
      .eq("id", callId);

    // Cobrança: debita a carteira do cliente por minuto gravado/transcrito (UNV/owner = sem débito).
    if (call.tenant_id && dur && dur > 0) {
      try {
        const minutes = Math.max(1, Math.ceil(dur / 60));
        const { data: pricing } = await supabase
          .from("dialer_pricing")
          .select("price_per_minute")
          .or(`tenant_id.eq.${call.tenant_id},tenant_id.is.null`)
          .order("tenant_id", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        const rate = Number(pricing?.price_per_minute) || 1.2;
        const cost = Number((minutes * rate).toFixed(2));
        await supabase.rpc("dialer_debit_wallet", {
          p_tenant: call.tenant_id,
          p_amount: cost,
          p_minutes: minutes,
          p_ref: callId,
          p_desc: `${minutes} min × ${rate.toFixed(2)}`,
        });
      } catch (_e) { /* não trava o callback de gravação */ }
    }

    // Cria atividade type 'call' no lead (aparece na timeline) se ainda não houver
    if (!call.activity_id) {
      const { data: act } = await supabase
        .from("crm_activities")
        .insert({
          lead_id: call.lead_id,
          type: "call",
          title: "Ligação (discador)",
          status: "completed",
          completed_at: new Date().toISOString(),
          responsible_staff_id: call.agent_staff_id,
          notes: "Gravação registrada. Qualificação automática em processamento…",
        })
        .select("id")
        .maybeSingle();
      if (act?.id) await supabase.from("crm_calls").update({ activity_id: act.id }).eq("id", callId);
    }

    // Dispara a qualificação (transcrição + IA) sem bloquear o callback
    fetch(`${supabaseUrl}/functions/v1/dialer-qualify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ callId }),
    }).catch(() => {});

    return new Response("ok");
  } catch (_e) {
    return new Response("ok");
  }
});

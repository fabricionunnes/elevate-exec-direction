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
      .select("id, lead_id, agent_staff_id, activity_id, duration_seconds, tenant_id, answered_by")
      .eq("id", callId)
      .maybeSingle();
    if (!call) return new Response("ok");

    // A gravação é "record-from-answer-dual": começa quando a atendente entra na ponte,
    // então RecordingDuration = tempo real de conversa (segundos falados), não inclui toque/AMD.
    const talkSeconds = recordingDuration ? parseInt(recordingDuration, 10) : (call.duration_seconds || 0);
    await supabase
      .from("crm_calls")
      .update({ recording_url: mp3, recording_sid: recordingSid, duration_seconds: talkSeconds || call.duration_seconds })
      .eq("id", callId);

    // Cobrança: só debita conversa real (humano atendeu) e por SEGUNDO falado, sem mínimo de 1 minuto.
    // Caixa postal / não atendeu = sem conversa = sem débito. UNV/owner (tenant null) = sem débito.
    if (call.tenant_id && call.answered_by === "human" && talkSeconds > 0) {
      try {
        const { data: pricing } = await supabase
          .from("dialer_pricing")
          .select("price_per_minute, price_per_second")
          .or(`tenant_id.eq.${call.tenant_id},tenant_id.is.null`)
          .order("tenant_id", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        const perMinute = Number(pricing?.price_per_minute) || 1.2;
        const perSecond = pricing?.price_per_second != null ? Number(pricing.price_per_second) : perMinute / 60;
        const cost = Number((talkSeconds * perSecond).toFixed(2));
        const minutes = Number((talkSeconds / 60).toFixed(2)); // fracionário, p/ relatório/franquia
        if (cost > 0) {
          await supabase.rpc("dialer_debit_wallet", {
            p_tenant: call.tenant_id,
            p_amount: cost,
            p_minutes: minutes,
            p_ref: callId,
            p_desc: `${talkSeconds}s × R$${perSecond.toFixed(4)}/s`,
          });
        }
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

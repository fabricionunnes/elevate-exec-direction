// dialer-status: callback de status de chamada do Twilio. Atualiza crm_calls e a fila.
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");

    const form = await req.formData().catch(() => null);
    const get = (k: string) => (form ? String(form.get(k) || "") : "");
    const callStatus = get("CallStatus"); // queued, ringing, in-progress, completed, busy, no-answer, failed, canceled
    const duration = get("CallDuration");
    const answeredBy = get("AnsweredBy");

    if (!callId) return new Response("ok");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const patch: Record<string, unknown> = { status: callStatus };
    if (answeredBy) patch.answered_by = answeredBy;
    if (callStatus === "in-progress") patch.started_at = patch.started_at || new Date().toISOString();
    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
      patch.ended_at = new Date().toISOString();
      if (duration) patch.duration_seconds = parseInt(duration, 10) || null;
    }
    await supabase.from("crm_calls").update(patch).eq("id", callId);

    // Atualiza a fila quando termina
    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
      const { data: call } = await supabase
        .from("crm_calls")
        .select("queue_id, answered_at, status")
        .eq("id", callId)
        .maybeSingle();
      if (call?.queue_id) {
        let qStatus = "no_answer";
        if (call.answered_at) qStatus = "completed";
        else if (callStatus === "busy") qStatus = "busy";
        else if (callStatus === "failed" || callStatus === "canceled") qStatus = "failed";
        // não rebaixa um 'completed' ou 'voicemail' já gravado
        const { data: q } = await supabase.from("crm_dialer_queue").select("status").eq("id", call.queue_id).maybeSingle();
        if (q && !["completed", "voicemail"].includes(q.status)) {
          await supabase.from("crm_dialer_queue").update({ status: qStatus }).eq("id", call.queue_id);
        }
      }
    }

    return new Response("ok");
  } catch (_e) {
    return new Response("ok");
  }
});

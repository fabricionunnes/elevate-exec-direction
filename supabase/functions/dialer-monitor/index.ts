// dialer-monitor: coloca o GESTOR na conferência da SDR pra escutar/sussurrar/entrar.
// - listen  : mutado, só escuta (cliente e SDR não ouvem o gestor)
// - whisper : fala SÓ pra SDR (Coaching=true + CallSidToCoach = perna da SDR; cliente NÃO ouve)
// - barge   : entra na conversa (cliente e SDR ouvem)
// action=join  -> adiciona o gestor (Twilio liga no browser dele). Retorna o callSid da perna do gestor.
// action=update-> troca o modo (mutado/coaching) da perna já existente do gestor.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const callerId = Deno.env.get("TWILIO_CALLER_ID");
    if (!accountSid || !authToken) throw new Error("Credenciais Twilio incompletas");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    const action: string = body.action || "join";
    const agentStaffId: string | undefined = body.agentStaffId;
    const managerStaffId: string | undefined = body.managerStaffId;
    const mode: string = body.mode || "listen"; // listen | whisper | barge
    if (!agentStaffId || !managerStaffId) throw new Error("agentStaffId e managerStaffId são obrigatórios");

    const conf = `nexus-${agentStaffId}`;
    const auth = "Basic " + btoa(`${accountSid}:${authToken}`);
    const base = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // Perna da SDR na conferência (pra sussurrar só pra ela)
    const { data: call } = await supabase
      .from("crm_calls")
      .select("agent_call_sid, from_number")
      .eq("agent_staff_id", agentStaffId)
      .eq("status", "in-progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const agentCallSid: string | null = (call as any)?.agent_call_sid || null;
    const from = (call as any)?.from_number || callerId;

    // Mapeia o modo -> flags do Twilio
    const muted = mode === "listen";
    const coaching = mode === "whisper";
    if (coaching && !agentCallSid) {
      return json({ error: "Sem a perna da SDR pra sussurrar (ligação ainda conectando). Tenta de novo em 1-2s." }, 409);
    }

    if (action === "update") {
      const participantSid: string | undefined = body.managerCallSid;
      if (!participantSid) throw new Error("managerCallSid é obrigatório pra trocar o modo");
      const p = new URLSearchParams({ Muted: String(muted), Coaching: String(coaching) });
      if (coaching && agentCallSid) p.append("CallSidToCoach", agentCallSid);
      const r = await fetch(`${base}/Conferences/${encodeURIComponent(conf)}/Participants/${participantSid}.json`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: p.toString(),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d?.message || "Falha ao trocar o modo", code: d?.code }, 400);
      return json({ ok: true, mode, conference: conf });
    }

    // action === "join": adiciona o gestor na conferência (Twilio liga no browser dele).
    const p = new URLSearchParams({
      From: from || "",
      To: `client:manager-${managerStaffId}`,
      Beep: "false",
      StartConferenceOnEnter: "false", // gestor não inicia nem mantém a sala
      EndConferenceOnExit: "false",    // gestor sair NÃO encerra a ligação
      EarlyMedia: "true",
      Muted: String(muted),
      Coaching: String(coaching),
    });
    if (coaching && agentCallSid) p.append("CallSidToCoach", agentCallSid);

    const r = await fetch(`${base}/Conferences/${encodeURIComponent(conf)}/Participants.json`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: p.toString(),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[dialer-monitor] falha join:", d?.message, d?.code);
      // 53405/conference not found = ninguém na sala (SDR não está em ligação)
      return json({ error: d?.message || "Falha ao entrar na ligação", code: d?.code }, 400);
    }
    // call_sid da perna do gestor = participant sid (pra update/sair depois)
    return json({ ok: true, mode, conference: conf, managerCallSid: d.call_sid || null });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
});

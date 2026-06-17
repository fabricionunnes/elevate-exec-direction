// dialer-retention (LGPD): apaga gravações na Twilio após N dias (padrão 30), mantém a transcrição.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const days = Number(body.days) || Number(Deno.env.get("DIALER_RECORDING_RETENTION_DAYS")) || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    // ligações antigas que ainda têm gravação
    const { data: calls } = await supabase
      .from("crm_calls")
      .select("id, recording_sid")
      .not("recording_url", "is", null)
      .lt("created_at", cutoff)
      .limit(300);

    let deleted = 0, failed = 0;
    for (const c of calls || []) {
      // apaga na Twilio (se houver sid + credenciais)
      if (c.recording_sid && accountSid && authToken) {
        try {
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${c.recording_sid}.json`, {
            method: "DELETE",
            headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
          });
        } catch (_e) { failed++; }
      }
      // limpa o ponteiro da gravação, mantém a transcrição
      await supabase.from("crm_calls").update({
        recording_url: null, recording_sid: null, recording_deleted_at: new Date().toISOString(),
      }).eq("id", c.id);
      deleted++;
    }

    return new Response(JSON.stringify({ ok: true, retention_days: days, processed: deleted, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

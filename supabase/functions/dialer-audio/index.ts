// dialer-audio: serve a gravação da Twilio (que é privada) pro player, autenticando no backend.
// Sem isso o navegador pede usuário/senha da Twilio ao tocar.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");
    if (!callId) return new Response("callId obrigatório", { status: 400, headers: corsHeaders });

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) return new Response("Twilio não configurado", { status: 500, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: call } = await supabase.from("crm_calls").select("recording_url").eq("id", callId).maybeSingle();
    if (!call?.recording_url) return new Response("Sem gravação", { status: 404, headers: corsHeaders });

    const range = req.headers.get("range");
    const twResp = await fetch(call.recording_url, {
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        ...(range ? { Range: range } : {}),
      },
    });

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Cache-Control", "private, max-age=3600");
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = twResp.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");

    return new Response(twResp.body, { status: twResp.status, headers });
  } catch (error: any) {
    return new Response(error?.message || "erro", { status: 500, headers: corsHeaders });
  }
});

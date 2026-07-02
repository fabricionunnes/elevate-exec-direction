// office-turn: credenciais TURN efêmeras pro UNV Office (WebRTC).
// Sem TURN, a conexão P2P falha em certas redes (NAT simétrico/roteador
// restritivo) — sintoma: pessoas na mesma sala e uma não ouve as outras.
// Usa o Network Traversal Service da Twilio (mesma conta do discador):
// POST /Tokens.json devolve stun+turn com usuário/senha temporários (24h).
// Cobrança só pelo tráfego que realmente precisar de relay.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Só usuários logados no Nexus (inclui visitantes anônimos do Office)
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return json({ iceServers: FALLBACK, source: "fallback", reason: "unauthorized" }, 401);
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !token) {
      return json({ iceServers: FALLBACK, source: "fallback", reason: "twilio_env_missing" });
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
    });
    if (!res.ok) {
      console.error("Twilio token error:", res.status, await res.text());
      return json({ iceServers: FALLBACK, source: "fallback", reason: "twilio_error" });
    }
    const data = await res.json();
    const iceServers = (data.ice_servers || []).map((s: Record<string, string>) => ({
      urls: s.urls || s.url,
      username: s.username,
      credential: s.credential,
    }));
    if (!iceServers.length) {
      return json({ iceServers: FALLBACK, source: "fallback", reason: "empty" });
    }
    return json({ iceServers, source: "twilio", ttl: Number(data.ttl) || 86400 });
  } catch (error) {
    console.error("office-turn error:", error);
    return json({ iceServers: FALLBACK, source: "fallback", reason: "exception" });
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

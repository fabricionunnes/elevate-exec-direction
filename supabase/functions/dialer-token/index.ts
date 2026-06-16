// dialer-token: gera o Twilio Voice AccessToken (JWT HS256) pro softphone da atendente no navegador.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKey = Deno.env.get("TWILIO_API_KEY");
    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");
    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      throw new Error("Credenciais Twilio incompletas (TWILIO_ACCOUNT_SID/API_KEY/API_SECRET/TWIML_APP_SID)");
    }

    const body = await req.json().catch(() => ({}));
    const staffId: string | undefined = body.staffId;
    const identity: string = body.identity || (staffId ? `agent-${staffId}` : null);
    if (!identity) throw new Error("staffId ou identity é obrigatório");

    const now = Math.floor(Date.now() / 1000);
    const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
    const payload = {
      jti: `${apiKey}-${now}`,
      iss: apiKey,
      sub: accountSid,
      iat: now,
      nbf: now,
      exp: now + 3600,
      grants: {
        identity,
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: twimlAppSid },
        },
      },
    };

    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const signature = b64url(await hmacSha256(apiSecret, signingInput));
    const token = `${signingInput}.${signature}`;

    return new Response(JSON.stringify({ token, identity, expires_in: 3600 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// dialer-balance: lê o saldo da conta Twilio (pra avisar quando estiver acabando).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) throw new Error("Credenciais Twilio incompletas");

    const lowThreshold = Number(Deno.env.get("DIALER_LOW_BALANCE") || "10");
    const criticalThreshold = Number(Deno.env.get("DIALER_CRITICAL_BALANCE") || "3");

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`, {
      headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.message || `Twilio ${resp.status}`);

    const balance = parseFloat(data.balance);
    const currency = data.currency || "USD";

    return new Response(JSON.stringify({
      balance,
      currency,
      low: balance <= lowThreshold,
      critical: balance <= criticalThreshold,
      low_threshold: lowThreshold,
      critical_threshold: criticalThreshold,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

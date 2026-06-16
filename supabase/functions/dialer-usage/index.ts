// dialer-usage: gasto diário na Twilio (Usage Records, categoria totalprice). Só pra admin/master no front.
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

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || 14, 1), 90);
    const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records/Daily.json?Category=totalprice&StartDate=${start}&PageSize=100`;
    const resp = await fetch(url, { headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) } });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.message || `Twilio ${resp.status}`);

    const records = (data.usage_records || []).map((r: any) => ({
      date: r.start_date,
      spend: Math.abs(parseFloat(r.price) || 0),
    }));
    const currency = data.usage_records?.[0]?.price_unit?.toUpperCase() || "USD";
    const total = records.reduce((s: number, r: any) => s + r.spend, 0);

    return new Response(JSON.stringify({ days, currency, total, records }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

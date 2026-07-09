// dialer-usage: gasto diário na Twilio (Usage Records, categoria totalprice). Só pra admin/master no front.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cotação USD->BRL com cache diário em fx_rates (busca na AwesomeAPI no máx. 1x/dia).
async function getBrlRate(): Promise<{ rate: number; at: string }> {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cached } = await supabase.from("fx_rates").select("rate, updated_at").eq("pair", "USD-BRL").maybeSingle();
  const fresh = cached && (Date.now() - new Date(cached.updated_at).getTime() < 20 * 3600000);
  if (cached && fresh) return { rate: Number(cached.rate), at: cached.updated_at };
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    const j = await r.json();
    const bid = parseFloat(j?.USDBRL?.bid);
    if (bid > 0) {
      const now = new Date().toISOString();
      await supabase.from("fx_rates").upsert({ pair: "USD-BRL", rate: bid, source: "awesomeapi", updated_at: now });
      return { rate: bid, at: now };
    }
  } catch (_e) { /* mantém cache antigo se houver */ }
  if (cached) return { rate: Number(cached.rate), at: cached.updated_at };
  return { rate: 0, at: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) throw new Error("Credenciais Twilio incompletas");

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || 14, 1), 90);
    const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const basic = "Basic " + btoa(`${accountSid}:${authToken}`);

    // Detalhamento por categoria (pra entender onde o dinheiro vai)
    if (body.breakdown) {
      const bResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json?StartDate=${start}&PageSize=200`, { headers: { Authorization: basic } });
      const bData = await bResp.json();
      if (!bResp.ok) throw new Error(bData?.message || `Twilio ${bResp.status}`);
      const cats = (bData.usage_records || [])
        .map((r: any) => ({ category: r.category, description: r.description, count: Number(r.count), usage: Number(r.usage), usage_unit: r.usage_unit, price: Math.abs(parseFloat(r.price) || 0), price_unit: r.price_unit }))
        .filter((r: any) => r.price > 0 || r.count > 0)
        .sort((a: any, b: any) => b.price - a.price);
      return new Response(JSON.stringify({ days, categories: cats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    const fx = await getBrlRate();

    return new Response(JSON.stringify({ days, currency, total, records, brlRate: fx.rate, brlRateAt: fx.at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

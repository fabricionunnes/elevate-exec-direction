// dialer-balance-alert: checa o saldo Twilio e avisa o(s) master no WhatsApp quando está acabando/crítico.
// Anti-spam: alerta na mudança de nível e, se crítico, um lembrete por dia. Rodar via cron.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STATE_KEY = "dialer_balance_last_alert";
const PREFERRED_INSTANCES = ["financeirounv", "fabricionunnes", "marceloalmeida"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) throw new Error("Credenciais Twilio incompletas");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const low = Number(Deno.env.get("DIALER_LOW_BALANCE") || "10");
    const crit = Number(Deno.env.get("DIALER_CRITICAL_BALANCE") || "3");

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`, {
      headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.message || `Twilio ${r.status}`);
    const balance = parseFloat(d.balance);
    const currency = d.currency || "USD";
    const level = balance <= crit ? "critical" : balance <= low ? "low" : "ok";

    const force = (await req.json().catch(() => ({})))?.force === true ||
      new URL(req.url).searchParams.get("force") === "1";

    // estado anterior (anti-spam)
    const { data: st } = await supabase.from("crm_settings").select("setting_value").eq("setting_key", STATE_KEY).maybeSingle();
    const last: any = st?.setting_value || {};
    const today = new Date().toISOString().slice(0, 10);
    const shouldAlert = level !== "ok" && (force || last.level !== level || (level === "critical" && last.date !== today));

    let alerted = 0;
    if (shouldAlert) {
      const { data: inst } = await supabase
        .from("whatsapp_instances").select("id, instance_name")
        .eq("status", "connected").in("instance_name", PREFERRED_INSTANCES).limit(1).maybeSingle();
      const { data: staff } = await supabase
        .from("onboarding_staff").select("name, phone").eq("role", "master").not("phone", "is", null);

      const msg = level === "critical"
        ? `🔴 *Saldo Twilio CRÍTICO*\n\nSaldo atual: *${currency} ${balance.toFixed(2)}*\nAs ligações do discador podem parar a qualquer momento.\n\nRecarregue agora: https://console.twilio.com`
        : `🟡 *Saldo Twilio acabando*\n\nSaldo atual: *${currency} ${balance.toFixed(2)}*\nVale recarregar pra não parar as ligações do discador.\n\nRecarregar: https://console.twilio.com`;

      if (inst) {
        const seen = new Set<string>();
        for (const s of staff || []) {
          let phone = (s.phone || "").replace(/\D/g, "");
          if (!phone) continue;
          if (!phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) phone = "55" + phone;
          if (seen.has(phone)) continue;
          seen.add(phone);
          const { error } = await supabase.functions.invoke("evolution-api", {
            body: { action: "sendText", instanceId: inst.id, phone, message: msg },
          });
          if (!error) alerted++;
        }
      }

      const value = { level, date: today, balance };
      if (st) await supabase.from("crm_settings").update({ setting_value: value, updated_at: new Date().toISOString() }).eq("setting_key", STATE_KEY);
      else await supabase.from("crm_settings").insert({ setting_key: STATE_KEY, setting_value: value });
    }

    return new Response(JSON.stringify({ balance, currency, level, alerted, alerted_now: shouldAlert }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

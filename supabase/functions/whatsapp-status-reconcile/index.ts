import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Reconcilia o status das instâncias Stevo (manager_v2) com o status REAL.
// O webhook baixa status='disconnected' em eventos transitórios (Disconnected/QR
// de reconexão) mesmo com o telefone conectado — este cron corrige.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const { data: insts } = await supabase.from("whatsapp_instances")
      .select("id, instance_name, api_url, api_key, provider_type, status")
      .not("api_url", "is", null).not("api_key", "is", null);
    let fixed = 0; const out: any[] = [];
    for (const i of (insts || [])) {
      const baseUrl = String(i.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
      let isV2 = i.provider_type === "manager_v2";
      try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* noop */ }
      if (!isV2) continue;
      try {
        const r = await fetch(`${baseUrl}/instance/status`, { headers: { "Content-Type": "application/json", apikey: i.api_key } });
        if (!r.ok) continue;
        const d = await r.json();
        const p = d?.data ?? d;
        const flag = (o: any) => o?.connected ?? o?.Connected ?? o?.loggedIn ?? o?.LoggedIn;
        const state = String(p?.state ?? p?.status ?? d?.state ?? d?.status ?? "").toLowerCase();
        const connected = flag(p) === true || flag(d) === true || ["open", "connected", "online", "loggedin", "logged_in"].includes(state);
        const real = connected ? "connected" : "disconnected";
        if (real !== i.status) {
          await supabase.from("whatsapp_instances").update({ status: real }).eq("id", i.id);
          fixed++; out.push({ instance: i.instance_name, de: i.status, para: real });
        }

        // KEEPALIVE do webhook — roda SEMPRE que a instância está conectada, não só
        // na transição. A Stevo perde/zera a config de webhook mesmo sem "cair"
        // (fica conectada e muda: telefone recebe, sistema não — foi assim que
        // Ricardo/Natalia sumiram do Atendimento). Re-afirmar a cada ciclo (~3min)
        // faz o inbox se consertar sozinho, sem ninguém reconectar na mão.
        // CRÍTICO: enviar SÓ `events`. A presença de `subscribe` no corpo faz a Stevo
        // gravar eventString='' e não entregar NENHUMA mensagem (confirmado: com
        // subscribe → ''; só events → 'MESSAGE'). Era o defeito que re-mutava tudo.
        if (connected) {
          try {
            await fetch(`${baseUrl}/instance/connect`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: i.api_key },
              body: JSON.stringify({
                webhookUrl: `${SUPABASE_URL}/functions/v1/evolution-webhook`,
                events: "Message,Connected,Disconnected,QR",
                immediate: true,
                phone: "",
              }),
            });
          } catch { /* best-effort — próximo ciclo tenta de novo */ }
        }
      } catch { /* ignora instância que não respondeu */ }
    }
    return j({ ok: true, checked: (insts || []).length, fixed, changes: out });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});

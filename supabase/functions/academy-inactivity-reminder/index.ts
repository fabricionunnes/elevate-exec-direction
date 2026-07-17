// Lembrete de inatividade do UNV Academy (cron semanal).
// Aluno que COMEÇOU a estudar e sumiu há 7+ dias (janela até 45 dias) recebe
// um WhatsApp puxando de volta pras aulas. Máximo 1 lembrete por semana por
// aluno (log em academy_inactivity_reminders). Telefone: company_salespeople
// via salesperson_id do onboarding_user. Sem telefone → pula.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  // Instância default do sistema (mesma da régua de pesquisas)
  const { data: cfg } = await supabase
    .from("whatsapp_default_config")
    .select("setting_value")
    .eq("setting_key", "default_instance")
    .maybeSingle();
  const instanceName = cfg?.setting_value;
  if (!instanceName) return { ok: false, error: "sem instância default" };

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type")
    .eq("instance_name", instanceName)
    .eq("status", "connected")
    .maybeSingle();
  if (!instance) return { ok: false, error: "instância desconectada" };

  const apiUrl = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "sem credenciais" };
  const baseUrl = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let isV2 = instance.provider_type === "manager_v2";
  try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* legado */ }

  const sendUrl = isV2 ? `${baseUrl}/send/text` : `${baseUrl}/message/sendText/${instance.instance_name}`;
  const headers: Record<string, string> = isV2
    ? { "Content-Type": "application/json", apikey: apiKey }
    : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
  const payload = isV2 ? { number: phone, text: message, delay: 0 } : { number: phone, text: message };

  const r = await fetch(sendUrl, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` };
  await r.text();
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dry_run;

    // Última atividade por aluno (a partir do progresso real)
    const { data: progress } = await supabase
      .from("academy_progress")
      .select("onboarding_user_id, started_at, completed_at, updated_at");
    const lastByUser = new Map<string, string>();
    (progress || []).forEach((p: any) => {
      const last = [p.completed_at, p.updated_at, p.started_at].filter(Boolean).sort().pop();
      if (!last) return;
      const cur = lastByUser.get(p.onboarding_user_id);
      if (!cur || last > cur) lastByUser.set(p.onboarding_user_id, last);
    });

    const now = Date.now();
    const DAY = 86_400_000;
    // sumiu entre 7 e 45 dias (mais que isso, não insiste toda semana)
    const idle = [...lastByUser.entries()].filter(([, last]) => {
      const days = (now - new Date(last).getTime()) / DAY;
      return days >= 7 && days <= 45;
    });
    if (idle.length === 0) return j({ ok: true, idle: 0, sent: 0 });

    // Já lembrado nos últimos 7 dias? pula
    const { data: recent } = await supabase
      .from("academy_inactivity_reminders")
      .select("onboarding_user_id")
      .gte("sent_at", new Date(now - 7 * DAY).toISOString());
    const reminded = new Set((recent || []).map((r: any) => r.onboarding_user_id));

    const results: any[] = [];
    let sent = 0;
    for (const [userId, last] of idle) {
      if (reminded.has(userId)) continue;
      const { data: user } = await supabase
        .from("onboarding_users")
        .select("id, name, salesperson_id")
        .eq("id", userId)
        .maybeSingle();
      if (!user) continue;

      let phone = "";
      if (user.salesperson_id) {
        const { data: sp } = await supabase
          .from("company_salespeople")
          .select("phone")
          .eq("id", user.salesperson_id)
          .maybeSingle();
        phone = cleanPhone(sp?.phone || null);
      }
      if (!phone) {
        results.push({ user: user.name, skip: "sem telefone" });
        continue;
      }

      const days = Math.floor((now - new Date(last).getTime()) / DAY);
      const firstName = String(user.name || "").trim().split(" ")[0] || "tudo bem";
      const message =
        `Oi ${firstName}, aqui é da UNV Academy.\n\n` +
        `Faz ${days} dias que você não avança nas aulas. Quem treina toda semana vende mais — e sua próxima aula está te esperando.\n\n` +
        `Acesse: https://unvholdings.com.br/#/academy\n\n` +
        `Bora retomar?`;

      if (dryRun) {
        results.push({ user: user.name, phone, days, dry: true });
        continue;
      }
      const send = await sendWhatsApp(supabase, phone, message);
      if (send.ok) {
        sent++;
        await supabase.from("academy_inactivity_reminders").insert({ onboarding_user_id: userId });
        results.push({ user: user.name, sent: true, days });
      } else {
        results.push({ user: user.name, error: send.error });
      }
    }

    return j({ ok: true, idle: idle.length, sent, results });
  } catch (e) {
    console.error("academy-inactivity-reminder", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});

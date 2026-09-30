// wa-oficial-alert — vigia das mensagens enviadas pela API oficial do WhatsApp.
// Meta passa a cobrar POR MENSAGEM a partir de 01/10/2026 (mensagem de serviço na
// tarifa de utilidade). Roda de hora em hora: se algum número passou do teto mensal
// (ai_usage_config.wa_teto_mes), avisa o Fabrício uma vez por dia. Todo dia 1º manda o
// fechamento do mês anterior. Registra em ai_usage_alerts (tipo wa_oficial_*).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("WA_ALERT_SECRET") || "";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => (Number(v) || 0).toLocaleString("pt-BR");

async function sendWhatsApp(supabase: any, phone: string, text: string): Promise<boolean> {
  try {
    const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
      .eq("instance_name", "fabricionunnes").eq("status", "connected").maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return false;
    let host = ""; try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const v2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
    const url = v2 ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text` : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: phone, text }) });
    return r.ok;
  } catch (e) { console.error("[wa-oficial-alert] whatsapp:", e); return false; }
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-alert-secret") !== SECRET) return json({ ok: false, erro: "não autorizado" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({} as any));
  try {
    const { data: cfg } = await supabase.from("ai_usage_config").select("telefone, wa_teto_mes, wa_preco_servico_brl").eq("id", true).maybeSingle();
    const telefone = cfg?.telefone || "5531989840003";
    const teto = Number(cfg?.wa_teto_mes) || 0;
    const agoraBR = new Date(Date.now() - 3 * 3600000);
    const hoje = agoraBR.toISOString().slice(0, 10);
    const iniMes = `${hoje.slice(0, 7)}-01`;
    const { data: insts } = await supabase.from("whatsapp_official_instances").select("id, display_name, phone_number, pricing_rates");
    const contar = async (ini: string, fim: string) => {
      const { data, error } = await supabase.rpc("wa_oficial_contagem", { p_ini: ini, p_fim: fim });
      if (error) throw new Error(`wa_oficial_contagem: ${error.message}`);
      return new Map<string, number>((data || []).map((r: any) => [r.instance_id, Number(r.msgs)]));
    };
    const contMes = await contar(`${iniMes}T03:00:00Z`, new Date(Date.now() + 60000).toISOString());
    const linhas: string[] = []; const estouros: string[] = [];
    let totalMsgs = 0, totalCusto = 0;
    for (const i of insts || []) {
      const preco = Number(cfg?.wa_preco_servico_brl) || Number(i.pricing_rates?.UTILITY) || 0.04;
      const mes = Number(contMes.get(i.id) || 0);
      const custo = mes * preco;
      totalMsgs += mes; totalCusto += custo;
      linhas.push(`${i.display_name} (${i.phone_number}): ${num(mes)} mensagens no mês, ${brl(custo)} estimado`);
      if (teto > 0 && mes >= teto) estouros.push(`${i.display_name}: ${num(mes)} mensagens, teto ${num(teto)}`);
    }
    const resultado: any = { ok: true, hoje, total_msgs: totalMsgs, total_custo_brl: Math.round(totalCusto * 100) / 100, estouros };
    if (body.dry_run) return json({ ...resultado, linhas });

    // estouro: um aviso por dia
    if (estouros.length) {
      const { count } = await supabase.from("ai_usage_alerts").select("id", { count: "exact", head: true }).eq("dia", hoje).eq("tipo", "wa_oficial_teto");
      if (!(count || 0)) {
        const txt = [`*WhatsApp API oficial: passou do teto do mês*`, ...estouros, "", ...linhas, "", "Cada mensagem enviada é cobrada pela Meta. Ajuste o teto em Custo de IA se for esperado."].join("\n");
        const ok = await sendWhatsApp(supabase, telefone, txt);
        if (ok) await supabase.from("ai_usage_alerts").insert({ dia: hoje, tipo: "wa_oficial_teto", custo_usd: 0 });
        resultado.aviso_teto = ok;
      }
    }
    // fechamento mensal: dia 1, uma vez
    if (agoraBR.getUTCDate() === 1 || body.forcar_fechamento) {
      const { count } = await supabase.from("ai_usage_alerts").select("id", { count: "exact", head: true }).eq("dia", hoje).eq("tipo", "wa_oficial_fechamento");
      if (!(count || 0) || body.forcar_fechamento) {
        const mesAnt = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 2, 1));
        const iniAnt = mesAnt.toISOString().slice(0, 10), fimAnt = `${iniMes}T03:00:00Z`;
        const contAnt = await contar(`${iniAnt}T03:00:00Z`, fimAnt);
        const fech: string[] = []; let tm = 0, tc = 0;
        for (const i of insts || []) {
          const preco = Number(cfg?.wa_preco_servico_brl) || Number(i.pricing_rates?.UTILITY) || 0.04;
          const n = Number(contAnt.get(i.id) || 0);
          tm += n; tc += n * preco; fech.push(`${i.display_name}: ${num(n)} mensagens, ${brl(n * preco)}`);
        }
        const txt = [`*WhatsApp API oficial: fechamento de ${iniAnt.slice(5, 7)}/${iniAnt.slice(0, 4)}*`, ...fech, "", `Total: ${num(tm)} mensagens, ${brl(tc)} estimado (tarifa de utilidade por mensagem).`].join("\n");
        const ok = await sendWhatsApp(supabase, telefone, txt);
        if (ok && !body.forcar_fechamento) await supabase.from("ai_usage_alerts").insert({ dia: hoje, tipo: "wa_oficial_fechamento", custo_usd: 0 });
        resultado.fechamento = ok;
      }
    }
    return json(resultado);
  } catch (e) { return json({ ok: false, erro: String((e as Error)?.message || e).slice(0, 300) }, 500); }
});

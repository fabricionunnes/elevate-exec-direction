// Vigia do gasto de IA (24/09/2026). Roda de hora em hora: avisa quando o dia passa do teto
// e manda o fechamento às 20h. O teto e o telefone ficam em ai_usage_config.
// 03/11/2026: os avisos passam pela Central de Avisos (aviso_enviar): o teto vai na hora e o
// fechamento entra no resumo da noite. A trava "uma vez por dia" (ai_usage_alerts) continua; ela
// estava falhando por falta de grant pra service_role, por isso o fechamento repetia 20h, 21h, 22h, 23h.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const usd = (n: number) => `US$ ${n.toFixed(2)}`;
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** cotação do dia; se a fonte falhar, fica a última que já estava salva */
async function atualizarDolar(atual: number): Promise<number> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) { console.error("cotacao http", r.status); return atual; }
    const j: any = await r.json();
    const v = Number(j?.USDBRL?.bid);
    if (!v || v <= 0) { console.error("cotacao sem bid", JSON.stringify(j).slice(0, 120)); return atual; }
    await supabase.from("ai_usage_config").update({ dolar: v, dolar_em: new Date().toISOString() }).eq("id", true);
    return v;
  } catch (e) { console.error("cotacao falhou:", String(e).slice(0, 200)); return atual; }
}

async function aviso(tipo: string, titulo: string, texto: string, nivelPadrao: "hora" | "resumo"): Promise<boolean> {
  const { error } = await supabase.rpc("aviso_enviar", { p_tipo: tipo, p_texto: texto, p_titulo: titulo, p_origem: "nexus", p_nivel_padrao: nivelPadrao });
  if (error) { console.error("aviso_enviar:", error.message); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body: any = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true; // teste manual, ignora a trava de uma vez por dia
    const { data: cfg } = await supabase.from("ai_usage_config").select("*").eq("id", true).maybeSingle();
    const teto = Number(cfg?.teto_usd ?? 15);
    const dolar = await atualizarDolar(Number(cfg?.dolar ?? 5.40));
    const dois = (v: number) => `${usd(v)} (${brl(v * dolar)})`;
    const agora = new Date();
    const hojeBR = new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const horaBR = Number(new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(11, 13));
    const { data: linhas } = await supabase.from("ai_usage_daily").select("fn, modelo, chamadas, custo_usd_estimado").eq("dia", hojeBR);
    const itens = (linhas || []).map((l: any) => ({ ...l, custo: Number(l.custo_usd_estimado) || 0 })).sort((a: any, b: any) => b.custo - a.custo);
    const total = itens.reduce((s: number, l: any) => s + l.custo, 0);
    const detalhe = itens.slice(0, 5).map((l: any) => `${l.fn} (${l.modelo}): ${dois(l.custo)} em ${l.chamadas} chamadas`).join("\n");
    const jaEnviado = async (tipo: string) => {
      if (forcar) return false;
      const { data } = await supabase.from("ai_usage_alerts").select("id").eq("dia", hojeBR).eq("tipo", tipo).maybeSingle();
      return !!data;
    };
    const marcar = async (tipo: string) => {
      const { error } = await supabase.from("ai_usage_alerts").insert({ dia: hojeBR, tipo, custo_usd: total });
      if (error) console.error("ai_usage_alerts insert:", error.message);
    };
    // 1) estourou o teto: na hora
    if (total >= teto && !(await jaEnviado("teto"))) {
      const texto = `*Gasto de IA passou do teto*\n\nHoje: ${dois(total)}\nTeto: ${dois(teto)}\n\n${detalhe}\n\nO teto se muda na tela Custo de IA.`;
      const ok = await aviso("ia_custo_teto", "Custo de IA: teto estourado", texto, "hora");
      if (ok) await marcar("teto");
      return json({ ok: true, alerta: "teto", total, enviado: ok });
    }
    // 2) fechamento do dia às 20h: entra no resumo da noite (20h40)
    if (horaBR >= 20 && cfg?.avisar_resumo !== false && !(await jaEnviado("resumo"))) {
      const texto = `*IA do dia*\n\nTotal: ${dois(total)}\nTeto: ${dois(teto)}\n\n${detalhe || "Sem uso registrado hoje."}\n\nDólar de hoje: ${brl(dolar)}`;
      const ok = await aviso("ia_custo_fechamento", "Custo de IA: fechamento do dia", texto, "resumo");
      if (ok) await marcar("resumo");
      return json({ ok: true, alerta: "resumo", total, enviado: ok });
    }
    return json({ ok: true, total, teto, dolar, total_brl: Number((total * dolar).toFixed(2)), sem_alerta: true });
  } catch (e) {
    console.error("ai-usage-alert:", e);
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});

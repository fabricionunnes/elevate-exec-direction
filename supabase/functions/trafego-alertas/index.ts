import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Vigia de otimização do tráfego pago (20/10/2026, pedido do Fabrício: "quando tiver que
// otimizar a campanha você me avisa"). Lê a conta Meta conectada no Nexus (meta_ads_accounts),
// aplica as regras do planejamento do cliente (trafego_alertas_config) e manda WhatsApp
// SÓ quando tem decisão a tomar. Segunda-feira manda também a leitura da semana com a
// decisão da escada de verba (sobe, mantém ou volta um degrau).
// Primeiro cliente: Summit/Delly (Amil PME, campanha de formulário). Lead no pixel = empresário;
// pessoa física dispara LeadDesqualificado, então qualificação = Lead ÷ (Lead + LeadDesqualificado).
// Anti-spam por chave em trafego_alertas_log. Cron trafego-alertas-diario, 9h de Brasília.
// Auth: x-trafego-secret (mesmo secret do trafego-pago-sync). Body: { project_id?, dry_run?, force_weekly? }

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trafego-secret" };
const G = "https://graph.facebook.com/v21.0";
const FONE_PADRAO = "5531989840003"; // Fabrício
const COLS = "instance_name, api_url, api_key, status, provider_type";
// Marcelo primeiro (o Fabrício lê os avisos do Marcelo); Fabrício Nunnes de reserva.
const INSTANCIAS = ["marceloalmeida", "fabricionunnes"];

type Degrau = { total: number; conjuntos: Record<string, number> };
type Cfg = {
  project_id: string; nome: string; ativo: boolean; fones: string[] | null; pixel_id: string | null;
  escada: Degrau[]; regras: Record<string, number>;
};

const R = (n: number) => "R$" + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const R0 = (n: number) => "R$" + Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => Math.round(n * 100) + "%";
const leadsTxt = (n: number) => n + (n === 1 ? " lead" : " leads");
const num = (v: unknown) => Number(v ?? 0) || 0;
const leadsDe = (acts: any[] | undefined) => num((acts || []).find((a) => a.action_type === "offsite_conversion.fb_pixel_lead")?.value);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function diasAtras(n: number) { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return ymd(d); }

async function graph(path: string, params: Record<string, string>, token: string) {
  const u = new URL(G + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", token);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (j?.error) throw new Error(`Meta ${path}: ${j.error.message || JSON.stringify(j.error).slice(0, 200)}`);
  return j;
}
async function todas(path: string, params: Record<string, string>, token: string) {
  const out: any[] = [];
  let j = await graph(path, { limit: "200", ...params }, token);
  out.push(...(j.data || []));
  for (let i = 0; j?.paging?.next && i < 10; i++) { j = await (await fetch(j.paging.next)).json(); out.push(...(j.data || [])); }
  return out;
}
const janela = (de: string, ate: string) => JSON.stringify({ since: de, until: ate });

async function zapUma(sb: any, instName: string, fone: string, texto: string) {
  const { data: inst } = await sb.from("whatsapp_instances").select(COLS).eq("instance_name", instName).eq("status", "connected").maybeSingle();
  if (!inst?.api_url || !inst?.api_key) return false;
  let host = "";
  try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* assume evolution */ }
  const isV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
  const url = isV2
    ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
    : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: fone, text: texto }) });
  return r.ok;
}
async function zap(sb: any, fones: string[], texto: string) {
  let ok = 0;
  for (const fone of fones) {
    for (const nome of INSTANCIAS) {
      try { if (await zapUma(sb, nome, fone, texto)) { ok++; break; } } catch { /* tenta a próxima */ }
    }
  }
  return ok;
}

// degrau atual = o da escada mais perto da diária total que está rodando hoje
function degrauAtual(escada: Degrau[], diariaTotal: number) {
  let idx = 0, melhor = Infinity;
  escada.forEach((d, i) => { const dif = Math.abs(d.total - diariaTotal); if (dif < melhor) { melhor = dif; idx = i; } });
  return idx;
}
function conjuntoDaEscada(nomeConjunto: string, chaves: string[]) {
  const n = nomeConjunto.toUpperCase();
  return chaves.find((k) => n.startsWith(k.toUpperCase())) || null;
}

async function processa(sb: any, cfg: Cfg, opts: { dry: boolean; forceWeekly: boolean }) {
  const regras = { gasto_sem_lead: 40, frequencia_max: 3, cpl_acima_media: 1.5, gasto_min_conjunto: 30,
    leads_min_semana: 5, qualif_min: 0.4, qualif_volta: 0.25, ...cfg.regras };
  const { data: conta } = await sb.from("meta_ads_accounts").select("ad_account_id, access_token, is_connected")
    .eq("project_id", cfg.project_id).maybeSingle();
  if (!conta?.access_token || !conta.is_connected) return { projeto: cfg.nome, erro: "conta Meta não conectada no Nexus" };
  const act = conta.ad_account_id.startsWith("act_") ? conta.ad_account_id : "act_" + conta.ad_account_id;
  const tk = conta.access_token;

  const ontem = diasAtras(1), d7 = diasAtras(7), d14 = diasAtras(14), d8 = diasAtras(8);
  const [adsets, ads, insAd, insSet, insConta, insContaAnt, insOntem] = await Promise.all([
    todas(`/${act}/adsets`, { fields: "id,name,daily_budget,effective_status,campaign{name,effective_status}", effective_status: JSON.stringify(["ACTIVE"]) }, tk),
    todas(`/${act}/ads`, { fields: "id,name,effective_status,adset_id,adset{name},campaign{effective_status}" }, tk),
    todas(`/${act}/insights`, { level: "ad", time_range: janela(d7, ontem), fields: "ad_id,ad_name,adset_id,adset_name,spend,actions" }, tk),
    todas(`/${act}/insights`, { level: "adset", time_range: janela(d7, ontem), fields: "adset_id,adset_name,spend,frequency,actions" }, tk),
    todas(`/${act}/insights`, { level: "account", time_range: janela(d7, ontem), fields: "spend,actions" }, tk),
    todas(`/${act}/insights`, { level: "account", time_range: janela(d14, d8), fields: "spend,actions" }, tk),
    todas(`/${act}/insights`, { level: "account", time_range: janela(ontem, ontem), fields: "spend" }, tk),
  ]);

  const ativos = new Set(adsets.map((a: any) => a.id));
  const gasto7 = num(insConta[0]?.spend), leads7 = leadsDe(insConta[0]?.actions);
  const cpl7 = leads7 ? gasto7 / leads7 : 0;
  const alertas: { chave: string; dias: number; texto: string }[] = [];

  // A) anúncio reprovado ou com problema em conjunto ativo
  for (const ad of ads) {
    if (!ativos.has(ad.adset_id)) continue;
    if (["DISAPPROVED", "WITH_ISSUES"].includes(ad.effective_status)) {
      alertas.push({ chave: `ad_status:${ad.id}:${ad.effective_status}`, dias: 3,
        texto: `Anúncio ${ad.effective_status === "DISAPPROVED" ? "REPROVADO" : "com problema"}: ${ad.name} (${ad.adset?.name || ""}). Abrir no Gerenciador e corrigir ou trocar.` });
    }
  }
  // B) conjunto ativo e a conta não gastou nada ontem (saldo, cartão, revisão)
  if (adsets.length && num(insOntem[0]?.spend) === 0) {
    alertas.push({ chave: `sem_gasto:${ontem}`, dias: 1,
      texto: `A campanha não gastou nada ontem com ${adsets.length} conjunto(s) ativo(s). Ver pagamento, saldo ou anúncios em revisão.` });
  }
  // C) anúncio queimando verba sem lead
  for (const r of insAd) {
    if (!ativos.has(r.adset_id)) continue;
    const g = num(r.spend), l = leadsDe(r.actions);
    if (g >= regras.gasto_sem_lead && l === 0) {
      alertas.push({ chave: `ad_sem_lead:${r.ad_id}`, dias: 3,
        texto: `PAUSAR: ${r.ad_name} gastou ${R(g)} em 7 dias e não trouxe nenhum lead (${r.adset_name}).` });
    }
  }
  for (const r of insSet) {
    if (!ativos.has(r.adset_id)) continue;
    const g = num(r.spend), l = leadsDe(r.actions), f = num(r.frequency);
    // D) frequência alta: público cansando do criativo
    if (f > regras.frequencia_max) {
      alertas.push({ chave: `freq:${r.adset_id}`, dias: 7,
        texto: `CRIATIVO NOVO: ${r.adset_name} está com frequência ${f.toFixed(1)} em 7 dias (limite ${regras.frequencia_max}). O público já viu demais os mesmos anúncios.` });
    }
    // E) conjunto com custo por lead muito acima da média da conta
    if (leads7 >= 3 && g >= regras.gasto_min_conjunto) {
      const cplSet = l ? g / l : Infinity;
      if (cplSet > cpl7 * regras.cpl_acima_media) {
        alertas.push({ chave: `cpl_alto:${r.adset_id}`, dias: 7,
          texto: `REDUZIR 30% E TROCAR CRIATIVO: ${r.adset_name} com custo por lead ${l ? R(cplSet) : "sem lead"} em 7 dias, contra ${R(cpl7)} da conta (${R(g)} gastos, ${leadsTxt(l)}).` });
      }
    }
  }

  // Segunda-feira: leitura da semana e decisão da escada (sempre manda)
  const hojeBR = new Date(Date.now() - 3 * 3600_000);
  let semanal: string | null = null;
  if ((hojeBR.getUTCDay() === 1 || opts.forceWeekly) && cfg.escada?.length) {
    let desq7 = 0, lead7pixel = 0;
    if (cfg.pixel_id) {
      try {
        const st = await graph(`/${cfg.pixel_id}/stats`, { aggregation: "event", start_time: String(Math.floor(new Date(d7 + "T03:00:00Z").getTime() / 1000)), end_time: String(Math.floor(new Date(ymd(new Date()) + "T03:00:00Z").getTime() / 1000)) }, tk);
        for (const b of st.data || []) for (const e of b.data || []) {
          if (e.value === "LeadDesqualificado") desq7 += num(e.count);
          if (e.value === "Lead") lead7pixel += num(e.count);
        }
      } catch { /* sem acesso ao pixel: segue sem a taxa */ }
    }
    const qualif = leads7 + desq7 ? leads7 / (leads7 + desq7) : null;
    const gastoAnt = num(insContaAnt[0]?.spend), leadsAnt = leadsDe(insContaAnt[0]?.actions);
    const cplAnt = leadsAnt ? gastoAnt / leadsAnt : null;
    const chaves = Object.keys(cfg.escada[0].conjuntos);
    const diariaHoje = adsets.reduce((s: number, a: any) => s + num(a.daily_budget) / 100, 0);
    const idx = degrauAtual(cfg.escada, diariaHoje);
    const { data: antes } = await sb.from("trafego_alertas_log").select("dados").eq("project_id", cfg.project_id)
      .like("chave", "semana:%").order("criado_em", { ascending: false }).limit(1).maybeSingle();
    const qualifAnt = antes?.dados?.qualif ?? null;

    // semana curta (campanha nova, pausa, saldo): gastou menos de 60% do previsto pra 7 dias, não decide escada
    const semanaCurta = gasto7 < diariaHoje * 7 * 0.6;
    const passou = leads7 >= regras.leads_min_semana && (qualif === null || qualif >= regras.qualif_min)
      && (idx < 1 || cplAnt === null || cpl7 <= cplAnt);
    const volta = qualif !== null && qualif < regras.qualif_volta && qualifAnt !== null && qualifAnt < regras.qualif_volta;
    let decisao: string, alvo = idx;
    if (semanaCurta) decisao = `AGUARDAR: a semana gastou ${R(gasto7)} de ${R0(diariaHoje * 7)} previstos, pouco dado pra decidir. Mantém a verba e reavalia na próxima segunda.`;
    else if (volta && idx > 0) { alvo = idx - 1; decisao = "VOLTAR UM DEGRAU: 2 semanas seguidas com qualificação abaixo de " + pct(regras.qualif_volta) + "."; }
    else if (passou && idx < cfg.escada.length - 1) { alvo = idx + 1; decisao = "SUBIR O DEGRAU: a semana passou no critério."; }
    else if (passou) decisao = "MANTER: já está no teto da escada. Passar disso só com nova decisão.";
    else {
      const falta: string[] = [];
      if (leads7 < regras.leads_min_semana) falta.push(`${leadsTxt(leads7)} de empresário (mínimo ${regras.leads_min_semana})`);
      if (qualif !== null && qualif < regras.qualif_min) falta.push(`qualificação ${pct(qualif)} (mínimo ${pct(regras.qualif_min)})`);
      if (idx >= 1 && cplAnt !== null && cpl7 > cplAnt) falta.push(`custo por lead subiu de ${R(cplAnt)} pra ${R(cpl7)}`);
      decisao = "MANTER A VERBA e trocar criativo ou segmentação. Não passou: " + falta.join("; ") + ".";
    }
    const linhasConj = adsets.map((a: any) => {
      const k = conjuntoDaEscada(a.name, chaves);
      const novo = k ? cfg.escada[alvo].conjuntos[k] : null;
      const atual = num(a.daily_budget) / 100;
      return `- ${a.name}: ${R0(atual)}/dia${novo != null && alvo !== idx ? ` → ${R0(novo)}/dia` : ""}`;
    });
    const ranking = insAd.filter((r: any) => ativos.has(r.adset_id) && leadsDe(r.actions) > 0)
      .map((r: any) => ({ nome: r.ad_name, cpl: num(r.spend) / leadsDe(r.actions), l: leadsDe(r.actions) }))
      .sort((a: any, b: any) => a.cpl - b.cpl);
    semanal = [
      `*${cfg.nome}: leitura da semana* (${d7.split("-").reverse().slice(0, 2).join("/")} a ${ontem.split("-").reverse().slice(0, 2).join("/")})`,
      ``,
      `Gasto: ${R(gasto7)}`,
      `Leads de empresário: ${leads7}${leadsAnt || gastoAnt ? ` (semana anterior: ${leadsAnt})` : ""}`,
      `Pessoa física barrada no formulário: ${desq7}`,
      `Qualificação: ${qualif === null ? "sem dado" : pct(qualif)}`,
      `Custo por lead de empresário: ${leads7 ? R(cpl7) : "sem lead"}${cplAnt ? ` (anterior: ${R(cplAnt)})` : ""}`,
      ranking.length ? `Melhor anúncio: ${ranking[0].nome} (${R(ranking[0].cpl)} por lead, ${leadsTxt(ranking[0].l)})` : ``,
      ``,
      `Degrau atual: ${idx + 1} de ${cfg.escada.length} (${R0(diariaHoje)}/dia)`,
      `*Decisão: ${decisao}*`,
      ...linhasConj,
    ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
    if (!opts.dry) {
      await sb.from("trafego_alertas_log").upsert({ project_id: cfg.project_id, chave: `semana:${ontem}`, texto: semanal,
        dados: { qualif, leads7, desq7, gasto7, cpl7, degrau: idx, alvo, lead7pixel } }, { onConflict: "project_id,chave" });
    }
  }

  // anti-spam: só manda alerta cuja chave não saiu dentro da janela dela
  const novos: typeof alertas = [];
  for (const a of alertas) {
    const { data: ja } = await sb.from("trafego_alertas_log").select("criado_em").eq("project_id", cfg.project_id).eq("chave", a.chave)
      .gte("criado_em", new Date(Date.now() - a.dias * 86400_000 + 3600_000).toISOString()).limit(1).maybeSingle();
    if (!ja) novos.push(a);
  }
  const partes: string[] = [];
  if (semanal) partes.push(semanal);
  if (novos.length) partes.push(`*${cfg.nome}: otimizar a campanha*\n\n` + novos.map((a) => "- " + a.texto).join("\n"));
  if (!partes.length) return { projeto: cfg.nome, alertas: 0, enviado: false };
  const texto = partes.join("\n\n") + `\n\nGasto 7 dias: ${R(gasto7)} | Leads: ${leads7} | Custo por lead: ${leads7 ? R(cpl7) : "sem lead"}`;
  if (opts.dry) return { projeto: cfg.nome, dry_run: true, texto };
  const enviados = await zap(sb, cfg.fones?.length ? cfg.fones : [FONE_PADRAO], texto);
  if (enviados) {
    for (const a of novos) {
      await sb.from("trafego_alertas_log").upsert({ project_id: cfg.project_id, chave: a.chave, texto: a.texto, criado_em: new Date().toISOString() }, { onConflict: "project_id,chave" });
    }
  }
  return { projeto: cfg.nome, alertas: novos.length, semanal: !!semanal, enviados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  const segredo = Deno.env.get("TRAFEGO_SYNC_SECRET");
  if (!segredo || req.headers.get("x-trafego-secret") !== segredo) return json({ error: "nao_autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let q = sb.from("trafego_alertas_config").select("*").eq("ativo", true);
  if (body.project_id) q = q.eq("project_id", body.project_id);
  const { data: cfgs, error } = await q;
  if (error) return json({ error: error.message }, 500);
  const res = [];
  for (const cfg of cfgs || []) {
    try { res.push(await processa(sb, cfg as Cfg, { dry: !!body.dry_run, forceWeekly: !!body.force_weekly })); }
    catch (e) { res.push({ projeto: (cfg as Cfg).nome, erro: String((e as Error).message || e).slice(0, 300) }); }
  }
  return json({ ok: true, resultados: res });
});

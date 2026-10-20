// iHelpChat (CRM próprio, apiv3.ihelpchat.com/api/v2) → KPIs do Nexus.
// Login: POST configurations/users/login?force=false {email, passwordHash: <senha>} → dados.token (Bearer).
// Credenciais vêm de onboarding_projects.crm_login/crm_password do projeto da config.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const TAG = "[IHELP]";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const diaBR = (v: string | number) => new Date((typeof v === "number" ? (v > 1e12 ? v : v * 1000) : new Date(v).getTime()) - 3 * 3600000).toISOString().slice(0, 10);

type Cfg = { id: string; company_id: string; project_id: string | null; base_url: string; kpi_map: Record<string, string>; regras: Record<string, any>; api_token: string | null };

async function login(sb: any, cfg: Cfg, force = false): Promise<string> {
  if (!cfg.project_id) throw new Error("config sem project_id");
  const { data: p } = await sb.from("onboarding_projects").select("crm_login, crm_password").eq("id", cfg.project_id).maybeSingle();
  if (!p?.crm_login || !p?.crm_password) throw new Error("projeto sem crm_login/crm_password");
  const r = await fetch(`${cfg.base_url}configurations/users/login?force=${force}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: String(p.crm_login).trim(), passwordHash: String(p.crm_password).trim() }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`login ${r.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  if (j?.codigo === "AUTH_2FA_REQUIRED") throw new Error("login exige 2FA (código no WhatsApp): desligar 2FA do usuário da integração");
  const token = j?.dados?.token;
  if (!token) throw new Error("login sem token: " + txt.slice(0, 200));
  await sb.from("ihelp_sync_configs").update({ api_token: token }).eq("id", cfg.id);
  return token;
}
async function getToken(sb: any, cfg: Cfg, force = false) { return cfg.api_token || await login(sb, cfg, force); }

async function api(cfg: Cfg, token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${cfg.base_url}${path.replace(/^\//, "")}`, {
    ...init, headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${txt.slice(0, 200)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}

async function sonda(sb: any, cfg: Cfg, chamadas: { path: string; method?: string; body?: any }[], limite = 6000, force = false) {
  const token = await getToken(sb, cfg, force);
  const out: Record<string, any> = {};
  for (const c of chamadas) {
    try {
      const r = await fetch(`${cfg.base_url}${c.path.replace(/^\//, "")}`, { method: c.method || "GET", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` }, body: c.body ? JSON.stringify(c.body) : undefined });
      const txt = await r.text();
      out[(c.method || "GET") + " " + c.path] = { status: r.status, corpo: txt.slice(0, limite) };
    } catch (e) { out[c.path] = { erro: String(e) }; }
  }
  return out;
}

function diasEntre(desde: string, ate: string) {
  const out: string[] = []; const d = new Date(desde + "T00:00:00Z"); const fim = new Date(ate + "T00:00:00Z");
  for (; d <= fim; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

// Sync: Atendimentos/Leads = indicadores de atendimento por usuário e dia (valor absoluto do dia);
// Matrículas/Vendas/Faturamento = cards nas etapas "Matriculado" (cada card conta uma vez);
// Metas = goalValue do funil → kpi_monthly_targets de Faturamento do vendedor do funil.
async function sync(sb: any, cfg: Cfg, dias: number, dryRun: boolean, janela?: { desde: string; ate: string }, force = false) {
  const token = await getToken(sb, cfg, force);
  const regras = cfg.regras || {};
  const usuarios: Record<string, string> = regras.usuarios || {};
  const funis: Record<string, string> = regras.funis || {};
  const fallback: string | null = regras.vendedor_fallback || null;
  const hojeBR = diaBR(Date.now());
  const desde = janela?.desde || diaBR(Date.now() - dias * 86400000);
  const ate = janela?.ate || hojeBR;
  const { data: sellers } = await sb.from("company_salespeople").select("id, name, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
  const spById = new Map((sellers || []).map((x: any) => [x.id, x]));
  const spDe = (id: string | null) => (id && spById.get(id)) || (fallback && spById.get(fallback)) || null;

  // 1) indicadores por usuário e dia (valor absoluto: reescreve a linha do dia)
  const absolutas: { kpi: string; sp: any; dia: string; valor: number }[] = [];
  let chamadas = 0;
  for (const dia of diasEntre(desde, ate)) {
    for (const [uid, spId] of Object.entries(usuarios)) {
      const sp = spDe(spId); if (!sp) continue;
      const j = await api(cfg, token, `dashboard/get-indicators?fromDate=${dia}T00:00:00&toDate=${dia}T23:59:59&usersId=${uid}`); chamadas++;
      const abertos = Number(j?.abertos || 0), receptivos = Number(j?.receptivos || 0);
      if (cfg.kpi_map.atendimentos) absolutas.push({ kpi: "atendimentos", sp, dia, valor: abertos });
      if (cfg.kpi_map.leads) absolutas.push({ kpi: "leads", sp, dia, valor: receptivos });
    }
  }

  // 2) cards nas etapas de matrícula (dedupe por card)
  const ja = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: pag, error } = await sb.from("ihelp_kpi_events").select("ref_id, kpi").eq("config_id", cfg.id).order("created_at", { ascending: true }).range(from, from + 999);
    if (error) throw new Error("eventos: " + error.message);
    (pag || []).forEach((e: any) => ja.add(`${e.ref_id}|${e.kpi}`));
    if (!pag || pag.length < 1000) break;
  }
  const soma = new Map<string, { kpi: string; sp: any; dia: string; valor: number }>();
  const add = (kpi: string, sp: any, dia: string, v: number) => {
    if (!sp || !cfg.kpi_map[kpi]) return;
    const k = `${kpi}|${sp.id}|${dia}`; const cur = soma.get(k) || { kpi, sp, dia, valor: 0 }; cur.valor += v; soma.set(k, cur);
  };
  const eventos: any[] = [];
  let cards = 0;
  for (const st of (regras.etapas_matricula || []) as number[]) {
    for (let page = 1; page <= 50; page++) {
      const j = await api(cfg, token, `crm/funnelstage/${st}/cards`, { method: "POST", body: JSON.stringify({ page, pageSize: 100 }) }); chamadas++;
      const lista: any[] = j?.data || [];
      for (const c of lista) {
        cards++;
        if (ja.has(`card:${c.id}|matricula`)) continue;
        const sp = spDe(usuarios[String(c.responsibleId)] || funis[String(c.funnelId)] || null);
        const dia = diaBR(c.closureDate || c.updatedAt || c.createdDate);
        // cards antigos (antes da integração) já foram lançados à mão no Nexus: ignora
        if (regras.cards_desde && dia < String(regras.cards_desde)) continue;
        add("matriculas", sp, dia, 1); add("vendas", sp, dia, 1);
        eventos.push({ config_id: cfg.id, ref_id: `card:${c.id}`, kpi: "matricula", salesperson_id: sp?.id || null, entry_date: dia, value: 1 });
        const valor = Number(c.estimatedValue || 0);
        if (valor > 0) { add("faturamento", sp, dia, valor); eventos.push({ config_id: cfg.id, ref_id: `card:${c.id}`, kpi: "fat", salesperson_id: sp?.id || null, entry_date: dia, value: valor }); }
      }
      if (!j?.pagination?.hasNext) break;
    }
  }

  // 3) metas do funil (goalValue) → meta mensal de Faturamento do vendedor do funil
  const funisApi: any[] = await api(cfg, token, "crm/funnel").catch(() => []); chamadas++;
  const metas = funisApi.filter((f) => Number(f.goalValue) > 0 && funis[String(f.id)]).map((f) => ({ funil: f.title, sp: spDe(funis[String(f.id)]), valor: Number(f.goalValue) }));

  const planejado = [...soma.values()];
  let gravadas = 0, metasGravadas = 0;
  if (!dryRun) {
    for (let i = 0; i < eventos.length; i += 500) {
      const { error } = await sb.from("ihelp_kpi_events").insert(eventos.slice(i, i + 500));
      if (error) throw new Error("gravar eventos: " + error.message);
    }
    const linha = (p: { kpi: string; sp: any; dia: string }, value: number) => ({
      company_id: cfg.company_id, kpi_id: cfg.kpi_map[p.kpi], salesperson_id: p.sp.id, entry_date: p.dia, value,
      unit_id: p.sp.unit_id ?? null, team_id: p.sp.team_id ?? null, sector_id: p.sp.sector_id ?? null, observations: `${TAG} sync automático do iHelpChat`,
    });
    for (let i = 0; i < absolutas.length; i += 100) {
      const { error } = await sb.from("kpi_entries").upsert(absolutas.slice(i, i + 100).map((p) => linha(p, p.valor)), { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) console.error("[ihelp-sync] upsert absolutas:", error.message); else gravadas += Math.min(100, absolutas.length - i);
    }
    for (const p of planejado) {
      const { data: atual } = await sb.from("kpi_entries").select("value").eq("company_id", cfg.company_id).eq("kpi_id", cfg.kpi_map[p.kpi]).eq("salesperson_id", p.sp.id).eq("entry_date", p.dia).maybeSingle();
      const { error } = await sb.from("kpi_entries").upsert(linha(p, Number(atual?.value || 0) + p.valor), { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) console.error("[ihelp-sync] upsert cards:", error.message); else gravadas++;
    }
    const mes = hojeBR.slice(0, 7);
    for (const m of metas) {
      if (!m.sp || !cfg.kpi_map.faturamento) continue;
      const { data: ex } = await sb.from("kpi_monthly_targets").select("id").eq("company_id", cfg.company_id).eq("kpi_id", cfg.kpi_map.faturamento).eq("salesperson_id", m.sp.id).eq("month_year", mes).maybeSingle();
      const { error } = ex?.id
        ? await sb.from("kpi_monthly_targets").update({ target_value: m.valor }).eq("id", ex.id)
        : await sb.from("kpi_monthly_targets").insert({ company_id: cfg.company_id, kpi_id: cfg.kpi_map.faturamento, salesperson_id: m.sp.id, month_year: mes, target_value: m.valor, level_name: "Meta", level_order: 1 });
      if (!error) metasGravadas++;
    }
    await sb.from("ihelp_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: { janela: [desde, ate], chamadas, cards, novos_eventos: eventos.length, linhas: absolutas.length + planejado.length, metas: metas.length } }).eq("id", cfg.id);
  }
  const resumo = (arr: typeof absolutas) => { const r: Record<string, number> = {}; arr.forEach((p) => { const k = `${p.kpi} ${p.dia.slice(0, 7)} ${p.sp.name}`; r[k] = (r[k] || 0) + p.valor; }); return r; };
  return { dry_run: dryRun, janela: [desde, ate], chamadas, cards_nas_etapas: cards, novos_eventos: eventos.length, gravadas, metas, metas_gravadas: metasGravadas, resumo_indicadores: resumo(absolutas), resumo_cards: resumo(planejado) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({} as any));
  try {
    let q = sb.from("ihelp_sync_configs").select("*").eq("enabled", true);
    if (body.config_id) q = q.eq("id", body.config_id);
    const { data: cfgs, error } = await q;
    if (error) throw new Error("config: " + error.message);
    if (!cfgs?.length) return json({ error: "sem config" }, 404);
    const out: Record<string, unknown> = {};
    for (const cfg of cfgs as Cfg[]) {
      try {
        if (body.relogar) { await sb.from("ihelp_sync_configs").update({ api_token: null }).eq("id", cfg.id); cfg.api_token = null; }
        out[cfg.id] = body.action === "sonda" ? await sonda(sb, cfg, body.chamadas || [], Number(body.limite || 6000), !!body.force)
          : await sync(sb, cfg, Number(body.dias || 3), !!body.dry_run, body.desde && body.ate ? { desde: String(body.desde), ate: String(body.ate) } : undefined, !!body.force);
      } catch (e) {
        out[cfg.id] = { error: String(e).slice(0, 300) };
        if (/ 401/.test(String(e))) await sb.from("ihelp_sync_configs").update({ api_token: null }).eq("id", cfg.id);
      }
    }
    return json(out);
  } catch (e) { return json({ error: String(e) }, 500); }
});

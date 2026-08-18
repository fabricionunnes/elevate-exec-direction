// kommo-sync: preenche automaticamente os KPIs de clientes que usam o Kommo
// (ex-amoCRM). Mesma régua das outras integrações (Agendor/Bitrix/Datacrazy):
// conta FLUXO do funil — quantos leads entraram em cada etapa mapeada, no dia em
// que entraram, por vendedor (responsável do lead) — mais leads criados, ganhos
// (com valor) e perdidos. Grava o consolidado em kpi_entries com a tag [KOMMO].
//
// O Kommo guarda o histórico de mudança de etapa em /api/v4/events
// (lead_status_changed, lead_added), então não precisa de foto: cada rodada relê
// a janela inteira e SUBSTITUI os lançamentos dos KPIs sincronizados dos
// vendedores mapeados dentro da janela (Kommo é a fonte da verdade).
// Um lead conta uma vez por KPI dentro da janela (funil: quantos passaram).
//
// Config por empresa em kommo_sync_configs (subdomínio, secret do token de longa
// duração, kpi_map, user_overrides). Token nunca sai na resposta/log.
//
// Entradas:
//   { action: "ping", company_id }      → confere token (conta + usuários)
//   { action: "users", company_id }     → usuários do Kommo x vendedores do Nexus
//   { action: "pipelines", company_id } → funis e etapas (pra montar o kpi_map)
//   { action: "sync", company_id?, days?, since?, until?, dry_run? } → sincroniza (todas as
//        empresas habilitadas sem company_id — é o que o cron chama)
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TAG = "[KOMMO]";
const OBS = `${TAG} sync automático do Kommo`;
const WON = 142, LOST = 143;

type StageRef = { pipeline_id: number; status_id: number; name?: string };
type KpiRule = {
  kpi_id: string; kpi_name?: string;
  kind: "created" | "stage" | "won" | "lost";
  value?: "price" | null;
  stages?: StageRef[];
  pipelines?: number[];
};
type Config = {
  id: string; company_id: string; label: string | null; subdomain: string; secret_name: string;
  enabled: boolean; kpi_map: KpiRule[]; user_overrides: Record<string, string | null>;
};
type Seller = { id: string; name: string; unit_id: string | null; team_id: string | null; sector_id: string | null };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
/** "Joselia | Consultora de Vendas" (Kommo) ↔ "Joselia" (Nexus) */
function matchByName(raw: string, list: Seller[]): Seller | null {
  const target = norm(String(raw).split("|")[0]);
  if (!target) return null;
  const exact = list.filter((x) => norm(x.name) === target);
  if (exact.length === 1) return exact[0];
  const tTok = target.split(" ").filter((t) => t.length > 1);
  const contained = list.filter((x) => {
    const tok = norm(x.name).split(" ").filter((t) => t.length > 1);
    return tok.length > 0 && tok.every((t) => tTok.includes(t));
  });
  if (contained.length === 1) return contained[0];
  const first = list.filter((x) => norm(x.name).split(" ")[0] === tTok[0]);
  return first.length === 1 ? first[0] : null;
}
const brDate = (unix: number) => new Date(unix * 1000 - 3 * 3600000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function kommo(cfg: Config, token: string, path: string, tries = 4): Promise<any> {
  const url = `https://${cfg.subdomain}.kommo.com${path}`;
  for (let i = 0; i < tries; i++) {
    let resp: Response;
    try {
      resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      // queda de conexão h2 no meio da paginação: espera e tenta de novo
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
      continue;
    }
    if (resp.status === 204) return null;
    if (resp.status === 429) { await sleep(2000 * (i + 1)); continue; }
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Kommo ${resp.status} em ${path.split("?")[0]}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`Kommo: rate limit persistente em ${path.split("?")[0]}`);
}
/** pagina uma coleção do Kommo (limit até 250) */
async function kommoList(cfg: Config, token: string, path: string, key: string, limit = 250, maxPages = 400): Promise<any[]> {
  const out: any[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) {
    const data = await kommo(cfg, token, `${path}${sep}limit=${limit}&page=${page}`);
    const rows: any[] = data?._embedded?.[key] || [];
    out.push(...rows);
    if (rows.length < limit) break;
    await sleep(150); // 7 req/s
  }
  return out;
}

async function loadConfigs(supabase: SupabaseClient, companyId?: string): Promise<Config[]> {
  let q = supabase.from("kommo_sync_configs").select("*");
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q;
  if (error) throw new Error(`configs: ${error.message}`);
  return (data || []) as Config[];
}
function tokenFor(cfg: Config): string {
  const t = Deno.env.get(cfg.secret_name);
  if (!t) throw new Error(`secret ${cfg.secret_name} não configurado (${cfg.label || cfg.company_id})`);
  return t.trim();
}

async function syncCompany(supabase: SupabaseClient, cfg: Config, opts: { days: number; dryRun: boolean; since?: string; until?: string }) {
  const token = tokenFor(cfg);
  const t0 = Date.now();
  const sinceStr = opts.since || new Date(Date.now() - opts.days * 86400000).toISOString().slice(0, 10);
  const sinceUnix = Math.floor(new Date(`${sinceStr}T00:00:00-03:00`).getTime() / 1000);
  const untilStr = opts.until || null;
  const untilUnix = untilStr ? Math.floor(new Date(`${untilStr}T23:59:59-03:00`).getTime() / 1000) : null;
  const toQs = untilUnix ? `&filter[created_at][to]=${untilUnix}` : "";

  // 1) usuários e vendedores
  const users = await kommoList(cfg, token, "/api/v4/users", "users");
  const userName = new Map<number, string>(users.map((u: any) => [Number(u.id), String(u.name || u.email || u.id)]));
  const { data: sellersData, error: sErr } = await supabase.from("company_salespeople")
    .select("id, name, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
  if (sErr) throw new Error(`sellers: ${sErr.message}`);
  const sellers = (sellersData || []) as Seller[];
  const spById = new Map(sellers.map((s) => [s.id, s]));
  const sellerOf = new Map<number, string | null>();
  const resolveSeller = (uid: number): string | null => {
    if (sellerOf.has(uid)) return sellerOf.get(uid)!;
    let id: string | null = null;
    if (Object.prototype.hasOwnProperty.call(cfg.user_overrides || {}, String(uid))) id = cfg.user_overrides[String(uid)] || null;
    else id = matchByName(userName.get(uid) || "", sellers)?.id ?? null;
    sellerOf.set(uid, id);
    return id;
  };

  // 2) eventos na janela: mudança de etapa + lead criado
  const rules = cfg.kpi_map || [];
  const stageEvents = await kommoList(cfg, token,
    `/api/v4/events?filter[type]=lead_status_changed&filter[created_at][from]=${sinceUnix}${toQs}`, "events", 100);
  const needCreated = rules.some((r) => r.kind === "created");
  const addedEvents = needCreated
    ? await kommoList(cfg, token, `/api/v4/events?filter[type]=lead_added&filter[created_at][from]=${sinceUnix}${toQs}`, "events", 100)
    : [];

  // 3) leads citados (responsável, valor, funil atual)
  const leadIds = [...new Set([...stageEvents, ...addedEvents].map((e: any) => Number(e.entity_id)))];
  const leads = new Map<number, any>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const lote = leadIds.slice(i, i + 200);
    const qs = lote.map((id) => `filter[id][]=${id}`).join("&");
    const data = await kommo(cfg, token, `/api/v4/leads?${qs}&limit=250`);
    for (const l of data?._embedded?.leads || []) leads.set(Number(l.id), l);
    await sleep(150);
  }

  // 4) eventos → (kpi, vendedor, dia). Um lead conta uma vez por KPI na janela.
  const counted = new Set<string>();
  const agg = new Map<string, { kpiId: string; spId: string; date: string; value: number }>();
  const unmatched = new Map<string, number>();
  const porKpi: Record<string, { leads: number; valor: number }> = {};
  const inWindow = (d: string) => d >= sinceStr && (!untilStr || d <= untilStr);
  const credit = (leadId: number, rule: KpiRule, date: string, lead: any) => {
    const k = `${leadId}|${rule.kpi_id}`;
    if (counted.has(k) || !inWindow(date)) return;
    counted.add(k);
    const uid = Number(lead?.responsible_user_id || 0);
    const spId = uid ? resolveSeller(uid) : null;
    if (!spId) { const nm = userName.get(uid) || (uid ? `id ${uid}` : "(sem responsável)"); unmatched.set(nm, (unmatched.get(nm) || 0) + 1); return; }
    const val = rule.value === "price" ? Number(lead?.price) || 0 : 1;
    const key = `${rule.kpi_id}|${spId}|${date}`;
    const cur = agg.get(key) || { kpiId: rule.kpi_id, spId, date, value: 0 };
    cur.value += val; agg.set(key, cur);
    const nm = rule.kpi_name || rule.kpi_id;
    const r = porKpi[nm] || { leads: 0, valor: 0 }; r.leads++; r.valor += val; porKpi[nm] = r;
  };
  for (const e of addedEvents) {
    const lead = leads.get(Number(e.entity_id)); if (!lead) continue;
    const date = brDate(Number(e.created_at));
    for (const rule of rules) {
      if (rule.kind !== "created") continue;
      if (rule.pipelines?.length && !rule.pipelines.includes(Number(lead.pipeline_id))) continue;
      credit(Number(e.entity_id), rule, date, lead);
    }
  }
  // ordem cronológica pra "uma vez por KPI" pegar a primeira entrada
  stageEvents.sort((a: any, b: any) => Number(a.created_at) - Number(b.created_at));
  for (const e of stageEvents) {
    const lead = leads.get(Number(e.entity_id)); if (!lead) continue;
    const after = e.value_after?.[0]?.lead_status; if (!after) continue;
    const pid = Number(after.pipeline_id), sid = Number(after.id);
    const date = brDate(Number(e.created_at));
    for (const rule of rules) {
      if (rule.kind === "stage" && (rule.stages || []).some((s) => Number(s.pipeline_id) === pid && Number(s.status_id) === sid)) credit(Number(e.entity_id), rule, date, lead);
      if (rule.kind === "won" && sid === WON && (!rule.pipelines?.length || rule.pipelines.includes(pid))) credit(Number(e.entity_id), rule, date, lead);
      if (rule.kind === "lost" && sid === LOST && (!rule.pipelines?.length || rule.pipelines.includes(pid))) credit(Number(e.entity_id), rule, date, lead);
    }
  }

  const resumo = {
    ok: true, empresa: cfg.label, since: sinceStr, until: untilStr,
    eventos_etapa: stageEvents.length, leads_criados: addedEvents.length, leads_lidos: leads.size,
    por_kpi: porKpi, nao_mapeados: Object.fromEntries(unmatched), ms: Date.now() - t0,
  };
  if (opts.dryRun) return { ...resumo, dry_run: true, grupos: agg.size };

  // 5) substitui: apaga os KPIs sincronizados dos vendedores mapeados na janela
  //    e grava o consolidado (em lote — janela grande tem centenas de grupos)
  const kpiIds = [...new Set(rules.map((r) => r.kpi_id))];
  const mappedSellers = [...new Set([...sellerOf.values()].filter(Boolean))] as string[];
  if (mappedSellers.length && kpiIds.length) {
    let del = supabase.from("kpi_entries").delete().eq("company_id", cfg.company_id)
      .in("kpi_id", kpiIds).in("salesperson_id", mappedSellers).gte("entry_date", sinceStr);
    if (untilStr) del = del.lte("entry_date", untilStr);
    const { error } = await del;
    if (error) throw new Error(`delete: ${error.message}`);
  }
  const linhas = [...agg.values()].map((a) => {
    const sp = spById.get(a.spId);
    return {
      company_id: cfg.company_id, kpi_id: a.kpiId, salesperson_id: a.spId, entry_date: a.date, value: a.value,
      unit_id: sp?.unit_id ?? null, team_id: sp?.team_id ?? null, sector_id: sp?.sector_id ?? null, observations: OBS,
    };
  });
  let written = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from("kpi_entries").insert(linhas.slice(i, i + 500));
    if (error) console.error("[kommo-sync] insert:", error.message); else written += Math.min(500, linhas.length - i);
  }
  const result = { ...resumo, lancamentos_gravados: written, ms: Date.now() - t0 };
  await supabase.from("kommo_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: result, updated_at: new Date().toISOString() }).eq("id", cfg.id);
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "sync");
    const companyId: string | undefined = body.company_id || undefined;

    if (action === "ping" || action === "users" || action === "pipelines") {
      if (!companyId) return json({ error: "company_id obrigatório" }, 400);
      const [cfg] = await loadConfigs(supabase, companyId);
      if (!cfg) return json({ error: "empresa sem configuração em kommo_sync_configs" }, 404);
      const token = tokenFor(cfg);
      if (action === "ping") {
        const acc = await kommo(cfg, token, "/api/v4/account");
        return json({ ok: true, empresa: cfg.label, conta: acc?.name, subdominio: acc?.subdomain });
      }
      if (action === "users") {
        const users = await kommoList(cfg, token, "/api/v4/users", "users");
        const { data: sellers } = await supabase.from("company_salespeople").select("id, name, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
        return json({
          ok: true, empresa: cfg.label,
          usuarios: users.map((u: any) => {
            const ov = (cfg.user_overrides || {})[String(u.id)];
            const sp = ov !== undefined ? (sellers || []).find((s: any) => s.id === ov) : matchByName(u.name, (sellers || []) as Seller[]);
            return { id: u.id, nome: u.name, email: u.email, ativo: u.rights?.is_active, vendedor_nexus: sp?.name || null, via: ov !== undefined ? "override" : (sp ? "nome" : null) };
          }),
          vendedores_nexus: (sellers || []).map((s: any) => ({ id: s.id, nome: s.name })),
        });
      }
      const p = await kommo(cfg, token, "/api/v4/leads/pipelines");
      return json({
        ok: true, empresa: cfg.label,
        funis: (p?._embedded?.pipelines || []).map((x: any) => ({
          id: x.id, nome: x.name, principal: x.is_main, arquivado: x.is_archive,
          etapas: (x._embedded?.statuses || []).map((s: any) => ({ id: s.id, nome: s.name, sort: s.sort })),
        })),
      });
    }

    const days = Math.min(Math.max(Number(body.days || 0) || 4, 1), 400);
    const dryRun = !!body.dry_run;
    const cfgs = (await loadConfigs(supabase, companyId)).filter((c) => c.enabled || companyId);
    if (!cfgs.length) return json({ ok: true, aviso: "nenhuma empresa habilitada" });
    const results: Record<string, unknown> = {};
    for (const cfg of cfgs) {
      try {
        results[cfg.label || cfg.company_id] = await syncCompany(supabase, cfg, { days, dryRun, since: body.since || undefined, until: body.until || undefined });
      } catch (err) {
        const msg = String((err as Error)?.message || err);
        console.error(`[kommo-sync] ${cfg.label}:`, msg);
        results[cfg.label || cfg.company_id] = { ok: false, error: msg };
        if (!dryRun) await supabase.from("kommo_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: { ok: false, error: msg } }).eq("id", cfg.id);
      }
    }
    return json({ ok: true, days, dry_run: dryRun, empresas: results });
  } catch (err) {
    console.error("[kommo-sync] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});

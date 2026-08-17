// datacrazy-sync: preenche automaticamente os KPIs de clientes que usam o CRM
// Datacrazy (Pier Club, VHS...). Mesma régua das outras integrações
// (Agendor/Bitrix/WinDash): conta FLUXO do funil — quantos negócios entraram em
// cada etapa mapeada, no dia em que entraram, por vendedor — e grava o
// consolidado em kpi_entries com a tag [DATACRAZY], substituindo o lançamento
// manual daquele (KPI, vendedor, dia).
//
// O Datacrazy não devolve histórico de movimentação em lote, então a função
// guarda uma FOTO de cada negócio (datacrazy_business_state) e detecta as
// transições comparando com a foto anterior. Cada transição relevante vira um
// evento único por (negócio, KPI) em datacrazy_kpi_events; os eventos são
// somados por (vendedor, dia).
//
// Regras de crédito:
//   • kind "created": o negócio existe ⇒ conta 1 na data de criação.
//   • kind "stage": entrou numa etapa mapeada ⇒ conta 1 (ou o valor do negócio,
//     se value = "total") na data da movimentação. Se pulou etapas de uma vez
//     dentro do mesmo funil, credita também as etapas mapeadas que ficaram no
//     meio (chegou em "Fechado - Ganho" ⇒ passou por "Agendou Visita").
//     Etapa de perda ("perdido") não credita nada além dela mesma.
//   • won_status: true ⇒ status "won" também conta, mesmo sem mover de etapa.
//
// Configuração por empresa em datacrazy_sync_configs (kpi_map, overrides de
// atendente → vendedor, secret com o token). Token nunca sai na resposta/log.
//
// Entradas:
//   { action: "ping", company_id }        → confere token e tenant
//   { action: "attendants", company_id }  → atendentes do CRM x vendedores do Nexus
//   { action: "stages", company_id }      → funis e etapas (pra montar o kpi_map)
//   { action: "sync", company_id?, days?, dry_run? } → sincroniza (todas as
//        empresas habilitadas quando company_id não vem — é o que o cron chama)
//   { action: "rebuild", company_id, days } → zera foto/eventos/lançamentos
//        [DATACRAZY] da empresa e reconstrói do zero na janela
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const API = "https://api.g1.datacrazy.io";
const TAG = "[DATACRAZY]";
const OBS = `${TAG} sync automático do Datacrazy`;

type KpiRule = {
  kpi_id: string;
  kpi_name?: string;
  kind: "created" | "stage";
  value?: "total" | null;
  won_status?: boolean;
  // etapas mapeadas, com funil e índice (o índice serve pra creditar etapas puladas)
  stages?: { id: string; pipeline_id: string; index: number; name?: string }[];
  exclude_pipelines?: string[];
};
type Config = {
  id: string;
  company_id: string;
  label: string | null;
  secret_name: string;
  enabled: boolean;
  kpi_map: KpiRule[];
  attendant_overrides: Record<string, string | null>;
  fallback_salesperson_id: string | null;
};
type Biz = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  attendantId: string | null;
  attendant?: { id: string; name: string } | null;
  stageId: string;
  stage?: { id: string; name: string; index: number; pipeline?: { id: string; name: string } } | null;
  lastMovedAt: string;
  statusChangedAt: string | null;
};
type State = {
  business_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  stage_index: number | null;
  status: string | null;
  attendant_id: string | null;
  attendant_name: string | null;
  total: number;
  created_at_dc: string | null;
  last_moved_at: string | null;
  status_changed_at: string | null;
};
type Seller = { id: string; name: string; unit_id: string | null; team_id: string | null; sector_id: string | null };
type Ev = { business_id: string; kpi_id: string; event_date: string; salesperson_id: string | null; value: number; source: string };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** casa "Maria Eduarda Rodrigues Pinto" (CRM) com "Eduarda" (Nexus), ou
 *  "Isabella Peres Martines Senger" com "Isabella". Exato primeiro; depois todos
 *  os tokens do nome do Nexus contidos no nome do CRM; se ainda empatar, o
 *  primeiro nome. Ambíguo = não casa (melhor não atribuir do que atribuir errado). */
function matchByName(raw: string, list: Seller[]): Seller | null {
  const target = norm(raw);
  if (!target) return null;
  const exact = list.filter((x) => norm(x.name) === target);
  if (exact.length === 1) return exact[0];
  const tTok = target.split(" ").filter((t) => t.length > 1);
  const contained = list.filter((x) => {
    const tok = norm(x.name).split(" ").filter((t) => t.length > 1);
    return tok.length > 0 && tok.every((t) => tTok.includes(t));
  });
  if (contained.length === 1) return contained[0];
  if (contained.length > 1) {
    const best = contained.map((x) => ({ x, n: norm(x.name).split(" ").length })).sort((a, b) => b.n - a.n);
    if (best[0].n > best[1].n) return best[0].x;
    return null;
  }
  const first = list.filter((x) => norm(x.name).split(" ")[0] === tTok[0]);
  return first.length === 1 ? first[0] : null;
}

/** data BRT (UTC-3) de um instante ISO */
const brDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10);
const isLossStage = (name?: string | null) => /perdid|lost/i.test(name || "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET na API do Datacrazy com respeito ao 429 (30 req/min por rota) */
async function dc(token: string, path: string, tries = 4): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const resp = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 429) {
      const wait = Number(resp.headers.get("retry-after") || 10);
      await sleep(Math.min(wait, 60) * 1000);
      continue;
    }
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Datacrazy ${resp.status} em ${path.split("?")[0]}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`Datacrazy: rate limit persistente em ${path.split("?")[0]}`);
}

async function dcList(token: string, path: string, take = 500, max = 20000): Promise<any[]> {
  const out: any[] = [];
  const sep = path.includes("?") ? "&" : "?";
  for (let skip = 0; skip < max; skip += take) {
    const data = await dc(token, `${path}${sep}take=${take}&skip=${skip}`);
    const rows: any[] = Array.isArray(data) ? data : (data?.data || []);
    out.push(...rows);
    if (rows.length < take) break;
  }
  return out;
}

async function loadConfigs(supabase: SupabaseClient, companyId?: string): Promise<Config[]> {
  let q = supabase.from("datacrazy_sync_configs").select("*");
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

/** resolve o vendedor do Nexus pra um negócio */
function resolveSeller(b: Biz, cfg: Config, sellers: Seller[], cache: Map<string, string | null>): string | null {
  const aid = b.attendantId || b.attendant?.id || null;
  if (aid && Object.prototype.hasOwnProperty.call(cfg.attendant_overrides || {}, aid)) {
    return cfg.attendant_overrides[aid] || null;
  }
  const key = aid || `name:${b.attendant?.name || ""}`;
  if (cache.has(key)) return cache.get(key)!;
  const sp = b.attendant?.name ? matchByName(b.attendant.name, sellers) : null;
  const id = sp?.id ?? cfg.fallback_salesperson_id ?? null;
  cache.set(key, id);
  return id;
}

/** eventos gerados por um negócio, dado o estado anterior (ou nenhum) */
function eventsFor(b: Biz, prev: State | null, cfg: Config, sellerId: string | null): Ev[] {
  const evs: Ev[] = [];
  const pipeId = b.stage?.pipeline?.id || null;
  const idx = typeof b.stage?.index === "number" ? b.stage!.index : null;
  const movedDate = brDate(b.lastMovedAt || b.createdAt);
  const stageIsLoss = isLossStage(b.stage?.name);
  const samePipe = prev && prev.pipeline_id && prev.pipeline_id === pipeId;
  const prevIdx = samePipe && typeof prev!.stage_index === "number" ? prev!.stage_index! : null;
  const stageChanged = !prev || prev.stage_id !== b.stageId;
  const statusChanged = !prev || prev.status !== b.status;

  for (const rule of cfg.kpi_map || []) {
    if (rule.exclude_pipelines?.length && pipeId && rule.exclude_pipelines.includes(pipeId)) continue;
    const val = rule.value === "total" ? Number(b.total) || 0 : 1;

    if (rule.kind === "created") {
      if (!prev) evs.push({ business_id: b.id, kpi_id: rule.kpi_id, event_date: brDate(b.createdAt), salesperson_id: sellerId, value: 1, source: "created" });
      continue;
    }

    if (rule.kind === "stage") {
      const stages = rule.stages || [];
      // 1) chegou/está numa etapa mapeada (ou passou por uma no caminho)
      if (stageChanged && idx !== null && pipeId) {
        for (const s of stages) {
          if (s.pipeline_id !== pipeId) continue;
          const direct = s.id === b.stageId;
          // etapa intermediária: só quando o destino não é etapa de perda e o
          // negócio avançou (ou é a primeira vez que vemos ele nesse funil)
          const passed = !direct && !stageIsLoss && s.index < idx && (prevIdx === null || s.index > prevIdx);
          if (direct || passed) {
            evs.push({ business_id: b.id, kpi_id: rule.kpi_id, event_date: movedDate, salesperson_id: sellerId, value: val, source: `stage:${s.id}` });
            break; // um evento por (negócio, KPI)
          }
        }
      }
      // 2) status ganho (botão "ganhar" sem mover de etapa)
      if (rule.won_status && b.status === "won" && (statusChanged || !prev)) {
        const d = brDate(b.statusChangedAt || b.lastMovedAt || b.createdAt);
        if (!evs.some((e) => e.kpi_id === rule.kpi_id)) {
          evs.push({ business_id: b.id, kpi_id: rule.kpi_id, event_date: d, salesperson_id: sellerId, value: val, source: "won" });
        }
      }
      // 3) valor do negócio mudou depois de já contado (Faturamento): reemite
      //    o evento — a gravação só atualiza o valor, mantendo a data original
      if (rule.value === "total" && prev && Number(prev.total) !== (Number(b.total) || 0) && !evs.some((e) => e.kpi_id === rule.kpi_id)) {
        const here = stages.some((s) => s.id === b.stageId) || (rule.won_status && b.status === "won");
        if (here) evs.push({ business_id: b.id, kpi_id: rule.kpi_id, event_date: movedDate, salesperson_id: sellerId, value: val, source: "revalue" });
      }
    }
  }
  return evs;
}

async function syncCompany(supabase: SupabaseClient, cfg: Config, opts: { days: number; dryRun: boolean; rebuild: boolean }) {
  const token = tokenFor(cfg);
  const since = new Date(Date.now() - opts.days * 86400000);
  const sinceIso = since.toISOString();
  const t0 = Date.now();

  if (opts.rebuild && !opts.dryRun) {
    await supabase.from("datacrazy_kpi_events").delete().eq("company_id", cfg.company_id);
    await supabase.from("datacrazy_business_state").delete().eq("company_id", cfg.company_id);
    await supabase.from("kpi_entries").delete().eq("company_id", cfg.company_id).like("observations", `${TAG}%`);
  }

  // 1) negócios movidos na janela + todos os ganhos (o "ganhar" nem sempre move)
  const moved: Biz[] = await dcList(token, `/api/v1/businesses?filter%5BlastMovedAfter%5D=${encodeURIComponent(sinceIso)}`);
  const won: Biz[] = await dcList(token, `/api/v1/businesses?filter%5Bstatus%5D=won`);
  const byId = new Map<string, Biz>();
  for (const b of [...moved, ...won]) byId.set(b.id, b);
  const bizs = [...byId.values()];

  // 2) foto anterior desses negócios
  //    (foto inteira da empresa, paginada de 1000 — PostgREST corta em 1000 e
  //    um IN com centenas de ids estoura a URL)
  const prevMap = new Map<string, State>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("datacrazy_business_state").select("*")
      .eq("company_id", cfg.company_id).order("business_id").range(from, from + 999);
    if (error) throw new Error(`state: ${error.message}`);
    for (const s of data || []) prevMap.set(s.business_id, s as State);
    if (!data || data.length < 1000) break;
  }

  // 3) vendedores (inclui inativos: quem saiu continua dono do histórico)
  const { data: sellersData, error: sErr } = await supabase.from("company_salespeople")
    .select("id, name, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
  if (sErr) throw new Error(`sellers: ${sErr.message}`);
  const sellers = (sellersData || []) as Seller[];
  const spById = new Map(sellers.map((s) => [s.id, s]));

  // 4) transições → eventos
  const sellerCache = new Map<string, string | null>();
  const unmatched = new Map<string, number>();
  const events: Ev[] = [];
  const stateRows: any[] = [];
  const reassign: { business_id: string; salesperson_id: string }[] = [];
  let changed = 0;
  for (const b of bizs) {
    const prev = prevMap.get(b.id) || null;
    const sellerId = resolveSeller(b, cfg, sellers, sellerCache);
    if (!sellerId) {
      const k = b.attendant?.name?.trim() || (b.attendantId ? `id ${b.attendantId}` : "(sem atendente)");
      unmatched.set(k, (unmatched.get(k) || 0) + 1);
    }
    const isChange = !prev || prev.stage_id !== b.stageId || prev.status !== b.status ||
      Number(prev.total) !== (Number(b.total) || 0) || (prev.attendant_id || null) !== (b.attendantId || null);
    if (isChange) {
      changed++;
      events.push(...eventsFor(b, prev, cfg, sellerId));
      // negócio que ganhou dono depois: eventos sem vendedor passam pra ele
      if (prev && !prev.attendant_id && b.attendantId && sellerId) reassign.push({ business_id: b.id, salesperson_id: sellerId });
    }
    stateRows.push({
      company_id: cfg.company_id,
      business_id: b.id,
      pipeline_id: b.stage?.pipeline?.id || null,
      stage_id: b.stageId || null,
      stage_index: typeof b.stage?.index === "number" ? b.stage!.index : null,
      status: b.status || null,
      attendant_id: b.attendantId || b.attendant?.id || null,
      attendant_name: b.attendant?.name?.trim() || null,
      total: Number(b.total) || 0,
      created_at_dc: b.createdAt || null,
      last_moved_at: b.lastMovedAt || null,
      status_changed_at: b.statusChangedAt || null,
      seen_at: new Date().toISOString(),
    });
  }

  const kpiName = (id: string) => (cfg.kpi_map || []).find((r) => r.kpi_id === id)?.kpi_name || id;
  const resumo: Record<string, { eventos: number; valor: number }> = {};
  for (const e of events) {
    const r = resumo[kpiName(e.kpi_id)] || { eventos: 0, valor: 0 };
    r.eventos++; r.valor += e.value; resumo[kpiName(e.kpi_id)] = r;
  }

  if (opts.dryRun) {
    return {
      ok: true, dry_run: true, empresa: cfg.label, since: sinceIso.slice(0, 10),
      negocios_na_janela: bizs.length, negocios_alterados: changed, eventos_novos: events.length,
      por_kpi: resumo, nao_mapeados: Object.fromEntries(unmatched), ms: Date.now() - t0,
    };
  }

  // 5) grava eventos. Contagem: primeira vez vale (o negócio conta uma vez por
  //    KPI). Valor (Faturamento): se o negócio ganhou valor depois, atualiza.
  const touched = new Set<string>(); // kpi|sp|date
  const touch = (e: { kpi_id: string; salesperson_id: string | null; event_date: string }) => {
    if (e.salesperson_id) touched.add(`${e.kpi_id}|${e.salesperson_id}|${e.event_date}`);
  };
  const valueKpis = new Set((cfg.kpi_map || []).filter((r) => r.value === "total").map((r) => r.kpi_id));
  const countEvs = events.filter((e) => !valueKpis.has(e.kpi_id));
  const valueEvs = events.filter((e) => valueKpis.has(e.kpi_id));
  for (let i = 0; i < countEvs.length; i += 500) {
    const rows = countEvs.slice(i, i + 500).map((e) => ({ company_id: cfg.company_id, ...e }));
    const { error } = await supabase.from("datacrazy_kpi_events").upsert(rows, { onConflict: "company_id,business_id,kpi_id", ignoreDuplicates: true });
    if (error) throw new Error(`events: ${error.message}`);
    rows.forEach(touch);
  }
  for (const e of valueEvs) {
    const { data: ex } = await supabase.from("datacrazy_kpi_events").select("event_date, salesperson_id, value")
      .eq("company_id", cfg.company_id).eq("business_id", e.business_id).eq("kpi_id", e.kpi_id).maybeSingle();
    if (ex) {
      if (Number(ex.value) !== e.value) {
        await supabase.from("datacrazy_kpi_events").update({ value: e.value })
          .eq("company_id", cfg.company_id).eq("business_id", e.business_id).eq("kpi_id", e.kpi_id);
        touch({ kpi_id: e.kpi_id, salesperson_id: ex.salesperson_id, event_date: ex.event_date });
      }
    } else {
      const { error } = await supabase.from("datacrazy_kpi_events").insert({ company_id: cfg.company_id, ...e });
      if (error) throw new Error(`events(value): ${error.message}`);
      touch(e);
    }
  }
  // negócios que ganharam dono: eventos órfãos passam pro vendedor
  for (const r of reassign) {
    const { data: orphan } = await supabase.from("datacrazy_kpi_events").select("kpi_id, event_date")
      .eq("company_id", cfg.company_id).eq("business_id", r.business_id).is("salesperson_id", null);
    if (orphan?.length) {
      await supabase.from("datacrazy_kpi_events").update({ salesperson_id: r.salesperson_id })
        .eq("company_id", cfg.company_id).eq("business_id", r.business_id).is("salesperson_id", null);
      for (const o of orphan) touch({ kpi_id: o.kpi_id, salesperson_id: r.salesperson_id, event_date: o.event_date });
    }
  }

  // 6) foto atual
  for (let i = 0; i < stateRows.length; i += 500) {
    const { error } = await supabase.from("datacrazy_business_state").upsert(stateRows.slice(i, i + 500), { onConflict: "company_id,business_id" });
    if (error) throw new Error(`state upsert: ${error.message}`);
  }

  // 7) recalcula os (KPI, vendedor, dia) tocados: apaga o lançamento existente
  //    (manual ou nosso) e grava a soma dos eventos — Datacrazy é a fonte da verdade
  let written = 0;
  const groups = [...touched].map((k) => { const [kpi_id, sp, date] = k.split("|"); return { kpi_id, sp, date }; });
  const CONC = 20;
  for (let i = 0; i < groups.length; i += CONC) {
    await Promise.all(groups.slice(i, i + CONC).map(async (g) => {
      const { data: evs } = await supabase.from("datacrazy_kpi_events").select("value")
        .eq("company_id", cfg.company_id).eq("kpi_id", g.kpi_id).eq("salesperson_id", g.sp).eq("event_date", g.date);
      const total = (evs || []).reduce((a, e) => a + Number(e.value || 0), 0);
      await supabase.from("kpi_entries").delete()
        .eq("company_id", cfg.company_id).eq("kpi_id", g.kpi_id).eq("salesperson_id", g.sp).eq("entry_date", g.date);
      if (total === 0 && !(evs || []).length) return;
      const sp = spById.get(g.sp);
      const { error } = await supabase.from("kpi_entries").insert({
        company_id: cfg.company_id, kpi_id: g.kpi_id, salesperson_id: g.sp, entry_date: g.date, value: total,
        unit_id: sp?.unit_id ?? null, team_id: sp?.team_id ?? null, sector_id: sp?.sector_id ?? null, observations: OBS,
      });
      if (error) console.error("[datacrazy-sync] insert kpi_entries:", error.message);
      else written++;
    }));
  }

  const result = {
    ok: true, empresa: cfg.label, since: sinceIso.slice(0, 10),
    negocios_na_janela: bizs.length, negocios_alterados: changed, eventos_novos: events.length,
    lancamentos_gravados: written, por_kpi: resumo, nao_mapeados: Object.fromEntries(unmatched), ms: Date.now() - t0,
  };
  await supabase.from("datacrazy_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: result, updated_at: new Date().toISOString() }).eq("id", cfg.id);
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "sync");
    const companyId: string | undefined = body.company_id || undefined;

    if (action === "ping" || action === "attendants" || action === "stages") {
      if (!companyId) return json({ error: "company_id obrigatório" }, 400);
      const [cfg] = await loadConfigs(supabase, companyId);
      if (!cfg) return json({ error: "empresa sem configuração em datacrazy_sync_configs" }, 404);
      const token = tokenFor(cfg);
      if (action === "ping") {
        const p = await dc(token, "/api/v1/pipelines");
        return json({ ok: true, empresa: cfg.label, funis: (p?.data || []).length });
      }
      if (action === "attendants") {
        const at = await dc(token, "/api/v1/attendants/crm?take=200");
        const { data: sellers } = await supabase.from("company_salespeople").select("id, name, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
        return json({
          ok: true, empresa: cfg.label,
          atendentes: (at?.data || []).map((a: any) => {
            const ov = (cfg.attendant_overrides || {})[a.id];
            const sp = ov !== undefined ? (sellers || []).find((s: any) => s.id === ov) : matchByName(a.name, (sellers || []) as Seller[]);
            return { id: a.id, nome: a.name?.trim(), email: a.email || null, vendedor_nexus: sp?.name || null, via: ov !== undefined ? "override" : (sp ? "nome" : null) };
          }),
          vendedores_nexus: (sellers || []).map((s: any) => ({ id: s.id, nome: s.name })),
        });
      }
      const p = await dc(token, "/api/v1/pipelines");
      const funis: any[] = [];
      for (const pipe of p?.data || []) {
        const st = await dc(token, `/api/v1/pipelines/${pipe.id}/stages`);
        funis.push({ id: pipe.id, nome: pipe.name, grupo: pipe.group, etapas: (st?.data || st || []).map((s: any) => ({ id: s.id, index: s.index, nome: s.name })) });
      }
      return json({ ok: true, empresa: cfg.label, funis });
    }

    // sync / rebuild
    const rebuild = action === "rebuild";
    if (rebuild && !companyId) return json({ error: "rebuild exige company_id" }, 400);
    const days = Math.min(Math.max(Number(body.days || 0) || (rebuild ? 90 : 3), 1), 400);
    const dryRun = !!body.dry_run;
    const cfgs = (await loadConfigs(supabase, companyId)).filter((c) => c.enabled || companyId);
    if (!cfgs.length) return json({ ok: true, aviso: "nenhuma empresa habilitada" });
    const results: Record<string, unknown> = {};
    for (const cfg of cfgs) {
      try {
        results[cfg.label || cfg.company_id] = await syncCompany(supabase, cfg, { days, dryRun, rebuild });
      } catch (err) {
        const msg = String((err as Error)?.message || err);
        console.error(`[datacrazy-sync] ${cfg.label}:`, msg);
        results[cfg.label || cfg.company_id] = { ok: false, error: msg };
        if (!dryRun) await supabase.from("datacrazy_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: { ok: false, error: msg } }).eq("id", cfg.id);
      }
    }
    return json({ ok: true, days, dry_run: dryRun, empresas: results });
  } catch (err) {
    console.error("[datacrazy-sync] erro:", (err as Error)?.message || err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});

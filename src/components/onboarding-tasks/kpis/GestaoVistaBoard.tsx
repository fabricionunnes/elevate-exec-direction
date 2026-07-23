import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, Target, TrendingUp, Trophy, Flag,
  Eye, EyeOff, Users, Megaphone, Plus, X, Filter, Check, Pencil, Trash2,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Quadro de Gestão à Vista — painel por cliente, seguindo o tema do usuário.
 * KPIs configurados (meta vs realizado do mês), colunas de processo, funil 3D,
 * vendas por equipe, ranking, evolução semanal e avisos (o cliente adiciona).
 * Toggles (mostrar meta/realizado/ranking) só pra staff. Tela cheia.
 */

type KpiType = "numeric" | "monetary" | "percentage";
interface Kpi { id: string; name: string; kpi_type: KpiType; periodicity: string; target_value: number; is_main_goal: boolean; sort_order: number; }
interface TargetRow { kpi_id: string; target_value: number; level_order: number; level_name: string; salesperson_id: string | null; unit_id: string | null; team_id: string | null; sector_id: string | null; }
interface EntryRow { kpi_id: string; salesperson_id: string | null; value: number; entry_date: string; }
interface Person { id: string; name: string; team_id: string | null; }
interface Team { id: string; name: string; }
interface Notice { id: string; text: string; }
interface KpiRow extends Kpi { meta: number; realizado: number; pct: number; }

const fmt = (v: number, t: string) => {
  if (t === "monetary") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  if (t === "percentage") return `${v.toFixed(1)}%`;
  return v.toLocaleString("pt-BR");
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// classe de cor por atingimento (funciona em claro/escuro)
const toneClass = (pct: number) =>
  pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
const toneText = (pct: number) =>
  pct >= 100 ? "text-emerald-500" : pct >= 70 ? "text-primary" : pct >= 40 ? "text-amber-500" : "text-rose-500";

const PROCESS = [
  { label: "Novos Atendimentos", sub: "Prospecção", keys: ["novos atendiment", "prospec", "abordage", "pessoas abordad", "atendiment"] },
  { label: "Captação", sub: "Novos clientes", keys: ["capta", "leads", "novos clientes", "matricul", "cadastr"] },
  { label: "Recorrência", sub: "Clientes ativos", keys: ["recorr", "recompra", "clientes ativos", "renova"] },
  { label: "Repescagem", sub: "Clientes inativos", keys: ["repescagem", "reativ", "inativ", "resgate"] },
];
const FUNNEL = [
  { label: "Ligações", keys: ["ligac", "ligaç", "call", "discage"] },
  { label: "Agendamentos", keys: ["agendam"] },
  { label: "Atendimentos", keys: ["atendiment", "reuni", "comparecim", "avaliac"] },
  { label: "Vendas", keys: ["venda"] },
];

export function GestaoVistaBoard({ companyId, isStaff = false }: { companyId: string; isStaff?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<{ name: string; owner_name: string | null } | null>(null);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [ranking, setRanking] = useState<{ name: string; value: number; type: string; pct: number }[]>([]);
  const [teamSales, setTeamSales] = useState<{ name: string; value: number; type: string }[]>([]);
  const [weekly, setWeekly] = useState<{ week: string; real: number }[]>([]);
  const [mainKpi, setMainKpi] = useState<KpiRow | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [newNotice, setNewNotice] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [cfg, setCfg] = useState<{ show_meta: boolean; show_realizado: boolean; show_ranking: boolean; ranking_mode: "value" | "percent" | "none" }>({ show_meta: true, show_realizado: true, show_ranking: true, ranking_mode: "value" });
  const [monthOffset, setMonthOffset] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [scale, setScale] = useState(1);
  const boardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const refDate = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!companyId) return;
      setLoading(true);
      const mKey = monthKey(refDate);
      const start = `${mKey}-01`;
      const endD = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
      const end = `${mKey}-${String(endD.getDate()).padStart(2, "0")}`;

      const [companyRes, kpiRes, targetRes, entryRes, peopleRes, teamRes, settingsRes, cfgRes, noticeRes] = await Promise.all([
        supabase.from("onboarding_companies").select("name, owner_name").eq("id", companyId).maybeSingle(),
        supabase.from("company_kpis").select("id, name, kpi_type, periodicity, target_value, is_main_goal, sort_order").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        supabase.from("kpi_monthly_targets").select("kpi_id, target_value, level_order, level_name, salesperson_id, unit_id, team_id, sector_id").eq("company_id", companyId).eq("month_year", mKey),
        supabase.from("kpi_entries").select("kpi_id, salesperson_id, value, entry_date").eq("company_id", companyId).gte("entry_date", start).lte("entry_date", end),
        supabase.from("company_salespeople").select("id, name, team_id").eq("company_id", companyId).eq("is_active", true),
        supabase.from("company_teams").select("id, name").eq("company_id", companyId).eq("is_active", true),
        supabase.from("company_daily_goal_settings").select("include_saturday, include_sunday, include_holidays").eq("company_id", companyId).maybeSingle(),
        supabase.from("gestao_vista_config").select("show_meta, show_realizado, show_ranking, ranking_mode").eq("company_id", companyId).maybeSingle(),
        supabase.from("gestao_vista_notices").select("id, text").eq("company_id", companyId).order("sort_order").order("created_at"),
      ]);
      if (!alive) return;

      const kpiList = (kpiRes.data as Kpi[]) || [];
      const targets = (targetRes.data as TargetRow[]) || [];
      const entries = (entryRes.data as EntryRow[]) || [];
      const people = (peopleRes.data as Person[]) || [];
      const teams = (teamRes.data as Team[]) || [];
      const daySettings = settingsRes.data as { include_saturday: boolean; include_sunday: boolean } | null;

      // dias úteis do mês (respeita fim de semana; feriados ignorados)
      const incSat = daySettings?.include_saturday ?? false;
      const incSun = daySettings?.include_sunday ?? false;
      let workingDays = 0;
      for (let d = 1; d <= endD.getDate(); d++) {
        const dow = new Date(refDate.getFullYear(), refDate.getMonth(), d).getDay();
        if (dow === 6 && !incSat) continue;
        if (dow === 0 && !incSun) continue;
        workingDays++;
      }

      // Meta = mesma regra do painel de KPIs: rollup por vendedor (nível "Meta") tem precedência
      const pickLevel = (rowsIn: TargetRow[]): number | null => {
        if (!rowsIn.length) return null;
        const byLevel: Record<string, number> = {};
        rowsIn.forEach(r => { byLevel[r.level_name] = (byLevel[r.level_name] || 0) + Number(r.target_value || 0); });
        const v = byLevel["Meta"] ?? Object.values(byLevel)[0];
        return v ?? null;
      };
      const metaBaseFor = (k: Kpi): number => {
        const all = targets.filter(t => t.kpi_id === k.id);
        const sp = pickLevel(all.filter(t => t.salesperson_id)); if (sp != null) return sp;
        const comp = pickLevel(all.filter(t => !t.salesperson_id && !t.unit_id && !t.team_id)); if (comp != null) return comp;
        const units = pickLevel(all.filter(t => t.unit_id && !t.team_id && !t.salesperson_id)); if (units != null) return units;
        const tms = pickLevel(all.filter(t => t.team_id && !t.salesperson_id)); if (tms != null) return tms;
        return Number(k.target_value) || 0;
      };
      const metaFor = (k: Kpi) => {
        const base = metaBaseFor(k);
        if (k.periodicity === "daily") return base * (workingDays || endD.getDate());
        if (k.periodicity === "weekly") return base * Math.ceil(endD.getDate() / 7);
        return base;
      };
      const realFor = (kid: string) => entries.filter(e => e.kpi_id === kid).reduce((s, e) => s + Number(e.value || 0), 0);

      const rows: KpiRow[] = kpiList.map(k => {
        const meta = metaFor(k), realizado = realFor(k.id);
        return { ...k, meta, realizado, pct: meta > 0 ? (realizado / meta) * 100 : 0 };
      });

      const main = rows.find(r => r.is_main_goal && r.kpi_type === "monetary")
        || rows.find(r => r.is_main_goal) || rows.find(r => r.kpi_type === "monetary") || rows[0] || null;

      // ranking do time (valor + % da meta individual)
      let rank: { name: string; value: number; type: string; pct: number }[] = [];
      const teamAgg = new Map<string, number>();
      if (main) {
        const byPerson = new Map<string, number>();
        entries.filter(e => e.kpi_id === main.id && e.salesperson_id).forEach(e => {
          byPerson.set(e.salesperson_id!, (byPerson.get(e.salesperson_id!) || 0) + Number(e.value || 0));
        });
        // meta individual de cada vendedor para o KPI principal
        const metaPerson = (pid: string) => {
          const base = pickLevel(targets.filter(t => t.kpi_id === main.id && t.salesperson_id === pid));
          const v = base != null ? base : (metaBaseFor(main) / Math.max(1, people.length));
          if (main.periodicity === "daily") return v * (workingDays || endD.getDate());
          if (main.periodicity === "weekly") return v * Math.ceil(endD.getDate() / 7);
          return v;
        };
        rank = people.map(p => {
          const value = byPerson.get(p.id) || 0;
          const pm = metaPerson(p.id);
          return { name: p.name, value, type: main.kpi_type, pct: pm > 0 ? (value / pm) * 100 : 0 };
        }).filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
        // vendas por equipe
        people.forEach(p => {
          if (!p.team_id) return;
          teamAgg.set(p.team_id, (teamAgg.get(p.team_id) || 0) + (byPerson.get(p.id) || 0));
        });
      }
      const teamRows = teams.map(t => ({ name: t.name, value: teamAgg.get(t.id) || 0, type: main?.kpi_type || "monetary" }))
        .filter(t => t.value > 0).sort((a, b) => b.value - a.value);

      // evolução semanal da meta principal
      let wk: { week: string; real: number }[] = [];
      if (main) {
        const buckets = new Map<number, number>();
        entries.filter(e => e.kpi_id === main.id).forEach(e => {
          const day = Number(e.entry_date.slice(8, 10));
          const w = Math.min(4, Math.floor((day - 1) / 7));
          buckets.set(w, (buckets.get(w) || 0) + Number(e.value || 0));
        });
        const nWeeks = Math.ceil(endD.getDate() / 7);
        wk = Array.from({ length: nWeeks }, (_, i) => ({ week: `Sem ${i + 1}`, real: buckets.get(i) || 0 }));
      }

      setCompany(companyRes.data as any);
      setKpis(rows);
      setMainKpi(main);
      setRanking(rank);
      setTeamSales(teamRows);
      setWeekly(wk);
      setNotices((noticeRes.data as Notice[]) || []);
      if (cfgRes.data) setCfg(cfgRes.data as any);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId, refDate]);

  const saveCfg = async (patch: Partial<typeof cfg>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    await supabase.from("gestao_vista_config").upsert({ company_id: companyId, ...next, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  };
  const addNotice = async () => {
    const text = newNotice.trim();
    if (!text) return;
    const { data, error } = await supabase.from("gestao_vista_notices").insert({ company_id: companyId, text, sort_order: notices.length }).select("id, text").single();
    if (error) { toast.error("Não foi possível salvar o aviso"); return; }
    setNotices([...notices, data as Notice]); setNewNotice("");
  };
  const removeNotice = async (id: string) => {
    setNotices(notices.filter(n => n.id !== id));
    await supabase.from("gestao_vista_notices").delete().eq("id", id);
  };
  const saveNoticeEdit = async (id: string, text: string) => {
    const t = text.trim();
    if (!t) { removeNotice(id); return; }
    setNotices(notices.map(n => n.id === id ? { ...n, text: t } : n));
    setEditId(null);
    await supabase.from("gestao_vista_notices").update({ text: t }).eq("id", id);
  };

  const toggleFull = async () => {
    const el = boardRef.current; if (!el) return;
    try {
      if (!document.fullscreenElement) { await el.requestFullscreen?.(); setIsFull(true); }
      else { await document.exitFullscreen?.(); setIsFull(false); }
    } catch { setIsFull(f => !f); }
  };
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Em tela cheia, escala o conteúdo pra caber INTEIRO na tela (sem rolar).
  const FULL_W = 1536;
  useEffect(() => {
    if (!isFull) { setScale(1); return; }
    const fit = () => {
      const el = innerRef.current; if (!el) return;
      const s = Math.min(window.innerWidth / el.scrollWidth, window.innerHeight / el.scrollHeight, 1);
      if (s > 0 && isFinite(s)) setScale(s);
    };
    const id = window.setTimeout(fit, 80);
    window.addEventListener("resize", fit);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", fit); };
  }, [isFull, loading, kpis.length, notices.length, ranking.length, teamSales.length, weekly.length, editId, cfg]);

  const showMeta = cfg.show_meta, showReal = cfg.show_realizado;
  const mainGoals = kpis.filter(k => k.is_main_goal);
  const generalCards = (mainGoals.length ? mainGoals : kpis).slice(0, 4);

  // casa KPIs por nome. Processo e funil têm pools independentes (um KPI pode
  // aparecer nos dois), mas sem repetir DENTRO de cada bloco.
  const makeMatcher = () => {
    const used = new Set<string>();
    return (keys: string[]) => {
      const k = kpis.find(x => !used.has(x.id) && keys.some(w => norm(x.name).includes(w)));
      if (k) used.add(k.id);
      return k || null;
    };
  };
  const mProc = makeMatcher();
  const processCols = PROCESS.map(p => ({ ...p, kpi: mProc(p.keys) })).filter(p => p.kpi);
  const mFun = makeMatcher();
  const funnelStages = FUNNEL.map(f => ({ ...f, kpi: mFun(f.keys) })).filter(f => f.kpi) as { label: string; kpi: KpiRow }[];
  const funnelMax = Math.max(1, ...funnelStages.map(s => s.kpi.realizado));

  // exibição do ranking conforme o modo escolhido: valor | % da meta | nada.
  // showReal off = esconde o realizado POR VENDEDORA (só no ranking); totais sempre aparecem.
  const rankVal = (r: { value: number; type: string; pct: number }): string | null =>
    cfg.ranking_mode === "none" ? null
      : cfg.ranking_mode === "percent" ? `${r.pct.toFixed(0)}%`
      : showReal ? fmt(r.value, r.type) : null;
  const rankModeLabel = { value: "Valor", percent: "% meta", none: "Sem valor" }[cfg.ranking_mode];
  const cycleRankMode = () => saveCfg({ ranking_mode: cfg.ranking_mode === "value" ? "percent" : cfg.ranking_mode === "percent" ? "none" : "value" });

  return (
    <div ref={boardRef} className={cn(isFull ? "fixed inset-0 z-[200] overflow-hidden bg-background flex justify-center items-start" : "rounded-2xl border border-border overflow-hidden bg-card")}>
      <div ref={innerRef} style={isFull ? { width: FULL_W, transform: `scale(${scale})`, transformOrigin: "top center" } : undefined}
        className={cn("p-4 sm:p-6 space-y-4", isFull ? "shrink-0" : "w-full min-h-full")}>
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/unv-logo.png" alt="" className="h-9 w-9 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">{company?.name || "Cliente"}</div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-tight text-foreground">QUADRO DE GESTÃO À VISTA</h2>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span>Foco</span><span className="text-primary">·</span><span>Processo</span><span className="text-primary">·</span><span>Resultado</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isStaff && (
              <div className="hidden sm:flex items-center gap-1 rounded-lg bg-muted px-1.5 py-1 text-[11px]">
                <button onClick={() => saveCfg({ show_meta: !cfg.show_meta })} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded", cfg.show_meta ? "text-foreground" : "text-muted-foreground/50")} title="Mostrar meta">{cfg.show_meta ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Meta</button>
                <button onClick={() => saveCfg({ show_realizado: !cfg.show_realizado })} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded", cfg.show_realizado ? "text-foreground" : "text-muted-foreground/50")} title="Mostrar realizado por vendedora no ranking (totais sempre aparecem)">{cfg.show_realizado ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Real/vend</button>
                <button onClick={() => saveCfg({ show_ranking: !cfg.show_ranking })} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded", cfg.show_ranking ? "text-foreground" : "text-muted-foreground/50")} title="Mostrar ranking">{cfg.show_ranking ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Rank</button>
                {cfg.show_ranking && <button onClick={cycleRankMode} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-foreground border-l border-border ml-0.5" title="No ranking: valor / % da meta / sem valor"><Trophy className="h-3 w-3" />{rankModeLabel}</button>}
              </div>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-muted px-1.5 py-1">
              <button onClick={() => setMonthOffset(o => o - 1)} className="p-1 rounded hover:bg-background"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-semibold capitalize px-1 min-w-[92px] text-center">{monthLabel(refDate)}</span>
              <button onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} className="p-1 rounded hover:bg-background disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={toggleFull} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary" title="Tela cheia">
              {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">Nenhum KPI configurado para este cliente ainda.</div>
        ) : (
          <>
            {/* Indicadores gerais */}
            {generalCards.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {generalCards.map(k => (
                  <div key={k.id} className="rounded-xl p-4 border border-border bg-muted/40">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                      <Target className="h-3.5 w-3.5" /> <span className="truncate">{k.name}</span>
                    </div>
                    <div className={cn("text-2xl sm:text-3xl font-black", toneText(k.pct))}>{fmt(k.realizado, k.kpi_type)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{showMeta && <>meta {fmt(k.meta, k.kpi_type)} · </>}<span className={toneText(k.pct)}>{k.pct.toFixed(0)}%</span></div>
                    <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", toneClass(k.pct))} style={{ width: `${Math.min(100, k.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Colunas de processo do mês */}
            {processCols.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}>
                {processCols.map((p, i) => {
                  const k = p.kpi!;
                  return (
                    <div key={i} className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="text-sm font-bold text-foreground">{i + 1}. {p.label}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">{p.sub}</div>
                      <div className="space-y-1.5 text-sm">
                        {showMeta && <div className="flex justify-between"><span className="text-muted-foreground">Meta</span><span className="font-semibold">{fmt(k.meta, k.kpi_type)}</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Realizado</span><span className="font-semibold">{fmt(k.realizado, k.kpi_type)}</span></div>
                        <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted-foreground">Taxa</span><span className={cn("font-bold", toneText(k.pct))}>{k.pct.toFixed(0)}%</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              {/* Metas do mês (todos os KPIs) */}
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-3">
                  <Flag className="h-4 w-4 text-primary" /> Metas do Mês
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">{kpis.length} indicadores</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                  {kpis.map(k => (
                    <div key={k.id}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-foreground/90">{k.name}</span>
                        <span className={cn("font-bold tabular-nums", toneText(k.pct))}>{fmt(k.realizado, k.kpi_type)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", toneClass(k.pct))} style={{ width: `${Math.min(100, k.pct)}%` }} />
                        </div>
                        <span className={cn("text-[11px] font-semibold tabular-nums w-9 text-right", toneText(k.pct))}>{k.pct.toFixed(0)}%</span>
                      </div>
                      {showMeta && <div className="text-[10px] text-muted-foreground mt-0.5">meta {fmt(k.meta, k.kpi_type)}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna direita: ranking + equipes + funil */}
              <div className="space-y-4">
                {cfg.show_ranking && ranking.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 overflow-hidden">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-5"><Trophy className="h-4 w-4 text-amber-500" /> Ranking do Time</div>
                    {/* Pódio 3D — 2º, 1º, 3º */}
                    <div className="flex items-end justify-center gap-2 sm:gap-3" style={{ perspective: "900px" }}>
                      {[1, 0, 2].map((idx, pos) => {
                        const r = ranking[idx];
                        if (!r) return <div key={pos} className="flex-1" />;
                        const place = idx + 1;
                        const h = place === 1 ? 104 : place === 2 ? 76 : 56;
                        const medal = place === 1 ? { face: "#fde047", front: "#b45309" }
                          : place === 2 ? { face: "#e2e8f0", front: "#64748b" }
                          : { face: "#fbbf24", front: "#92400e" };
                        return (
                          <div key={pos} className="flex-1 flex flex-col items-center min-w-0">
                            {place === 1 && <Trophy className="h-6 w-6 text-amber-400 mb-1 drop-shadow" />}
                            <div className="text-center mb-1.5 w-full min-w-0 px-0.5">
                              <div className="text-xs font-bold truncate text-foreground">{r.name.split(" ")[0]}</div>
                              {rankVal(r) && <div className="text-[11px] font-semibold tabular-nums text-muted-foreground truncate">{rankVal(r)}</div>}
                            </div>
                            <div className="w-full rounded-t-md flex items-start justify-center pt-2 font-black text-lg text-black/70 relative"
                              style={{ height: h, background: `linear-gradient(180deg, ${medal.face}, ${medal.front})`, transform: "rotateX(20deg)", transformOrigin: "bottom", boxShadow: "0 10px 18px -6px rgba(0,0,0,.45), inset 0 2px 0 rgba(255,255,255,.4)" }}>
                              {place}º
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {ranking.length > 3 && (
                      <div className="mt-4 space-y-1.5 pt-3 border-t border-border">
                        {ranking.slice(3).map((r, i) => (
                          <div key={r.name} className="flex items-center gap-3 text-sm">
                            <span className="w-5 text-center font-bold text-muted-foreground">{i + 4}º</span>
                            <span className="flex-1 truncate">{r.name}</span>
                            {rankVal(r) && <span className="font-bold tabular-nums text-foreground">{rankVal(r)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {teamSales.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-3"><Users className="h-4 w-4 text-primary" /> Vendas por Equipe</div>
                    <div className="space-y-2">
                      {teamSales.map((t) => (
                        <div key={t.name} className="flex items-center gap-3 text-sm">
                          <span className="flex-1 truncate">{t.name}</span>
                          <span className="font-bold tabular-nums text-foreground">{fmt(t.value, t.type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Funil 3D + Evolução semanal */}
            <div className="grid gap-4 lg:grid-cols-2">
              {funnelStages.length >= 2 && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-4"><Filter className="h-4 w-4 text-primary" /> Funil de Vendas</div>
                  <div className="flex flex-col items-center gap-1" style={{ perspective: "700px" }}>
                    {funnelStages.map((s, i) => {
                      const w = 55 + (45 * s.kpi.realizado) / funnelMax; // 55%..100%
                      const conv = i > 0 && funnelStages[i - 1].kpi.realizado > 0
                        ? (s.kpi.realizado / funnelStages[i - 1].kpi.realizado) * 100 : null;
                      return (
                        <div key={i} className="w-full flex flex-col items-center">
                          <div className="relative text-center text-white font-semibold py-2.5 rounded-md shadow-md"
                            style={{ width: `${Math.max(38, w)}%`, background: "linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.75) 100%)", transform: "rotateX(12deg)", clipPath: i === funnelStages.length - 1 ? undefined : "polygon(0 0, 100% 0, 92% 100%, 8% 100%)" }}>
                            <span className="text-xs opacity-90">{s.label}</span>
                            <span className="ml-2 text-sm font-black">{fmt(s.kpi.realizado, s.kpi.kpi_type)}</span>
                          </div>
                          {conv != null && <span className="text-[10px] text-muted-foreground my-0.5">↓ {conv.toFixed(0)}%</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mainKpi && weekly.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolução Semanal — {mainKpi.name}</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={weekly} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44}
                        tickFormatter={(v) => mainKpi.kpi_type === "monetary" ? `${(v / 1000).toFixed(0)}k` : v.toLocaleString("pt-BR")} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, color: "hsl(var(--popover-foreground))" }}
                        formatter={(v: number) => [fmt(v, mainKpi.kpi_type), "Realizado"]} />
                      <Bar dataKey="real" radius={[6, 6, 0, 0]}>
                        {weekly.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Avisos importantes (cliente adiciona) */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground mb-3"><Megaphone className="h-4 w-4 text-primary" /> Avisos Importantes</div>
              {notices.length > 0 ? (
                <ul className="space-y-1.5 mb-3">
                  {notices.map(n => (
                    <li key={n.id} className="flex items-start gap-2 text-sm">
                      {editId === n.id ? (
                        <>
                          <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveNoticeEdit(n.id, editText); if (e.key === "Escape") setEditId(null); }}
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                          <button onClick={() => saveNoticeEdit(n.id, editText)} className="text-emerald-500 hover:opacity-80 px-1" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-muted-foreground hover:opacity-80 px-1" title="Cancelar"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="flex-1 text-foreground/90">{n.text}</span>
                          <button onClick={() => { setEditId(n.id); setEditText(n.text); }} className="text-muted-foreground hover:text-primary px-1" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeNotice(n.id)} className="text-muted-foreground hover:text-rose-500 px-1" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground mb-3">Nenhum aviso ainda. Adicione lembretes pro time.</p>}
              <div className="flex items-center gap-2">
                <input value={newNotice} onChange={(e) => setNewNotice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNotice()}
                  placeholder="Novo aviso (ex: responder leads em até 15 min)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <button onClick={addNotice} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="text-center text-[11px] text-muted-foreground pt-1">Dados geram decisões · acompanhe, analise e aja com base nos números.</div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, Target, TrendingUp, Trophy, Flag } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

/**
 * Quadro de Gestão à Vista — painel de TV por cliente.
 * Mostra TODOS os KPIs configurados no sistema (company_kpis) com meta vs realizado
 * do mês, ranking do time e evolução da meta principal. Always-dark, botão de tela cheia,
 * visível também para o cliente.
 */

type KpiType = "numeric" | "monetary" | "percentage";
interface Kpi { id: string; name: string; kpi_type: KpiType; periodicity: string; target_value: number; is_main_goal: boolean; sort_order: number; }
interface TargetRow { kpi_id: string; target_value: number; level_order: number; salesperson_id: string | null; unit_id: string | null; team_id: string | null; sector_id: string | null; }
interface EntryRow { kpi_id: string; salesperson_id: string | null; value: number; entry_date: string; }
interface Person { id: string; name: string; }

interface KpiRow extends Kpi { meta: number; realizado: number; pct: number; }

const fmt = (v: number, t: string) => {
  if (t === "monetary") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  if (t === "percentage") return `${v.toFixed(1)}%`;
  return v.toLocaleString("pt-BR");
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

// cor por atingimento
const tone = (pct: number) =>
  pct >= 100 ? { bar: "#34d399", text: "#6ee7b7" } :
  pct >= 70 ? { bar: "#2dd4bf", text: "#5eead4" } :
  pct >= 40 ? { bar: "#fbbf24", text: "#fcd34d" } :
  { bar: "#fb7185", text: "#fda4af" };

export function GestaoVistaBoard({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<{ name: string; owner_name: string | null } | null>(null);
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [ranking, setRanking] = useState<{ name: string; value: number; type: string }[]>([]);
  const [evolution, setEvolution] = useState<{ day: number; real: number; meta: number }[]>([]);
  const [mainKpi, setMainKpi] = useState<KpiRow | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

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

      const [companyRes, kpiRes, targetRes, entryRes, peopleRes] = await Promise.all([
        supabase.from("onboarding_companies").select("name, owner_name").eq("id", companyId).maybeSingle(),
        supabase.from("company_kpis").select("id, name, kpi_type, periodicity, target_value, is_main_goal, sort_order").eq("company_id", companyId).eq("is_active", true).order("sort_order"),
        supabase.from("kpi_monthly_targets").select("kpi_id, target_value, level_order, salesperson_id, unit_id, team_id, sector_id").eq("company_id", companyId).eq("month_year", mKey),
        supabase.from("kpi_entries").select("kpi_id, salesperson_id, value, entry_date").eq("company_id", companyId).gte("entry_date", start).lte("entry_date", end),
        supabase.from("company_salespeople").select("id, name").eq("company_id", companyId).eq("is_active", true),
      ]);
      if (!alive) return;

      const kpiList = (kpiRes.data as Kpi[]) || [];
      const targets = (targetRes.data as TargetRow[]) || [];
      const entries = (entryRes.data as EntryRow[]) || [];
      const people = (peopleRes.data as Person[]) || [];

      // meta por KPI: nível base da empresa (menor level_order, sem escopo individual); fallback target_value
      const metaFor = (k: Kpi) => {
        const rows = targets.filter(t => t.kpi_id === k.id);
        const companyLevel = rows.filter(t => !t.salesperson_id && !t.unit_id && !t.team_id && !t.sector_id);
        const pool = companyLevel.length ? companyLevel : rows;
        if (pool.length) return pool.slice().sort((a, b) => a.level_order - b.level_order)[0].target_value || 0;
        return Number(k.target_value) || 0;
      };
      // realizado por KPI = soma de todos os lançamentos do mês
      const realFor = (kid: string) => entries.filter(e => e.kpi_id === kid).reduce((s, e) => s + Number(e.value || 0), 0);

      const rows: KpiRow[] = kpiList.map(k => {
        const meta = metaFor(k);
        const realizado = realFor(k.id);
        return { ...k, meta, realizado, pct: meta > 0 ? (realizado / meta) * 100 : 0 };
      });

      // meta principal: is_main_goal (prioriza monetária), senão a primeira monetária, senão a primeira
      const main = rows.find(r => r.is_main_goal && r.kpi_type === "monetary")
        || rows.find(r => r.is_main_goal)
        || rows.find(r => r.kpi_type === "monetary")
        || rows[0] || null;

      // ranking do time pela meta principal
      let rank: { name: string; value: number; type: string }[] = [];
      if (main) {
        const byPerson = new Map<string, number>();
        entries.filter(e => e.kpi_id === main.id && e.salesperson_id).forEach(e => {
          byPerson.set(e.salesperson_id!, (byPerson.get(e.salesperson_id!) || 0) + Number(e.value || 0));
        });
        rank = people.map(p => ({ name: p.name, value: byPerson.get(p.id) || 0, type: main.kpi_type }))
          .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
      }

      // evolução acumulada da meta principal por dia vs ritmo linear da meta
      let evo: { day: number; real: number; meta: number }[] = [];
      if (main) {
        const days = endD.getDate();
        const perDay = new Map<number, number>();
        entries.filter(e => e.kpi_id === main.id).forEach(e => {
          const d = Number(e.entry_date.slice(8, 10));
          perDay.set(d, (perDay.get(d) || 0) + Number(e.value || 0));
        });
        let acc = 0;
        evo = Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          acc += perDay.get(day) || 0;
          return { day, real: acc, meta: main.meta > 0 ? (main.meta / days) * day : 0 };
        });
      }

      setCompany(companyRes.data as any);
      setKpis(rows);
      setMainKpi(main);
      setRanking(rank);
      setEvolution(evo);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId, refDate]);

  const toggleFull = async () => {
    const el = boardRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) { await el.requestFullscreen?.(); setIsFull(true); }
      else { await document.exitFullscreen?.(); setIsFull(false); }
    } catch { setIsFull(f => !f); } // fallback overlay (Safari iOS)
  };
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const mainGoals = kpis.filter(k => k.is_main_goal);
  const generalCards = (mainGoals.length ? mainGoals : kpis).slice(0, 4);

  return (
    <div
      ref={boardRef}
      className={isFull ? "fixed inset-0 z-[200] overflow-auto" : "rounded-2xl overflow-hidden"}
      style={{ background: "radial-gradient(1200px 600px at 50% -10%, #123634 0%, #0a1717 55%, #060f0f 100%)", color: "#e7f2f0" }}
    >
      <div className="p-4 sm:p-6 space-y-4 min-h-full" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 border-b border-teal-500/20 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/unv-logo.png" alt="" className="h-9 w-9 object-contain opacity-90" onError={(e) => ((e.currentTarget.style.display = "none"))} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-teal-300/70 truncate">{company?.name || "Cliente"}</div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight leading-tight">QUADRO DE GESTÃO À VISTA</h2>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-teal-300/60">
            <span>Foco</span><span className="text-teal-400">·</span><span>Processo</span><span className="text-teal-400">·</span><span>Resultado</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-lg bg-white/5 px-1.5 py-1">
              <button onClick={() => setMonthOffset(o => o - 1)} className="p-1 rounded hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-xs font-semibold capitalize px-1 min-w-[92px] text-center">{monthLabel(refDate)}</span>
              <button onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={toggleFull} className="p-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-200" title="Tela cheia">
              {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-24 text-teal-200/70">Nenhum KPI configurado para este cliente ainda.</div>
        ) : (
          <>
            {/* Indicadores gerais (metas principais) */}
            {generalCards.length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}>
                {generalCards.map(k => {
                  const t = tone(k.pct);
                  return (
                    <div key={k.id} className="rounded-xl p-4 border border-teal-500/20 bg-white/[0.03] backdrop-blur">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-teal-300/70 mb-1">
                        <Target className="h-3.5 w-3.5" /> <span className="truncate">{k.name}</span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black" style={{ color: t.text }}>{fmt(k.realizado, k.kpi_type)}</div>
                      <div className="text-[11px] text-teal-100/50 mt-0.5">meta {fmt(k.meta, k.kpi_type)} · <span style={{ color: t.text }}>{k.pct.toFixed(0)}%</span></div>
                      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, k.pct)}%`, background: t.bar }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              {/* Metas do mês — TODOS os KPIs configurados */}
              <div className="rounded-xl border border-teal-500/20 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-200 mb-3">
                  <Flag className="h-4 w-4" /> Metas do Mês
                  <span className="ml-auto text-[11px] font-normal text-teal-300/50">{kpis.length} indicadores</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                  {kpis.map(k => {
                    const t = tone(k.pct);
                    return (
                      <div key={k.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate text-teal-50/90">{k.name}</span>
                          <span className="font-bold tabular-nums" style={{ color: t.text }}>{fmt(k.realizado, k.kpi_type)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, k.pct)}%`, background: t.bar }} />
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums w-9 text-right" style={{ color: t.text }}>{k.pct.toFixed(0)}%</span>
                        </div>
                        <div className="text-[10px] text-teal-100/40 mt-0.5">meta {fmt(k.meta, k.kpi_type)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna direita: ranking + evolução */}
              <div className="space-y-4">
                {ranking.length > 0 && (
                  <div className="rounded-xl border border-teal-500/20 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-200 mb-3">
                      <Trophy className="h-4 w-4 text-amber-300" /> Ranking do Time
                    </div>
                    <div className="space-y-2">
                      {ranking.map((r, i) => (
                        <div key={r.name} className="flex items-center gap-3 text-sm">
                          <span className={`w-5 text-center font-black ${i === 0 ? "text-amber-300" : i === 1 ? "text-teal-200" : "text-teal-100/60"}`}>{i + 1}º</span>
                          <span className="flex-1 truncate">{r.name}</span>
                          <span className="font-bold tabular-nums text-teal-100">{fmt(r.value, r.type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mainKpi && evolution.length > 0 && (
                  <div className="rounded-xl border border-teal-500/20 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-200 mb-2">
                      <TrendingUp className="h-4 w-4" /> Evolução — {mainKpi.name}
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={evolution} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gvReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#99f6e4aa" }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fontSize: 10, fill: "#99f6e4aa" }} tickLine={false} axisLine={false} width={44}
                          tickFormatter={(v) => mainKpi.kpi_type === "monetary" ? `${(v / 1000).toFixed(0)}k` : v.toLocaleString("pt-BR")} />
                        <Tooltip
                          contentStyle={{ background: "#0b1f1e", border: "1px solid #2dd4bf40", borderRadius: 10, fontSize: 12, color: "#e7f2f0" }}
                          formatter={(v: number, n) => [fmt(v, mainKpi.kpi_type), n === "real" ? "Realizado" : "Meta"]}
                          labelFormatter={(l) => `Dia ${l}`}
                        />
                        <Area type="monotone" dataKey="meta" stroke="#f8fafc55" strokeDasharray="5 4" fill="none" strokeWidth={1.5} dot={false} />
                        <Area type="monotone" dataKey="real" stroke="#2dd4bf" fill="url(#gvReal)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-[11px] text-teal-300/40 pt-1">Dados geram decisões · acompanhe, analise e aja com base nos números.</div>
          </>
        )}
      </div>
    </div>
  );
}

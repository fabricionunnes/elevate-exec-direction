import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, Users, Wallet, CheckCircle2, XCircle, CalendarDays, PieChart, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiSearchableSelect } from "@/components/crm/traffic/MultiSearchableSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Visão geral de todos os funis: quantos leads em cada funil, separado por
// etapa, com valor em negociação e tempo médio parado na etapa.

interface Stage { id: string; name: string; pipeline_id: string; sort_order: number; final_type: string | null; exclude_from_lead_count?: boolean; }
interface AggRow { pipeline_id: string; stage_id: string; lead_count: number; value_sum: number; avg_days_in_stage: number | null; }

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);


// ── Pizza 3D da qualidade dos leads que entraram no período ──────────────────
const QUALITY_STYLE: Record<string, { color: string; dark: string; desc: string }> = {
  "Qualificado": { color: "#3b82f6", dark: "#1d4ed8", desc: "avançou da etapa inicial ou teve reunião" },
  "Ganho": { color: "#10b981", dark: "#047857", desc: "virou venda" },
  "Fora do perfil": { color: "#f59e0b", dark: "#b45309", desc: "fora do ICP, sem fit ou etapa Pessoal" },
  "Perdido": { color: "#ef4444", dark: "#b91c1c", desc: "perdido por outro motivo" },
  "Aguardando triagem": { color: "#94a3b8", dark: "#64748b", desc: "ainda na etapa de entrada" },
};
const QUALITY_ORDER = ["Qualificado", "Ganho", "Fora do perfil", "Perdido", "Aguardando triagem"];

const LeadQualityPie = ({
  data,
  onSliceClick,
}: {
  data: { categoria: string; total: number }[];
  onSliceClick: (categoria: string) => void;
}) => {
  const rows = QUALITY_ORDER
    .map((k) => ({ key: k, total: Number(data.find((d) => d.categoria === k)?.total || 0) }))
    .filter((r) => r.total > 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total === 0) return null;

  // geometria do disco em perspectiva
  const cx = 150, cy = 108, rx = 132, ry = 62, depth = 26;
  const pt = (ang: number, r = 1) => [cx + rx * r * Math.cos(ang), cy + ry * r * Math.sin(ang)];

  let acc = -Math.PI / 2; // começa no topo
  const slices = rows.map((r) => {
    const frac = r.total / total;
    const start = acc;
    const end = acc + frac * Math.PI * 2;
    acc = end;
    const [x1, y1] = pt(start), [x2, y2] = pt(end);
    const large = end - start > Math.PI ? 1 : 0;
    const st = QUALITY_STYLE[r.key];
    return { ...r, frac, start, end, x1, y1, x2, y2, large, ...st };
  });

  // a lateral só aparece na metade da frente (sen > 0)
  const sideSlices = slices.filter((s) => Math.sin(s.start) > 0 || Math.sin(s.end) > 0 || s.end - s.start > Math.PI);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Qualidade dos leads do período
          <Badge variant="secondary" className="text-[10px]">{total} leads</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-6">
        <svg viewBox="0 0 300 220" className="w-full max-w-[340px] shrink-0">
          <defs>
            {slices.map((s, i) => (
              <linearGradient key={i} id={`lq${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} />
                <stop offset="100%" stopColor={s.dark} />
              </linearGradient>
            ))}
            <radialGradient id="lqShine" cx="35%" cy="25%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx={cx} cy={cy + depth + 8} rx={rx} ry={ry * 0.55} fill="#000" opacity={0.07} />

          {/* espessura */}
          {sideSlices.map((s, i) => (
            <path
              key={`side${i}`}
              d={`M ${s.x1} ${s.y1} A ${rx} ${ry} 0 ${s.large} 1 ${s.x2} ${s.y2} L ${s.x2} ${s.y2 + depth} A ${rx} ${ry} 0 ${s.large} 0 ${s.x1} ${s.y1 + depth} Z`}
              fill={s.dark}
            />
          ))}

          {/* topo */}
          {slices.map((s, i) => (
            <path
              key={`top${i}`}
              d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${rx} ${ry} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
              fill={`url(#lq${i})`}
              stroke="#fff"
              strokeWidth={1.2}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onSliceClick(s.key)}
            >
              <title>{`${s.key}: ${s.total} lead(s) — clique para ver`}</title>
            </path>
          ))}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#lqShine)" pointerEvents="none" />

          {/* percentuais nas fatias com espaço */}
          {slices.filter((s) => s.frac >= 0.07).map((s, i) => {
            const mid = (s.start + s.end) / 2;
            const [lx, ly] = pt(mid, 0.62);
            return (
              <text key={`lb${i}`} x={lx} y={ly + 4} textAnchor="middle" fontSize={13} fontWeight={800}
                fill="#fff" style={{ paintOrder: "stroke" }} stroke={s.dark} strokeWidth={2.5}>
                {(s.frac * 100).toFixed(0)}%
              </text>
            );
          })}
        </svg>

        <div className="flex-1 w-full space-y-2">
          {slices.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-2.5 cursor-pointer rounded-md px-1 py-0.5 hover:bg-muted/60"
              onClick={() => onSliceClick(s.key)}
            >
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">
                  {s.key} <span className="text-muted-foreground font-normal">— {s.desc}</span>
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums">{(s.frac * 100).toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{s.total}</span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            Clique numa fatia para ver os leads dela. Inclui os leads em etapas fora da contagem (ex: "Pessoal") — são
            justamente o fora do perfil, por isso o total aqui pode ser maior que o card "Leads no CRM".
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const FunnelsOverviewTab = () => {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [agg, setAgg] = useState<AggRow[]>([]);
  // Período de ENTRADA do lead. Vazio = tudo (comportamento antigo).
  // Padrão: mês atual (a base inteira sem recorte não diz nada sobre qualidade)
  const monthStartISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })();
  const todayISO = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthStartISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
  const [adsetFilter, setAdsetFilter] = useState<string[]>([]);
  const [adFilter, setAdFilter] = useState<string[]>([]);
  const [metaOpts, setMetaOpts] = useState<{
    campaigns: { value: string; label: string }[];
    adsets: { value: string; label: string; campaign_id: string | null }[];
    ads: { value: string; label: string; adset_id: string | null; campaign_id: string | null }[];
  }>({ campaigns: [], adsets: [], ads: [] });
  const [quality, setQuality] = useState<{ categoria: string; total: number }[]>([]);
  const [pipeFilter, setPipeFilter] = useState<string[]>([]);
  const [drill, setDrill] = useState<{ categoria: string; rows: any[]; loading: boolean } | null>(null);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const applyQuick = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(iso(days === 0 ? to : from));
    setDateTo(iso(to));
  };

  useEffect(() => {
    (async () => {
      const [c, a, ad] = await Promise.all([
        supabase.from("crm_meta_ads_campaigns").select("campaign_id, campaign_name").order("campaign_name"),
        supabase.from("crm_meta_ads_adsets").select("adset_id, adset_name, campaign_id").order("adset_name"),
        supabase.from("crm_meta_ads_ads").select("ad_id, ad_name, adset_id, campaign_id").order("ad_name"),
      ]);
      const uniq = <T,>(rows: T[], key: (r: T) => string) => {
        const m = new Map<string, T>();
        rows.forEach((r) => { const k = key(r); if (k && !m.has(k)) m.set(k, r); });
        return Array.from(m.values());
      };
      setMetaOpts({
        campaigns: uniq((c.data as any[]) || [], (r) => r.campaign_id).map((r: any) => ({ value: r.campaign_id, label: r.campaign_name || r.campaign_id })),
        adsets: uniq((a.data as any[]) || [], (r) => r.adset_id).map((r: any) => ({ value: r.adset_id, label: r.adset_name || r.adset_id, campaign_id: r.campaign_id })),
        ads: uniq((ad.data as any[]) || [], (r) => r.ad_id).map((r: any) => ({ value: r.ad_id, label: r.ad_name || r.ad_id, adset_id: r.adset_id, campaign_id: r.campaign_id })),
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, s, a] = await Promise.all([
          supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
          supabase.from("crm_stages").select("id, name, pipeline_id, sort_order, final_type, exclude_from_lead_count").order("sort_order"),
          (supabase as any).rpc("get_funnels_overview", {
            p_from: dateFrom || null,
            p_to: dateTo || null,
            p_pipeline_ids: pipeFilter.length ? pipeFilter : null,
            p_campaign_ids: campaignFilter.length ? campaignFilter : null,
            p_adset_ids: adsetFilter.length ? adsetFilter : null,
            p_ad_ids: adFilter.length ? adFilter : null,
          }),
        ]);
        setPipelines(p.data || []);
        setStages((s.data as Stage[]) || []);
        setAgg((a.data as AggRow[]) || []);

        const q = await (supabase as any).rpc("get_funnel_lead_quality", {
          p_from: dateFrom || null,
          p_to: dateTo || null,
          p_pipeline_ids: pipeFilter.length ? pipeFilter : null,
          p_campaign_ids: campaignFilter.length ? campaignFilter : null,
          p_adset_ids: adsetFilter.length ? adsetFilter : null,
          p_ad_ids: adFilter.length ? adFilter : null,
        });
        setQuality((q.data as any[]) || []);
      } finally { setLoading(false); }
    })();
  }, [dateFrom, dateTo, pipeFilter, campaignFilter, adsetFilter, adFilter]);

  const byPipeline = useMemo(() => {
    const byStage = new Map(agg.map(r => [r.stage_id, r]));
    return pipelines.map(p => {
      // etapa "Pessoal" (exclude_from_lead_count) fica fora da contagem de leads
      const pStages = stages.filter(s => s.pipeline_id === p.id && !s.exclude_from_lead_count);
      const rows = pStages.map(st => {
        const r = byStage.get(st.id);
        return {
          stage: st,
          count: Number(r?.lead_count || 0),
          value: Number(r?.value_sum || 0),
          avgDays: r?.avg_days_in_stage !== null && r?.avg_days_in_stage !== undefined ? Number(r.avg_days_in_stage) : null,
        };
      });
      const open = rows.filter(r => !r.stage.final_type);
      const total = rows.reduce((s, r) => s + r.count, 0);
      const openCount = open.reduce((s, r) => s + r.count, 0);
      const openValue = open.reduce((s, r) => s + r.value, 0);
      const won = rows.filter(r => r.stage.final_type === "won").reduce((s, r) => s + r.count, 0);
      const lost = rows.filter(r => r.stage.final_type === "lost").reduce((s, r) => s + r.count, 0);
      const maxCount = Math.max(1, ...rows.map(r => r.count));
      return { pipeline: p, rows, total, openCount, openValue, won, lost, maxCount };
    })
      // com filtro de data, só aparecem os funis que receberam lead no período
      .filter(x => pipeFilter.length === 0 || pipeFilter.includes(x.pipeline.id))
      .filter(x => (dateFrom || dateTo) ? x.total > 0 : true)
      .sort((a, b) => b.total - a.total);
  }, [pipelines, stages, agg, dateFrom, dateTo, pipeFilter]);

  const totals = useMemo(() => ({
    leads: byPipeline.reduce((s, p) => s + p.total, 0),
    open: byPipeline.reduce((s, p) => s + p.openCount, 0),
    openValue: byPipeline.reduce((s, p) => s + p.openValue, 0),
    won: byPipeline.reduce((s, p) => s + p.won, 0),
    lost: byPipeline.reduce((s, p) => s + p.lost, 0),
  }), [byPipeline]);

  const SummaryCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) => (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className="p-2 rounded-lg shrink-0" style={{ background: `${color}1f` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );

  const openSlice = async (categoria: string) => {
    setDrill({ categoria, rows: [], loading: true });
    const { data } = await (supabase as any).rpc("get_funnel_leads_by_quality", {
      p_from: dateFrom || null,
      p_to: dateTo || null,
      p_pipeline_ids: pipeFilter.length ? pipeFilter : null,
      p_categoria: categoria,
      p_campaign_ids: campaignFilter.length ? campaignFilter : null,
      p_adset_ids: adsetFilter.length ? adsetFilter : null,
      p_ad_ids: adFilter.length ? adFilter : null,
    });
    setDrill({ categoria, rows: (data as any[]) || [], loading: false });
  };

  const hasRange = !!(dateFrom || dateTo);
  const hasAdFilter = campaignFilter.length + adsetFilter.length + adFilter.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Card>
        <CardContent className="py-3 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Entrada do lead
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[150px]" />
          </div>
          <div className="flex flex-col gap-1 min-w-[210px]">
            <Label className="text-[10px] text-muted-foreground">Funil</Label>
            <MultiSearchableSelect
              values={pipeFilter}
              onChange={setPipeFilter}
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Todos os funis"
              allLabel="Todos os funis"
              className="h-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-8" onClick={() => applyQuick(0)}>Hoje</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => applyQuick(7)}>7 dias</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => applyQuick(30)}>30 dias</Button>
            {(hasRange || pipeFilter.length > 0 || hasAdFilter) && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setDateFrom(""); setDateTo(""); setPipeFilter([]); setCampaignFilter([]); setAdsetFilter([]); setAdFilter([]); }}>
                Limpar
              </Button>
            )}
          </div>
          <div className="w-full flex flex-wrap items-end gap-3 pt-1">
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <Label className="text-[10px] text-muted-foreground">Campanha</Label>
              <MultiSearchableSelect
                values={campaignFilter}
                onChange={(v) => { setCampaignFilter(v); setAdsetFilter([]); setAdFilter([]); }}
                options={metaOpts.campaigns}
                placeholder="Todas as campanhas"
                allLabel="Todas as campanhas"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <Label className="text-[10px] text-muted-foreground">Conjunto de anúncios</Label>
              <MultiSearchableSelect
                values={adsetFilter}
                onChange={(v) => { setAdsetFilter(v); setAdFilter([]); }}
                options={metaOpts.adsets
                  .filter((a) => campaignFilter.length === 0 || (a.campaign_id && campaignFilter.includes(a.campaign_id)))
                  .map(({ value, label }) => ({ value, label }))}
                placeholder="Todos os conjuntos"
                allLabel="Todos os conjuntos"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <Label className="text-[10px] text-muted-foreground">Anúncio</Label>
              <MultiSearchableSelect
                values={adFilter}
                onChange={setAdFilter}
                options={metaOpts.ads
                  .filter((a) => campaignFilter.length === 0 || (a.campaign_id && campaignFilter.includes(a.campaign_id)))
                  .filter((a) => adsetFilter.length === 0 || (a.adset_id && adsetFilter.includes(a.adset_id)))
                  .map(({ value, label }) => ({ value, label }))}
                placeholder="Todos os anúncios"
                allLabel="Todos os anúncios"
                className="h-8"
              />
            </div>
          </div>

          {hasAdFilter && (
            <p className="w-full text-[11px] text-muted-foreground">
              Filtro de anúncio considera só os leads com rastreamento da Meta — quem entrou sem UTM não aparece.
            </p>
          )}

          {hasRange && (
            <Badge variant="secondary" className="text-[11px] ml-auto">
              {byPipeline.length} funil{byPipeline.length === 1 ? "" : "s"} com lead no período
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={Users} label="Leads no CRM" value={totals.leads} color="#60a5fa" />
        <SummaryCard icon={Filter} label="Em aberto" value={totals.open} sub="fora de ganho/perda" color="#a78bfa" />
        <SummaryCard icon={Wallet} label="Valor em negociação" value={fmtBRL(totals.openValue)} color="#fbbf24" />
        <SummaryCard icon={CheckCircle2} label="Ganhos" value={totals.won} color="#34d399" />
        <SummaryCard icon={XCircle} label="Perdidos" value={totals.lost} color="#f87171" />
      </div>

      {!loading && quality.length > 0 && <LeadQualityPie data={quality} onSliceClick={openSlice} />}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && byPipeline.length === 0 && (
        <p className="text-sm text-muted-foreground py-10 text-center">
          Nenhum funil recebeu lead nesse período.
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {!loading && byPipeline.map(({ pipeline, rows, total, openCount, openValue, won, lost, maxCount }) => (
          <Card key={pipeline.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                {pipeline.name}
                <Badge variant="secondary" className="text-[10px]">{total} leads</Badge>
                <Badge variant="outline" className="text-[10px]">{openCount} em aberto</Badge>
                {openValue > 0 && <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-0">{fmtBRL(openValue)}</Badge>}
                <span className="ml-auto flex items-center gap-2 text-[11px] font-normal">
                  {won > 0 && <span className="text-emerald-600 font-semibold">{won} ganhos</span>}
                  {lost > 0 && <span className="text-rose-500 font-semibold">{lost} perdidos</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {rows.length === 0 && <p className="text-xs text-muted-foreground">Funil sem etapas.</p>}
              {rows.map(({ stage, count, value, avgDays }) => {
                const isWon = stage.final_type === "won";
                const isLost = stage.final_type === "lost";
                const barColor = isWon ? "bg-emerald-500" : isLost ? "bg-rose-500" : "bg-primary/60";
                return (
                  <div key={stage.id} className="flex items-center gap-2">
                    <span className={cn("text-[11px] w-36 shrink-0 truncate", (isWon || isLost) ? "font-semibold" : "text-muted-foreground",
                      isWon && "text-emerald-600", isLost && "text-rose-500")} title={stage.name}>
                      {stage.name}
                    </span>
                    <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                      <div className={cn("h-full rounded transition-all", barColor)} style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums w-9 text-right">{count}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-20 text-right hidden sm:block">
                      {value > 0 ? fmtBRL(value) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right hidden md:block"
                      title="dias médios que os leads estão parados nessa etapa">
                      {avgDays !== null && !stage.final_type ? `${Math.round(avgDays)}d média` : ""}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {drill?.categoria}
              {!drill?.loading && (
                <Badge variant="secondary" className="text-[11px]">{drill?.rows.length} lead(s)</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {drill?.loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : drill?.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lead nesta categoria.</p>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-1.5 pr-3">
                {drill?.rows.map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => window.open(`${window.location.origin}/#/crm/leads/${l.id}`, "_blank")}
                    className="w-full text-left p-2.5 rounded-lg border bg-card hover:bg-muted/50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {l.name || "Sem nome"}{l.company ? ` — ${l.company}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {l.pipeline_name} · {l.stage_name}
                        {l.loss_reason ? ` · ${l.loss_reason}` : ""}
                        {l.created_at ? ` · entrou em ${new Date(l.created_at).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {Number(l.opportunity_value) > 0 && (
                        <span className="text-xs font-semibold tabular-nums">{fmtBRL(Number(l.opportunity_value))}</span>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-muted-foreground">
        {hasRange ? "Com filtro de data, os números consideram só os leads que ENTRARAM no período — a etapa mostrada é a atual deles. " : ""}Barras comparam as etapas dentro do mesmo funil. Valor = soma do valor de oportunidade dos leads na etapa. "Xd média" = tempo médio que os leads atuais estão parados na etapa.
      </p>
    </div>
  );
};

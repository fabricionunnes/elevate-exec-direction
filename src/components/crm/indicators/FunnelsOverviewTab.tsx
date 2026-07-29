import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, Users, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Visão geral de todos os funis: quantos leads em cada funil, separado por
// etapa, com valor em negociação e tempo médio parado na etapa.

interface Stage { id: string; name: string; pipeline_id: string; sort_order: number; final_type: string | null; }
interface AggRow { pipeline_id: string; stage_id: string; lead_count: number; value_sum: number; avg_days_in_stage: number | null; }

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export const FunnelsOverviewTab = () => {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [agg, setAgg] = useState<AggRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, s, a] = await Promise.all([
          supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
          supabase.from("crm_stages").select("id, name, pipeline_id, sort_order, final_type").order("sort_order"),
          supabase.rpc("get_funnels_overview"),
        ]);
        setPipelines(p.data || []);
        setStages((s.data as Stage[]) || []);
        setAgg((a.data as AggRow[]) || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const byPipeline = useMemo(() => {
    const byStage = new Map(agg.map(r => [r.stage_id, r]));
    return pipelines.map(p => {
      const pStages = stages.filter(s => s.pipeline_id === p.id);
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
    }).sort((a, b) => b.total - a.total);
  }, [pipelines, stages, agg]);

  const totals = useMemo(() => ({
    leads: byPipeline.reduce((s, p) => s + p.total, 0),
    open: byPipeline.reduce((s, p) => s + p.openCount, 0),
    openValue: byPipeline.reduce((s, p) => s + p.openValue, 0),
    won: byPipeline.reduce((s, p) => s + p.won, 0),
    lost: byPipeline.reduce((s, p) => s + p.lost, 0),
  }), [byPipeline]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

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

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={Users} label="Leads no CRM" value={totals.leads} color="#60a5fa" />
        <SummaryCard icon={Filter} label="Em aberto" value={totals.open} sub="fora de ganho/perda" color="#a78bfa" />
        <SummaryCard icon={Wallet} label="Valor em negociação" value={fmtBRL(totals.openValue)} color="#fbbf24" />
        <SummaryCard icon={CheckCircle2} label="Ganhos" value={totals.won} color="#34d399" />
        <SummaryCard icon={XCircle} label="Perdidos" value={totals.lost} color="#f87171" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {byPipeline.map(({ pipeline, rows, total, openCount, openValue, won, lost, maxCount }) => (
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
      <p className="text-[11px] text-muted-foreground">
        Barras comparam as etapas dentro do mesmo funil. Valor = soma do valor de oportunidade dos leads na etapa. "Xd média" = tempo médio que os leads atuais estão parados na etapa.
      </p>
    </div>
  );
};

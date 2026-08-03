import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  CalendarCheck,
  Handshake,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Megaphone,
} from "lucide-react";

interface DayNumbers {
  leads: number;
  scheduled: number;
  realized: number;
  salesCount: number;
  salesValue: number;
}

interface Data {
  refDate: Date;
  yesterday: DayNumbers;
  avg7: DayNumbers;
  monthSales: number;
  monthTarget: number;
  pipelineWeighted: number;
  forecast: number;
  topCloser: { name: string; value: number } | null;
  noShow: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** dia útil anterior: segunda olha pra sexta */
const previousBusinessDay = (from: Date) => {
  let d = subDays(from, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = subDays(d, 1);
  return d;
};

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

export const CommercialDailyBlock = () => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const refDate = previousBusinessDay(new Date());
      const refKey = dayKey(refDate);
      const windowStart = dayKey(subDays(refDate, 9)); // janela pra média dos dias úteis
      const monthStart = dayKey(startOfMonth(new Date()));
      const monthEnd = dayKey(endOfMonth(new Date()));

      // funis/etapas que contam entrada de lead (mesma regra do dashboard de pré-vendas)
      const [{ data: inflowPipes }, { data: exStages }, { data: goalPipes }] = await Promise.all([
        supabase.from("crm_pipelines").select("id").eq("counts_lead_inflow", true),
        supabase.from("crm_stages").select("id").eq("exclude_from_lead_count", true),
        supabase.from("crm_pipelines").select("id").eq("counts_for_goals", true),
      ]);
      const inflowIds = (inflowPipes || []).map((p: any) => p.id);
      const exStageIds = new Set((exStages || []).map((s: any) => s.id));
      const goalPipeIds = (goalPipes || []).map((p: any) => p.id);

      const [leadsRes, eventsRes, salesRes, openLeadsRes, finalStagesRes] = await Promise.all([
        inflowIds.length
          ? supabase
              .from("crm_leads")
              .select("id, stage_id, created_at")
              .in("pipeline_id", inflowIds)
              .gte("created_at", `${windowStart}T00:00:00`)
              .lte("created_at", `${refKey}T23:59:59`)
              .limit(20000)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("crm_meeting_events")
          .select("event_type, event_date")
          .gte("event_date", `${windowStart}T00:00:00`)
          .lte("event_date", `${refKey}T23:59:59`),
        supabase
          .from("crm_sales")
          .select("sale_date, revenue_value, billing_value, closer_staff_id")
          .gte("sale_date", monthStart)
          .lte("sale_date", monthEnd),
        goalPipeIds.length
          ? supabase
              .from("crm_leads")
              .select("id, stage_id, opportunity_value, probability")
              .in("pipeline_id", goalPipeIds)
              .is("closed_at", null)
              .limit(20000)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("crm_stages").select("id, is_final"),
      ]);

      const finalStageIds = new Set(
        (finalStagesRes.data || []).filter((s: any) => s.is_final).map((s: any) => s.id)
      );

      // ── leads por dia
      const leadsByDay: Record<string, number> = {};
      (leadsRes.data || []).forEach((l: any) => {
        if (l.stage_id && exStageIds.has(l.stage_id)) return;
        const k = String(l.created_at).slice(0, 10);
        leadsByDay[k] = (leadsByDay[k] || 0) + 1;
      });

      // ── eventos de reunião por dia
      const schedByDay: Record<string, number> = {};
      const realByDay: Record<string, number> = {};
      const noShowByDay: Record<string, number> = {};
      (eventsRes.data || []).forEach((e: any) => {
        const k = String(e.event_date).slice(0, 10);
        if (e.event_type === "scheduled") schedByDay[k] = (schedByDay[k] || 0) + 1;
        // "realized_out_of_icp" e "out_of_icp" NÃO contam como reunião realizada
        if (e.event_type === "realized") realByDay[k] = (realByDay[k] || 0) + 1;
        if (e.event_type === "no_show") noShowByDay[k] = (noShowByDay[k] || 0) + 1;
      });

      // ── vendas
      const salesByDay: Record<string, { n: number; v: number }> = {};
      let monthSales = 0;
      const byCloser: Record<string, number> = {};
      (salesRes.data || []).forEach((s: any) => {
        const v = Number(s.revenue_value) || Number(s.billing_value) || 0;
        const k = String(s.sale_date).slice(0, 10);
        if (!salesByDay[k]) salesByDay[k] = { n: 0, v: 0 };
        salesByDay[k].n += 1;
        salesByDay[k].v += v;
        monthSales += v;
        if (s.closer_staff_id) byCloser[s.closer_staff_id] = (byCloser[s.closer_staff_id] || 0) + v;
      });

      // ── pipeline aberto ponderado (forecast)
      let pipelineWeighted = 0;
      (openLeadsRes.data || []).forEach((l: any) => {
        if (l.stage_id && finalStageIds.has(l.stage_id)) return;
        const value = Number(l.opportunity_value) || 0;
        const prob = l.probability === null || l.probability === undefined ? 50 : Number(l.probability);
        pipelineWeighted += value * (prob / 100);
      });

      // ── meta do mês: soma das metas de Vendas (currency) dos closers no mês
      const now = new Date();
      const { data: goalTypes } = await supabase
        .from("crm_goal_types")
        .select("id, name, unit_type")
        .eq("unit_type", "currency")
        .eq("is_active", true);
      const salesGoalTypeId = (goalTypes || []).find((g: any) =>
        String(g.name).toLowerCase().includes("venda")
      )?.id;
      let monthTarget = 0;
      if (salesGoalTypeId) {
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("meta_value")
          .eq("goal_type_id", salesGoalTypeId)
          .eq("month", now.getMonth() + 1)
          .eq("year", now.getFullYear());
        monthTarget = (goalValues || []).reduce((s: number, g: any) => s + (Number(g.meta_value) || 0), 0);
      }

      // ── média dos últimos dias úteis (sem contar o dia de referência)
      const businessDays: string[] = [];
      let cursor = subDays(refDate, 1);
      while (businessDays.length < 5) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) businessDays.push(dayKey(cursor));
        cursor = subDays(cursor, 1);
      }
      const avgOf = (map: Record<string, number>) =>
        businessDays.reduce((s, k) => s + (map[k] || 0), 0) / businessDays.length;

      const topCloserId = Object.keys(byCloser).sort((a, b) => byCloser[b] - byCloser[a])[0];
      let topCloser: Data["topCloser"] = null;
      if (topCloserId) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("name")
          .eq("id", topCloserId)
          .maybeSingle();
        if (staff?.name) topCloser = { name: staff.name, value: byCloser[topCloserId] };
      }

      setData({
        refDate,
        yesterday: {
          leads: leadsByDay[refKey] || 0,
          scheduled: schedByDay[refKey] || 0,
          realized: realByDay[refKey] || 0,
          salesCount: salesByDay[refKey]?.n || 0,
          salesValue: salesByDay[refKey]?.v || 0,
        },
        avg7: {
          leads: avgOf(leadsByDay),
          scheduled: avgOf(schedByDay),
          realized: avgOf(realByDay),
          salesCount: avgOf(
            Object.fromEntries(Object.entries(salesByDay).map(([k, v]) => [k, v.n]))
          ),
          salesValue: avgOf(
            Object.fromEntries(Object.entries(salesByDay).map(([k, v]) => [k, v.v]))
          ),
        },
        monthSales,
        monthTarget,
        pipelineWeighted,
        forecast: monthSales + pipelineWeighted,
        topCloser,
        noShow: noShowByDay[refKey] || 0,
      });
    } catch (err) {
      console.error("[CommercialDailyBlock] erro:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-64" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const d = data;
  const conv = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const convLeadSched = conv(d.yesterday.scheduled, d.yesterday.leads);
  const convSchedReal = conv(d.yesterday.realized, d.yesterday.scheduled);
  const attainment = d.monthTarget > 0 ? (d.monthSales / d.monthTarget) * 100 : 0;
  const forecastAttainment = d.monthTarget > 0 ? (d.forecast / d.monthTarget) * 100 : 0;

  const Delta = ({ value, avg }: { value: number; avg: number }) => {
    if (avg <= 0) return <span className="text-[11px] text-muted-foreground">sem base de comparação</span>;
    const diff = ((value - avg) / avg) * 100;
    const flat = Math.abs(diff) < 10;
    const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    const color = flat ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-destructive";
    return (
      <span className={`text-[11px] flex items-center gap-0.5 ${color}`}>
        <Icon className="h-3 w-3" />
        {diff > 0 ? "+" : ""}
        {diff.toFixed(0)}% vs média (méd. {avg.toFixed(1)})
      </span>
    );
  };

  const Metric = ({
    icon: Icon,
    label,
    value,
    sub,
    accent,
  }: {
    icon: any;
    label: string;
    value: string;
    sub?: React.ReactNode;
    accent: string;
  }) => (
    <div className="p-3 rounded-xl border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
      <div className="mt-0.5">{sub}</div>
    </div>
  );

  // ── pauta: o que falar na daily
  const talkingPoints: string[] = [];

  if (d.yesterday.leads === 0) {
    talkingPoints.push("Zero lead novo ontem. Confirmar com o marketing se as campanhas estão rodando e se o webhook do funil está entregando.");
  } else if (d.avg7.leads > 0 && d.yesterday.leads < d.avg7.leads * 0.7) {
    talkingPoints.push(`Entrada de leads ${(100 - conv(d.yesterday.leads, d.avg7.leads)).toFixed(0)}% abaixo da média. Cobrar do marketing o volume e checar custo por lead antes de cobrar conversão do time.`);
  }

  if (d.yesterday.leads > 0 && convLeadSched < 20) {
    talkingPoints.push(`Conversão lead → agendamento em ${convLeadSched.toFixed(0)}%. Ouvir 2 áudios de abordagem do SDR na daily e ajustar o gancho da primeira mensagem.`);
  }

  if (d.yesterday.scheduled > 0 && convSchedReal < 60) {
    talkingPoints.push(`Só ${convSchedReal.toFixed(0)}% das reuniões agendadas aconteceram. Rever a régua de confirmação — lembrete na véspera e 1h antes.`);
  }

  if (d.noShow > 0) {
    talkingPoints.push(`${d.noShow} no-show${d.noShow > 1 ? "s" : ""} ontem. Definir na daily quem reagenda cada um ainda hoje.`);
  }

  if (d.yesterday.realized > 0 && d.yesterday.salesCount === 0) {
    talkingPoints.push(`${d.yesterday.realized} reunião(ões) realizada(s) e nenhuma venda. Revisar objeção que travou e o próximo passo agendado de cada uma.`);
  }

  if (d.yesterday.salesValue > 0) {
    talkingPoints.push(`${brl(d.yesterday.salesValue)} fechado ontem em ${d.yesterday.salesCount} venda(s). Reconhecer na daily e destrinchar o que funcionou pra replicar.`);
  }

  if (d.monthTarget > 0) {
    if (forecastAttainment < 100) {
      const gap = d.monthTarget - d.forecast;
      talkingPoints.push(`Forecast fecha o mês em ${forecastAttainment.toFixed(0)}% da meta — faltam ${brl(gap)}. Definir de onde vem: novo lead, reativação de perdido ou upsell de carteira.`);
    } else {
      talkingPoints.push(`Forecast já cobre a meta (${forecastAttainment.toFixed(0)}%). Blindar o pipeline: puxar as datas de fechamento e confirmar quem assina esta semana.`);
    }
  } else {
    talkingPoints.push("Sem meta de vendas cadastrada para o mês — sem meta a daily vira relato. Cadastrar em Metas do CRM.");
  }

  if (d.topCloser) {
    talkingPoints.push(`Destaque do mês: ${d.topCloser.name} com ${brl(d.topCloser.value)}.`);
  }

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="text-foreground">Comercial — o que falar na daily</span>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">
              Resultado de {format(d.refDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Metric
            icon={Users}
            label="Leads"
            value={String(d.yesterday.leads)}
            sub={<Delta value={d.yesterday.leads} avg={d.avg7.leads} />}
            accent="bg-blue-500/10 text-blue-600"
          />
          <Metric
            icon={CalendarCheck}
            label="Agendamentos"
            value={String(d.yesterday.scheduled)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.yesterday.leads > 0 ? `${convLeadSched.toFixed(0)}% dos leads` : "—"}
              </span>
            }
            accent="bg-violet-500/10 text-violet-600"
          />
          <Metric
            icon={Handshake}
            label="Reuniões realizadas"
            value={String(d.yesterday.realized)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.yesterday.scheduled > 0 ? `${convSchedReal.toFixed(0)}% das agendadas` : "—"}
                {d.noShow > 0 ? ` · ${d.noShow} no-show` : ""}
              </span>
            }
            accent="bg-amber-500/10 text-amber-600"
          />
          <Metric
            icon={DollarSign}
            label="Vendas"
            value={brl(d.yesterday.salesValue)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.yesterday.salesCount} venda{d.yesterday.salesCount === 1 ? "" : "s"} no dia
              </span>
            }
            accent="bg-emerald-500/10 text-emerald-600"
          />
          <Metric
            icon={TrendingUp}
            label="Forecast do mês"
            value={brl(d.forecast)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {brl(d.monthSales)} fechado + {brl(d.pipelineWeighted)} ponderado
              </span>
            }
            accent="bg-primary/10 text-primary"
          />
        </div>

        {d.monthTarget > 0 && (
          <div className="p-3 rounded-xl border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Meta do mês: </span>
              <span className="font-semibold">{brl(d.monthTarget)}</span>
              <span className="text-muted-foreground"> · realizado </span>
              <span className="font-semibold">{brl(d.monthSales)}</span>
              <span className="text-muted-foreground"> ({attainment.toFixed(0)}%)</span>
            </div>
            <Badge
              variant="outline"
              className={
                forecastAttainment >= 100
                  ? "border-emerald-500/50 text-emerald-600"
                  : forecastAttainment >= 70
                  ? "border-amber-500/50 text-amber-600"
                  : "border-destructive/50 text-destructive"
              }
            >
              Forecast: {forecastAttainment.toFixed(0)}% da meta
            </Badge>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Pauta sugerida
          </p>
          <ul className="space-y-2">
            {talkingPoints.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommercialDailyBlock;

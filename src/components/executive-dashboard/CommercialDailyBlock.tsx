import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  Clock,
  ExternalLink,
} from "lucide-react";

type Outcome = "realized" | "no_show" | "out_of_icp" | "pending";

interface CallRow {
  leadId: string | null;
  name: string;
  company: string | null;
  time: string;
  outcome: Outcome;
  owner: string | null;
  revenue: string | null;
  brief: string | null;
  value: number;
}

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  time: string;
  pipeline: string | null;
  origin: string | null;
}

interface Data {
  refDate: Date;
  today: Date;
  leadsYesterday: number;
  leadsAvg: number;
  scheduledYesterday: number;
  realizedYesterday: number;
  noShowYesterday: number;
  salesCountYesterday: number;
  salesValueYesterday: number;
  yesterdayCalls: CallRow[];
  todayCalls: CallRow[];
  todayLeads: LeadRow[];
  monthSales: number;
  monthTarget: number;
  forecast: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const previousBusinessDay = (from: Date) => {
  let d = subDays(from, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = subDays(d, 1);
  return d;
};

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const shortBrief = (lead: any): string | null => {
  if (lead?.ai_brief) return String(lead.ai_brief).slice(0, 220);
  const parts: string[] = [];
  if (lead?.segment) parts.push(String(lead.segment));
  if (lead?.main_pain) parts.push(`Dor: ${String(lead.main_pain)}`);
  if (lead?.origin) parts.push(`Origem: ${String(lead.origin)}`);
  if (!parts.length) return null;
  return parts.join(" · ").slice(0, 220);
};

export const CommercialDailyBlock = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const refDate = previousBusinessDay(today);
      const refKey = dayKey(refDate);
      const todayKey = dayKey(today);
      const windowStart = dayKey(subDays(refDate, 9));
      const monthStart = dayKey(startOfMonth(today));
      const monthEnd = dayKey(endOfMonth(today));

      const [{ data: inflowPipes }, { data: exStages }, { data: forecastStages }] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("counts_lead_inflow", true),
        supabase.from("crm_stages").select("id").eq("exclude_from_lead_count", true),
        // mesma definição de forecast do card da tela de Negócios: etapas "Forecast"
        supabase.from("crm_stages").select("id").ilike("name", "%forecast%"),
      ]);
      const inflowIds = (inflowPipes || []).map((p: any) => p.id);
      const pipeNames = new Map((inflowPipes || []).map((p: any) => [p.id, p.name]));
      const exStageIds = new Set((exStages || []).map((s: any) => s.id));
      const forecastStageIds = (forecastStages || []).map((s: any) => s.id);

      const [leadsRes, eventsRes, salesRes, actYRes, actTRes, forecastRes] = await Promise.all([
        inflowIds.length
          ? supabase
              .from("crm_leads")
              .select("id, name, company, stage_id, pipeline_id, origin, created_at")
              .in("pipeline_id", inflowIds)
              .gte("created_at", `${windowStart}T00:00:00`)
              .lte("created_at", `${todayKey}T23:59:59`)
              .order("created_at", { ascending: false })
              .limit(5000)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("crm_meeting_events")
          .select("lead_id, event_type, event_date")
          .gte("event_date", `${windowStart}T00:00:00`)
          .lte("event_date", `${todayKey}T23:59:59`),
        supabase
          .from("crm_sales")
          .select("sale_date, revenue_value, billing_value")
          .gte("sale_date", monthStart)
          .lte("sale_date", monthEnd),
        supabase
          .from("crm_activities")
          .select("id, lead_id, status, scheduled_at")
          .eq("type", "meeting")
          .gte("scheduled_at", `${refKey}T00:00:00`)
          .lte("scheduled_at", `${refKey}T23:59:59`),
        supabase
          .from("crm_activities")
          .select("id, lead_id, status, scheduled_at")
          .eq("type", "meeting")
          .gte("scheduled_at", `${todayKey}T00:00:00`)
          .lte("scheduled_at", `${todayKey}T23:59:59`),
        forecastStageIds.length
          ? supabase.from("crm_leads").select("opportunity_value").in("stage_id", forecastStageIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // ── leads por dia (regra oficial de entrada)
      const leadsByDay: Record<string, number> = {};
      const todayLeads: LeadRow[] = [];
      (leadsRes.data || []).forEach((l: any) => {
        if (l.stage_id && exStageIds.has(l.stage_id)) return;
        const k = String(l.created_at).slice(0, 10);
        leadsByDay[k] = (leadsByDay[k] || 0) + 1;
        if (k === todayKey) {
          todayLeads.push({
            id: l.id,
            name: l.name || "Sem nome",
            company: l.company,
            time: format(new Date(l.created_at), "HH:mm"),
            pipeline: pipeNames.get(l.pipeline_id) || null,
            origin: l.origin || null,
          });
        }
      });

      // ── eventos por dia e por lead
      const schedByDay: Record<string, number> = {};
      const realByDay: Record<string, number> = {};
      const noShowByDay: Record<string, number> = {};
      const outcomeByLead = new Map<string, Outcome>();
      (eventsRes.data || []).forEach((e: any) => {
        const k = String(e.event_date).slice(0, 10);
        if (e.event_type === "scheduled") schedByDay[k] = (schedByDay[k] || 0) + 1;
        if (e.event_type === "realized") realByDay[k] = (realByDay[k] || 0) + 1;
        if (e.event_type === "no_show") noShowByDay[k] = (noShowByDay[k] || 0) + 1;
        if (!e.lead_id) return;
        // prioridade: fora do ICP > no show > realizada
        const current = outcomeByLead.get(e.lead_id);
        if (e.event_type === "out_of_icp" || e.event_type === "realized_out_of_icp") {
          outcomeByLead.set(e.lead_id, "out_of_icp");
        } else if (e.event_type === "no_show" && current !== "out_of_icp") {
          outcomeByLead.set(e.lead_id, "no_show");
        } else if (e.event_type === "realized" && !current) {
          outcomeByLead.set(e.lead_id, "realized");
        }
      });

      // ── vendas
      const salesByDay: Record<string, { n: number; v: number }> = {};
      let monthSales = 0;
      (salesRes.data || []).forEach((s: any) => {
        const v = Number(s.revenue_value) || Number(s.billing_value) || 0;
        const k = String(s.sale_date).slice(0, 10);
        if (!salesByDay[k]) salesByDay[k] = { n: 0, v: 0 };
        salesByDay[k].n += 1;
        salesByDay[k].v += v;
        monthSales += v;
      });

      // ── detalhes dos leads das calls (ontem e hoje)
      const callLeadIds = Array.from(
        new Set(
          [...(actYRes.data || []), ...(actTRes.data || [])]
            .map((a: any) => a.lead_id)
            .filter(Boolean)
        )
      );
      const { data: callLeads } = callLeadIds.length
        ? await supabase
            .from("crm_leads")
            .select(
              "id, name, company, estimated_revenue, main_pain, segment, origin, ai_brief, opportunity_value, owner_staff_id"
            )
            .in("id", callLeadIds)
        : { data: [] as any[] };
      const leadById = new Map((callLeads || []).map((l: any) => [l.id, l]));

      const ownerIds = Array.from(
        new Set((callLeads || []).map((l: any) => l.owner_staff_id).filter(Boolean))
      );
      const { data: owners } = ownerIds.length
        ? await supabase.from("onboarding_staff").select("id, name").in("id", ownerIds)
        : { data: [] as any[] };
      const ownerById = new Map((owners || []).map((o: any) => [o.id, o.name]));

      const buildCalls = (rows: any[], useOutcome: boolean): CallRow[] =>
        rows
          .map((a: any) => {
            const lead = a.lead_id ? leadById.get(a.lead_id) : null;
            let outcome: Outcome = "pending";
            if (useOutcome) {
              outcome = (a.lead_id && outcomeByLead.get(a.lead_id)) || "pending";
              // atividade cancelada sem evento = no show registrado só na atividade
              if (outcome === "pending" && a.status === "cancelled") outcome = "no_show";
              if (outcome === "pending" && a.status === "completed") outcome = "realized";
            }
            return {
              leadId: a.lead_id || null,
              name: lead?.name || "Sem nome",
              company: lead?.company || null,
              time: a.scheduled_at ? format(new Date(a.scheduled_at), "HH:mm") : "--:--",
              outcome,
              owner: lead?.owner_staff_id ? ownerById.get(lead.owner_staff_id) || null : null,
              revenue: lead?.estimated_revenue || null,
              brief: shortBrief(lead),
              value: Number(lead?.opportunity_value) || 0,
            };
          })
          .sort((a, b) => a.time.localeCompare(b.time));

      // ── meta do mês: mesma regra do indicador de vendas
      // (head comercial não soma — a meta dela já é o total do time — e inativo sai)
      const { data: salesGoalType } = await supabase
        .from("crm_goal_types")
        .select("id")
        .eq("name", "Vendas")
        .eq("is_active", true)
        .maybeSingle();

      let monthTarget = 0;
      if (salesGoalType?.id) {
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("staff_id, meta_value")
          .eq("goal_type_id", salesGoalType.id)
          .eq("month", today.getMonth() + 1)
          .eq("year", today.getFullYear());

        const goalStaffIds = (goalValues || []).map((g: any) => g.staff_id);
        const { data: goalStaff } = goalStaffIds.length
          ? await supabase.from("onboarding_staff").select("id, role, is_active").in("id", goalStaffIds)
          : { data: [] as any[] };
        const excluded = new Set(
          (goalStaff || [])
            .filter(
              (s: any) =>
                String(s.role ?? "").toLowerCase() === "head_comercial" || s.is_active === false
            )
            .map((s: any) => s.id)
        );
        monthTarget = (goalValues || [])
          .filter((g: any) => !excluded.has(g.staff_id))
          .reduce((sum: number, g: any) => sum + (Number(g.meta_value) || 0), 0);
      }

      const forecast = (forecastRes.data || []).reduce(
        (s: number, l: any) => s + (Number(l.opportunity_value) || 0),
        0
      );

      // média dos 5 dias úteis anteriores ao dia de referência
      const businessDays: string[] = [];
      let cursor = subDays(refDate, 1);
      while (businessDays.length < 5) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) businessDays.push(dayKey(cursor));
        cursor = subDays(cursor, 1);
      }
      const leadsAvg =
        businessDays.reduce((s, k) => s + (leadsByDay[k] || 0), 0) / businessDays.length;

      setData({
        refDate,
        today,
        leadsYesterday: leadsByDay[refKey] || 0,
        leadsAvg,
        scheduledYesterday: schedByDay[refKey] || 0,
        realizedYesterday: realByDay[refKey] || 0,
        noShowYesterday: noShowByDay[refKey] || 0,
        salesCountYesterday: salesByDay[refKey]?.n || 0,
        salesValueYesterday: salesByDay[refKey]?.v || 0,
        yesterdayCalls: buildCalls(actYRes.data || [], true),
        todayCalls: buildCalls(actTRes.data || [], false),
        todayLeads,
        monthSales,
        monthTarget,
        forecast,
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

  const gap = d.monthTarget - d.monthSales;
  const attainment = d.monthTarget > 0 ? (d.monthSales / d.monthTarget) * 100 : 0;
  const convLeadSched = d.leadsYesterday > 0 ? (d.scheduledYesterday / d.leadsYesterday) * 100 : 0;
  const convSchedReal =
    d.scheduledYesterday > 0 ? (d.realizedYesterday / d.scheduledYesterday) * 100 : 0;

  const outcomeBadge = (o: Outcome) => {
    const map = {
      realized: { label: "Realizada", cls: "border-emerald-500/50 text-emerald-600", Icon: CheckCircle2 },
      no_show: { label: "No show", cls: "border-destructive/50 text-destructive", Icon: XCircle },
      out_of_icp: { label: "Fora do ICP", cls: "border-amber-500/50 text-amber-600", Icon: AlertTriangle },
      pending: { label: "Sem marcação", cls: "border-muted-foreground/40 text-muted-foreground", Icon: CircleDashed },
    }[o];
    return (
      <Badge variant="outline" className={`gap-1 text-[11px] shrink-0 ${map.cls}`}>
        <map.Icon className="h-3 w-3" />
        {map.label}
      </Badge>
    );
  };

  const Delta = ({ value, avg }: { value: number; avg: number }) => {
    if (avg <= 0) return <span className="text-[11px] text-muted-foreground">sem base</span>;
    const diff = ((value - avg) / avg) * 100;
    const flat = Math.abs(diff) < 10;
    const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    const color = flat ? "text-muted-foreground" : diff > 0 ? "text-emerald-600" : "text-destructive";
    return (
      <span className={`text-[11px] flex items-center gap-0.5 ${color}`}>
        <Icon className="h-3 w-3" />
        {diff > 0 ? "+" : ""}
        {diff.toFixed(0)}% vs média ({avg.toFixed(1)})
      </span>
    );
  };

  const Metric = ({ icon: Icon, label, value, sub, accent }: any) => (
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

  const openLead = (leadId: string | null) => {
    if (leadId) navigate(`/crm/leads/${leadId}`);
  };

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="text-foreground">Comercial — pauta da daily</span>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">
              Fechamento de {format(d.refDate, "EEEE, dd/MM", { locale: ptBR })} e agenda de hoje
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* números do dia anterior */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Metric
            icon={Users}
            label="Leads ontem"
            value={String(d.leadsYesterday)}
            sub={<Delta value={d.leadsYesterday} avg={d.leadsAvg} />}
            accent="bg-blue-500/10 text-blue-600"
          />
          <Metric
            icon={CalendarCheck}
            label="Agendamentos"
            value={String(d.scheduledYesterday)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.leadsYesterday > 0 ? `${convLeadSched.toFixed(0)}% dos leads` : "—"}
              </span>
            }
            accent="bg-violet-500/10 text-violet-600"
          />
          <Metric
            icon={Handshake}
            label="Realizadas"
            value={String(d.realizedYesterday)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.scheduledYesterday > 0 ? `${convSchedReal.toFixed(0)}% das agendadas` : "—"}
                {d.noShowYesterday > 0 ? ` · ${d.noShowYesterday} no-show` : ""}
              </span>
            }
            accent="bg-amber-500/10 text-amber-600"
          />
          <Metric
            icon={DollarSign}
            label="Vendas ontem"
            value={brl(d.salesValueYesterday)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.salesCountYesterday} venda{d.salesCountYesterday === 1 ? "" : "s"}
              </span>
            }
            accent="bg-emerald-500/10 text-emerald-600"
          />
          <Metric
            icon={TrendingUp}
            label="Mês"
            value={brl(d.monthSales)}
            sub={
              <span className="text-[11px] text-muted-foreground">
                {d.monthTarget > 0
                  ? `${attainment.toFixed(0)}% da meta de ${brl(d.monthTarget)}`
                  : "sem meta cadastrada"}
              </span>
            }
            accent="bg-primary/10 text-primary"
          />
        </div>

        {d.monthTarget > 0 && (
          <div className="p-3 rounded-xl border bg-muted/30 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Faltam <strong>{brl(Math.max(gap, 0))}</strong> para a meta de {brl(d.monthTarget)}
            </span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Forecast em aberto: {brl(d.forecast)}
            </Badge>
          </div>
        )}

        {/* calls de ontem */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Calls de {format(d.refDate, "dd/MM")} — o que aconteceu
          </p>
          {d.yesterdayCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40">
              Nenhuma reunião agendada nesse dia.
            </p>
          ) : (
            <div className="space-y-1.5">
              {d.yesterdayCalls.map((c, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg border bg-card flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40"
                  onClick={() => openLead(c.leadId)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.time} · {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </p>
                    {c.owner && <p className="text-[11px] text-muted-foreground">Closer: {c.owner}</p>}
                  </div>
                  {outcomeBadge(c.outcome)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* calls de hoje */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Calls de hoje ({format(d.today, "dd/MM")}) — briefing
          </p>
          {d.todayCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40">
              Nenhuma reunião marcada para hoje.
            </p>
          ) : (
            <div className="space-y-2">
              {d.todayCalls.map((c, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.time} · {c.name}
                        {c.company ? ` — ${c.company}` : ""}
                      </p>
                      {c.owner && <p className="text-[11px] text-muted-foreground mt-0.5">Closer: {c.owner}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.value > 0 && (
                        <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-600">
                          {brl(c.value)}
                        </Badge>
                      )}
                      {c.leadId && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLead(c.leadId)}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {c.revenue && (
                    <p className="text-xs mt-1.5">
                      <span className="text-muted-foreground">Faturamento: </span>
                      <span className="font-medium">{c.revenue}</span>
                    </p>
                  )}
                  {c.brief && <p className="text-xs text-muted-foreground mt-1">{c.brief}</p>}
                  {!c.revenue && !c.brief && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Sem briefing preenchido — pedir ao SDR antes da call.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* leads entrantes hoje */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Leads que entraram hoje ({d.todayLeads.length})
          </p>
          {d.todayLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/40">
              Nenhum lead novo até agora.
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {d.todayLeads.slice(0, 12).map((l) => (
                <div
                  key={l.id}
                  className="p-2 rounded-lg border bg-card flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate(`/crm/leads/${l.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      {l.time} · {l.name}
                      {l.company ? ` — ${l.company}` : ""}
                    </p>
                  </div>
                  {l.pipeline && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {l.pipeline}
                    </Badge>
                  )}
                </div>
              ))}
              {d.todayLeads.length > 12 && (
                <p className="text-xs text-muted-foreground p-2">
                  +{d.todayLeads.length - 12} lead(s) além dos mostrados
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommercialDailyBlock;

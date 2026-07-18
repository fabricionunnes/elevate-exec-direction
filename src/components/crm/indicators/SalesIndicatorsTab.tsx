import { useEffect, useMemo, useState, lazy, Suspense } from "react";

// Card 3D das flags do time (three.js) — lazy pra não pesar o bundle do CRM
const CRMTeamFlags3D = lazy(() => import("@/components/crm/CRMTeamFlags3D"));
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, getDaysInMonth, getDate, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Target, Phone, TrendingUp, DollarSign, Percent, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";
import { ImportSalesDialog } from "@/components/crm/ImportSalesDialog";
import { TermVisionChart } from "@/components/crm/reports/TermVisionChart";

interface CloserMetrics {
  id: string;
  name: string;
  callsScheduled: number;
  callsCompleted: number;
  salesQty: number;
  revenue: number;
  metaPercent: number;
  conversion: number;
  ticketMedio: number;
}

interface SaleRecord {
  id: string;
  saleDate: string;
  pipeline: string;
  closer: string;
  closerId: string;
  sdr: string;
  company: string;
  product: string;
  revenue: number;
}

interface ForecastRecord {
  id: string;
  day: number;
  closer: string;
  closerId: string;
  client: string;
  status: string;
  product: string;
  value: number;
}

type DateFilterType = "today" | "week" | "month" | "quarter" | "custom";

interface SalesIndicatorsTabProps {
  staffId?: string | null;
  staffRole?: string | null;
}

// Busca TODAS as linhas paginando de 1000 em 1000. Sem isso o PostgREST corta
// em 1000 e as métricas (vendas, reuniões, forecast sobre 110k+ leads) truncam em silêncio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T = any>(buildQuery: () => any): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // Trava de segurança: no máximo 50 páginas (50k linhas)
  for (let page = 0; page < 50; page++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function FunnelBarList({ title, data, fmt, color }: { title: string; data: { name: string; value: number }[]; fmt: (v: number) => string; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Sem dados no período</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((d) => (
            <div key={d.name} className="grid items-center gap-2" style={{ gridTemplateColumns: "minmax(70px,120px) 1fr auto" }}>
              <span className="text-xs font-medium text-foreground truncate" title={d.name}>{d.name}</span>
              <div className="h-5 rounded-md bg-muted overflow-hidden" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.18)" }}>
                <div className="h-full rounded-md" style={{ width: `${Math.max(6, (d.value / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}cc)`, boxShadow: `0 2px 5px -1px ${color}66, inset 0 1px 0 rgba(255,255,255,.4)` }} />
              </div>
              <span className="text-xs font-extrabold text-foreground tabular-nums text-right">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const SalesIndicatorsTab = ({ staffId, staffRole }: SalesIndicatorsTabProps = {}) => {
  const isCloserUser = staffRole === "closer";
  const isAdmin = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";
  const [loading, setLoading] = useState(true);
  const [selectedCloser, setSelectedCloser] = useState<string>(isCloserUser && staffId ? staffId : "all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilterType>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  
  // Raw data state (fetched from DB, unfiltered)
  const [rawSalesData, setRawSalesData] = useState<any[]>([]);
  const [rawMeetingEvents, setRawMeetingEvents] = useState<any[]>([]);
  const [rawCalls, setRawCalls] = useState<any[]>([]);
  const [rawForecastData, setRawForecastData] = useState<any[]>([]);
  const [rawNegotiationData, setRawNegotiationData] = useState<any[]>([]);
  const [rawCloserStaff, setRawCloserStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffGoalsMap, setStaffGoalsMap] = useState<Map<string, { meta: number; super: number; hiper: number }>>(new Map());
  const [totalGoals, setTotalGoals] = useState({ meta: 0, super: 0, hiper: 0 });
  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(new Date()));
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(new Date()));
  const [callStats, setCallStats] = useState({ total: 0, discador: 0, avulsa: 0, atendidas: 0 });
  const [dialerCostBrl, setDialerCostBrl] = useState(0);
  // Reuniões/vendas atribuídas AO DISCADOR (não o CRM todo) — pra CAC e custos por reunião
  const [dialerOutcomes, setDialerOutcomes] = useState({ scheduled: 0, realized: 0, sales: 0 });
  const [callsByCloser, setCallsByCloser] = useState<Record<string, { total: number; atendidas: number }>>({});

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "custom":
        return { 
          start: customDateFrom || startOfMonth(now), 
          end: customDateTo || endOfMonth(now) 
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  // Ligações (discador + avulsa) no período/closer selecionado
  useEffect(() => {
    let active = true;
    (async () => {
      const { start, end } = getDateRange();
      const base = () => {
        let q = supabase.from("crm_calls").select("*", { count: "exact", head: true })
          .is("tenant_id", null) // só ligações da UNV, não dos clientes
          .gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
        if (selectedCloser !== "all") q = q.eq("agent_staff_id", selectedCloser);
        return q;
      };
      const [tot, disc, avul, ans, byAgent] = await Promise.all([
        base(),
        base().not("campaign_id", "is", null),
        base().is("campaign_id", null),
        base().eq("answered_by", "human"),
        supabase.rpc("crm_calls_by_agent", { p_start: start.toISOString(), p_end: end.toISOString() }),
      ]);
      if (!active) return;
      setCallStats({ total: tot.count || 0, discador: disc.count || 0, avulsa: avul.count || 0, atendidas: ans.count || 0 });
      // Custo do discador (gasto Twilio) no período, em BRL — pra CAC e custo por reunião
      try {
        const days = Math.min(370, Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000) + 1));
        const { data: usage } = await supabase.functions.invoke("dialer-usage", { body: { days } });
        if (active && usage) {
          const recs = (usage as any).records || [];
          const sinceStr = start.toISOString().slice(0, 10);
          const untilStr = end.toISOString().slice(0, 10);
          const spend = recs.length
            ? recs.filter((r: any) => r.date >= sinceStr && r.date <= untilStr).reduce((a: number, r: any) => a + (r.spend || 0), 0)
            : ((usage as any).total || 0);
          const rate = (usage as any).brlRate || 0;
          const brl = (usage as any).currency === "USD" ? spend * rate : spend;
          setDialerCostBrl(brl);
        }
      } catch { /* sem custo */ }
      // Reuniões/vendas atribuídas ao discador no período (agendou/realizada/venda das ligações)
      try {
        const { data: oc } = await (supabase as any).rpc("dialer_outcome_metrics", { p_since: start.toISOString(), p_until: end.toISOString() });
        const r: any = Array.isArray(oc) ? oc[0] : oc;
        if (active && r) setDialerOutcomes({ scheduled: r.meetings_scheduled || 0, realized: r.meetings_realized || 0, sales: r.sales_won || 0 });
        else if (active) setDialerOutcomes({ scheduled: 0, realized: 0, sales: 0 });
      } catch { /* sem outcomes */ }
      const map: Record<string, { total: number; atendidas: number }> = {};
      ((byAgent.data as any[]) || []).forEach((r) => { map[r.agent_staff_id] = { total: Number(r.total) || 0, atendidas: Number(r.atendidas) || 0 }; });
      setCallsByCloser(map);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customDateFrom, customDateTo, selectedCloser]);

  useEffect(() => {
    loadData();
    loadProducts();
  }, [dateFilter, customDateFrom, customDateTo]);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("crm_products")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    
    setProducts(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start: filterStart, end: filterEnd } = getDateRange();
      setFilterStartDate(filterStart);
      setFilterEndDate(filterEnd);
      const filterMonth = filterStart.getMonth() + 1;
      const filterYear = filterStart.getFullYear();

      // Load closers (staff with closer role who have CRM access)
      const { data: crmAccessData } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");
      
      const crmStaffIds = new Set((crmAccessData || []).map(a => a.staff_id));

      const { data: allActiveStaff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, is_crm_closer")
        .eq("is_active", true);

      // head_comercial NÃO entra na base do ranking (não é closer individual). Só aparece
      // se tiver venda/reunião no período, via a expansão abaixo.
      const allowedCloserRoles = new Set(["closer"]);
      const filteredCloserStaff = (allActiveStaff || []).filter(staff => {
        const role = String((staff as any).role ?? "").toLowerCase();
        if (role === "head_comercial") return false;
        // Flag manual "closer no CRM" entra direto; senão precisa do role + acesso ao CRM.
        return (staff as any).is_crm_closer || (crmStaffIds.has(staff.id) && allowedCloserRoles.has(role));
      });
      // Base list (closers/head_comercial). Será expandido abaixo com qualquer staff
      // que tenha tido agendamento/realização de reunião ou venda no período,
      // mesmo sem o role de closer.
      const baseCloserStaff = filteredCloserStaff.map(s => ({ id: s.id, name: s.name }));
      const allStaffMap = new Map((allActiveStaff || []).map(s => [s.id, { id: s.id, name: s.name }]));
      // Roles que NUNCA devem aparecer no Desempenho dos Closers (são pré-vendas)
      const excludedRolesFromClosers = new Set(["sdr", "social_setter", "bdr"]);
      const staffRoleMap = new Map(
        (allActiveStaff || []).map(s => [s.id, String((s as any).role ?? "").toLowerCase()])
      );

      // Load scheduled calls (paginado — evita corte de 1000)
      const calls = await fetchAllRows(() =>
        supabase
          .from("crm_scheduled_calls")
          .select(`
            *,
            scheduled_by_staff:onboarding_staff!crm_scheduled_calls_scheduled_by_fkey(id, name),
            assigned_to_staff:onboarding_staff!crm_scheduled_calls_assigned_to_fkey(id, name)
          `)
          .gte("scheduled_at", filterStart.toISOString())
          .lte("scheduled_at", filterEnd.toISOString())
      );
      setRawCalls(calls);

      // Load meeting events (include lead owner for closer attribution) — paginado
      const meetingEvents = await fetchAllRows(() =>
        supabase
          .from("crm_meeting_events")
          .select(`
            *,
            credited_staff:onboarding_staff!crm_meeting_events_credited_staff_id_fkey(id, name),
            lead:crm_leads!crm_meeting_events_lead_id_fkey(id, owner_staff_id)
          `)
          .gte("event_date", filterStart.toISOString())
          .lte("event_date", filterEnd.toISOString())
      );
      setRawMeetingEvents(meetingEvents);

      const { data: pipelinesData } = await supabase.from("crm_pipelines").select("id, name").order("name");
      setPipelines(pipelinesData || []);

      // Load sales — paginado
      const salesData = await fetchAllRows(() =>
        supabase
          .from("crm_sales")
          .select(`
            *,
            closer:onboarding_staff!crm_sales_closer_staff_id_fkey(id, name),
            sdr:onboarding_staff!crm_sales_sdr_staff_id_fkey(id, name),
            pipeline:crm_pipelines(id, name),
            product:crm_products(id, name),
            lead:crm_leads(id, name, company)
          `)
          .gte("sale_date", format(filterStart, "yyyy-MM-dd"))
          .lte("sale_date", format(filterEnd, "yyyy-MM-dd"))
      );
      setRawSalesData(salesData);

      // Expand "closers" list with anyone who has scheduled/realized meetings
      // or sales in the period — even without the "closer" role.
      const expandedCloserMap = new Map(baseCloserStaff.map(s => [s.id, s]));
      (meetingEvents || []).forEach((ev: any) => {
        // Crédito vai para o RESPONSÁVEL do lead (owner), não para quem deu baixa.
        const sid = ev.lead?.owner_staff_id;
        if (!sid || expandedCloserMap.has(sid)) return;
        if (excludedRolesFromClosers.has(staffRoleMap.get(sid) || "")) return;
        const staffInfo = allStaffMap.get(sid);
        if (staffInfo) expandedCloserMap.set(sid, staffInfo);
      });
      (salesData || []).forEach((s: any) => {
        const sid = s.closer_staff_id;
        if (!sid || expandedCloserMap.has(sid)) return;
        // Quem tem VENDA no período aparece no desempenho — inclusive SDR/BDR
        // (a exclusão por papel vale só pra reuniões, senão agendamento de SDR
        // poluiria o ranking; venda é venda, de quem quer que seja).
        const staffInfo = allStaffMap.get(sid) || (s.closer ? { id: sid, name: s.closer.name } : null);
        if (staffInfo) expandedCloserMap.set(sid, staffInfo);
      });
      setRawCloserStaff(Array.from(expandedCloserMap.values()));

      // Load forecasts from leads in "Forecast" stages across all pipelines
      const { data: forecastStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%forecast%");

      if (forecastStages && forecastStages.length > 0) {
        const forecastStageIds = forecastStages.map(s => s.id);
        const forecastLeads = await fetchAllRows(() =>
          supabase
            .from("crm_leads")
            .select("id, name, company, opportunity_value, owner_staff_id, stage_id, pipeline_id")
            .in("stage_id", forecastStageIds)
        );
        setRawForecastData(forecastLeads);
      } else {
        setRawForecastData([]);
      }

      // Load "Em Negociação" from leads em stages de negociação (antes buscava "%realizada%",
      // que casava com "Reunião realizada" e não com "Em negociação"/"Negociação").
      const { data: negociacaoStages } = await supabase
        .from("crm_stages")
        .select("id")
        .ilike("name", "%negocia%");

      if (negociacaoStages && negociacaoStages.length > 0) {
        const negociacaoStageIds = negociacaoStages.map(s => s.id);
        const negotiationLeads = await fetchAllRows(() =>
          supabase
            .from("crm_leads")
            .select("id, name, company, opportunity_value, owner_staff_id, stage_id, pipeline_id")
            .in("stage_id", negociacaoStageIds)
        );
        setRawNegotiationData(negotiationLeads);
      } else {
        setRawNegotiationData([]);
      }

      // Load goals
      const { data: goalTypeData } = await supabase
        .from("crm_goal_types")
        .select("id")
        .eq("name", "Vendas")
        .eq("is_active", true)
        .single();

      const goalsMap = new Map<string, { meta: number; super: number; hiper: number }>();
      let totalMeta = 0, totalSuper = 0, totalHiper = 0;

      if (goalTypeData?.id) {
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("*")
          .eq("goal_type_id", goalTypeData.id)
          .eq("month", filterMonth)
          .eq("year", filterYear);

        if (goalValues && goalValues.length > 0) {
          goalValues.forEach(g => {
            goalsMap.set(g.staff_id, {
              meta: g.meta_value || 0,
              super: g.super_meta_value || 0,
              hiper: g.hiper_meta_value || 0,
            });
          });
          // Head Comercial e staff INATIVO NÃO entram na meta do time:
          // - head: a meta dela JÁ é a soma dos closers (somar de novo = double-count).
          // - inativo: quem saiu/foi desativado não conta no total do mês.
          // Busca o cargo/ativo direto (allActiveStaff não traz inativos, e era por isso
          // que a head inativa escapava e dobrava a meta).
          const goalStaffIds = goalValues.map((g) => g.staff_id);
          const { data: goalStaffRows } = await supabase
            .from("onboarding_staff")
            .select("id, role, is_active")
            .in("id", goalStaffIds);
          const excludeIds = new Set(
            (goalStaffRows || [])
              .filter((s: any) => String(s.role ?? "").toLowerCase() === "head_comercial" || s.is_active === false)
              .map((s: any) => s.id),
          );
          const teamGoals = goalValues.filter((g) => !excludeIds.has(g.staff_id));
          totalMeta = teamGoals.reduce((sum, g) => sum + (g.meta_value || 0), 0);
          totalSuper = teamGoals.reduce((sum, g) => sum + (g.super_meta_value || 0), 0);
          totalHiper = teamGoals.reduce((sum, g) => sum + (g.hiper_meta_value || 0), 0);
        }
      }
      setStaffGoalsMap(goalsMap);
      setTotalGoals({ meta: totalMeta, super: totalSuper, hiper: totalHiper });

    } catch (error) {
      console.error("Error loading sales indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived / filtered metrics ──
  const computed = useMemo(() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(filterStartDate);
    // Dia limite dos gráficos diários DEVE respeitar o filtro. A x-axis é do
    // mês inicial: se o fim efetivo (min entre fim do filtro e hoje) já passou
    // desse mês, mostra o mês inteiro; se está no próprio mês, para no dia dele;
    // período totalmente futuro fica zerado.
    const periodFuture = filterStartDate > endOfMonth(now);
    const effectiveEnd = filterEndDate < now ? filterEndDate : now;
    const sameMonthAsStart =
      effectiveEnd.getMonth() === filterStartDate.getMonth() &&
      effectiveEnd.getFullYear() === filterStartDate.getFullYear();
    const currentDay = periodFuture ? 0 : (sameMonthAsStart ? getDate(effectiveEnd) : daysInMonth);
    const isCloserFilter = selectedCloser !== "all";

    // Todas as vendas contam, INCLUSIVE as de evento (Mansão, Imersão, Palestra,
    // Eventos) — decisão do Fabrício: faturamento de evento entra no dashboard.
    const commercialRawSales = rawSalesData;

    // Filter raw data by selected closer + produto (filtro de produto antes era morto;
    // vendas carregam product_name livre, não product_id — então filtra por nome).
    const productFilter = selectedProduct !== "all";
    const isPipelineFilter = selectedPipeline !== "all";
    const salesData = commercialRawSales.filter(s =>
      (!isCloserFilter || s.closer_staff_id === selectedCloser) &&
      (!productFilter || (s.product?.name || s.product_name) === selectedProduct) &&
      (!isPipelineFilter || s.pipeline_id === selectedPipeline)
    );

    const uniqueMeetingEvents = (() => {
      const seen = new Set<string>();
      return rawMeetingEvents.filter((event) => {
        // Use credited_staff_id directly - each staff member gets their own event
        const key = `${event.lead_id}-${event.event_type}-${event.credited_staff_id || "unassigned"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })();

    // Filter meeting events by credited_staff_id for the selected closer + funil
    const meetingEvents = (isCloserFilter
      ? uniqueMeetingEvents.filter(e => e.credited_staff_id === selectedCloser)
      : uniqueMeetingEvents
    ).filter(e => !isPipelineFilter || e.pipeline_id === selectedPipeline);

    const calls = isCloserFilter
      ? rawCalls.filter(c => c.assigned_to === selectedCloser)
      : rawCalls;

    const forecastData = (isCloserFilter
      ? rawForecastData.filter(f => f.owner_staff_id === selectedCloser)
      : rawForecastData
    ).filter(f => !isPipelineFilter || f.pipeline_id === selectedPipeline);

    const negotiationData = (isCloserFilter
      ? rawNegotiationData.filter(f => f.owner_staff_id === selectedCloser)
      : rawNegotiationData
    ).filter(f => !isPipelineFilter || f.pipeline_id === selectedPipeline);

    // Goals: use closer-specific or total
    let metaReceita: number, superMeta: number, hiperMeta: number;
    if (isCloserFilter) {
      const closerGoal = staffGoalsMap.get(selectedCloser);
      metaReceita = closerGoal?.meta || 0;
      superMeta = closerGoal?.super || 0;
      hiperMeta = closerGoal?.hiper || 0;
    } else {
      metaReceita = totalGoals.meta;
      superMeta = totalGoals.super;
      hiperMeta = totalGoals.hiper;
    }

    // Sales metrics
    const totalRevenue = salesData.reduce((sum, s) => sum + (s.revenue_value || 0), 0);
    const totalSales = salesData.length;
    const ticketMedio = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Reuniões do card de cima:
    // - Filtrando um closer: conta as reuniões dos LEADS DELE (por dono no momento
    //   do evento), IGUAL à tabela "Desempenho dos Closers". Antes usava
    //   credited_staff_id (só o que ele agendou/deu baixa pessoalmente) e divergia
    //   da tabela — mostrava, ex., 1 agendada em vez das 8 dos leads dele.
    // - Sem filtro (gestão): total do time, deduplicado por lead.
    let totalScheduled: number, totalCompleted: number, totalNoShow: number;
    if (isCloserFilter) {
      const seen = new Set<string>();
      const ownerEvents = rawMeetingEvents.filter((ev: any) => {
        const ownerId = ev.owner_staff_id || ev.lead?.owner_staff_id;
        if (ownerId !== selectedCloser) return false;
        if (isPipelineFilter && ev.pipeline_id !== selectedPipeline) return false;
        const key = `${ev.lead_id}-${ev.event_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      totalScheduled = ownerEvents.filter((e: any) => e.event_type === "scheduled").length;
      totalCompleted = ownerEvents.filter((e: any) => e.event_type === "realized").length;
      totalNoShow = ownerEvents.filter((e: any) => e.event_type === "no_show").length;
    } else {
      const seen = new Set<string>();
      const uniqueByLeadEvents = meetingEvents.filter((event) => {
        const key = `${event.lead_id}-${event.event_type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      totalScheduled = uniqueByLeadEvents.filter(e => e.event_type === "scheduled").length;
      totalCompleted = uniqueByLeadEvents.filter(e => e.event_type === "realized").length;
      totalNoShow = uniqueByLeadEvents.filter(e => e.event_type === "no_show").length;
    }

    const noShowPercent = totalScheduled > 0 ? (totalNoShow / totalScheduled) * 100 : 0;
    const conversion = totalCompleted > 0 ? (totalSales / totalCompleted) * 100 : 0;

    // Projection
    const dailyAvg = currentDay > 0 ? totalRevenue / currentDay : 0;
    const projectedRevenue = dailyAvg * daysInMonth;
    const projectedPercent = metaReceita > 0 ? (projectedRevenue / metaReceita) * 100 : 0;

    // Forecast
    const forecastTotal = forecastData.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);

    // Em Negociação
    const negotiationTotal = negotiationData.reduce((sum, f) => sum + (f.opportunity_value || 0), 0);

    const metrics = {
      metaReceita,
      receita: totalRevenue,
      faltaReceita: Math.max(0, metaReceita - totalRevenue),
      vendas: totalSales,
      ticketMedio,
      qtr: 0,
      conversao: conversion,
      superMeta,
      hiperMeta,
      faltaSuper: Math.max(0, superMeta - totalRevenue),
      faltaHiper: Math.max(0, hiperMeta - totalRevenue),
      forecast: forecastTotal,
      emNegociacao: negotiationTotal,
      projecaoReceita: projectedRevenue,
      projecaoPercent: projectedPercent,
    };

    const callsMetrics = {
      agendadas: totalScheduled,
      realizadas: totalCompleted,
      noShowPercent,
    };

    // Daily goal
    const businessDaysLeft = getRemainingBusinessDaysInMonth(now);
    const remaining = Math.max(0, metaReceita - totalRevenue);
    const dailyTarget = businessDaysLeft > 0 ? remaining / businessDaysLeft : 0;

    const dailyGoal = {
      monthlyTarget: metaReceita,
      achieved: totalRevenue,
      remaining,
      businessDaysLeft,
      dailyTarget,
    };

    // Closer metrics table (sempre mostra todos os closers).
    // Crédito de agendamento/realização vai para o RESPONSÁVEL do lead (owner),
    // não para quem deu baixa/agendou (credited_staff_id pode ser SDR ou outro).
    // Deduplicamos por (lead_id, event_type) para não contar a mesma reunião 2x
    // quando houver múltiplos credited (ex.: SDR + Closer).
    const eventsByOwner = (() => {
      const seen = new Set<string>();
      const list: any[] = [];
      rawMeetingEvents.forEach((ev: any) => {
        // owner_staff_id = responsável NO MOMENTO do evento (snapshot). Trocar o
        // dono do lead depois NÃO move a reunião realizada de closer.
        const ownerId = ev.owner_staff_id || ev.lead?.owner_staff_id;
        if (!ownerId) return;
        const key = `${ev.lead_id}-${ev.event_type}-${ownerId}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ ...ev, owner_id: ownerId });
      });
      return list;
    })();

    const closerMetrics: CloserMetrics[] = rawCloserStaff.map(closer => {
      const closerSales = commercialRawSales.filter(s => s.closer_staff_id === closer.id && (selectedProduct === "all" || (s.product?.name || s.product_name) === selectedProduct));
      const closerRevenue = closerSales.reduce((sum, s) => sum + (s.revenue_value || 0), 0);
      const closerMeetingEvents = eventsByOwner.filter(e => e.owner_id === closer.id);
      const closerScheduled = closerMeetingEvents.filter(e => e.event_type === "scheduled").length;
      const closerCompleted = closerMeetingEvents.filter(e => e.event_type === "realized").length;

      const closerGoal = staffGoalsMap.get(closer.id);
      const closerMeta = closerGoal?.meta || (totalGoals.meta / (rawCloserStaff.length || 1));

      return {
        id: closer.id,
        name: closer.name,
        callsScheduled: closerScheduled,
        callsCompleted: closerCompleted,
        salesQty: closerSales.length,
        revenue: closerRevenue,
        metaPercent: closerMeta > 0 ? (closerRevenue / closerMeta) * 100 : 0,
        conversion: closerCompleted > 0 ? (closerSales.length / closerCompleted) * 100 : 0,
        ticketMedio: closerSales.length > 0 ? closerRevenue / closerSales.length : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue); // ranking por receita (1º = maior; troféu vai pro topo)

    // Closer NÃO vê histórico dos outros vendedores: ranking/pódio/tabela/gráfico
    // por closer ficam restritos à própria linha. Gestão (admin/master/head) vê todos.
    const visibleCloserMetrics = isCloserUser && staffId
      ? closerMetrics.filter(c => c.id === staffId)
      : closerMetrics;

    // Sales records (filtered)
    const salesRecords: SaleRecord[] = salesData.map(s => ({
      id: s.id,
      saleDate: format(new Date(s.sale_date), "dd"),
      pipeline: s.pipeline?.name || "-",
      closer: s.closer?.name || "-",
      closerId: s.closer_staff_id || "",
      sdr: s.sdr?.name || "-",
      company: s.lead?.company || s.lead?.name || "-",
      product: s.product?.name || s.product_name || "-",
      revenue: s.revenue_value || 0,
    }));

    // Forecast records (filtered)
    const forecastRecords: ForecastRecord[] = forecastData.map(f => {
      const closerInfo = rawCloserStaff.find(s => s.id === f.owner_staff_id);
      return {
        id: f.id,
        day: 0,
        closer: closerInfo?.name || "-",
        closerId: f.owner_staff_id || "",
        client: f.name || f.company || "-",
        status: "open",
        product: "-",
        value: f.opportunity_value || 0,
      };
    });

    // Daily revenue accumulation (always per closer for chart)
    const dailyRevenueData: { day: number; [key: string]: number }[] = [];
    const closerNames = visibleCloserMetrics.map(c => c.name);
    for (let day = 1; day <= currentDay; day++) {
      const dayData: { day: number; [key: string]: number } = { day };
      closerNames.forEach(name => {
        const closerDayRevenue = commercialRawSales
          .filter(s => {
            const saleDay = getDate(new Date(s.sale_date));
            return saleDay <= day && s.closer?.name === name;
          })
          .reduce((sum, s) => sum + (s.revenue_value || 0), 0);
        dayData[name] = closerDayRevenue;
      });
      dailyRevenueData.push(dayData);
    }

    // Revenue evolution (filtered)
    const revenueByDay: Record<number, number> = {};
    salesData.forEach(s => {
      const saleDay = parseInt(s.sale_date.split('-')[2], 10);
      revenueByDay[saleDay] = (revenueByDay[saleDay] || 0) + (s.revenue_value || 0);
    });

    const revenueEvolution: { day: number; meta: number; receita: number | null; super: number; hiper: number }[] = [];
    let accumulatedRevenue = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (day <= currentDay) {
        accumulatedRevenue += (revenueByDay[day] || 0);
      }
      revenueEvolution.push({
        day,
        meta: (metaReceita / daysInMonth) * day,
        receita: day <= currentDay ? accumulatedRevenue : null,
        super: (superMeta / daysInMonth) * day,
        hiper: (hiperMeta / daysInMonth) * day,
      });
    }

    // Product distribution (filtered)
    const productGroups: Record<string, number> = {};
    salesData.forEach(s => {
      const productName = s.product?.name || s.product_name || "Outros";
      productGroups[productName] = (productGroups[productName] || 0) + (s.revenue_value || 0);
    });
    const colors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    const productDistribution = Object.entries(productGroups).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));

    return {
      metrics,
      callsMetrics,
      dailyGoal,
      closerMetrics: visibleCloserMetrics,
      salesRecords,
      forecastRecords,
      dailyRevenueData,
      revenueEvolution,
      productDistribution,
    };
  }, [selectedCloser, selectedProduct, selectedPipeline, rawSalesData, rawMeetingEvents, rawCalls, rawForecastData, rawNegotiationData, rawCloserStaff, staffGoalsMap, totalGoals, filterStartDate, filterEndDate]);

  // Produtos que realmente aparecem nas vendas do período (o dropdown antes vinha de
  // crm_products e não casava com o product_name livre das vendas).
  const productOptions = useMemo(() => {
    const set = new Set<string>();
    rawSalesData.forEach((s: any) => {
      const name = s.product?.name || s.product_name;
      if (name && String(name).trim()) set.add(String(name).trim());
    });
    return Array.from(set).sort();
  }, [rawSalesData]);

  // Agregações POR FUNIL (respeita closer/produto/período; mostra todos os funis)
  const funnelBreakdown = useMemo(() => {
    const pipeName: Record<string, string> = {};
    pipelines.forEach((p) => { pipeName[p.id] = p.name; });
    const cl = selectedCloser !== "all";
    const pr = selectedProduct !== "all";
    const salesMap: Record<string, number> = {};
    rawSalesData.forEach((s: any) => {
      if (cl && s.closer_staff_id !== selectedCloser) return;
      if (pr && (s.product?.name || s.product_name) !== selectedProduct) return;
      const name = s.pipeline?.name || "Sem funil";
      salesMap[name] = (salesMap[name] || 0) + (s.revenue_value || 0);
    });
    const schedMap: Record<string, number> = {};
    const realMap: Record<string, number> = {};
    const seen = new Set<string>();
    rawMeetingEvents.forEach((ev: any) => {
      if (cl && ev.credited_staff_id !== selectedCloser) return;
      const key = `${ev.lead_id}-${ev.event_type}`;
      if (seen.has(key)) return; seen.add(key);
      const name = pipeName[ev.pipeline_id] || "Sem funil";
      if (ev.event_type === "scheduled") schedMap[name] = (schedMap[name] || 0) + 1;
      else if (ev.event_type === "realized") realMap[name] = (realMap[name] || 0) + 1;
    });
    const toArr = (m: Record<string, number>) =>
      Object.entries(m).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    return { sales: toArr(salesMap), scheduled: toArr(schedMap), realized: toArr(realMap) };
  }, [pipelines, rawSalesData, rawMeetingEvents, selectedCloser, selectedProduct]);

  const { metrics, callsMetrics, dailyGoal, closerMetrics: closers, salesRecords: sales, forecastRecords: forecasts, dailyRevenueData, revenueEvolution, productDistribution } = computed;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      const val = value / 1000000;
      return `R$ ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mi`;
    }
    if (value >= 1000) {
      const val = value / 1000;
      return `R$ ${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mil`;
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const metaPercent = metrics.metaReceita > 0 ? (metrics.receita / metrics.metaReceita) * 100 : 0;
  const superPercent = metrics.superMeta > 0 ? (metrics.receita / metrics.superMeta) * 100 : 0;
  const hiperPercent = metrics.hiperMeta > 0 ? (metrics.receita / metrics.hiperMeta) * 100 : 0;

  const getProgressColor = (pct: number) =>
    pct >= 100 ? "from-emerald-400 to-emerald-600" : pct >= 70 ? "from-amber-400 to-amber-600" : "from-rose-400 to-rose-600";

  // Card limpo (sem glow/escala) — visual profissional e sóbrio
  const GlowCard = ({ children, className = "" }: { children: React.ReactNode; className?: string; gradient?: string; glowColor?: string }) => (
    <div className={cn("relative rounded-lg border border-border/60 bg-card overflow-hidden transition-colors hover:border-border", className)}>
      {children}
    </div>
  );

  // Cor por grupo (categoria) — separa/une os cards e dá leitura semântica
  const TONE = { green: "#34d399", blue: "#60a5fa", violet: "#a78bfa", amber: "#fbbf24" };
  const Section = ({ tone, label, children, cols }: { tone: string; label: string; children: React.ReactNode; cols?: string }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: `${tone}2e`, background: `${tone}0d` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: tone }}>{label}</span>
      </div>
      <div className={cn("grid gap-3", cols || "grid-cols-2 sm:grid-cols-3")}>{children}</div>
    </div>
  );
  const Metric = ({ tone, label, value, color }: { tone: string; label: string; value: string | number; color?: string }) => (
    <div className="rounded-lg border bg-card p-4" style={{ borderColor: `${tone}26` }}>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold mt-1.5 tabular-nums" style={color ? { color } : undefined}>{value}</p>
    </div>
  );

  return (
    <>
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
          <SelectTrigger className="w-[130px] h-9 rounded-xl text-xs border-border ">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[120px] justify-start text-left text-xs rounded-xl border-border", !customDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {customDateFrom ? format(customDateFrom, "dd/MM/yy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus locale={ptBR} /></PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[120px] justify-start text-left text-xs rounded-xl border-border", !customDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {customDateTo ? format(customDateTo, "dd/MM/yy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus locale={ptBR} /></PopoverContent>
            </Popover>
          </div>
        )}
        
        {!isCloserUser && (
          <Select value={selectedCloser} onValueChange={setSelectedCloser}>
            <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-border ">
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Closers</SelectItem>
              {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-border ">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {productOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl text-xs border-border ">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Funis</SelectItem>
            {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-foreground border-border bg-card capitalize">
            {dateFilter === "custom" && customDateFrom && customDateTo
              ? `${format(customDateFrom, "dd/MM")} - ${format(customDateTo, "dd/MM/yyyy")}`
              : format(getDateRange().start, "MMMM 'de' yyyy", { locale: ptBR })}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="h-9 text-xs rounded-xl border-border bg-card/80">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
        </div>
      </div>

      {/* ── Ranking dos Closers (Top 3) ── */}
      {closers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {closers.slice(0, 3).map((closer, index) => (
            <div key={closer.id} className="rounded-lg border bg-card p-4" style={index === 0 ? { borderColor: "#f5b50a55", borderLeft: "3px solid #f5b50a", background: "#f5b50a0d" } : { borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold shrink-0" style={index === 0 ? { background: "#f5b50a22", color: "#f5b50a" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{index + 1}</span>
                <p className="text-sm font-medium truncate">{closer.name}</p>
                {index === 0 && <Trophy className="h-3.5 w-3.5 ml-auto shrink-0" style={{ color: "#f5b50a" }} />}
              </div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(closer.revenue)}</p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                <span>TM <span className="text-foreground font-medium">{formatCurrency(closer.ticketMedio)}</span></span>
                <span>Conv <span className="text-foreground font-medium">{closer.conversion.toFixed(1)}%</span></span>
                <span>Lig <span className="text-foreground font-medium">{callsByCloser[closer.id]?.total || 0}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Resultados (verde) ── */}
      <Section tone={TONE.green} label="Resultados" cols="grid-cols-1 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4" style={{ borderColor: `${TONE.green}33` }}>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Receita</p>
          <p className="text-2xl font-semibold mt-1 tabular-nums" style={{ color: TONE.green }}>{formatCurrency(metrics.receita)}</p>
          <div className="h-1.5 bg-muted rounded-full mt-2.5 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, metaPercent)}%`, background: TONE.green }} /></div>
          <p className="text-[10px] text-muted-foreground mt-1">{metaPercent.toFixed(0)}% da meta</p>
        </div>
        <Metric tone={TONE.green} label="Meta do mês" value={formatCurrency(metrics.metaReceita)} />
        <Metric tone={TONE.green} label="Faltam" value={formatCurrency(metrics.faltaReceita)} color={metrics.faltaReceita > 0 ? "#fbbf24" : TONE.green} />
      </Section>

      {/* ── Pipeline futuro (azul) ── */}
      <Section tone={TONE.blue} label="Pipeline futuro" cols="grid-cols-2">
        <Metric tone={TONE.blue} label="Forecast" value={formatCurrency(metrics.forecast)} color={TONE.blue} />
        <Metric tone={TONE.blue} label="Em negociação" value={formatCurrency(metrics.emNegociacao)} color={TONE.blue} />
      </Section>

      {/* ── Performance (roxo) ── */}
      <Section tone={TONE.violet} label="Performance" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric tone={TONE.violet} label="% Meta" value={`${metaPercent.toFixed(1)}%`} color={metaPercent >= 100 ? "#34d399" : metaPercent >= 70 ? "#fbbf24" : "#f87171"} />
        <Metric tone={TONE.violet} label="Conversão" value={`${metrics.conversao.toFixed(1)}%`} />
        <Metric tone={TONE.violet} label="Qtd Vendas" value={metrics.vendas} />
        <Metric tone={TONE.violet} label="Ticket Médio" value={formatCurrency(metrics.ticketMedio)} />
        <Metric tone={TONE.violet} label="Projeção" value={formatCurrency(metrics.projecaoReceita)} />
        <Metric tone={TONE.violet} label="% Projetado" value={`${metrics.projecaoPercent.toFixed(0)}%`} />
      </Section>

      {/* ── Discador — reuniões e custos (âmbar) — SÓ do discador, não o total ── */}
      <Section tone={TONE.amber} label="Discador — Reuniões e Custos (só via discador)" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric tone={TONE.amber} label="Realizadas (via discador)" value={dialerOutcomes.realized} color="#34d399" />
        <Metric tone={TONE.amber} label="Agendadas (via discador)" value={dialerOutcomes.scheduled} color={TONE.blue} />
        <Metric tone={TONE.amber} label="CAC" value={dialerOutcomes.sales > 0 && dialerCostBrl > 0 ? formatCurrency(dialerCostBrl / dialerOutcomes.sales) : "—"} color="#f87171" />
        <Metric tone={TONE.amber} label="Custo / Reunião Realizada" value={dialerOutcomes.realized > 0 && dialerCostBrl > 0 ? formatCurrency(dialerCostBrl / dialerOutcomes.realized) : "—"} />
        <Metric tone={TONE.amber} label="Custo / Reunião Agendada" value={dialerOutcomes.scheduled > 0 && dialerCostBrl > 0 ? formatCurrency(dialerCostBrl / dialerOutcomes.scheduled) : "—"} />
      </Section>

      {/* ── Flags do time (3D): performance vs meta dos 3 últimos meses fechados ── */}
      <Suspense fallback={null}>
        <CRMTeamFlags3D selfStaffId={isCloserUser ? staffId : undefined} />
      </Suspense>

      {/* ── Metas (Meta / Super / Hiper) ── */}
      <GlowCard glowColor="shadow-primary/10">
        <div className="relative p-5 space-y-5">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atingimento de Metas</h3>
          {[
            { label: "Meta", pct: metaPercent, value: metrics.metaReceita, remaining: metrics.faltaReceita, color: "#10b981" },
            { label: "Super Meta", pct: superPercent, value: metrics.superMeta, remaining: metrics.faltaSuper, color: "#f59e0b" },
            { label: "Hiper Meta", pct: hiperPercent, value: metrics.hiperMeta, remaining: metrics.faltaHiper, color: "#0ea5e9" },
          ].map((goal, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">{goal.label} <span className="text-muted-foreground text-xs">({formatCurrency(goal.value)})</span></span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Falta: {formatCurrency(goal.remaining)}</span>
                  <span className="font-semibold text-foreground tabular-nums">{goal.pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, goal.pct)}%`, backgroundColor: goal.color }} />
              </div>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* ── Meta Diária ── */}
      <div className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted">
              <CalendarDays className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Meta Diária</h3>
              <p className="text-xs text-muted-foreground">{dailyGoal.businessDaysLeft} dia{dailyGoal.businessDaysLeft !== 1 ? "s" : ""} úte{dailyGoal.businessDaysLeft !== 1 ? "is" : "il"} restante{dailyGoal.businessDaysLeft !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            {[
              { label: "Meta do Mês", value: formatCurrency(dailyGoal.monthlyTarget) },
              { label: "Realizado", value: formatCurrency(dailyGoal.achieved) },
              { label: "Falta", value: formatCurrency(dailyGoal.remaining) },
              { label: "Vender/Dia", value: formatCurrency(dailyGoal.dailyTarget) },
            ].map((item, idx) => (
              <div key={idx} className="rounded-md p-3 bg-muted/40 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{item.label}</p>
                <p className="font-semibold text-sm text-foreground tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Progresso mensal</span>
            <span className="font-semibold text-foreground tabular-nums">{dailyGoal.monthlyTarget > 0 ? Math.round((dailyGoal.achieved / dailyGoal.monthlyTarget) * 100) : 0}%</span>
          </div>
          {(() => { const pct = dailyGoal.monthlyTarget > 0 ? (dailyGoal.achieved / dailyGoal.monthlyTarget) * 100 : 0; const c = pct >= 100 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#f43f5e"; return (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: c }} />
            </div>
          ); })()}
        </div>
      </div>

      {/* ── Reuniões (azul) — TOTAL real (todas as origens) ── */}
      <Section tone={TONE.blue} label="Reuniões (total — todas as origens)" cols="grid-cols-3">
        <Metric tone={TONE.blue} label="Agendadas" value={callsMetrics.agendadas} color={TONE.blue} />
        <Metric tone={TONE.blue} label="Realizadas" value={callsMetrics.realizadas} color="#34d399" />
        <Metric tone={TONE.blue} label="No Show" value={`${callsMetrics.noShowPercent.toFixed(0)}%`} color={callsMetrics.noShowPercent > 30 ? "#f87171" : undefined} />
      </Section>

      {/* ── Term Vision Chart ── */}
      <TermVisionChart closerStaffId={isCloserUser ? staffId : undefined} />

      {/* ── Gráficos ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Receita por Produto */}
        <GlowCard glowColor="shadow-emerald-500/10">
          <div className="p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-md bg-muted">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Receita por Produto
            </h3>
            {productDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {productDistribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", fontSize: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                    <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </GlowCard>

        {/* Projeções Meta */}
        <GlowCard glowColor="shadow-amber-500/10">
          <div className="p-5 space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Projeções vs Meta
            </h3>
            {[
              { label: "Meta", pct: metaPercent, color: "#10b981" },
              { label: "Super Meta", pct: superPercent, color: "#f59e0b" },
              { label: "Hiper Meta", pct: hiperPercent, color: "#0ea5e9" },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1.5"><span className="font-medium">{item.label}</span><span className="font-semibold tabular-nums">{item.pct.toFixed(0)}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, item.pct)}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>

      {/* ── Evolução de Receita ── */}
      <GlowCard glowColor="shadow-emerald-500/10">
        <div className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            Evolução de Receita
          </h3>
          <div className="flex items-center justify-center gap-5 mb-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-rose-500 inline-block" />Meta</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-emerald-500 inline-block" />Receita</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-amber-500 inline-block" style={{ borderTop: "1.5px dashed" }} />Super</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded bg-sky-500 inline-block" style={{ borderTop: "1.5px dashed" }} />Hiper</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueEvolution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).padStart(2, "0")} interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} domain={[0, "auto"]} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number | null, name: string) => value === null ? ["-", name] : [formatCurrency(value), name]} labelFormatter={(day) => `Dia ${day}`} contentStyle={{ fontSize: 12, borderRadius: "12px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="#10B981" strokeWidth={2.5} fill="url(#gradRevenue)" dot={false} connectNulls={false} />
                <Line type="linear" dataKey="meta" name="Meta" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                <Line type="linear" dataKey="super" name="Super Meta" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                <Line type="linear" dataKey="hiper" name="Hiper Meta" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlowCard>

      {/* ── Acumulado por Closer ── */}
      {dailyRevenueData.length > 0 && closers.length > 0 && (
        <GlowCard glowColor="shadow-sky-500/10">
          <div className="p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-muted">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Acumulado Diário por Closer
            </h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: "12px", fontSize: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }} />
                  <Legend />
                  {closers.map((closer, i) => (
                    <Line key={closer.id} type="monotone" dataKey={closer.name} stroke={["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"][i % 6]} strokeWidth={2.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlowCard>
      )}

      {/* ── Tabela: Desempenho dos Closers ── */}
      <GlowCard glowColor="shadow-amber-500/10">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            Desempenho dos Closers
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-border/50">
                <TableHead>Closer</TableHead>
                <TableHead className="text-center">Agend.</TableHead>
                <TableHead className="text-center">Realiz.</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-center">% Meta</TableHead>
                <TableHead className="text-center">Conv.</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closers.map(closer => (
                <TableRow key={closer.id} className="text-sm border-border/50 hover:bg-muted/40">
                  <TableCell className="font-semibold">{closer.name}</TableCell>
                  <TableCell className="text-center">{closer.callsScheduled}</TableCell>
                  <TableCell className="text-center">{closer.callsCompleted}</TableCell>
                  <TableCell className="text-center font-semibold">{closer.salesQty}</TableCell>
                  <TableCell className="text-right font-semibold text-foreground">{formatCurrency(closer.revenue)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[11px] font-semibold border-0", closer.metaPercent >= 100 ? "bg-emerald-500/20 text-emerald-400" : closer.metaPercent >= 70 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400")}>
                      {closer.metaPercent.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{closer.conversion.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(closer.ticketMedio)}</TableCell>
                </TableRow>
              ))}
              {closers.length > 0 && (
                <TableRow className="font-semibold text-sm bg-muted/30 border-border/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.callsScheduled, 0)}</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.callsCompleted, 0)}</TableCell>
                  <TableCell className="text-center">{closers.reduce((s, c) => s + c.salesQty, 0)}</TableCell>
                  <TableCell className="text-right text-foreground">{formatCurrency(closers.reduce((s, c) => s + c.revenue, 0))}</TableCell>
                  <TableCell className="text-center">{metaPercent.toFixed(1)}%</TableCell>
                  <TableCell className="text-center">{metrics.conversao.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(metrics.ticketMedio)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </GlowCard>

      {/* ── Forecast ── */}
      {forecasts.length > 0 && (
        <GlowCard glowColor="shadow-cyan-500/10">
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                Forecast
              </h3>
              <Badge className="bg-muted text-foreground border-0 text-xs font-semibold">{formatCurrency(metrics.forecast)}</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs border-border/50">
                  <TableHead>Closer</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map(f => (
                  <TableRow key={f.id} className="text-sm border-border/50 hover:bg-muted/40">
                    <TableCell>{f.closer}</TableCell>
                    <TableCell>{f.client}</TableCell>
                    <TableCell><Badge className="text-[11px] bg-sky-500/20 text-sky-400 border-0">{f.status}</Badge></TableCell>
                    <TableCell>{f.product}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{formatCurrency(f.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlowCard>
      )}

      {/* ── Vendas do Período ── */}
      <GlowCard glowColor="shadow-emerald-500/10">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              Vendas no Período
            </h3>
            <Badge className="bg-muted text-foreground border-0 text-xs font-semibold">{sales.length} vendas</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs border-border/50">
                <TableHead>Dia</TableHead>
                <TableHead>Funil</TableHead>
                <TableHead>Closer</TableHead>
                <TableHead>SDR</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda registrada</TableCell>
                </TableRow>
              ) : (
                sales.map(sale => (
                  <TableRow key={sale.id} className="text-sm border-border/50 hover:bg-muted/40">
                    <TableCell>{sale.saleDate}</TableCell>
                    <TableCell>{sale.pipeline}</TableCell>
                    <TableCell>{sale.closer}</TableCell>
                    <TableCell>{sale.sdr}</TableCell>
                    <TableCell>{sale.company}</TableCell>
                    <TableCell>{sale.product}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{formatCurrency(sale.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlowCard>

      {/* ── Por Funil: vendas, reuniões agendadas e realizadas ── */}
      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <FunnelBarList title="Vendas por Funil" data={funnelBreakdown.sales} fmt={formatCurrency} color="#10b981" />
        <FunnelBarList title="Reuniões Agendadas por Funil" data={funnelBreakdown.scheduled} fmt={(v) => String(v)} color="#3b82f6" />
        <FunnelBarList title="Reuniões Realizadas por Funil" data={funnelBreakdown.realized} fmt={(v) => String(v)} color="#8b5cf6" />
      </div>
    </div>

    <ImportSalesDialog
      open={importDialogOpen}
      onOpenChange={setImportDialogOpen}
      onSuccess={() => {
        setLoading(true);
        window.location.reload();
      }}
    />
    </>
  );
};
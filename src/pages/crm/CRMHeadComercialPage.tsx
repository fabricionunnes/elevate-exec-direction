import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  FileText,
  Clock,
  User,
  Phone,
  Video,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Target,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  StickyNote,
  Zap,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Users,
  CalendarCheck,
  PhoneCall,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  getRemainingBusinessDaysInMonth,
  getTotalBusinessDaysInMonth,
  getBusinessDayNumber,
} from "@/lib/businessDays";

// ─── Types ───

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface GoalData {
  staff_id: string;
  goal_name: string;
  category: string;
  unit_type: string;
  meta_value: number | null;
  super_meta_value: number | null;
  hiper_meta_value: number | null;
}

interface StaffGoalLegacy {
  staff_id: string;
  meta_vendas: number | null;
  meta_agendamentos: number | null;
  meta_reunioes: number | null;
}

interface LeadWithStage {
  id: string;
  name: string;
  company: string | null;
  opportunity_value: number | null;
  probability: number | null;
  stage_id: string | null;
  closer_staff_id: string | null;
  owner_staff_id: string | null;
  last_activity_at: string | null;
  phone: string | null;
  notes: string | null;
  scheduled_at: string | null;
  stage: { name: string; sort_order: number; is_final: boolean | null; final_type: string | null } | null;
  closer: { name: string } | null;
  owner: { name: string } | null;
}

interface Activity {
  id: string;
  lead_id: string | null;
  title: string;
  type: string;
  status: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  description: string | null;
  responsible_staff_id: string | null;
  lead: { id: string; name: string; company: string | null } | null;
  staff: { name: string } | null;
}

interface WonData {
  staff_id: string;
  total_won: number;
  total_value: number;
}

interface StaffPerformance {
  staff: StaffMember;
  metaVendas: number;
  superMetaVendas: number;
  hiperMetaVendas: number;
  metaAgendamentos: number;
  metaReunioes: number;
  realizado: number;
  wonCount: number;
  forecastValue: number;
  forecastWeighted: number;
  pipelineValue: number;
  pipelineCount: number;
  yesterdayMeetings: number;
  todayMeetings: number;
  monthMeetings: number;
  monthAgendamentos: number;
  falta: number;
  percentAtingido: number;
  projecao: number;
  ritmo: number;
}

// ─── Constants ───

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatCompact = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatCurrency(v);
};

const NEGOTIATION_STAGES = [
  "forecast", "realizada", "realizada / em negociação", "fup",
  "reunião realizada", "agendada", "agendou reunião",
];

const activityTypeIcon: Record<string, React.ReactNode> = {
  call: <PhoneCall className="h-4 w-4" />,
  meeting: <Video className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
  email: <FileText className="h-4 w-4" />,
  followup: <Clock className="h-4 w-4" />,
  proposal: <FileText className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
};

const activityTypeLabel: Record<string, string> = {
  call: "Ligação", meeting: "Reunião", whatsapp: "WhatsApp",
  email: "E-mail", followup: "Follow-up", proposal: "Proposta",
  note: "Nota", other: "Outro",
};

const stageColors: Record<string, string> = {
  "forecast": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  "realizada / em negociação": "bg-amber-500/10 text-amber-700 border-amber-200",
  "realizada": "bg-blue-500/10 text-blue-700 border-blue-200",
  "reunião realizada": "bg-violet-500/10 text-violet-700 border-violet-200",
  "fup": "bg-orange-500/10 text-orange-700 border-orange-200",
  "agendada": "bg-sky-500/10 text-sky-700 border-sky-200",
  "agendou reunião": "bg-cyan-500/10 text-cyan-700 border-cyan-200",
};

// ─── Component ───

export default function CRMHeadComercialPage() {
  const { staffRole } = useCRMContext();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithStage[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [wonData, setWonData] = useState<WonData[]>([]);
  const [yesterdayActivities, setYesterdayActivities] = useState<Activity[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [activityStats, setActivityStats] = useState<any[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [activityNotes, setActivityNotes] = useState<Record<string, string>>({});
  const [savingActivityNote, setSavingActivityNote] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    performance: true, pipeline: true, yesterday: true, today: true,
  });
  const [filterCloser, setFilterCloser] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const totalBizDays = getTotalBusinessDaysInMonth(currentYear, currentMonth);
  const elapsedBizDays = getBusinessDayNumber(subDays(now, 1)); // D-1
  const remainingBizDays = getRemainingBusinessDaysInMonth(now);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const yesterday = subDays(now, 1);
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const [leadsRes, yesterdayRes, todayRes, staffRes, goalsRes, wonRes, statsRes] =
        await Promise.all([
          supabase
            .from("crm_leads")
            .select(`
              id, name, company, opportunity_value, probability, stage_id,
              closer_staff_id, owner_staff_id, last_activity_at, phone, notes, scheduled_at,
              stage:crm_stages!crm_leads_stage_id_fkey(name, sort_order, is_final, final_type),
              closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name),
              owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name)
            `)
            .is("closed_at", null),

          supabase
            .from("crm_activities")
            .select(`
              id, lead_id, title, type, status, scheduled_at, completed_at, notes, description,
              responsible_staff_id,
              lead:crm_leads!crm_activities_lead_id_fkey(id, name, company),
              staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
            `)
            .gte("scheduled_at", startOfDay(yesterday).toISOString())
            .lt("scheduled_at", endOfDay(yesterday).toISOString())
            .order("scheduled_at"),

          supabase
            .from("crm_activities")
            .select(`
              id, lead_id, title, type, status, scheduled_at, completed_at, notes, description,
              responsible_staff_id,
              lead:crm_leads!crm_activities_lead_id_fkey(id, name, company),
              staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
            `)
            .gte("scheduled_at", startOfDay(now).toISOString())
            .lt("scheduled_at", endOfDay(now).toISOString())
            .order("scheduled_at"),

          supabase
            .from("onboarding_staff")
            .select("id, name, role")
            .eq("is_active", true)
            .in("role", ["closer", "sdr", "head_comercial"])
            .order("name"),

          supabase
            .from("crm_goal_values")
            .select("staff_id, meta_value, super_meta_value, hiper_meta_value, goal_type:crm_goal_types(name, category, unit_type)")
            .eq("month", currentMonth + 1)
            .eq("year", currentYear),

          supabase.rpc("get_won_leads_this_month" as any).select("*"),

          supabase
            .from("crm_activities")
            .select("responsible_staff_id, type, status, scheduled_at")
            .gte("scheduled_at", monthStart.toISOString())
            .lte("scheduled_at", monthEnd.toISOString()),
        ]);

      if (leadsRes.data) {
        setLeads((leadsRes.data as any[]).filter((l) => !l.stage?.is_final));
      }
      setAllStaff((staffRes.data || []) as StaffMember[]);

      // Parse goals
      const parsedGoals: GoalData[] = ((goalsRes.data || []) as any[]).map((g: any) => ({
        staff_id: g.staff_id,
        goal_name: g.goal_type?.name || "",
        category: g.goal_type?.category || "",
        unit_type: g.goal_type?.unit_type || "",
        meta_value: g.meta_value,
        super_meta_value: g.super_meta_value,
        hiper_meta_value: g.hiper_meta_value,
      }));
      setGoals(parsedGoals);

      // Won data - manual query as RPC may not exist
      const { data: wonLeads } = await supabase
        .from("crm_leads")
        .select("closer_staff_id, owner_staff_id, opportunity_value")
        .not("closed_at", "is", null)
        .gte("closed_at", monthStart.toISOString())
        .lte("closed_at", monthEnd.toISOString());

      // Filter won leads by checking stage
      const { data: wonWithStage } = await supabase
        .from("crm_leads")
        .select("closer_staff_id, owner_staff_id, opportunity_value, stage:crm_stages!crm_leads_stage_id_fkey(final_type)")
        .not("closed_at", "is", null)
        .gte("closed_at", monthStart.toISOString())
        .lte("closed_at", monthEnd.toISOString());

      const wonMap: Record<string, WonData> = {};
      ((wonWithStage || []) as any[]).forEach((l) => {
        if (l.stage?.final_type !== "won") return;
        const sid = l.closer_staff_id || l.owner_staff_id;
        if (!sid) return;
        if (!wonMap[sid]) wonMap[sid] = { staff_id: sid, total_won: 0, total_value: 0 };
        wonMap[sid].total_won++;
        wonMap[sid].total_value += l.opportunity_value || 0;
      });
      setWonData(Object.values(wonMap));

      setYesterdayActivities((yesterdayRes.data || []) as any[]);
      setTodayActivities((todayRes.data || []) as any[]);
      setActivityStats((statsRes.data || []) as any[]);
    } catch (err) {
      console.error("Error loading head data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Save note on a lead ──
  const handleSaveNote = async (leadId: string) => {
    const note = editingNotes[leadId];
    if (note === undefined) return;
    setSavingNote(leadId);
    try {
      const { error } = await supabase.from("crm_leads").update({ notes: note }).eq("id", leadId);
      if (error) throw error;
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes: note } : l)));
      setEditingNotes((prev) => { const c = { ...prev }; delete c[leadId]; return c; });
      toast.success("Observação salva");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); }
    finally { setSavingNote(null); }
  };

  // ── Save note on activity ──
  const handleSaveActivityNote = async (activityId: string) => {
    const note = activityNotes[activityId];
    if (note === undefined) return;
    setSavingActivityNote(activityId);
    try {
      const { error } = await supabase.from("crm_activities").update({ notes: note }).eq("id", activityId);
      if (error) throw error;
      const update = (list: Activity[]) => list.map((a) => (a.id === activityId ? { ...a, notes: note } : a));
      setYesterdayActivities(update);
      setTodayActivities(update);
      setActivityNotes((prev) => { const c = { ...prev }; delete c[activityId]; return c; });
      toast.success("Nota salva");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); }
    finally { setSavingActivityNote(null); }
  };

  // ── Build staff performance table ──
  const staffPerformance = useMemo((): StaffPerformance[] => {
    return allStaff
      .filter((s) => s.role === "closer" || s.role === "sdr")
      .map((staff) => {
        // Goals
        const staffGoals = goals.filter((g) => g.staff_id === staff.id);
        const vendasGoal = staffGoals.find((g) => g.goal_name === "Vendas");
        const reunioesGoal = staffGoals.find((g) => g.goal_name === "Reuniões Realizadas");
        const agendamentosGoal = staffGoals.find((g) => g.goal_name === "Agendamentos");

        const metaVendas = vendasGoal?.meta_value || 0;
        const superMetaVendas = vendasGoal?.super_meta_value || 0;
        const hiperMetaVendas = vendasGoal?.hiper_meta_value || 0;
        const metaAgendamentos = agendamentosGoal?.meta_value || 0;
        const metaReunioes = reunioesGoal?.meta_value || 0;

        // Won
        const won = wonData.find((w) => w.staff_id === staff.id);
        const realizado = won?.total_value || 0;
        const wonCount = won?.total_won || 0;

        // Pipeline
        let forecastValue = 0;
        let forecastWeighted = 0;
        let pipelineValue = 0;
        let pipelineCount = 0;
        leads.forEach((l) => {
          const sid = l.closer_staff_id || l.owner_staff_id;
          if (sid !== staff.id) return;
          const sn = (l.stage as any)?.name?.toLowerCase() || "";
          if (!NEGOTIATION_STAGES.some((ns) => sn.includes(ns))) return;
          const val = l.opportunity_value || 0;
          const prob = l.probability != null && l.probability > 0 ? l.probability / 100 : 0.5;
          pipelineValue += val;
          pipelineCount++;
          if (sn.includes("forecast") || sn.includes("negociação") || sn.includes("fup")) {
            forecastValue += val;
            forecastWeighted += val * prob;
          }
        });

        // Activity stats
        const myYesterday = yesterdayActivities.filter((a) => a.responsible_staff_id === staff.id);
        const myToday = todayActivities.filter((a) => a.responsible_staff_id === staff.id);
        const yesterdayMeetings = myYesterday.filter((a) => a.type === "meeting" || a.type === "call").length;
        const todayMeetings = myToday.filter((a) => a.type === "meeting" || a.type === "call").length;

        // Monthly meetings from stats
        const monthMeetings = activityStats.filter(
          (a: any) => a.responsible_staff_id === staff.id && (a.type === "meeting" || a.type === "call")
        ).length;
        const monthAgendamentos = activityStats.filter(
          (a: any) => a.responsible_staff_id === staff.id && a.type === "meeting"
        ).length;

        const falta = Math.max(0, metaVendas - realizado);
        const percentAtingido = metaVendas > 0 ? (realizado / metaVendas) * 100 : 0;
        const projecao = elapsedBizDays > 0 ? (realizado / elapsedBizDays) * totalBizDays : 0;
        const ritmo = remainingBizDays > 0 ? falta / remainingBizDays : 0;

        return {
          staff,
          metaVendas, superMetaVendas, hiperMetaVendas,
          metaAgendamentos, metaReunioes,
          realizado, wonCount,
          forecastValue, forecastWeighted,
          pipelineValue, pipelineCount,
          yesterdayMeetings, todayMeetings,
          monthMeetings, monthAgendamentos,
          falta, percentAtingido, projecao, ritmo,
        };
      })
      .sort((a, b) => b.percentAtingido - a.percentAtingido);
  }, [allStaff, goals, wonData, leads, yesterdayActivities, todayActivities, activityStats, elapsedBizDays, totalBizDays, remainingBizDays]);

  const closersPerf = useMemo(() => staffPerformance.filter((s) => s.staff.role === "closer"), [staffPerformance]);
  const sdrsPerf = useMemo(() => staffPerformance.filter((s) => s.staff.role === "sdr"), [staffPerformance]);

  // Totals
  const totals = useMemo(() => {
    const t = {
      metaVendas: 0, realizado: 0, projecao: 0, pipeline: 0,
      forecast: 0, forecastWeighted: 0, todayMeetings: 0, yesterdayMeetings: 0,
    };
    closersPerf.forEach((p) => {
      t.metaVendas += p.metaVendas;
      t.realizado += p.realizado;
      t.projecao += p.projecao;
      t.pipeline += p.pipelineValue;
      t.forecast += p.forecastValue;
      t.forecastWeighted += p.forecastWeighted;
      t.todayMeetings += p.todayMeetings;
      t.yesterdayMeetings += p.yesterdayMeetings;
    });
    return t;
  }, [closersPerf]);

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const filteredLeads = useMemo(() => {
    const base = leads.filter((l) => {
      const sn = (l.stage as any)?.name?.toLowerCase() || "";
      return NEGOTIATION_STAGES.some((ns) => sn.includes(ns));
    });
    if (filterCloser === "all") return base;
    return base.filter((l) => l.closer_staff_id === filterCloser || l.owner_staff_id === filterCloser);
  }, [leads, filterCloser]);

  const forecastLeads = useMemo(() => {
    return filteredLeads.filter((l) => {
      const sn = (l.stage as any)?.name?.toLowerCase() || "";
      return sn.includes("forecast") || sn.includes("negociação") || sn.includes("fup");
    });
  }, [filteredLeads]);

  const forecastByCloser = useMemo(() => {
    const groups: Record<string, { name: string; leads: LeadWithStage[]; total: number }> = {};
    forecastLeads.forEach((l) => {
      const sid = l.closer_staff_id || l.owner_staff_id || "sem-dono";
      const closerName = (l.closer as any)?.name || (l.owner as any)?.name || "Sem responsável";
      if (!groups[sid]) groups[sid] = { name: closerName, leads: [], total: 0 };
      groups[sid].leads.push(l);
      groups[sid].total += l.opportunity_value || 0;
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.total - a.total);
  }, [forecastLeads]);

  const leadsByStage = useMemo(() => {
    const groups: Record<string, LeadWithStage[]> = {};
    filteredLeads.forEach((lead) => {
      const name = (lead.stage as any)?.name || "Sem etapa";
      if (!groups[name]) groups[name] = [];
      groups[name].push(lead);
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const ao = (a[0]?.stage as any)?.sort_order ?? 99;
      const bo = (b[0]?.stage as any)?.sort_order ?? 99;
      return ao - bo;
    });
  }, [filteredLeads]);

  const filterActivities = useCallback((list: Activity[]) => {
    if (filterCloser === "all") return list;
    return list.filter((a) => a.responsible_staff_id === filterCloser);
  }, [filterCloser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const globalPercent = totals.metaVendas > 0 ? (totals.realizado / totals.metaVendas) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 shrink-0">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
            </div>
            Briefing Diário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} — D{elapsedBizDays} de {totalBizDays} dias úteis
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={filterCloser} onValueChange={setFilterCloser}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {allStaff.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} className="w-full sm:w-auto">Atualizar</Button>
        </div>
      </div>

      {/* ── Hero KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          iconBg="from-emerald-500/20 to-green-500/20"
          iconColor="text-emerald-600"
          label="Realizado"
          value={formatCurrency(totals.realizado)}
          sub={`${globalPercent.toFixed(0)}% da meta`}
          trend={globalPercent >= 100 ? "up" : globalPercent >= 70 ? "neutral" : "down"}
        />
        <KPICard
          icon={<Target className="h-5 w-5" />}
          iconBg="from-blue-500/20 to-indigo-500/20"
          iconColor="text-blue-600"
          label="Meta Total"
          value={formatCurrency(totals.metaVendas)}
          sub={`Falta ${formatCompact(Math.max(0, totals.metaVendas - totals.realizado))}`}
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="from-violet-500/20 to-purple-500/20"
          iconColor="text-violet-600"
          label="Projeção"
          value={formatCurrency(totals.projecao)}
          sub={totals.metaVendas > 0 ? `${((totals.projecao / totals.metaVendas) * 100).toFixed(0)}% da meta` : "—"}
          trend={totals.projecao >= totals.metaVendas ? "up" : "down"}
        />
        <KPICard
          icon={<Flame className="h-5 w-5" />}
          iconBg="from-orange-500/20 to-red-500/20"
          iconColor="text-orange-600"
          label="Forecast"
          value={formatCurrency(totals.forecast)}
          sub={`${forecastLeads.length} leads | Pipeline: ${formatCompact(totals.pipeline)}`}
        />
        <KPICard
          icon={<CalendarCheck className="h-5 w-5" />}
          iconBg="from-sky-500/20 to-cyan-500/20"
          iconColor="text-sky-600"
          label="Reuniões Hoje"
          value={String(totals.todayMeetings)}
          sub={`Ontem: ${totals.yesterdayMeetings}`}
        />
      </div>

      {/* Global Progress Bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Atingimento Global</span>
            <span className="text-sm font-bold">{globalPercent.toFixed(1)}%</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(globalPercent, 100)}%`,
                background: globalPercent >= 100
                  ? "linear-gradient(90deg, #22c55e, #10b981)"
                  : globalPercent >= 70
                  ? "linear-gradient(90deg, #f59e0b, #eab308)"
                  : "linear-gradient(90deg, #ef4444, #f97316)",
              }}
            />
            {/* Super meta marker */}
            <div className="absolute top-0 h-full w-px bg-amber-500/60" style={{ left: "100%" }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>D{elapsedBizDays}/{totalBizDays}</span>
            <span>{remainingBizDays} dias úteis restantes</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="gap-1 text-xs sm:text-sm px-1 sm:px-3 py-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">Performance</span><span className="sm:hidden">Perf.</span>
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1 text-xs sm:text-sm px-1 sm:px-3 py-2">
            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Forecast
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1 text-xs sm:text-sm px-1 sm:px-3 py-2">
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1 text-xs sm:text-sm px-1 sm:px-3 py-2">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> Agenda
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: Performance ═══ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Closers */}
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Target className="h-4 w-4" /> Closers
          </h3>
          <div className="grid gap-3">
            {closersPerf.map((p) => (
              <StaffPerformanceCard key={p.staff.id} perf={p} type="closer" />
            ))}
            {closersPerf.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhum closer encontrado</p>
            )}
          </div>

          {/* SDRs */}
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mt-6">
            <PhoneCall className="h-4 w-4" /> SDRs
          </h3>
          <div className="grid gap-3">
            {sdrsPerf.map((p) => (
              <StaffPerformanceCard key={p.staff.id} perf={p} type="sdr" />
            ))}
            {sdrsPerf.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhum SDR encontrado</p>
            )}
          </div>
        </TabsContent>

        {/* ═══ TAB: Forecast ═══ */}
        <TabsContent value="forecast" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm bg-emerald-500/10 text-emerald-700 border-emerald-200">
                {forecastLeads.length} leads em forecast
              </Badge>
              <span className="text-sm font-bold">{formatCurrency(forecastLeads.reduce((s, l) => s + (l.opportunity_value || 0), 0))}</span>
            </div>
          </div>

          {forecastByCloser.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lead em forecast</CardContent></Card>
          ) : (
            forecastByCloser.map(([closerId, group]) => (
              <div key={closerId} className="space-y-2">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-700">
                      {group.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{group.name}</p>
                      <p className="text-[11px] text-muted-foreground">{group.leads.length} leads</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(group.total)}</p>
                </div>
                {group.leads
                  .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
                  .map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      editingNotes={editingNotes}
                      setEditingNotes={setEditingNotes}
                      savingNote={savingNote}
                      onSaveNote={handleSaveNote}
                    />
                  ))}
              </div>
            ))
          )}
        </TabsContent>

        {/* ═══ TAB: Pipeline ═══ */}
        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="text-sm">
              {filteredLeads.length} leads em negociação
            </Badge>
            <span className="text-sm font-semibold">
              {formatCurrency(filteredLeads.reduce((s, l) => s + (l.opportunity_value || 0), 0))}
            </span>
          </div>

          {leadsByStage.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lead em negociação</CardContent></Card>
          ) : (
            leadsByStage.map(([stageName, stageLeads]) => {
              const stageKey = stageName.toLowerCase();
              const colorClass = Object.entries(stageColors).find(([k]) => stageKey.includes(k))?.[1] || "bg-muted text-foreground border-border";
              const totalVal = stageLeads.reduce((s, l) => s + (l.opportunity_value || 0), 0);

              return (
                <div key={stageName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${colorClass} font-medium`}>{stageName}</Badge>
                      <span className="text-xs text-muted-foreground">{stageLeads.length} leads</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(totalVal)}</span>
                  </div>
                  {stageLeads
                    .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
                    .map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        editingNotes={editingNotes}
                        setEditingNotes={setEditingNotes}
                        savingNote={savingNote}
                        onSaveNote={handleSaveNote}
                      />
                    ))}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* ═══ TAB: Agenda ═══ */}
        <TabsContent value="agenda" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Yesterday */}
            <Collapsible open={expandedSections.yesterday} onOpenChange={() => toggleSection("yesterday")}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        Ontem ({filterActivities(yesterdayActivities).length})
                      </span>
                      {expandedSections.yesterday ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-[500px]">
                      {filterActivities(yesterdayActivities).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Nenhuma atividade</p>
                      ) : (
                        <div className="space-y-2">
                          {filterActivities(yesterdayActivities).map((act) => (
                            <ActivityCard key={act.id} activity={act} activityNotes={activityNotes} setActivityNotes={setActivityNotes} savingActivityNote={savingActivityNote} onSaveActivityNote={handleSaveActivityNote} />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Today */}
            <Collapsible open={expandedSections.today} onOpenChange={() => toggleSection("today")}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-violet-600" />
                        Hoje ({filterActivities(todayActivities).length})
                      </span>
                      {expandedSections.today ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-[500px]">
                      {filterActivities(todayActivities).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Nenhuma atividade</p>
                      ) : (
                        <div className="space-y-2">
                          {filterActivities(todayActivities).map((act) => (
                            <ActivityCard key={act.id} activity={act} showStatus activityNotes={activityNotes} setActivityNotes={setActivityNotes} savingActivityNote={savingActivityNote} onSaveActivityNote={handleSaveActivityNote} />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── KPI Card ───
function KPICard({ icon, iconBg, iconColor, label, value, sub, trend }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl bg-gradient-to-br ${iconBg} shrink-0`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-lg font-bold mt-0.5 truncate">{value}</p>
            {sub && (
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                {sub}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Staff Performance Card ───
function StaffPerformanceCard({ perf, type }: { perf: StaffPerformance; type: "closer" | "sdr" }) {
  const p = perf;
  const isCloser = type === "closer";
  const percent = p.percentAtingido;
  const projecaoPercent = p.metaVendas > 0 ? (p.projecao / p.metaVendas) * 100 : 0;
  const initials = p.staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const statusColor = percent >= 100
    ? "text-emerald-600 bg-emerald-500/10"
    : percent >= 70
    ? "text-amber-600 bg-amber-500/10"
    : "text-red-600 bg-red-500/10";

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${statusColor}`}>
            {initials}
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{p.staff.name}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5">
                  {isCloser ? "Closer" : "SDR"}
                </Badge>
              </div>
              <div className="text-right">
                {isCloser ? (
                  <>
                    <p className="text-lg font-bold">{formatCurrency(p.realizado)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      de {formatCompact(p.metaVendas)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold">{p.monthMeetings}</p>
                    <p className="text-[11px] text-muted-foreground">
                      de {p.metaReunioes || p.metaAgendamentos || "—"} reuniões
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">Atingimento</span>
                <span className={`text-xs font-bold ${percent >= 100 ? "text-emerald-600" : percent >= 70 ? "text-amber-600" : "text-red-600"}`}>
                  {percent.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    background: percent >= 100
                      ? "linear-gradient(90deg, #22c55e, #10b981)"
                      : percent >= 70
                      ? "linear-gradient(90deg, #f59e0b, #eab308)"
                      : "linear-gradient(90deg, #ef4444, #f97316)",
                  }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className={`grid ${isCloser ? "grid-cols-4" : "grid-cols-3"} gap-3 mt-3 pt-3 border-t border-border/50`}>
              {isCloser && (
                <>
                  <MetricBlock label="Falta" value={formatCompact(p.falta)} alert={p.falta > 0} />
                  <MetricBlock label="Projeção" value={formatCompact(p.projecao)} good={projecaoPercent >= 100} />
                  <MetricBlock label="Ritmo/dia" value={formatCompact(p.ritmo)} />
                  <MetricBlock label="Pipeline" value={`${p.pipelineCount} (${formatCompact(p.pipelineValue)})`} />
                </>
              )}
              {!isCloser && (
                <>
                  <MetricBlock label="Agend. Ontem" value={String(p.yesterdayMeetings)} />
                  <MetricBlock label="Agend. Hoje" value={String(p.todayMeetings)} />
                  <MetricBlock label="Falta p/ Meta" value={String(Math.max(0, (p.metaReunioes || p.metaAgendamentos || 0) - p.monthMeetings))} alert />
                </>
              )}
            </div>

            {/* Closer extras */}
            {isCloser && (
              <div className="grid grid-cols-3 gap-3 mt-2 pt-2 border-t border-border/30">
                <MetricBlock label="Forecast" value={formatCompact(p.forecastValue)} />
                <MetricBlock label="Reuniões Ontem" value={String(p.yesterdayMeetings)} />
                <MetricBlock label="Reuniões Hoje" value={String(p.todayMeetings)} />
              </div>
            )}

            {/* Super/Hiper meta badges */}
            {isCloser && (p.superMetaVendas > 0 || p.hiperMetaVendas > 0) && (
              <div className="flex gap-2 mt-2">
                {p.superMetaVendas > 0 && (
                  <Badge variant={p.realizado >= p.superMetaVendas ? "default" : "outline"} className="text-[10px] gap-1">
                    <Zap className="h-3 w-3" />
                    Super: {formatCompact(p.superMetaVendas)}
                    {p.realizado >= p.superMetaVendas && " ✓"}
                  </Badge>
                )}
                {p.hiperMetaVendas > 0 && (
                  <Badge variant={p.realizado >= p.hiperMetaVendas ? "default" : "outline"} className="text-[10px] gap-1">
                    <Flame className="h-3 w-3" />
                    Hiper: {formatCompact(p.hiperMetaVendas)}
                    {p.realizado >= p.hiperMetaVendas && " ✓"}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Metric Block ───
function MetricBlock({ label, value, alert, good }: { label: string; value: string; alert?: boolean; good?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${alert ? "text-red-600" : good ? "text-emerald-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Lead Card ───
function LeadCard({ lead, editingNotes, setEditingNotes, savingNote, onSaveNote }: {
  lead: LeadWithStage;
  editingNotes: Record<string, string>;
  setEditingNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingNote: string | null;
  onSaveNote: (id: string) => Promise<void>;
}) {
  const daysSince = lead.last_activity_at ? Math.floor((Date.now() - new Date(lead.last_activity_at).getTime()) / 86400000) : null;
  const isEditing = editingNotes[lead.id] !== undefined;
  const closerName = (lead.closer as any)?.name || (lead.owner as any)?.name || "—";

  return (
    <div className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{lead.name}</p>
            {lead.company && <span className="text-xs text-muted-foreground">— {lead.company}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{closerName}</span>
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
            {lead.scheduled_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(lead.scheduled_at), "dd/MM HH:mm")}</span>}
            {daysSince != null && daysSince > 3 && (
              <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />{daysSince}d sem atividade</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{formatCurrency(lead.opportunity_value || 0)}</p>
          {lead.probability != null && <p className="text-[11px] text-muted-foreground">{lead.probability}%</p>}
        </div>
      </div>
      <div className="mt-2">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editingNotes[lead.id]} onChange={(e) => setEditingNotes((p) => ({ ...p, [lead.id]: e.target.value }))} placeholder="Observação..." className="text-xs min-h-[60px] resize-none" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNotes((p) => { const c = { ...p }; delete c[lead.id]; return c; })}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSaveNote(lead.id)} disabled={savingNote === lead.id}>
                {savingNote === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditingNotes((p) => ({ ...p, [lead.id]: lead.notes || "" }))} className="w-full text-left">
            {lead.notes ? (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3 hover:bg-muted transition-colors">
                <StickyNote className="h-3 w-3 inline mr-1 opacity-60" />{lead.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 hover:text-muted-foreground bg-muted/30 hover:bg-muted/50 rounded p-2 transition-colors">
                <StickyNote className="h-3 w-3 inline mr-1" />Adicionar observação...
              </p>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Activity Card ───
function ActivityCard({ activity: act, showStatus, activityNotes, setActivityNotes, savingActivityNote, onSaveActivityNote }: {
  activity: Activity; showStatus?: boolean;
  activityNotes: Record<string, string>;
  setActivityNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingActivityNote: string | null;
  onSaveActivityNote: (id: string) => Promise<void>;
}) {
  const isPast = act.scheduled_at && new Date(act.scheduled_at) < new Date();
  const isDone = act.status === "completed";
  const isEditingNote = activityNotes[act.id] !== undefined;

  return (
    <div className={`border rounded-lg p-3 ${isDone ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-md ${isDone ? "bg-emerald-500/10 text-emerald-600" : isPast ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {activityTypeIcon[act.type] || <Calendar className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{act.title}</p>
            <Badge variant={isDone ? "secondary" : isPast ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0 shrink-0">
              {isDone ? "✓" : isPast ? "Atrasada" : activityTypeLabel[act.type] || act.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {act.scheduled_at && <span className="font-medium">{format(new Date(act.scheduled_at), "HH:mm")}</span>}
            {(act.lead as any)?.name && <><span>•</span><span className="truncate">{(act.lead as any).name}</span></>}
            {(act.staff as any)?.name && <><span>•</span><span>{(act.staff as any).name.split(" ")[0]}</span></>}
          </div>
          {(act.notes || act.description) && !isEditingNote && (
            <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 rounded p-2 line-clamp-3">{act.notes || act.description}</p>
          )}
          {isEditingNote ? (
            <div className="mt-2 space-y-2">
              <Textarea value={activityNotes[act.id]} onChange={(e) => setActivityNotes((p) => ({ ...p, [act.id]: e.target.value }))} placeholder="Observação..." className="text-xs min-h-[60px] resize-none" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActivityNotes((p) => { const c = { ...p }; delete c[act.id]; return c; })}>Cancelar</Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSaveActivityNote(act.id)} disabled={savingActivityNote === act.id}>
                  {savingActivityNote === act.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setActivityNotes((p) => ({ ...p, [act.id]: act.notes || act.description || "" }))} className="mt-1.5 w-full text-left">
              <p className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground bg-muted/30 hover:bg-muted/50 rounded px-2 py-1.5 transition-colors flex items-center gap-1">
                <StickyNote className="h-3 w-3" />
                {act.notes || act.description ? "Editar observação..." : "Adicionar observação..."}
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

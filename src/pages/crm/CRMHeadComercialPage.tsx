import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

  // Chart data for forecast by closer
  const forecastChartData = useMemo(() => {
    return forecastByCloser.map(([, group]) => ({
      name: group.name.split(" ")[0],
      value: group.total,
    }));
  }, [forecastByCloser]);

  // Chart data for closer performance
  const performanceChartData = useMemo(() => {
    return closersPerf.map((p) => ({
      name: p.staff.name.split(" ")[0],
      realizado: p.realizado,
      meta: p.metaVendas,
      forecast: p.forecastValue,
    }));
  }, [closersPerf]);

  const CHART_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <Sparkles className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando briefing...</p>
        </div>
      </div>
    );
  }

  const globalPercent = totals.metaVendas > 0 ? (totals.realizado / totals.metaVendas) * 100 : 0;
  const donutData = [
    { name: "Realizado", value: totals.realizado },
    { name: "Faltante", value: Math.max(0, totals.metaVendas - totals.realizado) },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400/20 via-orange-500/20 to-rose-500/20 shadow-lg shadow-orange-500/10 shrink-0">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
            </div>
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Briefing Diário
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 ml-12 sm:ml-14">
            {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} — D{elapsedBizDays} de {totalBizDays} dias úteis
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={filterCloser} onValueChange={setFilterCloser}>
            <SelectTrigger className="w-full sm:w-[200px] border-white/10 bg-card/80 backdrop-blur-sm">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {allStaff.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} className="w-full sm:w-auto border-white/10">
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Hero KPIs with Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {[
            { icon: <DollarSign className="h-5 w-5" />, gradient: "from-emerald-500 to-teal-400", glow: "shadow-emerald-500/20", color: "text-emerald-400", label: "Realizado", value: formatCurrency(totals.realizado), sub: `${globalPercent.toFixed(0)}% da meta`, trend: globalPercent >= 100 ? "up" as const : "down" as const },
            { icon: <Target className="h-5 w-5" />, gradient: "from-blue-500 to-indigo-400", glow: "shadow-blue-500/20", color: "text-blue-400", label: "Meta Total", value: formatCurrency(totals.metaVendas), sub: `Falta ${formatCompact(Math.max(0, totals.metaVendas - totals.realizado))}` },
            { icon: <TrendingUp className="h-5 w-5" />, gradient: "from-violet-500 to-purple-400", glow: "shadow-violet-500/20", color: "text-violet-400", label: "Projeção", value: formatCurrency(totals.projecao), sub: totals.metaVendas > 0 ? `${((totals.projecao / totals.metaVendas) * 100).toFixed(0)}% da meta` : "—", trend: totals.projecao >= totals.metaVendas ? "up" as const : "down" as const },
            { icon: <Flame className="h-5 w-5" />, gradient: "from-orange-500 to-rose-400", glow: "shadow-orange-500/20", color: "text-orange-400", label: "Forecast", value: formatCurrency(totals.forecast), sub: `${forecastLeads.length} leads` },
            { icon: <CalendarCheck className="h-5 w-5" />, gradient: "from-sky-500 to-cyan-400", glow: "shadow-sky-500/20", color: "text-sky-400", label: "Reuniões Hoje", value: String(totals.todayMeetings), sub: `Ontem: ${totals.yesterdayMeetings}` },
          ].map((kpi, idx) => (
            <GlowCard key={idx} glowColor={kpi.glow}>
              <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-[0.06]`} />
              <div className="relative p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg bg-gradient-to-br ${kpi.gradient} text-white shadow-md`}>
                    {kpi.icon}
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{kpi.label}</span>
                </div>
                <p className={cn("text-base sm:text-lg font-black tracking-tight", kpi.color)}>{kpi.value}</p>
                {kpi.sub && (
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    {kpi.trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-400" />}
                    {kpi.trend === "down" && <ArrowDownRight className="h-3 w-3 text-rose-400" />}
                    {kpi.sub}
                  </p>
                )}
              </div>
            </GlowCard>
          ))}
        </div>

        {/* Mini Donut */}
        <GlowCard glowColor="shadow-primary/15" className="hidden lg:flex items-center justify-center">
          <div className="relative p-4 flex flex-col items-center">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={52} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  <Cell fill="#22c55e" />
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-xl font-black", globalPercent >= 100 ? "text-emerald-400" : globalPercent >= 70 ? "text-amber-400" : "text-rose-400")}>
                {globalPercent.toFixed(0)}%
              </span>
              <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">da meta</span>
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Global Progress Bar */}
      <GlowCard glowColor="shadow-primary/10">
        <div className="relative p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Atingimento Global
            </span>
            <span className={cn("text-sm font-black", globalPercent >= 100 ? "text-emerald-400" : globalPercent >= 70 ? "text-amber-400" : "text-rose-400")}>
              {globalPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(globalPercent, 100)}%`,
                background: globalPercent >= 100
                  ? "linear-gradient(90deg, #22c55e, #10b981, #059669)"
                  : globalPercent >= 70
                  ? "linear-gradient(90deg, #f59e0b, #eab308, #f59e0b)"
                  : "linear-gradient(90deg, #ef4444, #f97316, #ef4444)",
                boxShadow: globalPercent >= 100
                  ? "0 0 12px rgba(34,197,94,0.4)"
                  : globalPercent >= 70
                  ? "0 0 12px rgba(245,158,11,0.4)"
                  : "0 0 12px rgba(239,68,68,0.4)",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> D{elapsedBizDays}/{totalBizDays}</span>
            <span>{remainingBizDays} dias úteis restantes</span>
          </div>
        </div>
      </GlowCard>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto bg-card/80 backdrop-blur-sm border border-white/10 rounded-xl p-1">
          {[
            { value: "overview", icon: <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />, label: "Performance", shortLabel: "Perf." },
            { value: "forecast", icon: <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />, label: "Forecast", shortLabel: "Forecast" },
            { value: "pipeline", icon: <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />, label: "Pipeline", shortLabel: "Pipeline" },
            { value: "agenda", icon: <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />, label: "Agenda", shortLabel: "Agenda" },
          ].map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs sm:text-sm px-1 sm:px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:shadow-md">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ TAB: Performance ═══ */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          {/* Performance Chart */}
          {performanceChartData.length > 0 && (
            <GlowCard glowColor="shadow-emerald-500/10">
              <div className="relative p-4 sm:p-5">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-emerald-400" /> Realizado vs Meta por Closer
                </h3>
                <div className="h-[200px] sm:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceChartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border)/0.3)",
                          borderRadius: "12px",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [formatCurrency(value)]}
                      />
                      <defs>
                        <linearGradient id="barRealizado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                        <linearGradient id="barMeta" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
                        </linearGradient>
                        <linearGradient id="barForecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="meta" name="Meta" fill="url(#barMeta)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="realizado" name="Realizado" fill="url(#barRealizado)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="forecast" name="Forecast" fill="url(#barForecast)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </GlowCard>
          )}

          {/* Closers */}
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-400" /> Closers
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
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mt-6">
            <PhoneCall className="h-4 w-4 text-violet-400" /> SDRs
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
          {/* Forecast Pie Chart + Summary */}
          {forecastChartData.length > 0 && (
            <GlowCard glowColor="shadow-orange-500/10">
              <div className="relative p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Flame className="h-4 w-4 text-orange-400" /> Forecast por Closer
                    </h3>
                    <p className="text-2xl font-black text-orange-400">{formatCurrency(forecastLeads.reduce((s, l) => s + (l.opportunity_value || 0), 0))}</p>
                    <p className="text-xs text-muted-foreground mt-1">{forecastLeads.length} leads em forecast</p>
                  </div>
                  <div className="h-[140px] w-[140px] mx-auto sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={forecastChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                          {forecastChartData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border)/0.3)", borderRadius: "12px", fontSize: "11px" }} formatter={(v: number) => [formatCurrency(v)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </GlowCard>
          )}

          {forecastByCloser.length === 0 ? (
            <GlowCard><div className="p-8 text-center text-muted-foreground">Nenhum lead em forecast</div></GlowCard>
          ) : (
            forecastByCloser.map(([closerId, group]) => (
              <GlowCard key={closerId} glowColor="shadow-orange-500/5">
                <div className="relative">
                  <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-transparent px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 p-[2px] shadow-md">
                        <div className="h-full w-full rounded-[10px] bg-card flex items-center justify-center">
                          <span className="text-xs font-black text-orange-400">{group.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold">{group.name}</p>
                        <p className="text-[11px] text-muted-foreground">{group.leads.length} leads</p>
                      </div>
                    </div>
                    <p className="text-base font-black text-orange-400">{formatCurrency(group.total)}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {group.leads
                      .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
                      .map((lead) => (
                        <LeadCard key={lead.id} lead={lead} editingNotes={editingNotes} setEditingNotes={setEditingNotes} savingNote={savingNote} onSaveNote={handleSaveNote} />
                      ))}
                  </div>
                </div>
              </GlowCard>
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

// ─── GlowCard (3D effect) ───
function GlowCard({ children, className = "", glowColor = "shadow-primary/10" }: {
  children: React.ReactNode; className?: string; glowColor?: string;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden",
      "transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5",
      "shadow-lg hover:shadow-xl",
      glowColor,
      className
    )}
    style={{ background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)/0.8) 100%)" }}
    >
      {children}
    </div>
  );
}

// ─── Staff Performance Card ───
function StaffPerformanceCard({ perf, type }: { perf: StaffPerformance; type: "closer" | "sdr" }) {
  const p = perf;
  const isCloser = type === "closer";
  const percent = p.percentAtingido;
  const projecaoPercent = p.metaVendas > 0 ? (p.projecao / p.metaVendas) * 100 : 0;
  const initials = p.staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const statusGradient = percent >= 100
    ? "from-emerald-500 to-teal-400"
    : percent >= 70
    ? "from-amber-500 to-yellow-400"
    : "from-rose-500 to-red-400";

  const statusGlow = percent >= 100
    ? "shadow-emerald-500/20"
    : percent >= 70
    ? "shadow-amber-500/20"
    : "shadow-rose-500/20";

  const statusTextColor = percent >= 100
    ? "text-emerald-400"
    : percent >= 70
    ? "text-amber-400"
    : "text-rose-400";

  return (
    <GlowCard glowColor={statusGlow}>
      <div className={`absolute inset-0 bg-gradient-to-br ${statusGradient} opacity-[0.04]`} />
      <div className="relative p-4">
        <div className="flex items-start gap-4">
          {/* Avatar with gradient ring */}
          <div className="relative shrink-0">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${statusGradient} p-[2px] shadow-lg`}>
              <div className="h-full w-full rounded-[10px] bg-card flex items-center justify-center">
                <span className={cn("text-sm font-black", statusTextColor)}>{initials}</span>
              </div>
            </div>
            {percent >= 100 && (
              <div className="absolute -top-1 -right-1 text-sm">🔥</div>
            )}
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{p.staff.name}</p>
                <Badge variant="outline" className={cn("text-[10px] mt-0.5 border-white/10", statusTextColor)}>
                  {isCloser ? "Closer" : "SDR"}
                </Badge>
              </div>
              <div className="text-right">
                {isCloser ? (
                  <>
                    <p className={cn("text-xl font-black", statusTextColor)}>{formatCurrency(p.realizado)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      de {formatCompact(p.metaVendas)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={cn("text-xl font-black", statusTextColor)}>{p.monthMeetings}</p>
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
                <span className={cn("text-xs font-black", statusTextColor)}>
                  {percent.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    background: percent >= 100
                      ? "linear-gradient(90deg, #22c55e, #10b981, #059669)"
                      : percent >= 70
                      ? "linear-gradient(90deg, #f59e0b, #eab308, #f59e0b)"
                      : "linear-gradient(90deg, #ef4444, #f97316, #ef4444)",
                    boxShadow: percent >= 100
                      ? "0 0 10px rgba(34,197,94,0.3)"
                      : percent >= 70
                      ? "0 0 10px rgba(245,158,11,0.3)"
                      : "0 0 10px rgba(239,68,68,0.3)",
                  }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className={`grid ${isCloser ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-3 mt-3 pt-3 border-t border-white/5`}>
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
              <div className="grid grid-cols-3 gap-3 mt-2 pt-2 border-t border-white/5">
                <MetricBlock label="Forecast" value={formatCompact(p.forecastValue)} />
                <MetricBlock label="Reuniões Ontem" value={String(p.yesterdayMeetings)} />
                <MetricBlock label="Reuniões Hoje" value={String(p.todayMeetings)} />
              </div>
            )}

            {/* Super/Hiper meta badges */}
            {isCloser && (p.superMetaVendas > 0 || p.hiperMetaVendas > 0) && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {p.superMetaVendas > 0 && (
                  <Badge variant={p.realizado >= p.superMetaVendas ? "default" : "outline"} className={cn("text-[10px] gap-1 border-white/10", p.realizado >= p.superMetaVendas && "bg-gradient-to-r from-amber-500 to-yellow-400 border-0 text-white")}>
                    <Zap className="h-3 w-3" />
                    Super: {formatCompact(p.superMetaVendas)}
                    {p.realizado >= p.superMetaVendas && " ✓"}
                  </Badge>
                )}
                {p.hiperMetaVendas > 0 && (
                  <Badge variant={p.realizado >= p.hiperMetaVendas ? "default" : "outline"} className={cn("text-[10px] gap-1 border-white/10", p.realizado >= p.hiperMetaVendas && "bg-gradient-to-r from-rose-500 to-pink-400 border-0 text-white")}>
                    <Flame className="h-3 w-3" />
                    Hiper: {formatCompact(p.hiperMetaVendas)}
                    {p.realizado >= p.hiperMetaVendas && " ✓"}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

// ─── Metric Block ───
function MetricBlock({ label, value, alert, good }: { label: string; value: string; alert?: boolean; good?: boolean }) {
  return (
    <div className="text-center p-1.5 rounded-lg bg-muted/20">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className={cn(
        "text-xs font-bold mt-0.5",
        alert ? "text-rose-400" : good ? "text-emerald-400" : "text-foreground"
      )}>
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
    <div className="border border-white/10 rounded-xl p-3 bg-card/60 backdrop-blur-sm hover:bg-card/80 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate">{lead.name}</p>
            {lead.company && <span className="text-xs text-muted-foreground">— {lead.company}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{closerName}</span>
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
            {lead.scheduled_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(lead.scheduled_at), "dd/MM HH:mm")}</span>}
            {daysSince != null && daysSince > 3 && (
              <span className="flex items-center gap-1 text-rose-400 font-semibold"><AlertCircle className="h-3 w-3" />{daysSince}d sem atividade</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-emerald-400">{formatCurrency(lead.opportunity_value || 0)}</p>
          {lead.probability != null && <p className="text-[11px] text-muted-foreground">{lead.probability}%</p>}
        </div>
      </div>
      <div className="mt-2">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editingNotes[lead.id]} onChange={(e) => setEditingNotes((p) => ({ ...p, [lead.id]: e.target.value }))} placeholder="Observação..." className="text-xs min-h-[60px] resize-none bg-muted/30 border-white/10" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNotes((p) => { const c = { ...p }; delete c[lead.id]; return c; })}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-primary to-primary/80" onClick={() => onSaveNote(lead.id)} disabled={savingNote === lead.id}>
                {savingNote === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditingNotes((p) => ({ ...p, [lead.id]: lead.notes || "" }))} className="w-full text-left">
            {lead.notes ? (
              <p className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2 line-clamp-3 hover:bg-muted/30 transition-colors border border-white/5">
                <StickyNote className="h-3 w-3 inline mr-1 opacity-60" />{lead.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/40 hover:text-muted-foreground bg-muted/10 hover:bg-muted/20 rounded-lg p-2 transition-colors border border-dashed border-white/10">
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
    <div className={cn("border border-white/10 rounded-xl p-3 backdrop-blur-sm transition-all", isDone ? "opacity-60 bg-card/40" : "bg-card/60 hover:bg-card/80")}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 p-2 rounded-xl shadow-md",
          isDone ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400"
            : isPast ? "bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-400"
            : "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
        )}>
          {activityTypeIcon[act.type] || <Calendar className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold truncate">{act.title}</p>
            <Badge variant={isDone ? "secondary" : isPast ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0 shrink-0 border-white/10">
              {isDone ? "✓" : isPast ? "Atrasada" : activityTypeLabel[act.type] || act.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {act.scheduled_at && <span className="font-semibold">{format(new Date(act.scheduled_at), "HH:mm")}</span>}
            {(act.lead as any)?.name && <><span>•</span><span className="truncate">{(act.lead as any).name}</span></>}
            {(act.staff as any)?.name && <><span>•</span><span>{(act.staff as any).name.split(" ")[0]}</span></>}
          </div>
          {(act.notes || act.description) && !isEditingNote && (
            <p className="text-xs text-muted-foreground mt-1.5 bg-muted/20 rounded-lg p-2 line-clamp-3 border border-white/5">{act.notes || act.description}</p>
          )}
          {isEditingNote ? (
            <div className="mt-2 space-y-2">
              <Textarea value={activityNotes[act.id]} onChange={(e) => setActivityNotes((p) => ({ ...p, [act.id]: e.target.value }))} placeholder="Observação..." className="text-xs min-h-[60px] resize-none bg-muted/30 border-white/10" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActivityNotes((p) => { const c = { ...p }; delete c[act.id]; return c; })}>Cancelar</Button>
                <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-primary to-primary/80" onClick={() => onSaveActivityNote(act.id)} disabled={savingActivityNote === act.id}>
                  {savingActivityNote === act.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setActivityNotes((p) => ({ ...p, [act.id]: act.notes || act.description || "" }))} className="mt-1.5 w-full text-left">
              <p className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground bg-muted/10 hover:bg-muted/20 rounded-lg px-2 py-1.5 transition-colors flex items-center gap-1 border border-dashed border-white/10">
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

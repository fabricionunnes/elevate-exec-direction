import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadWithStage {
  id: string;
  name: string;
  company: string | null;
  opportunity_value: number | null;
  probability: number | null;
  stage_id: string | null;
  closer_staff_id: string | null;
  last_activity_at: string | null;
  phone: string | null;
  stage: { name: string; sort_order: number; is_final: boolean | null; final_type: string | null } | null;
  closer: { name: string } | null;
}

interface Activity {
  id: string;
  title: string;
  type: string;
  status: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  description: string | null;
  responsible_staff_id: string | null;
  lead: { name: string; company: string | null } | null;
  staff: { name: string } | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const activityTypeIcon: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  meeting: <Video className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
  email: <FileText className="h-4 w-4" />,
  followup: <Clock className="h-4 w-4" />,
  proposal: <FileText className="h-4 w-4" />,
};

const activityTypeLabel: Record<string, string> = {
  call: "Ligação",
  meeting: "Reunião",
  whatsapp: "WhatsApp",
  email: "E-mail",
  followup: "Follow-up",
  proposal: "Proposta",
  note: "Nota",
  other: "Outro",
};

export default function CRMHeadComercialPage() {
  const { staffRole } = useCRMContext();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithStage[]>([]);
  const [yesterdayActivities, setYesterdayActivities] = useState<Activity[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const yesterday = subDays(now, 1);

      // Fetch open leads with stages (not final)
      const { data: leadsData } = await supabase
        .from("crm_leads")
        .select(`
          id, name, company, opportunity_value, probability, stage_id,
          closer_staff_id, last_activity_at, phone,
          stage:crm_stages!crm_leads_stage_id_fkey(name, sort_order, is_final, final_type),
          closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name)
        `)
        .is("closed_at", null);

      if (leadsData) {
        // Filter out leads in final stages
        const openLeads = (leadsData as any[]).filter(
          (l) => !l.stage?.is_final
        );
        setLeads(openLeads);
      }

      // Fetch yesterday's completed/done activities
      const { data: yesterdayData } = await supabase
        .from("crm_activities")
        .select(`
          id, title, type, status, scheduled_at, completed_at, notes, description,
          responsible_staff_id,
          lead:crm_leads!crm_activities_lead_id_fkey(name, company),
          staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
        `)
        .gte("scheduled_at", startOfDay(yesterday).toISOString())
        .lt("scheduled_at", endOfDay(yesterday).toISOString())
        .order("scheduled_at", { ascending: true });

      if (yesterdayData) setYesterdayActivities(yesterdayData as any[]);

      // Fetch today's activities
      const { data: todayData } = await supabase
        .from("crm_activities")
        .select(`
          id, title, type, status, scheduled_at, completed_at, notes, description,
          responsible_staff_id,
          lead:crm_leads!crm_activities_lead_id_fkey(name, company),
          staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
        `)
        .gte("scheduled_at", startOfDay(now).toISOString())
        .lt("scheduled_at", endOfDay(now).toISOString())
        .order("scheduled_at", { ascending: true });

      if (todayData) setTodayActivities(todayData as any[]);
    } catch (err) {
      console.error("Error loading head data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed data ──

  const forecast = useMemo(() => {
    // Group by closer, weighted by probability
    const byCloser: Record<string, { name: string; total: number; weighted: number; count: number }> = {};
    let grandTotal = 0;
    let grandWeighted = 0;

    leads.forEach((lead) => {
      const val = lead.opportunity_value || 0;
      const prob = lead.probability != null ? lead.probability / 100 : 0.5;
      const closerName = (lead.closer as any)?.name || "Sem closer";
      const closerId = lead.closer_staff_id || "none";

      if (!byCloser[closerId]) {
        byCloser[closerId] = { name: closerName, total: 0, weighted: 0, count: 0 };
      }
      byCloser[closerId].total += val;
      byCloser[closerId].weighted += val * prob;
      byCloser[closerId].count += 1;
      grandTotal += val;
      grandWeighted += val * prob;
    });

    return {
      byCloser: Object.values(byCloser).sort((a, b) => b.weighted - a.weighted),
      grandTotal,
      grandWeighted,
      totalLeads: leads.length,
    };
  }, [leads]);

  // Leads in "negotiation" stages (stage name containing proposal/negociação/forecast/realizada)
  const negotiationLeads = useMemo(() => {
    const keywords = ["proposta", "negociação", "negociacao", "forecast", "realizada"];
    return leads
      .filter((l) => {
        const stageName = (l.stage as any)?.name?.toLowerCase() || "";
        return keywords.some((k) => stageName.includes(k));
      })
      .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0));
  }, [leads]);

  // Yesterday's meetings specifically
  const yesterdayMeetings = useMemo(
    () => yesterdayActivities.filter((a) => a.type === "meeting" || a.type === "call"),
    [yesterdayActivities]
  );

  const todayMeetings = useMemo(
    () => todayActivities.filter((a) => a.type === "meeting" || a.type === "call"),
    [todayActivities]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Briefing Diário</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Forecast Ponderado</p>
                <p className="text-lg font-bold">{formatCurrency(forecast.grandWeighted)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Total</p>
                <p className="text-lg font-bold">{formatCurrency(forecast.grandTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <BarChart3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Negociação</p>
                <p className="text-lg font-bold">{negotiationLeads.length} leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reuniões Hoje</p>
                <p className="text-lg font-bold">{todayMeetings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Forecast by Closer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Forecast por Closer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              {forecast.byCloser.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhum lead no pipeline</p>
              ) : (
                <div className="divide-y">
                  {forecast.byCloser.map((c, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.count} leads</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(c.weighted)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Total: {formatCurrency(c.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Proposals in Negotiation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" />
              Propostas em Negociação ({negotiationLeads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              {negotiationLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma proposta em negociação</p>
              ) : (
                <div className="divide-y">
                  {negotiationLeads.map((lead) => {
                    const daysSinceLast = lead.last_activity_at
                      ? Math.floor(
                          (Date.now() - new Date(lead.last_activity_at).getTime()) / 86400000
                        )
                      : null;
                    return (
                      <div key={lead.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{lead.name}</p>
                            {lead.company && (
                              <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {(lead.stage as any)?.name}
                              </Badge>
                              {(lead.closer as any)?.name && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />
                                  {(lead.closer as any)?.name?.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">
                              {formatCurrency(lead.opportunity_value || 0)}
                            </p>
                            {daysSinceLast != null && daysSinceLast > 3 && (
                              <span className="text-[10px] text-destructive flex items-center gap-0.5 justify-end">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {daysSinceLast}d sem atividade
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Yesterday's Meetings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Reuniões de Ontem ({yesterdayMeetings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[350px]">
              {yesterdayMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma reunião ontem</p>
              ) : (
                <div className="divide-y">
                  {yesterdayMeetings.map((act) => (
                    <div key={act.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                          {activityTypeIcon[act.type] || <Calendar className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{act.title}</p>
                            {act.status === "completed" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {act.scheduled_at && (
                              <span>{format(new Date(act.scheduled_at), "HH:mm")}</span>
                            )}
                            {(act.lead as any)?.name && (
                              <>
                                <span>•</span>
                                <span className="truncate">{(act.lead as any).name}</span>
                              </>
                            )}
                            {(act.staff as any)?.name && (
                              <>
                                <span>•</span>
                                <span>{(act.staff as any).name.split(" ")[0]}</span>
                              </>
                            )}
                          </div>
                          {(act.notes || act.description) && (
                            <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 rounded p-2 line-clamp-3">
                              {act.notes || act.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              Agenda de Hoje ({todayActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[350px]">
              {todayActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Nenhuma atividade agendada para hoje</p>
              ) : (
                <div className="divide-y">
                  {todayActivities.map((act) => {
                    const isPast =
                      act.scheduled_at && new Date(act.scheduled_at) < new Date();
                    const isDone = act.status === "completed";
                    return (
                      <div
                        key={act.id}
                        className={`px-4 py-3 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 p-1.5 rounded-md ${
                              isDone
                                ? "bg-emerald-500/10 text-emerald-600"
                                : isPast
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {activityTypeIcon[act.type] || <Calendar className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{act.title}</p>
                              <Badge
                                variant={isDone ? "secondary" : isPast ? "destructive" : "outline"}
                                className="text-[10px] px-1.5 py-0 shrink-0"
                              >
                                {isDone ? "Concluída" : isPast ? "Atrasada" : activityTypeLabel[act.type] || act.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {act.scheduled_at && (
                                <span className="font-medium">
                                  {format(new Date(act.scheduled_at), "HH:mm")}
                                </span>
                              )}
                              {(act.lead as any)?.name && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{(act.lead as any).name}</span>
                                </>
                              )}
                              {(act.staff as any)?.name && (
                                <>
                                  <span>•</span>
                                  <span>{(act.staff as any).name.split(" ")[0]}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

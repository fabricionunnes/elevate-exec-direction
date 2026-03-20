import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "@/pages/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  Send,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ─── Types ───

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

// ─── Constants ───

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const NEGOTIATION_STAGES = [
  "forecast",
  "realizada",
  "realizada / em negociação",
  "fup",
  "reunião realizada",
];

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

const stageColors: Record<string, string> = {
  "forecast": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  "realizada / em negociação": "bg-amber-500/10 text-amber-700 border-amber-200",
  "realizada": "bg-blue-500/10 text-blue-700 border-blue-200",
  "reunião realizada": "bg-violet-500/10 text-violet-700 border-violet-200",
  "fup": "bg-orange-500/10 text-orange-700 border-orange-200",
  "agendada": "bg-sky-500/10 text-sky-700 border-sky-200",
};

// ─── Component ───

export default function CRMHeadComercialPage() {
  const { staffRole } = useCRMContext();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadWithStage[]>([]);
  const [yesterdayActivities, setYesterdayActivities] = useState<Activity[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    forecast: true,
    negotiation: true,
    yesterday: false,
    today: true,
  });
  const [filterCloser, setFilterCloser] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const yesterday = subDays(now, 1);

      const [leadsRes, yesterdayRes, todayRes] = await Promise.all([
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
            id, title, type, status, scheduled_at, completed_at, notes, description,
            responsible_staff_id,
            lead:crm_leads!crm_activities_lead_id_fkey(name, company),
            staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
          `)
          .gte("scheduled_at", startOfDay(yesterday).toISOString())
          .lt("scheduled_at", endOfDay(yesterday).toISOString())
          .order("scheduled_at", { ascending: true }),

        supabase
          .from("crm_activities")
          .select(`
            id, title, type, status, scheduled_at, completed_at, notes, description,
            responsible_staff_id,
            lead:crm_leads!crm_activities_lead_id_fkey(name, company),
            staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
          `)
          .gte("scheduled_at", startOfDay(now).toISOString())
          .lt("scheduled_at", endOfDay(now).toISOString())
          .order("scheduled_at", { ascending: true }),
      ]);

      if (leadsRes.data) {
        const openLeads = (leadsRes.data as any[]).filter((l) => !l.stage?.is_final);
        setLeads(openLeads);
      }
      if (yesterdayRes.data) setYesterdayActivities(yesterdayRes.data as any[]);
      if (todayRes.data) setTodayActivities(todayRes.data as any[]);
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
      const { error } = await supabase
        .from("crm_leads")
        .update({ notes: note })
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, notes: note } : l))
      );
      setEditingNotes((prev) => {
        const copy = { ...prev };
        delete copy[leadId];
        return copy;
      });
      toast.success("Observação salva");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingNote(null);
    }
  };

  // ── Computed ──

  const closers = useMemo(() => {
    const set = new Map<string, string>();
    leads.forEach((l) => {
      const id = l.closer_staff_id || l.owner_staff_id;
      const name = (l.closer as any)?.name || (l.owner as any)?.name;
      if (id && name) set.set(id, name);
    });
    return Array.from(set.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (filterCloser === "all") return leads;
    return leads.filter(
      (l) => l.closer_staff_id === filterCloser || l.owner_staff_id === filterCloser
    );
  }, [leads, filterCloser]);

  // Group leads by stage for negotiation view
  const leadsByStage = useMemo(() => {
    const groups: Record<string, LeadWithStage[]> = {};
    filteredLeads.forEach((lead) => {
      const stageName = (lead.stage as any)?.name || "Sem etapa";
      const stageKey = stageName.toLowerCase();
      if (NEGOTIATION_STAGES.some((ns) => stageKey.includes(ns))) {
        if (!groups[stageName]) groups[stageName] = [];
        groups[stageName].push(lead);
      }
    });
    // Sort groups by stage sort_order
    const sorted = Object.entries(groups).sort(([, a], [, b]) => {
      const aOrder = (a[0]?.stage as any)?.sort_order ?? 99;
      const bOrder = (b[0]?.stage as any)?.sort_order ?? 99;
      return aOrder - bOrder;
    });
    return sorted;
  }, [filteredLeads]);

  const forecast = useMemo(() => {
    const byCloser: Record<string, { name: string; total: number; weighted: number; count: number }> = {};
    let grandTotal = 0;
    let grandWeighted = 0;

    filteredLeads.forEach((lead) => {
      const stageName = (lead.stage as any)?.name?.toLowerCase() || "";
      if (!NEGOTIATION_STAGES.some((ns) => stageName.includes(ns))) return;

      const val = lead.opportunity_value || 0;
      const prob = lead.probability != null ? lead.probability / 100 : 0.5;
      const closerName = (lead.closer as any)?.name || (lead.owner as any)?.name || "Sem responsável";
      const closerId = lead.closer_staff_id || lead.owner_staff_id || "none";

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
    };
  }, [filteredLeads]);

  const todayMeetings = useMemo(
    () => todayActivities.filter((a) => a.type === "meeting" || a.type === "call"),
    [todayActivities]
  );

  const yesterdayMeetings = useMemo(
    () => yesterdayActivities.filter((a) => a.type === "meeting" || a.type === "call"),
    [yesterdayActivities]
  );

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalNegotiationLeads = leadsByStage.reduce((s, [, arr]) => s + arr.length, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Briefing Diário</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCloser} onValueChange={setFilterCloser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os closers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {closers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}>
            Atualizar
          </Button>
        </div>
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
                <p className="text-xs text-muted-foreground">Pipeline (Negociação)</p>
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
                <p className="text-xs text-muted-foreground">Leads em Negociação</p>
                <p className="text-lg font-bold">{totalNegotiationLeads}</p>
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

      {/* Forecast by Closer */}
      <Collapsible open={expandedSections.forecast} onOpenChange={() => toggleSection("forecast")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Forecast por Closer
                </span>
                {expandedSections.forecast ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {forecast.byCloser.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum lead em negociação</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {forecast.byCloser.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {c.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Leads by Stage (Detailed) */}
      <Collapsible open={expandedSections.negotiation} onOpenChange={() => toggleSection("negotiation")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  Leads em Negociação — Detalhado ({totalNegotiationLeads})
                </span>
                {expandedSections.negotiation ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {leadsByStage.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum lead em negociação</p>
              ) : (
                leadsByStage.map(([stageName, stageLeads]) => {
                  const stageKey = stageName.toLowerCase();
                  const colorClass =
                    Object.entries(stageColors).find(([k]) => stageKey.includes(k))?.[1] ||
                    "bg-muted text-foreground border-border";
                  const totalStageValue = stageLeads.reduce(
                    (s, l) => s + (l.opportunity_value || 0),
                    0
                  );

                  return (
                    <div key={stageName}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${colorClass} font-medium`}>
                            {stageName}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {stageLeads.length} leads
                          </span>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrency(totalStageValue)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {stageLeads
                          .sort((a, b) => (b.opportunity_value || 0) - (a.opportunity_value || 0))
                          .map((lead) => {
                            const daysSinceLast = lead.last_activity_at
                              ? Math.floor(
                                  (Date.now() - new Date(lead.last_activity_at).getTime()) / 86400000
                                )
                              : null;
                            const isEditing = editingNotes[lead.id] !== undefined;
                            const closerName =
                              (lead.closer as any)?.name || (lead.owner as any)?.name || "—";

                            return (
                              <div
                                key={lead.id}
                                className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold truncate">
                                        {lead.name}
                                      </p>
                                      {lead.company && (
                                        <span className="text-xs text-muted-foreground">
                                          — {lead.company}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {closerName}
                                      </span>
                                      {lead.phone && (
                                        <span className="flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {lead.phone}
                                        </span>
                                      )}
                                      {lead.scheduled_at && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {format(new Date(lead.scheduled_at), "dd/MM HH:mm")}
                                        </span>
                                      )}
                                      {daysSinceLast != null && daysSinceLast > 3 && (
                                        <span className="flex items-center gap-1 text-destructive">
                                          <AlertCircle className="h-3 w-3" />
                                          {daysSinceLast}d sem atividade
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold">
                                      {formatCurrency(lead.opportunity_value || 0)}
                                    </p>
                                    {lead.probability != null && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {lead.probability}% prob.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Notes section */}
                                <div className="mt-2">
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editingNotes[lead.id]}
                                        onChange={(e) =>
                                          setEditingNotes((prev) => ({
                                            ...prev,
                                            [lead.id]: e.target.value,
                                          }))
                                        }
                                        placeholder="Adicione uma observação sobre este lead..."
                                        className="text-xs min-h-[60px] resize-none"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() =>
                                            setEditingNotes((prev) => {
                                              const copy = { ...prev };
                                              delete copy[lead.id];
                                              return copy;
                                            })
                                          }
                                        >
                                          Cancelar
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => handleSaveNote(lead.id)}
                                          disabled={savingNote === lead.id}
                                        >
                                          {savingNote === lead.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Save className="h-3 w-3" />
                                          )}
                                          Salvar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setEditingNotes((prev) => ({
                                          ...prev,
                                          [lead.id]: lead.notes || "",
                                        }))
                                      }
                                      className="w-full text-left"
                                    >
                                      {lead.notes ? (
                                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3 hover:bg-muted transition-colors">
                                          <StickyNote className="h-3 w-3 inline mr-1 opacity-60" />
                                          {lead.notes}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-muted-foreground/50 hover:text-muted-foreground bg-muted/30 hover:bg-muted/50 rounded p-2 transition-colors">
                                          <StickyNote className="h-3 w-3 inline mr-1" />
                                          Clique para adicionar observação...
                                        </p>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Meetings Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Yesterday's Meetings */}
        <Collapsible open={expandedSections.yesterday} onOpenChange={() => toggleSection("yesterday")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Reuniões de Ontem ({yesterdayMeetings.length})
                  </span>
                  {expandedSections.yesterday ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[350px]">
                  {yesterdayMeetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhuma reunião ontem</p>
                  ) : (
                    <div className="space-y-2">
                      {yesterdayMeetings.map((act) => (
                        <ActivityCard key={act.id} activity={act} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Today's Schedule */}
        <Collapsible open={expandedSections.today} onOpenChange={() => toggleSection("today")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-violet-600" />
                    Agenda de Hoje ({todayActivities.length})
                  </span>
                  {expandedSections.today ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[350px]">
                  {todayActivities.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhuma atividade hoje</p>
                  ) : (
                    <div className="space-y-2">
                      {todayActivities.map((act) => (
                        <ActivityCard key={act.id} activity={act} showStatus />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}

// ─── Activity Card Sub-Component ───

function ActivityCard({ activity: act, showStatus = false }: { activity: Activity; showStatus?: boolean }) {
  const isPast = act.scheduled_at && new Date(act.scheduled_at) < new Date();
  const isDone = act.status === "completed";

  return (
    <div className={`border rounded-lg p-3 ${isDone ? "opacity-60" : ""}`}>
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
            {showStatus && (
              <Badge
                variant={isDone ? "secondary" : isPast ? "destructive" : "outline"}
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {isDone ? "Concluída" : isPast ? "Atrasada" : activityTypeLabel[act.type] || act.type}
              </Badge>
            )}
            {!showStatus && isDone && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {act.scheduled_at && (
              <span className="font-medium">{format(new Date(act.scheduled_at), "HH:mm")}</span>
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
  );
}

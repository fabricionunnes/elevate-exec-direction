import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Clock, Video, RefreshCw, Loader2, User, ExternalLink, CheckCircle2, CalendarIcon, Filter, Trash2, UserX, X, Link2 } from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface MeetingActivity {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  lead_id: string | null;
  responsible_staff_id: string | null;
  lead?: { id: string; name: string; stage_id: string | null } | null;
  responsible_staff?: { id: string; name: string } | null;
}

interface StaffOption { id: string; name: string; }
interface PipelineStage { id: string; name: string; pipeline_id: string; }

const CRMMeetingsPage = () => {
  const { staffRole, staffId, isAdmin, isMaster } = useCRMContext();
  const navigate = useNavigate();
  const isHead = staffRole === "head_comercial";
  const canFilterStaff = isMaster || isAdmin || isHead;
  const canDelete = isMaster || isAdmin;

  const [meetings, setMeetings] = useState<MeetingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Dialog state
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingActivity | null>(null);
  const [briefing, setBriefing] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = useCallback(async () => {
    if (!canFilterStaff) return;
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .in("role", ["closer", "sdr", "head_comercial", "admin", "master"])
      .eq("is_active", true)
      .order("name");
    setStaffOptions(data || []);
  }, [canFilterStaff]);

  const fetchStages = useCallback(async () => {
    const { data } = await supabase
      .from("crm_pipeline_stages" as any)
      .select("id, name, pipeline_id")
      .order("position");
    setStages((data as any) || []);
  }, []);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("crm_activities")
        .select(`
          id, title, description, type, status, scheduled_at, completed_at, created_at,
          lead_id, responsible_staff_id,
          lead:crm_leads!crm_activities_lead_id_fkey(id, name, stage_id),
          responsible_staff:onboarding_staff!crm_activities_responsible_staff_id_fkey(id, name)
        `)
        .eq("type", "meeting")
        .order("scheduled_at", { ascending: false });

      if (dateRange.from) {
        query = query.gte("scheduled_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte("scheduled_at", endOfDay(dateRange.to).toISOString());
      }

      if (!canFilterStaff) {
        if (staffRole === "closer") {
          query = query.eq("responsible_staff_id", staffId);
        } else if (staffRole === "sdr") {
          const { data: sdrLeads } = await supabase
            .from("crm_leads")
            .select("id")
            .or(`sdr_staff_id.eq.${staffId},scheduled_by_staff_id.eq.${staffId}`);
          const leadIds = (sdrLeads || []).map(l => l.id);
          if (leadIds.length > 0) {
            query = query.in("lead_id", leadIds);
          } else {
            setMeetings([]);
            setLoading(false);
            return;
          }
        }
      } else if (filterStaff !== "all") {
        query = query.eq("responsible_staff_id", filterStaff);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out stage-action tasks (e.g. "Agendar reunião") that aren't real scheduled meetings
      // Real meetings have a corresponding entry in crm_meeting_events
      const allActivities = (data || []) as unknown as MeetingActivity[];
      const leadIds = [...new Set(allActivities.map(a => a.lead_id).filter(Boolean))];
      
      let realMeetingLeadIds = new Set<string>();
      let meetingEventsByLead = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: meetingEvents } = await supabase
          .from("crm_meeting_events")
          .select("lead_id, event_type")
          .in("lead_id", leadIds);
        
        for (const e of (meetingEvents || [])) {
          // Track which leads have scheduled events (to filter real meetings)
          if (e.event_type === "scheduled") {
            realMeetingLeadIds.add(e.lead_id);
          }
          // Track the latest meaningful status per lead (realized > no_show > out_of_icp > scheduled)
          const current = meetingEventsByLead.get(e.lead_id);
          const priority: Record<string, number> = { realized: 4, no_show: 3, out_of_icp: 3, scheduled: 1 };
          if (!current || (priority[e.event_type] || 0) > (priority[current] || 0)) {
            meetingEventsByLead.set(e.lead_id, e.event_type);
          }
        }
      }

      // Keep only activities whose lead has a real scheduled meeting event
      // Also sync status from crm_meeting_events
      const filtered = allActivities
        .filter(a => a.lead_id && realMeetingLeadIds.has(a.lead_id))
        .map(a => {
          const eventType = a.lead_id ? meetingEventsByLead.get(a.lead_id) : null;
          if (eventType === "realized") {
            return { ...a, status: "completed" };
          } else if (eventType === "no_show" || eventType === "out_of_icp") {
            return { ...a, status: "cancelled" };
          }
          return a;
        });
      setMeetings(filtered);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error fetching meetings:", err);
      toast.error("Erro ao carregar reuniões");
    } finally {
      setLoading(false);
    }
  }, [dateRange, filterStaff, filterStatus, staffId, staffRole, canFilterStaff]);

  useEffect(() => { fetchStaff(); fetchStages(); }, [fetchStaff, fetchStages]);
  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const moveLead = async (meeting: MeetingActivity, targetStageName: string) => {
    if (!meeting.lead_id || !meeting.lead?.stage_id) return;
    const currentStage = stages.find(s => s.id === meeting.lead!.stage_id);
    if (!currentStage) return;
    const targetStage = stages.find(
      s => s.pipeline_id === currentStage.pipeline_id &&
        s.name.toLowerCase().includes(targetStageName.toLowerCase())
    );
    if (targetStage) {
      await supabase.from("crm_leads").update({ stage_id: targetStage.id }).eq("id", meeting.lead_id);
    }
  };

  const handleFinalize = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          description: briefing || selectedMeeting.description,
        })
        .eq("id", selectedMeeting.id);
      if (error) throw error;

      await moveLead(selectedMeeting, "reunião realizada");

      // Track realized meeting event for Closer + SDR
      if (selectedMeeting.lead_id) {
        const closerId = selectedMeeting.responsible_staff_id || staffId;
        if (closerId) {
          const { data: leadData } = await supabase
            .from("crm_leads")
            .select("pipeline_id, scheduled_by_staff_id, stage_id")
            .eq("id", selectedMeeting.lead_id)
            .single();
          if (leadData?.pipeline_id) {
            const eventDate = new Date().toISOString();
            const stageId = selectedMeeting.lead?.stage_id || leadData.stage_id;
            const events: any[] = [{
              lead_id: selectedMeeting.lead_id,
              pipeline_id: leadData.pipeline_id,
              event_type: "realized",
              credited_staff_id: closerId,
              triggered_by_staff_id: staffId,
              stage_id: stageId,
              event_date: eventDate,
            }];
            if (leadData.scheduled_by_staff_id && leadData.scheduled_by_staff_id !== closerId) {
              events.push({
                lead_id: selectedMeeting.lead_id,
                pipeline_id: leadData.pipeline_id,
                event_type: "realized",
                credited_staff_id: leadData.scheduled_by_staff_id,
                triggered_by_staff_id: staffId,
                stage_id: stageId,
                event_date: eventDate,
              });
            }
            const { data: existing } = await supabase
              .from("crm_meeting_events")
              .select("id")
              .eq("lead_id", selectedMeeting.lead_id)
              .eq("event_type", "realized")
              .limit(1);
            if (!existing || existing.length === 0) {
              await supabase.from("crm_meeting_events").insert(events);
            }
          }
        }
      }

      toast.success("Reunião finalizada com sucesso!");
      setSelectedMeeting(null);
      setBriefing("");
      fetchMeetings();
    } catch (err) {
      console.error("Error finalizing meeting:", err);
      toast.error("Erro ao finalizar reunião");
    } finally {
      setSaving(false);
    }
  };

  const handleNoShow = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "no_show",
          completed_at: new Date().toISOString(),
          description: briefing || selectedMeeting.description || "Cliente não compareceu",
        })
        .eq("id", selectedMeeting.id);
      if (error) throw error;

      // Move lead to "No Show" stage if it exists, otherwise keep current
      await moveLead(selectedMeeting, "no show");

      // Track no_show meeting event for Closer + SDR
      if (selectedMeeting.lead_id) {
        const closerId = selectedMeeting.responsible_staff_id || staffId;
        if (closerId) {
          const { data: leadData } = await supabase
            .from("crm_leads")
            .select("pipeline_id, scheduled_by_staff_id, stage_id")
            .eq("id", selectedMeeting.lead_id)
            .single();
          if (leadData?.pipeline_id) {
            const eventDate = new Date().toISOString();
            const stageId = selectedMeeting.lead?.stage_id || leadData.stage_id;
            const events: any[] = [{
              lead_id: selectedMeeting.lead_id,
              pipeline_id: leadData.pipeline_id,
              event_type: "no_show",
              credited_staff_id: closerId,
              triggered_by_staff_id: staffId,
              stage_id: stageId,
              event_date: eventDate,
            }];
            if (leadData.scheduled_by_staff_id && leadData.scheduled_by_staff_id !== closerId) {
              events.push({
                lead_id: selectedMeeting.lead_id,
                pipeline_id: leadData.pipeline_id,
                event_type: "no_show",
                credited_staff_id: leadData.scheduled_by_staff_id,
                triggered_by_staff_id: staffId,
                stage_id: stageId,
                event_date: eventDate,
              });
            }
            const { data: existing } = await supabase
              .from("crm_meeting_events")
              .select("id")
              .eq("lead_id", selectedMeeting.lead_id)
              .eq("event_type", "no_show")
              .limit(1);
            if (!existing || existing.length === 0) {
              await supabase.from("crm_meeting_events").insert(events);
            }
          }
        }
      }

      toast.success("Reunião marcada como No Show");
      setSelectedMeeting(null);
      setBriefing("");
      fetchMeetings();
    } catch (err) {
      console.error("Error marking no show:", err);
      toast.error("Erro ao marcar no show");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("crm_activities")
        .delete()
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} reunião(ões) excluída(s)`);
      setSelectedMeeting(null);
      setShowDeleteConfirm(false);
      setDeleteTargetIds([]);
      fetchMeetings();
    } catch (err) {
      console.error("Error deleting meetings:", err);
      toast.error("Erro ao excluir reuniões");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === meetings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(meetings.map(m => m.id)));
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Realizada</Badge>;
      case "no_show":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">No Show</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Reuniões
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie suas reuniões agendadas</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDeleteTargetIds(Array.from(selectedIds)); setShowDeleteConfirm(true); }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchMeetings} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Quick period selector */}
          <Select
            value="custom"
            onValueChange={(val) => {
              const now = new Date();
              switch (val) {
                case "yesterday":
                  setDateRange({ from: subDays(now, 1), to: subDays(now, 1) });
                  break;
                case "today":
                  setDateRange({ from: now, to: now });
                  break;
                case "tomorrow":
                  setDateRange({ from: addDays(now, 1), to: addDays(now, 1) });
                  break;
                case "this_week":
                  setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
                  break;
                case "last_week": {
                  const lw = subWeeks(now, 1);
                  setDateRange({ from: startOfWeek(lw, { weekStartsOn: 1 }), to: endOfWeek(lw, { weekStartsOn: 1 }) });
                  break;
                }
                case "this_month":
                  setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                  break;
                case "last_month": {
                  const lm = subMonths(now, 1);
                  setDateRange({ from: startOfMonth(lm), to: endOfMonth(lm) });
                  break;
                }
                case "next_week": {
                  const nw = addWeeks(now, 1);
                  setDateRange({ from: startOfWeek(nw, { weekStartsOn: 1 }), to: endOfWeek(nw, { weekStartsOn: 1 }) });
                  break;
                }
              }
            }}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Período rápido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom" disabled className="text-muted-foreground text-xs">Período rápido</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="tomorrow">Amanhã</SelectItem>
              <SelectItem value="this_week">Esta semana</SelectItem>
              <SelectItem value="last_week">Semana passada</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="next_week">Semana que vem</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateRange.from ? format(dateRange.from, "dd/MM", { locale: ptBR }) : "Início"}
                {" - "}
                {dateRange.to ? format(dateRange.to, "dd/MM", { locale: ptBR }) : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                locale={ptBR}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="completed">Realizada</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          {canFilterStaff && (
            <Select value={filterStaff} onValueChange={setFilterStaff}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {staffOptions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear filters */}
          {(filterStatus !== "all" || filterStaff !== "all" || dateRange.from?.getTime() !== startOfMonth(new Date()).getTime()) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 text-muted-foreground"
              onClick={() => {
                setFilterStatus("all");
                setFilterStaff("all");
                setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Meetings list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma reunião encontrada para o período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          {canDelete && meetings.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={selectedIds.size === meetings.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground">Selecionar tudo ({meetings.length})</span>
            </div>
          )}

          {meetings.map(meeting => (
            <Card
              key={meeting.id}
              className={cn(
                "cursor-pointer hover:border-primary/30 transition-colors",
                selectedIds.has(meeting.id) && "border-primary/50 bg-primary/5"
              )}
            >
              <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {canDelete && (
                    <Checkbox
                      checked={selectedIds.has(meeting.id)}
                      onCheckedChange={() => toggleSelect(meeting.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div
                    className="flex items-center gap-3 min-w-0 flex-1"
                    onClick={() => { setSelectedMeeting(meeting); setBriefing(meeting.description || ""); }}
                  >
                    <div className={cn(
                      "rounded-full p-2 shrink-0",
                      meeting.status === "completed" ? "bg-green-500/10" :
                      meeting.status === "no_show" ? "bg-amber-500/10" : "bg-primary/10"
                    )}>
                      {meeting.status === "no_show" ? (
                        <UserX className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Video className={cn(
                          "h-4 w-4",
                          meeting.status === "completed" ? "text-green-600" : "text-primary"
                        )} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{meeting.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {meeting.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(meeting.scheduled_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        )}
                        {meeting.lead && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {meeting.lead.name}
                          </span>
                        )}
                        {meeting.responsible_staff && (
                          <Badge variant="outline" className="text-[10px] h-4">
                            {meeting.responsible_staff.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(meeting.status)}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetIds([meeting.id]);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Meeting Detail Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => { if (!open) setSelectedMeeting(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {selectedMeeting?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Data/Hora</p>
                  <p className="font-medium">
                    {selectedMeeting.scheduled_at
                      ? format(parseISO(selectedMeeting.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "Sem data"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  {getStatusBadge(selectedMeeting.status)}
                </div>
                {selectedMeeting.lead && (
                  <div>
                    <p className="text-muted-foreground text-xs">Lead</p>
                    <p className="font-medium">{selectedMeeting.lead.name}</p>
                  </div>
                )}
                {selectedMeeting.responsible_staff && (
                  <div>
                    <p className="text-muted-foreground text-xs">Responsável</p>
                    <p className="font-medium">{selectedMeeting.responsible_staff.name}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Briefing</label>
                <Textarea
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder="Descreva o que foi discutido na reunião..."
                  rows={4}
                  disabled={selectedMeeting.status === "completed" || selectedMeeting.status === "no_show"}
                />
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {selectedMeeting.lead_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/crm/leads/${selectedMeeting.lead_id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Abrir Lead
                  </Button>
                )}

                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setDeleteTargetIds([selectedMeeting.id]); setShowDeleteConfirm(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Excluir
                  </Button>
                )}

                {selectedMeeting.status !== "completed" && selectedMeeting.status !== "no_show" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNoShow}
                      disabled={saving}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <UserX className="h-3.5 w-3.5 mr-1" />}
                      No Show
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFinalize}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                      Finalizar Reunião
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTargetIds.length > 1 ? `${deleteTargetIds.length} reuniões` : "reunião"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {deleteTargetIds.length > 1
                ? `As ${deleteTargetIds.length} reuniões selecionadas serão excluídas permanentemente.`
                : "A reunião será excluída permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteTargetIds)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CRMMeetingsPage;

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Clock, Video, RefreshCw, Loader2, User, FileText, ExternalLink, CheckCircle2, CalendarIcon, Filter } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
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

interface StaffOption {
  id: string;
  name: string;
}

interface PipelineStage {
  id: string;
  name: string;
  pipeline_id: string;
}

const CRMMeetingsPage = () => {
  const { staffRole, staffId, isAdmin, isMaster } = useCRMContext();
  const navigate = useNavigate();
  const isHead = staffRole === "head_comercial";
  const canFilterStaff = isMaster || isAdmin || isHead;

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
  const [saving, setSaving] = useState(false);

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

      // Role-based filtering
      if (!canFilterStaff) {
        if (staffRole === "closer") {
          query = query.eq("responsible_staff_id", staffId);
        } else if (staffRole === "sdr") {
          // SDR sees meetings they created (via lead attribution)
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

      setMeetings((data || []) as unknown as MeetingActivity[]);
    } catch (err) {
      console.error("Error fetching meetings:", err);
      toast.error("Erro ao carregar reuniões");
    } finally {
      setLoading(false);
    }
  }, [dateRange, filterStaff, filterStatus, staffId, staffRole, canFilterStaff]);

  useEffect(() => {
    fetchStaff();
    fetchStages();
  }, [fetchStaff, fetchStages]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleFinalize = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      // Update meeting with briefing and mark completed
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          description: briefing || selectedMeeting.description,
        })
        .eq("id", selectedMeeting.id);

      if (error) throw error;

      // Move lead to "Reunião Realizada" stage if possible
      if (selectedMeeting.lead_id) {
        const currentLead = selectedMeeting.lead;
        if (currentLead?.stage_id) {
          const currentStage = stages.find(s => s.id === currentLead.stage_id);
          if (currentStage) {
            const reuniaoRealizadaStage = stages.find(
              s => s.pipeline_id === currentStage.pipeline_id &&
                (s.name.toLowerCase().includes("reunião realizada") || s.name.toLowerCase().includes("reuniao realizada"))
            );
            if (reuniaoRealizadaStage) {
              await supabase
                .from("crm_leads")
                .update({ stage_id: reuniaoRealizadaStage.id })
                .eq("id", selectedMeeting.lead_id);
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Realizada</Badge>;
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
        <Button variant="outline" size="sm" onClick={fetchMeetings} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />

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
          {meetings.map(meeting => (
            <Card
              key={meeting.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => {
                setSelectedMeeting(meeting);
                setBriefing(meeting.description || "");
              }}
            >
              <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "rounded-full p-2",
                    meeting.status === "completed" ? "bg-green-500/10" : "bg-primary/10"
                  )}>
                    <Video className={cn(
                      "h-4 w-4",
                      meeting.status === "completed" ? "text-green-600" : "text-primary"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{meeting.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                {getStatusBadge(meeting.status)}
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
                  disabled={selectedMeeting.status === "completed"}
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
                {selectedMeeting.status !== "completed" && (
                  <Button
                    size="sm"
                    onClick={handleFinalize}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                    Finalizar Reunião
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMMeetingsPage;

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Video, RefreshCw, Loader2, User, Filter, FileText, ExternalLink, CheckCircle2 } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import type { OnboardingUser } from "@/types/onboarding";
import type { ClientStage, ClientDeal } from "./hooks/useClientCRM";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string | null;
  deal_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string | null;
  deal?: { id: string; title: string; stage_id: string | null } | null;
  contact?: { id: string; name: string } | null;
  assigned_user?: { id: string; name: string } | null;
  created_user?: { id: string; name: string } | null;
}

interface ClientCRMMeetingsProps {
  projectId: string;
  currentUser: OnboardingUser | null;
  stages: ClientStage[];
  onMoveDeal: (dealId: string, stageId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const ClientCRMMeetings = ({ projectId, currentUser, stages, onMoveDeal, onRefresh }: ClientCRMMeetingsProps) => {
  const { currentStaff, isMaster } = useStaffPermissions();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [briefing, setBriefing] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectUsers, setProjectUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  const isAdmin = useMemo(() => {
    if (isMaster) return true;
    if (!currentStaff) return false;
    const role = currentStaff.role as string;
    return ["admin", "master", "head_comercial"].includes(role);
  }, [currentStaff, isMaster]);

  const isSDR = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === "vendedor";
  }, [currentUser]);

  // Load project users for filter dropdown
  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from("onboarding_users")
        .select("id, name, role")
        .eq("project_id", projectId)
        .order("name");
      if (data) setProjectUsers(data);
    };
    if (isAdmin) loadUsers();
  }, [projectId, isAdmin]);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("client_crm_activities")
        .select(`
          id, title, description, scheduled_at, completed_at, status, deal_id, contact_id, assigned_to, created_by, created_at,
          deal:client_crm_deals(id, title, stage_id),
          contact:client_crm_contacts(id, name),
          assigned_user:onboarding_users!client_crm_activities_assigned_to_fkey(id, name),
          created_user:onboarding_users!client_crm_activities_created_by_fkey(id, name)
        `)
        .eq("project_id", projectId)
        .eq("type", "meeting")
        .order("scheduled_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("scheduled_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("scheduled_at", endOfDay(dateTo).toISOString());
      }

      // Role-based filtering
      if (!isAdmin && currentUser) {
        if (isSDR) {
          // SDR sees meetings they created
          query = query.eq("created_by", currentUser.id);
        } else {
          // Closer sees meetings assigned to them
          query = query.eq("assigned_to", currentUser.id);
        }
      }

      // Staff filter (admin only)
      if (isAdmin && staffFilter !== "all") {
        query = query.or(`assigned_to.eq.${staffFilter},created_by.eq.${staffFilter}`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading meetings:", error);
        toast.error("Erro ao carregar reuniões");
      } else {
        setMeetings((data || []) as unknown as Meeting[]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, dateFrom, dateTo, staffFilter, statusFilter, currentUser, isAdmin, isSDR]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleFinalizeMeeting = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      // Update activity with briefing and mark as completed
      const { error: actError } = await supabase
        .from("client_crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          description: briefing || selectedMeeting.description,
        })
        .eq("id", selectedMeeting.id);

      if (actError) throw actError;

      // If there's a deal, try to advance to "reunião realizada" stage
      if (selectedMeeting.deal_id) {
        const reuniaoRealizadaStage = stages.find(
          (s) => s.name.toLowerCase().includes("reunião realizada") || s.name.toLowerCase().includes("reuniao realizada")
        );
        if (reuniaoRealizadaStage) {
          await onMoveDeal(selectedMeeting.deal_id, reuniaoRealizadaStage.id);
        }
      }

      toast.success("Reunião finalizada com sucesso!");
      setSelectedMeeting(null);
      setBriefing("");
      await loadMeetings();
      await onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao finalizar reunião");
    } finally {
      setSaving(false);
    }
  };

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "pending":
        return { label: "Agendada", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" };
      case "completed":
        return { label: "Realizada", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
      case "cancelled":
        return { label: "Cancelada", className: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
      default:
        return { label: status || "—", className: "bg-muted text-muted-foreground" };
    }
  };

  const isPast = (date: string | null) => date ? new Date(date) < new Date() : false;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Usuário</label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-[180px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {projectUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={loadMeetings} className="h-9">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meeting List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma reunião encontrada no período selecionado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => {
            const statusConfig = getStatusConfig(meeting.status);
            const isUpcoming = meeting.status === "pending" && !isPast(meeting.scheduled_at);
            const isMissed = meeting.status === "pending" && isPast(meeting.scheduled_at);

            return (
              <Card
                key={meeting.id}
                className={cn(
                  "transition-all hover:shadow-md cursor-pointer",
                  isUpcoming && "border-blue-200 dark:border-blue-500/20",
                  isMissed && "border-amber-200 dark:border-amber-500/20",
                  meeting.status === "cancelled" && "opacity-60",
                  meeting.status === "completed" && "border-emerald-200 dark:border-emerald-500/20"
                )}
                onClick={() => {
                  setSelectedMeeting(meeting);
                  setBriefing(meeting.description || "");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{meeting.title}</p>
                        <Badge variant="outline" className={cn("text-[10px]", statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                        {isMissed && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">
                            Atrasada
                          </Badge>
                        )}
                      </div>

                      {meeting.scheduled_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(meeting.scheduled_at), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {meeting.deal && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {meeting.deal.title}
                          </p>
                        )}
                        {meeting.contact && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {meeting.contact.name}
                          </p>
                        )}
                        {(meeting.assigned_user as any)?.name && (
                          <p className="text-xs text-primary flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {(meeting.assigned_user as any).name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {meeting.status === "pending" && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Finalizar
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Meeting Detail / Finalize Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => { if (!open) { setSelectedMeeting(null); setBriefing(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {selectedMeeting?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedMeeting?.scheduled_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {format(new Date(selectedMeeting.scheduled_at), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}

            {selectedMeeting?.deal && (
              <div className="flex items-center justify-between">
                <p className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Negócio: <span className="font-medium">{selectedMeeting.deal.title}</span>
                </p>
              </div>
            )}

            {selectedMeeting?.contact && (
              <p className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Contato: <span className="font-medium">{selectedMeeting.contact.name}</span>
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Briefing / Observações</label>
              <Textarea
                placeholder="Descreva o que aconteceu na reunião..."
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                rows={5}
                disabled={selectedMeeting?.status === "completed"}
              />
            </div>

            {selectedMeeting?.status === "completed" && (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                ✓ Reunião já finalizada
              </Badge>
            )}
          </div>

          <DialogFooter className="gap-2">
            {selectedMeeting?.deal_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open deal in a new way - we'll navigate or open deal detail
                  // For now, close dialog and set deal filter
                  toast.info("Abra a aba Negócios para ver o lead completo");
                  setSelectedMeeting(null);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Ver Lead
              </Button>
            )}

            {selectedMeeting?.status === "pending" && (
              <Button onClick={handleFinalizeMeeting} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalizar Reunião
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

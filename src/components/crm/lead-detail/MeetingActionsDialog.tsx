import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Calendar, XCircle, RefreshCw, History, User, Clock, Link2, ExternalLink, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { getEmbedUrl, isDirectVideo, isGoogleDrive, getGoogleDriveViewUrl } from "./meetingUtils";

interface MeetingActivity {
  id: string;
  title: string;
  scheduled_at: string | null;
  meeting_link: string | null;
  google_calendar_event_id: string | null;
  google_calendar_user_id: string | null;
  lead_id: string;
  status: string | null;
  recording_url?: string | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  performed_by_staff_id: string | null;
  old_scheduled_at: string | null;
  new_scheduled_at: string | null;
  notes: string | null;
  created_at: string;
  staff?: { name: string } | null;
}

interface MeetingActionsDialogProps {
  activity: MeetingActivity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MeetingActionsDialog({
  activity,
  open,
  onOpenChange,
  onSuccess,
}: MeetingActionsDialogProps) {
  const [mode, setMode] = useState<"actions" | "reschedule">("actions");
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(activity.recording_url || "");
  const [savingRecording, setSavingRecording] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    date: activity.scheduled_at ? format(new Date(activity.scheduled_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    startTime: activity.scheduled_at ? format(new Date(activity.scheduled_at), "HH:mm") : "09:00",
    endTime: "10:00",
    reason: "",
  });

  // Sync recording URL when activity changes
  useEffect(() => {
    setRecordingUrl(activity.recording_url || "");
  }, [activity]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("crm_activity_history")
        .select("*, staff:onboarding_staff!crm_activity_history_performed_by_staff_id_fkey(name)")
        .eq("activity_id", activity.id)
        .order("created_at", { ascending: false }) as any;

      if (!error && data) {
        setHistory(data);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getCurrentStaffId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    return staff?.id || null;
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const staffId = await getCurrentStaffId();

      // Delete from Google Calendar if we have the event ID
      if (activity.google_calendar_event_id) {
        try {
          const { error } = await supabase.functions.invoke(
            "google-calendar?action=delete-event",
            {
              body: {
                eventId: activity.google_calendar_event_id,
                target_user_id: activity.google_calendar_user_id,
              },
            }
          );
          if (error) {
            console.error("Google Calendar delete error:", error);
            // Continue anyway - the calendar event might have been deleted manually
          }
        } catch (calErr) {
          console.error("Calendar API error:", calErr);
        }
      }

      // Update activity status
      await supabase
        .from("crm_activities")
        .update({ status: "cancelled" })
        .eq("id", activity.id);

      // Log history
      await supabase.from("crm_activity_history").insert({
        activity_id: activity.id,
        lead_id: activity.lead_id,
        action: "cancelled",
        performed_by_staff_id: staffId,
        old_scheduled_at: activity.scheduled_at,
        notes: cancelReason || "Reunião cancelada",
      } as any);

      toast.success("Reunião cancelada com sucesso!");
      setShowCancelConfirm(false);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Erro ao cancelar reunião");
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleData.date || !rescheduleData.startTime || !rescheduleData.endTime) {
      toast.error("Preencha data e horários");
      return;
    }

    setLoading(true);
    try {
      const staffId = await getCurrentStaffId();
      const newStartDateTime = `${rescheduleData.date}T${rescheduleData.startTime}:00`;
      const newEndDateTime = `${rescheduleData.date}T${rescheduleData.endTime}:00`;

      // Update on Google Calendar if we have the event ID
      if (activity.google_calendar_event_id) {
        try {
          const { error } = await supabase.functions.invoke(
            "google-calendar?action=update-event",
            {
              body: {
                eventId: activity.google_calendar_event_id,
                title: activity.title,
                startDateTime: newStartDateTime,
                endDateTime: newEndDateTime,
                target_user_id: activity.google_calendar_user_id,
              },
            }
          );
          if (error) {
            console.error("Google Calendar update error:", error);
            toast.error("Erro ao atualizar Google Agenda, mas a atividade foi reagendada");
          }
        } catch (calErr) {
          console.error("Calendar API error:", calErr);
        }
      }

      // Update activity
      await supabase
        .from("crm_activities")
        .update({
          scheduled_at: newStartDateTime,
          status: "pending",
        })
        .eq("id", activity.id);

      // Log history
      await supabase.from("crm_activity_history").insert({
        activity_id: activity.id,
        lead_id: activity.lead_id,
        action: "rescheduled",
        performed_by_staff_id: staffId,
        old_scheduled_at: activity.scheduled_at,
        new_scheduled_at: newStartDateTime,
        notes: rescheduleData.reason || "Reunião reagendada",
      } as any);

      toast.success("Reunião reagendada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error("Erro ao reagendar reunião");
    } finally {
      setLoading(false);
    }
  };

  // Load history when dialog opens
  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  const handleSaveRecording = async () => {
    setSavingRecording(true);
    try {
      await supabase
        .from("crm_activities")
        .update({ recording_url: recordingUrl.trim() || null } as any)
        .eq("id", activity.id);
      toast.success("Link da gravação salvo!");
    } catch {
      toast.error("Erro ao salvar link");
    } finally {
      setSavingRecording(false);
    }
  };

  const actionLabels: Record<string, { label: string; color: string; icon: typeof Calendar }> = {
    scheduled: { label: "Agendada", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Calendar },
    cancelled: { label: "Cancelada", color: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: XCircle },
    rescheduled: { label: "Reagendada", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: RefreshCw },
  };

  return (
    <>
      <Dialog open={open && !showCancelConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {mode === "reschedule" ? "Reagendar Reunião" : "Gerenciar Reunião"}
            </DialogTitle>
          </DialogHeader>

          {mode === "actions" ? (
            <div className="space-y-4">
              {/* Meeting Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold">{activity.title}</p>
                {activity.scheduled_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(activity.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                {activity.meeting_link && (
                  <a href={activity.meeting_link} target="_blank" rel="noopener" className="text-xs text-primary underline">
                    Link da reunião
                  </a>
                )}
                {recordingUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 text-emerald-600 px-1 w-fit"
                    onClick={() => setShowPlayer(!showPlayer)}
                  >
                    <PlayCircle className="h-3 w-3" />
                    {showPlayer ? "Fechar player" : "Assistir gravação"}
                    {showPlayer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                )}
                {showPlayer && recordingUrl && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    {isDirectVideo(recordingUrl) ? (
                      <video src={recordingUrl} controls className="w-full aspect-video" />
                    ) : getEmbedUrl(recordingUrl) ? (
                      <iframe
                        src={getEmbedUrl(recordingUrl)!}
                        className="w-full aspect-video"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    ) : isGoogleDrive(recordingUrl) ? (
                      <div className="flex flex-col items-center justify-center py-8 bg-muted/30 gap-3">
                        <PlayCircle className="h-8 w-8 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground text-center px-4">
                          Arquivos do Google Drive não podem ser reproduzidos embutidos por restrições de privacidade.
                        </p>
                        <a
                          href={getGoogleDriveViewUrl(recordingUrl)}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir no Google Drive
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                        <p>Formato não suportado para player embutido</p>
                        <a href={recordingUrl} target="_blank" rel="noopener" className="text-primary underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recording URL */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <PlayCircle className="h-3.5 w-3.5" /> URL da Gravação
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={recordingUrl}
                      onChange={(e) => setRecordingUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... ou https://youtu.be/..."
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                  {recordingUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => window.open(recordingUrl, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={savingRecording || !recordingUrl.trim()}
                    onClick={handleSaveRecording}
                  >
                    {savingRecording ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => setMode("reschedule")}
                  disabled={activity.status === "cancelled"}
                >
                  <RefreshCw className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium">Reagendar</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-rose-500/30 hover:bg-rose-500/10"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={activity.status === "cancelled"}
                >
                  <XCircle className="h-5 w-5 text-rose-500" />
                  <span className="text-sm font-medium">Cancelar</span>
                </Button>
              </div>

              {/* History */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Histórico</h4>
                </div>

                {loadingHistory ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sem histórico registrado</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {history.map((entry) => {
                      const config = actionLabels[entry.action] || actionLabels.scheduled;
                      const Icon = config.icon;
                      return (
                        <div key={entry.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                          <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(entry.created_at), "dd/MM/yy HH:mm")}
                              </span>
                            </div>
                            {(entry.staff as any)?.name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <User className="h-2.5 w-2.5" /> {(entry.staff as any).name}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.notes}</p>
                            )}
                            {entry.action === "rescheduled" && entry.new_scheduled_at && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Nova data: {format(new Date(entry.new_scheduled_at), "dd/MM/yy HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { loadHistory(); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            /* Reschedule form */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Nova Data *</Label>
                  <Input
                    type="date"
                    value={rescheduleData.date}
                    onChange={(e) => setRescheduleData((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Input
                    type="time"
                    step={900}
                    value={rescheduleData.startTime}
                    onChange={(e) => setRescheduleData((p) => ({ ...p, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim *</Label>
                  <Input
                    type="time"
                    step={900}
                    value={rescheduleData.endTime}
                    onChange={(e) => setRescheduleData((p) => ({ ...p, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo do reagendamento</Label>
                <Textarea
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Ex: Cliente pediu para remarcar..."
                  rows={2}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setMode("actions")}>Voltar</Button>
                <Button onClick={handleReschedule} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reagendando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" /> Reagendar</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a reunião e removê-la do Google Agenda.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Motivo do cancelamento (opcional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Cliente desistiu..."
              rows={2}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando...</>
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

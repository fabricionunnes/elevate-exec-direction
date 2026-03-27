import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Video, RefreshCw, XCircle, Loader2, History, User, ExternalLink, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MeetingActionsDialog } from "./MeetingActionsDialog";
import { getEmbedUrl, isDirectVideo, isGoogleDrive, getGoogleDriveViewUrl } from "./meetingUtils";

interface MeetingActivity {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string | null;
  meeting_link: string | null;
  google_calendar_event_id: string | null;
  google_calendar_user_id: string | null;
  lead_id: string;
  responsible_staff_id: string | null;
  responsible?: { name: string } | null;
  created_at: string;
  recording_url?: string | null;
}

interface LeadMeetingsPanelProps {
  leadId: string;
  leadName: string;
}

export function LeadMeetingsPanel({ leadId, leadName }: LeadMeetingsPanelProps) {
  const [meetings, setMeetings] = useState<MeetingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingActivity | null>(null);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_activities")
        .select("id, title, description, scheduled_at, completed_at, status, meeting_link, google_calendar_event_id, google_calendar_user_id, lead_id, responsible_staff_id, created_at, recording_url, responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)")
        .eq("lead_id", leadId)
        .eq("type", "meeting")
        .order("scheduled_at", { ascending: false });

      if (!error && data) {
        setMeetings(data as any);
      }
    } catch (err) {
      console.error("Error loading meetings:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

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

  const isPast = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          Reuniões ({meetings.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={loadMeetings} className="h-7 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma reunião agendada</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            {meetings.map((meeting) => {
              const statusConfig = getStatusConfig(meeting.status);
              const isUpcoming = meeting.status === "pending" && !isPast(meeting.scheduled_at);
              const isMissed = meeting.status === "pending" && isPast(meeting.scheduled_at);

              return (
                <div
                  key={meeting.id}
                  className={cn(
                    "border rounded-xl p-4 transition-all hover:shadow-sm",
                    isUpcoming && "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-950/20",
                    isMissed && "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/20",
                    meeting.status === "cancelled" && "border-rose-200/50 bg-rose-50/30 dark:border-rose-500/10 dark:bg-rose-950/10 opacity-70",
                    meeting.status === "completed" && "border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-500/10 dark:bg-emerald-950/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
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
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(meeting.scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}

                      {(meeting.responsible as any)?.name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" />
                          {(meeting.responsible as any).name}
                        </p>
                      )}

                      {meeting.meeting_link && (
                        <a
                          href={meeting.meeting_link}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-primary underline flex items-center gap-1 mt-1"
                        >
                          <Video className="h-3 w-3" /> Link da reunião
                        </a>
                      )}

                      {meeting.recording_url && (
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-emerald-600 px-1"
                            onClick={() => setExpandedPlayer(expandedPlayer === meeting.id ? null : meeting.id)}
                          >
                            <PlayCircle className="h-3 w-3" />
                            {expandedPlayer === meeting.id ? "Fechar player" : "Assistir gravação"}
                            {expandedPlayer === meeting.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                          
                          {expandedPlayer === meeting.id && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-border bg-black">
                              {isDirectVideo(meeting.recording_url) ? (
                                <video
                                  src={meeting.recording_url}
                                  controls
                                  className="w-full aspect-video"
                                />
                              ) : getEmbedUrl(meeting.recording_url) ? (
                                <iframe
                                  src={getEmbedUrl(meeting.recording_url)!}
                                  className="w-full aspect-video"
                                  allow="autoplay; encrypted-media"
                                  allowFullScreen
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                                  <p>Formato não suportado para player embutido</p>
                                  <a href={meeting.recording_url} target="_blank" rel="noopener" className="text-primary underline flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" /> Abrir em nova aba
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {meeting.status !== "cancelled" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setSelectedMeeting(meeting)}
                        >
                          <History className="h-3 w-3" />
                          Gerenciar
                        </Button>
                      </div>
                    )}

                    {meeting.status === "cancelled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => setSelectedMeeting(meeting)}
                      >
                        <History className="h-3 w-3" />
                        Histórico
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {selectedMeeting && (
        <MeetingActionsDialog
          activity={selectedMeeting}
          open={!!selectedMeeting}
          onOpenChange={(open) => { if (!open) setSelectedMeeting(null); }}
          onSuccess={() => {
            setSelectedMeeting(null);
            loadMeetings();
          }}
        />
      )}
    </div>
  );
}

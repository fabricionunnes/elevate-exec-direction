import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTimeLocal } from "@/lib/dateUtils";
import { Video, Calendar, ExternalLink, FileText, Users, Clock, Presentation } from "lucide-react";
import { motion } from "framer-motion";
import { isFuture } from "date-fns";
import { MeetingPresentationSection } from "@/components/meetings/presentation/MeetingPresentationSection";

interface MeetingNote {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string | null;
  meeting_link: string | null;
  recording_link: string | null;
  is_finalized: boolean;
  attendees: string | null;
}

interface ClientMeetingsViewProps {
  projectId: string;
}

export function ClientMeetingsView({ projectId }: ClientMeetingsViewProps) {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingNote | null>(null);

  useEffect(() => {
    fetchMeetings();

    // Real-time subscription
    const channel = supabase
      .channel(`client-meetings-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_meeting_notes',
          filter: `project_id=eq.${projectId}`
        },
        () => fetchMeetings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchMeetings = async () => {
    // Fetch finalized meetings (history)
    const { data: finalizedData, error: finalizedError } = await supabase
      .from("onboarding_meeting_notes")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_finalized", true)
      .or("is_internal.is.null,is_internal.eq.false")
      .order("meeting_date", { ascending: false });

    // Fetch upcoming scheduled meetings (not finalized, not internal)
    const { data: upcomingData, error: upcomingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_finalized", false)
      .or("is_internal.is.null,is_internal.eq.false")
      .gte("meeting_date", new Date().toISOString())
      .order("meeting_date", { ascending: true });

    if (!finalizedError && !upcomingError) {
      setMeetings([...(upcomingData || []), ...(finalizedData || [])]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Video className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nenhuma reunião registrada</h3>
        <p className="text-sm text-muted-foreground">
          As reuniões finalizadas aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Video className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Histórico de Reuniões</h2>
        <Badge variant="secondary" className="ml-auto">
          {meetings.length} reunião{meetings.length !== 1 ? "es" : ""}
        </Badge>
      </div>

      <div className="space-y-3">
        {meetings.map((meeting, index) => {
          const isUpcoming = !meeting.is_finalized && isFuture(new Date(meeting.meeting_date));
          
          return (
            <motion.div
              key={meeting.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className={`cursor-pointer hover:bg-accent/50 transition-colors ${isUpcoming ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => setSelectedMeeting(meeting)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{meeting.meeting_title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {formatDateTimeLocal(meeting.meeting_date, "dd 'de' MMM, yyyy 'às' HH:mm")}
                        </span>
                      </div>
                      {meeting.subject && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {meeting.subject}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {isUpcoming && (
                        <Badge variant="default" className="text-xs bg-primary">
                          <Clock className="h-3 w-3 mr-1" />
                          Agendada
                        </Badge>
                      )}
                      {meeting.recording_link && (
                        <Badge variant="default" className="text-xs">
                          <Video className="h-3 w-3 mr-1" />
                          Gravação
                        </Badge>
                      )}
                      {meeting.notes && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          Notas
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Meeting Detail Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedMeeting?.meeting_title}</DialogTitle>
          </DialogHeader>
          
          {selectedMeeting && (() => {
            const isUpcoming = !selectedMeeting.is_finalized && isFuture(new Date(selectedMeeting.meeting_date));
            
            return (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  {isUpcoming && (
                    <Badge variant="default" className="bg-primary">
                      <Clock className="h-3 w-3 mr-1" />
                      Reunião Agendada
                    </Badge>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDateTimeLocal(selectedMeeting.meeting_date, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm")}
                  </div>

                  {selectedMeeting.attendees && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4" />
                        Participantes
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        {selectedMeeting.attendees}
                      </p>
                    </div>
                  )}

                  {selectedMeeting.subject && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Assunto</h4>
                      <p className="text-sm text-muted-foreground">{selectedMeeting.subject}</p>
                    </div>
                  )}

                  {selectedMeeting.notes && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Anotações da Reunião</h4>
                      <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                        {selectedMeeting.notes}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {/* Show meeting link prominently for upcoming meetings */}
                    {isUpcoming && selectedMeeting.meeting_link && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        asChild
                      >
                        <a 
                          href={selectedMeeting.meeting_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Entrar na Reunião
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                    {selectedMeeting.recording_link && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        asChild
                      >
                        <a 
                          href={selectedMeeting.recording_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Assistir Gravação
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                    {!isUpcoming && selectedMeeting.meeting_link && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                      >
                        <a 
                          href={selectedMeeting.meeting_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          Link da Reunião
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Presentation Section for Clients */}
                  <MeetingPresentationSection
                    meetingId={selectedMeeting.id}
                    projectId={projectId}
                    isStaff={false}
                    isClientView={true}
                  />
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

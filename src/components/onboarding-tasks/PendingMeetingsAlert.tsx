import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Video, Calendar, Clock, Loader2, PlayCircle, Building2 } from "lucide-react";

interface PendingMeeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string | null;
  meeting_link: string | null;
  project_id: string;
  project?: {
    product_name: string;
    onboarding_company?: {
      name: string;
    } | null;
  } | null;
}

export const PendingMeetingsAlert = () => {
  const [pendingMeetings, setPendingMeetings] = useState<PendingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<PendingMeeting | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    notes: "",
    attendees: "",
    recordingLink: "",
  });

  useEffect(() => {
    fetchPendingMeetings();
  }, []);

  const fetchPendingMeetings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current staff ID
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!staff) return;

      // Fetch unfinalized meetings where this staff is the calendar owner
      // Only show to the person who owns the calendar the meeting was scheduled on
      const { data, error } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          id,
          meeting_title,
          meeting_date,
          subject,
          notes,
          meeting_link,
          project_id,
          project:project_id (
            product_name,
            onboarding_company:onboarding_company_id (
              name
            )
          )
        `)
        .eq("calendar_owner_id", staff.id)
        .eq("is_finalized", false)
        .order("meeting_date", { ascending: true });

      if (error) throw error;

      // Transform data to match interface
      const transformedData = (data || []).map((m: any) => ({
        ...m,
        project: m.project ? {
          product_name: m.project.product_name,
          onboarding_company: m.project.onboarding_company,
        } : null,
      }));

      setPendingMeetings(transformedData);
    } catch (error) {
      console.error("Error fetching pending meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedMeeting) return;

    if (!formData.notes.trim()) {
      toast.error("Descreva o que foi tratado na reunião");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_meeting_notes")
        .update({
          notes: formData.notes.trim(),
          attendees: formData.attendees.trim() || null,
          recording_link: formData.recordingLink.trim() || null,
          is_finalized: true,
        })
        .eq("id", selectedMeeting.id);

      if (error) throw error;

      toast.success("Reunião finalizada com sucesso!");
      setSelectedMeeting(null);
      setFormData({ notes: "", attendees: "", recordingLink: "" });
      fetchPendingMeetings();
    } catch (error) {
      console.error("Error finalizing meeting:", error);
      toast.error("Erro ao finalizar reunião");
    } finally {
      setSaving(false);
    }
  };

  const openFinalizeDialog = (meeting: PendingMeeting) => {
    setSelectedMeeting(meeting);
    setFormData({
      notes: meeting.notes || "",
      attendees: "",
      recordingLink: "",
    });
  };

  if (loading || pendingMeetings.length === 0) return null;

  return (
    <>
      <Alert variant="destructive" className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800 dark:text-orange-200">
          {pendingMeetings.length === 1 
            ? "Você tem 1 reunião pendente de finalização" 
            : `Você tem ${pendingMeetings.length} reuniões pendentes de finalização`}
        </AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-300">
          <p className="mb-3">
            Registre o que foi tratado em cada reunião para manter o histórico atualizado.
          </p>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {pendingMeetings.map((meeting) => (
                <div 
                  key={meeting.id} 
                  className="flex items-center justify-between gap-4 p-2 bg-background rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{meeting.subject || meeting.meeting_title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(meeting.meeting_date), "HH:mm", { locale: ptBR })}
                      </span>
                      {meeting.project && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {meeting.project.onboarding_company?.name || meeting.project.product_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={() => openFinalizeDialog(meeting)}
                  >
                    Finalizar
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </AlertDescription>
      </Alert>

      {/* Finalize Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Finalizar Reunião
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (
            <div className="space-y-4">
              {/* Meeting Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="font-medium">{selectedMeeting.subject || selectedMeeting.meeting_title}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedMeeting.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {selectedMeeting.project && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {selectedMeeting.project.onboarding_company?.name || selectedMeeting.project.product_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>O que foi tratado na reunião? *</Label>
                <Textarea
                  placeholder="Descreva os principais pontos discutidos, decisões tomadas, próximos passos..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={5}
                />
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <Label>Participantes (opcional)</Label>
                <Input
                  placeholder="Nomes dos participantes"
                  value={formData.attendees}
                  onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                />
              </div>

              {/* Recording Link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-red-500" />
                  Link da Gravação (opcional)
                </Label>
                <Input
                  placeholder="https://drive.google.com/file/..."
                  value={formData.recordingLink}
                  onChange={(e) => setFormData({ ...formData, recordingLink: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectedMeeting(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleFinalize} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Finalizar Reunião"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

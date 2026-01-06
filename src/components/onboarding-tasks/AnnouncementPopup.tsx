import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Megaphone, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  message: string;
  target_role: string;
  created_at: string;
  created_by: string;
  creator?: { name: string };
}

interface AnnouncementPopupProps {
  staffId: string | null;
  staffRole: string | null;
}

export const AnnouncementPopup = ({ staffId, staffRole }: AnnouncementPopupProps) => {
  const [pendingAnnouncements, setPendingAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    if (!staffId || !staffRole) return;

    fetchPendingAnnouncements();

    // Subscribe to new announcements in realtime
    const channel = supabase
      .channel("announcements-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "onboarding_announcements",
        },
        (payload) => {
          const newAnnouncement = payload.new as Announcement;
          // Check if this announcement is for the current user's role
          if (
            newAnnouncement.target_role === "all" ||
            newAnnouncement.target_role === staffRole ||
            staffRole === "admin"
          ) {
            fetchPendingAnnouncements();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, staffRole]);

  const fetchPendingAnnouncements = async () => {
    if (!staffId) return;

    try {
      // Get all active announcements
      const { data: announcements, error: annError } = await supabase
        .from("onboarding_announcements")
        .select("*, creator:created_by(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (annError) throw annError;

      // Get acknowledgments for this staff
      const { data: acks, error: ackError } = await supabase
        .from("onboarding_announcement_acks")
        .select("announcement_id")
        .eq("staff_id", staffId);

      if (ackError) throw ackError;

      const ackedIds = new Set(acks?.map((a) => a.announcement_id) || []);

      // Filter out already acknowledged announcements
      const pending = (announcements || []).filter((a) => !ackedIds.has(a.id));

      setPendingAnnouncements(pending as Announcement[]);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const handleAcknowledge = async () => {
    const currentAnnouncement = pendingAnnouncements[currentIndex];
    if (!currentAnnouncement || !staffId) return;

    setAcknowledging(true);
    try {
      const { error } = await supabase
        .from("onboarding_announcement_acks")
        .insert({
          announcement_id: currentAnnouncement.id,
          staff_id: staffId,
        });

      if (error) throw error;

      toast.success("Confirmado!");

      // Remove from pending list
      const newPending = pendingAnnouncements.filter((_, i) => i !== currentIndex);
      setPendingAnnouncements(newPending);
      
      // Adjust index if needed
      if (currentIndex >= newPending.length && newPending.length > 0) {
        setCurrentIndex(newPending.length - 1);
      }
    } catch (error: any) {
      console.error("Error acknowledging:", error);
      toast.error("Erro ao confirmar");
    } finally {
      setAcknowledging(false);
    }
  };

  const currentAnnouncement = pendingAnnouncements[currentIndex];

  if (!currentAnnouncement) return null;

  return (
    <AlertDialog open={!!currentAnnouncement}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <span className="block">{currentAnnouncement.title}</span>
              <span className="text-xs font-normal text-muted-foreground">
                Por {currentAnnouncement.creator?.name || "Admin"} • {" "}
                {format(new Date(currentAnnouncement.created_at), "dd/MM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="mt-4 text-foreground text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-4 max-h-64 overflow-y-auto">
              {currentAnnouncement.message}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pendingAnnouncements.length > 1 && (
          <div className="text-center text-xs text-muted-foreground py-2">
            {currentIndex + 1} de {pendingAnnouncements.length} comunicados pendentes
          </div>
        )}

        <AlertDialogFooter>
          <Button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="w-full sm:w-auto"
            size="lg"
          >
            {acknowledging ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Estou Ciente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

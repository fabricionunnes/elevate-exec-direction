import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { playNotificationSound } from "@/lib/notificationSound";

interface Notification {
  id: string;
  staff_id: string;
  project_id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export const RealtimeNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Get current staff id
  useEffect(() => {
    let isMounted = true;
    
    const getStaffId = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || !isMounted) return;

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffError) {
          console.warn("Error fetching staff for notifications:", staffError);
          return;
        }

        if (staff && isMounted) {
          setStaffId(staff.id);
        }
      } catch (error) {
        console.warn("Error in getStaffId:", error);
      }
    };

    getStaffId();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch unread notifications
  useEffect(() => {
    if (!staffId) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("onboarding_notifications")
          .select("*")
          .eq("staff_id", staffId)
          .eq("is_read", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Error fetching notifications:", error);
          return;
        }

        if (data) {
          setNotifications(data);
        }
      } catch (error) {
        console.warn("Error in fetchNotifications:", error);
      }
    };

    fetchNotifications();
  }, [staffId]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!staffId) return;

    const channel = supabase
      .channel('staff-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'onboarding_notifications',
          filter: `staff_id=eq.${staffId}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Add to list
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show popup immediately
          setCurrentNotification(newNotification);
          setShowPopup(true);

          // Also show toast
          toast.info(newNotification.title, {
            description: newNotification.message,
            duration: 10000,
            action: {
              label: "Ver",
              onClick: () => handleGoToNotification(newNotification),
            },
          });

          // Play notification sound
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId]);


  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from("onboarding_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleGoToNotification = async (notification: Notification) => {
    await handleMarkAsRead(notification.id);
    setShowPopup(false);
    
    if (notification.project_id) {
      navigate(`/onboarding-tasks/${notification.project_id}`);
    }
  };

  const handleDismissPopup = async () => {
    if (currentNotification) {
      await handleMarkAsRead(currentNotification.id);
    }
    setShowPopup(false);
    setCurrentNotification(null);
  };

  return (
    <>
      {/* Notification popup dialog */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary animate-bounce" />
              Nova Notificação
            </DialogTitle>
          </DialogHeader>
          {currentNotification && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="destructive" className="mb-2">
                      {currentNotification.type === 'ticket' ? 'Chamado' : 'Alerta'}
                    </Badge>
                    <h4 className="font-semibold text-lg">{currentNotification.title}</h4>
                    <p className="text-muted-foreground mt-1">{currentNotification.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(currentNotification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleDismissPopup}>
                  Dispensar
                </Button>
                <Button onClick={() => handleGoToNotification(currentNotification)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Projeto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification bell with count (can be used in header) */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            variant="default"
            size="lg"
            className="rounded-full shadow-lg animate-pulse"
            onClick={() => {
              if (notifications.length > 0) {
                setCurrentNotification(notifications[0]);
                setShowPopup(true);
              }
            }}
          >
            <Bell className="h-5 w-5 mr-2" />
            {notifications.length} {notifications.length === 1 ? 'notificação' : 'notificações'}
          </Button>
        </div>
      )}
    </>
  );
};

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X, ExternalLink, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const typeLabels: Record<string, string> = {
  ticket: "Chamado",
  ticket_reply: "Resposta",
  ticket_update: "Atualização",
  nps_alert: "NPS",
  task_assigned: "Tarefa",
  support_room: "Suporte",
  kickoff_form: "Kickoff",
  company_no_consultant: "Empresa",
  notice_expiring: "Aviso",
  announcement_ack: "Comunicado",
  new_candidate: "Candidato",
  job_closed: "Vaga",
  cac_form: "CAC",
  contract: "Contrato",
  referral: "Indicação",
  service_request: "Serviço",
};

export const RealtimeNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const getStaffId = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || !isMounted) return;
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (staff && isMounted) setStaffId(staff.id);
      } catch (error) {
        console.warn("Error in getStaffId:", error);
      }
    };
    getStaffId();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!staffId) return;
    const fetchNotifications = async () => {
      try {
        const { data } = await supabase
          .from("onboarding_notifications")
          .select("*")
          .eq("staff_id", staffId)
          .eq("is_read", false)
          .order("created_at", { ascending: false });
        if (data) setNotifications(data);
      } catch (error) {
        console.warn("Error in fetchNotifications:", error);
      }
    };
    fetchNotifications();
  }, [staffId]);

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
          setNotifications(prev => [newNotification, ...prev]);
          setCurrentNotification(newNotification);
          setShowPopup(true);
          toast.info(newNotification.title, {
            description: newNotification.message,
            duration: 10000,
            action: {
              label: "Ver",
              onClick: () => handleGoToNotification(newNotification),
            },
          });
          playNotificationSound();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staffId]);

  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from("onboarding_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map(n => n.id);
    await supabase
      .from("onboarding_notifications")
      .update({ is_read: true })
      .in("id", ids);
    setNotifications([]);
    toast.success("Todas as notificações marcadas como lidas");
  };

  const handleGoToNotification = async (notification: Notification) => {
    await handleMarkAsRead(notification.id);
    setShowPopup(false);
    setSheetOpen(false);
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
      {/* New notification popup dialog */}
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
                      {typeLabels[currentNotification.type] || "Alerta"}
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

      {/* Notification bell - opens Sheet with all notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="default"
                size="lg"
                className="rounded-full shadow-lg animate-pulse"
              >
                <Bell className="h-5 w-5 mr-2" />
                {notifications.length} {notifications.length === 1 ? 'notificação' : 'notificações'}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
              <SheetHeader className="p-4 pb-2 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notificações ({notifications.length})
                  </SheetTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="gap-1.5"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Marcar todas como lidas
                  </Button>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => handleGoToNotification(notification)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              {typeLabels[notification.type] || "Alerta"}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" />
                              {format(new Date(notification.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm leading-tight truncate">
                            {notification.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          title="Marcar como lida"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </>
  );
};

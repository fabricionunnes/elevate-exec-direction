import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

interface Notification {
  id: string;
  staff_id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  crm_activity_due: "Atividade",
  task_assigned: "Tarefa",
  ticket: "Chamado",
  ticket_reply: "Resposta",
  ticket_update: "Atualização",
  nps_alert: "NPS",
  support_room: "Suporte",
  notice_expiring: "Aviso",
  new_candidate: "Candidato",
  service_request: "Serviço",
  referral: "Indicação",
  contract: "Contrato",
};

interface CRMNotificationsBellProps {
  staffId: string | null;
}

export const CRMNotificationsBell = ({ staffId }: CRMNotificationsBellProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!staffId) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("onboarding_notifications")
        .select("*")
        .eq("staff_id", staffId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setNotifications(data);
    };
    fetchNotifications();
  }, [staffId]);

  useEffect(() => {
    if (!staffId) return;
    const channel = supabase
      .channel("crm-bell-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "onboarding_notifications",
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          toast.info(n.title, {
            description: n.message,
            duration: 8000,
          });
          playNotificationSound();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId]);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await supabase
      .from("onboarding_notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map((n) => n.id);
    await supabase
      .from("onboarding_notifications")
      .update({ is_read: true })
      .in("id", ids);
    setNotifications([]);
    toast.success("Todas marcadas como lidas");
  };

  const count = notifications.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 sm:top-0 sm:right-0 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-destructive text-[10px] sm:text-[11px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {typeLabels[n.type] || "Alerta"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="font-medium text-xs leading-tight truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => markAsRead(n.id, e)}
                      title="Marcar como lida"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  staffId: string;
  isMaster: boolean;
  className?: string;
  showIcon?: boolean;
}

export const WhatsAppNotificationBadge = ({ staffId, isMaster, className, showIcon = false }: Props) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    if (!staffId && !isMaster) return;

    if (isMaster) {
      const { data } = await supabase
        .from("crm_whatsapp_conversations")
        .select("unread_count")
        .not("instance_id", "is", null);

      const total = (data || []).reduce((sum, conversation) => sum + (conversation.unread_count || 0), 0);
      setUnreadCount(total);
      return;
    }

    const { data: access } = await supabase
      .from("whatsapp_instance_access")
      .select("instance_id")
      .eq("staff_id", staffId)
      .eq("can_view", true);

    const instanceIds = (access || []).map((item) => item.instance_id);
    if (instanceIds.length === 0) {
      setUnreadCount(0);
      return;
    }

    const { data } = await supabase
      .from("crm_whatsapp_conversations")
      .select("unread_count")
      .in("instance_id", instanceIds);

    const total = (data || []).reduce((sum, conversation) => sum + (conversation.unread_count || 0), 0);
    setUnreadCount(total);
  };

  useEffect(() => {
    fetchUnread();

    const channel = supabase
      .channel("wa_unread_badge_hub")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_whatsapp_conversations",
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, isMaster]);

  if (unreadCount === 0) {
    return showIcon ? <MessageSquare className={cn("h-4 w-4", className)} /> : null;
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      {showIcon && <MessageSquare className="h-4 w-4" />}
      <Badge className="text-[10px] px-1.5 py-0 h-4 min-w-[1rem] flex items-center justify-center absolute -top-2 -right-2">
        {unreadCount > 99 ? "99+" : unreadCount}
      </Badge>
    </span>
  );
};

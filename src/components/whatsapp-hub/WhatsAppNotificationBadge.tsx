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
    let query = supabase
      .from("staff_whatsapp_conversations")
      .select("unread_count");

    if (!isMaster) {
      query = query.eq("staff_id", staffId);
    }

    const { data } = await query;
    const total = (data || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
    setUnreadCount(total);
  };

  useEffect(() => {
    if (!staffId) return;
    fetchUnread();

    const channel = supabase
      .channel("wa_unread_badge")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "staff_whatsapp_conversations",
      }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [staffId, isMaster]);

  if (unreadCount === 0) {
    return showIcon ? <MessageSquare className={cn("h-4 w-4", className)} /> : null;
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      {showIcon && <MessageSquare className="h-4 w-4" />}
      <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-[1rem] flex items-center justify-center absolute -top-2 -right-2">
        {unreadCount > 99 ? "99+" : unreadCount}
      </Badge>
    </span>
  );
};

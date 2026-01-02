import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, Edit, MessageSquare, CheckCircle, Circle, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoryItem {
  id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: { name: string } | null;
  staff?: { name: string } | null;
}

interface TaskHistoryProps {
  taskId: string;
}

export const TaskHistory = ({ taskId }: TaskHistoryProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [taskId]);

  const fetchHistory = async () => {
    try {
      // Fetch history with staff relation (user relation was removed when we dropped FK)
      const { data, error } = await supabase
        .from("onboarding_task_history")
        .select(`*, staff:onboarding_staff(name)`)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // For entries with user_id, fetch user names manually
      const historyWithUsers = await Promise.all(
        (data || []).map(async (item: any) => {
          if (item.user_id && !item.staff_id) {
            const { data: userData } = await supabase
              .from("onboarding_users")
              .select("name")
              .eq("id", item.user_id)
              .single();
            return { ...item, user: userData };
          }
          return item;
        })
      );
      
      setHistory(historyWithUsers);
    } catch (error: any) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "status_change":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "comment":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "edit":
        return <Edit className="h-4 w-4 text-amber-500" />;
      case "assign":
        return <User className="h-4 w-4 text-purple-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionText = (item: HistoryItem) => {
    switch (item.action) {
      case "status_change":
        return `alterou o status de "${item.old_value}" para "${item.new_value}"`;
      case "comment":
        return "adicionou um comentário";
      case "edit":
        return `editou ${item.field_changed}`;
      case "assign":
        return `atribuiu a tarefa para ${item.new_value}`;
      case "create":
        return "criou a tarefa";
      default:
        return item.action;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Nenhum histórico ainda
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Histórico
      </h4>
      <div className="space-y-3">
        {history.map((item) => {
          const userName = item.staff?.name || item.user?.name || "Sistema";
          return (
            <div key={item.id} className="flex gap-3 text-sm">
              <div className="flex-shrink-0 mt-0.5">{getActionIcon(item.action)}</div>
              <div>
                <span className="font-medium">{userName}</span>{" "}
                <span className="text-muted-foreground">{getActionText(item)}</span>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

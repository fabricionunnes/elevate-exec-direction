import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Calendar, Building2, ExternalLink } from "lucide-react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskNotification {
  id: string;
  title: string;
  due_date: string;
  project_id: string;
  project_name: string;
  company_name: string;
  is_overdue: boolean;
  is_today: boolean;
}

export const TaskNotificationsDialog = () => {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkForNotifications();
  }, []);

  const checkForNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is staff
      const { data: staffMember } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");

      let tasksQuery = supabase
        .from("onboarding_tasks")
        .select(`
          id,
          title,
          due_date,
          project_id,
          status,
          project:onboarding_projects(
            id,
            product_name,
            onboarding_company:onboarding_companies(name)
          )
        `)
        .neq("status", "completed")
        .not("due_date", "is", null)
        .lte("due_date", todayStr)
        .order("due_date", { ascending: true });

      const { data: tasksData, error } = await tasksQuery;

      if (error) {
        console.error("Error fetching task notifications:", error);
        return;
      }

      if (!tasksData || tasksData.length === 0) {
        setLoading(false);
        return;
      }

      const notifications: TaskNotification[] = tasksData.map((task: any) => {
        const dueDate = new Date(task.due_date + "T00:00:00");
        const todayStart = startOfDay(new Date());
        
        return {
          id: task.id,
          title: task.title,
          due_date: task.due_date,
          project_id: task.project_id,
          project_name: task.project?.product_name || "Projeto",
          company_name: task.project?.onboarding_company?.name || "Empresa",
          is_overdue: isBefore(dueDate, todayStart),
          is_today: isToday(dueDate),
        };
      });

      setTasks(notifications);
      
      // Only show dialog if there are notifications
      if (notifications.length > 0) {
        // Check if we already showed notifications today
        const lastShown = localStorage.getItem("task_notifications_last_shown");
        const todayKey = format(new Date(), "yyyy-MM-dd");
        
        if (lastShown !== todayKey) {
          setOpen(true);
          localStorage.setItem("task_notifications_last_shown", todayKey);
        }
      }
    } catch (error) {
      console.error("Error checking notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: TaskNotification) => {
    setOpen(false);
    // Navigate to project page with task ID in state so it can be opened
    navigate(`/onboarding-tasks/${task.project_id}`, { 
      state: { openTaskId: task.id } 
    });
  };

  const overdueCount = tasks.filter(t => t.is_overdue).length;
  const todayCount = tasks.filter(t => t.is_today).length;

  if (loading || tasks.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Atenção: Tarefas Pendentes
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              {overdueCount} em atraso
            </Badge>
          )}
          {todayCount > 0 && (
            <Badge className="bg-amber-500 text-sm py-1 px-3">
              {todayCount} para hoje
            </Badge>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleTaskClick(task)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {task.company_name} • {task.project_name}
                      </span>
                    </div>
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-xs ${task.is_overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {task.is_overdue 
                          ? `Atrasada desde ${format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}`
                          : "Para hoje"
                        }
                      </span>
                      {task.is_overdue && (
                        <Badge variant="destructive" className="text-xs py-0 h-5">
                          Atrasada
                        </Badge>
                      )}
                      {task.is_today && !task.is_overdue && (
                        <Badge className="bg-amber-500 text-xs py-0 h-5">
                          Hoje
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={() => { setOpen(false); navigate("/onboarding-tasks"); }}>
            Ver Todas as Tarefas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

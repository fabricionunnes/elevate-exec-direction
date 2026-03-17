import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutGrid, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TaskKanbanBoard } from "@/components/task-manager/TaskKanbanBoard";
import { TaskCalendarView } from "@/components/task-manager/TaskCalendarView";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["onboarding_task_status"];

export interface TaskWithProject {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string | null;
  due_date: string | null;
  start_date: string | null;
  project_id: string;
  responsible_staff_id: string | null;
  assignee_id: string | null;
  tags: string[] | null;
  recurrence: string | null;
  project_name: string;
  company_name: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

const TaskManagerPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("mine");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "calendar">("kanban");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentStaff) {
      loadTasks();
    }
  }, [selectedStaffId, currentStaff]);

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }

      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staffData) { navigate("/onboarding-tasks"); return; }

      setCurrentStaff(staffData);
      const adminRoles = ["admin", "master"];
      setIsAdmin(adminRoles.includes(staffData.role));

      if (adminRoles.includes(staffData.role)) {
        const { data: allStaff } = await supabase
          .from("onboarding_staff")
          .select("id, name, role")
          .eq("is_active", true)
          .order("name");
        setStaff(allStaff || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const staffIdToFilter = selectedStaffId === "mine"
        ? currentStaff?.id
        : selectedStaffId === "all"
          ? null
          : selectedStaffId;

      // Fetch non-completed tasks first (pending + in_progress), then completed separately with limit
      const fetchTasks = async (statusFilter: string[], limit: number) => {
        let q = supabase
          .from("onboarding_tasks")
          .select(`
            id, title, description, status, priority, due_date, start_date,
            project_id, responsible_staff_id, assignee_id, tags, recurrence,
            onboarding_projects!inner(product_name, onboarding_companies(name))
          `)
          .in("status", statusFilter)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(limit);

        if (staffIdToFilter) {
          q = q.eq("responsible_staff_id", staffIdToFilter);
        }
        return q;
      };

      // Fetch pending + in_progress (up to 5000)
      const { data: activeTasks, error: activeErr } = await fetchTasks(["pending", "in_progress"], 5000);
      if (activeErr) throw activeErr;

      // Fetch recent completed (up to 200)
      const { data: completedTasks, error: completedErr } = await fetchTasks(["completed"], 200);
      if (completedErr) throw completedErr;

      const data = [...(activeTasks || []), ...(completedTasks || [])];

      // For non-admin consultants, filter by their assigned companies/projects
      if (!isAdmin && currentStaff) {
        // Get projects for this consultant
        const { data: assignedProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .or(`consultant_id.eq.${currentStaff.id},cs_id.eq.${currentStaff.id}`);

        const { data: companyProjects } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`consultant_id.eq.${currentStaff.id},cs_id.eq.${currentStaff.id}`);

        if (companyProjects?.length) {
          const { data: projectsFromCompanies } = await supabase
            .from("onboarding_projects")
            .select("id")
            .in("onboarding_company_id", companyProjects.map(c => c.id));

          const allProjectIds = new Set([
            ...(assignedProjects?.map(p => p.id) || []),
            ...(projectsFromCompanies?.map(p => p.id) || []),
          ]);

          if (allProjectIds.size > 0) {
            query = query.in("project_id", Array.from(allProjectIds));
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: TaskWithProject[] = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        start_date: t.start_date,
        project_id: t.project_id,
        responsible_staff_id: t.responsible_staff_id,
        assignee_id: t.assignee_id,
        tags: t.tags,
        recurrence: t.recurrence,
        project_name: t.onboarding_projects?.product_name || "Sem projeto",
        company_name: t.onboarding_projects?.onboarding_companies?.name || "Sem empresa",
      }));

      setTasks(mapped);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, ...(newStatus === "completed" ? {} : {}) }
        : t
    ));

    try {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Status atualizado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status");
      loadTasks(); // Revert
    }
  }, []);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach(t => {
      if (t.status in counts) counts[t.status as keyof typeof counts]++;
    });
    return counts;
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Gerenciador de Tarefas</h1>
              <p className="text-xs text-muted-foreground">
                {statusCounts.pending} pendentes · {statusCounts.in_progress} em progresso · {statusCounts.completed} concluídas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar por consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">Minhas tarefas</SelectItem>
                  <SelectItem value="all">Todos os consultores</SelectItem>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "calendar")}>
              <TabsList>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="icon" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : view === "kanban" ? (
          <TaskKanbanBoard tasks={tasks} onStatusChange={updateTaskStatus} />
        ) : (
          <TaskCalendarView tasks={tasks} onStatusChange={updateTaskStatus} />
        )}
      </div>
    </div>
  );
};

export default TaskManagerPage;

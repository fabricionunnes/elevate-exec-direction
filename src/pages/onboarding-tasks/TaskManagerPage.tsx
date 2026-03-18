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
import { TaskManagerEditDialog } from "@/components/task-manager/TaskManagerEditDialog";
import { BulkActionsBar } from "@/components/task-manager/BulkActionsBar";
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
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "calendar">("kanban");
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentStaff) {
      loadTasks();
    }
  }, [selectedStaffId, currentStaff]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [selectedStaffId, selectedCompany]);

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

      // Determine which projects this staff member is responsible for
      let allowedProjectIds: string[] | null = null;

      if (!isAdmin && currentStaff) {
        // Non-admin: only see tasks from projects/companies they're assigned to
        const { data: assignedProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .or(`consultant_id.eq.${currentStaff.id},cs_id.eq.${currentStaff.id}`);

        const { data: companyProjects } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`consultant_id.eq.${currentStaff.id},cs_id.eq.${currentStaff.id}`);

        const projectIds = new Set(assignedProjects?.map(p => p.id) || []);

        if (companyProjects?.length) {
          const { data: projectsFromCompanies } = await supabase
            .from("onboarding_projects")
            .select("id")
            .in("onboarding_company_id", companyProjects.map(c => c.id));
          projectsFromCompanies?.forEach(p => projectIds.add(p.id));
        }

        allowedProjectIds = Array.from(projectIds);
        if (allowedProjectIds.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }
      } else if (isAdmin && staffIdToFilter) {
        // Admin filtering by a specific consultant: show only tasks from projects where
        // that consultant is the consultant_id or cs_id on the project or company
        const { data: assignedProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .or(`consultant_id.eq.${staffIdToFilter},cs_id.eq.${staffIdToFilter}`);

        const { data: companyProjects } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`consultant_id.eq.${staffIdToFilter},cs_id.eq.${staffIdToFilter}`);

        const projectIds = new Set(assignedProjects?.map(p => p.id) || []);

        if (companyProjects?.length) {
          const { data: projectsFromCompanies } = await supabase
            .from("onboarding_projects")
            .select("id")
            .in("onboarding_company_id", companyProjects.map(c => c.id));
          projectsFromCompanies?.forEach(p => projectIds.add(p.id));
        }

        allowedProjectIds = Array.from(projectIds);
        if (allowedProjectIds.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }
      }

      const buildQuery = (statuses: ("pending" | "in_progress" | "completed")[], limit: number) => {
        let q = supabase
          .from("onboarding_tasks")
          .select(`
            id, title, description, status, priority, due_date, start_date,
            project_id, responsible_staff_id, assignee_id, tags, recurrence,
            onboarding_projects!inner(product_name, status, onboarding_companies(name, status))
          `)
          .in("status", statuses)
          .in("onboarding_projects.status", ["active", "notice"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(limit);

        if (allowedProjectIds) {
          q = q.in("project_id", allowedProjectIds);
        }
        return q;
      };

      const [activeRes, completedRes] = await Promise.all([
        buildQuery(["pending", "in_progress"], 5000),
        buildQuery(["completed"], 200),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (completedRes.error) throw completedRes.error;

      const allData = [...(activeRes.data || []), ...(completedRes.data || [])]
        .filter((t: any) => {
          const project = t.onboarding_projects;
          if (!project) return false;
          if (project.status && !["active", "notice"].includes(project.status)) return false;
          const company = project.onboarding_companies;
          if (company?.status && company.status !== "active") return false;
          return true;
        });

      const mapped: TaskWithProject[] = allData.map((t: any) => ({
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
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
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
      loadTasks();
    }
  }, []);

  const handleTaskClick = useCallback((task: TaskWithProject) => {
    setEditingTask(task);
  }, []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const handleBulkStatusChange = useCallback(async (newStatus: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      selectedTaskIds.has(t.id) ? { ...t, status: newStatus } : t
    ));
    setSelectedTaskIds(new Set());

    try {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("onboarding_tasks")
        .update(updateData)
        .in("id", ids);

      if (error) throw error;
      toast.success(`${ids.length} tarefa(s) atualizada(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar tarefas");
      loadTasks();
    }
  }, [selectedTaskIds]);

  const handleBulkStaffChange = useCallback(async (staffId: string | null) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;

    setTasks(prev => prev.map(t =>
      selectedTaskIds.has(t.id) ? { ...t, responsible_staff_id: staffId } : t
    ));
    setSelectedTaskIds(new Set());

    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .update({ responsible_staff_id: staffId, updated_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;
      toast.success(`${ids.length} tarefa(s) transferida(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao transferir tarefas");
      loadTasks();
    }
  }, [selectedTaskIds]);

  const companies = useMemo(() => {
    const unique = new Map<string, string>();
    tasks.forEach(t => {
      if (t.company_name && t.company_name !== "Sem empresa") {
        unique.set(t.company_name, t.company_name);
      }
    });
    return Array.from(unique.values()).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedCompany === "all") return tasks;
    return tasks.filter(t => t.company_name === selectedCompany);
  }, [tasks, selectedCompany]);

  const statusCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = { overdue: 0, pending: 0, in_progress: 0, completed: 0 };
    filteredTasks.forEach(t => {
      if (t.status === "inactive") return;
      const isOverdue = t.due_date && new Date(t.due_date) < today && t.status !== "completed";
      if (isOverdue) {
        counts.overdue++;
      } else if (t.status in counts) {
        counts[t.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [filteredTasks]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 sm:py-3 space-y-2">
          {/* Row 1: Back button + title + refresh */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold truncate">Gerenciador de Tarefas</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {statusCounts.overdue > 0 && (
                    <span className="text-red-500 font-medium">{statusCounts.overdue} atraso · </span>
                  )}
                  {statusCounts.pending} pend. · {statusCounts.in_progress} progr. · {statusCounts.completed} concl.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "calendar")}>
                <TabsList className="h-8">
                  <TabsTrigger value="kanban" className="gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Kanban</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Calendário</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadTasks} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Row 2: Filters - scrollable on mobile */}
          {(isAdmin || companies.length > 1) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible scrollbar-hide">
              {isAdmin && (
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="h-8 text-xs sm:text-sm min-w-[150px] sm:w-[220px]">
                    <SelectValue placeholder="Filtrar consultor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">Minhas tarefas</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {companies.length > 1 && (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="h-8 text-xs sm:text-sm min-w-[150px] sm:w-[220px]">
                    <SelectValue placeholder="Filtrar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : view === "kanban" ? (
          <TaskKanbanBoard
            tasks={filteredTasks}
            onStatusChange={updateTaskStatus}
            onTaskClick={handleTaskClick}
            selectedTaskIds={selectedTaskIds}
            onToggleSelection={toggleTaskSelection}
          />
        ) : (
          <TaskCalendarView tasks={filteredTasks} onStatusChange={updateTaskStatus} />
        )}
      </div>

      {selectedTaskIds.size > 0 && (
        <BulkActionsBar
          count={selectedTaskIds.size}
          onClear={clearSelection}
          onStatusChange={handleBulkStatusChange}
          onStaffChange={isAdmin ? handleBulkStaffChange : undefined}
          staffList={staff}
        />
      )}

      <TaskManagerEditDialog
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onTaskUpdated={loadTasks}
        staffList={staff}
        isAdmin={isAdmin}
        currentStaffId={currentStaff?.id || null}
      />
    </div>
  );
};

export default TaskManagerPage;

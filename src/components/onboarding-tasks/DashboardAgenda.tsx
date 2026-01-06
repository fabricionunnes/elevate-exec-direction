import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isPast, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Building2, Package, Plus, ExternalLink, Circle, CalendarX, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
  title?: string;
  status: string;
  due_date: string | null;
  project_id: string;
  responsible_staff_id?: string | null;
}

interface Project {
  id: string;
  product_name: string;
  onboarding_company_id?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface DashboardAgendaProps {
  tasks: Task[];
  projects: Project[];
  companies: Company[];
  filteredProjectIds: Set<string>;
  onTaskAdded?: () => void;
}

export const DashboardAgenda = ({ tasks, projects, companies, filteredProjectIds, onTaskAdded }: DashboardAgendaProps) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  // Create maps for quick lookup
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  // Available projects for adding tasks
  const availableProjects = useMemo(() => {
    return projects.filter(p => filteredProjectIds.has(p.id));
  }, [projects, filteredProjectIds]);

  // Filtered projects based on search
  const filteredAvailableProjects = useMemo(() => {
    if (!projectSearch.trim()) return availableProjects;
    
    const searchLower = projectSearch.toLowerCase();
    return availableProjects.filter(project => {
      const company = project.onboarding_company_id 
        ? companyMap.get(project.onboarding_company_id) 
        : null;
      const companyName = company?.name?.toLowerCase() || "";
      const productName = project.product_name?.toLowerCase() || "";
      
      return companyName.includes(searchLower) || productName.includes(searchLower);
    });
  }, [availableProjects, projectSearch, companyMap]);

  // Get tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    
    tasks.forEach(task => {
      if (!task.due_date || !filteredProjectIds.has(task.project_id)) return;
      
      const dateKey = format(parseISO(task.due_date), "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(task);
    });
    
    return map;
  }, [tasks, filteredProjectIds]);

  // Get tasks without due date
  const tasksWithoutDate = useMemo(() => {
    return tasks.filter(task => 
      !task.due_date && 
      filteredProjectIds.has(task.project_id) &&
      task.status !== "completed"
    );
  }, [tasks, filteredProjectIds]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get tasks for selected day
  const selectedDayTasks = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return tasksByDate.get(dateKey) || [];
  }, [selectedDate, tasksByDate]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayDialog(true);
  };

  const handleAddTaskClick = (date: Date) => {
    setSelectedDate(date);
    setNewTaskTitle("");
    setNewTaskProjectId("");
    setProjectSearch("");
    setShowAddTaskDialog(true);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !newTaskProjectId || !selectedDate) return;

    setAddingTask(true);
    try {
      const { error } = await supabase
        .from("onboarding_tasks")
        .insert({
          title: newTaskTitle.trim(),
          project_id: newTaskProjectId,
          due_date: format(selectedDate, "yyyy-MM-dd"),
          status: "pending",
          sort_order: 0,
        });

      if (error) throw error;

      toast.success("Tarefa adicionada com sucesso!");
      setShowAddTaskDialog(false);
      setNewTaskTitle("");
      setNewTaskProjectId("");
      onTaskAdded?.();
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Erro ao adicionar tarefa");
    } finally {
      setAddingTask(false);
    }
  };

  const getTasksCountForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return tasksByDate.get(dateKey)?.length || 0;
  };

  const getStatusForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayTasks = tasksByDate.get(dateKey) || [];
    
    if (dayTasks.length === 0) return null;
    
    const hasOverdue = dayTasks.some(t => t.status !== "completed" && isPast(date) && !isToday(date));
    const hasToday = isToday(date) && dayTasks.some(t => t.status !== "completed");
    const hasInProgress = dayTasks.some(t => t.status === "in_progress");
    const allCompleted = dayTasks.every(t => t.status === "completed");
    const hasPending = dayTasks.some(t => t.status === "pending" && !isPast(date));
    
    if (hasOverdue) return "overdue";
    if (hasToday) return "today";
    if (hasInProgress) return "in_progress";
    if (allCompleted) return "completed";
    if (hasPending) return "pending";
    return null;
  };

  const getTaskInfo = (task: Task) => {
    const project = projectMap.get(task.project_id);
    const company = project?.onboarding_company_id ? companyMap.get(project.onboarding_company_id) : null;
    return { project, company };
  };

  const handleTaskClick = (task: Task) => {
    setShowDayDialog(false);
    navigate(`/onboarding-tasks/${task.project_id}?task=${task.id}`);
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Agenda de Tarefas
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const taskCount = getTasksCountForDay(day);
              const dayStatus = getStatusForDay(day);
              const isTodayDate = isToday(day);
              
              return (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative p-1 sm:p-2 rounded-lg text-center transition-all min-h-[48px] sm:min-h-[60px]
                    flex flex-col items-center justify-start cursor-pointer group
                    ${!isCurrentMonth ? 'opacity-30' : ''}
                    ${isTodayDate ? 'ring-2 ring-primary' : ''}
                    ${dayStatus === 'overdue' ? 'bg-red-50 dark:bg-red-950/30' : ''}
                    ${dayStatus === 'today' ? 'bg-orange-50 dark:bg-orange-950/30' : ''}
                    ${dayStatus === 'in_progress' ? 'bg-amber-50 dark:bg-amber-950/30' : ''}
                    ${dayStatus === 'completed' ? 'bg-green-50 dark:bg-green-950/30' : ''}
                    ${dayStatus === 'pending' ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
                    ${!dayStatus && isCurrentMonth ? 'bg-muted/30 hover:bg-muted/50' : ''}
                  `}
                >
                  <span className={`
                    text-xs sm:text-sm font-medium
                    ${isTodayDate ? 'text-primary font-bold' : ''}
                    ${dayStatus === 'overdue' ? 'text-red-700 dark:text-red-400' : ''}
                    ${dayStatus === 'completed' ? 'text-green-700 dark:text-green-400' : ''}
                  `}>
                    {format(day, "d")}
                  </span>
                  
                  {taskCount > 0 && (
                    <div className="mt-0.5">
                      <Badge 
                        variant="secondary" 
                        className={`
                          text-[9px] sm:text-[10px] px-1 py-0 h-4
                          ${dayStatus === 'overdue' ? 'bg-red-500 text-white hover:bg-red-600' : ''}
                          ${dayStatus === 'today' ? 'bg-orange-500 text-white hover:bg-orange-600' : ''}
                          ${dayStatus === 'in_progress' ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}
                          ${dayStatus === 'completed' ? 'bg-green-500 text-white hover:bg-green-600' : ''}
                          ${dayStatus === 'pending' ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                        `}
                      >
                        {taskCount}
                      </Badge>
                    </div>
                  )}

                  {/* Add button on hover */}
                  {isCurrentMonth && taskCount === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bottom-1 right-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddTaskClick(day);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-muted-foreground">Atrasado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-muted-foreground">Hoje</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-muted-foreground">Em andamento</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-muted-foreground">Concluído</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-muted-foreground">Pendente</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Without Due Date */}
      {tasksWithoutDate.length > 0 && (
        <Card className="col-span-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base sm:text-lg">
              <span className="flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-muted-foreground" />
                Tarefas sem Data
              </span>
              <Badge variant="secondary" className="ml-2">
                {tasksWithoutDate.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ScrollArea className="max-h-[300px]">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tasksWithoutDate.map(task => {
                  const { project, company } = getTaskInfo(task);
                  
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleTaskClick(task)}
                      className="p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/50 bg-card"
                    >
                      <div className="flex items-start gap-2">
                        <CalendarX className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {company && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{company.name}</span>
                              </div>
                            )}
                            {project && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <span className="truncate max-w-[80px]">{project.product_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Day Tasks Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDayDialog(false);
                  if (selectedDate) handleAddTaskClick(selectedDate);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              {selectedDayTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma tarefa para este dia</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setShowDayDialog(false);
                      if (selectedDate) handleAddTaskClick(selectedDate);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar tarefa
                  </Button>
                </div>
              ) : (
                selectedDayTasks.map(task => {
                  const { project, company } = getTaskInfo(task);
                  const isOverdue = task.status !== "completed" && selectedDate && isPast(selectedDate) && !isToday(selectedDate);
                  
                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => handleTaskClick(task)}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-all
                        hover:shadow-md hover:border-primary/50
                        ${task.status === "completed" 
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50' 
                          : task.status === "in_progress"
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                            : isOverdue
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                              : 'bg-card'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className="mt-0.5">
                          {task.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                          ) : isOverdue ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${task.status === "completed" ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {company && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">{company.name}</span>
                              </div>
                            )}
                            {project && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{project.product_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Navigate icon */}
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {selectedDayTasks.length > 0 && (
            <div className="text-center text-xs text-muted-foreground pt-2 border-t">
              Clique em uma tarefa para abrir no projeto
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nova Tarefa
              {selectedDate && (
                <Badge variant="outline" className="ml-2">
                  {format(selectedDate, "dd/MM/yyyy")}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agenda-task-title">Título da Tarefa</Label>
              <Input
                id="agenda-task-title"
                placeholder="Ex: Reunião de alinhamento..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Projeto</Label>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa ou projeto..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Project List */}
              <div className="border rounded-lg bg-muted/30">
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {filteredAvailableProjects.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum projeto encontrado</p>
                      </div>
                    ) : (
                      filteredAvailableProjects.map((project) => {
                        const company = project.onboarding_company_id 
                          ? companyMap.get(project.onboarding_company_id) 
                          : null;
                        const isSelected = newTaskProjectId === project.id;
                        
                        return (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => setNewTaskProjectId(project.id)}
                            className={`
                              w-full text-left p-3 rounded-md transition-all
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted bg-background'
                              }
                            `}
                          >
                            <div className="flex items-start gap-2">
                              <Building2 className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {company?.name || "Sem empresa"}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Package className={`h-3 w-3 shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
                                  <span className={`text-xs truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                    {project.product_name}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {filteredAvailableProjects.length} projeto(s) disponível(is)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddTask} 
              disabled={!newTaskTitle.trim() || !newTaskProjectId || addingTask}
            >
              {addingTask ? "Adicionando..." : "Adicionar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2, AlertTriangle, Play, RefreshCw, CalendarX, CalendarPlus, Umbrella } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addDays, differenceInDays, parseISO, isSaturday, isSunday, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";

// Brazilian national holidays (fixed dates)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1 },   // Ano Novo
  { month: 4, day: 21 },  // Tiradentes
  { month: 5, day: 1 },   // Dia do Trabalho
  { month: 9, day: 7 },   // Independência
  { month: 10, day: 12 }, // Nossa Senhora Aparecida
  { month: 11, day: 2 },  // Finados
  { month: 11, day: 15 }, // Proclamação da República
  { month: 12, day: 25 }, // Natal
];

// Calculate Easter and variable holidays for a given year
const getEasterDate = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getVariableHolidays = (year: number): Date[] => {
  const easter = getEasterDate(year);
  return [
    addDays(easter, -47), // Carnaval segunda
    addDays(easter, -46), // Carnaval terça
    addDays(easter, -2),  // Sexta-feira Santa
    addDays(easter, 60),  // Corpus Christi
  ];
};

const isHoliday = (date: Date): boolean => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Check fixed holidays
  for (const holiday of FIXED_HOLIDAYS) {
    if (holiday.month === month && holiday.day === day) {
      return true;
    }
  }
  
  // Check variable holidays
  const variableHolidays = getVariableHolidays(year);
  for (const holiday of variableHolidays) {
    if (
      holiday.getFullYear() === year &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === day
    ) {
      return true;
    }
  }
  
  return false;
};

const isWeekendOrHoliday = (date: Date): boolean => {
  return isSaturday(date) || isSunday(date) || isHoliday(date);
};

const getNextBusinessDay = (date: Date): Date => {
  let nextDay = date;
  
  // If Saturday, move to Monday (+2 days)
  if (isSaturday(date)) {
    nextDay = addDays(date, 2);
  }
  // If Sunday, move to Tuesday (+2 days, because Monday might have tasks from Saturday)
  else if (isSunday(date)) {
    nextDay = addDays(date, 2);
  }
  // If holiday, move to next day
  else if (isHoliday(date)) {
    nextDay = addDays(date, 1);
  }
  
  // Keep moving if the new day is also a weekend or holiday
  while (isWeekendOrHoliday(nextDay)) {
    nextDay = addDays(nextDay, 1);
  }
  
  return nextDay;
};

interface ProjectSummary {
  project_id: string;
  project_name: string;
  company_name: string;
  task_count: number;
  earliest_date: string;
  latest_date: string;
  days_shift: number;
}

interface NoDateProjectSummary {
  project_id: string;
  project_name: string;
  company_name: string;
  task_count: number;
}

interface WeekendHolidayTask {
  id: string;
  due_date: string;
  project_id: string;
  project_name: string;
  company_name: string;
}

export default function RescheduleTasks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProject, setCurrentProject] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [noDateProjects, setNoDateProjects] = useState<NoDateProjectSummary[]>([]);
  const [weekendHolidayTasks, setWeekendHolidayTasks] = useState<WeekendHolidayTask[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalNoDateTasks, setTotalNoDateTasks] = useState(0);
  const [totalWeekendHolidayTasks, setTotalWeekendHolidayTasks] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [completedNoDate, setCompletedNoDate] = useState(false);
  const [completedWeekendHoliday, setCompletedWeekendHoliday] = useState(false);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [activeTab, setActiveTab] = useState("reschedule");

  const WEEKEND_PAGE_SIZE = 50;
  const [weekendVisibleCount, setWeekendVisibleCount] = useState(WEEKEND_PAGE_SIZE);

  useEffect(() => {
    fetchProjectsSummary();
  }, []);

  const fetchProjectsSummary = async () => {
    setLoading(true);
    try {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Fetch tasks WITH dates - only from active projects
      const { data: projectsData, error } = await supabase
        .from('onboarding_tasks')
        .select(`
          project_id,
          due_date,
          onboarding_projects!inner(
            status,
            product_name,
            onboarding_companies(name)
          )
        `)
        .not('due_date', 'is', null)
        .neq('status', 'completed')
        .eq('onboarding_projects.status', 'active')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Fetch tasks WITHOUT dates - only from active projects
      const { data: noDateData, error: noDateError } = await supabase
        .from('onboarding_tasks')
        .select(`
          project_id,
          id,
          onboarding_projects!inner(
            status,
            product_name,
            onboarding_companies(name)
          )
        `)
        .is('due_date', null)
        .neq('status', 'completed')
        .eq('onboarding_projects.status', 'active');

      if (noDateError) throw noDateError;

      // Process tasks WITH dates
      const projectMap = new Map<string, {
        tasks: string[];
        earliest: string;
        latest: string;
        product_name: string;
        company_name: string;
      }>();

      projectsData?.forEach((task: any) => {
        const pid = task.project_id;
        if (!projectMap.has(pid)) {
          projectMap.set(pid, {
            tasks: [],
            earliest: task.due_date,
            latest: task.due_date,
            product_name: task.onboarding_projects?.product_name || 'Projeto',
            company_name: task.onboarding_projects?.onboarding_companies?.name || 'Empresa'
          });
        }
        const proj = projectMap.get(pid)!;
        proj.tasks.push(task.due_date);
        if (task.due_date < proj.earliest) proj.earliest = task.due_date;
        if (task.due_date > proj.latest) proj.latest = task.due_date;
      });

      const summaries: ProjectSummary[] = [];
      let total = 0;

      projectMap.forEach((data, pid) => {
        const earliestDate = parseISO(data.earliest);
        const tomorrowDate = parseISO(tomorrow);
        const daysShift = differenceInDays(tomorrowDate, earliestDate);

        summaries.push({
          project_id: pid,
          project_name: data.product_name,
          company_name: data.company_name,
          task_count: data.tasks.length,
          earliest_date: data.earliest,
          latest_date: data.latest,
          days_shift: daysShift
        });
        total += data.tasks.length;
      });

      summaries.sort((a, b) => b.task_count - a.task_count);
      setProjects(summaries);
      setTotalTasks(total);

      // Process tasks WITHOUT dates
      const noDateMap = new Map<string, {
        task_count: number;
        product_name: string;
        company_name: string;
      }>();

      noDateData?.forEach((task: any) => {
        const pid = task.project_id;
        if (!noDateMap.has(pid)) {
          noDateMap.set(pid, {
            task_count: 0,
            product_name: task.onboarding_projects?.product_name || 'Projeto',
            company_name: task.onboarding_projects?.onboarding_companies?.name || 'Empresa'
          });
        }
        noDateMap.get(pid)!.task_count++;
      });

      const noDateSummaries: NoDateProjectSummary[] = [];
      let totalNoDate = 0;

      noDateMap.forEach((data, pid) => {
        noDateSummaries.push({
          project_id: pid,
          project_name: data.product_name,
          company_name: data.company_name,
          task_count: data.task_count
        });
        totalNoDate += data.task_count;
      });

      noDateSummaries.sort((a, b) => b.task_count - a.task_count);
      setNoDateProjects(noDateSummaries);
      setTotalNoDateTasks(totalNoDate);

      // Fetch ALL tasks on weekends or holidays - paginated to get more than 1000
      const PAGE_SIZE = 1000;
      let allDatedTasks: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error: weekendError } = await supabase
          .from('onboarding_tasks')
          .select(`
            id,
            due_date,
            project_id,
            onboarding_projects!inner(
              status,
              product_name,
              onboarding_companies(name)
            )
          `)
          .not('due_date', 'is', null)
          .neq('status', 'completed')
          .eq('onboarding_projects.status', 'active')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (weekendError) throw weekendError;

        if (pageData && pageData.length > 0) {
          allDatedTasks = [...allDatedTasks, ...pageData];
          hasMore = pageData.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[RescheduleTasks] Total tasks fetched: ${allDatedTasks.length}`);

      const weekendHolidayList: WeekendHolidayTask[] = [];
      allDatedTasks?.forEach((task: any) => {
        // Parse date manually to avoid timezone issues - due_date is in YYYY-MM-DD format
        const dateParts = task.due_date.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
        const day = parseInt(dateParts[2], 10);
        const taskDate = new Date(year, month, day);
        
        if (isWeekendOrHoliday(taskDate)) {
          weekendHolidayList.push({
            id: task.id,
            due_date: task.due_date,
            project_id: task.project_id,
            project_name: task.onboarding_projects?.product_name || 'Projeto',
            company_name: task.onboarding_projects?.onboarding_companies?.name || 'Empresa'
          });
        }
      });

      console.log(`[RescheduleTasks] Weekend/holiday tasks found: ${weekendHolidayList.length}`);

      setWeekendHolidayTasks(weekendHolidayList);
      setTotalWeekendHolidayTasks(weekendHolidayList.length);
      setWeekendVisibleCount(WEEKEND_PAGE_SIZE);

    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  const rescheduleAllTasks = async () => {
    if (!confirm(`Tem certeza que deseja reagendar ${totalTasks} tarefas em ${projects.length} projetos?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    setProcessing(true);
    setProgress(0);
    setUpdatedCount(0);

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    let processed = 0;
    let updated = 0;

    try {
      for (const project of projects) {
        setCurrentProject(`${project.company_name} - ${project.project_name}`);

        const { data: tasks, error: fetchError } = await supabase
          .from('onboarding_tasks')
          .select('id, due_date, title')
          .eq('project_id', project.project_id)
          .not('due_date', 'is', null)
          .neq('status', 'completed')
          .order('due_date', { ascending: true });

        if (fetchError) {
          console.error(`Error fetching tasks for project ${project.project_id}:`, fetchError);
          continue;
        }

        if (!tasks || tasks.length === 0) continue;

        const earliestTaskDate = parseISO(tasks[0].due_date);
        const tomorrowDate = parseISO(tomorrow);
        const daysToShift = differenceInDays(tomorrowDate, earliestTaskDate);

        if (daysToShift <= 0) {
          processed += tasks.length;
          setProgress((processed / totalTasks) * 100);
          continue;
        }

        for (const task of tasks) {
          const currentDate = parseISO(task.due_date);
          const newDate = addDays(currentDate, daysToShift);
          const newDateStr = format(newDate, 'yyyy-MM-dd');

          const { error: updateError } = await supabase
            .from('onboarding_tasks')
            .update({ due_date: newDateStr, updated_at: new Date().toISOString() })
            .eq('id', task.id);

          if (updateError) {
            console.error(`Error updating task ${task.id}:`, updateError);
          } else {
            updated++;
          }

          processed++;
          setProgress((processed / totalTasks) * 100);
          setUpdatedCount(updated);
        }
      }

      setCompleted(true);
      toast.success(`${updated} tarefas reagendadas com sucesso!`);
    } catch (error) {
      console.error('Error rescheduling tasks:', error);
      toast.error('Erro ao reagendar tarefas');
    } finally {
      setProcessing(false);
      setCurrentProject("");
    }
  };

  const assignDatesToTasks = async () => {
    if (!confirm(`Tem certeza que deseja atribuir datas a ${totalNoDateTasks} tarefas em ${noDateProjects.length} projetos?\n\nAs tarefas serão distribuídas proporcionalmente nos próximos 180 dias.\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    setProcessing(true);
    setProgress(0);
    setUpdatedCount(0);

    const TOTAL_DAYS = 180;
    let processed = 0;
    let updated = 0;

    try {
      for (const project of noDateProjects) {
        setCurrentProject(`${project.company_name} - ${project.project_name}`);

        // Fetch all tasks without dates for this project
        const { data: tasks, error: fetchError } = await supabase
          .from('onboarding_tasks')
          .select('id, title, sort_order, created_at')
          .eq('project_id', project.project_id)
          .is('due_date', null)
          .neq('status', 'completed')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (fetchError) {
          console.error(`Error fetching tasks for project ${project.project_id}:`, fetchError);
          continue;
        }

        if (!tasks || tasks.length === 0) continue;

        const taskCount = tasks.length;
        // Calculate interval between tasks (at least 1 day)
        const daysBetweenTasks = Math.max(1, Math.floor(TOTAL_DAYS / taskCount));

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          // Start from tomorrow, add days based on position
          const daysFromNow = 1 + (i * daysBetweenTasks);
          const newDate = addDays(new Date(), daysFromNow);
          const newDateStr = format(newDate, 'yyyy-MM-dd');

          const { error: updateError } = await supabase
            .from('onboarding_tasks')
            .update({ due_date: newDateStr, updated_at: new Date().toISOString() })
            .eq('id', task.id);

          if (updateError) {
            console.error(`Error updating task ${task.id}:`, updateError);
          } else {
            updated++;
          }

          processed++;
          setProgress((processed / totalNoDateTasks) * 100);
          setUpdatedCount(updated);
        }
      }

      setCompletedNoDate(true);
      toast.success(`${updated} tarefas receberam datas com sucesso!`);
    } catch (error) {
      console.error('Error assigning dates:', error);
      toast.error('Erro ao atribuir datas');
    } finally {
      setProcessing(false);
      setCurrentProject("");
    }
  };

  const moveWeekendHolidayTasks = async () => {
    if (!confirm(`Tem certeza que deseja mover ${totalWeekendHolidayTasks} tarefas de finais de semana e feriados para dias úteis?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    setProcessing(true);
    setProgress(0);
    setUpdatedCount(0);

    let updated = 0;
    const BATCH_SIZE = 50;

    try {
      setCurrentProject("Preparando tarefas...");
      
      // Group tasks by their new date to batch updates
      const taskUpdates: { id: string; newDate: string }[] = [];
      
      for (const task of weekendHolidayTasks) {
        const currentDate = parseISO(task.due_date);
        const newDate = getNextBusinessDay(currentDate);
        const newDateStr = format(newDate, 'yyyy-MM-dd');
        taskUpdates.push({ id: task.id, newDate: newDateStr });
      }

      // Process in batches
      for (let i = 0; i < taskUpdates.length; i += BATCH_SIZE) {
        const batch = taskUpdates.slice(i, i + BATCH_SIZE);
        setCurrentProject(`Processando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(taskUpdates.length / BATCH_SIZE)}...`);
        
        // Update each task in the batch (Promise.all for parallelism within batch)
        const results = await Promise.all(
          batch.map(async (task) => {
            const { error } = await supabase
              .from('onboarding_tasks')
              .update({ due_date: task.newDate, updated_at: new Date().toISOString() })
              .eq('id', task.id);
            return !error;
          })
        );
        
        updated += results.filter(Boolean).length;
        setProgress(((i + batch.length) / taskUpdates.length) * 100);
        setUpdatedCount(updated);
      }

      setCompletedWeekendHoliday(true);
      toast.success(`${updated} tarefas movidas para dias úteis!`);
      
      // Refresh to update counts
      await fetchProjectsSummary();
    } catch (error) {
      console.error('Error moving weekend/holiday tasks:', error);
      toast.error('Erro ao mover tarefas');
    } finally {
      setProcessing(false);
      setCurrentProject("");
    }
  };

  const tomorrow = format(addDays(new Date(), 1), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <NexusHeader title="Reagendar Tarefas" />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === "weekends") setWeekendVisibleCount(WEEKEND_PAGE_SIZE);
        }}>

          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reschedule" className="flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Reagendar</span> ({totalTasks})
            </TabsTrigger>
            <TabsTrigger value="assign-dates" className="flex items-center gap-2 text-xs sm:text-sm">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Sem Data</span> ({totalNoDateTasks})
            </TabsTrigger>
            <TabsTrigger value="weekends" className="flex items-center gap-2 text-xs sm:text-sm">
              <Umbrella className="h-4 w-4" />
              <span className="hidden sm:inline">Fds/Feriados</span> ({totalWeekendHolidayTasks})
            </TabsTrigger>
          </TabsList>

          {/* Reschedule Tab */}
          <TabsContent value="reschedule" className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                Esta ação irá mover TODAS as tarefas não concluídas para começar amanhã ({tomorrow}), 
                mantendo os intervalos proporcionais entre elas. Esta ação não pode ser desfeita!
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Reagendar Tarefas
                </CardTitle>
                <CardDescription>
                  Mover todas as tarefas para começar amanhã, mantendo intervalos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">{totalTasks}</div>
                        <div className="text-sm text-muted-foreground">Tarefas a reagendar</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">{projects.length}</div>
                        <div className="text-sm text-muted-foreground">Projetos afetados</div>
                      </div>
                    </div>

                    {!completed && (
                      <Button 
                        onClick={rescheduleAllTasks} 
                        disabled={processing || totalTasks === 0}
                        className="w-full"
                        size="lg"
                      >
                        {processing && activeTab === "reschedule" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Reagendamento
                          </>
                        )}
                      </Button>
                    )}

                    {processing && activeTab === "reschedule" && (
                      <div className="space-y-2">
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Processando: {currentProject}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="text-center text-sm">
                          {updatedCount} tarefas atualizadas
                        </div>
                      </div>
                    )}

                    {completed && (
                      <Alert className="border-green-500 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle className="text-green-700">Concluído!</AlertTitle>
                        <AlertDescription className="text-green-600">
                          {updatedCount} tarefas foram reagendadas com sucesso.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!loading && projects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Projetos com Tarefas Datadas</CardTitle>
                  <CardDescription>
                    Lista de projetos e quantas tarefas serão movidas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {projects.map((project) => (
                      <div 
                        key={project.project_id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{project.company_name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {project.project_name}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-semibold">{project.task_count} tarefas</div>
                          <div className="text-xs text-muted-foreground">
                            {project.days_shift > 0 ? (
                              <span className="text-orange-500">+{project.days_shift} dias</span>
                            ) : project.days_shift < 0 ? (
                              <span className="text-green-500">Já no futuro</span>
                            ) : (
                              <span>Sem alteração</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Assign Dates Tab */}
          <TabsContent value="assign-dates" className="space-y-4">
            <Alert>
              <CalendarX className="h-4 w-4" />
              <AlertTitle>Tarefas sem Data</AlertTitle>
              <AlertDescription>
                Esta ação irá atribuir datas a todas as tarefas sem data, distribuindo-as proporcionalmente 
                ao longo dos próximos 180 dias para cada projeto. Esta ação não pode ser desfeita!
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5" />
                  Atribuir Datas
                </CardTitle>
                <CardDescription>
                  Distribuir tarefas proporcionalmente nos próximos 180 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">{totalNoDateTasks}</div>
                        <div className="text-sm text-muted-foreground">Tarefas sem data</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">{noDateProjects.length}</div>
                        <div className="text-sm text-muted-foreground">Projetos afetados</div>
                      </div>
                    </div>

                    {!completedNoDate && (
                      <Button 
                        onClick={assignDatesToTasks} 
                        disabled={processing || totalNoDateTasks === 0}
                        className="w-full"
                        size="lg"
                      >
                        {processing && activeTab === "assign-dates" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="h-4 w-4 mr-2" />
                            Atribuir Datas às Tarefas
                          </>
                        )}
                      </Button>
                    )}

                    {processing && activeTab === "assign-dates" && (
                      <div className="space-y-2">
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Processando: {currentProject}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="text-center text-sm">
                          {updatedCount} tarefas atualizadas
                        </div>
                      </div>
                    )}

                    {completedNoDate && (
                      <Alert className="border-green-500 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle className="text-green-700">Concluído!</AlertTitle>
                        <AlertDescription className="text-green-600">
                          {updatedCount} tarefas receberam datas com sucesso.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!loading && noDateProjects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Projetos com Tarefas sem Data</CardTitle>
                  <CardDescription>
                    Lista de projetos e quantas tarefas receberão datas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {noDateProjects.map((project) => {
                      const daysBetween = Math.max(1, Math.floor(180 / project.task_count));
                      return (
                        <div 
                          key={project.project_id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{project.company_name}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {project.project_name}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold">{project.task_count} tarefas</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="text-blue-500">~{daysBetween} dias entre cada</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Weekends & Holidays Tab */}
          <TabsContent value="weekends" className="space-y-4">
            <Alert>
              <Umbrella className="h-4 w-4" />
              <AlertTitle>Finais de Semana e Feriados</AlertTitle>
              <AlertDescription>
                Move tarefas de sábados para segunda-feira e domingos para terça-feira.
                Tarefas em feriados nacionais são movidas para o próximo dia útil.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Umbrella className="h-5 w-5" />
                  Mover para Dias Úteis
                </CardTitle>
                <CardDescription>
                  Feriados nacionais considerados: Ano Novo, Tiradentes, Dia do Trabalho, 
                  Independência, Aparecida, Finados, Proclamação da República, Natal, 
                  Carnaval, Sexta-feira Santa e Corpus Christi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">{totalWeekendHolidayTasks}</div>
                        <div className="text-sm text-muted-foreground">Tarefas a mover</div>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <div className="text-3xl font-bold">
                          {new Set(weekendHolidayTasks.map(t => t.project_id)).size}
                        </div>
                        <div className="text-sm text-muted-foreground">Projetos afetados</div>
                      </div>
                    </div>

                    {!completedWeekendHoliday && (
                      <Button 
                        onClick={moveWeekendHolidayTasks} 
                        disabled={processing || totalWeekendHolidayTasks === 0}
                        className="w-full"
                        size="lg"
                      >
                        {processing && activeTab === "weekends" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Mover Tarefas para Dias Úteis
                          </>
                        )}
                      </Button>
                    )}

                    {processing && activeTab === "weekends" && (
                      <div className="space-y-2">
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{currentProject}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="text-center text-sm">
                          {updatedCount} tarefas atualizadas
                        </div>
                      </div>
                    )}

                    {completedWeekendHoliday && (
                      <Alert className="border-green-500 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle className="text-green-700">Concluído!</AlertTitle>
                        <AlertDescription className="text-green-600">
                          {updatedCount} tarefas movidas para dias úteis.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!loading && weekendHolidayTasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tarefas em Finais de Semana/Feriados</CardTitle>
                  <CardDescription>
                    Lista de tarefas que serão movidas para dias úteis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {weekendHolidayTasks.slice(0, weekendVisibleCount).map((task) => {
                      const taskDate = parseISO(task.due_date);
                      const newDate = getNextBusinessDay(taskDate);
                      const dayName = format(taskDate, 'EEEE', { locale: ptBR });
                      return (
                        <div 
                          key={task.id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{task.company_name}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {task.project_name}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-sm">
                              <span className="text-orange-500 capitalize">{dayName}</span>
                              {" "}
                              {format(taskDate, "dd/MM")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              → <span className="text-green-600">{format(newDate, "EEEE dd/MM", { locale: ptBR })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {weekendHolidayTasks.length > weekendVisibleCount && (
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={() => setWeekendVisibleCount((v) => Math.min(weekendHolidayTasks.length, v + WEEKEND_PAGE_SIZE))}
                        >
                          Mostrar mais ({weekendHolidayTasks.length - weekendVisibleCount} restantes)
                        </Button>
                      </div>
                    )}

                    {weekendHolidayTasks.length > WEEKEND_PAGE_SIZE && weekendHolidayTasks.length <= weekendVisibleCount && (
                      <div className="text-center text-sm text-muted-foreground py-2">
                        Todas as {weekendHolidayTasks.length} tarefas estão listadas.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

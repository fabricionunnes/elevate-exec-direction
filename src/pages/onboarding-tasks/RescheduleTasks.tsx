import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CheckCircle2, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProjectSummary {
  project_id: string;
  project_name: string;
  company_name: string;
  task_count: number;
  earliest_date: string;
  latest_date: string;
  days_shift: number;
}

interface Task {
  id: string;
  project_id: string;
  due_date: string;
  title: string;
}

export default function RescheduleTasks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProject, setCurrentProject] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [updatedCount, setUpdatedCount] = useState(0);

  useEffect(() => {
    fetchProjectsSummary();
  }, []);

  const fetchProjectsSummary = async () => {
    setLoading(true);
    try {
      // Get tomorrow's date
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Fetch all projects with pending tasks
      const { data: projectsData, error } = await supabase
        .from('onboarding_tasks')
        .select(`
          project_id,
          due_date,
          onboarding_projects!inner(
            product_name,
            onboarding_companies(name)
          )
        `)
        .not('due_date', 'is', null)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Group by project and calculate stats
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

      // Sort by task count descending
      summaries.sort((a, b) => b.task_count - a.task_count);

      setProjects(summaries);
      setTotalTasks(total);
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

        // Fetch all tasks for this project ordered by due_date
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

        // Calculate the shift: difference between tomorrow and the earliest task
        const earliestTaskDate = parseISO(tasks[0].due_date);
        const tomorrowDate = parseISO(tomorrow);
        const daysToShift = differenceInDays(tomorrowDate, earliestTaskDate);

        // If already starting tomorrow or later, skip
        if (daysToShift <= 0) {
          processed += tasks.length;
          setProgress((processed / totalTasks) * 100);
          continue;
        }

        // Update each task with the new date
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

  const tomorrow = format(addDays(new Date(), 1), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reagendar Todas as Tarefas</h1>
            <p className="text-muted-foreground">
              Mover todas as tarefas para começar amanhã ({tomorrow})
            </p>
          </div>
        </div>

        {/* Warning */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção!</AlertTitle>
          <AlertDescription>
            Esta ação irá mover TODAS as tarefas não concluídas para começar amanhã, 
            mantendo os intervalos proporcionais entre elas. Esta ação não pode ser desfeita!
          </AlertDescription>
        </Alert>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumo da Operação
            </CardTitle>
            <CardDescription>
              Visão geral das tarefas que serão reagendadas
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
                    {processing ? (
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

                {processing && (
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

        {/* Projects List */}
        {!loading && projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Projetos Afetados</CardTitle>
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
      </div>
    </div>
  );
}

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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Loader2, 
  Shield, 
  Target, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ListTodo,
  RefreshCw
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RescuePlaybookBadge } from "./RescuePlaybookBadge";

interface RescuePlaybook {
  id: string;
  project_id: string;
  churn_prediction_id: string | null;
  strategy_summary: string;
  ai_recommendations: string;
  tasks_created: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PlaybookTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface RescuePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  churnPredictionId?: string;
  companyName: string;
}

export const RescuePlaybookDialog = ({
  open,
  onOpenChange,
  projectId,
  churnPredictionId,
  companyName,
}: RescuePlaybookDialogProps) => {
  const navigate = useNavigate();
  const [playbook, setPlaybook] = useState<RescuePlaybook | null>(null);
  const [tasks, setTasks] = useState<PlaybookTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      fetchPlaybook();
    }
  }, [open, projectId]);

  const fetchPlaybook = async () => {
    setLoading(true);
    try {
      // Fetch latest playbook for this project
      const { data: playbookData, error } = await supabase
        .from("rescue_playbooks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      setPlaybook(playbookData as unknown as RescuePlaybook | null);

      // Fetch rescue tasks
      if (playbookData) {
        const client = supabase as any;
        const { data: tasksData } = await client
          .from("onboarding_tasks")
          .select("id, title, status, due_date")
          .eq("project_id", projectId)
          .eq("category", "resgate")
          .order("due_date", { ascending: true });

        setTasks((tasksData as PlaybookTask[]) || []);
      }
    } catch (error) {
      console.error("Error fetching playbook:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlaybook = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-rescue-playbook", {
        body: { projectId, churnPredictionId },
      });

      if (error) throw error;
      
      toast.success(`Playbook gerado! ${data.tasksCreated} tarefas criadas.`);
      await fetchPlaybook();
    } catch (error: any) {
      console.error("Error generating playbook:", error);
      toast.error(error.message || "Erro ao gerar playbook");
    } finally {
      setGenerating(false);
    }
  };

  const getTaskProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  };

  const goToProject = () => {
    onOpenChange(false);
    navigate(`/onboarding-tasks/${projectId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Playbook de Resgate
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{companyName}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !playbook ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Nenhum playbook encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gere um playbook de resgate personalizado com estratégias e tarefas para reverter o risco de churn.
              </p>
              <Button onClick={generatePlaybook} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando Playbook...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Gerar Playbook de Resgate
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 pr-4">
              {/* Status and Progress */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <RescuePlaybookBadge status={playbook.status as any} />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Tarefas Criadas</p>
                  <span className="text-sm font-medium">{playbook.tasks_created}</span>
                </div>
              </div>

              {/* Task Progress */}
              {tasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progresso das Tarefas</span>
                    <span className="text-sm text-muted-foreground">
                      {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
                    </span>
                  </div>
                  <Progress value={getTaskProgress()} className="h-2" />
                </div>
              )}

              {/* Strategy Summary */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Estratégia
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <ReactMarkdown>{playbook.strategy_summary}</ReactMarkdown>
                </div>
              </div>

              {/* AI Recommendations */}
              {playbook.ai_recommendations && (
                <div>
                  <h4 className="font-medium mb-2">💡 Recomendações da IA</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/30 rounded-lg">
                    <ReactMarkdown>{playbook.ai_recommendations}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Rescue Tasks */}
              {tasks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Tarefas de Resgate ({tasks.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tasks.slice(0, 5).map((task) => (
                      <div 
                        key={task.id} 
                        className={`text-sm flex items-center gap-2 p-2 rounded border ${
                          task.status === 'completed' 
                            ? 'bg-green-500/5 border-green-500/20' 
                            : 'bg-muted/30 border-muted'
                        }`}
                      >
                        <CheckCircle2 
                          className={`h-4 w-4 flex-shrink-0 ${
                            task.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'
                          }`} 
                        />
                        <span className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {tasks.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        +{tasks.length - 5} tarefas...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={goToProject}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Projeto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generatePlaybook}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Novo Playbook
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

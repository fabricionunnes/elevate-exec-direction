import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Upload, Loader2, CheckCircle2, AlertCircle, Trash2, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ExtractedTask {
  id: string;
  title: string;
  description: string;
  phase: string;
  priority: 'high' | 'medium' | 'low';
  days_from_now: number;
  estimated_hours: number | null;
}

interface GeneratePDFTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  companyName?: string;
  onTasksGenerated: () => void;
}

export const GeneratePDFTasksDialog = ({
  open,
  onOpenChange,
  projectId,
  companyName,
  onTasksGenerated,
}: GeneratePDFTasksDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Por favor, selecione um arquivo PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', projectId);
      formData.append('mode', 'preview');
      if (companyName) {
        formData.append('companyName', companyName);
      }

      setProgress(30);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf-tasks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      setProgress(80);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      setProgress(100);
      setExtractedTasks(data.tasks || []);
      setSummary(data.summary || '');
      // Select all tasks by default
      setSelectedTaskIds(new Set((data.tasks || []).map((t: ExtractedTask) => t.id)));
      setStep('preview');
      toast.success(`${data.totalTasks} ações encontradas! Revise e selecione quais deseja criar.`);

    } catch (err) {
      console.error('Error analyzing PDF:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error(err instanceof Error ? err.message : 'Erro ao processar PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter(t => selectedTaskIds.has(t.id));
    if (selectedTasks.length === 0) {
      toast.error('Selecione pelo menos uma ação para criar');
      return;
    }

    setIsCreating(true);

    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('mode', 'create');
      formData.append('selectedTasks', JSON.stringify(selectedTasks));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf-tasks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar tarefas');
      }

      setCreatedCount(data.tasksCreated);
      setStep('done');
      toast.success(`${data.tasksCreated} tarefas criadas com sucesso!`);
      onTasksGenerated();

    } catch (err) {
      console.error('Error creating tasks:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao criar tarefas');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTaskIds.size === extractedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(extractedTasks.map(t => t.id)));
    }
  };

  const removeTask = (taskId: string) => {
    setExtractedTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleClose = () => {
    if (!isProcessing && !isCreating) {
      setSelectedFile(null);
      setError(null);
      setProgress(0);
      setStep('upload');
      setExtractedTasks([]);
      setSelectedTaskIds(new Set());
      setSummary('');
      setCreatedCount(0);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setStep('upload');
    setExtractedTasks([]);
    setSelectedTaskIds(new Set());
    setSummary('');
  };

  const priorityColors = {
    high: 'bg-red-500/10 text-red-600 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    low: 'bg-green-500/10 text-green-600 border-green-500/20',
  };

  const priorityLabels = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };

  const formatDueDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Group tasks by phase
  const tasksByPhase = extractedTasks.reduce((acc, task) => {
    const phase = task.phase || 'Sem fase';
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(task);
    return acc;
  }, {} as Record<string, ExtractedTask[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 'preview' ? "sm:max-w-4xl max-h-[90vh]" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === 'upload' && 'Gerar Plano de Ação via PDF'}
            {step === 'preview' && 'Revisar Ações Extraídas'}
            {step === 'done' && 'Tarefas Criadas'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um documento de planejamento estratégico e a IA irá extrair todas as ações propostas.'}
            {step === 'preview' && 'Revise as ações extraídas. Desmarque ou exclua as que não fazem sentido.'}
            {step === 'done' && 'As tarefas foram criadas com sucesso no projeto.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={!isProcessing ? handleUploadClick : undefined}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${selectedFile 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
                ${isProcessing ? 'cursor-not-allowed opacity-60' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isProcessing}
              />
              
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium text-sm">Clique para selecionar um PDF</p>
                  <p className="text-xs text-muted-foreground">Máximo 10MB</p>
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando documento com IA...
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg p-4 bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">Erro ao processar</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAnalyze} 
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Analisar PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4">
            {summary && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <strong>Resumo:</strong> {summary}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedTaskIds.size === extractedTasks.length && extractedTasks.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">
                  {selectedTaskIds.size} de {extractedTasks.length} selecionadas
                </span>
              </div>
              <Badge variant="outline">
                {Object.keys(tasksByPhase).length} fases
              </Badge>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {Object.entries(tasksByPhase).map(([phase, tasks]) => (
                  <div key={phase} className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {phase} ({tasks.length})
                    </h4>
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div 
                          key={task.id}
                          className={`
                            p-3 rounded-lg border transition-colors
                            ${selectedTaskIds.has(task.id) 
                              ? 'bg-primary/5 border-primary/20' 
                              : 'bg-muted/30 border-muted opacity-60'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={selectedTaskIds.has(task.id)}
                              onCheckedChange={() => toggleTask(task.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{task.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Prazo: {formatDueDate(task.days_from_now)} ({task.days_from_now}d)
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Badge variant="outline" className={priorityColors[task.priority]}>
                                    {priorityLabels[task.priority]}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeTask(task.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-between">
              <Button variant="ghost" onClick={handleBack} disabled={isCreating}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateTasks} 
                  disabled={selectedTaskIds.size === 0 || isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Criar {selectedTaskIds.size} Tarefas
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg p-6 bg-green-500/10 border border-green-500/20 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-lg text-green-700 dark:text-green-400">
                {createdCount} tarefas criadas!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                As tarefas foram adicionadas ao projeto e estão prontas para execução.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

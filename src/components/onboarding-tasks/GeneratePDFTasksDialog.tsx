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
import { FileText, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    tasksCreated?: number;
    summary?: string;
    error?: string;
  } | null>(null);
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
      setResult(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(10);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', projectId);
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
      setResult({
        success: true,
        tasksCreated: data.tasksCreated,
        summary: data.summary,
      });

      toast.success(`${data.tasksCreated} tarefas criadas com sucesso!`);
      onTasksGenerated();

    } catch (error) {
      console.error('Error generating tasks from PDF:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      toast.error(error instanceof Error ? error.message : 'Erro ao processar PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedFile(null);
      setResult(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Plano de Ação via PDF
          </DialogTitle>
          <DialogDescription>
            Faça upload de um documento de planejamento estratégico e a IA irá extrair todas as ações propostas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload area */}
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

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando documento com IA...
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`
              rounded-lg p-4 
              ${result.success 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-destructive/10 border border-destructive/20'
              }
            `}>
              {result.success ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {result.tasksCreated} tarefas criadas!
                    </p>
                    {result.summary && (
                      <p className="text-sm text-muted-foreground">{result.summary}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">Erro ao processar</p>
                    <p className="text-sm text-muted-foreground">{result.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {result?.success ? 'Fechar' : 'Cancelar'}
            </Button>
            {!result?.success && (
              <Button 
                onClick={handleGenerate} 
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar Tarefas
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

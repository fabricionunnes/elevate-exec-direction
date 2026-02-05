import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Clock,
  User,
  Calendar,
  ExternalLink,
  Trash2,
  Eye,
  Copy,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { CrmTranscription } from "@/hooks/useCrmTranscriptions";
import { Link } from "react-router-dom";

interface TranscriptionsListProps {
  transcriptions: CrmTranscription[];
  loading: boolean;
  showLeadLink?: boolean;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export function TranscriptionsList({
  transcriptions,
  loading,
  showLeadLink = true,
  onDelete,
  canDelete = false,
}: TranscriptionsListProps) {
  const [selectedTranscription, setSelectedTranscription] = useState<CrmTranscription | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transcriptionToDelete, setTranscriptionToDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Transcrição copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleDeleteClick = (id: string) => {
    setTranscriptionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (transcriptionToDelete && onDelete) {
      onDelete(transcriptionToDelete);
    }
    setDeleteDialogOpen(false);
    setTranscriptionToDelete(null);
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "tactiq":
        return { label: "Tactiq", variant: "default" as const };
      case "elevenlabs":
        return { label: "ElevenLabs", variant: "secondary" as const };
      case "assemblyai":
        return { label: "AssemblyAI", variant: "secondary" as const };
      case "manual":
        return { label: "Manual", variant: "outline" as const };
      default:
        return { label: source, variant: "outline" as const };
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (transcriptions.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transcrição encontrada</p>
        <p className="text-sm mt-1">
          Configure a integração com Tactiq ou grave reuniões diretamente
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transcriptions.map((transcription) => {
          const sourceInfo = getSourceLabel(transcription.source);
          
          return (
            <Card key={transcription.id} className="hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span className="truncate">{transcription.title}</span>
                      <Badge variant={sourceInfo.variant} className="shrink-0">
                        {sourceInfo.label}
                      </Badge>
                      {transcription.status === "processing" && (
                        <Badge variant="secondary" className="shrink-0">
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Processando
                        </Badge>
                      )}
                      {transcription.ai_analysis && (
                        <Badge variant="outline" className="shrink-0 text-primary border-primary/30">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Com Briefing
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-1 flex-wrap">
                      {transcription.recorded_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(transcription.recorded_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      )}
                      {transcription.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(transcription.duration_seconds)}
                        </span>
                      )}
                      {transcription.speakers.length > 0 && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {transcription.speakers.length} participantes
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTranscription(transcription)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDelete && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(transcription.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {transcription.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {transcription.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {showLeadLink && transcription.lead && (
                    <Link to={`/crm/leads/${transcription.lead.id}`}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        {transcription.lead.name}
                        {transcription.lead.company && ` • ${transcription.lead.company}`}
                      </Badge>
                    </Link>
                  )}
                  {transcription.source_meeting_url && (
                    <a
                      href={transcription.source_meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver reunião
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View Dialog */}
      <Dialog open={!!selectedTranscription} onOpenChange={() => setSelectedTranscription(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedTranscription?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 flex-wrap">
              {selectedTranscription?.recorded_at && (
                <span>
                  {format(new Date(selectedTranscription.recorded_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              )}
              {selectedTranscription?.duration_seconds && (
                <span>• Duração: {formatDuration(selectedTranscription.duration_seconds)}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTranscription?.summary && (
              <div>
                <h4 className="font-medium mb-1">Resumo</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  {selectedTranscription.summary}
                </p>
              </div>
            )}

            {selectedTranscription?.speakers.length > 0 && (
              <div>
                <h4 className="font-medium mb-1">Participantes</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedTranscription.speakers.map((speaker, idx) => (
                    <Badge key={idx} variant="secondary">
                      {speaker.name || `Participante ${idx + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium">Transcrição</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    selectedTranscription?.transcription_text &&
                    handleCopy(selectedTranscription.transcription_text)
                  }
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="text-sm whitespace-pre-wrap font-mono">
                  {selectedTranscription?.transcription_text || "Transcrição não disponível"}
                </div>
              </ScrollArea>
            </div>

            {selectedTranscription?.ai_analysis && (
              <div>
                <h4 className="font-medium mb-1">Análise IA</h4>
                <div className="text-sm bg-primary/5 border-primary/20 border p-3 rounded-md">
                  {selectedTranscription.ai_analysis}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transcrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A transcrição será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

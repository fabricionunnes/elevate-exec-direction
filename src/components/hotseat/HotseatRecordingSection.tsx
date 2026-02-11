import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Video, 
  Link, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Trash2,
  Edit3,
  Save,
  X,
  ListTodo
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HotseatSummaryDisplay } from "./HotseatSummaryDisplay";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface HotseatRecording {
  id: string;
  recording_link: string;
  recording_date: string;
  transcript: string | null;
  summary: string | null;
  companies_mentioned: unknown;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Props {
  currentStaffId: string | null;
}

export function HotseatRecordingSection({ currentStaffId }: Props) {
  const [recordings, setRecordings] = useState<HotseatRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLink, setNewLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"link" | "manual">("link");
  const [manualTranscript, setManualTranscript] = useState("");
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [editTranscriptText, setEditTranscriptText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [generatingTasksId, setGeneratingTasksId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecordings();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("hotseat_recordings_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hotseat_recordings",
        },
        (payload) => {
          console.log("Hotseat recording update:", payload);
          if (payload.eventType === "INSERT") {
            setRecordings((prev) => [payload.new as HotseatRecording, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === payload.new.id ? (payload.new as HotseatRecording) : r
              )
            );
            // Show toast when completed
            if (payload.new.status === "completed" && payload.old?.status !== "completed") {
              toast.success("Gravação processada com sucesso!");
            }
          } else if (payload.eventType === "DELETE") {
            setRecordings((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecordings = async () => {
    try {
      const { data, error } = await supabase
        .from("hotseat_recordings")
        .select("*")
        .order("recording_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error("Error fetching recordings:", error);
    } finally {
      setLoading(false);
    }
  };

  const isValidDriveLink = (url: string) => {
    return url.includes("drive.google.com/file/d/") || url.includes("drive.google.com/open?id=");
  };

  const handleSubmitLink = async () => {
    if (!newLink.trim()) {
      toast.error("Insira o link da gravação");
      return;
    }

    if (!isValidDriveLink(newLink)) {
      toast.error("Insira um link válido do Google Drive");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("hotseat_recordings")
        .insert({
          recording_link: newLink.trim(),
          recording_date: new Date().toISOString().split("T")[0],
          created_by_staff_id: currentStaffId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Link adicionado! Iniciando processamento...");
      setNewLink("");
      
      // Start processing
      processRecording(data.id);
    } catch (error) {
      console.error("Error adding recording:", error);
      toast.error("Erro ao adicionar gravação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitManualTranscript = async () => {
    if (!manualTranscript.trim() || manualTranscript.trim().length < 50) {
      toast.error("Insira uma transcrição com pelo menos 50 caracteres");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("hotseat_recordings")
        .insert({
          recording_link: "manual://transcript",
          recording_date: new Date().toISOString().split("T")[0],
          transcript: manualTranscript.trim(),
          status: "summarizing",
          transcribed_at: new Date().toISOString(),
          created_by_staff_id: currentStaffId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Transcrição adicionada! Gerando resumo...");
      setManualTranscript("");
      
      // Generate summary only (skip transcription)
      generateSummaryOnly(data.id);
    } catch (error) {
      console.error("Error adding manual transcript:", error);
      toast.error("Erro ao adicionar transcrição");
    } finally {
      setSubmitting(false);
    }
  };

  const generateSummaryOnly = async (recordingId: string) => {
    try {
      const response = await supabase.functions.invoke("process-hotseat-recording", {
        body: { 
          recordingId,
          staffId: currentStaffId,
          skipTranscription: true
        },
      });

      if (response.error) {
        console.error("Error generating summary:", response.error);
      }
    } catch (error) {
      console.error("Error invoking function:", error);
    }
  };

  const processRecording = async (recordingId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      // Update local state to show processing
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === recordingId ? { ...r, status: "transcribing" } : r
        )
      );

      toast.info("Processando gravação em segundo plano... Você pode continuar usando o sistema.", { duration: 8000 });

      // Fire and forget - the edge function will update the database
      // and realtime will update the UI
      supabase.functions.invoke("process-hotseat-recording", {
        body: { 
          recordingId,
          staffId: currentStaffId 
        },
      }).then((response) => {
        if (response.error) {
          console.error("Error processing recording:", response.error);
        }
      }).catch((error) => {
        console.error("Error invoking function:", error);
      });

    } catch (error) {
      console.error("Error starting recording process:", error);
      toast.error("Erro ao iniciar processamento");
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    try {
      const { error } = await supabase
        .from("hotseat_recordings")
        .delete()
        .eq("id", recordingId);

      if (error) throw error;

      toast.success("Gravação excluída");
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast.error("Erro ao excluir gravação");
    }
  };

  const startEditingTranscript = (recording: HotseatRecording) => {
    setEditingTranscriptId(recording.id);
    setEditTranscriptText(recording.transcript || "");
    setExpandedId(recording.id);
  };

  const cancelEditingTranscript = () => {
    setEditingTranscriptId(null);
    setEditTranscriptText("");
  };

  const saveTranscript = async (recordingId: string) => {
    if (!editTranscriptText.trim()) {
      toast.error("A transcrição não pode estar vazia");
      return;
    }

    setSavingTranscript(true);
    try {
      const { error } = await supabase
        .from("hotseat_recordings")
        .update({ 
          transcript: editTranscriptText.trim(),
          transcribed_at: new Date().toISOString()
        })
        .eq("id", recordingId);

      if (error) throw error;

      toast.success("Transcrição salva! Deseja gerar o resumo?", {
        action: {
          label: "Gerar Resumo",
          onClick: () => {
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === recordingId ? { ...r, status: "summarizing" } : r
              )
            );
            generateSummaryOnly(recordingId);
          },
        },
        duration: 10000,
      });

      setEditingTranscriptId(null);
      setEditTranscriptText("");
      fetchRecordings();
    } catch (error) {
      console.error("Error saving transcript:", error);
      toast.error("Erro ao salvar transcrição");
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleGenerateHotseatTasks = async (recording: HotseatRecording) => {
    const companies = Array.isArray(recording.companies_mentioned) ? recording.companies_mentioned : [];
    if (companies.length === 0) {
      toast.error("Nenhuma empresa identificada no resumo");
      return;
    }

    setGeneratingTasksId(recording.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-hotseat-tasks", {
        body: { recordingId: recording.id, companies },
      });

      if (error) throw error;

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.tasksCreated > 0).length || 0;
        const failedResults = data.results?.filter((r: any) => r.error) || [];
        
        toast.success(`${data.totalTasks} tarefas criadas para ${successCount} empresa(s)!`);
        
        if (failedResults.length > 0) {
          const failedNames = failedResults.map((r: any) => r.company).join(", ");
          toast.warning(`Empresas não encontradas: ${failedNames}`, { duration: 8000 });
        }
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error) {
      console.error("Error generating hotseat tasks:", error);
      toast.error("Erro ao gerar tarefas");
    } finally {
      setGeneratingTasksId(null);
    }
  };

  const getStatusBadge = (status: string, errorMessage: string | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pendente</Badge>;
      case "transcribing":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Transcrevendo</Badge>;
      case "summarizing":
        return <Badge variant="outline" className="border-purple-500 text-purple-600"><Sparkles className="h-3 w-3 mr-1 animate-spin" />Resumindo</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "error":
        return <Badge variant="outline" className="border-red-500 text-red-600" title={errorMessage || "Erro"}><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Video className="h-5 w-5 text-orange-500" />
          Gravação do Hotseat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs for input mode */}
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "link" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link className="h-4 w-4" />
              Link do Drive
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="h-4 w-4" />
              Transcrição Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cole o link do Google Drive da gravação..."
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="pl-10"
                  disabled={submitting}
                />
              </div>
              <Button 
                onClick={handleSubmitLink} 
                disabled={submitting || !newLink.trim()}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Processar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema irá transcrever automaticamente e gerar um resumo.
            </p>
          </TabsContent>

          <TabsContent value="manual" className="space-y-2">
            <Textarea
              placeholder="Cole aqui a transcrição da reunião do Hotseat..."
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              className="min-h-[120px]"
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Cole a transcrição e o sistema gerará um resumo automaticamente.
              </p>
              <Button 
                onClick={handleSubmitManualTranscript} 
                disabled={submitting || !manualTranscript.trim()}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar Resumo
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* List of recordings */}
        {recordings.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">Gravações Recentes</h4>
              <Button variant="ghost" size="sm" onClick={fetchRecordings} className="h-7 gap-1">
                <RefreshCw className="h-3 w-3" />
                Atualizar
              </Button>
            </div>

            {recordings.map((recording) => (
              <Collapsible
                key={recording.id}
                open={expandedId === recording.id}
                onOpenChange={(open) => setExpandedId(open ? recording.id : null)}
              >
                <div className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(recording.recording_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {getStatusBadge(recording.status, recording.error_message)}
                      {recording.recording_link === "manual://transcript" && (
                        <Badge variant="secondary" className="text-xs">Manual</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {recording.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processRecording(recording.id)}
                          className="gap-1 h-7"
                        >
                          <Sparkles className="h-3 w-3" />
                          Processar
                        </Button>
                      )}
                      {recording.status === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processRecording(recording.id)}
                          className="gap-1 h-7"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Tentar Novamente
                        </Button>
                      )}
                      {(recording.status === "transcribing" || recording.status === "summarizing") && (
                        <Badge variant="outline" className="border-blue-500 text-blue-600">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Processando...
                        </Badge>
                      )}
                      
                      {/* Edit transcript button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingTranscript(recording)}
                        className="h-7 w-7 p-0"
                        title="Editar transcrição"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      
                      {/* Expand button */}
                      {(recording.summary || recording.transcript || editingTranscriptId === recording.id) && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 h-7">
                            <FileText className="h-3 w-3" />
                            {expandedId === recording.id ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir gravação?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A transcrição e o resumo serão perdidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRecording(recording.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {recording.error_message && recording.status === "error" && (
                    <p className="text-xs text-red-600 mt-2">{recording.error_message}</p>
                  )}

                  {recording.companies_mentioned && Array.isArray(recording.companies_mentioned) && recording.companies_mentioned.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(recording.companies_mentioned as any[]).map((company: any, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {company.name || company}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <CollapsibleContent className="mt-4 space-y-4">
                    {recording.summary && (
                      <HotseatSummaryDisplay 
                        summary={recording.summary} 
                        companiesMentioned={recording.companies_mentioned}
                      />
                    )}

                    {/* Generate tasks from summary */}
                    {recording.summary && recording.companies_mentioned && Array.isArray(recording.companies_mentioned) && recording.companies_mentioned.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateHotseatTasks(recording)}
                        disabled={generatingTasksId === recording.id}
                        className="w-full gap-2"
                      >
                        {generatingTasksId === recording.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Gerando tarefas na jornada...
                          </>
                        ) : (
                          <>
                            <ListTodo className="h-4 w-4" />
                            Gerar Tarefas na Jornada dos Clientes
                          </>
                        )}
                      </Button>
                    )}

                    {/* Editable transcript section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          Transcrição
                        </h5>
                        {editingTranscriptId === recording.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditingTranscript}
                              className="h-7 gap-1"
                            >
                              <X className="h-3 w-3" />
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveTranscript(recording.id)}
                              disabled={savingTranscript}
                              className="h-7 gap-1"
                            >
                              {savingTranscript ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              Salvar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditingTranscript(recording)}
                            className="h-7 gap-1"
                          >
                            <Edit3 className="h-3 w-3" />
                            Editar
                          </Button>
                        )}
                      </div>

                      {editingTranscriptId === recording.id ? (
                        <Textarea
                          value={editTranscriptText}
                          onChange={(e) => setEditTranscriptText(e.target.value)}
                          className="min-h-[200px] font-mono text-xs"
                          placeholder="Cole ou digite a transcrição aqui..."
                        />
                      ) : recording.transcript ? (
                        <ScrollArea className="h-[200px] rounded-md border p-4 bg-slate-50">
                          <pre className="whitespace-pre-wrap text-xs font-mono">
                            {recording.transcript}
                          </pre>
                        </ScrollArea>
                      ) : (
                        <div className="h-[100px] rounded-md border p-4 bg-slate-50 flex items-center justify-center text-muted-foreground text-sm">
                          Nenhuma transcrição disponível. Clique em "Editar" para adicionar.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

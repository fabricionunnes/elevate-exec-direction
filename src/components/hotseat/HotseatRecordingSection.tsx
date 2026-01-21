import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecordings();
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
      setRecordings([data, ...recordings]);
      
      // Start processing
      processRecording(data.id);
    } catch (error) {
      console.error("Error adding recording:", error);
      toast.error("Erro ao adicionar gravação");
    } finally {
      setSubmitting(false);
    }
  };

  const processRecording = async (recordingId: string) => {
    setProcessingId(recordingId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      toast.info("Processando gravação... Isso pode levar vários minutos.", { duration: 15000 });

      const response = await supabase.functions.invoke("process-hotseat-recording", {
        body: { 
          recordingId,
          staffId: currentStaffId 
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Gravação processada com sucesso!");
      fetchRecordings();
    } catch (error) {
      console.error("Error processing recording:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar gravação");
      fetchRecordings();
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string, errorMessage: string | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pendente</Badge>;
      case "transcribing":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Transcrevendo</Badge>;
      case "summarizing":
        return <Badge variant="outline" className="border-purple-500 text-purple-600"><Sparkles className="h-3 w-3 mr-1" />Resumindo</Badge>;
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
        {/* Input for new recording link */}
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
          Insira o link do Google Drive com a gravação do Hotseat. O sistema irá transcrever e gerar um resumo de todas as empresas.
        </p>

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
                    </div>
                    <div className="flex items-center gap-2">
                      {recording.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processRecording(recording.id)}
                          disabled={processingId === recording.id}
                          className="gap-1 h-7"
                        >
                          {processingId === recording.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          Processar
                        </Button>
                      )}
                      {recording.status === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processRecording(recording.id)}
                          disabled={processingId === recording.id}
                          className="gap-1 h-7"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Tentar Novamente
                        </Button>
                      )}
                      {(recording.summary || recording.transcript) && (
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
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          Resumo
                        </h5>
                        <ScrollArea className="h-[300px] rounded-md border p-4 bg-slate-50">
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{recording.summary}</ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {recording.transcript && (
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          Transcrição
                        </h5>
                        <ScrollArea className="h-[200px] rounded-md border p-4 bg-slate-50">
                          <pre className="whitespace-pre-wrap text-xs font-mono">
                            {recording.transcript}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
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

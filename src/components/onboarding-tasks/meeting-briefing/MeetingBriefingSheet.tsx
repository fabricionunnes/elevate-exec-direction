import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Loader2, 
  RefreshCw, 
  FileText, 
  Target, 
  AlertTriangle, 
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Lightbulb
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface BriefingContent {
  executive_summary: string;
  client_history: string;
  pending_items: string;
  goal_status: string;
  attention_points: string;
  suggested_agenda: string;
  talking_points: string[];
}

interface MeetingBriefing {
  id: string;
  meeting_id: string;
  project_id: string;
  briefing_content: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

interface MeetingBriefingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  projectId: string;
  meetingTitle: string;
  meetingDate: string;
}

export const MeetingBriefingSheet = ({
  open,
  onOpenChange,
  meetingId,
  projectId,
  meetingTitle,
  meetingDate,
}: MeetingBriefingSheetProps) => {
  const [briefing, setBriefing] = useState<MeetingBriefing | null>(null);
  const [parsedContent, setParsedContent] = useState<BriefingContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open && meetingId) {
      fetchBriefing();
    }
  }, [open, meetingId]);

  useEffect(() => {
    if (briefing?.briefing_content) {
      try {
        const content = JSON.parse(briefing.briefing_content) as BriefingContent;
        setParsedContent(content);
      } catch (e) {
        console.error("Error parsing briefing content:", e);
        setParsedContent(null);
      }
    } else {
      setParsedContent(null);
    }
  }, [briefing]);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_meeting_briefings")
        .select("*")
        .eq("meeting_id", meetingId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setBriefing(data as MeetingBriefing | null);
    } catch (error) {
      console.error("Error fetching briefing:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateBriefing = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("prepare-meeting-briefing", {
        body: { meetingId, projectId },
      });

      if (error) throw error;
      
      toast.success("Briefing gerado com sucesso!");
      await fetchBriefing();
    } catch (error: any) {
      console.error("Error generating briefing:", error);
      toast.error(error.message || "Erro ao gerar briefing");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Preparação para Reunião
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            {meetingTitle}
            <Badge variant="outline" className="ml-2">{meetingDate}</Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !briefing || !parsedContent ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Briefing não encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gere um briefing completo com contexto do cliente, tarefas pendentes e pontos de atenção.
              </p>
              <Button onClick={generateBriefing} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando Briefing...
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Gerar Briefing com IA
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Resumo Executivo
                </h3>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <p className="text-sm">{parsedContent.executive_summary}</p>
                </div>
              </div>

              <Separator />

              {/* Attention Points */}
              {parsedContent.attention_points && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    Pontos de Atenção
                  </h3>
                  <div className="text-sm bg-orange-500/10 p-3 rounded border border-orange-500/20">
                    <ReactMarkdown>{parsedContent.attention_points}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Client History */}
              {parsedContent.client_history && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Histórico do Cliente
                  </h3>
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <ReactMarkdown>{parsedContent.client_history}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Pending Items */}
              {parsedContent.pending_items && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Itens Pendentes
                  </h3>
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <ReactMarkdown>{parsedContent.pending_items}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Goals Status */}
              {parsedContent.goal_status && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Status das Metas
                  </h3>
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <ReactMarkdown>{parsedContent.goal_status}</ReactMarkdown>
                  </div>
                </div>
              )}

              <Separator />

              {/* Suggested Agenda */}
              {parsedContent.suggested_agenda && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pauta Sugerida
                  </h3>
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <ReactMarkdown>{parsedContent.suggested_agenda}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Talking Points */}
              {parsedContent.talking_points && parsedContent.talking_points.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Talking Points
                  </h3>
                  <ul className="space-y-2">
                    {parsedContent.talking_points.map((point, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Refresh Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateBriefing}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar Briefing
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Gerado em: {new Date(briefing.generated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

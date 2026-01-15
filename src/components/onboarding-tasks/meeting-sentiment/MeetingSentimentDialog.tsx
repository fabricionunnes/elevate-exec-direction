import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Loader2, RefreshCw, MessageCircle, Tag, Lightbulb, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { MeetingSentimentBadge } from "./MeetingSentimentBadge";

interface SentimentAnalysis {
  id: string;
  meeting_id: string;
  project_id: string;
  overall_sentiment: string;
  sentiment_score: number;
  key_emotions: any;
  positive_keywords: string[];
  concern_keywords: string[];
  summary: string;
  ai_insights: string;
  created_at: string;
}

interface MeetingSentimentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  projectId: string;
  meetingTitle: string;
  hasTranscript: boolean;
}

export const MeetingSentimentDialog = ({
  open,
  onOpenChange,
  meetingId,
  projectId,
  meetingTitle,
  hasTranscript,
}: MeetingSentimentDialogProps) => {
  const [analysis, setAnalysis] = useState<SentimentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (open && meetingId) {
      fetchAnalysis();
    }
  }, [open, meetingId]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meeting_sentiment_analysis")
        .select("*")
        .eq("meeting_id", meetingId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setAnalysis(data as unknown as SentimentAnalysis | null);
    } catch (error) {
      console.error("Error fetching sentiment analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!hasTranscript) {
      toast.error("Esta reunião não possui transcrição para análise");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-meeting-sentiment", {
        body: { meetingId, projectId },
      });

      if (error) throw error;
      
      toast.success("Análise de sentimento concluída!");
      await fetchAnalysis();
    } catch (error: any) {
      console.error("Error analyzing sentiment:", error);
      toast.error(error.message || "Erro ao analisar sentimento");
    } finally {
      setAnalyzing(false);
    }
  };

  const getSentimentType = (sentiment: string): 'positive' | 'neutral' | 'negative' | 'mixed' => {
    if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative' || sentiment === 'mixed') {
      return sentiment;
    }
    return 'neutral';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Análise de Sentimento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{meetingTitle}</p>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !analysis ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Análise não encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasTranscript
                  ? "Clique no botão abaixo para analisar o sentimento desta reunião."
                  : "Esta reunião não possui transcrição. Adicione uma transcrição para poder analisar."}
              </p>
              <Button
                onClick={runAnalysis}
                disabled={!hasTranscript || analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Analisar Sentimento
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 pr-4">
              {/* Overall Sentiment */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Sentimento Geral</p>
                  <MeetingSentimentBadge
                    sentiment={getSentimentType(analysis.overall_sentiment)}
                    score={analysis.sentiment_score}
                    size="md"
                  />
                </div>
              </div>

              {/* AI Summary */}
              {analysis.summary && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Resumo
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    {analysis.summary}
                  </p>
                </div>
              )}

              {/* AI Insights */}
              {analysis.ai_insights && (
                <div>
                  <h4 className="font-medium mb-2">Insights da IA</h4>
                  <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/20">
                    {analysis.ai_insights}
                  </p>
                </div>
              )}

              {/* Positive Keywords */}
              {analysis.positive_keywords && analysis.positive_keywords.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-green-600">✓ Palavras-chave Positivas</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.positive_keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-green-500/10 text-green-600">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Concern Keywords */}
              {analysis.concern_keywords && analysis.concern_keywords.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-orange-600">⚠ Palavras-chave de Preocupação</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.concern_keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-orange-500/10 text-orange-600">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Refresh Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runAnalysis}
                  disabled={!hasTranscript || analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Reanalisando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reanalisar
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

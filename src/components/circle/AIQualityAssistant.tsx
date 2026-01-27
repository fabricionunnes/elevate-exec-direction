import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle, AlertCircle, Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QualitySuggestions {
  clarity_score?: number;
  clarity_suggestion?: string | null;
  tone_analysis?: string;
  tone_suggestion?: string | null;
  has_cta?: boolean;
  cta_suggestion?: string | null;
  objective?: string;
  hashtag_suggestions?: string[];
  overall_quality?: number;
  quick_tip?: string;
}

interface AIQualityAssistantProps {
  content: string;
  onApplySuggestion?: (suggestion: string) => void;
}

export function AIQualityAssistant({ content, onApplySuggestion }: AIQualityAssistantProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<QualitySuggestions | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const analyzeContent = async () => {
    if (!content.trim() || content.length < 10) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("circle-ai-quality", {
        body: { content, type: "pre_publish" },
      });

      if (error) throw error;
      setSuggestions(data.suggestions);
    } catch (err) {
      console.error("Error analyzing content:", err);
      setError("Não foi possível analisar o conteúdo");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getToneEmoji = (tone?: string) => {
    switch (tone) {
      case "positivo": return "😊";
      case "neutro": return "😐";
      case "negativo": return "😔";
      case "agressivo": return "😠";
      default: return "🤔";
    }
  };

  const getObjectiveLabel = (obj?: string) => {
    const labels: Record<string, string> = {
      resultado: "Compartilhar Resultado",
      dúvida: "Tirar Dúvida",
      venda: "Venda/Oferta",
      reflexão: "Reflexão",
      celebração: "Celebração",
      outro: "Outro",
    };
    return labels[obj || "outro"] || obj;
  };

  if (!content.trim() || content.length < 10) {
    return null;
  }

  return (
    <div className="space-y-2">
      {!suggestions && (
        <Button
          variant="outline"
          size="sm"
          onClick={analyzeContent}
          disabled={isAnalyzing}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isAnalyzing ? "Analisando..." : "✨ Analisar com IA"}
        </Button>
      )}

      {error && (
        <div className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {suggestions && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Sugestões da IA</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSuggestions(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="space-y-3 text-sm">
                {/* Quality Scores */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Clareza:</span>
                    <span className={cn("font-bold", getScoreColor(suggestions.clarity_score || 0))}>
                      {suggestions.clarity_score}/10
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Qualidade:</span>
                    <span className={cn("font-bold", getScoreColor(suggestions.overall_quality || 0))}>
                      {suggestions.overall_quality}/10
                    </span>
                  </div>
                </div>

                {/* Tone Analysis */}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tom:</span>
                  <Badge variant="outline">
                    {getToneEmoji(suggestions.tone_analysis)} {suggestions.tone_analysis}
                  </Badge>
                  {suggestions.objective && (
                    <>
                      <span className="text-muted-foreground">|</span>
                      <Badge variant="secondary">
                        {getObjectiveLabel(suggestions.objective)}
                      </Badge>
                    </>
                  )}
                </div>

                {/* Quick Tip */}
                {suggestions.quick_tip && (
                  <div className="flex items-start gap-2 p-2 bg-background rounded-md">
                    <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">{suggestions.quick_tip}</p>
                  </div>
                )}

                {/* CTA Suggestion */}
                {suggestions.cta_suggestion && (
                  <div className="flex items-start gap-2 p-2 bg-background rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">{suggestions.cta_suggestion}</p>
                  </div>
                )}

                {/* Hashtag Suggestions */}
                {suggestions.hashtag_suggestions && suggestions.hashtag_suggestions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Hashtags sugeridas:</span>
                    <div className="flex flex-wrap gap-1">
                      {suggestions.hashtag_suggestions.map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-primary/10"
                          onClick={() => onApplySuggestion?.(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

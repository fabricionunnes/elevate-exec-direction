import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Brain, AlertTriangle, CheckCircle2, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface HealthScoreAIInsightsProps {
  projectId: string;
}

export const HealthScoreAIInsights = ({ projectId }: HealthScoreAIInsightsProps) => {
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    setInsights("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ projectId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Erro ao gerar análise");
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              setInsights(fullContent);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              fullContent += content;
              setInsights(fullContent);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setHasGenerated(true);
      toast.success("Análise gerada com sucesso!");
    } catch (error: any) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar análise: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-primary" />
            Análise de IA
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </CardTitle>
          <Button
            variant={hasGenerated ? "outline" : "default"}
            size="sm"
            onClick={generateInsights}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : hasGenerated ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Análise
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!insights && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Análise Inteligente de Saúde</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Clique em "Gerar Análise" para obter insights valiosos sobre a saúde do cliente,
              incluindo diagnóstico, pontos críticos, oportunidades e plano de ação.
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                Pontos críticos
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Oportunidades
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-blue-500" />
                Plano de ação
              </div>
            </div>
          </div>
        )}

        {loading && !insights && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Analisando dados do cliente...</p>
          </div>
        )}

        {insights && (
          <ScrollArea className="h-[500px] pr-4">
            <div className={cn(
              "prose prose-sm max-w-none dark:prose-invert",
              "prose-headings:text-foreground prose-headings:font-semibold",
              "prose-p:text-muted-foreground prose-p:leading-relaxed",
              "prose-li:text-muted-foreground",
              "prose-strong:text-foreground",
              "prose-ul:my-2 prose-ol:my-2",
              "[&>h2]:text-lg [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:pb-2 [&>h2]:border-b",
              "[&>h3]:text-base [&>h3]:mt-4 [&>h3]:mb-2",
            )}>
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

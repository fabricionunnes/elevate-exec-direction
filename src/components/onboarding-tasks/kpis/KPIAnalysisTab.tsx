import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Loader2, TrendingUp, TrendingDown, AlertTriangle, Target, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KPIAnalysisTabProps {
  companyId: string;
  projectId?: string;
}

interface AnalysisResult {
  id: string;
  content: string;
  created_at: string;
}

export const KPIAnalysisTab = ({ companyId, projectId }: KPIAnalysisTabProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLatestAnalysis();
  }, [companyId]);

  const fetchLatestAnalysis = async () => {
    setLoading(true);
    try {
      // Check if we have a cached analysis from today
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("onboarding_ai_chat")
        .select("*")
        .eq("project_id", projectId)
        .eq("role", "kpi_analysis")
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAnalysis({
          id: data.id,
          content: data.content,
          created_at: data.created_at,
        });
      }
    } catch (error) {
      // No cached analysis found
    } finally {
      setLoading(false);
    }
  };

  const generateAnalysis = async () => {
    if (!companyId || !projectId) {
      toast.error("Empresa ou projeto não encontrado");
      return;
    }

    setGenerating(true);
    setStreamedContent("");
    setAnalysis(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kpi-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ companyId, projectId }),
        }
      );

      if (response.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        setGenerating(false);
        return;
      }

      if (response.status === 402) {
        toast.error("Créditos insuficientes. Adicione créditos ao workspace.");
        setGenerating(false);
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("Falha ao iniciar análise");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamedContent(fullContent);
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save the analysis to the database
      if (fullContent) {
        const { data: savedAnalysis, error } = await supabase
          .from("onboarding_ai_chat")
          .insert({
            project_id: projectId,
            role: "kpi_analysis",
            content: fullContent,
          })
          .select()
          .single();

        if (!error && savedAnalysis) {
          setAnalysis({
            id: savedAnalysis.id,
            content: fullContent,
            created_at: savedAnalysis.created_at,
          });
        }
      }

      toast.success("Análise gerada com sucesso!");
    } catch (error) {
      console.error("Error generating analysis:", error);
      toast.error("Erro ao gerar análise");
    } finally {
      setGenerating(false);
      setStreamedContent("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Análise Inteligente de KPIs</CardTitle>
                <p className="text-sm text-muted-foreground">
                  IA avalia os números e direciona ações para o consultor
                </p>
              </div>
            </div>
            <Button 
              onClick={generateAnalysis} 
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {analysis ? "Atualizar Análise" : "Gerar Análise"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Content */}
      {generating && streamedContent ? (
        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="h-[600px]" ref={scrollRef}>
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown>{streamedContent}</ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : analysis ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Última análise: {format(new Date(analysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <ReactMarkdown>{analysis.content}</ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhuma análise gerada</h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                  Clique em "Gerar Análise" para que a IA avalie os KPIs, identifique pontos de melhoria e sugira ações para cada vendedor.
                </p>
              </div>
              <Button onClick={generateAnalysis} disabled={generating} className="mt-2 gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar Primeira Análise
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {!generating && !analysis && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">O que a IA analisa</p>
                  <p className="font-medium">Metas vs Resultados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Performance individual</p>
                  <p className="font-medium">Por vendedor</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Sugestões práticas</p>
                  <p className="font-medium">Ações de melhoria</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

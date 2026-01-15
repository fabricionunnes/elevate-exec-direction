import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Sparkles, Loader2, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface PortfolioData {
  totalProjects: number;
  avgHealthScore: number;
  criticalCount: number;
  highRiskCount: number;
  churnRate: number;
  avgNPS: number;
  renewalRate: number;
}

interface ExecutiveAIInsightsProps {
  portfolioData: PortfolioData;
}

export function ExecutiveAIInsights({ portfolioData }: ExecutiveAIInsightsProps) {
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    setInsights("");
    
    try {
      const systemPrompt = `Você é um analista executivo especializado em Customer Success e gestão de portfólio de clientes. 
Sua função é fornecer insights estratégicos concisos para a liderança com base nos dados do portfólio.

Formato da resposta:
1. **Resumo Executivo** (2-3 frases sobre a situação geral)
2. **3 Principais Riscos** (bullets concisos)
3. **3 Ações Prioritárias** (bullets acionáveis)
4. **Oportunidades** (1-2 bullets sobre pontos positivos a explorar)

Seja direto, use linguagem executiva e foque em impacto no negócio.`;

      const userPrompt = `Analise o portfólio de clientes com os seguintes dados:

- Total de projetos ativos: ${portfolioData.totalProjects}
- Health Score médio: ${portfolioData.avgHealthScore.toFixed(1)}/100
- Projetos críticos (score < 40): ${portfolioData.criticalCount}
- Projetos em alto risco (score 40-59): ${portfolioData.highRiskCount}
- Taxa de churn atual: ${(portfolioData.churnRate * 100).toFixed(1)}%
- NPS médio: ${portfolioData.avgNPS.toFixed(1)}
- Taxa de renovação: ${(portfolioData.renewalRate * 100).toFixed(1)}%

Forneça uma análise executiva com riscos, ações prioritárias e oportunidades.`;

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-portfolio-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ systemPrompt, userPrompt }),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao gerar análise");
      }

      const result = await response.json();
      setInsights(result.text || "Não foi possível gerar insights.");
      setHasGenerated(true);
      
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar análise executiva");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-purple-600">
            <Brain className="h-5 w-5" />
            Insights Executivos (IA)
          </CardTitle>
          <Button
            onClick={generateInsights}
            disabled={loading}
            size="sm"
            variant={hasGenerated ? "outline" : "default"}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {hasGenerated ? "Atualizar" : "Gerar Análise"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasGenerated && !loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Análise Executiva com IA</p>
            <p className="text-sm mt-1">
              Clique em "Gerar Análise" para obter insights estratégicos sobre seu portfólio.
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                Riscos
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                Ações
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                Oportunidades
              </span>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
            <p className="text-sm text-muted-foreground">Analisando dados do portfólio...</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
                  h2: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>,
                  strong: ({ children }) => <strong className="text-purple-700 dark:text-purple-400">{children}</strong>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  p: ({ children }) => <p className="text-sm mb-2">{children}</p>,
                }}
              >
                {insights}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

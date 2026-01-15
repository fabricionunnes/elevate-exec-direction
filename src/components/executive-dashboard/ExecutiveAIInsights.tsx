import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Sparkles, Loader2, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

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
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-purple-500/5">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-purple-500/10 to-violet-500/5 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 rounded-full blur-2xl"
          animate={{ 
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>
      
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <motion.div 
              className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10"
              animate={{ 
                boxShadow: ["0 0 0 0 rgba(139, 92, 246, 0)", "0 0 20px 4px rgba(139, 92, 246, 0.2)", "0 0 0 0 rgba(139, 92, 246, 0)"]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Brain className="h-4 w-4 text-purple-500" />
            </motion.div>
            <span className="bg-gradient-to-r from-purple-500 to-violet-500 bg-clip-text text-transparent font-bold">
              Insights Executivos (IA)
            </span>
          </CardTitle>
          <Button
            onClick={generateInsights}
            disabled={loading}
            size="sm"
            className={`gap-2 transition-all ${
              hasGenerated 
                ? "bg-white/50 dark:bg-white/10 text-purple-600 border border-purple-200/50 hover:bg-purple-500/10" 
                : "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
            }`}
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
      <CardContent className="relative z-10">
        <AnimatePresence mode="wait">
          {!hasGenerated && !loading ? (
            <motion.div 
              key="empty"
              className="text-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center"
                animate={{ 
                  rotateY: [0, 360],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Brain className="h-10 w-10 text-purple-500" />
              </motion.div>
              <p className="font-semibold text-foreground">Análise Executiva com IA</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Clique em "Gerar Análise" para obter insights estratégicos sobre seu portfólio.
              </p>
              <div className="flex justify-center gap-4 mt-6">
                {[
                  { icon: AlertTriangle, label: "Riscos", color: "from-orange-400 to-orange-600" },
                  { icon: CheckCircle, label: "Ações", color: "from-emerald-400 to-emerald-600" },
                  { icon: TrendingUp, label: "Oportunidades", color: "from-blue-400 to-blue-600" },
                ].map((item, index) => (
                  <motion.div 
                    key={item.label}
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * index }}
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${item.color} shadow-lg`}>
                      <item.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div 
              key="loading"
              className="flex flex-col items-center justify-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 opacity-20 blur-lg absolute inset-0" />
                <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
              </motion.div>
              <p className="text-sm text-muted-foreground mt-4">Analisando dados do portfólio...</p>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-purple-500"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ScrollArea className="h-[320px] pr-2">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h3 className="text-lg font-bold mt-4 mb-2 bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                          {children}
                        </h3>
                      ),
                      h2: ({ children }) => (
                        <h4 className="text-base font-semibold mt-3 mb-2 text-foreground">
                          {children}
                        </h4>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-purple-600 dark:text-purple-400 font-semibold">
                          {children}
                        </strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-2 my-2">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => (
                        <li className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 shrink-0" />
                          <span>{children}</span>
                        </li>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm mb-2 text-muted-foreground leading-relaxed">
                          {children}
                        </p>
                      ),
                    }}
                  >
                    {insights}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

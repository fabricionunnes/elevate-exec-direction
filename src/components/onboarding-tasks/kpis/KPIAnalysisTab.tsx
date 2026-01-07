import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Loader2, TrendingUp, Target, Users, Brain, Calendar, Lightbulb, History, ChevronRight, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

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
  const [allAnalyses, setAllAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllAnalyses();
  }, [companyId, projectId]);

  const fetchAllAnalyses = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from("onboarding_ai_chat")
        .select("*")
        .eq("project_id", projectId)
        .eq("role", "kpi_analysis")
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const analyses = data.map(d => ({
          id: d.id,
          content: d.content,
          created_at: d.created_at,
        }));
        setAllAnalyses(analyses);
        setAnalysis(analyses[0]); // Set the most recent as current
      }
    } catch (error) {
      console.error("Error fetching analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectAnalysis = (selected: AnalysisResult) => {
    setAnalysis(selected);
    setHistoryOpen(false);
  };

  const generateAnalysis = async () => {
    if (!companyId || !projectId) {
      toast.error("Empresa ou projeto não encontrado");
      return;
    }

    setGenerating(true);
    setStreamedContent("");

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
        // First, set it locally so it's visible immediately
        const tempAnalysis = {
          id: crypto.randomUUID(),
          content: fullContent,
          created_at: new Date().toISOString(),
        };
        setAnalysis(tempAnalysis);
        setStreamedContent("");
        
        // Then try to save to database
        const { data: savedAnalysis, error } = await supabase
          .from("onboarding_ai_chat")
          .insert({
            project_id: projectId,
            role: "kpi_analysis",
            content: fullContent,
          })
          .select()
          .single();

        if (error) {
          console.error("Error saving analysis:", error);
          toast.error("Análise gerada mas houve erro ao salvar. Tente novamente.");
          // Keep the temp analysis visible anyway
          setAllAnalyses(prev => [tempAnalysis, ...prev]);
        } else if (savedAnalysis) {
          const newAnalysis = {
            id: savedAnalysis.id,
            content: fullContent,
            created_at: savedAnalysis.created_at,
          };
          setAnalysis(newAnalysis);
          setAllAnalyses(prev => [newAnalysis, ...prev]);
          toast.success("Análise gerada e salva com sucesso!");
        }
      } else {
        toast.error("Nenhum conteúdo gerado pela IA");
      }
    } catch (error) {
      console.error("Error generating analysis:", error);
      toast.error("Erro ao gerar análise");
    } finally {
      setGenerating(false);
    }
  };

  const contentToShow = generating ? streamedContent : analysis?.content;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Análise Inteligente
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary">IA</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Avaliação automática dos KPIs com recomendações personalizadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {allAnalyses.length > 0 && (
                <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <History className="h-4 w-4" />
                      Histórico
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {allAnalyses.length}
                      </Badge>
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[450px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Histórico de Análises
                      </SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                      <div className="space-y-2 pr-4">
                        {allAnalyses.map((item, index) => (
                          <button
                            key={item.id}
                            onClick={() => selectAnalysis(item)}
                            className={cn(
                              "w-full text-left p-4 rounded-lg border transition-all hover:bg-accent",
                              analysis?.id === item.id && "border-primary bg-primary/5"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  <Brain className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {index === 0 ? "Análise mais recente" : `Análise #${allAnalyses.length - index}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {item.content.slice(0, 150)}...
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              )}
              {analysis && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {format(new Date(analysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
              <Button 
                onClick={generateAnalysis} 
                disabled={generating}
                className="gap-2 shadow-lg"
                size="sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {analysis ? "Nova Análise" : "Gerar Análise"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Content */}
      {contentToShow ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]" ref={scrollRef}>
              <div className="p-6">
                <div className={cn(
                  "prose prose-sm dark:prose-invert max-w-none",
                  "prose-headings:text-foreground prose-headings:font-semibold",
                  "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border",
                  "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2",
                  "prose-p:text-muted-foreground prose-p:leading-relaxed",
                  "prose-li:text-muted-foreground prose-li:marker:text-primary",
                  "prose-strong:text-foreground prose-strong:font-semibold",
                  "prose-ul:my-2 prose-ol:my-2",
                  "prose-table:border prose-table:border-border prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-border",
                  "[&_h2]:flex [&_h2]:items-center [&_h2]:gap-2",
                )}>
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => (
                        <h2 className="flex items-center gap-2">
                          <span className="w-1 h-5 bg-primary rounded-full"></span>
                          {children}
                        </h2>
                      ),
                    }}
                  >
                    {contentToShow}
                  </ReactMarkdown>
                  {generating && (
                    <div className="flex items-center gap-2 mt-4 text-primary animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Gerando análise...</span>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-muted to-muted/50">
                  <Sparkles className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-semibold text-xl">Nenhuma análise gerada ainda</h3>
                <p className="text-muted-foreground text-sm">
                  A IA irá analisar todos os KPIs, identificar pontos de melhoria por vendedor e sugerir ações práticas para atingir as metas.
                </p>
              </div>
              
              {/* Feature highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">Metas vs Resultados</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="text-xs font-medium">Análise por Vendedor</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  <span className="text-xs font-medium">Sugestões de Ação</span>
                </div>
              </div>

              <Button onClick={generateAnalysis} disabled={generating} size="lg" className="mt-4 gap-2 shadow-lg">
                <Sparkles className="h-4 w-4" />
                Gerar Primeira Análise
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
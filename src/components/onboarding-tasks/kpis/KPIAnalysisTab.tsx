import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Sparkles, RefreshCw, Loader2, TrendingUp, Target, Users, Brain, Calendar, 
  Lightbulb, History, ChevronRight, AlertTriangle, CheckCircle2, TrendingDown,
  MessageSquare, Zap, BarChart3
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface KPIAnalysisTabProps {
  companyId: string;
  projectId?: string;
}

interface AnalysisResult {
  id: string;
  content: string;
  created_at: string;
}

interface ParsedSection {
  title: string;
  content: string;
  icon: React.ReactNode;
  color: string;
}

export const KPIAnalysisTab = ({ companyId, projectId }: KPIAnalysisTabProps) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["resumo", "alertas"]));
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
        setAnalysis(analyses[0]);
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
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

      if (fullContent) {
        const tempAnalysis = {
          id: crypto.randomUUID(),
          content: fullContent,
          created_at: new Date().toISOString(),
        };
        setAnalysis(tempAnalysis);
        setStreamedContent("");
        
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

  // Parse content into sections
  const parseContentIntoSections = (content: string): ParsedSection[] => {
    const sections: ParsedSection[] = [];
    const lines = content.split('\n');
    let currentSection: { title: string; lines: string[] } | null = null;

    const sectionConfig: Record<string, { icon: React.ReactNode; color: string }> = {
      'resumo': { icon: <Zap className="h-5 w-5" />, color: 'text-primary' },
      'executivo': { icon: <Zap className="h-5 w-5" />, color: 'text-primary' },
      'kpi': { icon: <BarChart3 className="h-5 w-5" />, color: 'text-blue-500' },
      'indicador': { icon: <BarChart3 className="h-5 w-5" />, color: 'text-blue-500' },
      'vendedor': { icon: <Users className="h-5 w-5" />, color: 'text-violet-500' },
      'equipe': { icon: <Users className="h-5 w-5" />, color: 'text-violet-500' },
      'alerta': { icon: <AlertTriangle className="h-5 w-5" />, color: 'text-amber-500' },
      'atenção': { icon: <AlertTriangle className="h-5 w-5" />, color: 'text-amber-500' },
      'ação': { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-green-500' },
      'plano': { icon: <Target className="h-5 w-5" />, color: 'text-green-500' },
      'recomend': { icon: <Lightbulb className="h-5 w-5" />, color: 'text-amber-500' },
      'sugest': { icon: <Lightbulb className="h-5 w-5" />, color: 'text-amber-500' },
      'conversa': { icon: <MessageSquare className="h-5 w-5" />, color: 'text-cyan-500' },
      'reunião': { icon: <MessageSquare className="h-5 w-5" />, color: 'text-cyan-500' },
      'default': { icon: <TrendingUp className="h-5 w-5" />, color: 'text-muted-foreground' },
    };

    const getConfig = (title: string) => {
      const lowerTitle = title.toLowerCase();
      for (const [key, config] of Object.entries(sectionConfig)) {
        if (key !== 'default' && lowerTitle.includes(key)) {
          return config;
        }
      }
      return sectionConfig.default;
    };

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentSection) {
          const config = getConfig(currentSection.title);
          sections.push({
            title: currentSection.title,
            content: currentSection.lines.join('\n'),
            icon: config.icon,
            color: config.color,
          });
        }
        currentSection = { title: line.replace('## ', '').trim(), lines: [] };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }

    if (currentSection) {
      const config = getConfig(currentSection.title);
      sections.push({
        title: currentSection.title,
        content: currentSection.lines.join('\n'),
        icon: config.icon,
        color: config.color,
      });
    }

    return sections;
  };

  const contentToShow = generating ? streamedContent : analysis?.content;
  const parsedSections = contentToShow && !generating ? parseContentIntoSections(contentToShow) : [];

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
              {/* History button always visible */}
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">Histórico</span>
                    {allAnalyses.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5">
                        {allAnalyses.length}
                      </Badge>
                    )}
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
                      {allAnalyses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma análise no histórico</p>
                        </div>
                      ) : (
                        allAnalyses.map((item, index) => (
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
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              {analysis && (
                <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
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
                    <Sparkles className="h-4 w-4" />
                    {analysis ? "Nova Análise" : "Gerar Análise"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Content */}
      {generating && streamedContent ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]" ref={scrollRef}>
              <div className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{streamedContent}</ReactMarkdown>
                  <div className="flex items-center gap-2 mt-4 text-primary animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Gerando análise...</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : parsedSections.length > 0 ? (
        <div className="space-y-3">
          {parsedSections.map((section, index) => {
            const sectionKey = section.title.toLowerCase().replace(/\s+/g, '-');
            const isExpanded = expandedSections.has(sectionKey) || expandedSections.has('all');
            
            return (
              <Card key={index} className="overflow-hidden transition-all hover:shadow-md">
                <Collapsible open={isExpanded} onOpenChange={() => toggleSection(sectionKey)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="py-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg bg-muted",
                            section.color
                          )}>
                            {section.icon}
                          </div>
                          <CardTitle className="text-base font-semibold">
                            {section.title}
                          </CardTitle>
                        </div>
                        <ChevronRight className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className={cn(
                        "prose prose-sm dark:prose-invert max-w-none",
                        "prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2",
                        "prose-li:text-muted-foreground prose-li:my-1",
                        "prose-strong:text-foreground prose-strong:font-semibold",
                        "prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2",
                        "prose-ul:my-2 prose-ol:my-2",
                        "[&_ul]:space-y-1 [&_ol]:space-y-1",
                        "[&_li]:pl-1",
                      )}>
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
          
          {/* Expand/Collapse All */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (expandedSections.size === parsedSections.length) {
                  setExpandedSections(new Set());
                } else {
                  setExpandedSections(new Set(parsedSections.map(s => s.title.toLowerCase().replace(/\s+/g, '-'))));
                }
              }}
              className="text-muted-foreground"
            >
              {expandedSections.size === parsedSections.length ? "Recolher Tudo" : "Expandir Tudo"}
            </Button>
          </div>
        </div>
      ) : contentToShow ? (
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-headings:text-foreground prose-headings:font-semibold",
              "prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3",
              "prose-p:text-muted-foreground prose-p:leading-relaxed",
              "prose-li:text-muted-foreground",
              "prose-strong:text-foreground",
            )}>
              <ReactMarkdown>{contentToShow}</ReactMarkdown>
            </div>
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
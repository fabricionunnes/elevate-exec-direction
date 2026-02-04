import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Brain, 
  RefreshCw, 
  Loader2,
  Target,
  Shield,
  Users,
  MessageSquare,
  FileText,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  Save
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

interface StrategyAnalysis {
  id: string;
  competitor_analysis: any;
  positioning_statement: string | null;
  unique_value_proposition: string | null;
  communication_guidelines: string | null;
  differentiation_strategy: string | null;
  where_not_to_compete: string | null;
  swot_strengths: string[] | null;
  swot_weaknesses: string[] | null;
  swot_opportunities: string[] | null;
  swot_threats: string[] | null;
  consolidated_briefing: string | null;
  is_approved: boolean;
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  age: number | null;
  profession: string | null;
  goals: string[] | null;
  pain_points: string[] | null;
  fears: string[] | null;
  desires: string[] | null;
  objections: string[] | null;
  ideal_language: string | null;
  ideal_content_types: string[] | null;
  is_primary: boolean;
}

interface StoriesGuideline {
  id: string;
  stories_objective: string | null;
  ideal_frequency: string | null;
  story_types: any;
  ideal_language: string | null;
  suggested_ctas: string[] | null;
  do_list: string[] | null;
  dont_list: string[] | null;
}

export const SocialStrategyIntelligenceTab = ({ projectId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("swot");
  
  const [strategy, setStrategy] = useState<StrategyAnalysis | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [storiesGuide, setStoriesGuide] = useState<StoriesGuideline | null>(null);
  const [briefingId, setBriefingId] = useState<string | null>(null);

  // Editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      // Load briefing
      const { data: briefing } = await supabase
        .from("social_briefing_forms")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (briefing) {
        setBriefingId(briefing.id);
      }

      // Load strategy analysis
      const { data: strategyData } = await supabase
        .from("social_strategy_analysis")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (strategyData) {
        setStrategy(strategyData);
      }

      // Load personas
      const { data: personasData } = await supabase
        .from("social_personas")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

      setPersonas(personasData || []);

      // Load stories guidelines
      const { data: storiesData } = await supabase
        .from("social_stories_guidelines")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (storiesData) {
        setStoriesGuide(storiesData as unknown as StoriesGuideline);
      }
    } catch (error) {
      console.error("Error loading strategy data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateAllAnalyses = async () => {
    if (!briefingId) {
      toast.error("Briefing não encontrado");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-generate-strategy", {
        body: { projectId, briefingId },
      });

      if (error) throw error;

      toast.success("Análises estratégicas geradas com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error generating analyses:", error);
      toast.error("Erro ao gerar análises. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async (field: string, table: "social_strategy_analysis" | "social_personas" | "social_stories_guidelines", id: string) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({ [field]: editValue } as any)
        .eq("id", id);

      if (error) throw error;

      toast.success("Alteração salva!");
      setEditingField(null);
      loadData();
    } catch (error) {
      console.error("Error saving edit:", error);
      toast.error("Erro ao salvar");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = strategy || personas.length > 0 || storiesGuide;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Estratégia & Inteligência</h2>
            <p className="text-sm text-muted-foreground">Análises geradas por IA baseadas no briefing</p>
          </div>
        </div>
        <Button onClick={generateAllAnalyses} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasData ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {hasData ? "Regenerar Análises" : "Gerar Análises"}
        </Button>
      </div>

      {/* Content */}
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md p-8">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-10 w-10 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Pronto para Gerar Inteligência!</h3>
            <p className="text-muted-foreground mb-6">
              Com base no briefing preenchido, a IA vai gerar análises SWOT, personas detalhadas, 
              direcionamento de stories e um posicionamento estratégico completo.
            </p>
            <Button onClick={generateAllAnalyses} disabled={generating} size="lg" className="gap-2">
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Brain className="h-5 w-5" />
              )}
              Gerar Análises Estratégicas
            </Button>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 border-b">
            <TabsList className="h-12">
              <TabsTrigger value="swot" className="gap-2">
                <Shield className="h-4 w-4" />
                SWOT
              </TabsTrigger>
              <TabsTrigger value="positioning" className="gap-2">
                <Target className="h-4 w-4" />
                Posicionamento
              </TabsTrigger>
              <TabsTrigger value="personas" className="gap-2">
                <Users className="h-4 w-4" />
                Personas
              </TabsTrigger>
              <TabsTrigger value="stories" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Stories
              </TabsTrigger>
              <TabsTrigger value="briefing" className="gap-2">
                <FileText className="h-4 w-4" />
                Briefing Consolidado
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            {/* SWOT Tab */}
            <TabsContent value="swot" className="p-6 m-0">
              {strategy ? (
                <div className="grid grid-cols-2 gap-6">
                  {/* Strengths */}
                  <Card className="border-green-200 dark:border-green-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        Forças
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(strategy.swot_strengths || []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-green-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Weaknesses */}
                  <Card className="border-red-200 dark:border-red-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <XCircle className="h-5 w-5" />
                        Fraquezas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(strategy.swot_weaknesses || []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-red-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Opportunities */}
                  <Card className="border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <TrendingUp className="h-5 w-5" />
                        Oportunidades
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(strategy.swot_opportunities || []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Threats */}
                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-5 w-5" />
                        Ameaças
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(strategy.swot_threats || []).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-orange-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Análise SWOT não gerada ainda.
                </div>
              )}
            </TabsContent>

            {/* Positioning Tab */}
            <TabsContent value="positioning" className="p-6 m-0 space-y-6">
              {strategy ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Declaração de Posicionamento
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingField("positioning_statement");
                          setEditValue(strategy.positioning_statement || "");
                        }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {editingField === "positioning_statement" ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit("positioning_statement", "social_strategy_analysis", strategy.id)}>
                              <Save className="h-4 w-4 mr-1" /> Salvar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {strategy.positioning_statement || "Não gerado"}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Proposta de Valor Única</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {strategy.unique_value_proposition || "Não gerado"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Estratégia de Diferenciação</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {strategy.differentiation_strategy || "Não gerado"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-orange-200 dark:border-orange-800">
                    <CardHeader>
                      <CardTitle className="text-orange-600 dark:text-orange-400">
                        Onde NÃO Competir
                      </CardTitle>
                      <CardDescription>Áreas que devem ser evitadas na estratégia</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {strategy.where_not_to_compete || "Não gerado"}
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Posicionamento não gerado ainda.
                </div>
              )}
            </TabsContent>

            {/* Personas Tab */}
            <TabsContent value="personas" className="p-6 m-0">
              {personas.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {personas.map((persona) => (
                    <Card key={persona.id} className={persona.is_primary ? "border-primary" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              {persona.name}
                              {persona.is_primary && (
                                <Badge variant="default">Principal</Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              {persona.age && `${persona.age} anos`}
                              {persona.profession && ` • ${persona.profession}`}
                            </CardDescription>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                            {persona.name.charAt(0)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {persona.goals && persona.goals.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Objetivos</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {persona.goals.map((g, i) => <li key={i}>• {g}</li>)}
                            </ul>
                          </div>
                        )}
                        {persona.pain_points && persona.pain_points.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Dores</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {persona.pain_points.map((p, i) => <li key={i}>• {p}</li>)}
                            </ul>
                          </div>
                        )}
                        {persona.desires && persona.desires.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Desejos</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {persona.desires.map((d, i) => <li key={i}>• {d}</li>)}
                            </ul>
                          </div>
                        )}
                        {persona.ideal_language && (
                          <div>
                            <p className="text-sm font-medium mb-1">Linguagem Ideal</p>
                            <p className="text-sm text-muted-foreground">{persona.ideal_language}</p>
                          </div>
                        )}
                        {persona.ideal_content_types && persona.ideal_content_types.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {persona.ideal_content_types.map((type, i) => (
                              <Badge key={i} variant="secondary">{type}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Personas não geradas ainda.
                </div>
              )}
            </TabsContent>

            {/* Stories Tab */}
            <TabsContent value="stories" className="p-6 m-0 space-y-6">
              {storiesGuide ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Objetivo dos Stories</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">
                          {storiesGuide.stories_objective || "Não definido"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Frequência Ideal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">
                          {storiesGuide.ideal_frequency || "Não definido"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {storiesGuide.story_types && storiesGuide.story_types.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Tipos de Stories</CardTitle>
                        <CardDescription>Categorias e proporções sugeridas</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {(storiesGuide.story_types as any[]).map((type, i) => (
                            <div key={i} className="p-4 rounded-lg border bg-muted/50">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium capitalize">{type.type}</p>
                                {type.percentage && (
                                  <Badge variant="outline">{type.percentage}%</Badge>
                                )}
                              </div>
                              {type.description && (
                                <p className="text-sm text-muted-foreground">{type.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardHeader>
                        <CardTitle className="text-green-600 dark:text-green-400">O que Fazer</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {(storiesGuide.do_list || []).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="border-red-200 dark:border-red-800">
                      <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400">O que Evitar</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {(storiesGuide.dont_list || []).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {storiesGuide.suggested_ctas && storiesGuide.suggested_ctas.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>CTAs Sugeridos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {storiesGuide.suggested_ctas.map((cta, i) => (
                            <Badge key={i} variant="secondary">{cta}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Direcionamento de stories não gerado ainda.
                </div>
              )}
            </TabsContent>

            {/* Consolidated Briefing Tab */}
            <TabsContent value="briefing" className="p-6 m-0">
              {strategy?.consolidated_briefing ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Briefing Estratégico Consolidado
                    </CardTitle>
                    <CardDescription>
                      Documento de referência para toda criação de conteúdo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        {strategy.consolidated_briefing}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Briefing consolidado não gerado ainda.
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      )}
    </div>
  );
};

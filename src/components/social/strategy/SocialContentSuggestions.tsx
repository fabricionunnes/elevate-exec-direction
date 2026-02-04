import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, 
  RefreshCw, 
  Loader2,
  Image,
  Film,
  MessageSquare,
  Target,
  Users,
  TrendingUp,
  Heart,
  ArrowRight,
  Plus,
  Check
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  boardId: string;
}

interface ContentSuggestion {
  id: string;
  title: string;
  content_format: string;
  objective: string;
  theme: string | null;
  creative_idea: string | null;
  copy_idea: string | null;
  suggested_cta: string | null;
  hashtag_suggestions: string[] | null;
  based_on_persona_id: string | null;
  status: string;
  created_at: string;
}

const formatLabels: Record<string, { label: string; icon: any; color: string }> = {
  feed: { label: "Feed", icon: Image, color: "bg-blue-500" },
  reels: { label: "Reels", icon: Film, color: "bg-pink-500" },
  stories: { label: "Stories", icon: MessageSquare, color: "bg-purple-500" },
  carousel: { label: "Carrossel", icon: Image, color: "bg-green-500" },
};

const objectiveLabels: Record<string, { label: string; icon: any; color: string }> = {
  engajamento: { label: "Engajamento", icon: Heart, color: "text-pink-500" },
  autoridade: { label: "Autoridade", icon: TrendingUp, color: "text-blue-500" },
  conversao: { label: "Conversão", icon: Target, color: "text-green-500" },
  relacionamento: { label: "Relacionamento", icon: Users, color: "text-purple-500" },
};

export const SocialContentSuggestions = ({ projectId, boardId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [activeFormat, setActiveFormat] = useState("all");

  useEffect(() => {
    loadSuggestions();
  }, [projectId]);

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from("social_content_suggestions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-generate-suggestions", {
        body: { projectId },
      });

      if (error) throw error;

      toast.success("Sugestões geradas com sucesso!");
      loadSuggestions();
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast.error("Erro ao gerar sugestões");
    } finally {
      setGenerating(false);
    }
  };

  const convertToCard = async (suggestion: ContentSuggestion) => {
    setConverting(suggestion.id);
    try {
      // Get first stage
      const { data: stages } = await supabase
        .from("social_content_stages")
        .select("id")
        .eq("board_id", boardId)
        .eq("is_active", true)
        .order("sort_order")
        .limit(1);

      if (!stages || stages.length === 0) {
        toast.error("Nenhuma etapa encontrada no kanban");
        return;
      }

      // Create card
      const { data: card, error } = await supabase
        .from("social_content_cards")
        .insert({
          board_id: boardId,
          stage_id: stages[0].id,
          content_type: suggestion.content_format as "feed" | "reels" | "stories",
          theme: suggestion.title,
          objective: suggestion.objective,
          copy_text: suggestion.copy_idea,
          final_caption: suggestion.copy_idea,
          cta: suggestion.suggested_cta,
          hashtags: suggestion.hashtag_suggestions?.join(" "),
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Update suggestion status
      await supabase
        .from("social_content_suggestions")
        .update({ 
          status: "converted",
          converted_to_card_id: card.id,
        })
        .eq("id", suggestion.id);

      toast.success("Card criado no pipeline!");
      loadSuggestions();
    } catch (error) {
      console.error("Error converting to card:", error);
      toast.error("Erro ao criar card");
    } finally {
      setConverting(null);
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    activeFormat === "all" || s.content_format === activeFormat
  );

  const pendingSuggestions = filteredSuggestions.filter(s => s.status === "pending");
  const convertedSuggestions = filteredSuggestions.filter(s => s.status === "converted");

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Sugestões de Conteúdo</h2>
            <p className="text-sm text-muted-foreground">
              Ideias geradas com base na sua estratégia
            </p>
          </div>
        </div>
        <Button onClick={generateSuggestions} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : suggestions.length > 0 ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {suggestions.length > 0 ? "Gerar Mais" : "Gerar Sugestões"}
        </Button>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b">
        <Tabs value={activeFormat} onValueChange={setActiveFormat}>
          <TabsList>
            <TabsTrigger value="all">Todos ({suggestions.length})</TabsTrigger>
            <TabsTrigger value="feed" className="gap-1">
              <Image className="h-3 w-3" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="reels" className="gap-1">
              <Film className="h-3 w-3" />
              Reels
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              Stories
            </TabsTrigger>
            <TabsTrigger value="carousel" className="gap-1">
              <Image className="h-3 w-3" />
              Carrossel
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {suggestions.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Gere Ideias de Conteúdo</h3>
              <p className="text-muted-foreground mb-6">
                A IA vai analisar sua estratégia, personas e posicionamento para sugerir 
                conteúdos relevantes e alinhados com seus objetivos.
              </p>
              <Button onClick={generateSuggestions} disabled={generating} size="lg" className="gap-2">
                {generating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                Gerar Sugestões
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Novas Sugestões ({pendingSuggestions.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendingSuggestions.map((suggestion) => {
                    const formatInfo = formatLabels[suggestion.content_format] || formatLabels.feed;
                    const objectiveInfo = objectiveLabels[suggestion.objective] || objectiveLabels.engajamento;

                    return (
                      <Card key={suggestion.id} className="group hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg ${formatInfo.color} flex items-center justify-center`}>
                                <formatInfo.icon className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <Badge variant="outline" className="text-xs">
                                  {formatInfo.label}
                                </Badge>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1 text-xs ${objectiveInfo.color}`}>
                              <objectiveInfo.icon className="h-3 w-3" />
                              {objectiveInfo.label}
                            </div>
                          </div>
                          <CardTitle className="text-base mt-2 line-clamp-2">
                            {suggestion.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {suggestion.creative_idea && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Ideia Criativa</p>
                              <p className="text-sm line-clamp-2">{suggestion.creative_idea}</p>
                            </div>
                          )}
                          {suggestion.copy_idea && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Ideia de Copy</p>
                              <p className="text-sm line-clamp-2">{suggestion.copy_idea}</p>
                            </div>
                          )}
                          {suggestion.suggested_cta && (
                            <Badge variant="secondary" className="text-xs">
                              CTA: {suggestion.suggested_cta}
                            </Badge>
                          )}
                          
                          <Button 
                            onClick={() => convertToCard(suggestion)}
                            disabled={converting === suggestion.id}
                            className="w-full gap-2 mt-2"
                            size="sm"
                          >
                            {converting === suggestion.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            Criar Card no Pipeline
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Converted Suggestions */}
            {convertedSuggestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Já Convertidos ({convertedSuggestions.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {convertedSuggestions.map((suggestion) => {
                    const formatInfo = formatLabels[suggestion.content_format] || formatLabels.feed;

                    return (
                      <Card key={suggestion.id} className="opacity-60">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg ${formatInfo.color} flex items-center justify-center`}>
                                <formatInfo.icon className="h-4 w-4 text-white" />
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {formatInfo.label}
                              </Badge>
                            </div>
                            <Badge variant="secondary" className="gap-1">
                              <Check className="h-3 w-3" />
                              Convertido
                            </Badge>
                          </div>
                          <CardTitle className="text-base mt-2 line-clamp-2">
                            {suggestion.title}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

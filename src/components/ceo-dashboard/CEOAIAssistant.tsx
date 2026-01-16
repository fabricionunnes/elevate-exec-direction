import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Sparkles, AlertTriangle, Lightbulb, TrendingUp, Check, X, Clock, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Recommendation {
  id?: string;
  insight: string;
  category: "critico" | "importante" | "oportunidade";
  type: "insight" | "sugestao" | "alerta";
  area?: string;
  suggested_action?: string;
  status?: string;
  created_at?: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ceo-ai-analysis`;

export function CEOAIAssistant() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchRecommendations = async () => {
    try {
      const { data } = await (supabase as any)
        .from("ceo_ai_recommendations")
        .select("*")
        .order("created_at", { ascending: false });

      setRecommendations(data || []);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const { data } = await (supabase as any)
        .from("ceo_ai_chat")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);

      setChatMessages(data || []);
    } catch (error) {
      console.error("Error fetching chat:", error);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    fetchChatHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "generate-insights" }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
          return;
        }
        throw new Error("Failed to generate insights");
      }

      const data = await response.json();

      if (data.recommendations?.length) {
        // Save recommendations to database
        for (const rec of data.recommendations) {
          await (supabase as any)
            .from("ceo_ai_recommendations")
            .insert({
              insight: rec.insight,
              category: rec.category,
              type: rec.type,
              area: rec.area,
              suggested_action: rec.suggested_action,
              data_sources: ["metrics", "decisions", "health_scores"],
            });
        }
        toast.success(`${data.recommendations.length} insights gerados!`);
        fetchRecommendations();
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar insights");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChat = async () => {
    if (!inputMessage.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: inputMessage };
    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsChatLoading(true);

    // Save user message
    await (supabase as any)
      .from("ceo_ai_chat")
      .insert({ role: "user", content: inputMessage });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "chat",
          message: inputMessage,
          messages: chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido");
          return;
        }
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await (supabase as any)
          .from("ceo_ai_chat")
          .insert({ role: "assistant", content: assistantContent });
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Erro no chat");
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsChatLoading(false);
    }
  };

  const updateRecommendationStatus = async (id: string, status: string) => {
    try {
      await (supabase as any)
        .from("ceo_ai_recommendations")
        .update({ 
          status, 
          executed_at: status === "executada" ? new Date().toISOString() : null 
        })
        .eq("id", id);

      toast.success("Status atualizado");
      fetchRecommendations();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "critico": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "importante": return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case "oportunidade": return <TrendingUp className="h-4 w-4 text-green-500" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "critico": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "importante": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "oportunidade": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "executada": return <Check className="h-3 w-3" />;
      case "ignorada": return <X className="h-3 w-3" />;
      case "em_analise": return <Clock className="h-3 w-3" />;
      default: return null;
    }
  };

  const pendingRecs = recommendations.filter(r => r.status === "pendente" || !r.status);
  const processedRecs = recommendations.filter(r => r.status && r.status !== "pendente");

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">IA do CEO</h2>
                <p className="text-muted-foreground">Análise estratégica contínua do seu negócio</p>
              </div>
            </div>
            <Button onClick={generateInsights} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Gerar Insights
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Recomendações
            {pendingRecs.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingRecs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Pergunte à IA
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="py-8">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ) : pendingRecs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma recomendação pendente. Clique em "Gerar Insights" para análise.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRecs.map((rec) => (
                <Card key={rec.id} className={cn("border-l-4", getCategoryColor(rec.category))}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getCategoryIcon(rec.category)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getCategoryColor(rec.category)}>
                            {rec.category}
                          </Badge>
                          <Badge variant="outline">{rec.type}</Badge>
                          {rec.area && <Badge variant="secondary">{rec.area}</Badge>}
                        </div>
                        <p className="font-medium mb-2">{rec.insight}</p>
                        {rec.suggested_action && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Ação sugerida:</strong> {rec.suggested_action}
                          </p>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Button 
                            size="sm" 
                            onClick={() => updateRecommendationStatus(rec.id!, "executada")}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Executada
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateRecommendationStatus(rec.id!, "em_analise")}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Em Análise
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => updateRecommendationStatus(rec.id!, "ignorada")}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Ignorar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Pergunte à IA do CEO
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Faça perguntas estratégicas sobre seu negócio</p>
                      <p className="text-sm mt-2">
                        Exemplos: "Qual o maior risco atual?", "O que devo priorizar esta semana?"
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && chatMessages[chatMessages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Pergunte à IA do CEO..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                  disabled={isChatLoading}
                />
                <Button onClick={handleChat} disabled={isChatLoading || !inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              {processedRecs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma recomendação processada ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {processedRecs.map((rec) => (
                    <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      {getCategoryIcon(rec.category)}
                      <div className="flex-1">
                        <p className="text-sm">{rec.insight}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              rec.status === "executada" && "bg-green-500/10 text-green-500",
                              rec.status === "ignorada" && "bg-gray-500/10 text-gray-500",
                              rec.status === "em_analise" && "bg-blue-500/10 text-blue-500"
                            )}
                          >
                            {getStatusIcon(rec.status!)}
                            <span className="ml-1">{rec.status}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {rec.created_at && new Date(rec.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

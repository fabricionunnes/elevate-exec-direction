import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot, Send, Loader2, Sparkles, BookmarkPlus, Bookmark, CheckCircle2,
  Trash2, Brain, TrendingUp, AlertTriangle, Lightbulb, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

interface SavedInsight {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  applied_at: string | null;
  applied_notes: string | null;
}

const QUICK_PROMPTS = [
  { label: "Análise Geral", prompt: "Faça uma análise completa da saúde financeira da empresa, identificando os principais riscos e oportunidades.", icon: Brain },
  { label: "Inadimplência", prompt: "Analise a situação de inadimplência da empresa. Quais são os riscos e o que posso fazer para reduzir?", icon: AlertTriangle },
  { label: "Otimizar Custos", prompt: "Analise minha estrutura de custos e sugira onde posso otimizar para melhorar a margem.", icon: TrendingUp },
  { label: "Fluxo de Caixa", prompt: "Avalie meu fluxo de caixa atual e projete os próximos meses. Há riscos de liquidez?", icon: Lightbulb },
];

const CATEGORY_COLORS: Record<string, string> = {
  geral: "bg-primary/10 text-primary",
  receita: "bg-emerald-500/10 text-emerald-600",
  custo: "bg-amber-500/10 text-amber-600",
  risco: "bg-destructive/10 text-destructive",
  oportunidade: "bg-blue-500/10 text-blue-600",
};

export function CFOAIPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{ open: boolean; content: string }>({ open: false, content: "" });
  const [saveForm, setSaveForm] = useState({ title: "", category: "geral", priority: "medium" });
  const [savingInsight, setSavingInsight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSavedInsights();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadSavedInsights = async () => {
    const { data } = await supabase
      .from("cfo_ai_insights")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSavedInsights(data as SavedInsight[]);
  };

  const streamChat = async (userMessages: Message[]) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfo-ai-analysis`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `Erro ${resp.status}`);
    }

    if (!resp.body) throw new Error("No response body");
    return resp.body.getReader();
  };

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    let assistantContent = "";

    try {
      const reader = await streamChat(newMessages);
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar IA");
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveInsight = async () => {
    if (!saveForm.title.trim()) {
      toast.error("Informe um título para o insight");
      return;
    }
    setSavingInsight(true);
    const { error } = await supabase.from("cfo_ai_insights").insert({
      title: saveForm.title,
      content: saveDialog.content,
      category: saveForm.category,
      priority: saveForm.priority,
    } as any);

    if (error) {
      toast.error("Erro ao salvar insight");
    } else {
      toast.success("Insight salvo com sucesso!");
      setSaveDialog({ open: false, content: "" });
      setSaveForm({ title: "", category: "geral", priority: "medium" });
      loadSavedInsights();
    }
    setSavingInsight(false);
  };

  const handleApplyInsight = async (id: string) => {
    const { error } = await supabase
      .from("cfo_ai_insights")
      .update({ status: "applied", applied_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (!error) {
      toast.success("Insight marcado como aplicado!");
      loadSavedInsights();
    }
  };

  const handleDeleteInsight = async (id: string) => {
    const { error } = await supabase.from("cfo_ai_insights").delete().eq("id", id);
    if (!error) {
      toast.success("Insight removido");
      loadSavedInsights();
    }
  };

  const pendingInsights = savedInsights.filter(i => i.status === "pending");
  const appliedInsights = savedInsights.filter(i => i.status === "applied");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            CFO IA
          </h2>
          <p className="text-muted-foreground">Inteligência Artificial analisando seus dados financeiros como um CFO profissional</p>
        </div>
        <Button
          variant={showSaved ? "default" : "outline"}
          onClick={() => setShowSaved(!showSaved)}
          className="gap-2"
        >
          <Bookmark className="h-4 w-4" />
          Insights Salvos ({savedInsights.length})
        </Button>
      </div>

      {showSaved ? (
        /* Saved Insights View */
        <div className="space-y-4">
          {savedInsights.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum insight salvo ainda. Converse com o CFO IA e salve os melhores insights!</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingInsights.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Pendentes de Aplicação ({pendingInsights.length})</h3>
                  <div className="grid gap-3">
                    {pendingInsights.map(insight => (
                      <Card key={insight.id} className="border-l-4 border-l-primary">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold truncate">{insight.title}</h4>
                                <Badge variant="outline" className={CATEGORY_COLORS[insight.category] || ""}>
                                  {insight.category}
                                </Badge>
                                <Badge variant={insight.priority === "high" ? "destructive" : insight.priority === "medium" ? "default" : "secondary"}>
                                  {insight.priority === "high" ? "Alta" : insight.priority === "medium" ? "Média" : "Baixa"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                                <ReactMarkdown>{insight.content.slice(0, 300) + (insight.content.length > 300 ? "..." : "")}</ReactMarkdown>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Salvo em {new Date(insight.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleApplyInsight(insight.id)} title="Marcar como aplicado">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteInsight(insight.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {appliedInsights.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Aplicados ({appliedInsights.length})</h3>
                  <div className="grid gap-3">
                    {appliedInsights.map(insight => (
                      <Card key={insight.id} className="opacity-70 border-l-4 border-l-emerald-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <h4 className="font-semibold truncate">{insight.title}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Aplicado em {insight.applied_at ? new Date(insight.applied_at).toLocaleDateString("pt-BR") : "—"}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => handleDeleteInsight(insight.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Chat View */
        <div className="space-y-4">
          {/* Quick Prompts */}
          {messages.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_PROMPTS.map((qp) => {
                const Icon = qp.icon;
                return (
                  <Card
                    key={qp.label}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSend(qp.prompt)}
                  >
                    <CardContent className="pt-4 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{qp.label}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{qp.prompt}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <Card className="border-0 shadow-none">
              <ScrollArea className="h-[500px] pr-4" ref={scrollRef as any}>
                <div className="space-y-4 p-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="space-y-2">
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {!isStreaming && msg.content.length > 50 && (
                              <div className="flex justify-end pt-2 border-t border-border/30">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setSaveDialog({ open: true, content: msg.content });
                                    setSaveForm({ title: "", category: "geral", priority: "medium" });
                                  }}
                                >
                                  <BookmarkPlus className="h-3.5 w-3.5" />
                                  Salvar Insight
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Input */}
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMessages([])}
                title="Nova conversa"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ao CFO IA sobre suas finanças..."
              className="min-h-[48px] max-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={() => handleSend()} disabled={isStreaming || !input.trim()} size="icon" className="shrink-0 h-12 w-12">
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialog.open} onOpenChange={(o) => !o && setSaveDialog({ open: false, content: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5" />
              Salvar Insight
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={saveForm.title}
                onChange={(e) => setSaveForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Reduzir inadimplência em 30 dias"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={saveForm.category} onValueChange={(v) => setSaveForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="custo">Custo</SelectItem>
                    <SelectItem value="risco">Risco</SelectItem>
                    <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={saveForm.priority} onValueChange={(v) => setSaveForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground">{saveDialog.content.slice(0, 500)}...</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog({ open: false, content: "" })}>Cancelar</Button>
            <Button onClick={handleSaveInsight} disabled={savingInsight}>
              {savingInsight ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookmarkPlus className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

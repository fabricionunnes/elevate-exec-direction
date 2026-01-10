import { useState, useRef, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  ArrowLeft, 
  Sparkles, 
  Loader2,
  Bot,
  User,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Function to parse CTA buttons from text
const parseCtaButtons = (text: string) => {
  const ctaRegex = /\[CTA_BUTTON:([^:]+):([^\]]+)\]/g;
  const parts: Array<{ type: 'text' | 'button'; content: string; label?: string; link?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = ctaRegex.exec(text)) !== null) {
    // Add text before the button
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // Add the button
    parts.push({ 
      type: 'button', 
      content: match[0], 
      label: match[1], 
      link: match[2] 
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
};

interface PortalUser {
  id: string;
  name: string;
  company_id: string;
  portal_companies?: {
    name: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PlanningData {
  plan: any;
  northStar: any;
  objectives: any[];
  keyResults: any[];
  rocks: any[];
  checkins: any[];
  strategies: any[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-ai-coach`;

const PortalCoachPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [planningData, setPlanningData] = useState<PlanningData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch planning data on mount
  useEffect(() => {
    const fetchPlanningData = async () => {
      if (!user?.company_id) {
        setIsLoadingData(false);
        return;
      }

      try {
        // Fetch the latest plan for this company
        const { data: plans, error: planError } = await supabase
          .from("portal_plans")
          .select("*")
          .eq("company_id", user.company_id)
          .order("version", { ascending: false })
          .limit(1);

        if (planError) throw planError;
        const plan = plans?.[0];

        if (!plan) {
          setPlanningData(null);
          setIsLoadingData(false);
          initializeChat(null);
          return;
        }

        // Fetch related data in parallel
        const [
          { data: northStars },
          { data: objectives },
          { data: rocks },
          { data: strategies }
        ] = await Promise.all([
          supabase.from("portal_north_stars").select("*").eq("plan_id", plan.id),
          supabase.from("portal_objectives").select("*").eq("plan_id", plan.id).order("priority"),
          supabase.from("portal_rocks").select("*").eq("plan_id", plan.id).order("quarter"),
          supabase.from("portal_strategies").select("*").eq("plan_id", plan.id).order("priority")
        ]);

        // Fetch key results for all objectives
        let keyResults: any[] = [];
        let checkins: any[] = [];
        
        if (objectives && objectives.length > 0) {
          const objIds = objectives.map(o => o.id);
          const { data: krs } = await supabase
            .from("portal_key_results")
            .select("*")
            .in("objective_id", objIds);
          
          keyResults = krs || [];

          // Fetch recent checkins for all key results
          if (keyResults.length > 0) {
            const krIds = keyResults.map(kr => kr.id);
            const { data: checkinsData } = await supabase
              .from("portal_checkins")
              .select("*")
              .in("key_result_id", krIds)
              .order("week_ref", { ascending: false });
            
            checkins = checkinsData || [];
          }
        }

        const data: PlanningData = {
          plan,
          northStar: northStars?.[0] || null,
          objectives: objectives || [],
          keyResults,
          rocks: rocks || [],
          checkins,
          strategies: strategies || []
        };

        setPlanningData(data);
        initializeChat(data);
      } catch (error) {
        console.error("Error fetching planning data:", error);
        toast.error("Erro ao carregar dados do planejamento");
        initializeChat(null);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchPlanningData();
  }, [user?.company_id]);

  const initializeChat = (data: PlanningData | null) => {
    let welcomeMessage = `Olá, ${user?.name?.split(" ")[0]}! 👋

Sou a **Diretora Estratégica da UNV**. `;

    if (data?.plan) {
      const planStatus = data.plan.status === 'published' ? 'publicado' : 'em construção';
      const progress = data.objectives?.length || 0;
      const krsTotal = data.keyResults?.length || 0;
      const krsOnTrack = data.keyResults?.filter(kr => kr.status === 'on_track').length || 0;
      const strategiesCount = data.strategies?.length || 0;
      const strategiesInProgress = data.strategies?.filter(s => s.status === 'in_progress').length || 0;
      
      welcomeMessage += `Vejo que você tem um plano ${planStatus} para ${data.plan.year}.

📊 **Resumo do seu planejamento:**
- ${progress} objetivo(s) definido(s)
- ${krsTotal} key result(s) sendo acompanhados
- ${krsOnTrack} no caminho certo
${strategiesCount > 0 ? `- ${strategiesCount} estratégia(s) cadastrada(s) (${strategiesInProgress} em andamento)` : ''}

Como posso ajudar você hoje?`;
    } else {
      welcomeMessage += `Ainda não encontrei um plano estratégico cadastrado para sua empresa.

Como posso ajudar você hoje?

- 📋 Orientar no preenchimento do planejamento
- 🎯 Ajudar a definir OKRs e metas
- 🚀 Sugerir próximas ações para destravar resultados
- 📊 Explicar como funciona o sistema`;
    }

    setMessages([{ role: "assistant", content: welcomeMessage }]);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          companyName: user?.portal_companies?.name,
          userName: user?.name,
          planningData: planningData,
        }),
      });

      if (resp.status === 429) {
        toast.error("Limite de requisições atingido. Tente novamente em alguns minutos.");
        setIsLoading(false);
        return;
      }

      if (resp.status === 402) {
        toast.error("Créditos insuficientes. Entre em contato com o suporte.");
        setIsLoading(false);
        return;
      }

      if (!resp.ok || !resp.body) {
        throw new Error("Falha ao conectar com a IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      // Add empty assistant message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === "assistant") {
                  lastMessage.content = assistantContent;
                }
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      // Remove empty assistant message on error
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoadingData) {
    return (
      <div className="h-[calc(100vh-4rem)] lg:h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-slate-400 text-sm">Carregando dados do planejamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 p-4 flex items-center gap-4">
        <Link to="/portal/app">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <h1 className="text-white font-semibold">IA Coach UNV</h1>
          <p className="text-xs text-slate-400">Diretora Estratégica</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-slate-950" />
              </div>
            )}
            
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              {message.content ? (
                <div className={`text-sm leading-relaxed ${
                  message.role === "user" 
                    ? "" 
                    : ""
                }`}>
                  {message.role === "assistant" ? (
                    // Parse content for CTA buttons
                    parseCtaButtons(message.content).map((part, partIndex) => {
                      if (part.type === 'button') {
                        return (
                          <div 
                            key={partIndex}
                            className="mt-4 mb-2 p-4 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
                                Serviço Recomendado
                              </span>
                            </div>
                            <Link
                              to={part.link || "#"}
                              className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] text-base"
                            >
                              <span>{part.label}</span>
                              <ExternalLink className="w-5 h-5" />
                            </Link>
                          </div>
                        );
                      }
                      return (
                        <div key={partIndex} className={`prose prose-sm max-w-none prose-invert prose-p:text-slate-200 prose-strong:text-amber-400 prose-headings:text-amber-400 prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-li:text-slate-200 prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline prose-hr:border-slate-600`}>
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => (
                                <Link 
                                  to={href || "#"} 
                                  className="text-amber-400 hover:text-amber-300 hover:underline font-medium"
                                >
                                  {children}
                                </Link>
                              ),
                              code: ({ children }) => (
                                <code className="bg-slate-700 px-1.5 py-0.5 rounded text-amber-300 text-xs">
                                  {children}
                                </code>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-amber-500 pl-3 italic text-slate-300">
                                  {children}
                                </blockquote>
                              ),
                              hr: () => (
                                <hr className="border-slate-600 my-4" />
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside space-y-1 text-slate-200">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside space-y-1 text-slate-200">
                                  {children}
                                </ol>
                              ),
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">
                                  {children}
                                </p>
                              ),
                            }}
                          >
                            {part.content}
                          </ReactMarkdown>
                        </div>
                      );
                    })
                  ) : (
                    // User messages - simple text
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
              ) : (
                isLoading && index === messages.length - 1 && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/80">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PortalCoachPage;

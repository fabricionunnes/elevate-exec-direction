import { useState, useRef, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Send, 
  ArrowLeft, 
  Sparkles, 
  Loader2,
  Bot,
  User
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-ai-coach`;

const PortalCoachPage = () => {
  const { user } = useOutletContext<{ user: PortalUser }>();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Olá, ${user?.name?.split(" ")[0]}! 👋

Sou a **Diretora Estratégica da UNV**. Estou aqui para orientar você no Planejamento 2026 e na execução ao longo do ano.

Como posso ajudar hoje?

- 📋 Orientar no preenchimento do planejamento
- 🎯 Revisar seus OKRs e dar feedback
- 🚀 Sugerir próximas ações para destravar resultados
- 📊 Analisar progresso e identificar gargalos`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content || (isLoading && index === messages.length - 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null)}
              </div>
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

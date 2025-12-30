import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/service-advisor-chat`;

type Message = { role: "user" | "assistant"; content: string };

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 429) {
        onError("Muitas requisições. Aguarde um momento e tente novamente.");
        return;
      }
      if (resp.status === 402) {
        onError("Limite de uso atingido. Tente mais tarde.");
        return;
      }
      onError(errorData.error || "Erro ao processar mensagem.");
      return;
    }

    if (!resp.body) {
      onError("Resposta vazia do servidor.");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
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
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          /* ignore */
        }
      }
    }

    onDone();
  } catch (error) {
    console.error("Stream error:", error);
    onError("Erro de conexão. Verifique sua internet e tente novamente.");
  }
}

export function ServiceAdvisorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Save messages to database
  const saveToDatabase = async (newMessages: Message[], extractedData?: { name?: string; email?: string; phone?: string }) => {
    try {
      if (!leadId) {
        // Create new lead
        const { data, error } = await supabase
          .from('chat_advisor_leads')
          .insert({
            messages: newMessages,
            name: extractedData?.name || null,
            email: extractedData?.email || null,
            phone: extractedData?.phone || null,
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error creating lead:', error);
          return;
        }
        
        if (data) {
          setLeadId(data.id);
        }
      } else {
        // Update existing lead
        const updateData: any = { messages: newMessages };
        if (extractedData?.name) updateData.name = extractedData.name;
        if (extractedData?.email) updateData.email = extractedData.email;
        if (extractedData?.phone) updateData.phone = extractedData.phone;

        const { error } = await supabase
          .from('chat_advisor_leads')
          .update(updateData)
          .eq('id', leadId);

        if (error) {
          console.error('Error updating lead:', error);
        }
      }
    } catch (error) {
      console.error('Error saving to database:', error);
    }
  };

  // Extract contact info from conversation
  const extractContactInfo = (allMessages: Message[]) => {
    const data: { name?: string; email?: string; phone?: string } = {};
    
    // Simple extraction logic - looks at user messages after certain questions
    const userMessages = allMessages.filter(m => m.role === 'user').map(m => m.content);
    const assistantMessages = allMessages.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
    
    for (let i = 0; i < assistantMessages.length && i < userMessages.length; i++) {
      const assistantMsg = assistantMessages[i];
      const userResponse = userMessages[i];
      
      // Check for name question
      if (assistantMsg.includes('qual é o seu nome') || assistantMsg.includes('qual seu nome')) {
        // Next user message after this is likely the name
        if (userResponse && !userResponse.includes('@') && !userResponse.match(/^\d/)) {
          data.name = userResponse.trim();
        }
      }
      
      // Check for email
      if (userResponse && userResponse.includes('@') && userResponse.includes('.')) {
        const emailMatch = userResponse.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          data.email = emailMatch[0];
        }
      }
      
      // Check for phone
      if (assistantMsg.includes('telefone') || assistantMsg.includes('whatsapp')) {
        const phoneMatch = userResponse.match(/[\d\s\-().+]+/);
        if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 8) {
          data.phone = phoneMatch[0].trim();
        }
      }
    }
    
    // Also check last few messages for contact info
    const recentUserMessages = userMessages.slice(-5);
    for (const msg of recentUserMessages) {
      if (!data.email && msg.includes('@') && msg.includes('.')) {
        const emailMatch = msg.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) data.email = emailMatch[0];
      }
      if (!data.phone) {
        const phoneMatch = msg.match(/[\d\s\-().+]+/);
        if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 8) {
          data.phone = phoneMatch[0].trim();
        }
      }
    }
    
    return data;
  };

  const startConversation = async () => {
    setHasStarted(true);
    setIsLoading(true);

    let assistantContent = "";
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    await streamChat({
      messages: [],
      onDelta: upsertAssistant,
      onDone: () => {
        setIsLoading(false);
        // Save initial message
        const initialMessages: Message[] = [{ role: "assistant", content: assistantContent }];
        saveToDatabase(initialMessages);
      },
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
      },
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    await streamChat({
      messages: newMessages,
      onDelta: upsertAssistant,
      onDone: () => {
        setIsLoading(false);
        // Save all messages with extracted contact info
        const allMessages = [...newMessages, { role: "assistant" as const, content: assistantContent }];
        const contactInfo = extractContactInfo(allMessages);
        saveToDatabase(allMessages, contactInfo);
      },
      onError: (error) => {
        toast.error(error);
        setIsLoading(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    if (!hasStarted) {
      startConversation();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={openChat}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        aria-label="Abrir chat de recomendação de serviços"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium">Qual serviço é ideal para mim?</span>
      </button>
    );
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        aria-label="Expandir chat"
      >
        <Bot className="h-5 w-5" />
        <span className="font-medium">Consultor UNV</span>
        {messages.length > 0 && (
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{messages.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-100px)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-semibold text-sm">Consultor UNV</h3>
            <p className="text-xs text-primary-foreground/70">Encontre o serviço ideal</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Iniciando conversa...</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-secondary text-secondary-foreground rounded-bl-md"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-xl h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Powered by UNV AI • Suas conversas são privadas
        </p>
      </div>
    </div>
  );
}

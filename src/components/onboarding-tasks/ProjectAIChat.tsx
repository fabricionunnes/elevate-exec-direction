import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GoogleDriveConnect } from "@/components/onboarding-tasks/GoogleDriveConnect";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface ProjectAIChatProps {
  projectId: string;
  companyId: string;
  projectName: string;
  companyName?: string;
  documentsLink?: string | null;
}

export const ProjectAIChat = ({
  projectId,
  companyId,
  projectName,
  companyName,
  documentsLink,
}: ProjectAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    getCurrentUser();
  }, [projectId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages, sending]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  const [isStaffUser, setIsStaffUser] = useState(false);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // First try to find as onboarding_user
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .maybeSingle();
      
      if (onboardingUser) {
        setCurrentUserId(onboardingUser.id);
        setIsStaffUser(false);
        return;
      }

      // If not found, check if user is staff (admin/cs/consultant)
      const { data: staffUser } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (staffUser) {
        setCurrentUserId(staffUser.id);
        setIsStaffUser(true);
      }
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_ai_chat")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!currentUserId) {
      toast.error("Usuário não identificado. Faça login novamente.");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      // Build insert data based on user type (staff vs onboarding user)
      const insertData: any = {
        project_id: projectId,
        role: "user",
        content: userMessage,
      };
      
      if (isStaffUser) {
        insertData.staff_id = currentUserId;
      } else {
        insertData.user_id = currentUserId;
      }

      // Save user message to DB
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from("onboarding_ai_chat")
        .insert(insertData)
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Call AI edge function
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke(
        "onboarding-ai-chat",
        {
          body: {
            projectId,
            companyId,
            message: userMessage,
            history: messages.slice(-10), // Send last 10 messages for context
          },
        }
      );

      if (aiError) throw aiError;

      const assistantContent = aiResponse?.response || "Desculpe, não consegui processar sua pergunta.";

      // Build insert data for assistant message
      const assistantInsertData: any = {
        project_id: projectId,
        role: "assistant",
        content: assistantContent,
      };
      
      if (isStaffUser) {
        assistantInsertData.staff_id = currentUserId;
      } else {
        assistantInsertData.user_id = currentUserId;
      }

      // Save assistant message to DB
      const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
        .from("onboarding_ai_chat")
        .insert(assistantInsertData)
        .select()
        .single();

      if (assistantMsgError) throw assistantMsgError;

      // Update messages with real data
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("temp-"));
        return [...filtered, savedUserMsg, savedAssistantMsg];
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Assistente IA</CardTitle>
              <p className="text-sm text-muted-foreground truncate">
                Pergunte qualquer coisa sobre {companyName || projectName}
              </p>
            </div>
          </div>

          {/* Acesso rápido ao Drive (pra não ficar escondido no topo da página) */}
          <div className="flex items-center gap-2">
            <GoogleDriveConnect
              projectId={projectId}
              documentsLink={documentsLink ?? null}
              onConnectionChange={() => {
                // A conexão muda no backend; aqui só garantimos que o botão não some
              }}
            />
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Olá! Sou o assistente IA do projeto.</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Posso ajudar você a encontrar informações sobre a empresa, acompanhar o progresso
              do onboarding, consultar documentos e muito mais.
            </p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p>Experimente perguntar:</p>
              <div className="space-y-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Qual o status atual do onboarding?")}
                >
                  Qual o status atual do onboarding?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Quais são os principais desafios da empresa?")}
                >
                  Quais são os principais desafios da empresa?
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`${
                    message.role === "user" ? "max-w-[80%]" : "max-w-[88%]"
                  } rounded-2xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border rounded-tl-sm"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className={[
                        "prose prose-sm dark:prose-invert max-w-none",
                        "prose-headings:font-semibold prose-headings:text-foreground prose-headings:tracking-tight",
                        "prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border",
                        "prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-primary",
                        "prose-p:text-foreground prose-p:leading-relaxed prose-p:my-2",
                        "prose-strong:text-foreground prose-strong:font-semibold",
                        "prose-em:text-foreground/90",
                        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-foreground prose-li:marker:text-primary",
                        "prose-blockquote:border-l-primary prose-blockquote:bg-muted/40 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-foreground/80",
                        "prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-xs",
                        "prose-table:text-xs prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-td:border-border",
                        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                        "prose-hr:border-border",
                        "overflow-x-auto",
                      ].join(" ")}
                    >
                      <ReactMarkdown
                        components={{
                          pre: ({ children }) => (
                            <pre className="whitespace-pre-wrap break-words overflow-x-auto bg-muted rounded-md p-3 text-xs">{children}</pre>
                          ),
                          code: (({ inline, className, children, ...props }: any) => (
                            <code
                              className={`${className ?? ""} ${
                                inline ? "break-words" : "whitespace-pre-wrap break-words"
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          )) as any,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p
                    className={`text-[10px] mt-2 ${
                      message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Digite sua pergunta..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sending && sendMessage()}
            disabled={sending}
          />
          <Button onClick={sendMessage} disabled={sending || !input.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

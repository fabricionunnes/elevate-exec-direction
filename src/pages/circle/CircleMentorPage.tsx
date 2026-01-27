import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  TrendingUp, 
  Target,
  Lightbulb,
  Plus,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "Como crescer meu perfil?", prompt: "Como posso crescer meu perfil no UNV Circle e aumentar meu engajamento?" },
  { icon: Target, label: "Melhorar Trust Score", prompt: "Como posso melhorar meu Trust Score na plataforma?" },
  { icon: Lightbulb, label: "Ideias de conteúdo", prompt: "Que tipos de conteúdo devo publicar para me destacar na minha área?" },
];

export default function CircleMentorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCircleCurrentProfile();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch sessions
  const { data: sessions } = useQuery({
    queryKey: ["circle-mentor-sessions", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data, error } = await supabase
        .from("circle_mentor_sessions")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!currentProfile?.id,
  });

  // Fetch messages for current session
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["circle-mentor-messages", currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return [];

      const { data, error } = await supabase
        .from("circle_mentor_messages")
        .select("*")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!currentSessionId,
  });

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Send message mutation
  const sendMessage = async (text: string) => {
    if (!currentProfile?.id || !text.trim()) return;

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const { data, error } = await supabase.functions.invoke("circle-mentor", {
        body: {
          profileId: currentProfile.id,
          sessionId: currentSessionId,
          message: text.trim(),
          sessionType: "general",
        },
      });

      if (error) throw error;

      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }

      setStreamingContent(data.response);
      
      // Refetch messages after response
      setTimeout(() => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["circle-mentor-sessions"] });
        setStreamingContent("");
      }, 500);
    } catch (err) {
      console.error("Mentor error:", err);
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isStreaming) {
      sendMessage(message);
      setMessage("");
    }
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setStreamingContent("");
  };

  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setStreamingContent("");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar - Sessions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Conversas
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewSession}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {!currentSessionId && (
                <div className="p-2 rounded-md bg-primary/10 text-sm">
                  Nova conversa
                </div>
              )}
              {sessions?.map((session) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session.id)}
                  className={cn(
                    "w-full text-left p-2 rounded-md text-sm transition-colors",
                    currentSessionId === session.id
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="font-medium truncate">
                    {session.session_type === "general" ? "Conversa" : session.session_type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(session.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-12rem)]">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <span>Mentor UNV Circle</span>
                <p className="text-xs font-normal text-muted-foreground">
                  Seu coach de crescimento pessoal na rede
                </p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {(!messages || messages.length === 0) && !streamingContent ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-8">
                  <Sparkles className="h-12 w-12 text-primary opacity-50" />
                  <div>
                    <h3 className="font-semibold mb-1">Olá! Sou seu Mentor</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Posso te ajudar a crescer no UNV Circle, melhorar seu engajamento
                      e construir sua reputação profissional.
                    </p>
                  </div>

                  {/* Quick Prompts */}
                  <div className="grid gap-2 w-full max-w-md">
                    {QUICK_PROMPTS.map((prompt, idx) => {
                      const Icon = prompt.icon;
                      return (
                        <Button
                          key={idx}
                          variant="outline"
                          className="justify-start gap-2"
                          onClick={() => sendMessage(prompt.prompt)}
                          disabled={isStreaming}
                        >
                          <Icon className="h-4 w-4" />
                          {prompt.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 max-w-[80%]",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={currentProfile?.avatar_url || undefined} />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {/* Streaming Response */}
                  {streamingContent && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{streamingContent}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Typing Indicator */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Pergunte ao mentor..."
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button type="submit" disabled={!message.trim() || isStreaming}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

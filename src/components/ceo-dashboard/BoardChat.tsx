import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  DollarSign, 
  Settings, 
  TrendingUp, 
  Heart,
  Crown,
  User,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'advisor';
  advisor_role?: string;
  advisor_name?: string;
  message: string;
  created_at: string;
}

interface BoardChatProps {
  sessionId: string;
  sessionTitle: string;
}

const ADVISOR_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  'CFO': { 
    icon: <DollarSign className="h-4 w-4" />, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100 dark:bg-green-900/30' 
  },
  'COO': { 
    icon: <Settings className="h-4 w-4" />, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30' 
  },
  'CRO': { 
    icon: <TrendingUp className="h-4 w-4" />, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100 dark:bg-orange-900/30' 
  },
  'CPO': { 
    icon: <Heart className="h-4 w-4" />, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-100 dark:bg-pink-900/30' 
  },
  'Board Chair': { 
    icon: <Crown className="h-4 w-4" />, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100 dark:bg-purple-900/30' 
  },
};

export function BoardChat({ sessionId, sessionTitle }: BoardChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionId) {
      fetchMessages();
    }
  }, [sessionId]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ceo_board_chat' as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as unknown as ChatMessage[]) || []);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      message: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await supabase.functions.invoke('ceo-board-chat', {
        body: {
          sessionId,
          message: userMessage,
          targetAdvisor: selectedAdvisor
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Refresh messages to get actual data
      await fetchMessages();
      setSelectedAdvisor(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      setInputMessage(userMessage);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAdvisorConfig = (role: string | undefined) => {
    if (!role) return null;
    return ADVISOR_CONFIG[role] || ADVISOR_CONFIG['Board Chair'];
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5 text-primary" />
          Conversar com o Board
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Faça perguntas, compartilhe andamento ou peça orientações
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Advisor Selector */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={selectedAdvisor === null ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedAdvisor(null)}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Automático
          </Button>
          {Object.entries(ADVISOR_CONFIG).map(([role, config]) => (
            <Button
              key={role}
              variant={selectedAdvisor === role ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs ${selectedAdvisor === role ? '' : config.bgColor}`}
              onClick={() => setSelectedAdvisor(role)}
            >
              <span className={selectedAdvisor === role ? '' : config.color}>
                {config.icon}
              </span>
              <span className="ml-1">{role}</span>
            </Button>
          ))}
        </div>

        {/* Chat Messages */}
        <div 
          ref={scrollRef}
          className="h-[280px] overflow-y-auto space-y-3 pr-2 scroll-smooth"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
              <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Inicie uma conversa com os conselheiros</p>
              <p className="text-xs mt-1">
                Pergunte sobre a análise, compartilhe atualizações ou peça orientações
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {messages.map((msg, index) => {
                const advisorConfig = getAdvisorConfig(msg.advisor_role);
                const isUser = msg.role === 'user';

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : advisorConfig
                          ? `${advisorConfig.bgColor} border`
                          : 'bg-muted'
                      }`}
                    >
                      {!isUser && advisorConfig && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`p-1 rounded-full ${advisorConfig.bgColor}`}>
                            <span className={advisorConfig.color}>{advisorConfig.icon}</span>
                          </div>
                          <span className="text-xs font-medium">
                            {msg.advisor_name}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {msg.advisor_role}
                          </Badge>
                        </div>
                      )}
                      {isUser && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="h-3 w-3" />
                          <span className="text-xs font-medium">Você</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.message}
                      </p>
                      <p className={`text-[10px] mt-1.5 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Conselheiros analisando...
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={
              selectedAdvisor 
                ? `Perguntar para ${selectedAdvisor}...` 
                : "Digite sua mensagem..."
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isSending || !inputMessage.trim()}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

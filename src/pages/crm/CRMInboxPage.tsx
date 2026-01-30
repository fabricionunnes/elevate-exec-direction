import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Mic,
  Image,
  Clock,
  CheckCheck,
  ChevronRight,
  MessageSquare,
  Plus,
  Settings,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCRMContext } from "./CRMLayout";
import { toast } from "sonner";
import { ServiceConfigDialog } from "@/components/crm/service-config/ServiceConfigDialog";

interface Conversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_avatar?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  status: "open" | "pending" | "closed";
  assigned_to?: string;
  lead_id?: string;
  origin?: string;
  pipeline?: string;
}

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "document";
  direction: "inbound" | "outbound";
  status: "sent" | "delivered" | "read";
  created_at: string;
  media_url?: string;
}

// Mock data for demonstration
const mockConversations: Conversation[] = [
  {
    id: "1",
    contact_name: "Rafael Cardoso",
    contact_phone: "5531999999999",
    last_message: "Rafael?",
    last_message_at: new Date().toISOString(),
    unread_count: 0,
    status: "open",
  },
  {
    id: "2",
    contact_name: "Raphael",
    contact_phone: "5531988888888",
    last_message: "Oi Raphael",
    last_message_at: new Date(Date.now() - 300000).toISOString(),
    unread_count: 0,
    status: "open",
  },
  {
    id: "3",
    contact_name: "Milton Soares",
    contact_phone: "5531977777777",
    last_message: "Diagnóstico Milton Sexta-feira...",
    last_message_at: new Date(Date.now() - 600000).toISOString(),
    unread_count: 0,
    status: "open",
  },
  {
    id: "4",
    contact_name: "Natallia Amador SDR",
    contact_phone: "5531966666666",
    last_message: "🔔 NOTIFICAÇÃO | RESPOSTA...",
    last_message_at: new Date(Date.now() - 900000).toISOString(),
    unread_count: 1,
    status: "pending",
  },
];

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Oi, equipe CHARBELL PROFESSIONAL! Passando só pra alinhar: o pagamento vencido em 2026-01-25 ainda não foi identificado.\n⚠️ Após o vencimento, há multa e juros.\nLink: https://faturas.contaazul.com/#/fatura/visualizar/7c19a300-f84f-11f0-a8ca-2bc18d296956 — me avisa se houver qualquer problema.",
    type: "text",
    direction: "outbound",
    status: "delivered",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "2",
    content: "Oi, equipe CHARBELL PROFESSIONAL! Último lembrete por aqui: o pagamento vencido em 2026-01-25 ainda está em aberto.\n⚠️ Com o atraso, o sistema aplica multa e juros.\nConsegue regularizar agora pelo link?\nhttps://faturas.contaazul.com/#/fatura/visualizar/7c19a300-f84f-11f0-a8ca-2bc18d296956",
    type: "text",
    direction: "outbound",
    status: "read",
    created_at: new Date().toISOString(),
  },
];

export const CRMInboxPage = () => {
  const { staffId, staffName, isAdmin } = useCRMContext();
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedConversation) {
      setMessages(mockMessages);
      scrollToBottom();
    }
  }, [selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      type: "text",
      direction: "outbound",
      status: "sent",
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, message]);
    setNewMessage("");
    scrollToBottom();

    // TODO: Send via Evolution API
    toast.success("Mensagem enviada!");
  };

  const filteredConversations = conversations.filter(conv => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!conv.contact_name.toLowerCase().includes(search) &&
          !conv.contact_phone.includes(search)) {
        return false;
      }
    }
    if (filterStatus !== "all" && conv.status !== filterStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="h-full flex">
      {/* Conversations List */}
      <div className="w-[300px] border-r border-border flex flex-col bg-card">
        {/* Search Header */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 shrink-0"
                onClick={() => setShowConfigDialog(true)}
                title="Configurações de atendimento"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[100px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={cn(
                "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border",
                selectedConversation?.id === conv.id && "bg-muted"
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {conv.contact_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{conv.contact_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(conv.last_message_at), "HH:mm")}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {conv.status === "pending" && (
                    <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                      <MessageSquare className="h-3 w-3 mr-0.5" />
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message}
                  </p>
                </div>
              </div>
              {conv.unread_count > 0 && (
                <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {conv.unread_count}
                </Badge>
              )}
            </button>
          ))}

          {filteredConversations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>
                  {selectedConversation.contact_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{selectedConversation.contact_name}</p>
                <p className="text-xs text-muted-foreground">
                  WhatsApp - UNV Comercial <span className="text-green-500">●</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon">
                <Clock className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Video className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-muted/30">
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.direction === "outbound" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      message.direction === "outbound"
                        ? "bg-primary/10 text-foreground"
                        : "bg-card border border-border"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(message.created_at), "HH:mm")}
                      </span>
                      {message.direction === "outbound" && (
                        <CheckCheck className={cn(
                          "h-3 w-3",
                          message.status === "read" ? "text-blue-500" : "text-muted-foreground"
                        )} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t border-border p-3 bg-card">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Image className="h-5 w-5" />
                </Button>
              </div>
              <Input
                placeholder="Mensagem"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Mic className="h-5 w-5" />
              </Button>
              <Button onClick={handleSendMessage} className="gap-2">
                Enviar <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-muted-foreground">Selecione uma conversa</p>
          </div>
        </div>
      )}

      {/* Right Sidebar - Lead Info */}
      {selectedConversation && (
        <div className="w-[320px] border-l border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase">Próximo Negócio</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Filter className="h-3 w-3" />
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {selectedConversation.contact_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{selectedConversation.contact_name}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-b border-border flex flex-wrap gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Clock className="h-4 w-4" />
            </Button>
          </div>

          {/* Deal Info */}
          <div className="p-4 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase mb-2">Negócio Selecionado</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">FC</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Funis comerciais &gt; Funil SS</p>
                <p className="font-medium">R$ 1.000,00</p>
              </div>
            </div>

            {/* Status Buttons */}
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="flex-1 border-green-500 text-green-600 hover:bg-green-50">
                Ganho ✓
              </Button>
              <Button variant="outline" size="sm" className="flex-1 border-red-500 text-red-600 hover:bg-red-50">
                Perdido
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Aberto
              </Button>
            </div>
          </div>

          {/* Expandable Sections */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2">
                <span className="font-medium text-sm">Contato</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2">
                <span className="font-medium text-sm">Negócio</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2">
                <span className="font-medium text-sm">Notas</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2">
                <span className="font-medium text-sm">Histórico</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="w-full flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Conversas</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">5</Badge>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Service Config Dialog */}
      <ServiceConfigDialog 
        open={showConfigDialog} 
        onOpenChange={setShowConfigDialog} 
      />
    </div>
  );
};

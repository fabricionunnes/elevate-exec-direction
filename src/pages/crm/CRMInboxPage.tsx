import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MessageSquare,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCRMContext } from "./CRMLayout";
import { toast } from "sonner";
import { ServiceConfigDialog } from "@/components/crm/service-config/ServiceConfigDialog";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { ConversationSidebar } from "@/components/crm/inbox/ConversationSidebar";

export const CRMInboxPage = () => {
  const { staffId, staffName, isAdmin, staffRole } = useCRMContext();
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [connectedInstances, setConnectedInstances] = useState<string[]>([]);
  const [allowedInstanceIds, setAllowedInstanceIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use real data hooks
  const { 
    conversations: allConversations, 
    loading: loadingConversations, 
    refetch: refetchConversations,
    markAsRead,
    closeConversation,
    reopenConversation,
  } = useWhatsAppConversations({
    status: filterStatus !== "all" ? filterStatus : undefined,
  });

  // Filter conversations based on user's instance access
  const conversations = allConversations.filter((conv) => {
    // Master has access to all
    if (staffRole === "master") return true;
    // If no instance_id, show to all (orphan conversations)
    if (!conv.instance_id) return true;
    // Check if user has access to this instance
    return allowedInstanceIds.includes(conv.instance_id);
  });

  const { 
    messages, 
    loading: loadingMessages, 
    sending,
    sendMessage,
    refetch: refetchMessages,
  } = useWhatsAppMessages(selectedConversation?.id || null);

  // Fetch allowed instances for this user
  useEffect(() => {
    const fetchAllowedInstances = async () => {
      if (!staffId) return;

      setLoadingAccess(true);
      try {
        // Master has access to all instances
        if (staffRole === "master") {
          const { data: allInstances } = await supabase
            .from("whatsapp_instances")
            .select("id");
          setAllowedInstanceIds((allInstances || []).map((i: any) => i.id));
        } else {
          // Get instances this user has explicit access to
          const { data: accessData } = await supabase
            .from("whatsapp_instance_access")
            .select("instance_id")
            .eq("staff_id", staffId)
            .eq("can_view", true);
          
          setAllowedInstanceIds((accessData || []).map((a: any) => a.instance_id));
        }
      } catch (error) {
        console.error("Error fetching allowed instances:", error);
      } finally {
        setLoadingAccess(false);
      }
    };
    fetchAllowedInstances();
  }, [staffId, staffRole]);

  // Fetch connected instances and project ID
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch instances
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status")
        .eq("status", "connected");
      
      if (instances) {
        setConnectedInstances(instances.map((i: any) => i.id));
      }

      // Get project ID from staff/company chain
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("company:onboarding_companies(projects:onboarding_projects(id))")
        .maybeSingle();
      
      const projects = (staff?.company as any)?.projects;
      if (projects && projects.length > 0) {
        setProjectId(projects[0].id);
      }
    };
    fetchInitialData();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConversation.instance_id) {
      if (!selectedConversation?.instance_id) {
        toast.error("Conversa sem dispositivo associado");
      }
      return;
    }

    try {
      await sendMessage(
        newMessage,
        selectedConversation.instance_id,
        selectedConversation.contact?.phone || "",
        staffId
      );
      setNewMessage("");
      toast.success("Mensagem enviada!");
    } catch (error) {
      toast.error("Erro ao enviar mensagem");
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const contactName = conv.contact?.name || "";
      const contactPhone = conv.contact?.phone || "";
      if (!contactName.toLowerCase().includes(search) && !contactPhone.includes(search)) {
        return false;
      }
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const hasConnectedDevice = connectedInstances.length > 0;

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

        {/* Connection Status */}
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasConnectedDevice ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-600">WhatsApp conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">Sem dispositivo</span>
              </>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => refetchConversations()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
          {loadingConversations || loadingAccess ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : allowedInstanceIds.length === 0 && staffRole !== "master" ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                Sem acesso a conexões
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Solicite ao administrador para vincular seu usuário a uma conexão WhatsApp
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasConnectedDevice 
                  ? "Nenhuma conversa encontrada" 
                  : "Conecte um dispositivo WhatsApp"}
              </p>
              {!hasConnectedDevice && isAdmin && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setShowConfigDialog(true)}
                  className="mt-2"
                >
                  Configurar dispositivo
                </Button>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border",
                  selectedConversation?.id === conv.id && "bg-muted"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={conv.contact?.profile_picture_url || undefined} />
                  <AvatarFallback>
                    {(conv.contact?.name || conv.contact?.phone || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {conv.contact?.name || conv.contact?.phone || "Desconhecido"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message_at 
                        ? format(new Date(conv.last_message_at), "HH:mm") 
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {conv.status === "pending" && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                        <MessageSquare className="h-3 w-3 mr-0.5" />
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_message || "Sem mensagens"}
                    </p>
                  </div>
                </div>
                {conv.unread_count > 0 && (
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                    {conv.unread_count}
                  </Badge>
                )}
              </button>
            ))
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
                <AvatarImage src={selectedConversation.contact?.profile_picture_url || undefined} />
                <AvatarFallback>
                  {(selectedConversation.contact?.name || selectedConversation.contact?.phone || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {selectedConversation.contact?.name || selectedConversation.contact?.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.contact?.phone}
                  {selectedConversation.instance_id && (
                    <span className="text-green-500 ml-2">● WhatsApp</span>
                  )}
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
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                messages.map((message) => (
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
                        {message.direction === "outbound" && getStatusIcon(message.status)}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
                disabled={sending}
              />
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Mic className="h-5 w-5" />
              </Button>
              <Button onClick={handleSendMessage} className="gap-2" disabled={sending || !newMessage.trim()}>
                {sending ? "Enviando..." : "Enviar"} <Send className="h-4 w-4" />
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

      {/* Right Sidebar - Lead Info & Actions */}
      {selectedConversation && (
        <ConversationSidebar 
          conversation={selectedConversation}
          projectId={projectId || undefined}
          onLeadCreated={() => refetchConversations()}
          onContactUpdated={() => refetchConversations()}
          onAssignmentChanged={() => refetchConversations()}
        />
      )}

      {/* Config Dialog */}
      <ServiceConfigDialog 
        open={showConfigDialog} 
        onOpenChange={setShowConfigDialog}
      />
    </div>
  );
};
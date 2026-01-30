import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Trash2,
  X,
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
import { ConversationFilters, ConversationFiltersData, defaultFilters } from "@/components/crm/inbox/ConversationFilters";
import { AudioPlayer } from "@/components/crm/inbox/AudioPlayer";

export const CRMInboxPage = () => {
  const [searchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get("conversation");
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ConversationFiltersData>(defaultFilters);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when messages change or conversation is selected
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, selectedConversation?.id]);

  // Sync selectedConversation with conversations when they update (e.g., from realtime)
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedConversation)) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations]);

  // Auto-select conversation from URL parameter
  useEffect(() => {
    if (!conversationIdFromUrl) return;
    
    // If already selected the correct conversation, skip
    if (selectedConversation?.id === conversationIdFromUrl) return;
    
    // Try to find in loaded conversations first
    const conv = conversations.find(c => c.id === conversationIdFromUrl);
    if (conv) {
      setSelectedConversation(conv);
      return;
    }
    
    // If not in list but we have conversations loaded, fetch directly
    if (conversations.length > 0 && !loadingConversations) {
      const fetchConversationById = async () => {
        try {
          const { data, error } = await supabase
            .from('crm_whatsapp_conversations')
            .select(`
              *,
              contact:crm_whatsapp_contacts(*),
              assigned_staff:onboarding_staff(id, name, avatar_url)
            `)
            .eq('id', conversationIdFromUrl)
            .single();
          
          if (data && !error) {
            setSelectedConversation(data);
          }
        } catch (err) {
          console.error('Error fetching conversation by ID:', err);
        }
      };
      fetchConversationById();
    }
  }, [conversationIdFromUrl, conversations, selectedConversation, loadingConversations]);

  // Mark as read when selecting conversation
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const scrollToBottom = () => {
    // IMPORTANT: avoid scrollIntoView() because it may scroll the whole page.
    // Instead, scroll the internal Radix ScrollArea viewport.
    setTimeout(() => {
      const root = messagesScrollAreaRef.current;
      const viewport = root?.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null;

      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        return;
      }

      // Fallback: if viewport isn't found (should be rare), try the end ref.
      // Use block: 'nearest' to reduce the chance of scrolling outer containers.
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
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

  // Delete conversation (master only)
  const handleDeleteConversation = async () => {
    if (!selectedConversation || staffRole !== "master") return;
    
    setDeletingConversation(true);
    try {
      // First delete all messages
      const { error: messagesError } = await supabase
        .from("crm_whatsapp_messages")
        .delete()
        .eq("conversation_id", selectedConversation.id);
      
      if (messagesError) throw messagesError;
      
      // Then delete the conversation
      const { error: convError } = await supabase
        .from("crm_whatsapp_conversations")
        .delete()
        .eq("id", selectedConversation.id);
      
      if (convError) throw convError;
      
      toast.success("Conversa excluída com sucesso");
      setSelectedConversation(null);
      setDeleteDialogOpen(false);
      refetchConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao excluir conversa");
    } finally {
      setDeletingConversation(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    // Text search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const contactName = conv.contact?.name || "";
      const contactPhone = conv.contact?.phone || "";
      if (!contactName.toLowerCase().includes(search) && !contactPhone.includes(search)) {
        return false;
      }
    }

    // Conversation filters
    if (filters.assignedToMe && conv.assigned_to !== staffId) return false;
    if (filters.unassigned && conv.assigned_to !== null) return false;
    if (filters.read && conv.unread_count > 0) return false;
    if (filters.unread && conv.unread_count === 0) return false;
    if (filters.status && conv.status !== filters.status) return false;
    if (filters.assignedTo && conv.assigned_to !== filters.assignedTo) return false;
    if (filters.sectorId && conv.sector_id !== filters.sectorId) return false;
    if (filters.instanceId && conv.instance_id !== filters.instanceId) return false;
    
    // Deal filters
    if (filters.hasDeal === "with" && !conv.lead_id) return false;
    if (filters.hasDeal === "without" && conv.lead_id) return false;

    // Date filter
    if (filters.createdAt) {
      const convDate = new Date(conv.created_at);
      const filterDate = new Date(filters.createdAt);
      if (convDate.toDateString() !== filterDate.toDateString()) return false;
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
    <div className="h-full min-h-0 flex overflow-hidden">
      {/* Conversations List */}
      <div className="w-[300px] min-h-0 border-r border-border flex flex-col bg-card">
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
            <Button 
              variant={showFilters ? "secondary" : "ghost"} 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1 min-h-0">
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => closeConversation(selectedConversation.id)}>
                    <X className="h-4 w-4 mr-2" />
                    Fechar conversa
                  </DropdownMenuItem>
                  {staffRole === "master" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir conversa
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea ref={messagesScrollAreaRef} className="flex-1 min-h-0 p-4 bg-muted/30">
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
                      {/* Render media content based on message type */}
                      {message.type === "image" && message.media_url ? (
                        <div className="space-y-2">
                          <img 
                            src={message.media_url} 
                            alt="Imagem" 
                            className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.media_url!, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-sm text-muted-foreground italic">
                            📷 Imagem não disponível
                          </div>
                          {message.content && message.content !== "[Imagem]" && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                      ) : message.type === "video" && message.media_url ? (
                        <div className="space-y-2">
                          <video 
                            src={message.media_url} 
                            controls 
                            className="max-w-full rounded-md"
                            onError={(e) => {
                              const target = e.target as HTMLVideoElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-sm text-muted-foreground italic">
                            🎥 Vídeo não disponível
                          </div>
                          {message.content && message.content !== "[Vídeo]" && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                      ) : message.type === "audio" && message.media_url ? (
                        <AudioPlayer src={message.media_url} />
                      ) : message.type === "document" && message.media_url ? (
                        <a 
                          href={message.media_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="h-4 w-4" />
                          {message.content || "Documento"}
                        </a>
                      ) : message.type === "sticker" ? (
                        <div className="text-2xl">🎭</div>
                      ) : message.type === "location" ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span>📍</span>
                          <span className="text-muted-foreground">Localização compartilhada</span>
                        </div>
                      ) : message.type === "contact" ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span>👤</span>
                          <span>{message.content || "Contato compartilhado"}</span>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente toda a conversa e suas mensagens. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              disabled={deletingConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingConversation ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters Panel */}
      <ConversationFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        currentStaffId={staffId}
      />
    </div>
  );
};
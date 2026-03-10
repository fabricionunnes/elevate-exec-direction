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
  Send,
  Paperclip,
  Clock,
  CheckCheck,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  Loader2,
  Headphones,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useWhatsAppConversations, WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import { AudioPlayer } from "@/components/crm/inbox/AudioPlayer";
import { MediaUploadButton } from "@/components/crm/inbox/MediaUploadButton";
import { AudioRecorder } from "@/components/crm/inbox/AudioRecorder";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompanyIdentification } from "@/hooks/useCompanyIdentification";
import { CompanyFinancialSidePanel } from "@/components/crm/inbox/CompanyFinancialSidePanel";

interface InstanceOption {
  id: string;
  name: string;
  instanceName: string;
  type: "evolution" | "official";
}

export function FinancialInboxPanel() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [financialInstanceName, setFinancialInstanceName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const {
    company: identifiedCompany,
    invoices: companyInvoices,
    loading: loadingCompany,
    loadingInvoices: loadingCompanyInvoices,
  } = useCompanyIdentification({
    phone: selectedConversation?.contact?.phone,
  });

  // Parse instance filter for the hook
  const instanceIdForHook = selectedInstanceId === "all" ? undefined
    : selectedInstanceId.startsWith("official:") ? undefined
    : selectedInstanceId;

  const {
    conversations: allConversations,
    loading: loadingConversations,
    refetch: refetchConversations,
    markAsRead,
  } = useWhatsAppConversations({
    instanceId: instanceIdForHook || undefined,
  });

  // Filter by official instance if needed
  const conversations = allConversations.filter((conv) => {
    if (selectedInstanceId === "all") return true;
    if (selectedInstanceId.startsWith("official:")) {
      const officialId = selectedInstanceId.replace("official:", "");
      return conv.official_instance_id === officialId;
    }
    return conv.instance_id === selectedInstanceId;
  });

  const {
    messages,
    loading: loadingMessages,
    sending,
    sendMessage,
    sendMedia,
    refetch: refetchMessages,
  } = useWhatsAppMessages(selectedConversation?.id || null);

  // Load staff and instances
  useEffect(() => {
    const init = async () => {
      setLoadingInstances(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staff) {
          setStaffId(staff.id);
          setIsMaster((staff as any).role === "master");
        }

        // Load all instances
        const [{ data: evolutionInstances }, { data: officialInstances }] = await Promise.all([
          supabase.from("whatsapp_instances").select("id, display_name, instance_name").order("display_name"),
          supabase.from("whatsapp_official_instances").select("id, display_name, phone_number").order("display_name"),
        ]);

        const opts: InstanceOption[] = [];
        let financialId: string | null = null;

        (evolutionInstances || []).forEach((i: any) => {
          opts.push({ id: i.id, name: i.display_name || i.instance_name, instanceName: i.instance_name || "", type: "evolution" });
          // Auto-select the financial instance
          if (i.instance_name === "financeiro-unv" || (i.display_name || "").toLowerCase().includes("financeiro")) {
            financialId = i.id;
            setFinancialInstanceName(i.display_name || i.instance_name);
          }
        });
        (officialInstances || []).forEach((i: any) => {
          opts.push({ id: `official:${i.id}`, name: i.display_name || `Oficial ${i.phone_number}`, instanceName: i.phone_number || "", type: "official" });
        });
        setInstances(opts);

        // For non-master users, lock to the financial instance
        if (financialId) {
          setSelectedInstanceId(financialId);
        }
      } catch (err) {
        console.error("Error loading instances:", err);
      } finally {
        setLoadingInstances(false);
      }
    };
    init();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, selectedConversation?.id]);

  // Mark as read
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Sync selected conversation
  useEffect(() => {
    if (selectedConversation) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedConversation)) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations]);

  const scrollToBottom = () => {
    setTimeout(() => {
      const root = messagesScrollAreaRef.current;
      const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        return;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const isOfficialAPI = !!selectedConversation.official_instance_id && !selectedConversation.instance_id;
    const isEvolutionAPI = !!selectedConversation.instance_id;

    if (!isOfficialAPI && !isEvolutionAPI) {
      toast.error("Conversa sem dispositivo associado");
      return;
    }

    const messageToSend = newMessage.trim();
    setNewMessage("");

    try {
      if (isOfficialAPI) {
        const { data, error } = await supabase.functions.invoke("whatsapp-official-api", {
          body: {
            action: "sendText",
            instanceId: selectedConversation.official_instance_id,
            phone: selectedConversation.contact?.phone || "",
            message: messageToSend,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await supabase.from("crm_whatsapp_messages").insert({
          conversation_id: selectedConversation.id,
          content: messageToSend,
          type: "text",
          direction: "outbound",
          status: "sent",
          sent_by: staffId,
          whatsapp_message_id: data?.messageId,
        });

        await supabase.from("crm_whatsapp_conversations").update({
          last_message: messageToSend.substring(0, 255),
          last_message_at: new Date().toISOString(),
        }).eq("id", selectedConversation.id);

        await refetchMessages();
        scrollToBottom();
        toast.success("Mensagem enviada!");
      } else {
        await sendMessage(
          messageToSend,
          selectedConversation.instance_id!,
          selectedConversation.contact?.phone || "",
          staffId || undefined
        );
        toast.success("Mensagem enviada!");
      }
    } catch (error: any) {
      setNewMessage(messageToSend);
      toast.error(error.message || "Erro ao enviar mensagem");
    }
  };

  const handleSendMedia = async (file: File, type: "image" | "video" | "audio" | "document") => {
    if (!selectedConversation) return;
    const isOfficialAPI = !!selectedConversation.official_instance_id && !selectedConversation.instance_id;
    if (isOfficialAPI) {
      toast.error("Envio de mídia ainda não suportado para API Oficial");
      return;
    }
    try {
      await sendMedia(file, type, selectedConversation.instance_id!, selectedConversation.contact?.phone || "", staffId || undefined);
      toast.success("Mídia enviada!");
    } catch {
      toast.error("Erro ao enviar mídia");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read": return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const name = conv.contact?.name || "";
    const phone = conv.contact?.phone || "";
    return name.toLowerCase().includes(search) || phone.includes(search);
  });

  if (loadingInstances) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
      <div className="h-full flex flex-col">
        {/* Instance Selector Header */}
        <div className="p-3 border-b bg-muted/30 flex items-center gap-3">
          <Headphones className="h-5 w-5 text-primary shrink-0" />
          <Select value={selectedInstanceId} onValueChange={(v) => { setSelectedInstanceId(v); setSelectedConversation(null); }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                      "h-4 px-1 text-[9px] shrink-0",
                      inst.type === "evolution" ? "bg-green-500/10 text-green-600 border-green-500/30" : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                    )}>
                      {inst.type === "evolution" ? "EVO" : "API"}
                    </Badge>
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm">{inst.name}</span>
                      <span className="text-[10px] text-muted-foreground">{inst.instanceName}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => refetchConversations()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Conversation List */}
          <div className={cn(
            "min-h-0 border-r border-border flex flex-col bg-card",
            isMobile ? (selectedConversation ? "hidden" : "w-full") : "w-[300px] shrink-0"
          )}>
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar contato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversation(conv);
                      if (conv.unread_count > 0) markAsRead(conv.id);
                    }}
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
                          {conv.last_message_at ? format(new Date(conv.last_message_at), "dd/MM HH:mm") : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.instance && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 bg-green-500/10 text-green-600 border-green-500/30">
                            {conv.instance.display_name || conv.instance.instance_name}
                          </Badge>
                        )}
                        {conv.official_instance && !conv.instance && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/30">
                            📱 {conv.official_instance.display_name || "API Oficial"}
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
            <div className={cn(
              "flex-1 flex flex-col min-h-0 overflow-hidden",
              isMobile && !selectedConversation && "hidden"
            )}>
              {/* Chat Header */}
              <div className="h-14 border-b flex items-center px-3 bg-card shrink-0">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 mr-2" onClick={() => setSelectedConversation(null)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={selectedConversation.contact?.profile_picture_url || undefined} />
                  <AvatarFallback>
                    {(selectedConversation.contact?.name || selectedConversation.contact?.phone || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {selectedConversation.contact?.name || selectedConversation.contact?.phone}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{selectedConversation.contact?.phone}</p>
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
                      <div key={message.id} className={cn("flex", message.direction === "outbound" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] rounded-lg p-3",
                          message.direction === "outbound" ? "bg-primary/10 text-foreground" : "bg-card border border-border"
                        )}>
                          {message.type === "image" && message.media_url ? (
                            <div className="space-y-2">
                              <img src={message.media_url} alt="Imagem" className="max-w-full rounded-md cursor-pointer hover:opacity-90" onClick={() => window.open(message.media_url!, "_blank")} />
                              {message.content && message.content !== "[Imagem]" && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                            </div>
                          ) : message.type === "video" && message.media_url ? (
                            <div className="space-y-2">
                              <video src={message.media_url} controls className="max-w-full rounded-md" />
                              {message.content && message.content !== "[Vídeo]" && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                            </div>
                          ) : message.type === "audio" && message.media_url ? (
                            <AudioPlayer src={message.media_url} />
                          ) : message.type === "document" && message.media_url ? (
                            <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                              <Paperclip className="h-4 w-4" />
                              {message.content || "Documento"}
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(message.created_at), "dd/MM/yyyy HH:mm")}
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
              <div className="border-t p-2 bg-card shrink-0">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <MediaUploadButton onUpload={handleSendMedia} disabled={sending} />
                  <Input
                    placeholder="Mensagem"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    className="flex-1"
                    disabled={sending}
                  />
                  <AudioRecorder
                    onSend={async (file) => {
                      if (!selectedConversation?.instance_id) {
                        toast.error("Conversa sem dispositivo associado");
                        return;
                      }
                      await sendMedia(file, "audio", selectedConversation.instance_id, selectedConversation.contact?.phone || "", staffId || undefined);
                      toast.success("Áudio enviado!");
                    }}
                    disabled={sending}
                  />
                  <Button onClick={handleSendMessage} size={isMobile ? "icon" : "default"} disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                    {!isMobile && <span className="ml-2">{sending ? "Enviando..." : "Enviar"}</span>}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn("flex-1 flex items-center justify-center bg-muted/30", isMobile && "hidden")}>
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">Selecione uma conversa</p>
              </div>
            </div>
          )}

          {/* Right Sidebar - Company Financial Info */}
          {selectedConversation && !isMobile && (
            <div className="w-[280px] shrink-0 border-l border-border overflow-y-auto bg-card">
              <CompanyFinancialSidePanel
                company={identifiedCompany}
                invoices={companyInvoices}
                loading={loadingCompany}
                loadingInvoices={loadingCompanyInvoices}
                contactPhone={selectedConversation?.contact?.phone}
                instanceId={selectedConversation?.instance_id}
                officialInstanceId={selectedConversation?.official_instance_id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

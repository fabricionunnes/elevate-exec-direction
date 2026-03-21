import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Instagram,
  MessageCircle,
  Send,
  Briefcase,
  ChevronLeft,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useClientCRMConversations, useClientCRMMessages, ClientConversation } from "./hooks/useClientCRMConversations";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  projectId: string;
}

export const ClientCRMInbox = ({ projectId }: Props) => {
  const { conversations, loading, refetch } = useClientCRMConversations(projectId);
  const [selectedConv, setSelectedConv] = useState<ClientConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "instagram" | "whatsapp">("all");
  const [newMessage, setNewMessage] = useState("");
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [dealForm, setDealForm] = useState({ title: "", value: "" });
  const [creatingDeal, setCreatingDeal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { messages, loading: loadingMessages } = useClientCRMMessages(
    selectedConv?.id || null,
    selectedConv?.channel || null
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = conversations.filter((c) => {
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (c.contact_name || "").toLowerCase().includes(term) ||
        (c.contact_username || "").toLowerCase().includes(term) ||
        (c.contact_phone || "").toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    // Instagram DM sending via Graph API would be done through an edge function
    // For now, just show a toast
    toast.info("Envio de mensagens pelo Instagram será implementado em breve");
    setNewMessage("");
  };

  const handleCreateDeal = async () => {
    if (!dealForm.title.trim() || !selectedConv) return;
    setCreatingDeal(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: onbUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", userData.user?.id || "")
        .eq("project_id", projectId)
        .maybeSingle();

      // Get default pipeline and first stage
      const { data: pipelines } = await supabase
        .from("client_crm_pipelines")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_default", true)
        .maybeSingle();

      if (!pipelines) throw new Error("Nenhum pipeline encontrado");

      const { data: stages } = await supabase
        .from("client_crm_stages")
        .select("id")
        .eq("pipeline_id", pipelines.id)
        .eq("is_final", false)
        .order("sort_order")
        .limit(1);

      const firstStage = stages?.[0];

      // Try to find or create a contact
      let contactId: string | null = null;
      const contactName = selectedConv.contact_name || selectedConv.contact_username || "Contato Instagram";

      const { data: existingContact } = await supabase
        .from("client_crm_contacts")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", contactName)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact } = await supabase
          .from("client_crm_contacts")
          .insert({
            project_id: projectId,
            name: contactName,
            notes: `Canal: ${selectedConv.channel === "instagram" ? "Instagram" : "WhatsApp"}${selectedConv.contact_username ? ` | @${selectedConv.contact_username}` : ""}`,
            created_by: onbUser?.id || null,
          })
          .select("id")
          .single();
        contactId = newContact?.id || null;
      }

      const { error } = await supabase.from("client_crm_deals").insert({
        project_id: projectId,
        pipeline_id: pipelines.id,
        stage_id: firstStage?.id || null,
        contact_id: contactId,
        title: dealForm.title,
        value: parseFloat(dealForm.value) || 0,
        notes: `Criado a partir de conversa ${selectedConv.channel === "instagram" ? "Instagram" : "WhatsApp"} com ${contactName}`,
        probability: 50,
        created_by: onbUser?.id || null,
        owner_id: onbUser?.id || null,
      });

      if (error) throw error;
      toast.success("Negócio criado com sucesso!");
      setShowDealDialog(false);
      setDealForm({ title: "", value: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar negócio");
    } finally {
      setCreatingDeal(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    if (channel === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
    return <MessageCircle className="h-3.5 w-3.5 text-green-500" />;
  };

  const getChannelColor = (channel: string) => {
    if (channel === "instagram") return "bg-pink-100 text-pink-700";
    return "bg-green-100 text-green-700";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Nenhuma conversa encontrada</p>
          <p className="text-sm mt-1">
            Conecte o WhatsApp ou Instagram na aba correspondente para começar a receber conversas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Mobile: show either list or chat
  const showConversationList = !isMobile || !selectedConv;
  const showChat = !isMobile || !!selectedConv;

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar */}
      {showConversationList && (
        <div className={cn("flex flex-col border-r", isMobile ? "w-full" : "w-80 min-w-[320px]")}>
          {/* Search + Filter */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "instagram", "whatsapp"] as const).map((f) => (
                <Button
                  key={f}
                  variant={channelFilter === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setChannelFilter(f)}
                >
                  {f === "all" ? "Todos" : f === "instagram" ? "Instagram" : "WhatsApp"}
                </Button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <ScrollArea className="flex-1">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b transition-colors",
                  selectedConv?.id === conv.id && "bg-muted"
                )}
                onClick={() => setSelectedConv(conv)}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conv.contact_picture || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {(conv.contact_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5">
                    {getChannelIcon(conv.channel)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {conv.contact_name || conv.contact_username || "Desconhecido"}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {format(new Date(conv.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_message || "Sem mensagens"}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge className="h-5 min-w-[20px] text-[10px] bg-primary">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Chat area */}
      {showChat && (
        <div className="flex-1 flex flex-col">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 p-3 border-b bg-background">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedConv(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedConv.contact_picture || undefined} />
                  <AvatarFallback className="text-xs">
                    {(selectedConv.contact_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">
                    {selectedConv.contact_name || selectedConv.contact_username}
                  </span>
                  <Badge variant="outline" className={cn("text-[10px] h-4", getChannelColor(selectedConv.channel))}>
                    {selectedConv.channel === "instagram" ? "Instagram" : "WhatsApp"}
                  </Badge>
                </div>

                {/* Create Deal button */}
                <Dialog open={showDealDialog} onOpenChange={setShowDealDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Criar Negócio</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Negócio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                        {getChannelIcon(selectedConv.channel)}
                        <span className="text-sm">
                          {selectedConv.contact_name || selectedConv.contact_username}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label>Título do Negócio *</Label>
                        <Input
                          placeholder="Ex: Proposta para cliente"
                          value={dealForm.title}
                          onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number"
                          placeholder="0,00"
                          value={dealForm.value}
                          onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
                        />
                      </div>
                      <Button
                        onClick={handleCreateDeal}
                        disabled={creatingDeal || !dealForm.title.trim()}
                        className="w-full"
                      >
                        {creatingDeal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Briefcase className="h-4 w-4 mr-2" />}
                        Criar Negócio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nenhuma mensagem encontrada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOutgoing = msg.direction === "outgoing" || msg.direction === "sent";
                      return (
                        <div
                          key={msg.id}
                          className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                              isOutgoing
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            {msg.is_reaction && msg.reaction_emoji ? (
                              <span className="text-2xl">{msg.reaction_emoji}</span>
                            ) : (
                              <>
                                {msg.media_url && (
                                  <div className="mb-1">
                                    {msg.message_type === "image" || msg.message_type === "photo" ? (
                                      <img
                                        src={msg.media_url}
                                        alt="Mídia"
                                        className="rounded-lg max-w-full max-h-48 object-cover"
                                      />
                                    ) : msg.message_type === "video" ? (
                                      <video src={msg.media_url} controls className="rounded-lg max-w-full max-h-48" />
                                    ) : (
                                      <a href={msg.media_url} target="_blank" rel="noopener" className="text-xs underline flex items-center gap-1">
                                        <ImageIcon className="h-3 w-3" /> Anexo
                                      </a>
                                    )}
                                  </div>
                                )}
                                {msg.story_url && (
                                  <p className="text-xs italic text-muted-foreground mb-1">
                                    Respondeu ao story
                                  </p>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                              </>
                            )}
                            <p className={cn(
                              "text-[10px] mt-1",
                              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa para visualizar</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

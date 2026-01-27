import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, MessageCircle, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  last_message_at: string;
  other_profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    sender_profile_id: string;
  };
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  sender_profile_id: string;
  created_at: string;
  is_read: boolean;
}

export default function CircleMessagesPage() {
  const queryClient = useQueryClient();
  const { data: currentProfile } = useCircleCurrentProfile();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ["circle-conversations", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data: participations, error } = await supabase
        .from("circle_conversation_participants")
        .select(`
          conversation_id,
          conversation:circle_conversations(
            id,
            last_message_at
          )
        `)
        .eq("profile_id", currentProfile.id);

      if (error) throw error;

      // Get other participants and last messages
      const conversationsWithDetails = await Promise.all(
        participations.map(async (p: any) => {
          // Get other participant
          const { data: otherParticipant } = await supabase
            .from("circle_conversation_participants")
            .select(`
              profile:circle_profiles(id, display_name, avatar_url)
            `)
            .eq("conversation_id", p.conversation_id)
            .neq("profile_id", currentProfile.id)
            .single();

          // Get last message
          const { data: lastMessage } = await supabase
            .from("circle_messages")
            .select("content, sender_profile_id")
            .eq("conversation_id", p.conversation_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("circle_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", p.conversation_id)
            .eq("is_read", false)
            .neq("sender_profile_id", currentProfile.id);

          return {
            id: p.conversation_id,
            last_message_at: p.conversation.last_message_at,
            other_profile: otherParticipant?.profile,
            last_message: lastMessage,
            unread_count: count || 0,
          };
        })
      );

      return conversationsWithDetails
        .filter((c) => c.other_profile)
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()) as Conversation[];
    },
    enabled: !!currentProfile?.id,
  });

  // Fetch messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ["circle-messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const { data, error } = await supabase
        .from("circle_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Mark messages as read when viewing
  useEffect(() => {
    if (selectedConversation && currentProfile?.id && messages) {
      const unreadMessages = messages.filter(
        (m) => !m.is_read && m.sender_profile_id !== currentProfile.id
      );
      
      if (unreadMessages.length > 0) {
        supabase
          .from("circle_messages")
          .update({ is_read: true })
          .eq("conversation_id", selectedConversation)
          .neq("sender_profile_id", currentProfile.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
          });
      }
    }
  }, [selectedConversation, messages, currentProfile?.id, queryClient]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages-${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_messages",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["circle-messages", selectedConversation] });
          queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!currentProfile?.id || !selectedConversation) throw new Error("Missing data");

      const { error } = await supabase.from("circle_messages").insert({
        conversation_id: selectedConversation,
        sender_profile_id: currentProfile.id,
        content: newMessage,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["circle-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate();
  };

  const selectedConversationData = conversations?.find((c) => c.id === selectedConversation);

  const filteredConversations = conversations?.filter((c) =>
    c.other_profile.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] flex bg-background rounded-lg border overflow-hidden">
      {/* Conversations List */}
      <div
        className={cn(
          "w-full md:w-80 border-r flex flex-col",
          selectedConversation && "hidden md:flex"
        )}
      >
        <div className="p-3 sm:p-4 border-b">
          <h2 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredConversations?.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma conversa ainda</p>
              <p className="text-xs">Inicie uma conversa pelo perfil de alguém</p>
            </div>
          ) : (
            filteredConversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={cn(
                  "w-full p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 hover:bg-muted/50 transition-colors text-left",
                  selectedConversation === conv.id && "bg-muted"
                )}
              >
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                  <AvatarImage src={conv.other_profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs sm:text-sm">
                    {conv.other_profile.display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate text-sm">
                      {conv.other_profile.display_name}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ml-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.last_message && (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {conv.last_message.sender_profile_id === currentProfile?.id && "Você: "}
                      {conv.last_message.content}
                    </p>
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !selectedConversation && "hidden md:flex"
        )}
      >
        {selectedConversation && selectedConversationData ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b flex items-center gap-2.5 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 flex-shrink-0"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={selectedConversationData.other_profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs sm:text-sm">
                  {selectedConversationData.other_profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{selectedConversationData.other_profile.display_name}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3 sm:p-4">
              <div className="space-y-2 sm:space-y-3">
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender_profile_id === currentProfile?.id ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-2xl",
                        msg.sender_profile_id === currentProfile?.id
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={cn(
                          "text-[10px] sm:text-xs mt-1",
                          msg.sender_profile_id === currentProfile?.id
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 sm:p-4 border-t flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 text-sm"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim()} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-base sm:text-lg">Selecione uma conversa</p>
              <p className="text-xs sm:text-sm">ou inicie uma nova pelo perfil de alguém</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { X, Send, MessageCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingChat {
  conversationId: string;
  otherProfile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  isMinimized: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_profile_id: string;
  created_at: string;
}

export function FloatingChatBubble() {
  const { data: currentProfile } = useCircleCurrentProfile();
  const queryClient = useQueryClient();
  const [openChats, setOpenChats] = useState<FloatingChat[]>([]);
  const [newMessage, setNewMessage] = useState<Record<string, string>>({});

  // Listen for new messages
  useEffect(() => {
    if (!currentProfile?.id) return;

    const channel = supabase
      .channel("floating-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_messages",
        },
        async (payload) => {
          const message = payload.new as any;
          
          // Skip if message is from current user
          if (message.sender_profile_id === currentProfile.id) return;

          // Get conversation participants to find the other user
          const { data: participants } = await supabase
            .from("circle_conversation_participants")
            .select(`
              profile:circle_profiles(id, display_name, avatar_url)
            `)
            .eq("conversation_id", message.conversation_id)
            .neq("profile_id", currentProfile.id)
            .single();

          if (!participants?.profile) return;

          // Check if we're part of this conversation
          const { data: myParticipation } = await supabase
            .from("circle_conversation_participants")
            .select("id")
            .eq("conversation_id", message.conversation_id)
            .eq("profile_id", currentProfile.id)
            .maybeSingle();

          if (!myParticipation) return;

          // Check if chat is already open
          const existingChat = openChats.find(c => c.conversationId === message.conversation_id);
          
          if (!existingChat) {
            // Open new chat bubble
            setOpenChats(prev => [
              ...prev.slice(-2), // Keep max 3 chats
              {
                conversationId: message.conversation_id,
                otherProfile: participants.profile as any,
                isMinimized: false,
              }
            ]);
          } else if (existingChat.isMinimized) {
            // Expand minimized chat
            setOpenChats(prev => prev.map(c => 
              c.conversationId === message.conversation_id 
                ? { ...c, isMinimized: false }
                : c
            ));
          }

          // Refresh messages for this conversation
          queryClient.invalidateQueries({ queryKey: ["floating-chat-messages", message.conversation_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProfile?.id, openChats, queryClient]);

  const closeChat = (conversationId: string) => {
    setOpenChats(prev => prev.filter(c => c.conversationId !== conversationId));
  };

  const toggleMinimize = (conversationId: string) => {
    setOpenChats(prev => prev.map(c => 
      c.conversationId === conversationId 
        ? { ...c, isMinimized: !c.isMinimized }
        : c
    ));
  };

  if (!currentProfile?.id || openChats.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-row-reverse gap-2">
      <AnimatePresence>
        {openChats.map((chat, index) => (
          <ChatWindow
            key={chat.conversationId}
            chat={chat}
            currentProfileId={currentProfile.id}
            message={newMessage[chat.conversationId] || ""}
            onMessageChange={(value) => setNewMessage(prev => ({ ...prev, [chat.conversationId]: value }))}
            onClose={() => closeChat(chat.conversationId)}
            onToggleMinimize={() => toggleMinimize(chat.conversationId)}
            onMessageSent={() => setNewMessage(prev => ({ ...prev, [chat.conversationId]: "" }))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ChatWindowProps {
  chat: FloatingChat;
  currentProfileId: string;
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onMessageSent: () => void;
}

function ChatWindow({ 
  chat, 
  currentProfileId, 
  message, 
  onMessageChange, 
  onClose, 
  onToggleMinimize,
  onMessageSent 
}: ChatWindowProps) {
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ["floating-chat-messages", chat.conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_messages")
        .select("*")
        .eq("conversation_id", chat.conversationId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data as Message[];
    },
    refetchInterval: 10000,
  });

  // Mark messages as read
  useEffect(() => {
    if (!chat.isMinimized && messages?.length) {
      supabase
        .from("circle_messages")
        .update({ is_read: true })
        .eq("conversation_id", chat.conversationId)
        .neq("sender_profile_id", currentProfileId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["circle-conversations"] });
        });
    }
  }, [chat.conversationId, chat.isMinimized, messages, currentProfileId, queryClient]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await supabase.from("circle_messages").insert({
      conversation_id: chat.conversationId,
      sender_profile_id: currentProfileId,
      content: message.trim(),
    });

    onMessageSent();
    queryClient.invalidateQueries({ queryKey: ["floating-chat-messages", chat.conversationId] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (chat.isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="cursor-pointer"
        onClick={onToggleMinimize}
      >
        <div className="relative">
          <Avatar className="h-12 w-12 ring-2 ring-primary ring-offset-2 ring-offset-background">
            <AvatarImage src={chat.otherProfile.avatar_url || undefined} />
            <AvatarFallback>{chat.otherProfile.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
            <MessageCircle className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="w-80 bg-background border rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={chat.otherProfile.avatar_url || undefined} />
            <AvatarFallback>{chat.otherProfile.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm truncate max-w-[120px]">
            {chat.otherProfile.display_name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleMinimize}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-64 p-3">
        <div className="space-y-2">
          {messages?.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.sender_profile_id === currentProfileId ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                  msg.sender_profile_id === currentProfileId
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <p>{msg.content}</p>
                <p
                  className={cn(
                    "text-[10px] mt-0.5",
                    msg.sender_profile_id === currentProfileId
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t flex gap-2">
        <Input
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aa"
          className="flex-1 h-8 text-sm"
        />
        <Button size="icon" className="h-8 w-8" onClick={sendMessage} disabled={!message.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

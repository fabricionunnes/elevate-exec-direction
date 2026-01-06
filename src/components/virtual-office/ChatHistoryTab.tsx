import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  Search, 
  MessageSquare,
  Users,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface Message {
  id: string;
  room_id: string;
  staff_id: string;
  recipient_staff_id: string | null;
  content: string;
  message_type: string;
  created_at: string;
}

interface Conversation {
  id: string;
  type: "dm" | "room";
  name: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  messageCount: number;
}

interface ChatHistoryTabProps {
  staffMembers: StaffMember[];
  rooms: Room[];
}

const ChatHistoryTab = ({ staffMembers, rooms }: ChatHistoryTabProps) => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    fetchAllMessages();
  }, []);

  const fetchAllMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("virtual_office_messages")
        .select("id, room_id, staff_id, recipient_staff_id, content, message_type, created_at")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStaffName = (staffId: string) => {
    const staff = staffMembers.find((s) => s.id === staffId);
    return staff?.name || "Usuário";
  };

  const getStaffRole = (staffId: string) => {
    const staff = staffMembers.find((s) => s.id === staffId);
    return staff?.role || "";
  };

  const getRoomName = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    return room?.name || "Sala removida";
  };

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-500/10 text-purple-500";
      case "cs": return "bg-blue-500/10 text-blue-500";
      case "consultant": return "bg-green-500/10 text-green-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Group messages into conversations
  const conversations = useMemo(() => {
    const convMap = new Map<string, Conversation>();

    messages.forEach((msg) => {
      let convId: string;
      let convName: string;
      let convType: "dm" | "room";
      let participants: string[];

      if (msg.recipient_staff_id) {
        // DM conversation - create consistent ID regardless of sender/receiver order
        const ids = [msg.staff_id, msg.recipient_staff_id].sort();
        convId = `dm-${ids[0]}-${ids[1]}`;
        const name1 = getStaffName(ids[0]);
        const name2 = getStaffName(ids[1]);
        convName = `${name1} x ${name2}`;
        convType = "dm";
        participants = ids;
      } else {
        // Room conversation
        convId = `room-${msg.room_id}`;
        convName = getRoomName(msg.room_id);
        convType = "room";
        participants = [msg.staff_id];
      }

      const existing = convMap.get(convId);
      if (!existing) {
        convMap.set(convId, {
          id: convId,
          type: convType,
          name: convName,
          participants,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          messageCount: 1,
        });
      } else {
        existing.messageCount++;
        // Add participant if not already there (for rooms)
        if (!existing.participants.includes(msg.staff_id)) {
          existing.participants.push(msg.staff_id);
        }
      }
    });

    // Convert to array and sort by last message time
    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );
  }, [messages, staffMembers, rooms]);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.name.toLowerCase().includes(query) ||
        messages.some(
          (msg) =>
            getConversationId(msg) === conv.id &&
            msg.content.toLowerCase().includes(query)
        )
    );
  }, [conversations, searchQuery, messages]);

  // Get conversation ID for a message
  const getConversationId = (msg: Message): string => {
    if (msg.recipient_staff_id) {
      const ids = [msg.staff_id, msg.recipient_staff_id].sort();
      return `dm-${ids[0]}-${ids[1]}`;
    }
    return `room-${msg.room_id}`;
  };

  // Get messages for selected conversation
  const conversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return messages
      .filter((msg) => getConversationId(msg) === selectedConversation.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [selectedConversation, messages]);

  // Group conversation messages by date
  const groupedMessages = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    conversationMessages.forEach((msg) => {
      const dateKey = format(parseISO(msg.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  }, [conversationMessages]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Conversation detail view
  if (selectedConversation) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-3 bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {selectedConversation.type === "dm" ? (
                <div className="flex -space-x-2">
                  {selectedConversation.participants.slice(0, 2).map((pId) => (
                    <Avatar key={pId} className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className={cn("text-xs", getRoleColor(getStaffRole(pId)))}>
                        {getStaffInitials(getStaffName(pId))}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              )}
              <div>
                <h2 className="font-semibold">{selectedConversation.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.messageCount} mensagens
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2 capitalize">
                    {getDateLabel(dayMessages[0].created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  {dayMessages.map((msg) => {
                    const staffName = getStaffName(msg.staff_id);
                    const staffRole = getStaffRole(msg.staff_id);

                    return (
                      <div key={msg.id} className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={cn("text-xs", getRoleColor(staffRole))}>
                            {getStaffInitials(staffName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{staffName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(parseISO(msg.created_at), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words bg-muted/30 rounded-lg p-2">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Conversations list view
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b p-3 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Histórico de Conversas</h2>
          <Badge variant="outline" className="text-xs">{conversations.length} conversas</Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas ou mensagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
            {searchQuery && (
              <Button variant="link" onClick={() => setSearchQuery("")}>
                Limpar busca
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => setSelectedConversation(conv)}
              >
                {conv.type === "dm" ? (
                  <div className="flex -space-x-2 shrink-0">
                    {conv.participants.slice(0, 2).map((pId) => (
                      <Avatar key={pId} className="h-10 w-10 border-2 border-background">
                        <AvatarFallback className={cn("text-xs", getRoleColor(getStaffRole(pId)))}>
                          {getStaffInitials(getStaffName(pId))}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{conv.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {getDateLabel(conv.lastMessageTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conv.lastMessage}
                    </p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {conv.messageCount} msg
                    </Badge>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatHistoryTab;

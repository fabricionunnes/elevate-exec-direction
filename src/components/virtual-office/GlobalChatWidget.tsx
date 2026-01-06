import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { 
  MessageCircle, 
  X, 
  Send, 
  Users, 
  User, 
  ArrowLeft,
  Circle,
  Check,
  CheckCheck
} from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageRead {
  message_id: string;
  staff_id: string;
  read_at: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
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

interface Room {
  id: string;
  name: string;
}

interface Presence {
  staff_id: string;
  status: string;
}

interface Conversation {
  type: "room" | "dm";
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  recipientId?: string;
}

const GlobalChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageReads, setMessageReads] = useState<MessageRead[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"conversations" | "people">("conversations");
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversationRef = useRef<Conversation | null>(null);
  const isOpenRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    let unsubscribeGlobal: (() => void) | null = null;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id, name, email, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (!staffData) return;

        setCurrentStaff(staffData);

        // Fetch all data
        const [staffRes, roomsRes, presenceRes] = await Promise.all([
          supabase.from("onboarding_staff").select("id, name, email, role").eq("is_active", true),
          supabase.from("virtual_office_rooms").select("id, name").eq("is_active", true),
          supabase.from("virtual_office_presence").select("staff_id, status"),
        ]);

        setStaffMembers(staffRes.data || []);
        setRooms(roomsRes.data || []);
        setPresences(presenceRes.data || []);

        // Build conversations list
        await buildConversations(staffData.id, roomsRes.data || [], staffRes.data || []);

        // Subscribe to presence
        subscribeToPresence();
        
        // Subscribe to new messages globally - store cleanup
        unsubscribeGlobal = subscribeToGlobalMessages(staffData.id);

      } catch (error) {
        console.error("Error initializing chat:", error);
      }
    };

    init();

    return () => {
      if (unsubscribeGlobal) {
        unsubscribeGlobal();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeReads: (() => void) | undefined;

    if (activeConversation) {
      fetchMessages();
      unsubscribeMessages = subscribeToMessages();
      unsubscribeReads = subscribeToMessageReads();
    } else {
      setMessages([]);
      setMessageReads([]);
    }

    return () => {
      unsubscribeMessages?.();
      unsubscribeReads?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id]);

  useEffect(() => {
    // Calculate total unread
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    setTotalUnread(total);
  }, [conversations]);

  // initializeChat moved to useEffect above

  const buildConversations = async (staffId: string, roomsList: Room[], staffList: StaffMember[]) => {
    const convs: Conversation[] = [];

    // Add rooms
    for (const room of roomsList) {
      const { data: lastMsg } = await supabase
        .from("virtual_office_messages")
        .select("content, created_at")
        .eq("room_id", room.id)
        .is("recipient_staff_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      convs.push({
        type: "room",
        id: room.id,
        name: room.name,
        lastMessage: lastMsg?.content,
        lastMessageTime: lastMsg?.created_at,
        unreadCount: 0,
      });
    }

    // Find DM conversations
    const { data: dmMessages } = await supabase
      .from("virtual_office_messages")
      .select("staff_id, recipient_staff_id, content, created_at")
      .not("recipient_staff_id", "is", null)
      .or(`staff_id.eq.${staffId},recipient_staff_id.eq.${staffId}`)
      .order("created_at", { ascending: false });

    if (dmMessages) {
      const dmPartners = new Set<string>();
      const lastDmMessages: Record<string, { content: string; created_at: string }> = {};

      dmMessages.forEach((msg) => {
        const partnerId = msg.staff_id === staffId ? msg.recipient_staff_id : msg.staff_id;
        if (partnerId && !dmPartners.has(partnerId)) {
          dmPartners.add(partnerId);
          lastDmMessages[partnerId] = { content: msg.content, created_at: msg.created_at };
        }
      });

      dmPartners.forEach((partnerId) => {
        const partner = staffList.find((s) => s.id === partnerId);
        if (partner) {
          const lastMsg = lastDmMessages[partnerId];
          convs.push({
            type: "dm",
            id: `dm-${partnerId}`,
            name: partner.name,
            recipientId: partnerId,
            lastMessage: lastMsg?.content,
            lastMessageTime: lastMsg?.created_at,
            unreadCount: 0,
          });
        }
      });
    }

    // Sort by last message time
    convs.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    setConversations(convs);
  };

  const subscribeToPresence = () => {
    const channel = supabase
      .channel("global-chat-presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "virtual_office_presence" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setPresences((prev) => {
              const filtered = prev.filter((p) => p.staff_id !== (payload.new as Presence).staff_id);
              return [...filtered, payload.new as Presence];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToGlobalMessages = (staffId: string) => {
    const channel = supabase
      .channel("global-chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "virtual_office_messages" },
        (payload) => {
          const newMsg = payload.new as Message;

          const isDMToMe = newMsg.recipient_staff_id === staffId;
          const isRoomMessage = newMsg.recipient_staff_id === null;
          const isFromMe = newMsg.staff_id === staffId;

          if (!isDMToMe && !isRoomMessage) return;
          if (isFromMe) return;

          const isConversationOpen = checkIfConversationIsOpen(newMsg, staffId);

          // Debug leve (ajuda a confirmar que o realtime está chegando)
          console.log("[chat] new message", {
            isDMToMe,
            isRoomMessage,
            isConversationOpen,
            from: newMsg.staff_id,
            to: newMsg.recipient_staff_id,
            room: newMsg.room_id,
          });

          if (!isConversationOpen) {
            // Only update badge count, no sound or toast
            updateUnreadCount(newMsg, staffId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const checkIfConversationIsOpen = (msg: Message, currentStaffId: string): boolean => {
    const conv = activeConversationRef.current;
    if (!conv || !isOpenRef.current) return false;

    if (!msg.recipient_staff_id && conv.type === "room" && conv.id === msg.room_id) {
      return true;
    }

    if (
      msg.recipient_staff_id === currentStaffId &&
      conv.type === "dm" &&
      conv.recipientId === msg.staff_id
    ) {
      return true;
    }

    return false;
  };

  const updateUnreadCount = (msg: Message, currentStaffId: string) => {
    setConversations((prev) => {
      // Check if conversation already exists
      let found = false;
      const updated = prev.map((conv) => {
        if (conv.type === "room" && conv.id === msg.room_id && !msg.recipient_staff_id) {
          found = true;
          return { 
            ...conv, 
            unreadCount: conv.unreadCount + 1,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at
          };
        }
        if (conv.type === "dm" && conv.recipientId === msg.staff_id) {
          found = true;
          return { 
            ...conv, 
            unreadCount: conv.unreadCount + 1,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at
          };
        }
        return conv;
      });

      // If DM from someone not in conversations list, add them
      if (!found && msg.recipient_staff_id === currentStaffId) {
        const sender = staffMembers.find(s => s.id === msg.staff_id);
        if (sender) {
          const newConv: Conversation = {
            type: "dm",
            id: `dm-${sender.id}`,
            name: sender.name,
            recipientId: sender.id,
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
            unreadCount: 1,
          };
          return [newConv, ...updated];
        }
      }

      return updated;
    });
  };

  const fetchMessages = async () => {
    if (!activeConversation || !currentStaff) return;
    setLoading(true);

    try {
      let query = supabase
        .from("virtual_office_messages")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(50);

      if (activeConversation.type === "room") {
        query = query.eq("room_id", activeConversation.id).is("recipient_staff_id", null);
      } else {
        // DM conversation
        const partnerId = activeConversation.recipientId!;
        query = query.or(
          `and(staff_id.eq.${currentStaff.id},recipient_staff_id.eq.${partnerId}),and(staff_id.eq.${partnerId},recipient_staff_id.eq.${currentStaff.id})`
        );
      }

      const { data } = await query;
      setMessages(data || []);

      // Fetch message reads for these messages
      if (data && data.length > 0) {
        const messageIds = data.map(m => m.id);
        const { data: reads } = await supabase
          .from("virtual_office_message_reads")
          .select("message_id, staff_id, read_at")
          .in("message_id", messageIds);
        
        setMessageReads(reads || []);

        // Mark messages from others as read
        const myUnreadMessages = data.filter(
          msg => msg.staff_id !== currentStaff.id
        );
        
        for (const msg of myUnreadMessages) {
          const alreadyRead = reads?.some(
            r => r.message_id === msg.id && r.staff_id === currentStaff.id
          );
          if (!alreadyRead) {
            await supabase.from("virtual_office_message_reads").insert({
              message_id: msg.id,
              staff_id: currentStaff.id,
            });
          }
        }
      }

      // Clear unread
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessageReads = () => {
    if (!activeConversation || !currentStaff) return;

    const channel = supabase
      .channel(`reads-${activeConversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "virtual_office_message_reads" },
        (payload) => {
          const newRead = payload.new as MessageRead;
          setMessageReads((prev) => [...prev, newRead]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const isMessageRead = (messageId: string, senderId: string): boolean => {
    // Check if anyone other than sender has read the message
    return messageReads.some(
      read => read.message_id === messageId && read.staff_id !== senderId
    );
  };

  const subscribeToMessages = () => {
    if (!activeConversation || !currentStaff) return;

    const channel = supabase
      .channel(`chat-${activeConversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "virtual_office_messages" },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          // Check if message belongs to current conversation
          let belongs = false;
          if (activeConversation.type === "room") {
            belongs = newMsg.room_id === activeConversation.id && !newMsg.recipient_staff_id;
          } else {
            const partnerId = activeConversation.recipientId!;
            belongs = 
              (newMsg.staff_id === currentStaff.id && newMsg.recipient_staff_id === partnerId) ||
              (newMsg.staff_id === partnerId && newMsg.recipient_staff_id === currentStaff.id);
          }

          if (belongs) {
            setMessages((prev) => [...prev, newMsg]);
            
            // Mark as read if from someone else
            if (newMsg.staff_id !== currentStaff.id) {
              await supabase.from("virtual_office_message_reads").insert({
                message_id: newMsg.id,
                staff_id: currentStaff.id,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !currentStaff) return;

    try {
      const insertData: any = {
        staff_id: currentStaff.id,
        content: newMessage.trim(),
        message_type: "text",
      };

      let recipientId: string | null = null;

      if (activeConversation.type === "room") {
        insertData.room_id = activeConversation.id;
      } else {
        recipientId = activeConversation.recipientId || null;
        if (!recipientId) {
          console.error("DM sem recipientId - não enviando.", activeConversation);
          return;
        }

        // Para DM, ainda precisamos de um room_id por constraint. Usamos a primeira sala ativa como container.
        const fallbackRoomId = rooms[0]?.id;
        if (!fallbackRoomId) {
          console.error("Nenhuma sala disponível para enviar DM (room_id obrigatório).", rooms);
          return;
        }

        insertData.room_id = fallbackRoomId;
        insertData.recipient_staff_id = recipientId;
      }

      const { data: insertedMessage, error } = await supabase
        .from("virtual_office_messages")
        .insert(insertData)
        .select("id")
        .single();

      if (error) throw error;

      // Create notifications for recipients
      if (insertedMessage) {
        await createChatNotifications(
          insertedMessage.id,
          currentStaff.id,
          activeConversation.type === "room" ? activeConversation.id : null,
          recipientId,
          activeConversation.type === "dm"
        );
      }

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Function to create chat notifications for message recipients
  const createChatNotifications = async (
    messageId: string,
    senderId: string,
    roomId: string | null,
    recipientId: string | null,
    isDm: boolean
  ) => {
    try {
      if (isDm && recipientId) {
        // DM: notify only the recipient
        await supabase.from("virtual_office_chat_notifications").insert({
          recipient_staff_id: recipientId,
          sender_staff_id: senderId,
          message_id: messageId,
          room_id: roomId,
          is_dm: true,
        });
      } else if (roomId) {
        // Room message: notify all staff members except sender
        const otherStaff = staffMembers.filter(s => s.id !== senderId);
        
        if (otherStaff.length > 0) {
          const notifications = otherStaff.map(staff => ({
            recipient_staff_id: staff.id,
            sender_staff_id: senderId,
            message_id: messageId,
            room_id: roomId,
            is_dm: false,
          }));

          await supabase.from("virtual_office_chat_notifications").insert(notifications);
        }
      }
    } catch (error) {
      console.error("Error creating chat notifications:", error);
    }
  };

  const startDMConversation = (staff: StaffMember) => {
    // Check if conversation exists
    const existing = conversations.find(
      (c) => c.type === "dm" && c.recipientId === staff.id
    );

    if (existing) {
      setActiveConversation(existing);
    } else {
      const newConv: Conversation = {
        type: "dm",
        id: `dm-${staff.id}`,
        name: staff.name,
        recipientId: staff.id,
        unreadCount: 0,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversation(newConv);
    }
    setActiveTab("conversations");
  };

  const getStaffName = (staffId: string) => {
    const staff = staffMembers.find((s) => s.id === staffId);
    return staff?.name || "Usuário";
  };

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getPresenceStatus = (staffId: string) => {
    return presences.find((p) => p.staff_id === staffId)?.status || "offline";
  };

  const formatMessageTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return format(date, "HH:mm", { locale: ptBR });
    if (isYesterday(date)) return "Ontem " + format(date, "HH:mm", { locale: ptBR });
    return format(date, "dd/MM HH:mm", { locale: ptBR });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-500";
      case "cs": return "bg-blue-500";
      case "consultant": return "bg-green-500";
      default: return "bg-muted";
    }
  };

  if (!currentStaff) return null;

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          totalUnread > 0 && "animate-pulse"
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs animate-bounce"
            variant="destructive"
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </Badge>
        )}
      </Button>

      {/* Chat panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          {!activeConversation ? (
            <>
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Chat
                </SheetTitle>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: "calc(100% - 32px)" }}>
                  <TabsTrigger value="conversations" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Conversas
                  </TabsTrigger>
                  <TabsTrigger value="people" className="gap-2">
                    <Users className="h-4 w-4" />
                    Pessoas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="conversations" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-2">
                      {conversations.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhuma conversa ainda
                        </p>
                      ) : (
                        conversations.map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => setActiveConversation(conv)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className={conv.type === "room" ? "bg-primary/10" : ""}>
                                {conv.type === "room" ? (
                                  <Users className="h-4 w-4" />
                                ) : (
                                  getStaffInitials(conv.name)
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate">{conv.name}</span>
                                {conv.lastMessageTime && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatMessageTime(conv.lastMessageTime)}
                                  </span>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {conv.lastMessage}
                                </p>
                              )}
                            </div>
                            {conv.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="people" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-2">
                      {staffMembers
                        .filter((s) => s.id !== currentStaff.id)
                        .map((staff) => {
                          const status = getPresenceStatus(staff.id);
                          const isOnline = status !== "offline";

                          return (
                            <button
                              key={staff.id}
                              onClick={() => startDMConversation(staff)}
                              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="relative">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className={getRoleColor(staff.role) + " text-white"}>
                                    {getStaffInitials(staff.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <Circle
                                  className={cn(
                                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current",
                                    isOnline ? "text-green-500" : "text-gray-400"
                                  )}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{staff.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {staff.role === "admin" ? "Admin" : staff.role === "cs" ? "CS" : "Consultor"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <>
              {/* Conversation view */}
              <div className="p-4 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {activeConversation.type === "room" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      getStaffInitials(activeConversation.name)
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{activeConversation.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeConversation.type === "room" ? "Grupo" : "Mensagem direta"}
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOwn = msg.staff_id === currentStaff.id;
                      const senderName = getStaffName(msg.staff_id);
                      const wasRead = isOwn && isMessageRead(msg.id, msg.staff_id);

                      return (
                        <div
                          key={msg.id}
                          className={cn("flex gap-2", isOwn && "flex-row-reverse")}
                        >
                          {!isOwn && (
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">
                                {getStaffInitials(senderName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] px-3 py-2 rounded-xl",
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            {!isOwn && activeConversation.type === "room" && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {senderName}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                            <div
                              className={cn(
                                "flex items-center justify-end gap-1 mt-1",
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}
                            >
                              <span className="text-[10px]">
                                {format(parseISO(msg.created_at), "HH:mm", { locale: ptBR })}
                              </span>
                              {isOwn && (
                                wasRead ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message input */}
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                />
                <Button onClick={sendMessage} size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default GlobalChatWidget;

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { playNotificationSound } from "@/lib/notificationSound";

interface ChatNotification {
  id: string;
  recipient_staff_id: string;
  sender_staff_id: string;
  message_id: string;
  room_id: string | null;
  is_dm: boolean;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  message_content?: string;
  room_name?: string;
}

interface StaffMember {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
}

export const ChatNotifications = () => {
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<ChatNotification | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Get current staff id and related data
  useEffect(() => {
    let isMounted = true;
    
    const initializeData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || !isMounted) return;

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (staffError) {
          console.warn("Error fetching staff for chat notifications:", staffError);
          return;
        }

        if (staff && isMounted) {
          setStaffId(staff.id);
        }

        // Fetch staff members for names
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("id, name")
          .eq("is_active", true);
        
        if (staffData && isMounted) {
          setStaffMembers(staffData);
        }

        // Fetch rooms for names
        const { data: roomsData } = await supabase
          .from("virtual_office_rooms")
          .select("id, name")
          .eq("is_active", true);
        
        if (roomsData && isMounted) {
          setRooms(roomsData);
        }
      } catch (error) {
        console.warn("Error initializing chat notifications:", error);
      }
    };

    initializeData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const getStaffName = useCallback((id: string) => {
    return staffMembers.find(s => s.id === id)?.name || "Usuário";
  }, [staffMembers]);

  const getRoomName = useCallback((id: string | null) => {
    if (!id) return "";
    return rooms.find(r => r.id === id)?.name || "Sala";
  }, [rooms]);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Fetch unread notifications on mount and when staffId changes
  useEffect(() => {
    if (!staffId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("virtual_office_chat_notifications")
        .select(`
          id,
          recipient_staff_id,
          sender_staff_id,
          message_id,
          room_id,
          is_dm,
          is_read,
          created_at
        `)
        .eq("recipient_staff_id", staffId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        // Fetch message content for each notification
        const enrichedNotifications = await Promise.all(
          data.map(async (notif) => {
            const { data: msgData } = await supabase
              .from("virtual_office_messages")
              .select("content")
              .eq("id", notif.message_id)
              .single();

            return {
              ...notif,
              sender_name: getStaffName(notif.sender_staff_id),
              message_content: msgData?.content || "",
              room_name: notif.room_id ? getRoomName(notif.room_id) : undefined,
            };
          })
        );

        setNotifications(enrichedNotifications);
      }
    };

    // Wait a bit for staffMembers and rooms to load
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 500);

    return () => clearTimeout(timer);
  }, [staffId, staffMembers, rooms, getStaffName, getRoomName]);

  // Subscribe to realtime chat notifications
  useEffect(() => {
    if (!staffId) return;

    const channel = supabase
      .channel('chat-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'virtual_office_chat_notifications',
          filter: `recipient_staff_id=eq.${staffId}`
        },
        async (payload) => {
          const newNotification = payload.new as ChatNotification;
          
          // Fetch message content
          const { data: msgData } = await supabase
            .from("virtual_office_messages")
            .select("content")
            .eq("id", newNotification.message_id)
            .single();

          const enrichedNotification: ChatNotification = {
            ...newNotification,
            sender_name: getStaffName(newNotification.sender_staff_id),
            message_content: msgData?.content || "",
            room_name: newNotification.room_id ? getRoomName(newNotification.room_id) : undefined,
          };

          // Add to list
          setNotifications(prev => [enrichedNotification, ...prev]);
          
          // Show popup immediately
          setCurrentNotification(enrichedNotification);
          setShowPopup(true);

          // Also show toast
          const senderName = enrichedNotification.sender_name || "Alguém";
          const toastTitle = enrichedNotification.is_dm 
            ? `💬 Mensagem de ${senderName}`
            : `💬 ${senderName} em ${enrichedNotification.room_name || "uma sala"}`;
          
          toast.info(toastTitle, {
            description: enrichedNotification.message_content?.substring(0, 100) || "Nova mensagem",
            duration: 8000,
          });

          // Play notification sound
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, getStaffName, getRoomName]);

  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from("virtual_office_chat_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleMarkAllAsRead = async () => {
    if (!staffId || notifications.length === 0) return;

    await supabase
      .from("virtual_office_chat_notifications")
      .update({ is_read: true })
      .eq("recipient_staff_id", staffId)
      .eq("is_read", false);

    setNotifications([]);
    setShowPopup(false);
    setCurrentNotification(null);
  };

  const handleDismissPopup = async () => {
    if (currentNotification) {
      await handleMarkAsRead(currentNotification.id);
    }
    setShowPopup(false);
    setCurrentNotification(null);
  };

  const handleViewNext = () => {
    if (notifications.length > 1) {
      // Remove current and show next
      const remaining = notifications.filter(n => n.id !== currentNotification?.id);
      if (remaining.length > 0) {
        setCurrentNotification(remaining[0]);
      } else {
        setShowPopup(false);
        setCurrentNotification(null);
      }
      if (currentNotification) {
        handleMarkAsRead(currentNotification.id);
      }
    } else {
      handleDismissPopup();
    }
  };

  return (
    <>
      {/* Notification popup dialog */}
      <Dialog open={showPopup} onOpenChange={(open) => {
        if (!open) handleDismissPopup();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary animate-pulse" />
              Nova Mensagem
              {notifications.length > 1 && (
                <span className="text-sm text-muted-foreground">
                  ({notifications.length} não lidas)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {currentNotification && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(currentNotification.sender_name || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{currentNotification.sender_name}</span>
                      {!currentNotification.is_dm && currentNotification.room_name && (
                        <span className="text-xs text-muted-foreground">
                          em {currentNotification.room_name}
                        </span>
                      )}
                      {currentNotification.is_dm && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Mensagem direta
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 break-words">
                      {currentNotification.message_content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(currentNotification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-2">
                {notifications.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                    Marcar todas como lidas
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button variant="ghost" size="sm" onClick={handleDismissPopup}>
                    <X className="h-4 w-4 mr-1" />
                    Fechar
                  </Button>
                  {notifications.length > 1 && (
                    <Button size="sm" onClick={handleViewNext}>
                      Próxima
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating notification indicator - only show if popup is closed but there are notifications */}
      {!showPopup && notifications.length > 0 && (
        <div className="fixed bottom-20 right-4 z-[60]">
          <Button
            variant="default"
            size="lg"
            className="rounded-full shadow-lg animate-bounce bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              if (notifications.length > 0) {
                setCurrentNotification(notifications[0]);
                setShowPopup(true);
              }
            }}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            {notifications.length} {notifications.length === 1 ? 'mensagem' : 'mensagens'}
          </Button>
        </div>
      )}
    </>
  );
};

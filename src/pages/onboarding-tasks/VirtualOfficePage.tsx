import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Video, 
  Send, 
  Users, 
  MessageSquare, 
  Circle, 
  Plus,
  Settings,
  ExternalLink,
  Coffee,
  Clock,
  Phone,
  X,
  MoreVertical,
  Edit,
  Trash2,
  Link as LinkIcon,
  PhoneOff
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import JitsiMeetRoom from "@/components/virtual-office/JitsiMeetRoom";

interface Room {
  id: string;
  name: string;
  description: string | null;
  room_type: string;
  meet_link: string | null;
  team_type: string | null;
  is_active: boolean;
  created_at: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Presence {
  id: string;
  staff_id: string;
  room_id: string | null;
  status: string;
  last_seen_at: string;
  current_activity: string | null;
  staff?: StaffMember;
}

interface Message {
  id: string;
  room_id: string;
  staff_id: string;
  content: string;
  message_type: string;
  created_at: string;
  staff?: StaffMember;
}

type PresenceStatus = "online" | "away" | "busy" | "in_meeting" | "offline";

const statusConfig: Record<PresenceStatus, { label: string; color: string; icon: typeof Circle }> = {
  online: { label: "Disponível", color: "bg-green-500", icon: Circle },
  away: { label: "Ausente", color: "bg-yellow-500", icon: Coffee },
  busy: { label: "Ocupado", color: "bg-red-500", icon: X },
  in_meeting: { label: "Em Reunião", color: "bg-purple-500", icon: Video },
  offline: { label: "Offline", color: "bg-gray-400", icon: Circle },
};

const VirtualOfficePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [myStatus, setMyStatus] = useState<PresenceStatus>("online");
  const [newMessage, setNewMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", meet_link: "", team_type: "all" });
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
      subscribeToMessages(selectedRoom.id);
    }
  }, [selectedRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-login");
        return;
      }

      // Get current staff member
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role")
        .eq("user_id", user.id)
        .single();

      if (!staffData) {
        toast.error("Acesso restrito a membros da equipe");
        navigate("/onboarding-login");
        return;
      }

      setCurrentStaff(staffData);
      setIsAdmin(staffData.role === "admin");

      // Fetch all data in parallel
      const [roomsRes, staffRes, presenceRes] = await Promise.all([
        supabase.from("virtual_office_rooms").select("*").eq("is_active", true).order("created_at"),
        supabase.from("onboarding_staff").select("id, name, email, role").eq("is_active", true),
        supabase.from("virtual_office_presence").select("*"),
      ]);

      setRooms(roomsRes.data || []);
      setStaffMembers(staffRes.data || []);
      setPresences(presenceRes.data || []);

      // Set initial room
      if (roomsRes.data && roomsRes.data.length > 0) {
        setSelectedRoom(roomsRes.data[0]);
      }

      // Update own presence
      await updatePresence(staffData.id, "online");

      // Subscribe to presence changes
      subscribeToPresence();

    } catch (error) {
      console.error("Error initializing:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const updatePresence = async (staffId: string, status: PresenceStatus, roomId?: string) => {
    try {
      const { error } = await supabase
        .from("virtual_office_presence")
        .upsert({
          staff_id: staffId,
          status,
          room_id: roomId || selectedRoom?.id || null,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "staff_id" });

      if (error) throw error;
      setMyStatus(status);
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  };

  const subscribeToPresence = () => {
    const channel = supabase
      .channel("presence-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "virtual_office_presence" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setPresences((prev) => {
              const filtered = prev.filter((p) => p.staff_id !== (payload.new as Presence).staff_id);
              return [...filtered, payload.new as Presence];
            });
          } else if (payload.eventType === "DELETE") {
            setPresences((prev) => prev.filter((p) => p.id !== (payload.old as Presence).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchMessages = async (roomId: string) => {
    const { data } = await supabase
      .from("virtual_office_messages")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    setMessages(data || []);
  };

  const subscribeToMessages = (roomId: string) => {
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "virtual_office_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !currentStaff) return;

    try {
      const { error } = await supabase
        .from("virtual_office_messages")
        .insert({
          room_id: selectedRoom.id,
          staff_id: currentStaff.id,
          content: newMessage.trim(),
          message_type: "text",
        });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) return;

    try {
      const { error } = await supabase
        .from("virtual_office_rooms")
        .insert({
          name: newRoom.name.trim(),
          description: newRoom.description.trim() || null,
          meet_link: newRoom.meet_link.trim() || null,
          team_type: newRoom.team_type,
          room_type: "temporary",
          created_by: currentStaff?.id,
        });

      if (error) throw error;

      toast.success("Sala criada com sucesso");
      setShowCreateRoom(false);
      setNewRoom({ name: "", description: "", meet_link: "", team_type: "all" });
      
      // Refresh rooms
      const { data } = await supabase.from("virtual_office_rooms").select("*").eq("is_active", true).order("created_at");
      setRooms(data || []);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Erro ao criar sala");
    }
  };

  const updateRoom = async () => {
    if (!editingRoom) return;

    try {
      const { error } = await supabase
        .from("virtual_office_rooms")
        .update({
          name: editingRoom.name,
          description: editingRoom.description,
          meet_link: editingRoom.meet_link,
        })
        .eq("id", editingRoom.id);

      if (error) throw error;

      toast.success("Sala atualizada");
      setShowEditRoom(false);
      setEditingRoom(null);
      
      const { data } = await supabase.from("virtual_office_rooms").select("*").eq("is_active", true).order("created_at");
      setRooms(data || []);
    } catch (error) {
      console.error("Error updating room:", error);
      toast.error("Erro ao atualizar sala");
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from("virtual_office_rooms")
        .update({ is_active: false })
        .eq("id", roomId);

      if (error) throw error;

      toast.success("Sala removida");
      const { data } = await supabase.from("virtual_office_rooms").select("*").eq("is_active", true).order("created_at");
      setRooms(data || []);
      
      if (selectedRoom?.id === roomId && data && data.length > 0) {
        setSelectedRoom(data[0]);
      }
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Erro ao remover sala");
    }
  };

  const getStaffName = (staffId: string) => {
    const staff = staffMembers.find((s) => s.id === staffId);
    return staff?.name || "Usuário";
  };

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getPresenceForStaff = (staffId: string) => {
    return presences.find((p) => p.staff_id === staffId);
  };

  const onlineStaff = staffMembers.filter((s) => {
    const presence = getPresenceForStaff(s.id);
    return presence && presence.status !== "offline";
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "cs": return "CS";
      case "consultant": return "Consultor";
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Escritório Virtual</h1>
            <p className="text-xs text-muted-foreground">{onlineStaff.length} online</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status selector */}
          <Select value={myStatus} onValueChange={(value) => updatePresence(currentStaff?.id || "", value as PresenceStatus)}>
            <SelectTrigger className="w-[140px] h-8">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", statusConfig[myStatus].color)} />
                <span className="text-xs">{statusConfig[myStatus].label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", config.color)} />
                    <span>{config.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Team members sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Users className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Equipe Online</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                <div className="space-y-3">
                  {staffMembers.map((staff) => {
                    const presence = getPresenceForStaff(staff.id);
                    const status = presence?.status || "offline";
                    const config = statusConfig[status];
                    
                    return (
                      <div key={staff.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getStaffInitials(staff.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{staff.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] h-4">{getRoleLabel(staff.role)}</Badge>
                            <span className="text-[10px] text-muted-foreground">{config.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Rooms */}
        <aside className="w-64 border-r bg-card hidden md:flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">Salas</h2>
            <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Sala</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Nome da Sala</Label>
                    <Input
                      value={newRoom.name}
                      onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                      placeholder="Ex: Reunião de Vendas"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={newRoom.description}
                      onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                      placeholder="Descreva o propósito da sala"
                    />
                  </div>
                  <div>
                    <Label>Link do Google Meet</Label>
                    <Input
                      value={newRoom.meet_link}
                      onChange={(e) => setNewRoom({ ...newRoom, meet_link: e.target.value })}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    />
                  </div>
                  <div>
                    <Label>Equipe</Label>
                    <Select value={newRoom.team_type} onValueChange={(v) => setNewRoom({ ...newRoom, team_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="consultants">Consultores</SelectItem>
                        <SelectItem value="cs">Customer Success</SelectItem>
                        <SelectItem value="admin">Administração</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateRoom(false)}>Cancelar</Button>
                  <Button onClick={createRoom}>Criar Sala</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {rooms.map((room) => {
                const roomPresences = presences.filter((p) => p.room_id === room.id && p.status !== "offline");
                
                return (
                  <div
                    key={room.id}
                    className={cn(
                      "p-2 rounded-lg cursor-pointer transition-colors group",
                      selectedRoom?.id === room.id ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{room.name}</span>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoom(room);
                            setShowEditRoom(true);
                          }}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {room.meet_link && <Video className="h-3 w-3 text-green-500" />}
                      <span className="text-[10px] text-muted-foreground">{roomPresences.length} presente{roomPresences.length !== 1 && "s"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <div className="border-b p-3 flex items-center justify-between bg-card">
                <div>
                  <h2 className="font-semibold">{selectedRoom.name}</h2>
                  {selectedRoom.description && (
                    <p className="text-xs text-muted-foreground">{selectedRoom.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isInVideoCall ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        setIsInVideoCall(false);
                        updatePresence(currentStaff?.id || "", "online", selectedRoom.id);
                      }}
                    >
                      <PhoneOff className="h-4 w-4" />
                      Sair da Chamada
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setIsInVideoCall(true);
                        updatePresence(currentStaff?.id || "", "in_meeting", selectedRoom.id);
                      }}
                    >
                      <Video className="h-4 w-4" />
                      Entrar na Sala
                    </Button>
                  )}
                </div>
              </div>

              {/* Video Call or Chat */}
              {isInVideoCall ? (
                <div className="flex-1 relative">
                  <JitsiMeetRoom
                    roomName={selectedRoom.id}
                    displayName={currentStaff?.name || "Usuário"}
                    onLeave={() => {
                      setIsInVideoCall(false);
                      updatePresence(currentStaff?.id || "", "online", selectedRoom.id);
                    }}
                  />
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma mensagem ainda</p>
                          <p className="text-xs">Seja o primeiro a enviar uma mensagem!</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isOwn = msg.staff_id === currentStaff?.id;
                          const staffName = getStaffName(msg.staff_id);
                          
                          return (
                            <div key={msg.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className={cn("text-xs", isOwn ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                  {getStaffInitials(staffName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                                <div className="flex items-center gap-2 mb-1">
                                  {!isOwn && <span className="text-xs font-medium">{staffName}</span>}
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                                  </span>
                                </div>
                                <div className={cn(
                                  "p-3 rounded-lg",
                                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                                )}>
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="border-t p-3 bg-card">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Selecione uma sala para começar</p>
            </div>
          )}
        </main>
      </div>

      {/* Edit Room Dialog */}
      <Dialog open={showEditRoom} onOpenChange={setShowEditRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sala</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome da Sala</Label>
                <Input
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editingRoom.description || ""}
                  onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Link do Google Meet</Label>
                <Input
                  value={editingRoom.meet_link || ""}
                  onChange={(e) => setEditingRoom({ ...editingRoom, meet_link: e.target.value })}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" onClick={() => editingRoom && deleteRoom(editingRoom.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditRoom(false)}>Cancelar</Button>
              <Button onClick={updateRoom}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Room Selector */}
      <div className="md:hidden fixed bottom-16 left-4 right-4">
        <Select value={selectedRoom?.id || ""} onValueChange={(id) => setSelectedRoom(rooms.find((r) => r.id === id) || null)}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder="Selecione uma sala" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {room.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default VirtualOfficePage;

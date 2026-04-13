import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building,
  Users,
  MessageSquare,
  Video,
  Send,
  Circle,
  Loader2,
  Settings,
  BarChart3,
  Clock,
  MapPin,
  Gamepad2,
} from "lucide-react";

const Office3DView = lazy(() => import("./Office3DView"));

interface Room {
  id: string;
  name: string;
  room_type: string;
  floor_number: number;
  capacity: number;
  is_private: boolean;
  description: string | null;
  color: string;
}

interface Presence {
  id: string;
  user_id: string;
  room_id: string | null;
  floor_number: number;
  position_x: number;
  position_y: number;
  position_z: number;
  status: string;
  last_seen_at: string;
  avatar?: {
    display_name: string;
    skin_color: string;
    shirt_color: string;
  };
}

interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
  avatar?: {
    display_name: string;
  };
}

interface ClientUNVOfficeProps {
  projectId: string;
  currentUserId: string;
}

const FLOOR_NAMES: Record<number, string> = {
  1: "Térreo — Suporte",
  2: "2º Andar — Empresários",
  3: "3º Andar — Consultores",
  4: "4º Andar — Staff UNV",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: "bg-green-500" },
  away: { label: "Ausente", color: "bg-yellow-500" },
  busy: { label: "Ocupado", color: "bg-red-500" },
  in_meeting: { label: "Em Reunião", color: "bg-purple-500" },
};

const ClientUNVOffice = ({ projectId, currentUserId }: ClientUNVOfficeProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState("office");
  const [myAvatar, setMyAvatar] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
    setupRealtime();
    enterOffice();
    return () => { leaveOffice(); };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [roomsRes, presenceRes, avatarRes] = await Promise.all([
        supabase.from("office_rooms").select("*").eq("is_active", true).order("floor_number").order("name"),
        supabase.from("office_presence").select("*"),
        supabase.from("office_user_avatars").select("*").eq("user_id", currentUserId).maybeSingle(),
      ]);
      if (roomsRes.data) setRooms(roomsRes.data as Room[]);
      if (presenceRes.data) setPresences(presenceRes.data as Presence[]);
      if (avatarRes.data) setMyAvatar(avatarRes.data);
      else {
        // Create default avatar
        const { data } = await supabase.from("office_user_avatars").insert({
          user_id: currentUserId,
          display_name: "Usuário",
          skin_color: "#F5D0A9",
          shirt_color: "#2196F3",
        }).select().single();
        if (data) setMyAvatar(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const presenceChannel = supabase
      .channel("office-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "office_presence" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setPresences(prev => prev.filter(p => p.id !== (payload.old as any).id));
        } else {
          setPresences(prev => {
            const updated = payload.new as Presence;
            const exists = prev.findIndex(p => p.id === updated.id);
            if (exists >= 0) {
              const next = [...prev];
              next[exists] = updated;
              return next;
            }
            return [...prev, updated];
          });
        }
      })
      .subscribe();

    const chatChannel = supabase
      .channel("office-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "office_chat_messages" }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(chatChannel);
    };
  };

  const enterOffice = async () => {
    await supabase.from("office_presence").upsert({
      user_id: currentUserId,
      floor_number: 2,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      status: "online",
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await supabase.from("office_activity_logs").insert({
      user_id: currentUserId,
      action: "enter_office",
    });
  };

  const leaveOffice = async () => {
    await supabase.from("office_presence").delete().eq("user_id", currentUserId);
    await supabase.from("office_activity_logs").insert({
      user_id: currentUserId,
      action: "leave_office",
    });
  };

  const enterRoom = async (room: Room) => {
    setSelectedRoom(room);
    await supabase.from("office_presence").update({
      room_id: room.id,
      floor_number: room.floor_number,
      status: room.room_type === "meeting" ? "in_meeting" : "online",
    }).eq("user_id", currentUserId);
    await supabase.from("office_activity_logs").insert({
      user_id: currentUserId,
      room_id: room.id,
      action: "enter_room",
    });
    // Fetch room messages
    const { data } = await supabase
      .from("office_chat_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setMessages(data as ChatMessage[]);
  };

  const leaveRoom = async () => {
    if (selectedRoom) {
      await supabase.from("office_activity_logs").insert({
        user_id: currentUserId,
        room_id: selectedRoom.id,
        action: "leave_room",
      });
    }
    await supabase.from("office_presence").update({
      room_id: null,
      status: "online",
    }).eq("user_id", currentUserId);
    setSelectedRoom(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedRoom) return;
    await supabase.from("office_chat_messages").insert({
      room_id: selectedRoom.id,
      user_id: currentUserId,
      message: chatInput.trim(),
    });
    setChatInput("");
  };

  const floorRooms = rooms.filter(r => r.floor_number === currentFloor);
  const onlineCount = presences.length;
  const roomPresences = (roomId: string) => presences.filter(p => p.room_id === roomId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            UNV Office
          </h2>
          <p className="text-sm text-muted-foreground">Escritório virtual interativo</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            {onlineCount} online
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="office" className="gap-1">
            <Gamepad2 className="h-4 w-4" />
            Escritório 3D
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1">
            <MapPin className="h-4 w-4" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1">
            <Users className="h-4 w-4" />
            Pessoas
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        {/* 3D Office View */}
        <TabsContent value="office" className="mt-4">
          <div className="rounded-lg border overflow-hidden" style={{ height: "600px" }}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full bg-muted">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <Office3DView
                rooms={floorRooms}
                presences={presences}
                currentFloor={currentFloor}
                onFloorChange={setCurrentFloor}
                onRoomSelect={enterRoom}
                selectedRoom={selectedRoom}
              />
            </Suspense>
          </div>

          {/* Floor selector */}
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4].map(floor => (
              <Button
                key={floor}
                variant={currentFloor === floor ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentFloor(floor)}
              >
                {FLOOR_NAMES[floor]}
              </Button>
            ))}
          </div>

          {/* Room chat panel */}
          {selectedRoom && (
            <Card className="mt-4">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{selectedRoom.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {roomPresences(selectedRoom.id).length}/{selectedRoom.capacity}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={leaveRoom}>Sair da Sala</Button>
                    {selectedRoom.room_type === "meeting" && (
                      <Button size="sm" className="gap-1">
                        <Video className="h-4 w-4" />
                        Iniciar Chamada
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <ScrollArea className="h-48 border rounded-md p-3 mb-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma mensagem ainda. Seja o primeiro!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.user_id === currentUserId ? "flex-row-reverse" : ""}`}>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {(msg.avatar?.display_name || "U").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`rounded-lg px-3 py-1.5 text-sm max-w-[70%] ${
                            msg.user_id === currentUserId
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}>
                            {msg.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                  />
                  <Button size="icon" onClick={sendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Map View */}
        <TabsContent value="map" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(floor => (
              <Card key={floor}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{FLOOR_NAMES[floor]}</CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="space-y-2">
                    {rooms.filter(r => r.floor_number === floor).map(room => {
                      const ppl = roomPresences(room.id);
                      return (
                        <button
                          key={room.id}
                          onClick={() => enterRoom(room)}
                          className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: room.color || "#4A90D9" }}
                            />
                            <span className="text-sm font-medium">{room.name}</span>
                            {room.is_private && (
                              <Badge variant="outline" className="text-[10px] px-1">Privada</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {ppl.length > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Users className="h-3 w-3 mr-1" />
                                {ppl.length}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* People View */}
        <TabsContent value="people" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Pessoas Online ({onlineCount})</CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              {presences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Ninguém online no momento
                </p>
              ) : (
                <div className="space-y-2">
                  {presences.map(p => {
                    const status = STATUS_LABELS[p.status] || STATUS_LABELS.online;
                    const room = rooms.find(r => r.id === p.room_id);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs" style={{ backgroundColor: p.avatar?.shirt_color || "#2196F3" }}>
                                {(p.avatar?.display_name || "U").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${status.color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.avatar?.display_name || "Usuário"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {room ? room.name : FLOOR_NAMES[p.floor_number] || `Andar ${p.floor_number}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{status.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats View */}
        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{onlineCount}</p>
                <p className="text-xs text-muted-foreground">Online agora</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Building className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{rooms.length}</p>
                <p className="text-xs text-muted-foreground">Salas disponíveis</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{messages.length}</p>
                <p className="text-xs text-muted-foreground">Mensagens hoje</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">4</p>
                <p className="text-xs text-muted-foreground">Andares</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientUNVOffice;

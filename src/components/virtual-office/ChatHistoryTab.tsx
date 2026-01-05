import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  History, 
  Search, 
  MessageSquare,
  Calendar,
  User,
  Filter
} from "lucide-react";
import { format, parseISO, isToday, isYesterday, startOfDay, subDays } from "date-fns";
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
  content: string;
  message_type: string;
  created_at: string;
  room?: Room;
  staff?: StaffMember;
}

interface ChatHistoryTabProps {
  staffMembers: StaffMember[];
  rooms: Room[];
}

const ChatHistoryTab = ({ staffMembers, rooms }: ChatHistoryTabProps) => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    fetchAllMessages();
  }, []);

  const fetchAllMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("virtual_office_messages")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500);

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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "cs": return "CS";
      case "consultant": return "Consultor";
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-purple-500/10 text-purple-500";
      case "cs": return "bg-blue-500/10 text-blue-500";
      case "consultant": return "bg-green-500/10 text-green-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    // Search filter
    if (searchQuery && !msg.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Room filter
    if (selectedRoom !== "all" && msg.room_id !== selectedRoom) {
      return false;
    }

    // Staff filter
    if (selectedStaff !== "all" && msg.staff_id !== selectedStaff) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const msgDate = parseISO(msg.created_at);
      const today = startOfDay(new Date());
      
      switch (dateFilter) {
        case "today":
          if (!isToday(msgDate)) return false;
          break;
        case "yesterday":
          if (!isYesterday(msgDate)) return false;
          break;
        case "week":
          if (msgDate < subDays(today, 7)) return false;
          break;
        case "month":
          if (msgDate < subDays(today, 30)) return false;
          break;
      }
    }

    return true;
  });

  // Group messages by date
  const groupedMessages: Record<string, Message[]> = {};
  filteredMessages.forEach((msg) => {
    const dateKey = format(parseISO(msg.created_at), "yyyy-MM-dd");
    if (!groupedMessages[dateKey]) groupedMessages[dateKey] = [];
    groupedMessages[dateKey].push(msg);
  });

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b p-3 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Histórico de Conversas</h2>
          <Badge variant="outline" className="text-xs">{filteredMessages.length} mensagens</Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Room filter */}
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-[150px]">
              <MessageSquare className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as salas</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Staff filter */}
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-[150px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {staffMembers.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date filter */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages List */}
      <ScrollArea className="flex-1 p-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
            {searchQuery && (
              <Button variant="link" onClick={() => setSearchQuery("")}>
                Limpar busca
              </Button>
            )}
          </div>
        ) : (
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
                    const roomName = getRoomName(msg.room_id);
                    
                    return (
                      <Card key={msg.id} className="transition-colors hover:bg-muted/30">
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback className={cn("text-xs", getRoleColor(staffRole))}>
                                {getStaffInitials(staffName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm">{staffName}</span>
                                <Badge variant="outline" className="text-[10px] h-4">
                                  {getRoleLabel(staffRole)}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] h-4 gap-1">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {roomName}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {format(parseISO(msg.created_at), "HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatHistoryTab;

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Video, 
  MessageSquare, 
  Coffee, 
  Users, 
  Briefcase,
  Monitor,
  Presentation,
  Lock,
  Wifi,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Room {
  id: string;
  name: string;
  description: string | null;
  room_type: string;
  meet_link: string | null;
  team_type: string | null;
  is_active: boolean;
  is_restricted: boolean;
  created_at: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  user_id?: string;
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

interface OfficeFloorMapProps {
  rooms: Room[];
  presences: Presence[];
  staffMembers: StaffMember[];
  selectedRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  unreadCounts: Record<string, number>;
  isAdmin: boolean;
  onEditRoom?: (room: Room) => void;
}

const roomIcons: Record<string, typeof Coffee> = {
  coffee: Coffee,
  meeting: Users,
  focus: Monitor,
  presentation: Presentation,
  general: MessageSquare,
  executive: Briefcase,
};

const getRoomIcon = (room: Room) => {
  const name = room.name.toLowerCase();
  if (name.includes("café") || name.includes("cafe") || name.includes("coffee") || name.includes("copa")) return Coffee;
  if (name.includes("reunião") || name.includes("meeting") || name.includes("sala de")) return Users;
  if (name.includes("foco") || name.includes("focus") || name.includes("silêncio")) return Monitor;
  if (name.includes("apresentação") || name.includes("presentation") || name.includes("board")) return Presentation;
  if (name.includes("diretoria") || name.includes("executive") || name.includes("admin")) return Briefcase;
  return MessageSquare;
};

const getRoomColor = (room: Room, isSelected: boolean) => {
  const name = room.name.toLowerCase();
  if (name.includes("café") || name.includes("cafe") || name.includes("copa")) {
    return isSelected ? "from-amber-500/30 to-orange-500/20 border-amber-500" : "from-amber-500/10 to-orange-500/5 border-amber-500/30";
  }
  if (name.includes("reunião") || name.includes("meeting")) {
    return isSelected ? "from-blue-500/30 to-cyan-500/20 border-blue-500" : "from-blue-500/10 to-cyan-500/5 border-blue-500/30";
  }
  if (name.includes("foco") || name.includes("focus")) {
    return isSelected ? "from-green-500/30 to-emerald-500/20 border-green-500" : "from-green-500/10 to-emerald-500/5 border-green-500/30";
  }
  if (name.includes("diretoria") || name.includes("executive")) {
    return isSelected ? "from-purple-500/30 to-violet-500/20 border-purple-500" : "from-purple-500/10 to-violet-500/5 border-purple-500/30";
  }
  return isSelected ? "from-primary/30 to-primary/20 border-primary" : "from-primary/10 to-primary/5 border-primary/30";
};

// Predefined positions for rooms on the floor map
const getRoomPosition = (index: number, total: number) => {
  const positions = [
    // Row 1 - Top offices
    { gridColumn: "1 / 3", gridRow: "1 / 2" },
    { gridColumn: "3 / 5", gridRow: "1 / 2" },
    { gridColumn: "5 / 7", gridRow: "1 / 2" },
    // Row 2 - Middle spaces
    { gridColumn: "1 / 4", gridRow: "2 / 3" },
    { gridColumn: "4 / 7", gridRow: "2 / 3" },
    // Row 3 - Bottom rooms
    { gridColumn: "1 / 3", gridRow: "3 / 4" },
    { gridColumn: "3 / 5", gridRow: "3 / 4" },
    { gridColumn: "5 / 7", gridRow: "3 / 4" },
  ];
  return positions[index % positions.length];
};

export const OfficeFloorMap = ({
  rooms,
  presences,
  staffMembers,
  selectedRoom,
  onRoomSelect,
  unreadCounts,
  isAdmin,
  onEditRoom,
}: OfficeFloorMapProps) => {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoomPresences = (roomId: string) => {
    return presences.filter((p) => p.room_id === roomId && p.status !== "offline");
  };

  const getStaffById = (staffId: string) => {
    return staffMembers.find((s) => s.id === staffId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Office Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-card to-card/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Planta do Escritório</h2>
              <p className="text-xs text-muted-foreground">Clique em uma sala para entrar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-xs">{presences.filter(p => p.status !== "offline").length} online</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Floor Map */}
      <div className="flex-1 p-6 overflow-auto">
        <div 
          className="relative w-full min-h-[500px] rounded-2xl border-2 border-dashed border-border/50 bg-gradient-to-br from-muted/30 via-background to-muted/20 p-6"
          style={{
            backgroundImage: `
              linear-gradient(90deg, hsl(var(--border) / 0.1) 1px, transparent 1px),
              linear-gradient(hsl(var(--border) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        >
          {/* Office Label */}
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Escritório UNV - Andar 1</span>
          </div>

          {/* Rooms Grid */}
          <div 
            className="grid gap-4 mt-8"
            style={{
              gridTemplateColumns: "repeat(6, 1fr)",
              gridTemplateRows: "repeat(3, minmax(140px, 1fr))",
            }}
          >
            {rooms.map((room, index) => {
              const RoomIcon = getRoomIcon(room);
              const roomPresences = getRoomPresences(room.id);
              const isSelected = selectedRoom?.id === room.id;
              const isHovered = hoveredRoom === room.id;
              const unreadCount = unreadCounts[room.id] || 0;
              const position = getRoomPosition(index, rooms.length);
              const colorClasses = getRoomColor(room, isSelected);

              return (
                <motion.div
                  key={room.id}
                  style={position}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <motion.div
                    className={cn(
                      "h-full rounded-xl border-2 bg-gradient-to-br cursor-pointer transition-all duration-300",
                      "hover:shadow-lg hover:scale-[1.02]",
                      colorClasses,
                      isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl"
                    )}
                    onClick={() => onRoomSelect(room)}
                    onMouseEnter={() => setHoveredRoom(room.id)}
                    onMouseLeave={() => setHoveredRoom(null)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Room Content */}
                    <div className="p-4 h-full flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-2 rounded-lg transition-colors",
                            isSelected ? "bg-background/80" : "bg-background/50"
                          )}>
                            <RoomIcon className={cn(
                              "h-4 w-4",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          {room.is_restricted && (
                            <Lock className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {room.meet_link && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-1 rounded bg-green-500/10">
                                  <Video className="h-3 w-3 text-green-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Google Meet disponível</TooltipContent>
                            </Tooltip>
                          )}
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] animate-pulse">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Room Name */}
                      <h3 className={cn(
                        "font-semibold text-sm mb-1 line-clamp-1",
                        isSelected ? "text-foreground" : "text-foreground/80"
                      )}>
                        {room.name}
                      </h3>
                      
                      {room.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-auto">
                          {room.description}
                        </p>
                      )}

                      {/* Presence Avatars */}
                      <div className="mt-auto pt-3 border-t border-border/30">
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {roomPresences.slice(0, 4).map((presence) => {
                              const staff = getStaffById(presence.staff_id);
                              if (!staff) return null;
                              return (
                                <Tooltip key={presence.id}>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-6 w-6 border-2 border-background">
                                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                                        {getStaffInitials(staff.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>{staff.name}</TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {roomPresences.length > 4 && (
                              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground">+{roomPresences.length - 4}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {roomPresences.length} {roomPresences.length === 1 ? "pessoa" : "pessoas"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Settings Button */}
                    {isAdmin && isHovered && onEditRoom && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-6 w-6 opacity-80 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRoom(room);
                        }}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                    )}
                  </motion.div>

                  {/* Room "Door" indicator when selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Empty State */}
          {rooms.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma sala disponível</p>
              </div>
            </div>
          )}

          {/* Decorative Elements */}
          <div className="absolute bottom-4 right-4 flex items-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-blue-500/30 bg-blue-500/10" />
              <span>Reunião</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-amber-500/30 bg-amber-500/10" />
              <span>Copa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-green-500/30 bg-green-500/10" />
              <span>Foco</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-purple-500/30 bg-purple-500/10" />
              <span>Diretoria</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState } from "react";
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
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoUnv from "@/assets/logo-unv-office.png";

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

const getRoomIcon = (room: Room) => {
  const name = room.name.toLowerCase();
  if (name.includes("café") || name.includes("cafe") || name.includes("coffee") || name.includes("copa")) return Coffee;
  if (name.includes("reunião") || name.includes("meeting") || name.includes("sala de")) return Users;
  if (name.includes("foco") || name.includes("focus") || name.includes("silêncio")) return Monitor;
  if (name.includes("apresentação") || name.includes("presentation") || name.includes("board")) return Presentation;
  if (name.includes("diretoria") || name.includes("executive") || name.includes("admin")) return Briefcase;
  return MessageSquare;
};

const roomColorPalette = [
  { bg: "bg-rose-500", bgLight: "bg-rose-500/15", border: "border-rose-400", accent: "text-rose-400", glow: "shadow-rose-500/30" },
  { bg: "bg-sky-500", bgLight: "bg-sky-500/15", border: "border-sky-400", accent: "text-sky-400", glow: "shadow-sky-500/30" },
  { bg: "bg-amber-500", bgLight: "bg-amber-500/15", border: "border-amber-400", accent: "text-amber-400", glow: "shadow-amber-500/30" },
  { bg: "bg-emerald-500", bgLight: "bg-emerald-500/15", border: "border-emerald-400", accent: "text-emerald-400", glow: "shadow-emerald-500/30" },
  { bg: "bg-violet-500", bgLight: "bg-violet-500/15", border: "border-violet-400", accent: "text-violet-400", glow: "shadow-violet-500/30" },
  { bg: "bg-cyan-500", bgLight: "bg-cyan-500/15", border: "border-cyan-400", accent: "text-cyan-400", glow: "shadow-cyan-500/30" },
  { bg: "bg-pink-500", bgLight: "bg-pink-500/15", border: "border-pink-400", accent: "text-pink-400", glow: "shadow-pink-500/30" },
  { bg: "bg-orange-500", bgLight: "bg-orange-500/15", border: "border-orange-400", accent: "text-orange-400", glow: "shadow-orange-500/30" },
];

const getRoomColor = (room: Room, isSelected: boolean, index: number) => {
  const palette = roomColorPalette[index % roomColorPalette.length];
  
  return {
    bg: isSelected ? palette.bgLight.replace("/15", "/25") : palette.bgLight,
    border: isSelected ? palette.border : palette.border.replace("400", "500/40"),
    accent: palette.accent,
    glow: palette.glow,
    solid: palette.bg
  };
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

  const onlinePresences = presences.filter(p => p.status !== "offline");
  const onlineCount = onlinePresences.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "available": return "bg-green-500";
      case "busy": return "bg-red-500";
      case "away": return "bg-amber-500";
      case "in_meeting":
      case "meeting": return "bg-violet-500";
      default: return "bg-green-500"; // Default to green for any online status
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online":
      case "available": return "Disponível";
      case "busy": return "Ocupado";
      case "away": return "Ausente";
      case "in_meeting":
      case "meeting": return "Em reunião";
      default: return "Online";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Logo */}
      <div className="px-4 py-3 border-b border-border/50 bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Mapa do Escritório</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {onlineCount} online
              </p>
            </div>
          </div>
          <img src={logoUnv} alt="UNV" className="h-10 w-auto object-contain" />
        </div>
      </div>

      {/* Online Users Panel */}
      {onlinePresences.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Equipe Online</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onlinePresences.map((presence) => {
              const staff = getStaffById(presence.staff_id);
              if (!staff) return null;
              
              const currentRoom = rooms.find(r => r.id === presence.room_id);
              
              return (
                <Tooltip key={presence.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-background border border-border/50 hover:border-primary/30 transition-colors cursor-default">
                      <div className="relative">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-medium">
                            {getStaffInitials(staff.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                          getStatusColor(presence.status)
                        )} />
                      </div>
                      <span className="text-xs font-medium truncate max-w-[80px]">
                        {staff.name.split(" ")[0]}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="font-medium">{staff.name}</div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(presence.status))} />
                      {getStatusLabel(presence.status)}
                    </div>
                    {currentRoom && (
                      <div className="text-muted-foreground mt-0.5">
                        📍 {currentRoom.name}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Floor Plan Container */}
      <div className="flex-1 p-4 overflow-auto relative">
        {/* Colorful background gradient */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(168, 85, 247, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 100%, rgba(236, 72, 153, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse at 0% 100%, rgba(34, 197, 94, 0.25) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(14, 165, 233, 0.15) 0%, transparent 70%)
            `,
          }}
        />
        
        <div className="max-w-3xl mx-auto relative">
          {/* Building frame with gradient border */}
          <div 
            className="relative rounded-2xl p-[2px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, 
                rgba(59, 130, 246, 0.5) 0%, 
                rgba(168, 85, 247, 0.5) 25%, 
                rgba(236, 72, 153, 0.5) 50%, 
                rgba(251, 146, 60, 0.5) 75%, 
                rgba(34, 197, 94, 0.5) 100%
              )`,
            }}
          >
            <div className="rounded-2xl bg-background/95 backdrop-blur-sm p-4">
              {/* Decorative corner accents */}
              <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-sky-500/50 rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-violet-500/50 rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-emerald-500/50 rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-pink-500/50 rounded-br-lg" />

              {/* Floor grid pattern with color tint */}
              <div 
                className="absolute inset-0 opacity-10 rounded-2xl pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(90deg, rgba(99, 102, 241, 0.5) 1px, transparent 1px),
                    linear-gradient(rgba(99, 102, 241, 0.5) 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Label with gradient */}
              <div className="text-center mb-4 relative z-10">
                <span 
                  className="inline-block px-4 py-1.5 rounded-full text-[10px] font-semibold tracking-widest text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(168, 85, 247, 0.9))`,
                  }}
                >
                  🏢 ESCRITÓRIO UNV
                </span>
              </div>

              {/* Rooms Grid - Simple responsive grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
              {rooms.map((room, index) => {
                const RoomIcon = getRoomIcon(room);
                const roomPresences = getRoomPresences(room.id);
                const isSelected = selectedRoom?.id === room.id;
                const isHovered = hoveredRoom === room.id;
                const unreadCount = unreadCounts[room.id] || 0;
                const colors = getRoomColor(room, isSelected, index);

                return (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                  >
                    <motion.button
                      className={cn(
                        "w-full h-full min-h-[140px] rounded-lg border-2 p-3 text-left transition-all duration-200",
                        "hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50",
                        colors.bg,
                        colors.border,
                        isSelected && `ring-2 ring-offset-2 ring-offset-background shadow-lg ${colors.glow}`
                      )}
                      onClick={() => onRoomSelect(room)}
                      onMouseEnter={() => setHoveredRoom(room.id)}
                      onMouseLeave={() => setHoveredRoom(null)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Top: Icon + Badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div className={cn(
                          "p-2.5 rounded-lg",
                          colors.solid,
                          "shadow-md"
                        )}>
                          <RoomIcon className="h-4 w-4 text-white" />
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {room.is_restricted && (
                            <div className="p-1 rounded bg-amber-500/20">
                              <Lock className="h-3 w-3 text-amber-400" />
                            </div>
                          )}
                          {room.meet_link && (
                            <div className="p-1 rounded bg-green-500/20">
                              <Video className="h-3 w-3 text-green-400" />
                            </div>
                          )}
                          {unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Room Name */}
                      <h3 className="font-semibold text-sm mb-0.5 line-clamp-1">
                        {room.name}
                      </h3>
                      
                      {room.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-3">
                          {room.description}
                        </p>
                      )}

                      {/* Presence */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center justify-between pt-2 border-t border-current/10">
                          <div className="flex -space-x-1.5">
                            {roomPresences.slice(0, 4).map((presence) => {
                              const staff = getStaffById(presence.staff_id);
                              if (!staff) return null;
                              return (
                                <Tooltip key={presence.id}>
                                  <TooltipTrigger asChild>
                                    <Avatar className="h-5 w-5 border border-background">
                                      <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                        {getStaffInitials(staff.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    {staff.name}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {roomPresences.length > 4 && (
                              <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center">
                                <span className="text-[8px]">+{roomPresences.length - 4}</span>
                              </div>
                            )}
                          </div>
                          {roomPresences.length > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              {roomPresences.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Door indicator */}
                      <div className={cn(
                        "absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-6 rounded-t transition-all",
                        isSelected ? "bg-green-500" : "bg-muted-foreground/30"
                      )} />

                      {/* Admin button */}
                      {isAdmin && isHovered && onEditRoom && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-1 right-1 h-6 w-6 opacity-90"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRoom(room);
                          }}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </motion.button>

                    {/* Selection glow */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={cn(
                            "absolute -inset-0.5 rounded-lg blur-md pointer-events-none -z-10",
                            colors.bg
                          )}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              </div>

              {/* Empty state */}
              {rooms.length === 0 && (
                <div className="flex items-center justify-center h-48 relative z-10">
                  <div className="text-center">
                    <Briefcase className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">Nenhuma sala configurada</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
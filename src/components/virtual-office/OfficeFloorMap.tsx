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
  Settings,
  Sofa
} from "lucide-react";
import { motion } from "framer-motion";
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
  if (name.includes("lounge") || name.includes("descanso")) return Sofa;
  return MessageSquare;
};

const roomColorPalette = [
  { floor: "bg-amber-100", wall: "bg-amber-800", furniture: "bg-amber-200" },
  { floor: "bg-sky-100", wall: "bg-sky-800", furniture: "bg-sky-200" },
  { floor: "bg-emerald-100", wall: "bg-emerald-800", furniture: "bg-emerald-200" },
  { floor: "bg-violet-100", wall: "bg-violet-800", furniture: "bg-violet-200" },
  { floor: "bg-rose-100", wall: "bg-rose-800", furniture: "bg-rose-200" },
  { floor: "bg-cyan-100", wall: "bg-cyan-800", furniture: "bg-cyan-200" },
  { floor: "bg-orange-100", wall: "bg-orange-800", furniture: "bg-orange-200" },
  { floor: "bg-pink-100", wall: "bg-pink-800", furniture: "bg-pink-200" },
];

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
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return presences.filter((p) => 
      p.room_id === roomId && 
      p.status !== "offline" &&
      p.last_seen_at && 
      p.last_seen_at > fiveMinutesAgo
    );
  };

  const getStaffById = (staffId: string) => {
    return staffMembers.find((s) => s.id === staffId);
  };

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const onlinePresences = presences.filter(p => 
    p.status !== "offline" && 
    p.last_seen_at && 
    p.last_seen_at > fiveMinutesAgo
  );
  const onlineCount = onlinePresences.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "available": return "bg-green-500";
      case "busy": return "bg-red-500";
      case "away": return "bg-amber-500";
      case "in_meeting":
      case "meeting": return "bg-violet-500";
      case "offline":
      default: return "bg-gray-400";
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

  const getRoomLayout = (index: number) => {
    const layouts = [
      { doorPosition: "bottom", tableType: "meeting" },
      { doorPosition: "left", tableType: "desk" },
      { doorPosition: "bottom", tableType: "round" },
      { doorPosition: "right", tableType: "desk" },
      { doorPosition: "bottom", tableType: "sofa" },
      { doorPosition: "left", tableType: "meeting" },
    ];
    return layouts[index % layouts.length];
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
              <h2 className="font-semibold text-base">Escritório</h2>
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
      <div className="flex-1 p-4 overflow-auto relative bg-stone-200 dark:bg-stone-800">
        {/* Floor texture pattern */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 40px,
                rgba(0,0,0,0.03) 40px,
                rgba(0,0,0,0.03) 80px
              ),
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 40px,
                rgba(0,0,0,0.03) 40px,
                rgba(0,0,0,0.03) 80px
              )
            `,
          }}
        />
        
        <div className="max-w-4xl mx-auto relative">
          {/* Building walls outer frame */}
          <div className="relative bg-stone-300 dark:bg-stone-700 rounded-lg p-3 shadow-xl">
            {/* Outer wall effect */}
            <div className="absolute inset-0 rounded-lg border-4 border-stone-500 dark:border-stone-500" />
            
            {/* Building label */}
            <div className="text-center mb-3 relative z-10">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-stone-600 dark:bg-stone-800 text-white text-xs font-semibold tracking-wide shadow-lg">
                <Briefcase className="h-3.5 w-3.5" />
                ESCRITÓRIO UNV
              </span>
            </div>

            {/* Corridor / hallway background */}
            <div className="bg-stone-400/50 dark:bg-stone-600/50 rounded-lg p-4 relative">
              {/* Hallway floor pattern */}
              <div 
                className="absolute inset-0 rounded-lg opacity-20"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(255,255,255,0.1) 10px,
                      rgba(255,255,255,0.1) 20px
                    )
                  `,
                }}
              />

              {/* Rooms Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                {rooms.map((room, index) => {
                  const RoomIcon = getRoomIcon(room);
                  const roomPresences = getRoomPresences(room.id);
                  const isSelected = selectedRoom?.id === room.id;
                  const isHovered = hoveredRoom === room.id;
                  const unreadCount = unreadCounts[room.id] || 0;
                  const colors = roomColorPalette[index % roomColorPalette.length];
                  const layout = getRoomLayout(index);

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
                          "w-full min-h-[160px] rounded-sm text-left transition-all duration-200 relative overflow-hidden",
                          "focus:outline-none",
                          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-stone-300 dark:ring-offset-stone-700"
                        )}
                        onClick={() => onRoomSelect(room)}
                        onMouseEnter={() => setHoveredRoom(room.id)}
                        onMouseLeave={() => setHoveredRoom(null)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Room walls (thick border) */}
                        <div className={cn(
                          "absolute inset-0 rounded-sm",
                          colors.wall
                        )} />
                        
                        {/* Room floor (inner area) */}
                        <div className={cn(
                          "absolute inset-[6px] rounded-sm",
                          colors.floor
                        )}>
                          {/* Wood floor pattern */}
                          <div 
                            className="absolute inset-0 opacity-30"
                            style={{
                              backgroundImage: `
                                repeating-linear-gradient(
                                  90deg,
                                  transparent,
                                  transparent 20px,
                                  rgba(139,69,19,0.1) 20px,
                                  rgba(139,69,19,0.1) 21px
                                )
                              `,
                            }}
                          />
                        </div>

                        {/* Door opening */}
                        <div className={cn(
                          "absolute bg-stone-400 dark:bg-stone-500 z-10",
                          layout.doorPosition === "bottom" && "bottom-0 left-1/2 -translate-x-1/2 w-8 h-[6px] rounded-t-sm",
                          layout.doorPosition === "left" && "left-0 top-1/2 -translate-y-1/2 h-8 w-[6px] rounded-r-sm",
                          layout.doorPosition === "right" && "right-0 top-1/2 -translate-y-1/2 h-8 w-[6px] rounded-l-sm",
                        )}>
                          {isSelected && (
                            <div className="absolute inset-0 bg-green-400 animate-pulse rounded-sm" />
                          )}
                        </div>

                        {/* Furniture based on room type */}
                        <div className="absolute inset-[10px] flex items-center justify-center">
                          {layout.tableType === "meeting" && (
                            <div className={cn(
                              "w-[60%] h-[40%] rounded-lg shadow-md border-2 relative",
                              colors.furniture,
                              "border-stone-400/50"
                            )}>
                              <div className="absolute -top-2 left-1/4 w-3 h-2 bg-stone-500 rounded-t-sm" />
                              <div className="absolute -top-2 right-1/4 w-3 h-2 bg-stone-500 rounded-t-sm" />
                              <div className="absolute -bottom-2 left-1/4 w-3 h-2 bg-stone-500 rounded-b-sm" />
                              <div className="absolute -bottom-2 right-1/4 w-3 h-2 bg-stone-500 rounded-b-sm" />
                            </div>
                          )}
                          {layout.tableType === "desk" && (
                            <div className="flex gap-2">
                              <div className={cn("w-8 h-6 rounded shadow-md", colors.furniture)} />
                              <div className={cn("w-8 h-6 rounded shadow-md", colors.furniture)} />
                            </div>
                          )}
                          {layout.tableType === "round" && (
                            <div className={cn(
                              "w-10 h-10 rounded-full shadow-md border-2",
                              colors.furniture,
                              "border-stone-400/50"
                            )} />
                          )}
                          {layout.tableType === "sofa" && (
                            <div className="flex gap-1">
                              <div className={cn("w-10 h-5 rounded-lg shadow-md", colors.furniture)} />
                              <div className={cn("w-5 h-5 rounded shadow-md", colors.furniture)} />
                            </div>
                          )}
                        </div>

                        {/* Room content overlay */}
                        <div className="absolute inset-[6px] p-3 flex flex-col justify-between pointer-events-none">
                          {/* Top: Icon + Badges */}
                          <div className="flex items-start justify-between">
                            <div className="p-1.5 rounded-md bg-white/80 shadow-sm">
                              <RoomIcon className="h-4 w-4 text-stone-700" />
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {room.is_restricted && (
                                <div className="p-1 rounded bg-amber-500/90 shadow-sm">
                                  <Lock className="h-3 w-3 text-white" />
                                </div>
                              )}
                              {room.meet_link && (
                                <div className="p-1 rounded bg-green-500/90 shadow-sm">
                                  <Video className="h-3 w-3 text-white" />
                                </div>
                              )}
                              {unreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] shadow-sm">
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Room Name Label */}
                          <div className="bg-white/90 dark:bg-stone-800/90 rounded px-2 py-1 shadow-sm self-start">
                            <h3 className="font-semibold text-xs text-stone-800 dark:text-stone-200 line-clamp-1">
                              {room.name}
                            </h3>
                          </div>

                          {/* Presence avatars at bottom */}
                          {roomPresences.length > 0 && (
                            <div className="flex items-center justify-between mt-auto pt-1">
                              <div className="flex -space-x-1.5">
                                {roomPresences.slice(0, 4).map((presence) => {
                                  const staff = getStaffById(presence.staff_id);
                                  if (!staff) return null;
                                  return (
                                    <Tooltip key={presence.id}>
                                      <TooltipTrigger asChild>
                                        <Avatar className="h-5 w-5 border-2 border-white shadow-sm pointer-events-auto">
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
                                  <div className="h-5 w-5 rounded-full bg-muted border-2 border-white flex items-center justify-center shadow-sm">
                                    <span className="text-[8px]">+{roomPresences.length - 4}</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-600 bg-white/80 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                {roomPresences.length}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Admin button */}
                        {isAdmin && isHovered && onEditRoom && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute top-1 right-1 h-6 w-6 opacity-90 z-20 pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoom(room);
                            }}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}
                      </motion.button>
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

              {/* Hallway label */}
              <div className="mt-4 text-center">
                <span className="text-[10px] text-stone-600 dark:text-stone-400 tracking-widest uppercase font-medium">
                  Corredor Principal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

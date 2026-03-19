import { useState, useEffect, useCallback } from "react";
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
  Sofa,
  TreePine,
  Flower2,
  Wifi,
  Lamp,
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
  if (name.includes("lounge") || name.includes("descanso")) return Sofa;
  return MessageSquare;
};

// Color palette for avatars based on role
const roleColors: Record<string, { bg: string; text: string; desk: string }> = {
  master: { bg: "bg-amber-400", text: "text-amber-950", desk: "bg-amber-200/80" },
  admin: { bg: "bg-violet-400", text: "text-violet-950", desk: "bg-violet-200/80" },
  cs: { bg: "bg-sky-400", text: "text-sky-950", desk: "bg-sky-200/80" },
  consultant: { bg: "bg-emerald-400", text: "text-emerald-950", desk: "bg-emerald-200/80" },
  head_comercial: { bg: "bg-orange-400", text: "text-orange-950", desk: "bg-orange-200/80" },
  closer: { bg: "bg-cyan-400", text: "text-cyan-950", desk: "bg-cyan-200/80" },
  sdr: { bg: "bg-teal-400", text: "text-teal-950", desk: "bg-teal-200/80" },
  default: { bg: "bg-slate-400", text: "text-slate-950", desk: "bg-slate-200/80" },
};

const getRoleColor = (role: string) => roleColors[role] || roleColors.default;

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

const getStatusEmoji = (status: string) => {
  switch (status) {
    case "online":
    case "available": return "💻";
    case "busy": return "🔴";
    case "away": return "☕";
    case "in_meeting":
    case "meeting": return "📹";
    default: return "💤";
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
    default: return "Offline";
  }
};

// Character SVG component - a cute pixel-art style character
const CharacterAvatar = ({ 
  initials, 
  color, 
  status, 
  isWalking = false,
  size = "md" 
}: { 
  initials: string; 
  color: { bg: string; text: string }; 
  status: string;
  isWalking?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const sizes = {
    sm: { container: "w-8 h-12", head: "w-6 h-6", body: "w-7 h-4", text: "text-[8px]" },
    md: { container: "w-10 h-14", head: "w-8 h-8", body: "w-9 h-5", text: "text-[10px]" },
    lg: { container: "w-12 h-16", head: "w-10 h-10", body: "w-11 h-6", text: "text-xs" },
  };
  const s = sizes[size];

  return (
    <motion.div 
      className={cn("flex flex-col items-center relative", s.container)}
      animate={isWalking ? { y: [0, -3, 0] } : {}}
      transition={isWalking ? { duration: 0.4, repeat: Infinity } : {}}
    >
      {/* Status emoji bubble */}
      <motion.div
        className="absolute -top-4 -right-2 z-20"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-xs">{getStatusEmoji(status)}</span>
      </motion.div>
      
      {/* Head */}
      <div className={cn(
        "rounded-full flex items-center justify-center shadow-md border-2 border-white/80 relative z-10",
        color.bg, s.head
      )}>
        <span className={cn("font-bold", color.text, s.text)}>{initials}</span>
        {/* Status dot */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
          getStatusColor(status)
        )} />
      </div>
      
      {/* Body */}
      <div className={cn(
        "rounded-b-lg rounded-t-sm -mt-1 shadow-sm",
        color.bg, "opacity-80", s.body
      )} />
      
      {/* Legs - animated when walking */}
      <div className="flex gap-0.5 -mt-0.5">
        <motion.div 
          className={cn("w-1.5 h-2 rounded-b", color.bg, "opacity-60")}
          animate={isWalking ? { rotate: [-15, 15, -15] } : {}}
          transition={isWalking ? { duration: 0.3, repeat: Infinity } : {}}
        />
        <motion.div 
          className={cn("w-1.5 h-2 rounded-b", color.bg, "opacity-60")}
          animate={isWalking ? { rotate: [15, -15, 15] } : {}}
          transition={isWalking ? { duration: 0.3, repeat: Infinity } : {}}
        />
      </div>
    </motion.div>
  );
};

// Desk component
const DeskWithChair = ({ direction = "down" }: { direction?: "up" | "down" | "left" | "right" }) => (
  <div className="relative">
    {/* Desk surface */}
    <div className="w-14 h-8 bg-amber-700/90 rounded-sm shadow-md border border-amber-900/30 relative">
      {/* Monitor */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <div className="w-6 h-4 bg-slate-700 rounded-t-sm border border-slate-800/50" />
        <div className="w-3 h-1 bg-slate-600 mx-auto" />
      </div>
      {/* Keyboard */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-2 bg-slate-300 rounded-sm opacity-60" />
    </div>
    {/* Chair */}
    {direction === "down" && (
      <div className="w-6 h-4 bg-slate-600 rounded-b-lg mx-auto -mt-0.5 opacity-80" />
    )}
  </div>
);

// Room card colors
const roomPalette = [
  { floor: "from-amber-50 to-amber-100", wall: "border-amber-300", accent: "bg-amber-500" },
  { floor: "from-sky-50 to-sky-100", wall: "border-sky-300", accent: "bg-sky-500" },
  { floor: "from-emerald-50 to-emerald-100", wall: "border-emerald-300", accent: "bg-emerald-500" },
  { floor: "from-violet-50 to-violet-100", wall: "border-violet-300", accent: "bg-violet-500" },
  { floor: "from-rose-50 to-rose-100", wall: "border-rose-300", accent: "bg-rose-500" },
  { floor: "from-cyan-50 to-cyan-100", wall: "border-cyan-300", accent: "bg-cyan-500" },
  { floor: "from-orange-50 to-orange-100", wall: "border-orange-300", accent: "bg-orange-500" },
  { floor: "from-pink-50 to-pink-100", wall: "border-pink-300", accent: "bg-pink-500" },
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
  const [visitingStaff, setVisitingStaff] = useState<string | null>(null);
  const [walkingTo, setWalkingTo] = useState<string | null>(null);

  const getStaffInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const getRoomPresences = useCallback((roomId: string) => {
    return presences.filter((p) => 
      p.room_id === roomId && 
      p.status !== "offline" &&
      p.last_seen_at && 
      p.last_seen_at > fiveMinutesAgo
    );
  }, [presences, fiveMinutesAgo]);

  const getStaffById = (staffId: string) => staffMembers.find((s) => s.id === staffId);

  const onlinePresences = presences.filter(p => 
    p.status !== "offline" && 
    p.last_seen_at && 
    p.last_seen_at > fiveMinutesAgo
  );
  const onlineCount = onlinePresences.length;

  const handleVisitDesk = (staffId: string) => {
    setWalkingTo(staffId);
    setTimeout(() => {
      setVisitingStaff(staffId);
      setWalkingTo(null);
    }, 800);
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
              <h2 className="font-semibold text-base">Escritório Virtual</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {onlineCount} online agora
              </p>
            </div>
          </div>
          <img src={logoUnv} alt="UNV" className="h-10 w-auto object-contain" />
        </div>
      </div>

      {/* People at their desks - Game-like view */}
      {onlinePresences.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-emerald-50/50 to-sky-50/50 dark:from-emerald-950/20 dark:to-sky-950/20">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Equipe no Escritório
            </span>
          </div>

          {/* Desk grid with characters */}
          <div className="flex flex-wrap gap-4 justify-start">
            {onlinePresences.map((presence, idx) => {
              const staff = getStaffById(presence.staff_id);
              if (!staff) return null;
              
              const currentRoom = rooms.find(r => r.id === presence.room_id);
              const color = getRoleColor(staff.role);
              const isVisiting = visitingStaff === staff.id;
              const isWalkTarget = walkingTo === staff.id;

              return (
                <Tooltip key={presence.id}>
                  <TooltipTrigger asChild>
                    <motion.button
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer relative",
                        "hover:bg-white/60 dark:hover:bg-white/10",
                        isVisiting && "bg-primary/10 ring-2 ring-primary/30 ring-offset-1"
                      )}
                      onClick={() => handleVisitDesk(staff.id)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Walking indicator */}
                      <AnimatePresence>
                        {isWalkTarget && (
                          <motion.div
                            className="absolute -top-1 left-1/2 -translate-x-1/2"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                          >
                            <span className="text-xs">🚶</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Character */}
                      <CharacterAvatar
                        initials={getStaffInitials(staff.name)}
                        color={color}
                        status={presence.status}
                        isWalking={isWalkTarget}
                        size="md"
                      />

                      {/* Desk underneath */}
                      <div className={cn("w-12 h-3 rounded-sm shadow-sm -mt-1", color.desk)} />

                      {/* Name tag */}
                      <span className="text-[10px] font-medium text-foreground/80 max-w-[60px] truncate leading-tight">
                        {staff.name.split(" ")[0]}
                      </span>

                      {/* Room indicator */}
                      {currentRoom && (
                        <span className="text-[8px] text-muted-foreground max-w-[60px] truncate">
                          📍 {currentRoom.name.split(" ").slice(0, 2).join(" ")}
                        </span>
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold">{staff.name}</div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", getStatusColor(presence.status))} />
                        {getStatusLabel(presence.status)}
                      </div>
                      {currentRoom && (
                        <div className="text-muted-foreground">📍 {currentRoom.name}</div>
                      )}
                      <div className="text-muted-foreground italic">Clique para visitar a mesa</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Floor Plan with Rooms */}
      <div className="flex-1 p-4 overflow-auto relative bg-stone-100 dark:bg-stone-900">
        {/* Floor grid pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Decorative elements */}
        <div className="absolute top-6 right-6 opacity-30">
          <TreePine className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="absolute bottom-8 left-8 opacity-30">
          <Flower2 className="h-6 w-6 text-pink-500" />
        </div>
        <div className="absolute top-1/2 right-10 opacity-20">
          <Wifi className="h-5 w-5 text-sky-500" />
        </div>
        
        <div className="max-w-4xl mx-auto relative">
          {/* Building frame */}
          <div className="relative bg-stone-200 dark:bg-stone-800 rounded-xl p-4 shadow-xl border-2 border-stone-300 dark:border-stone-600">
            {/* Building name */}
            <motion.div 
              className="text-center mb-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-stone-700 dark:bg-stone-900 text-white text-xs font-bold tracking-widest shadow-lg uppercase">
                <Briefcase className="h-3.5 w-3.5" />
                Escritório UNV
                <Lamp className="h-3.5 w-3.5 text-amber-300" />
              </span>
            </motion.div>

            {/* Hallway with rooms */}
            <div className="bg-stone-300/60 dark:bg-stone-700/60 rounded-lg p-4">
              {/* Hallway floor */}
              <div 
                className="absolute inset-0 rounded-lg opacity-10"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)`,
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
                  const palette = roomPalette[index % roomPalette.length];

                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.06, type: "spring", stiffness: 200 }}
                    >
                      <motion.button
                        className={cn(
                          "w-full min-h-[170px] rounded-lg text-left transition-all duration-200 relative overflow-hidden",
                          "focus:outline-none border-2",
                          isSelected 
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-stone-200 dark:ring-offset-stone-800 border-primary/50" 
                            : cn("border-stone-400/30 dark:border-stone-500/30", palette.wall),
                          "shadow-lg hover:shadow-xl"
                        )}
                        onClick={() => onRoomSelect(room)}
                        onMouseEnter={() => setHoveredRoom(room.id)}
                        onMouseLeave={() => setHoveredRoom(null)}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Room floor gradient */}
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-br",
                          palette.floor
                        )} />

                        {/* Wood floor pattern */}
                        <div 
                          className="absolute inset-0 opacity-20"
                          style={{
                            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(139,69,19,0.15) 18px, rgba(139,69,19,0.15) 19px)`,
                          }}
                        />

                        {/* Room content */}
                        <div className="absolute inset-0 p-3 flex flex-col justify-between">
                          {/* Top row: icon + badges */}
                          <div className="flex items-start justify-between">
                            <div className={cn(
                              "p-2 rounded-lg bg-white/90 dark:bg-stone-800/90 shadow-sm",
                              isSelected && "ring-1 ring-primary/30"
                            )}>
                              <RoomIcon className="h-4 w-4 text-stone-700 dark:text-stone-300" />
                            </div>
                            
                            <div className="flex items-center gap-1">
                              {room.is_restricted && (
                                <div className="p-1 rounded-md bg-amber-500/90 shadow-sm">
                                  <Lock className="h-3 w-3 text-white" />
                                </div>
                              )}
                              {room.meet_link && (
                                <motion.div 
                                  className="p-1 rounded-md bg-green-500/90 shadow-sm"
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <Video className="h-3 w-3 text-white" />
                                </motion.div>
                              )}
                              {unreadCount > 0 && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring" }}
                                >
                                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px] shadow-md">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                  </Badge>
                                </motion.div>
                              )}
                            </div>
                          </div>

                          {/* Center: furniture representation */}
                          <div className="flex-1 flex items-center justify-center">
                            {/* Miniature characters in room */}
                            {roomPresences.length > 0 && (
                              <div className="flex -space-x-1 items-end">
                                {roomPresences.slice(0, 5).map((presence) => {
                                  const staff = getStaffById(presence.staff_id);
                                  if (!staff) return null;
                                  const color = getRoleColor(staff.role);
                                  return (
                                    <CharacterAvatar
                                      key={presence.id}
                                      initials={getStaffInitials(staff.name)}
                                      color={color}
                                      status={presence.status}
                                      size="sm"
                                    />
                                  );
                                })}
                                {roomPresences.length > 5 && (
                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold border-2 border-white">
                                    +{roomPresences.length - 5}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bottom: room name + count */}
                          <div className="flex items-end justify-between">
                            <div className="bg-white/95 dark:bg-stone-800/95 rounded-md px-2.5 py-1.5 shadow-sm max-w-[80%]">
                              <h3 className="font-bold text-xs text-stone-800 dark:text-stone-200 truncate">
                                {room.name}
                              </h3>
                            </div>
                            {roomPresences.length > 0 && (
                              <span className="text-[10px] font-medium text-stone-600 bg-white/80 px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                {roomPresences.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selected glow effect */}
                        {isSelected && (
                          <motion.div
                            className="absolute inset-0 rounded-lg border-2 border-primary/40"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}

                        {/* Admin button */}
                        {isAdmin && isHovered && onEditRoom && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute top-1 right-1 h-7 w-7 opacity-90 z-20 pointer-events-auto shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoom(room);
                            }}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

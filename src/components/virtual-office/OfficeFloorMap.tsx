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
  TreeDeciduous,
  Armchair,
  Printer,
  BookOpen
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

const getRoomIcon = (room: Room) => {
  const name = room.name.toLowerCase();
  if (name.includes("café") || name.includes("cafe") || name.includes("coffee") || name.includes("copa")) return Coffee;
  if (name.includes("reunião") || name.includes("meeting") || name.includes("sala de")) return Users;
  if (name.includes("foco") || name.includes("focus") || name.includes("silêncio")) return Monitor;
  if (name.includes("apresentação") || name.includes("presentation") || name.includes("board")) return Presentation;
  if (name.includes("diretoria") || name.includes("executive") || name.includes("admin")) return Briefcase;
  return MessageSquare;
};

const getRoomStyle = (room: Room) => {
  const name = room.name.toLowerCase();
  if (name.includes("café") || name.includes("cafe") || name.includes("copa")) {
    return { 
      bg: "bg-amber-900/20", 
      border: "border-amber-700/40",
      accent: "bg-amber-600",
      floor: "bg-gradient-to-br from-amber-950/30 to-amber-900/20"
    };
  }
  if (name.includes("reunião") || name.includes("meeting")) {
    return { 
      bg: "bg-blue-900/20", 
      border: "border-blue-700/40",
      accent: "bg-blue-600",
      floor: "bg-gradient-to-br from-slate-800/30 to-slate-700/20"
    };
  }
  if (name.includes("foco") || name.includes("focus")) {
    return { 
      bg: "bg-emerald-900/20", 
      border: "border-emerald-700/40",
      accent: "bg-emerald-600",
      floor: "bg-gradient-to-br from-emerald-950/30 to-emerald-900/20"
    };
  }
  if (name.includes("diretoria") || name.includes("executive")) {
    return { 
      bg: "bg-violet-900/20", 
      border: "border-violet-700/40",
      accent: "bg-violet-600",
      floor: "bg-gradient-to-br from-violet-950/30 to-violet-900/20"
    };
  }
  return { 
    bg: "bg-slate-800/20", 
    border: "border-slate-600/40",
    accent: "bg-primary",
    floor: "bg-gradient-to-br from-slate-800/30 to-slate-700/20"
  };
};

// Layout positions for architectural floor plan
const getRoomLayout = (index: number) => {
  const layouts = [
    // Top row - Executive offices
    { col: "col-span-2", row: "row-span-2", type: "corner-office" },
    { col: "col-span-2", row: "row-span-2", type: "office" },
    { col: "col-span-2", row: "row-span-2", type: "corner-office-right" },
    // Middle row
    { col: "col-span-3", row: "row-span-2", type: "large-room" },
    { col: "col-span-3", row: "row-span-2", type: "large-room" },
    // Bottom row
    { col: "col-span-2", row: "row-span-2", type: "small-office" },
    { col: "col-span-2", row: "row-span-2", type: "small-office" },
    { col: "col-span-2", row: "row-span-2", type: "small-office" },
  ];
  return layouts[index % layouts.length];
};

// Decorative furniture component
const OfficeFurniture = ({ type }: { type: string }) => {
  if (type === "corner-office" || type === "corner-office-right") {
    return (
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-40">
        <div className="w-6 h-4 bg-amber-800/60 rounded-sm" title="Mesa" />
        <div className="w-2 h-2 bg-slate-600/60 rounded-full" title="Cadeira" />
      </div>
    );
  }
  if (type === "large-room") {
    return (
      <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1 opacity-40">
        <div className="w-12 h-3 bg-slate-700/60 rounded-sm" title="Mesa de reunião" />
        <div className="flex gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-slate-600/60 rounded-full" title="Cadeira" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute bottom-2 right-2 opacity-40">
      <div className="w-4 h-3 bg-slate-700/60 rounded-sm" />
    </div>
  );
};

// Door component
const RoomDoor = ({ isOpen, position = "bottom" }: { isOpen: boolean; position?: string }) => {
  const positionClasses = position === "left" 
    ? "left-0 top-1/2 -translate-y-1/2 w-1 h-8" 
    : "bottom-0 left-1/2 -translate-x-1/2 h-1 w-8";
  
  return (
    <motion.div 
      className={cn(
        "absolute rounded-full transition-all duration-300",
        positionClasses,
        isOpen ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-slate-600"
      )}
      animate={isOpen ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.5, repeat: isOpen ? Infinity : 0, repeatDelay: 2 }}
    />
  );
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

  const onlineCount = presences.filter(p => p.status !== "offline").length;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Office Building Header */}
      <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-100">Escritório Virtual UNV</h2>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                {onlineCount} colaboradores online
              </p>
            </div>
          </div>
          
          {/* Building amenities legend */}
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50">
              <TreeDeciduous className="h-3 w-3 text-emerald-500" />
              <span>Área Verde</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50">
              <Printer className="h-3 w-3 text-slate-400" />
              <span>Impressora</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50">
              <BookOpen className="h-3 w-3 text-amber-500" />
              <span>Biblioteca</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Floor Plan */}
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="relative max-w-5xl mx-auto">
          {/* Building Outline */}
          <div 
            className="relative rounded-2xl border-4 border-slate-700/60 bg-slate-800/30 p-4 md:p-6 shadow-2xl"
            style={{
              boxShadow: "inset 0 2px 20px rgba(0,0,0,0.3), 0 10px 40px rgba(0,0,0,0.4)"
            }}
          >
            {/* Floor texture */}
            <div 
              className="absolute inset-0 opacity-30 rounded-xl"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 39px,
                    rgba(100,116,139,0.1) 39px,
                    rgba(100,116,139,0.1) 40px
                  ),
                  repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 39px,
                    rgba(100,116,139,0.1) 39px,
                    rgba(100,116,139,0.1) 40px
                  )
                `,
              }}
            />

            {/* Corridor */}
            <div className="absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 bg-slate-700/20 border-x border-slate-600/30" />
            
            {/* Decorative plants */}
            <div className="absolute top-4 left-4 flex flex-col gap-1">
              <TreeDeciduous className="h-5 w-5 text-emerald-600/60" />
            </div>
            <div className="absolute top-4 right-4 flex flex-col gap-1">
              <TreeDeciduous className="h-5 w-5 text-emerald-600/60" />
            </div>
            <div className="absolute bottom-4 left-4">
              <Armchair className="h-4 w-4 text-amber-700/50" />
            </div>

            {/* Floor label */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-800 rounded-full border border-slate-600/50 text-[10px] text-slate-400 font-medium">
              ANDAR 1 • PLANTA BAIXA
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-6 gap-3 mt-8">
              {rooms.map((room, index) => {
                const RoomIcon = getRoomIcon(room);
                const roomPresences = getRoomPresences(room.id);
                const isSelected = selectedRoom?.id === room.id;
                const isHovered = hoveredRoom === room.id;
                const unreadCount = unreadCounts[room.id] || 0;
                const layout = getRoomLayout(index);
                const style = getRoomStyle(room);
                const hasActivity = roomPresences.length > 0;

                return (
                  <motion.div
                    key={room.id}
                    className={cn(layout.col, layout.row, "relative min-h-[120px]")}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.4 }}
                  >
                    <motion.button
                      className={cn(
                        "w-full h-full rounded-lg border-2 transition-all duration-300 relative overflow-hidden",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50",
                        style.bg,
                        style.border,
                        style.floor,
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-slate-900 border-primary",
                        hasActivity && "border-opacity-80"
                      )}
                      onClick={() => onRoomSelect(room)}
                      onMouseEnter={() => setHoveredRoom(room.id)}
                      onMouseLeave={() => setHoveredRoom(null)}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Room walls effect */}
                      <div className="absolute inset-0 border-4 border-slate-800/20 rounded-lg pointer-events-none" />
                      
                      {/* Window effect for corner offices */}
                      {(layout.type === "corner-office" || layout.type === "corner-office-right") && (
                        <div className={cn(
                          "absolute top-2 h-1 w-8 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-full",
                          layout.type === "corner-office" ? "left-2" : "right-2"
                        )} />
                      )}

                      {/* Activity glow */}
                      {hasActivity && (
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
                      )}

                      {/* Room content */}
                      <div className="relative z-10 p-3 h-full flex flex-col">
                        {/* Top row: Icon + badges */}
                        <div className="flex items-start justify-between mb-2">
                          <div className={cn(
                            "p-2 rounded-lg backdrop-blur-sm transition-colors",
                            isSelected ? "bg-primary/20" : "bg-slate-800/60"
                          )}>
                            <RoomIcon className={cn(
                              "h-4 w-4",
                              isSelected ? "text-primary" : "text-slate-300"
                            )} />
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {room.is_restricted && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="p-1 rounded bg-amber-500/20">
                                    <Lock className="h-3 w-3 text-amber-400" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Sala restrita</TooltipContent>
                              </Tooltip>
                            )}
                            {room.meet_link && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="p-1 rounded bg-green-500/20">
                                    <Video className="h-3 w-3 text-green-400" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Google Meet</TooltipContent>
                              </Tooltip>
                            )}
                            {unreadCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] animate-pulse shadow-lg shadow-red-500/20">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Room name plate */}
                        <div className="mb-auto">
                          <div className="inline-flex px-2 py-0.5 bg-slate-900/80 rounded text-xs font-semibold text-slate-100 backdrop-blur-sm">
                            {room.name}
                          </div>
                          {room.description && (
                            <p className="text-[9px] text-slate-400 mt-1 line-clamp-1">
                              {room.description}
                            </p>
                          )}
                        </div>

                        {/* Presence indicators */}
                        <div className="mt-2 pt-2 border-t border-slate-700/30">
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-1.5">
                              {roomPresences.slice(0, 5).map((presence) => {
                                const staff = getStaffById(presence.staff_id);
                                if (!staff) return null;
                                return (
                                  <Tooltip key={presence.id}>
                                    <TooltipTrigger>
                                      <Avatar className="h-5 w-5 border-2 border-slate-800 ring-1 ring-green-500/50">
                                        <AvatarFallback className="text-[8px] bg-gradient-to-br from-primary/30 to-primary/10 text-primary-foreground">
                                          {getStaffInitials(staff.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">{staff.name}</TooltipContent>
                                  </Tooltip>
                                );
                              })}
                              {roomPresences.length > 5 && (
                                <div className="h-5 w-5 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center">
                                  <span className="text-[8px] text-slate-300">+{roomPresences.length - 5}</span>
                                </div>
                              )}
                            </div>
                            {roomPresences.length > 0 && (
                              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                {roomPresences.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Furniture decoration */}
                      <OfficeFurniture type={layout.type} />

                      {/* Door indicator */}
                      <RoomDoor isOpen={isSelected} position={index < 3 ? "bottom" : "left"} />

                      {/* Admin edit button */}
                      {isAdmin && isHovered && onEditRoom && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-1 right-1 h-6 w-6 bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 shadow-lg z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditRoom(room);
                          }}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      )}
                    </motion.button>

                    {/* Selection glow effect */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute -inset-1 bg-primary/10 rounded-xl blur-xl pointer-events-none"
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Empty state */}
            {rooms.length === 0 && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="p-4 rounded-full bg-slate-800/50 inline-block mb-3">
                    <Briefcase className="h-8 w-8 text-slate-600" />
                  </div>
                  <p className="text-slate-500">Nenhuma sala configurada</p>
                  <p className="text-xs text-slate-600 mt-1">Crie salas para começar</p>
                </div>
              </div>
            )}
          </div>

          {/* Building info footer */}
          <div className="flex items-center justify-center gap-6 mt-4 text-[10px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-900/40 border border-blue-700/40" />
              <span>Reunião</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-900/40 border border-amber-700/40" />
              <span>Copa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-900/40 border border-emerald-700/40" />
              <span>Foco</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-violet-900/40 border border-violet-700/40" />
              <span>Diretoria</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

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

interface Office3DSceneProps {
  rooms: Room[];
  presences: Presence[];
  staffMembers: StaffMember[];
  selectedRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  unreadCounts: Record<string, number>;
  isAdmin: boolean;
  currentStaffId?: string;
  onStaffClick?: (staff: StaffMember, presence: Presence) => void;
}

const ROLE_COLORS: Record<string, string> = {
  master: "#f59e0b",
  admin: "#ef4444",
  cs: "#0ea5e9",
  consultant: "#10b981",
  head_comercial: "#f97316",
  closer: "#06b6d4",
  sdr: "#14b8a6",
  rh: "#8b5cf6",
  default: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  available: "#22c55e",
  busy: "#ef4444",
  away: "#f59e0b",
  in_meeting: "#8b5cf6",
  meeting: "#8b5cf6",
  offline: "#94a3b8",
};

const ROOM_COLORS = ["#93c5fd", "#86efac", "#fca5a5", "#fcd34d", "#c4b5fd", "#67e8f9"];

const getRoleColor = (role: string) => ROLE_COLORS[role] || ROLE_COLORS.default;

/* ─── Room ─── */
const RoomBlock = ({
  x, z, width, depth, color, name, selected, onClick,
}: {
  x: number; z: number; width: number; depth: number;
  color: string; name: string; selected: boolean; onClick: () => void;
}) => (
  <group position={[x, 0, z]}>
    <mesh
      position={[0, 0.05, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      castShadow receiveShadow
    >
      <boxGeometry args={[width, 0.1, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
    {/* Walls */}
    <mesh position={[0, 0.55, -depth / 2]} castShadow>
      <boxGeometry args={[width, 1, 0.08]} />
      <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} transparent opacity={0.5} />
    </mesh>
    <mesh position={[-width / 2, 0.55, 0]} castShadow>
      <boxGeometry args={[0.08, 1, depth]} />
      <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} transparent opacity={0.4} />
    </mesh>
    <mesh position={[width / 2, 0.55, 0]} castShadow>
      <boxGeometry args={[0.08, 1, depth]} />
      <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} transparent opacity={0.4} />
    </mesh>
  </group>
);

/* ─── Desk ─── */
const DeskMarker = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.7, 0.06, 0.35]} />
      <meshStandardMaterial color="#8b5e34" />
    </mesh>
    <mesh position={[0, 0.5, -0.08]} castShadow>
      <boxGeometry args={[0.2, 0.16, 0.03]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  </group>
);

/* ─── Person with "isMe" highlight ─── */
const PersonMarker = ({
  position, color, status, isMe, name, onClick,
}: {
  position: [number, number, number]; color: string; status: string;
  isMe: boolean; name: string; onClick?: () => void;
}) => {
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const groupRef = useRef<THREE.Group>(null);

  // Floating animation for "me"
  useFrame((state) => {
    if (!groupRef.current || !isMe) return;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.06;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* "Me" ring on floor */}
      {isMe && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 32]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* "Me" arrow above head */}
      {isMe && (
        <mesh position={[0, 1.45, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.18, 4]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Body */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[isMe ? 0.17 : 0.14, 0.32, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[isMe ? 0.19 : 0.16, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      {/* Status dot */}
      <mesh position={[0.22, 1.05, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
};

/* ─── Keyboard Navigation Controller ─── */
const KeyboardNav = ({
  rooms,
  roomLayout,
  selectedRoomId,
  onSelectRoom,
}: {
  rooms: Room[];
  roomLayout: Array<{ room: Room; x: number; z: number; width: number; depth: number }>;
  selectedRoomId: string | null;
  onSelectRoom: (room: Room) => void;
}) => {
  const { camera } = useThree();
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only capture arrow/WASD when not typing
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
        e.preventDefault();
        keysRef.current.add(key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(() => {
    const keys = keysRef.current;
    if (keys.size === 0 || roomLayout.length === 0) return;

    const currentIdx = selectedRoomId
      ? roomLayout.findIndex((rl) => rl.room.id === selectedRoomId)
      : 0;

    let nextIdx = currentIdx;

    if (keys.has("arrowright") || keys.has("d")) {
      nextIdx = Math.min(currentIdx + 1, roomLayout.length - 1);
    } else if (keys.has("arrowleft") || keys.has("a")) {
      nextIdx = Math.max(currentIdx - 1, 0);
    } else if (keys.has("arrowdown") || keys.has("s")) {
      const cols = Math.min(rooms.length, 3);
      nextIdx = Math.min(currentIdx + cols, roomLayout.length - 1);
    } else if (keys.has("arrowup") || keys.has("w")) {
      const cols = Math.min(rooms.length, 3);
      nextIdx = Math.max(currentIdx - cols, 0);
    }

    if (nextIdx !== currentIdx) {
      onSelectRoom(roomLayout[nextIdx].room);
      keysRef.current.clear();
    }
  });

  return null;
};

/* ─── Camera auto-focus on selected room ─── */
const CameraFollower = ({
  targetPosition,
}: {
  targetPosition: [number, number, number] | null;
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!targetPosition || !controlsRef.current) return;
    const target = controlsRef.current.target as THREE.Vector3;
    target.lerp(new THREE.Vector3(targetPosition[0], 0, targetPosition[2]), 0.05);
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 0, 2]}
      minDistance={5}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={Math.PI / 4}
      keys={false}
    />
  );
};

/* ─── Main Scene ─── */
const OfficeScene = ({
  rooms,
  presences,
  staffMembers,
  selectedRoom,
  onRoomSelect,
  unreadCounts,
  currentStaffId,
  onStaffClick,
}: Omit<Office3DSceneProps, "isAdmin">) => {
  const activePresences = useMemo(() => presences.filter((p) => p.status !== "offline"), [presences]);

  const roomLayout = useMemo(() => {
    const cols = Math.max(1, Math.min(rooms.length, 3));
    const roomWidth = 3.2;
    const roomDepth = 2.4;
    const gap = 1.1;

    return rooms.map((room, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        room,
        width: roomWidth,
        depth: roomDepth,
        x: (col - (cols - 1) / 2) * (roomWidth + gap),
        z: row * (roomDepth + gap) + 1.5,
      };
    });
  }, [rooms]);

  const placements = useMemo(() => {
    const items: Array<{
      presence: Presence;
      staff: StaffMember;
      position: [number, number, number];
      deskPosition: [number, number, number];
    }> = [];

    roomLayout.forEach((layout) => {
      const roomPeople = activePresences.filter((p) => p.room_id === layout.room.id);
      roomPeople.forEach((presence, index) => {
        const staff = staffMembers.find((m) => m.id === presence.staff_id);
        if (!staff) return;
        const col = index % 2;
        const row = Math.floor(index / 2);
        items.push({
          presence,
          staff,
          position: [layout.x - 0.7 + col * 1.4, 0, layout.z - 0.4 + row * 0.9],
          deskPosition: [layout.x - 0.7 + col * 1.4, 0, layout.z - 0.68 + row * 0.9],
        });
      });
    });

    const lobby = activePresences.filter((p) => !p.room_id || !rooms.some((r) => r.id === p.room_id));
    lobby.forEach((presence, index) => {
      const staff = staffMembers.find((m) => m.id === presence.staff_id);
      if (!staff) return;
      const col = index % 4;
      const row = Math.floor(index / 4);
      items.push({
        presence,
        staff,
        position: [-3 + col * 1.2, 0, -2 + row * 1.2],
        deskPosition: [-3 + col * 1.2, 0, -2.28 + row * 1.2],
      });
    });

    return items;
  }, [activePresences, roomLayout, rooms, staffMembers]);

  const selectedRoomTarget = useMemo(() => {
    if (!selectedRoom) return null;
    const rl = roomLayout.find((l) => l.room.id === selectedRoom.id);
    if (!rl) return null;
    return [rl.x, 0, rl.z] as [number, number, number];
  }, [selectedRoom, roomLayout]);

  const floorWidth = Math.max(14, roomLayout.length > 0 ? roomLayout.length * 3.5 : 12);
  const floorDepth = Math.max(10, Math.ceil(roomLayout.length / 3) * 4 + 5);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 12, 6]} intensity={2.2} castShadow />
      <directionalLight position={[-6, 8, -4]} intensity={0.8} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 2]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <gridHelper args={[floorWidth, 24, "#64748b", "#94a3b8"]} position={[0, 0, 2]} />

      {/* Rooms */}
      {roomLayout.map((layout, index) => (
        <group key={layout.room.id}>
          <RoomBlock
            x={layout.x} z={layout.z}
            width={layout.width} depth={layout.depth}
            color={ROOM_COLORS[index % ROOM_COLORS.length]}
            name={layout.room.name}
            selected={selectedRoom?.id === layout.room.id}
            onClick={() => onRoomSelect(layout.room)}
          />
          {(unreadCounts[layout.room.id] || 0) > 0 && (
            <mesh position={[layout.x + layout.width / 2 - 0.25, 1.25, layout.z - layout.depth / 2 + 0.2]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.35} />
            </mesh>
          )}
        </group>
      ))}

      {/* People */}
      {placements.map(({ presence, staff, position, deskPosition }) => (
        <group key={presence.id}>
          <DeskMarker position={deskPosition} />
          <PersonMarker
            position={position}
            color={getRoleColor(staff.role)}
            status={presence.status}
            isMe={staff.id === currentStaffId}
            name={staff.name}
            onClick={() => onStaffClick?.(staff, presence)}
          />
        </group>
      ))}

      {/* Keyboard navigation */}
      <KeyboardNav
        rooms={rooms}
        roomLayout={roomLayout}
        selectedRoomId={selectedRoom?.id || null}
        onSelectRoom={onRoomSelect}
      />

      {/* Camera follow */}
      <CameraFollower targetPosition={selectedRoomTarget} />
    </>
  );
};

/* ─── Exported Component ─── */
export const Office3DScene = (props: Office3DSceneProps) => {
  return (
    <div className="relative h-full min-h-[560px] w-full overflow-hidden bg-slate-200">
      <Canvas
        shadows
        frameloop="always"
        camera={{ position: [0, 9, 10], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#e2e8f0"]} />
        <OfficeScene {...props} />
      </Canvas>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm">
        🖱️ Arrastar para girar • Scroll para zoom • ⌨️ Setas/WASD para navegar salas
      </div>

      {props.currentStaffId && (
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full bg-blue-600/80 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
          Você
        </div>
      )}
    </div>
  );
};

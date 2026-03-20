import { useMemo } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

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

const RoomBlock = ({
  x,
  z,
  width,
  depth,
  color,
  selected,
  onClick,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  selected: boolean;
  onClick: () => void;
}) => {
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.05, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 0.55, -depth / 2]} castShadow>
        <boxGeometry args={[width, 1, 0.08]} />
        <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} />
      </mesh>
      <mesh position={[-width / 2, 0.55, 0]} castShadow>
        <boxGeometry args={[0.08, 1, depth]} />
        <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} />
      </mesh>
      <mesh position={[width / 2, 0.55, 0]} castShadow>
        <boxGeometry args={[0.08, 1, depth]} />
        <meshStandardMaterial color={selected ? "#1d4ed8" : "#334155"} />
      </mesh>
    </group>
  );
};

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

const PersonMarker = ({
  position,
  color,
  status,
  onClick,
}: {
  position: [number, number, number];
  color: string;
  status: string;
  onClick?: () => void;
}) => {
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline;

  return (
    <group
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.32, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0.22, 1.05, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
};

const OfficeScene = ({
  rooms,
  presences,
  staffMembers,
  selectedRoom,
  onRoomSelect,
  unreadCounts,
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
        const staff = staffMembers.find((member) => member.id === presence.staff_id);
        if (!staff) return;

        const col = index % 2;
        const row = Math.floor(index / 2);
        const px = layout.x - 0.7 + col * 1.4;
        const pz = layout.z - 0.4 + row * 0.9;

        items.push({
          presence,
          staff,
          position: [px, 0, pz],
          deskPosition: [px, 0, pz - 0.28],
        });
      });
    });

    const lobby = activePresences.filter((p) => !p.room_id || !rooms.some((room) => room.id === p.room_id));
    lobby.forEach((presence, index) => {
      const staff = staffMembers.find((member) => member.id === presence.staff_id);
      if (!staff) return;

      const col = index % 4;
      const row = Math.floor(index / 4);
      const px = -3 + col * 1.2;
      const pz = -2 + row * 1.2;

      items.push({
        presence,
        staff,
        position: [px, 0, pz],
        deskPosition: [px, 0, pz - 0.28],
      });
    });

    return items;
  }, [activePresences, roomLayout, rooms, staffMembers]);

  const floorWidth = Math.max(14, roomLayout.length > 0 ? roomLayout.length * 3.5 : 12);
  const floorDepth = Math.max(10, Math.ceil(roomLayout.length / 3) * 4 + 5);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[8, 12, 6]} intensity={2.2} castShadow />
      <directionalLight position={[-6, 8, -4]} intensity={0.8} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 2]} receiveShadow>
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>

      <gridHelper args={[floorWidth, 24, "#64748b", "#94a3b8"]} position={[0, 0, 2]} />

      {roomLayout.map((layout, index) => (
        <group key={layout.room.id}>
          <RoomBlock
            x={layout.x}
            z={layout.z}
            width={layout.width}
            depth={layout.depth}
            color={ROOM_COLORS[index % ROOM_COLORS.length]}
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

      {placements.map(({ presence, staff, position, deskPosition }) => (
        <group key={presence.id}>
          <DeskMarker position={deskPosition} />
          <PersonMarker
            position={position}
            color={getRoleColor(staff.role)}
            status={presence.status}
            onClick={() => onStaffClick?.(staff, presence)}
          />
        </group>
      ))}

      <OrbitControls
        makeDefault
        target={[0, 0, 2]}
        minDistance={6}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={Math.PI / 4}
      />
    </>
  );
};

export const Office3DScene = (props: Office3DSceneProps) => {
  return (
    <div className="relative h-full min-h-[560px] w-full overflow-hidden rounded-none bg-slate-200">
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
        Arrastar para girar • Scroll para zoom • Clique nas salas ou pessoas
      </div>
    </div>
  );
};

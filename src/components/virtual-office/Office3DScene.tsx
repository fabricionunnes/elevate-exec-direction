import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { 
  OrbitControls, 
  Text, 
  RoundedBox, 
  Environment,
  ContactShadows,
  Float
} from "@react-three/drei";
import * as THREE from "three";

/* ─── Types ─── */
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

/* ─── Colors ─── */
const ROLE_COLORS: Record<string, string> = {
  master: "#f59e0b",
  admin: "#8b5cf6",
  cs: "#38bdf8",
  consultant: "#34d399",
  head_comercial: "#fb923c",
  closer: "#22d3ee",
  sdr: "#2dd4bf",
  default: "#94a3b8",
};

const ROOM_COLORS = [
  "#fef3c7", "#dbeafe", "#d1fae5", "#ede9fe",
  "#fce7f3", "#cffafe", "#ffedd5", "#fdf2f8",
];

const ROOM_BORDER_COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#db2777",
];

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  available: "#22c55e",
  busy: "#ef4444",
  away: "#f59e0b",
  in_meeting: "#8b5cf6",
  meeting: "#8b5cf6",
  offline: "#9ca3af",
};

const getRoleColor = (role: string) => ROLE_COLORS[role] || ROLE_COLORS.default;

/* ─── 3D Character (Capsule body with head) ─── */
const Character3D = ({
  position,
  name,
  role,
  status,
  onClick,
  isSelected = false,
}: {
  position: [number, number, number];
  name: string;
  role: string;
  status: string;
  onClick?: () => void;
  isSelected?: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = getRoleColor(role);
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  useFrame((state) => {
    if (!groupRef.current) return;
    // Idle bobbing
    groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.03;
    // Look at camera slightly
    if (hovered) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      scale={hovered ? 1.15 : 1}
    >
      {/* Body */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.3, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.06, 0.78, 0.16]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.06, 0.78, 0.16]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-0.06, 0.78, 0.18]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.06, 0.78, 0.18]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Status indicator (floating sphere) */}
      <Float speed={3} floatIntensity={0.3}>
        <mesh position={[0.2, 1.0, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.5} />
        </mesh>
      </Float>

      {/* Name label */}
      <Text
        position={[0, 1.15, 0]}
        fontSize={0.12}
        color="#1e293b"
        anchorX="center"
        anchorY="bottom"
        font="/fonts/inter-medium.woff"
        outlineWidth={0.015}
        outlineColor="white"
      >
        {name.split(" ")[0]}
      </Text>

      {/* Initials on body */}
      <Text
        position={[0, 0.4, 0.16]}
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        {initials}
      </Text>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

/* ─── Desk 3D ─── */
const Desk3D = ({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Desk top */}
    <RoundedBox args={[0.8, 0.04, 0.4]} position={[0, 0.38, 0]} radius={0.01} castShadow receiveShadow>
      <meshStandardMaterial color="#92400e" roughness={0.6} />
    </RoundedBox>
    {/* Legs */}
    {[[-0.35, 0.19, -0.15], [0.35, 0.19, -0.15], [-0.35, 0.19, 0.15], [0.35, 0.19, 0.15]].map((pos, i) => (
      <mesh key={i} position={pos as [number, number, number]} castShadow>
        <boxGeometry args={[0.04, 0.38, 0.04]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
    ))}
    {/* Monitor */}
    <group position={[0, 0.4, -0.1]}>
      {/* Screen */}
      <RoundedBox args={[0.35, 0.22, 0.02]} position={[0, 0.14, 0]} radius={0.005} castShadow>
        <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.5} />
      </RoundedBox>
      {/* Screen glow */}
      <mesh position={[0, 0.14, 0.012]}>
        <planeGeometry args={[0.30, 0.17]} />
        <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.3} />
      </mesh>
      {/* Stand */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.04]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.15, 0.01, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
    {/* Keyboard */}
    <RoundedBox args={[0.25, 0.01, 0.08]} position={[0, 0.405, 0.08]} radius={0.003}>
      <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
    </RoundedBox>
  </group>
);

/* ─── Chair 3D ─── */
const Chair3D = ({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Seat */}
    <RoundedBox args={[0.3, 0.04, 0.3]} position={[0, 0.28, 0]} radius={0.02} castShadow>
      <meshStandardMaterial color="#374151" roughness={0.5} />
    </RoundedBox>
    {/* Backrest */}
    <RoundedBox args={[0.28, 0.3, 0.04]} position={[0, 0.46, -0.13]} radius={0.02} castShadow>
      <meshStandardMaterial color="#374151" roughness={0.5} />
    </RoundedBox>
    {/* Pole */}
    <mesh position={[0, 0.14, 0]} castShadow>
      <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
      <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
    </mesh>
    {/* Base star */}
    {[0, 1.25, 2.5, 3.75, 5].map((angle, i) => (
      <mesh key={i} position={[Math.sin(angle) * 0.12, 0.02, Math.cos(angle) * 0.12]} castShadow>
        <boxGeometry args={[0.03, 0.02, 0.15]} />
        <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.3} />
      </mesh>
    ))}
  </group>
);

/* ─── Room 3D (Glass walls) ─── */
const Room3D = ({
  position,
  size,
  name,
  color,
  borderColor,
  isSelected,
  onClick,
  unreadCount = 0,
  hasVideo = false,
}: {
  position: [number, number, number];
  size: [number, number];
  name: string;
  color: string;
  borderColor: string;
  isSelected: boolean;
  onClick: () => void;
  unreadCount?: number;
  hasVideo?: boolean;
}) => {
  const [hovered, setHovered] = useState(false);
  const wallHeight = 0.8;
  const wallThickness = 0.04;

  return (
    <group
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Floor */}
      <mesh position={[0, 0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.8} 
          transparent 
          opacity={hovered ? 0.9 : 0.7} 
        />
      </mesh>

      {/* Walls (glass-like) */}
      {/* Back wall */}
      <mesh position={[0, wallHeight / 2, -size[1] / 2]} castShadow>
        <boxGeometry args={[size[0], wallHeight, wallThickness]} />
        <meshStandardMaterial 
          color={borderColor} 
          transparent 
          opacity={0.3} 
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      {/* Left wall */}
      <mesh position={[-size[0] / 2, wallHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, size[1]]} />
        <meshStandardMaterial 
          color={borderColor} 
          transparent 
          opacity={0.25} 
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      {/* Right wall */}
      <mesh position={[size[0] / 2, wallHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, size[1]]} />
        <meshStandardMaterial 
          color={borderColor} 
          transparent 
          opacity={0.25} 
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Room name plate */}
      <group position={[0, wallHeight + 0.1, -size[1] / 2 + 0.05]}>
        <RoundedBox args={[1.2, 0.2, 0.04]} radius={0.02}>
          <meshStandardMaterial color="white" roughness={0.3} />
        </RoundedBox>
        <Text
          position={[0, 0, 0.025]}
          fontSize={0.09}
          color="#1e293b"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.1}
        >
          {name}
        </Text>
      </group>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <Float speed={4} floatIntensity={0.2}>
          <group position={[size[0] / 2 - 0.15, wallHeight + 0.15, -size[1] / 2 + 0.1]}>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
            </mesh>
            <Text position={[0, 0, 0.11]} fontSize={0.08} color="white" anchorX="center" anchorY="middle">
              {unreadCount > 99 ? "99+" : String(unreadCount)}
            </Text>
          </group>
        </Float>
      )}

      {/* Video icon if has meet_link */}
      {hasVideo && (
        <Float speed={2} floatIntensity={0.15}>
          <mesh position={[size[0] / 2 - 0.1, wallHeight + 0.15, size[1] / 2 - 0.1]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>
        </Float>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size[0] + 0.1, size[1] + 0.1]} />
          <meshStandardMaterial 
            color="#3b82f6" 
            emissive="#3b82f6" 
            emissiveIntensity={0.4} 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}
    </group>
  );
};

/* ─── Plant decoration ─── */
const Plant3D = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Pot */}
    <mesh position={[0, 0.1, 0]} castShadow>
      <cylinderGeometry args={[0.08, 0.06, 0.2, 8]} />
      <meshStandardMaterial color="#92400e" roughness={0.8} />
    </mesh>
    {/* Leaves */}
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[
        Math.sin(i * 1.26) * 0.06,
        0.25 + i * 0.04,
        Math.cos(i * 1.26) * 0.06,
      ]} castShadow>
        <sphereGeometry args={[0.06 + i * 0.01, 8, 8]} />
        <meshStandardMaterial color={i % 2 === 0 ? "#16a34a" : "#22c55e"} roughness={0.8} />
      </mesh>
    ))}
  </group>
);

/* ─── Main Scene ─── */
const OfficeScene = ({
  rooms,
  presences,
  staffMembers,
  selectedRoom,
  onRoomSelect,
  unreadCounts,
  onStaffClick,
}: Omit<Office3DSceneProps, "isAdmin">) => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const onlinePresences = useMemo(() => 
    presences.filter(p => 
      p.status !== "offline" && 
      p.last_seen_at && 
      p.last_seen_at > fiveMinutesAgo
    ), [presences, fiveMinutesAgo]);

  const getStaffById = (id: string) => staffMembers.find(s => s.id === id);

  // Layout rooms in a grid
  const roomLayout = useMemo(() => {
    const cols = Math.min(rooms.length, 3);
    const roomWidth = 2.5;
    const roomDepth = 2;
    const gap = 0.5;
    
    return rooms.map((room, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * (roomWidth + gap);
      const z = row * (roomDepth + gap) + 1;
      return { room, x, z, width: roomWidth, depth: roomDepth };
    });
  }, [rooms]);

  // Place characters at desks inside their rooms
  const characterPlacements = useMemo(() => {
    const placements: Array<{
      presence: Presence;
      staff: StaffMember;
      position: [number, number, number];
      roomLayout: { x: number; z: number; width: number; depth: number };
    }> = [];

    roomLayout.forEach(rl => {
      const roomPresences = onlinePresences.filter(p => p.room_id === rl.room.id);
      roomPresences.forEach((presence, idx) => {
        const staff = getStaffById(presence.staff_id);
        if (!staff) return;
        
        const maxPerRow = 3;
        const col = idx % maxPerRow;
        const row = Math.floor(idx / maxPerRow);
        const spacing = 0.7;
        const startX = rl.x - ((Math.min(roomPresences.length, maxPerRow) - 1) * spacing) / 2;
        
        placements.push({
          presence,
          staff,
          position: [startX + col * spacing, 0, rl.z + 0.2 + row * 0.8],
          roomLayout: rl,
        });
      });
    });

    // People not in any room - place them in a "lobby" area
    const lobbyPresences = onlinePresences.filter(p => !p.room_id || !rooms.find(r => r.id === p.room_id));
    lobbyPresences.forEach((presence, idx) => {
      const staff = getStaffById(presence.staff_id);
      if (!staff) return;
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      placements.push({
        presence,
        staff,
        position: [-3 + col * 0.8, 0, -1.5 + row * 0.8],
        roomLayout: { x: 0, z: 0, width: 0, depth: 0 },
      });
    });

    return placements;
  }, [roomLayout, onlinePresences, rooms]);

  // Calculate floor size
  const floorSize = useMemo(() => {
    const allX = roomLayout.map(r => r.x);
    const allZ = roomLayout.map(r => r.z);
    const maxX = Math.max(...allX.map(x => Math.abs(x))) + 2.5;
    const maxZ = Math.max(...allZ) + 3;
    return [Math.max(maxX * 2 + 2, 10), Math.max(maxZ + 4, 8)] as [number, number];
  }, [roomLayout]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-3, 5, -3]} intensity={0.3} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, floorSize[1] / 2 - 2]} receiveShadow>
        <planeGeometry args={floorSize} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper 
        args={[Math.max(...floorSize), Math.max(...floorSize) * 2, "#e2e8f0", "#e2e8f0"]} 
        position={[0, 0.005, floorSize[1] / 2 - 2]} 
      />

      {/* Contact shadows */}
      <ContactShadows
        position={[0, 0, floorSize[1] / 2 - 2]}
        opacity={0.4}
        scale={Math.max(...floorSize)}
        blur={2}
        far={4}
      />

      {/* Rooms */}
      {roomLayout.map((rl, i) => (
        <Room3D
          key={rl.room.id}
          position={[rl.x, 0, rl.z]}
          size={[rl.width, rl.depth]}
          name={rl.room.name}
          color={ROOM_COLORS[i % ROOM_COLORS.length]}
          borderColor={ROOM_BORDER_COLORS[i % ROOM_BORDER_COLORS.length]}
          isSelected={selectedRoom?.id === rl.room.id}
          onClick={() => onRoomSelect(rl.room)}
          unreadCount={unreadCounts[rl.room.id] || 0}
          hasVideo={!!rl.room.meet_link}
        />
      ))}

      {/* Characters with desks */}
      {characterPlacements.map(({ presence, staff, position: pos }) => (
        <group key={presence.id}>
          <Desk3D position={[pos[0], 0, pos[2] - 0.35]} />
          <Chair3D position={[pos[0], 0, pos[2] + 0.05]} rotation={Math.PI} />
          <Character3D
            position={pos}
            name={staff.name}
            role={staff.role}
            status={presence.status}
            onClick={() => onStaffClick?.(staff, presence)}
            isSelected={false}
          />
        </group>
      ))}

      {/* Decorative plants */}
      {roomLayout.length > 0 && (
        <>
          <Plant3D position={[roomLayout[0].x - roomLayout[0].width / 2 - 0.5, 0, roomLayout[0].z - roomLayout[0].depth / 2]} />
          {roomLayout.length > 1 && (
            <Plant3D position={[roomLayout[roomLayout.length - 1].x + roomLayout[roomLayout.length - 1].width / 2 + 0.5, 0, roomLayout[roomLayout.length - 1].z]} />
          )}
          <Plant3D position={[-floorSize[0] / 2 + 0.5, 0, -1]} />
          <Plant3D position={[floorSize[0] / 2 - 0.5, 0, -1]} />
        </>
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        minDistance={3}
        maxDistance={15}
        target={[0, 0, roomLayout.length > 0 ? roomLayout[0].z : 0]}
        enablePan
        panSpeed={0.8}
      />
    </>
  );
};

/* ─── Main Exported Component ─── */
export const Office3DScene = (props: Office3DSceneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(500);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current?.parentElement) {
        const parentH = containerRef.current.parentElement.clientHeight;
        setHeight(parentH > 100 ? parentH : 500);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    // Re-check after a small delay for layout settling
    const t = setTimeout(updateHeight, 100);
    return () => {
      window.removeEventListener("resize", updateHeight);
      clearTimeout(t);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: `${height}px`, position: "relative" }}>
      <Canvas
        shadows
        camera={{ position: [0, 6, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#f8fafc"]} />
        <fog attach="fog" args={["#f8fafc", 15, 30]} />
        <Suspense fallback={null}>
          <OfficeScene {...props} />
        </Suspense>
      </Canvas>
      
      {/* Controls hint overlay */}
      <div className="absolute bottom-3 left-3 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm pointer-events-none">
        🖱️ Arrastar para girar • Scroll para zoom • Clique nas salas ou pessoas
      </div>
    </div>
  );
};

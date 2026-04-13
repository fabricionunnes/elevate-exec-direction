import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

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
  avatar?: {
    display_name: string;
    skin_color: string;
    shirt_color: string;
  };
}

interface Office3DViewProps {
  rooms: Room[];
  presences: Presence[];
  currentFloor: number;
  onFloorChange: (floor: number) => void;
  onRoomSelect: (room: Room) => void;
  selectedRoom: Room | null;
}

const ROOM_TYPE_COLORS: Record<string, string> = {
  open: "#4CAF50",
  meeting: "#9C27B0",
  private: "#607D8B",
  training: "#2E7D32",
  auditorium: "#1565C0",
  brainstorm: "#FF6F00",
  war_room: "#D32F2F",
  support: "#2196F3",
  networking: "#FF9800",
  presentation: "#E91E63",
};

// 3D Room Component
function Room3D({
  room,
  index,
  isSelected,
  onClick,
  presenceCount,
}: {
  room: Room;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  presenceCount: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const col = index % 4;
  const row = Math.floor(index / 4);
  const x = col * 6 - 9;
  const z = row * 6 - 3;
  const color = room.color || ROOM_TYPE_COLORS[room.room_type] || "#4A90D9";

  useFrame(() => {
    if (!meshRef.current) return;
    const target = hovered || isSelected ? 0.15 : 0;
    meshRef.current.position.y += (target - (meshRef.current.position.y - 0.5)) * 0.1;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={meshRef}
        position={[0, 0.5, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <boxGeometry args={[4.5, 1, 4.5]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 1 : hovered ? 0.9 : 0.7}
          emissive={isSelected ? color : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Room walls */}
      {[
        [0, 1.2, -2.25, 4.5, 1.4, 0.05],
        [0, 1.2, 2.25, 4.5, 1.4, 0.05],
        [-2.25, 1.2, 0, 0.05, 1.4, 4.5],
        [2.25, 1.2, 0, 0.05, 1.4, 4.5],
      ].map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={color} transparent opacity={0.15} />
        </mesh>
      ))}

      {/* Room name label */}
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.35}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {room.name}
      </Text>

      {/* Presence indicator */}
      {presenceCount > 0 && (
        <group position={[1.8, 2.2, 0]}>
          <mesh>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>
          <Text position={[0, 0, 0.26]} fontSize={0.2} color="#ffffff">
            {presenceCount.toString()}
          </Text>
        </group>
      )}

      {/* Private lock indicator */}
      {room.is_private && (
        <Text position={[-1.8, 2.2, 0]} fontSize={0.3} color="#fbbf24">
          🔒
        </Text>
      )}
    </group>
  );
}

// Avatar component for other users
function UserAvatar3D({ presence, rooms }: { presence: Presence; rooms: Room[] }) {
  const room = rooms.find(r => r.id === presence.room_id);
  if (!room) return null;

  const roomIndex = rooms.indexOf(room);
  const col = roomIndex % 4;
  const row = Math.floor(roomIndex / 4);
  const baseX = col * 6 - 9;
  const baseZ = row * 6 - 3;

  // Randomized position within room
  const offsetX = (Math.random() - 0.5) * 3;
  const offsetZ = (Math.random() - 0.5) * 3;

  const shirtColor = presence.avatar?.shirt_color || "#2196F3";
  const skinColor = presence.avatar?.skin_color || "#F5D0A9";

  return (
    <group position={[baseX + offsetX, 1.2, baseZ + offsetZ]}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.15, 0.3, 8, 16]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {/* Name */}
      <Text position={[0, 0.6, 0]} fontSize={0.15} color="#ffffff" anchorX="center" outlineWidth={0.01} outlineColor="#000000">
        {presence.avatar?.display_name || "Usuário"}
      </Text>
      {/* Status dot */}
      <mesh position={[0.15, 0.55, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={presence.status === "online" ? "#22c55e" : presence.status === "busy" ? "#ef4444" : "#eab308"}
          emissive={presence.status === "online" ? "#22c55e" : "#eab308"}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

// Floor plane
function FloorPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[30, 20]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

// Grid
function FloorGrid() {
  return (
    <gridHelper args={[30, 30, "#333355", "#222244"]} position={[0, 0, 0]} />
  );
}

const Office3DView = ({
  rooms,
  presences,
  currentFloor,
  onFloorChange,
  onRoomSelect,
  selectedRoom,
}: Office3DViewProps) => {
  const floorPresences = presences.filter(p => p.floor_number === currentFloor);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 12, 18], fov: 50 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0f0f1a"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
        <pointLight position={[0, 8, 0]} intensity={0.3} color="#6366f1" />

        <FloorPlane />
        <FloorGrid />

        {rooms.map((room, i) => (
          <Room3D
            key={room.id}
            room={room}
            index={i}
            isSelected={selectedRoom?.id === room.id}
            onClick={() => onRoomSelect(room)}
            presenceCount={presences.filter(p => p.room_id === room.id).length}
          />
        ))}

        {floorPresences.map(p => (
          <UserAvatar3D key={p.id} presence={p} rooms={rooms} />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={30}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Floor indicator overlay */}
      <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
        <p className="text-xs font-medium text-muted-foreground">Andar atual</p>
        <p className="text-sm font-bold">
          {currentFloor === 1 && "Térreo — Suporte"}
          {currentFloor === 2 && "2º — Empresários"}
          {currentFloor === 3 && "3º — Consultores"}
          {currentFloor === 4 && "4º — Staff UNV"}
        </p>
      </div>

      {/* Online count overlay */}
      <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
        <p className="text-xs font-medium text-green-500">{floorPresences.length} neste andar</p>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
        <p className="text-[11px] text-muted-foreground">🖱️ Arraste para rotacionar · Scroll para zoom · Clique nas salas para entrar</p>
      </div>
    </div>
  );
};

export default Office3DView;

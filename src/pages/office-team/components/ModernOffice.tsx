// Escritório moderno data-driven — renderiza piso, corredores, salas
// (paredes meia-altura + vidro), portas trancadas e mobília por tipo de sala.
import { useMemo } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { useTeamStore } from '../store/useTeamStore'
import { BUILDING, OfficeRoom, isEffectivelyLocked, roomWalls } from '../lib/rooms'

const WALL_H = 1.15 // parede sólida (meia-altura, estilo maquete)
const GLASS_H = 1.0 // vidro acima da parede
const DOOR_W = 2.6

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.14, 0.44, 10]} />
        <meshStandardMaterial color="#8a8d93" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#2e7d46" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Desk({ x, z, rotation = 0, color = '#e8e2d6' }: { x: number; z: number; rotation?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      {/* Tampo */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[1.7, 0.06, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Painéis laterais */}
      <mesh position={[-0.78, 0.37, 0]}>
        <boxGeometry args={[0.05, 0.74, 0.7]} />
        <meshStandardMaterial color="#b8b2a6" roughness={0.6} />
      </mesh>
      <mesh position={[0.78, 0.37, 0]}>
        <boxGeometry args={[0.05, 0.74, 0.7]} />
        <meshStandardMaterial color="#b8b2a6" roughness={0.6} />
      </mesh>
      {/* Monitor */}
      <mesh position={[0, 1.02, -0.18]} castShadow>
        <boxGeometry args={[0.62, 0.38, 0.04]} />
        <meshStandardMaterial color="#16181d" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.02, -0.16]}>
        <boxGeometry args={[0.56, 0.32, 0.005]} />
        <meshBasicMaterial color="#2a3f5f" />
      </mesh>
      <mesh position={[0, 0.8, -0.18]}>
        <cylinderGeometry args={[0.04, 0.07, 0.12, 8]} />
        <meshStandardMaterial color="#3a3d44" />
      </mesh>
      {/* Cadeira */}
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.42, 0.07, 0.42]} />
          <meshStandardMaterial color="#2f3640" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.68, 0.19]} castShadow>
          <boxGeometry args={[0.42, 0.5, 0.06]} />
          <meshStandardMaterial color="#2f3640" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshStandardMaterial color="#5a5f6a" />
        </mesh>
      </group>
    </group>
  )
}

function MeetingTable({ room }: { room: OfficeRoom }) {
  const len = Math.max(3, room.width - 4.5)
  const chairs = useMemo(() => {
    const perSide = Math.max(2, Math.floor(len / 1.3))
    const out: { x: number; z: number; rot: number }[] = []
    for (let i = 0; i < perSide; i++) {
      const cx = -len / 2 + (i + 0.5) * (len / perSide)
      out.push({ x: cx, z: -1.15, rot: 0 })
      out.push({ x: cx, z: 1.15, rot: Math.PI })
    }
    return out
  }, [len])

  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.76, 0]} castShadow>
        <boxGeometry args={[len, 0.07, 1.7]} />
        <meshStandardMaterial color="#6e4f35" roughness={0.45} />
      </mesh>
      <mesh position={[-len / 2 + 0.5, 0.38, 0]}>
        <boxGeometry args={[0.12, 0.76, 1.3]} />
        <meshStandardMaterial color="#4f3a28" />
      </mesh>
      <mesh position={[len / 2 - 0.5, 0.38, 0]}>
        <boxGeometry args={[0.12, 0.76, 1.3]} />
        <meshStandardMaterial color="#4f3a28" />
      </mesh>
      {chairs.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rot, 0]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.42, 0.07, 0.42]} />
            <meshStandardMaterial color="#37404d" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.68, 0.19]} castShadow>
            <boxGeometry args={[0.42, 0.5, 0.06]} />
            <meshStandardMaterial color="#37404d" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* TV na parede do fundo */}
      <mesh position={[0, 1.7, -room.depth / 2 + 0.25]} castShadow>
        <boxGeometry args={[2.2, 1.15, 0.08]} />
        <meshStandardMaterial color="#0d0f13" roughness={0.3} />
      </mesh>
    </group>
  )
}

function LoungeFurniture({ room }: { room: OfficeRoom }) {
  return (
    <group position={[room.x, 0, room.z]}>
      {/* Sofás em L */}
      <mesh position={[-1.6, 0.3, -1]} castShadow>
        <boxGeometry args={[2.6, 0.6, 1]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.85} />
      </mesh>
      <mesh position={[-1.6, 0.75, -1.45]} castShadow>
        <boxGeometry args={[2.6, 0.55, 0.25]} />
        <meshStandardMaterial color="#6b4f34" roughness={0.85} />
      </mesh>
      <mesh position={[0.6, 0.3, 0.6]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[2.4, 0.6, 1]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.85} />
      </mesh>
      {/* Mesa de centro */}
      <mesh position={[-1.2, 0.32, 0.6]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 16]} />
        <meshStandardMaterial color="#d9d2c5" roughness={0.4} />
      </mesh>
      {/* Balcão de café */}
      <mesh position={[room.width / 2 - 1, 0.55, -room.depth / 2 + 1]} castShadow>
        <boxGeometry args={[1.8, 1.1, 0.7]} />
        <meshStandardMaterial color="#3e4450" roughness={0.5} />
      </mesh>
      <mesh position={[room.width / 2 - 1.3, 1.32, -room.depth / 2 + 1]} castShadow>
        <boxGeometry args={[0.35, 0.45, 0.35]} />
        <meshStandardMaterial color="#15171c" roughness={0.4} />
      </mesh>
      <Plant x={room.width / 2 - 0.8} z={room.depth / 2 - 0.9} />
    </group>
  )
}

function RoomFurniture({ room }: { room: OfficeRoom }) {
  if (room.roomType === 'meeting') return <MeetingTable room={room} />
  if (room.roomType === 'lounge') return <LoungeFurniture room={room} />
  if (room.roomType === 'personal') {
    const deskZ = room.doorSide === 'N' ? room.z + room.depth / 2 - 1.3 : room.z - room.depth / 2 + 1.3
    const rot = room.doorSide === 'N' ? Math.PI : 0
    return (
      <group>
        <Desk x={room.x} z={deskZ} rotation={rot} />
        <Plant x={room.x - room.width / 2 + 0.7} z={deskZ} />
      </group>
    )
  }
  // sector: duas ilhas de mesas frente a frente
  const off = room.width / 4.5
  return (
    <group>
      <Desk x={room.x - off} z={room.z - 1.4} rotation={0} />
      <Desk x={room.x + off} z={room.z - 1.4} rotation={0} />
      <Desk x={room.x - off} z={room.z + 1.6} rotation={Math.PI} />
      <Desk x={room.x + off} z={room.z + 1.6} rotation={Math.PI} />
      <Plant x={room.x + room.width / 2 - 0.8} z={room.z - room.depth / 2 + 0.8} />
    </group>
  )
}

function Room({ room, locked }: { room: OfficeRoom; locked: boolean }) {
  // Paredes visuais = mesma fonte da colisão (porta sempre aberta no visual;
  // quando trancada, renderizamos um painel de porta no vão)
  const walls = useMemo(() => roomWalls(room, true), [room])

  const doorZ = room.doorSide === 'N' ? room.z - room.depth / 2 : room.z + room.depth / 2

  return (
    <group>
      {/* Carpete da sala */}
      <mesh position={[room.x, 0.006, room.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[room.width - 0.2, room.depth - 0.2]} />
        <meshStandardMaterial color={room.color} transparent opacity={0.16} roughness={1} />
      </mesh>

      {/* Paredes: sólida embaixo + vidro em cima */}
      {walls.map((w, i) => {
        const cx = (w.minX + w.maxX) / 2
        const cz = (w.minZ + w.maxZ) / 2
        const sx = Math.max(0.12, w.maxX - w.minX)
        const sz = Math.max(0.12, w.maxZ - w.minZ)
        return (
          <group key={i}>
            <mesh position={[cx, WALL_H / 2, cz]} castShadow receiveShadow>
              <boxGeometry args={[sx, WALL_H, sz]} />
              <meshStandardMaterial color="#eceef2" roughness={0.85} />
            </mesh>
            {/* Faixa de acento na cor da sala */}
            <mesh position={[cx, WALL_H - 0.06, cz]}>
              <boxGeometry args={[sx + 0.01, 0.1, sz + 0.01]} />
              <meshStandardMaterial color={room.color} roughness={0.6} />
            </mesh>
            {/* Vidro */}
            <mesh position={[cx, WALL_H + GLASS_H / 2, cz]}>
              <boxGeometry args={[sx, GLASS_H, Math.min(sz, 0.08)]} />
              <meshStandardMaterial color="#aaccee" transparent opacity={0.16} roughness={0.1} metalness={0.2} />
            </mesh>
          </group>
        )
      })}

      {/* Porta fechada quando trancada */}
      {locked && (
        <mesh position={[room.x, (WALL_H + GLASS_H) / 2, doorZ]} castShadow>
          <boxGeometry args={[DOOR_W, WALL_H + GLASS_H, 0.18]} />
          <meshStandardMaterial color="#5b4632" roughness={0.7} />
        </mesh>
      )}

      {/* Nome da sala */}
      <Billboard position={[room.x, WALL_H + GLASS_H + 0.55, room.z]} follow={true}>
        <Text
          fontSize={0.42}
          color={locked ? '#ff8a80' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.035}
          outlineColor="#1a1a2e"
        >
          {locked ? `🔒 ${room.name}` : room.name}
        </Text>
      </Billboard>

      <RoomFurniture room={room} />
    </group>
  )
}

export default function ModernOffice() {
  const rooms = useTeamStore((s) => s.rooms)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)

  const onlineIds = useMemo(() => {
    const ids = new Set(Object.keys(remotePlayers))
    if (me) ids.add(me.id)
    return ids
  }, [remotePlayers, me])

  const W = BUILDING.maxX - BUILDING.minX
  const D = BUILDING.maxZ - BUILDING.minZ
  const cx = (BUILDING.minX + BUILDING.maxX) / 2
  const cz = (BUILDING.minZ + BUILDING.maxZ) / 2

  return (
    <group>
      {/* Piso geral */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#cfd4dc" roughness={0.95} />
      </mesh>

      {/* Faixas de corredor */}
      <mesh position={[cx, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 5]} />
        <meshStandardMaterial color="#b7bdc9" roughness={0.95} />
      </mesh>
      <mesh position={[cx, 0.004, 13]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 3]} />
        <meshStandardMaterial color="#b7bdc9" roughness={0.95} />
      </mesh>
      {/* Corredor entre as duas fileiras da ala privada */}
      <mesh position={[cx, 0.004, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 1.6]} />
        <meshStandardMaterial color="#b7bdc9" roughness={0.95} />
      </mesh>
      {/* Passagem vertical central da ala privada */}
      <mesh position={[0, 0.005, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.2, 13.6]} />
        <meshStandardMaterial color="#b7bdc9" roughness={0.95} />
      </mesh>

      {/* Perímetro do prédio */}
      {[
        { x: cx, z: BUILDING.minZ, w: W + 0.4, d: 0.4 },
        { x: cx, z: BUILDING.maxZ, w: W + 0.4, d: 0.4 },
        { x: BUILDING.minX, z: cz, w: 0.4, d: D + 0.4 },
        { x: BUILDING.maxX, z: cz, w: 0.4, d: D + 0.4 },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, 1.3, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, 2.6, p.d]} />
          <meshStandardMaterial color="#dfe2e8" roughness={0.85} />
        </mesh>
      ))}

      {/* Plantas no corredor central */}
      {[-26, -14, -2, 10, 22].map((x) => (
        <Plant key={x} x={x} z={0} />
      ))}

      {/* Salas */}
      {rooms.map((room) => (
        <Room key={room.id} room={room} locked={isEffectivelyLocked(room, onlineIds)} />
      ))}
    </group>
  )
}

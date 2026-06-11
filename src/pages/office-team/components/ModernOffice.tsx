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

/** Clicar numa cadeira manda o boneco andar até ela e sentar. */
function sitAt(x: number, z: number, rot: number) {
  const st = useTeamStore.getState()
  st.setPendingWalkTo({ x, z })
  st.setPendingSeat({ x, z, rot })
}

/** Cadeira de escritório clicável. `rotation` = direção do ENCOSTO (+z local);
 * o jogador senta olhando pro lado oposto. */
function OfficeChair({
  x,
  z,
  rotation = 0,
  color = '#2f3640',
}: {
  x: number
  z: number
  rotation?: number
  color?: string
}) {
  const sitRot = rotation + Math.PI // sentado olhando pro lado oposto ao encosto
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return
        sitAt(x, z, sitRot)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.42, 0.07, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.68, 0.19]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#5a5f6a" />
      </mesh>
    </group>
  )
}

function Desk({ x, z, rotation = 0, color = '#e8e2d6', chair = true }: { x: number; z: number; rotation?: number; color?: string; chair?: boolean }) {
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
      {/* Cadeira (opcional — salas pessoais usam OfficeChair clicável) */}
      {chair && (
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
      )}
    </group>
  )
}

function MeetingTable({ room }: { room: OfficeRoom }) {
  const len = Math.max(3, room.width - 4.5)
  // Cadeiras em coordenadas de mundo (clicáveis → sentar). Encosto sempre
  // pro lado oposto da mesa (sentado olhando pra mesa).
  const chairs = useMemo(() => {
    const perSide = Math.max(2, Math.floor(len / 1.3))
    const out: { x: number; z: number; backRot: number }[] = []
    for (let i = 0; i < perSide; i++) {
      const cx = room.x - len / 2 + (i + 0.5) * (len / perSide)
      out.push({ x: cx, z: room.z - 1.15, backRot: Math.PI }) // lado norte: olha pro sul
      out.push({ x: cx, z: room.z + 1.15, backRot: 0 }) // lado sul: olha pro norte
    }
    return out
  }, [len, room.x, room.z])

  return (
    <group>
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
        {/* TV na parede do fundo */}
        <mesh position={[0, 1.7, -room.depth / 2 + 0.25]} castShadow>
          <boxGeometry args={[2.2, 1.15, 0.08]} />
          <meshStandardMaterial color="#0d0f13" roughness={0.3} />
        </mesh>
      </group>
      {chairs.map((c, i) => (
        <OfficeChair key={i} x={c.x} z={c.z} rotation={c.backRot} color="#37404d" />
      ))}
    </group>
  )
}

function BistroTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Mesa alta */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.05, 14]} />
        <meshStandardMaterial color="#e8e2d6" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1, 8]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Banquetas */}
      {[0, Math.PI].map((a) => (
        <group key={a} position={[Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75]}>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 10]} />
            <meshStandardMaterial color="#6b4f34" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.6, 8]} />
            <meshStandardMaterial color="#3a3d44" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Lounge aberto — praça de convivência com vários núcleos de conversa. */
function LoungeFurniture({ room }: { room: OfficeRoom }) {
  const left = room.x - room.width / 2
  const right = room.x + room.width / 2
  const backZ = room.z - room.depth / 2

  return (
    <group>
      {/* Balcão de café (fundo, lado leste) */}
      <group position={[right - 2.4, 0, backZ + 1.1]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[3, 1.1, 0.8]} />
          <meshStandardMaterial color="#3e4450" roughness={0.5} />
        </mesh>
        <mesh position={[-0.9, 1.32, 0]} castShadow>
          <boxGeometry args={[0.35, 0.45, 0.35]} />
          <meshStandardMaterial color="#15171c" roughness={0.4} />
        </mesh>
        <mesh position={[0.5, 1.16, 0]}>
          <boxGeometry args={[0.6, 0.1, 0.45]} />
          <meshStandardMaterial color="#d9d2c5" roughness={0.4} />
        </mesh>
      </group>

      {/* Núcleo oeste: sofás em L + mesa de centro */}
      <Rug x={left + 3.2} z={room.z - 0.2} color="#8B6F47" />
      <Sofa x={left + 3.2} z={room.z - 1.7} rotation={0} color="#7a5c3e" />
      <Sofa x={left + 1.6} z={room.z - 0.2} rotation={Math.PI / 2} color="#7a5c3e" />
      <CoffeeTable x={left + 3.4} z={room.z - 0.3} />
      <Armchair x={left + 4.9} z={room.z - 0.3} rotation={-Math.PI / 2} color="#8a6248" />

      {/* Núcleo central: sofás frente a frente */}
      <Rug x={room.x - 0.5} z={room.z + 1.4} color="#5a6b7d" />
      <Sofa x={room.x - 0.5} z={room.z + 2.5} rotation={Math.PI} color="#5a6b7d" />
      <Sofa x={room.x - 0.5} z={room.z + 0.3} rotation={0} color="#5a6b7d" />
      <CoffeeTable x={room.x - 0.5} z={room.z + 1.4} />

      {/* Mesas bistrô (leste) */}
      <BistroTable x={right - 3} z={room.z + 0.6} />
      <BistroTable x={right - 5.4} z={room.z + 2.2} />
      <BistroTable x={right - 1.8} z={room.z + 2.8} />

      {/* Verde espalhado */}
      <Plant x={left + 0.8} z={backZ + 0.9} />
      <Plant x={left + 0.8} z={room.z + room.depth / 2 - 0.9} />
      <Plant x={room.x + 1.5} z={backZ + 0.8} />
      <Plant x={right - 0.8} z={room.z + room.depth / 2 - 0.9} />
    </group>
  )
}

function Sofa({ x, z, rotation = 0, color = '#5a6b7d' }: { x: number; z: number; rotation?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, -0.32]} castShadow>
        <boxGeometry args={[1.7, 0.45, 0.18]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[-0.78, 0.5, 0]} castShadow>
        <boxGeometry args={[0.16, 0.42, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0.78, 0.5, 0]} castShadow>
        <boxGeometry args={[0.16, 0.42, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Armchair({ x, z, rotation = 0, color = '#7d6b5a' }: { x: number; z: number; rotation?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.75, 0.45, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.65, -0.28]} castShadow>
        <boxGeometry args={[0.75, 0.5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bookshelf({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.3, 1.8, 0.32]} />
        <meshStandardMaterial color="#5d4a36" roughness={0.7} />
      </mesh>
      {[0.45, 0.95, 1.45].map((y) => (
        <mesh key={y} position={[0, y, 0.05]}>
          <boxGeometry args={[1.14, 0.26, 0.24]} />
          <meshStandardMaterial color="#8a7256" roughness={0.6} />
        </mesh>
      ))}
      {/* Livros */}
      {[-0.35, 0, 0.35].map((bx, i) => (
        <mesh key={i} position={[bx, 1.02, 0.1]}>
          <boxGeometry args={[0.26, 0.2, 0.12]} />
          <meshStandardMaterial color={['#8a3030', '#2f5d8a', '#3f7245'][i]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Rug({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <mesh position={[x, 0.009, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[1, 24]} />
      <meshStandardMaterial color={color} roughness={1} transparent opacity={0.55} />
    </mesh>
  )
}

function CoffeeTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 14]} />
        <meshStandardMaterial color="#d9d2c5" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
        <meshStandardMaterial color="#7a7d83" />
      </mesh>
    </group>
  )
}

function WallArt({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 1.35, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <meshStandardMaterial color="#2a2d33" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.78, 0.48, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  )
}

function hashRoom(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

/** Salas individuais: mesa de trabalho + decoração variada por sala.
 * Layout executivo: dono senta ATRÁS da mesa olhando pra porta, com duas
 * cadeiras de visita na frente. Todas as cadeiras são clicáveis (sentar). */
function PersonalFurniture({ room }: { room: OfficeRoom }) {
  // door é sempre N nas pessoais: fundo = z + depth/2
  const backZ = room.z + room.depth / 2
  const deskZ = backZ - 1.3
  const variant = hashRoom(room.id) % 4
  return (
    <group>
      <Desk x={room.x} z={deskZ} rotation={0} chair={false} />
      {/* Cadeira do dono: atrás da mesa, de frente pra porta */}
      <OfficeChair x={room.x} z={deskZ + 0.7} rotation={0} />
      {/* Cadeiras de visita: na frente da mesa, de frente pro dono */}
      <OfficeChair x={room.x - 0.55} z={deskZ - 1.4} rotation={Math.PI} color="#6b4f34" />
      <OfficeChair x={room.x + 0.55} z={deskZ - 1.4} rotation={Math.PI} color="#6b4f34" />
      <WallArt x={room.x + (variant % 2 === 0 ? 1.6 : -1.6)} z={backZ - 0.25} color={room.color} />
      {variant === 0 && (
        <>
          <Plant x={room.x - room.width / 2 + 0.7} z={deskZ} />
          <Rug x={room.x} z={room.z - 0.6} color={room.color} />
          <Armchair x={room.x + room.width / 2 - 0.85} z={room.z - 0.7} rotation={-Math.PI / 2} />
        </>
      )}
      {variant === 1 && (
        <>
          <Sofa x={room.x - room.width / 2 + 1.05} z={room.z - 0.5} rotation={Math.PI / 2} color="#6b5a7d" />
          <CoffeeTable x={room.x + 0.3} z={room.z - 0.5} />
          <Plant x={room.x + room.width / 2 - 0.7} z={backZ - 0.8} />
        </>
      )}
      {variant === 2 && (
        <>
          <Bookshelf x={room.x - room.width / 2 + 0.35} z={room.z - 0.4} rotation={Math.PI / 2} />
          <Armchair x={room.x + 0.9} z={room.z - 1} rotation={Math.PI} color="#5a7d6b" />
          <Plant x={room.x + room.width / 2 - 0.7} z={deskZ} />
        </>
      )}
      {variant === 3 && (
        <>
          <Armchair x={room.x - 0.9} z={room.z - 1} rotation={Math.PI / 4} color="#8a6248" />
          <Armchair x={room.x + 0.9} z={room.z - 1} rotation={-Math.PI / 4} color="#8a6248" />
          <CoffeeTable x={room.x} z={room.z - 1.4} />
          <Rug x={room.x} z={room.z - 1.2} color={room.color} />
          <Plant x={room.x - room.width / 2 + 0.7} z={backZ - 0.8} />
        </>
      )}
    </group>
  )
}

function RoomFurniture({ room }: { room: OfficeRoom }) {
  if (room.roomType === 'meeting') return <MeetingTable room={room} />
  if (room.roomType === 'lounge') return <LoungeFurniture room={room} />
  if (room.roomType === 'personal') return <PersonalFurniture room={room} />
  // sector: mesa de reunião grande (time trabalha junto)
  return (
    <group>
      <MeetingTable room={room} />
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
      {/* Carpete da sala (mais forte no lounge aberto, que não tem paredes) */}
      <mesh position={[room.x, 0.006, room.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[room.width - 0.2, room.depth - 0.2]} />
        <meshStandardMaterial
          color={room.color}
          transparent
          opacity={room.roomType === 'lounge' ? 0.28 : 0.16}
          roughness={1}
        />
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

      {/* Plano invisível de clique: duplo clique = andar até o ponto */}
      <mesh
        position={[cx, 0.012, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return // arrasto de câmera, não clique
          useTeamStore.getState().setPendingWalkTo({ x: e.point.x, z: e.point.z })
        }}
      >
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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

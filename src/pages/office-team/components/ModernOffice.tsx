// Escritório moderno data-driven — renderiza piso, corredores, salas
// (paredes meia-altura + vidro), portas trancadas e mobília por tipo de sala.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { BUILDING, OfficeRoom, isEffectivelyLocked, roomWalls } from '../lib/rooms'
import { woodTexture, floorTexture, carpetTexture, artTexture, officialLogoTexture } from '../lib/textures'
import { doorProximity } from '../lib/door'
import { marceloState } from './MarceloNpc'

const WALL_H = 1.15 // parede sólida (meia-altura, estilo maquete)
const GLASS_H = 1.0 // vidro acima da parede
const DOOR_W = 2.6

function Plant({ x, z }: { x: number; z: number }) {
  // Duas espécies, escolhidas pela posição (determinístico)
  const palm = Math.abs(Math.round(x * 7 + z * 13)) % 2 === 0
  return (
    <group position={[x, 0, z]}>
      {/* Vaso cerâmica */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.4, 12]} />
        <meshStandardMaterial color={palm ? '#b0682f' : '#9aa3ad'} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 12]} />
        <meshStandardMaterial color="#4a3424" roughness={0.95} />
      </mesh>
      {palm ? (
        <>
          {/* Palmeira: caule + folhas inclinadas */}
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.04, 0.45, 8]} />
            <meshStandardMaterial color="#6b4f2f" roughness={0.9} />
          </mesh>
          {[0, 1.2, 2.4, 3.7, 5].map((a) => (
            <mesh
              key={a}
              position={[Math.sin(a) * 0.16, 0.9, Math.cos(a) * 0.16]}
              rotation={[Math.cos(a) * 0.9, a, Math.sin(a) * 0.9]}
              castShadow
            >
              <coneGeometry args={[0.07, 0.5, 5]} />
              <meshStandardMaterial color="#3f8a4f" roughness={0.85} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          {/* Arbusto denso em camadas */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.26, 10, 8]} />
            <meshStandardMaterial color="#2e7d46" roughness={0.95} />
          </mesh>
          <mesh position={[0.12, 0.74, 0.06]} castShadow>
            <sphereGeometry args={[0.17, 9, 7]} />
            <meshStandardMaterial color="#3c9457" roughness={0.95} />
          </mesh>
          <mesh position={[-0.12, 0.72, -0.05]} castShadow>
            <sphereGeometry args={[0.15, 9, 7]} />
            <meshStandardMaterial color="#27693b" roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  )
}

/** Clicar numa cadeira manda o boneco andar até ela e sentar —
 * se ninguém estiver sentado nela. */
function sitAt(x: number, z: number, rot: number) {
  const st = useTeamStore.getState()
  const occupied =
    Object.values(st.remotePlayers).some(
      (p) => p.sitting && Math.hypot(p.position[0] - x, p.position[2] - z) < 0.5
    ) ||
    (marceloState.active && marceloState.sitting && Math.hypot(marceloState.x - x, marceloState.z - z) < 0.5)
  if (occupied) {
    st.addToast('Essa cadeira já está ocupada', 'out')
    return
  }
  st.setPendingWalkTo({ x, z })
  st.setPendingSeat({ x, z, rot })
}

/** Converte um ponto local de um móvel rotacionado pra coordenada de mundo. */
function localToWorld(x: number, z: number, rotation: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  return [x + lx * c + lz * s, z - lx * s + lz * c]
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
      {/* Assento e encosto levemente arredondados */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.42, 0.07, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.68, 0.19]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {/* Braços */}
      <mesh position={[-0.22, 0.55, 0.02]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.3]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.22, 0.55, 0.02]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.3]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Coluna a gás + base 5 hastes com rodízios */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.3, 8]} />
        <meshStandardMaterial color="#6b737d" metalness={0.6} roughness={0.35} />
      </mesh>
      {[0, 1.257, 2.513, 3.77, 5.027].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0, 0.075, 0.13]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.035, 0.03, 0.26]} />
            <meshStandardMaterial color="#3a3d44" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.03, 0.25]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#1d1f24" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Desk({
  x,
  z,
  rotation = 0,
  chair = true,
  noteTarget,
}: {
  x: number
  z: number
  rotation?: number
  color?: string
  chair?: boolean
  /** mesa de outro usuário: clicar deixa recado pra ele */
  noteTarget?: { userId: string; name: string }
}) {
  const me = useTeamStore((s) => s.me)
  const clickable = !!noteTarget && noteTarget.userId !== me?.id
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={
        clickable
          ? (e) => {
              e.stopPropagation()
              if (e.delta > 6) return
              useTeamStore.getState().setComposeNoteFor(noteTarget!)
            }
          : undefined
      }
      onPointerOver={clickable ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={clickable ? () => (document.body.style.cursor = 'default') : undefined}
    >
      {/* Tampo de madeira com borda */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[1.7, 0.05, 0.8]} />
        <meshStandardMaterial map={woodTexture()} color="#caa06a" roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.708, 0]}>
        <boxGeometry args={[1.7, 0.02, 0.8]} />
        <meshStandardMaterial color="#8a6238" roughness={0.6} />
      </mesh>
      {/* Painéis laterais metálicos */}
      <mesh position={[-0.78, 0.37, 0]}>
        <boxGeometry args={[0.05, 0.72, 0.7]} />
        <meshStandardMaterial color="#7c828c" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0.78, 0.37, 0]}>
        <boxGeometry args={[0.05, 0.72, 0.7]} />
        <meshStandardMaterial color="#7c828c" metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Dois monitores estilo Apple (alumínio, borda fina, braço central) */}
      {[-0.36, 0.36].map((mx) => (
        <group key={mx} position={[mx, 0, -0.17]} rotation={[0, mx < 0 ? 0.2 : -0.2, 0]}>
          <mesh position={[0, 1.04, 0]} castShadow>
            <boxGeometry args={[0.6, 0.38, 0.022]} />
            <meshStandardMaterial color="#d3d6da" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.04, 0.013]}>
            <boxGeometry args={[0.565, 0.345, 0.004]} />
            <meshStandardMaterial color="#5b7fb5" emissive="#4a6fa5" emissiveIntensity={0.55} />
          </mesh>
          {/* Braço inclinado + base disco (alumínio) */}
          <mesh position={[0, 0.875, -0.04]} rotation={[0.28, 0, 0]}>
            <boxGeometry args={[0.05, 0.16, 0.018]} />
            <meshStandardMaterial color="#c9ccd1" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.775, -0.06]}>
            <cylinderGeometry args={[0.075, 0.085, 0.014, 16]} />
            <meshStandardMaterial color="#c9ccd1" metalness={0.75} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Teclado e caneca */}
      <mesh position={[0, 0.775, 0.08]}>
        <boxGeometry args={[0.4, 0.02, 0.14]} />
        <meshStandardMaterial color="#d8d5cf" roughness={0.6} />
      </mesh>
      <mesh position={[0.55, 0.795, 0.05]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 10]} />
        <meshStandardMaterial color="#CC1B1B" roughness={0.45} />
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
    // Cabeceiras: uma cadeira em cada ponta da mesa
    out.push({ x: room.x - len / 2 - 0.55, z: room.z, backRot: -Math.PI / 2 }) // ponta oeste: olha pro leste
    out.push({ x: room.x + len / 2 + 0.55, z: room.z, backRot: Math.PI / 2 }) // ponta leste: olha pro oeste
    return out
  }, [len, room.x, room.z])

  return (
    <group>
      <group position={[room.x, 0, room.z]}>
        {/* Tampo nobre com folha de madeira */}
        <mesh position={[0, 0.76, 0]} castShadow>
          <boxGeometry args={[len, 0.06, 1.7]} />
          <meshStandardMaterial map={woodTexture()} color="#9a6a40" roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.722, 0]}>
          <boxGeometry args={[len, 0.025, 1.7]} />
          <meshStandardMaterial color="#5f3f26" roughness={0.55} />
        </mesh>
        <mesh position={[-len / 2 + 0.5, 0.38, 0]}>
          <boxGeometry args={[0.12, 0.74, 1.3]} />
          <meshStandardMaterial color="#4f3a28" roughness={0.6} />
        </mesh>
        <mesh position={[len / 2 - 0.5, 0.38, 0]}>
          <boxGeometry args={[0.12, 0.74, 1.3]} />
          <meshStandardMaterial color="#4f3a28" roughness={0.6} />
        </mesh>
        {/* TV na parede do fundo (tela acesa) */}
        <mesh position={[0, 1.7, -room.depth / 2 + 0.25]} castShadow>
          <boxGeometry args={[2.2, 1.15, 0.08]} />
          <meshStandardMaterial color="#0d0f13" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.7, -room.depth / 2 + 0.295]}>
          <boxGeometry args={[2.05, 1.0, 0.005]} />
          <meshStandardMaterial color="#1e3a5f" emissive="#16304f" emissiveIntensity={0.5} />
        </mesh>
        {/* Luminárias pendentes sobre a mesa */}
        {[-len / 4, len / 4].map((lx) => (
          <group key={lx} position={[lx, 0, 0]}>
            <mesh position={[0, 2.45, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.5, 6]} />
              <meshStandardMaterial color="#2a2d33" />
            </mesh>
            <mesh position={[0, 2.16, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.22, 0.16, 14]} />
              <meshStandardMaterial color="#23262c" roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[0, 2.075, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.02, 14]} />
              <meshStandardMaterial color="#ffe9b8" emissive="#ffdf9e" emissiveIntensity={1.2} />
            </mesh>
          </group>
        ))}
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
      {/* Banquetas (4 por mesa, clicáveis — senta olhando pra mesa) */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => (
        <group
          key={a}
          position={[Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75]}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 6) return
            sitAt(x + Math.sin(a) * 0.75, z + Math.cos(a) * 0.75, a + Math.PI)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
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
  // Dois lugares; clique escolhe o assento mais próximo do ponto clicado.
  // Sentado olhando pra fora do encosto (+z local).
  const onSit = (px: number, pz: number) => {
    const seats: [number, number][] = [
      localToWorld(x, z, rotation, -0.42, 0.08),
      localToWorld(x, z, rotation, 0.42, 0.08),
    ]
    const seat = seats.reduce((a, b) =>
      Math.hypot(a[0] - px, a[1] - pz) <= Math.hypot(b[0] - px, b[1] - pz) ? a : b
    )
    sitAt(seat[0], seat[1], rotation)
  }
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return
        onSit(e.point.x, e.point.z)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.62, -0.32]} castShadow>
        <boxGeometry args={[1.7, 0.45, 0.18]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[-0.78, 0.5, 0]} castShadow>
        <boxGeometry args={[0.16, 0.42, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[0.78, 0.5, 0]} castShadow>
        <boxGeometry args={[0.16, 0.42, 0.8]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      {/* Almofadas */}
      <mesh position={[-0.4, 0.62, -0.18]} rotation={[0.25, 0, 0.1]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.12]} />
        <meshStandardMaterial color="#e8ddc8" roughness={0.95} />
      </mesh>
      <mesh position={[0.42, 0.62, -0.18]} rotation={[0.22, 0, -0.12]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.12]} />
        <meshStandardMaterial color="#c9762e" roughness={0.95} />
      </mesh>
    </group>
  )
}

function Armchair({ x, z, rotation = 0, color = '#7d6b5a' }: { x: number; z: number; rotation?: number; color?: string }) {
  const seat = localToWorld(x, z, rotation, 0, 0.06)
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return
        sitAt(seat[0], seat[1], rotation)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
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
  // Arte abstrata gerada por seed derivada da posição
  const seed = Math.abs(Math.round(x * 3 + z * 7)) % 8
  return (
    <group position={[x, 1.35, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.66, 0.05]} />
        <meshStandardMaterial color="#2a2d33" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.78, 0.54]} />
        <meshStandardMaterial map={artTexture(seed)} color="#ffffff" roughness={0.65} />
      </mesh>
      {/* Borda interna na cor da sala */}
      <mesh position={[0, -0.31, 0.028]}>
        <boxGeometry args={[0.9, 0.04, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Relógio de parede (face voltada pro sul/+z), marcando 10:10. */
function WallClock({ x, z, y = 2.05 }: { x: number; z: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <torusGeometry args={[0.21, 0.018, 8, 24]} />
        <meshStandardMaterial color="#23262c" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Ponteiros (10:10) */}
      <mesh position={[-0.045, 0.045, 0.028]} rotation={[0, 0, 0.8]}>
        <boxGeometry args={[0.018, 0.13, 0.008]} />
        <meshStandardMaterial color="#23262c" />
      </mesh>
      <mesh position={[0.05, 0.05, 0.028]} rotation={[0, 0, -0.75]}>
        <boxGeometry args={[0.013, 0.17, 0.008]} />
        <meshStandardMaterial color="#23262c" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <sphereGeometry args={[0.014, 8, 6]} />
        <meshStandardMaterial color="#CC1B1B" />
      </mesh>
    </group>
  )
}

/** Letreiro retroiluminado da fachada com a logomarca oficial. */
function FacadeSign() {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    let cancelled = false
    void officialLogoTexture().then((t) => {
      if (!cancelled) setTex(t)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const z = BUILDING.maxZ + 0.32
  return (
    <group position={[0, 4.05, z]}>
      {/* Caixa do letreiro (moldura navy + painel branco retroiluminado) */}
      <mesh castShadow>
        <boxGeometry args={[8.4, 2.1, 0.35]} />
        <meshStandardMaterial color="#0D2B5E" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.19]}>
        <boxGeometry args={[8.0, 1.8, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#f2f6ff" emissiveIntensity={0.75} />
      </mesh>
      {tex && (
        <mesh position={[0, 0, 0.222]}>
          <planeGeometry args={[2.0, 2.0]} />
          <meshStandardMaterial map={tex} transparent emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.35} />
        </mesh>
      )}
      {/* Nome da empresa ao lado da logo */}
      <Text
        position={[1.35, 0.18, 0.23]}
        fontSize={0.52}
        color="#0D2B5E"
        anchorX="left"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#0D2B5E"
      >
        UNV
      </Text>
      <Text position={[1.35, -0.32, 0.23]} fontSize={0.21} color="#CC1B1B" anchorX="left" anchorY="middle">
        UNIVERSIDADE NACIONAL DE VENDAS
      </Text>
      {/* Spots de iluminação no topo */}
      {[-3.2, 0, 3.2].map((sx) => (
        <group key={sx} position={[sx, 1.25, 0.25]}>
          <mesh rotation={[0.6, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 0.22, 10]} />
            <meshStandardMaterial color="#23262c" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.08, 0.1]} rotation={[0.6, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 10]} />
            <meshStandardMaterial color="#fff4cc" emissive="#ffedb0" emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Porta dupla de vidro que desliza ao detectar alguém perto (shopping). */
function AutoDoor() {
  const leftRef = useRef<THREE.Group>(null!)
  const rightRef = useRef<THREE.Group>(null!)
  const openTRef = useRef(0)

  useFrame((_, delta) => {
    const st = useTeamStore.getState()
    const doorX = 0
    const doorZ = BUILDING.maxZ
    let near = false
    const check = (x: number, z: number) => {
      if (Math.hypot(x - doorX, z - doorZ) < 3.4) near = true
    }
    check(st.playerPosition[0], st.playerPosition[2])
    for (const p of Object.values(st.remotePlayers)) check(p.position[0], p.position[2])
    for (const a of doorProximity.values()) check(a.x, a.z)

    const target = near ? 1 : 0
    openTRef.current += (target - openTRef.current) * Math.min(1, 5 * delta)
    const slide = openTRef.current * 1.65
    if (leftRef.current) leftRef.current.position.x = -0.85 - slide
    if (rightRef.current) rightRef.current.position.x = 0.85 + slide
  })

  return (
    <group position={[0, 0, BUILDING.maxZ]}>
      {/* Vão escuro atrás das folhas (recorte visual na fachada) */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[3.7, 2.5, 0.46]} />
        <meshStandardMaterial color="#1c2026" roughness={0.7} />
      </mesh>
      {/* Folhas de vidro deslizantes */}
      <group ref={leftRef} position={[-0.85, 0, 0]}>
        <mesh position={[0, 1.2, 0.26]}>
          <boxGeometry args={[1.7, 2.4, 0.05]} />
          <meshStandardMaterial color="#aaccee" transparent opacity={0.4} roughness={0.05} metalness={0.3} />
        </mesh>
        <mesh position={[0.82, 1.2, 0.26]}>
          <boxGeometry args={[0.07, 2.4, 0.08]} />
          <meshStandardMaterial color="#6b737d" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      <group ref={rightRef} position={[0.85, 0, 0]}>
        <mesh position={[0, 1.2, 0.26]}>
          <boxGeometry args={[1.7, 2.4, 0.05]} />
          <meshStandardMaterial color="#aaccee" transparent opacity={0.4} roughness={0.05} metalness={0.3} />
        </mesh>
        <mesh position={[-0.82, 1.2, 0.26]}>
          <boxGeometry args={[0.07, 2.4, 0.08]} />
          <meshStandardMaterial color="#6b737d" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* Trilho superior */}
      <mesh position={[0, 2.46, 0.26]}>
        <boxGeometry args={[4.0, 0.14, 0.12]} />
        <meshStandardMaterial color="#23262c" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Sensor (luzinha) */}
      <mesh position={[0, 2.56, 0.3]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color="#3fdc6a" emissive="#2ec457" emissiveIntensity={1.2} />
      </mesh>
    </group>
  )
}

/** Logomarca oficial (PNG com águia, fundo removido) aplicada no piso. */
function FloorLogo() {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    let cancelled = false
    void officialLogoTexture().then((t) => {
      if (!cancelled) setTex(t)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!tex) return null
  return (
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial map={tex} transparent roughness={0.65} />
    </mesh>
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
      <Desk
        x={room.x}
        z={deskZ}
        rotation={0}
        chair={false}
        noteTarget={
          room.ownerUserId
            ? { userId: room.ownerUserId, name: room.name.replace(/^Sala\s+/i, '') }
            : undefined
        }
      />
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
          opacity={room.roomType === 'lounge' ? 0.32 : 0.26}
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
              <meshStandardMaterial color="#f6f2ea" roughness={0.88} />
            </mesh>
            {/* Rodapé */}
            <mesh position={[cx, 0.05, cz]}>
              <boxGeometry args={[sx + 0.015, 0.1, sz + 0.015]} />
              <meshStandardMaterial color="#8b8e95" roughness={0.6} />
            </mesh>
            {/* Faixa de acento na cor da sala */}
            <mesh position={[cx, WALL_H - 0.06, cz]}>
              <boxGeometry args={[sx + 0.01, 0.1, sz + 0.01]} />
              <meshStandardMaterial color={room.color} roughness={0.55} />
            </mesh>
            {/* Vidro */}
            <mesh position={[cx, WALL_H + GLASS_H / 2, cz]}>
              <boxGeometry args={[sx, GLASS_H, Math.min(sz, 0.08)]} />
              <meshStandardMaterial color="#aaccee" transparent opacity={0.18} roughness={0.08} metalness={0.25} />
            </mesh>
          </group>
        )
      })}

      {/* Porta dupla de madeira quando trancada (batente + almofadas + puxadores) */}
      {locked && (
        <group position={[room.x, 0, doorZ]}>
          {/* Batente: ombreiras e verga */}
          <mesh position={[-DOOR_W / 2 + 0.06, 1.0, 0]} castShadow>
            <boxGeometry args={[0.12, 2.0, 0.24]} />
            <meshStandardMaterial color="#4a3826" roughness={0.65} />
          </mesh>
          <mesh position={[DOOR_W / 2 - 0.06, 1.0, 0]} castShadow>
            <boxGeometry args={[0.12, 2.0, 0.24]} />
            <meshStandardMaterial color="#4a3826" roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.95, 0]} castShadow>
            <boxGeometry args={[DOOR_W, 0.1, 0.24]} />
            <meshStandardMaterial color="#4a3826" roughness={0.65} />
          </mesh>
          {/* Folhas da porta */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * (DOOR_W / 2 - 0.12 - 0.585), 0, 0]}>
              <mesh position={[0, 0.95, 0]} castShadow>
                <boxGeometry args={[1.17, 1.9, 0.07]} />
                <meshStandardMaterial map={woodTexture()} color="#8a6544" roughness={0.55} />
              </mesh>
              {/* Almofadas (painéis rebaixados) dos dois lados */}
              {[0.0385, -0.0385].map((zOff) =>
                [0.62, 1.45].map((py) => (
                  <mesh key={`${zOff}:${py}`} position={[0, py, zOff]}>
                    <boxGeometry args={[0.82, py < 1 ? 0.85 : 0.55, 0.012]} />
                    <meshStandardMaterial color="#6b4d31" roughness={0.6} />
                  </mesh>
                ))
              )}
              {/* Puxador dourado vertical (lado do encontro central) */}
              {[0.05, -0.05].map((zOff) => (
                <mesh key={zOff} position={[side * -0.46, 1.02, zOff]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.34, 8]} />
                  <meshStandardMaterial color="#c9a84c" metalness={0.85} roughness={0.25} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Fechadura central */}
          <mesh position={[0, 1.02, 0.045]}>
            <boxGeometry args={[0.05, 0.09, 0.02]} />
            <meshStandardMaterial color="#c9a84c" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* Travessa de vidro acima da porta (alinha com o vidro das paredes) */}
          <mesh position={[0, (2.0 + WALL_H + GLASS_H) / 2, 0]}>
            <boxGeometry args={[DOOR_W, WALL_H + GLASS_H - 2.0, 0.08]} />
            <meshStandardMaterial color="#aaccee" transparent opacity={0.18} roughness={0.08} metalness={0.25} />
          </mesh>
        </group>
      )}

      {/* Relógio de parede nas salas de trabalho/reunião */}
      {(room.roomType === 'sector' || room.roomType === 'meeting') && (
        <WallClock x={room.x + room.width / 2 - 1.1} z={room.z - room.depth / 2 + 0.28} />
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
      {/* Piso geral: porcelanato texturizado */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial
          map={(() => {
            const t = floorTexture()
            t.repeat.set(W / 4, D / 4)
            return t
          })()}
          roughness={0.62}
        />
      </mesh>

      {/* Logomarca oficial UNV no piso do hall central */}
      <FloorLogo />

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

      {/* Faixas de corredor (carpete azul-petróleo) */}
      <mesh position={[cx, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 5]} />
        <meshStandardMaterial
          map={(() => {
            const t = carpetTexture()
            t.repeat.set(12, 1.6)
            return t
          })()}
          roughness={1}
        />
      </mesh>
      <mesh position={[cx, 0.004, 13]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 3]} />
        <meshStandardMaterial
          map={(() => {
            const t = carpetTexture()
            t.repeat.set(12, 1.6)
            return t
          })()}
          roughness={1}
        />
      </mesh>
      {/* Corredor entre as duas fileiras da ala privada */}
      <mesh position={[cx, 0.004, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, 1.6]} />
        <meshStandardMaterial
          map={(() => {
            const t = carpetTexture()
            t.repeat.set(12, 1.6)
            return t
          })()}
          roughness={1}
        />
      </mesh>
      {/* Passagem vertical central da ala privada */}
      <mesh position={[0, 0.005, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.2, 13.6]} />
        <meshStandardMaterial
          map={(() => {
            const t = carpetTexture()
            t.repeat.set(12, 1.6)
            return t
          })()}
          roughness={1}
        />
      </mesh>

      {/* Perímetro do prédio */}
      {/* Paredes externas (norte/leste/oeste claras) */}
      {[
        { x: cx, z: BUILDING.minZ, w: W + 0.4, d: 0.4 },
        { x: BUILDING.minX, z: cz, w: 0.4, d: D + 0.4 },
        { x: BUILDING.maxX, z: cz, w: 0.4, d: D + 0.4 },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, 1.3, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, 2.6, p.d]} />
          <meshStandardMaterial color="#ece8df" roughness={0.88} />
        </mesh>
      ))}

      {/* FACHADA SUL — cores da marca: navy com faixa vermelha, mais alta */}
      <mesh position={[cx, 1.6, BUILDING.maxZ]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, 3.2, 0.4]} />
        <meshStandardMaterial color="#0D2B5E" roughness={0.65} />
      </mesh>
      <mesh position={[cx, 0.45, BUILDING.maxZ + 0.21]}>
        <boxGeometry args={[W + 0.42, 0.22, 0.02]} />
        <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
      </mesh>
      <mesh position={[cx, 3.05, BUILDING.maxZ + 0.21]}>
        <boxGeometry args={[W + 0.42, 0.12, 0.02]} />
        <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
      </mesh>

      {/* Letreiro 3D iluminado com a logomarca */}
      <FacadeSign />

      {/* Porta automática de vidro (abre por proximidade, como em shopping) */}
      <AutoDoor />

      {/* Janelas com luz de dia na fachada norte */}
      {Array.from({ length: 8 }, (_, i) => BUILDING.minX + 4.5 + i * 7).map((wx) => (
        <group key={`win${wx}`}>
          <mesh position={[wx, 1.55, BUILDING.minZ + 0.22]}>
            <boxGeometry args={[3.6, 1.35, 0.05]} />
            <meshStandardMaterial color="#bcd8f0" emissive="#a8cdef" emissiveIntensity={0.55} roughness={0.1} />
          </mesh>
          {/* Caixilho */}
          <mesh position={[wx, 1.55, BUILDING.minZ + 0.25]}>
            <boxGeometry args={[0.06, 1.35, 0.03]} />
            <meshStandardMaterial color="#6b737d" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[wx, 1.55, BUILDING.minZ + 0.25]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.06, 3.6, 0.03]} />
            <meshStandardMaterial color="#6b737d" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
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

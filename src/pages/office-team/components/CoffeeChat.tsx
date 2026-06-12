// Cena de café nas banquetas do lounge: quem senta numa banqueta de mesa
// bistrô ganha uma caneca animada (sobe até a boca, com vapor). Com 2+
// pessoas na mesma mesinha, balões de conversa alternam sobre as cabeças —
// mostrando a última mensagem de chat recente ou "..." de prosa.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import type { OfficeRoom } from '../lib/rooms'

const SEAT_DIST = 0.75 // banqueta fica a 0.75 do centro da mesa (LoungeFurniture)
const MATCH_R = 0.45 // tolerância pra considerar "sentado naquela banqueta"

interface BistroSeat {
  tableKey: string
  tableX: number
  tableZ: number
  x: number
  z: number
}

/** Mesmas posições do LoungeFurniture: 3 mesas bistrô por lounge, 2 banquetas cada. */
function bistroSeatsFor(rooms: OfficeRoom[]): BistroSeat[] {
  const seats: BistroSeat[] = []
  for (const room of rooms) {
    if (room.roomType !== 'lounge') continue
    const right = room.x + room.width / 2
    const tables: [number, number][] = [
      [right - 3, room.z + 0.6],
      [right - 5.4, room.z + 2.2],
      [right - 1.8, room.z + 2.8],
    ]
    for (const [tx, tz] of tables) {
      const tableKey = `${room.id}:${tx.toFixed(1)}:${tz.toFixed(1)}`
      for (const a of [0, Math.PI]) {
        seats.push({ tableKey, tableX: tx, tableZ: tz, x: tx + Math.sin(a) * SEAT_DIST, z: tz + Math.cos(a) * SEAT_DIST })
      }
    }
  }
  return seats
}

interface Sitter {
  id: string
  name: string
  x: number
  z: number
  tableKey: string
  tableX: number
  tableZ: number
}

function seedFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 600) / 100 // 0..6s de defasagem
}

/** Caneca de café animada: descansa na borda da mesa, sobe até a boca, volta. */
function CoffeeSip({ sitter }: { sitter: Sitter }) {
  const cup = useRef<THREE.Group>(null!)
  const steam1 = useRef<THREE.Mesh>(null!)
  const steam2 = useRef<THREE.Mesh>(null!)
  const seed = useMemo(() => seedFor(sitter.id), [sitter.id])

  // Direção pessoa → mesa (caneca fica entre os dois, perto da borda da mesa)
  const dir = useMemo(() => {
    const dx = sitter.tableX - sitter.x
    const dz = sitter.tableZ - sitter.z
    const len = Math.hypot(dx, dz) || 1
    return [dx / len, dz / len] as const
  }, [sitter])

  const restPos: [number, number, number] = [sitter.x + dir[0] * 0.42, 1.05, sitter.z + dir[1] * 0.42]
  const sipPos: [number, number, number] = [sitter.x + dir[0] * 0.16, 1.16, sitter.z + dir[1] * 0.16]

  useFrame(({ clock }) => {
    if (!cup.current) return
    const t = (clock.getElapsedTime() + seed) % 7
    // 0-1s sobe · 1-1.9s bebe · 1.9-2.9s desce · resto descansa na mesa
    let k = 0
    if (t < 1) k = t
    else if (t < 1.9) k = 1
    else if (t < 2.9) k = 1 - (t - 1.9)
    const ease = k * k * (3 - 2 * k) // smoothstep
    cup.current.position.set(
      restPos[0] + (sipPos[0] - restPos[0]) * ease,
      restPos[1] + (sipPos[1] - restPos[1]) * ease,
      restPos[2] + (sipPos[2] - restPos[2]) * ease
    )
    // Vapor só enquanto a caneca descansa
    const resting = k === 0
    const st = clock.getElapsedTime() * 1.4 + seed
    for (const [ref, off] of [
      [steam1, 0],
      [steam2, 1.6],
    ] as const) {
      if (!ref.current) continue
      const phase = (st + off) % 2
      ref.current.visible = resting
      ref.current.position.y = 0.09 + phase * 0.12
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.4 - phase * 0.2)
    }
  })

  return (
    <group ref={cup} position={restPos}>
      {/* Caneca */}
      <mesh castShadow>
        <cylinderGeometry args={[0.042, 0.036, 0.075, 12]} />
        <meshStandardMaterial color="#f2ede4" roughness={0.4} />
      </mesh>
      {/* Café */}
      <mesh position={[0, 0.039, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 0.006, 12]} />
        <meshStandardMaterial color="#3e2714" roughness={0.5} />
      </mesh>
      {/* Alça */}
      <mesh position={[0.048, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.022, 0.007, 6, 12]} />
        <meshStandardMaterial color="#f2ede4" roughness={0.4} />
      </mesh>
      {/* Vapor */}
      <mesh ref={steam1} position={[0.01, 0.1, 0]}>
        <sphereGeometry args={[0.014, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={steam2} position={[-0.012, 0.14, 0.008]}>
        <sphereGeometry args={[0.011, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Placa da área de café: deixa claro que os balões são públicos. */
function CafeSign({ room }: { room: OfficeRoom }) {
  // Sobre o balcão de café (mesma posição do LoungeFurniture)
  const x = room.x + room.width / 2 - 2.4
  const z = room.z - room.depth / 2 + 1.1
  return (
    <group position={[x, 0, z]}>
      {/* Poste */}
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.5} roughness={0.4} />
      </mesh>
      <Billboard position={[0, 2.35, 0]} follow>
        <mesh>
          <planeGeometry args={[2.5, 0.62]} />
          <meshBasicMaterial color="#1a1d24" transparent opacity={0.92} depthWrite={false} />
        </mesh>
        <Text position={[0, 0.14, 0.001]} fontSize={0.15} color="#FFD700" anchorX="center" anchorY="middle">
          ☕ ÁREA DE CAFÉ — PAPO INFORMAL
        </Text>
        <Text position={[0, -0.13, 0.001]} fontSize={0.095} color="#e8e8e8" anchorX="center" anchorY="middle" maxWidth={2.3} textAlign="center">
          As conversas aqui aparecem em balões visíveis pra todo mundo
        </Text>
      </Billboard>
    </group>
  )
}

/** Balão de conversa alternando entre os sentados da mesma mesinha. */
function TableChat({ sitters }: { sitters: Sitter[] }) {
  const chatMessages = useTeamStore((s) => s.chatMessages)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const i = setInterval(() => setTick((v) => v + 1), 450)
    return () => clearInterval(i)
  }, [])
  void tick

  const now = Date.now()
  const turn = Math.floor(now / 3500) % sitters.length
  const speaker = sitters[turn]
  if (!speaker) return null

  // Mensagem real recente do falante (chat de texto) ou "..." de prosa
  const lastMsg = [...chatMessages].reverse().find((m) => m.userId === speaker.id && now - m.timestamp < 12_000)
  const dots = '.'.repeat(1 + (Math.floor(now / 450) % 3))
  let text = lastMsg ? lastMsg.content : dots
  if (text.length > 64) text = `${text.slice(0, 62)}…`
  const isDots = !lastMsg
  const bubbleW = isDots ? 0.42 : Math.min(1.7, 0.34 + text.length * 0.052)

  return (
    <Billboard position={[speaker.x, 2.0, speaker.z]} follow>
      {/* Caixinha */}
      <mesh>
        <planeGeometry args={[bubbleW, isDots ? 0.3 : 0.42]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94} depthWrite={false} />
      </mesh>
      {/* Rabinho do balão */}
      <mesh position={[0, isDots ? -0.21 : -0.27, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.05, 0.12, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94} depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0, 0.001]}
        fontSize={isDots ? 0.16 : 0.095}
        color="#1a1d24"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.55}
        textAlign="center"
      >
        {text}
      </Text>
    </Billboard>
  )
}

export default function CoffeeChat() {
  const rooms = useTeamStore((s) => s.rooms)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)
  const seated = useTeamStore((s) => s.seated)
  const playerPosition = useTeamStore((s) => s.playerPosition)

  const seats = useMemo(() => bistroSeatsFor(rooms), [rooms])

  // Sentou numa banqueta → lembra na hora que a conversa aqui é pública
  const meInBistro =
    !!me && seated && seats.some((s) => Math.hypot(playerPosition[0] - s.x, playerPosition[2] - s.z) < MATCH_R)
  const wasInBistro = useRef(false)
  useEffect(() => {
    if (meInBistro && !wasInBistro.current) {
      useTeamStore
        .getState()
        .addToast('☕ Área de café: os balões de conversa são visíveis pra todo mundo — papo informal', 'in')
    }
    wasInBistro.current = meInBistro
  }, [meInBistro])

  // Quem está sentado em qual banqueta (local + remotos)
  const sitters: Sitter[] = []
  const tryMatch = (id: string, name: string, px: number, pz: number) => {
    for (const seat of seats) {
      if (Math.hypot(px - seat.x, pz - seat.z) < MATCH_R) {
        sitters.push({ id, name, x: seat.x, z: seat.z, tableKey: seat.tableKey, tableX: seat.tableX, tableZ: seat.tableZ })
        return
      }
    }
  }
  if (me && seated) tryMatch(me.id, me.name, playerPosition[0], playerPosition[2])
  for (const p of Object.values(remotePlayers)) {
    if (p.sitting) tryMatch(p.id, p.name, p.position[0], p.position[2])
  }

  // Agrupa por mesa pro balão de conversa
  const byTable = new Map<string, Sitter[]>()
  for (const s of sitters) {
    const list = byTable.get(s.tableKey) ?? []
    list.push(s)
    byTable.set(s.tableKey, list)
  }

  return (
    <>
      {rooms
        .filter((r) => r.roomType === 'lounge')
        .map((r) => (
          <CafeSign key={r.id} room={r} />
        ))}
      {sitters.map((s) => (
        <CoffeeSip key={s.id} sitter={s} />
      ))}
      {[...byTable.entries()]
        .filter(([, list]) => list.length >= 2)
        .map(([key, list]) => (
          <TableChat key={key} sitters={list.sort((a, b) => a.id.localeCompare(b.id))} />
        ))}
    </>
  )
}

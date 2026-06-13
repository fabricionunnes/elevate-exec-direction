// NPC Marcelo Almeida — agente consultor comercial IA, mora na sala
// "Marcelo Almeida". Fica sentado na cadeira dele trabalhando e, de tempos
// em tempos, levanta pra ir ao café/lounge ou dar uma volta (pathfinding).
// A rotina é derivada do relógio (slots determinísticos), então todos os
// clientes veem o Marcelo no mesmo lugar. Clique nele (ou E perto) = chat.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import RobotBody from './RobotBody'
import { useTeamStore } from '../store/useTeamStore'
import { personalOwnerSeat } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'
import { npcObstacles, personAvoidance } from '../lib/npcNav'
import { agentPosState } from './AgentNpc'
import { CoffeeSip } from './CoffeeChat'
import type { OfficeRoom } from '../lib/rooms'

const INTERACT_RADIUS = 3
const WALK_SPEED = 2.2
const CYCLE = 360 // segundos por ciclo de rotina
const SUMMON_TTL = 150_000 // tempo que o Marcelo fica atendendo um aceno

/** Posição/estado atual do NPC (pra colisão e cadeira ocupada). */
export const marceloState = { x: 0, z: 0, sitting: false, active: false }

export function findMarceloRoom(rooms: OfficeRoom[]): OfficeRoom | null {
  return rooms.find((r) => /marcelo/i.test(r.name)) ?? null
}

function slotHash(slot: number): number {
  let h = slot >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

type Pose = 'sit' | 'stand' | 'walk'

export default function MarceloNpc() {
  const rooms = useTeamStore((s) => s.rooms)
  const setNpcChatOpen = useTeamStore((s) => s.setNpcChatOpen)
  const groupRef = useRef<THREE.Group>(null!)
  const hintRef = useRef<THREE.Group>(null!)
  const phaseRef = useRef('')
  const pathRef = useRef<{ pts: [number, number][]; i: number } | null>(null)
  const rotRef = useRef(Math.PI)
  const [pose, setPose] = useState<Pose>('sit')
  const poseRef = useRef<Pose>('sit')
  const summon = useTeamStore((s) => s.agentSummon)

  const room = findMarceloRoom(rooms)
  const seat = room ? personalOwnerSeat(room) : null

  // Destinos dos passeios (café/lounge/corredor), calculados das salas
  const dests = useMemo(() => {
    const lounge = rooms.find((r) => r.roomType === 'lounge')
    const out: [number, number][] = [
      [0, 0],
      [-10, 0.5],
    ]
    if (lounge) {
      out.push(
        [lounge.x + lounge.width / 2 - 2.6, lounge.z - lounge.depth / 2 + 2.4], // balcão de café
        [lounge.x - lounge.width / 2 + 4.2, lounge.z + 0.6], // perto dos sofás
        [lounge.x + lounge.width / 2 - 4.2, lounge.z + 1.8] // mesas bistrô
      )
    }
    return out
  }, [rooms])

  const setPoseIfChanged = (p: Pose) => {
    if (poseRef.current !== p) {
      poseRef.current = p
      setPose(p)
    }
  }

  // Tecla E perto do Marcelo (onde ele estiver) abre o chat
  useEffect(() => {
    if (!room) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (!groupRef.current) return
      const [px, , pz] = useTeamStore.getState().playerPosition
      const dist = Math.hypot(px - groupRef.current.position.x, pz - groupRef.current.position.z)
      if (dist < INTERACT_RADIUS) setNpcChatOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, setNpcChatOpen])

  useFrame((_, delta) => {
    if (!room || !seat || !groupRef.current) return
    const g = groupRef.current

    const walkStep = (tx: number, tz: number, key: string) => {
      if (key !== phaseRef.current) {
        phaseRef.current = key
        const walls = npcObstacles(g.position.x, g.position.z)
        const pts = findPath(g.position.x, g.position.z, tx, tz, walls)
        pathRef.current = pts ? { pts, i: 0 } : null
      }
      const path = pathRef.current
      if (!path) return false
      const [wx, wz] = path.pts[path.i]
      const dx = wx - g.position.x
      const dz = wz - g.position.z
      const d = Math.hypot(dx, dz)
      const isLast = path.i === path.pts.length - 1
      if (d < (isLast ? 0.5 : 0.15)) {
        path.i++
        if (path.i >= path.pts.length) pathRef.current = null
      } else {
        const step = Math.min(d, WALK_SPEED * delta)
        const [avx, avz] = personAvoidance(g.position.x, g.position.z)
        g.position.x += (dx / d) * step + avx * delta
        g.position.z += (dz / d) * step + avz * delta
        const a = Math.atan2(dx, dz)
        let diff = a - rotRef.current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        rotRef.current += diff * 0.18
        g.rotation.y = rotRef.current
      }
      setPoseIfChanged('walk')
      return true
    }

    const expose = () => {
      marceloState.x = g.position.x
      marceloState.z = g.position.z
      marceloState.sitting = poseRef.current === 'sit'
      marceloState.active = true
      agentPosState['marcelo'] = { x: g.position.x, z: g.position.z }
      if (hintRef.current) {
        const [px, , pz] = useTeamStore.getState().playerPosition
        hintRef.current.visible = Math.hypot(px - g.position.x, pz - g.position.z) < INTERACT_RADIUS
      }
    }

    // ── Aceno: alguém chamou o Marcelo (mesmo sistema dos outros agentes) ──
    const summon = useTeamStore.getState().agentSummon
    if (summon && summon.agentKey === 'marcelo' && Date.now() - summon.ts < SUMMON_TTL) {
      const target = summon.seat ?? { x: summon.x + 0.9, z: summon.z + 0.4 }
      if (!walkStep(target.x, target.z, `summon:${summon.ts}`)) {
        if (Math.hypot(g.position.x - target.x, g.position.z - target.z) > 0.6) {
          g.position.set(target.x, 0, target.z)
        }
        if (summon.seat) {
          g.position.set(summon.seat.x, 0, summon.seat.z)
          rotRef.current = summon.seat.rot ?? Math.atan2(summon.seat.tableX - summon.seat.x, summon.seat.tableZ - summon.seat.z)
          g.rotation.y = rotRef.current
          setPoseIfChanged('sit')
        } else {
          rotRef.current = Math.atan2(summon.x - g.position.x, summon.z - g.position.z)
          g.rotation.y = rotRef.current
          setPoseIfChanged('stand')
        }
      }
      expose()
      return
    }

    // Rotina determinística pelo relógio: todos os clientes veem igual
    const nowS = Date.now() / 1000
    const slot = Math.floor(nowS / CYCLE)
    const t = nowS % CYCLE
    const h = slotHash(slot)
    const staySeated = h % 3 === 0 // 1 em cada 3 ciclos ele nem levanta
    const dest = dests[h % dests.length]

    let phase: 'sit' | 'go' | 'visit' | 'back'
    if (staySeated || t < 200) phase = 'sit'
    else if (t < 235) phase = 'go'
    else if (t < 325) phase = 'visit'
    else phase = 'back'

    const phaseKey = `${slot}:${phase}`
    if (phaseKey !== phaseRef.current) {
      phaseRef.current = phaseKey
      // Obstáculos completos: paredes + mobília + pessoas
      const walls = npcObstacles(g.position.x, g.position.z)
      if (phase === 'go') {
        const pts = findPath(g.position.x, g.position.z, dest[0], dest[1], walls)
        pathRef.current = pts ? { pts, i: 0 } : null
      } else if (phase === 'back') {
        const pts = findPath(g.position.x, g.position.z, seat.x, seat.z, walls)
        pathRef.current = pts ? { pts, i: 0 } : null
      } else {
        pathRef.current = null
      }
    }

    // Segue o caminho (se houver)
    const path = pathRef.current
    if (path) {
      const [wx, wz] = path.pts[path.i]
      const dx = wx - g.position.x
      const dz = wz - g.position.z
      const d = Math.hypot(dx, dz)
      const isLast = path.i === path.pts.length - 1
      if (d < (isLast ? 0.5 : 0.15)) {
        path.i++
        if (path.i >= path.pts.length) pathRef.current = null
      } else {
        const step = Math.min(d, WALK_SPEED * delta)
        const [avx, avz] = personAvoidance(g.position.x, g.position.z)
        g.position.x += (dx / d) * step + avx * delta
        g.position.z += (dz / d) * step + avz * delta
        const targetAngle = Math.atan2(dx, dz)
        let diff = targetAngle - rotRef.current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        rotRef.current += diff * 0.18
        g.rotation.y = rotRef.current
      }
      setPoseIfChanged('walk')
    } else if (phase === 'sit') {
      // Garante no assento (snap pra quem montou no meio do ciclo)
      if (Math.hypot(g.position.x - seat.x, g.position.z - seat.z) > 0.25) {
        g.position.set(seat.x, 0, seat.z)
      }
      rotRef.current = seat.rot
      g.rotation.y = seat.rot
      setPoseIfChanged('sit')
    } else if (phase === 'visit' || phase === 'go') {
      // Sem caminho (falhou ou já chegou): fica no destino em pé
      if (phase === 'visit' && Math.hypot(g.position.x - dest[0], g.position.z - dest[1]) > 3) {
        g.position.set(dest[0], 0, dest[1])
      }
      setPoseIfChanged('stand')
    } else {
      setPoseIfChanged('stand')
    }

    // Dica "aperte E" visível só com o jogador perto
    if (hintRef.current) {
      const [px, , pz] = useTeamStore.getState().playerPosition
      hintRef.current.visible = Math.hypot(px - g.position.x, pz - g.position.z) < INTERACT_RADIUS
    }

    // Exposição pra colisão jogador-NPC e checagem de cadeira ocupada
    marceloState.x = g.position.x
    marceloState.z = g.position.z
    marceloState.sitting = poseRef.current === 'sit'
    marceloState.active = true
    agentPosState['marcelo'] = { x: g.position.x, z: g.position.z }
  })

  if (!room || !seat) return null

  // Caneca quando o Marcelo é chamado pro café (o balão da fala é desenhado
  // pelo SummonTalk genérico, que usa agentPosState['marcelo'])
  const showCoffee =
    summon?.agentKey === 'marcelo' && summon.context === 'cafe' && !!summon.seat && pose === 'sit'

  return (
    <>
    {showCoffee && summon?.seat && (
      <CoffeeSip
        sitter={{
          id: 'agent-marcelo',
          name: 'Marcelo',
          x: summon.seat.x,
          z: summon.seat.z,
          tableKey: summon.seat.tableKey,
          tableX: summon.seat.tableX,
          tableZ: summon.seat.tableZ,
        }}
      />
    )}
    <group
      ref={groupRef}
      position={[seat.x, 0, seat.z]}
      rotation={[0, Math.PI, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return // arrasto de câmera, não clique
        setNpcChatOpen(true)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <RobotBody isWalking={pose === 'walk'} isSitting={pose === 'sit'} />

      <Billboard position={[0, 2.25, 0]} follow={true}>
        <Text
          fontSize={0.26}
          color="#7fd4ff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          Marcelo Almeida
        </Text>
      </Billboard>
      <Billboard position={[0, 2.0, 0]} follow={true}>
        <Text
          fontSize={0.15}
          color="#c8d4e8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          Consultor · IA
        </Text>
      </Billboard>

      {/* Dica de interação (visível só de perto) */}
      <group ref={hintRef} visible={false}>
        <Billboard position={[0, 2.55, 0]} follow={true}>
          <Text
            fontSize={0.18}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            💬 aperte E pra conversar
          </Text>
        </Billboard>
      </group>

      {/* Anel de "sempre online" */}
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 16]} />
        <meshBasicMaterial color="#7fd4ff" transparent opacity={0.65} />
      </mesh>
    </group>
    </>
  )
}

// Agentes IA da UNV como robôs no escritório — cada um tem posto na sala do
// seu setor e, de tempos em tempos, sai pra dar uma volta (café, corredor,
// lounge) com pathfinding. A rotina é derivada do relógio com defasagem por
// agente, então todos os clientes veem cada agente no mesmo lugar.
// Clique abre o chat (com checagem de permissão no servidor; o master define
// quem pode falar com cada um no próprio painel).
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { OFFICE_AGENTS, OfficeAgent } from '../lib/agents'
import { buildCollisionWalls } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'
import RobotBody from './RobotBody'

const CYCLE = 360 // segundos por ciclo de rotina

function slotHash(slot: number): number {
  let h = slot >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

type Pose = 'stand' | 'walk'

function AgentFigure({
  agent,
  baseX,
  baseZ,
  idx,
  dests,
}: {
  agent: OfficeAgent
  baseX: number
  baseZ: number
  idx: number
  dests: [number, number][]
}) {
  const setAgentChatFor = useTeamStore((s) => s.setAgentChatFor)
  const groupRef = useRef<THREE.Group>(null!)
  const phaseRef = useRef('')
  const pathRef = useRef<{ pts: [number, number][]; i: number } | null>(null)
  const rotRef = useRef(0)
  const [pose, setPose] = useState<Pose>('stand')
  const poseRef = useRef<Pose>('stand')
  const walkSpeed = 1.9 + (idx % 3) * 0.15

  const setPoseIfChanged = (p: Pose) => {
    if (poseRef.current !== p) {
      poseRef.current = p
      setPose(p)
    }
  }

  useFrame((_, delta) => {
    if (!groupRef.current || dests.length === 0) return
    const g = groupRef.current

    // Rotina pelo relógio, defasada por agente (não saem todos juntos)
    const nowS = Date.now() / 1000 + idx * 53
    const slot = Math.floor(nowS / CYCLE)
    const t = nowS % CYCLE
    const h = slotHash(slot * 31 + idx * 7919)
    const stayHome = h % 3 === 0 // 1 em cada 3 ciclos fica no posto
    const dest = dests[h % dests.length]

    let phase: 'home' | 'go' | 'visit' | 'back'
    if (stayHome || t < 200) phase = 'home'
    else if (t < 235) phase = 'go'
    else if (t < 325) phase = 'visit'
    else phase = 'back'

    const phaseKey = `${slot}:${phase}`
    if (phaseKey !== phaseRef.current) {
      phaseRef.current = phaseKey
      const state = useTeamStore.getState()
      const onlineIds = new Set(Object.keys(state.remotePlayers))
      if (state.me) onlineIds.add(state.me.id)
      const walls = buildCollisionWalls(state.rooms, onlineIds, null)
      if (phase === 'go') {
        const pts = findPath(g.position.x, g.position.z, dest[0], dest[1], walls)
        pathRef.current = pts ? { pts, i: 0 } : null
      } else if (phase === 'back') {
        const pts = findPath(g.position.x, g.position.z, baseX, baseZ, walls)
        pathRef.current = pts ? { pts, i: 0 } : null
      } else {
        pathRef.current = null
      }
    }

    const path = pathRef.current
    if (path) {
      const [wx, wz] = path.pts[path.i]
      const dx = wx - g.position.x
      const dz = wz - g.position.z
      const d = Math.hypot(dx, dz)
      if (d < 0.15) {
        path.i++
        if (path.i >= path.pts.length) pathRef.current = null
      } else {
        const step = Math.min(d, walkSpeed * delta)
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        const targetAngle = Math.atan2(dx, dz)
        let diff = targetAngle - rotRef.current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        rotRef.current += diff * 0.18
        g.rotation.y = rotRef.current
      }
      setPoseIfChanged('walk')
    } else if (phase === 'home') {
      // Snap pro posto (quem montou no meio do ciclo, ou path falhou)
      if (Math.hypot(g.position.x - baseX, g.position.z - baseZ) > 0.25) {
        g.position.set(baseX, 0, baseZ)
      }
      setPoseIfChanged('stand')
    } else {
      // Visitando (ou path falhou no go): fica em pé onde está
      if (phase === 'visit' && Math.hypot(g.position.x - dest[0], g.position.z - dest[1]) > 3) {
        g.position.set(dest[0], 0, dest[1])
      }
      setPoseIfChanged('stand')
    }
  })

  return (
    <group ref={groupRef} position={[baseX, 0, baseZ]}>
      <group
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          setAgentChatFor(agent.key)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <RobotBody body={agent.body} accent={agent.accent} isWalking={pose === 'walk'} />
        {/* hitbox generosa pro clique */}
        <mesh position={[0, 0.95, 0]} visible={false}>
          <boxGeometry args={[0.9, 1.9, 0.9]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
      <Billboard position={[0, 2.22, 0]} follow>
        <Text fontSize={0.165} color="#ffffff" outlineWidth={0.014} outlineColor="#000000" anchorX="center">
          🤖 {agent.name}
        </Text>
      </Billboard>
      <Billboard position={[0, 2.0, 0]} follow>
        <Text fontSize={0.115} color={agent.accent} outlineWidth={0.011} outlineColor="#000000" anchorX="center">
          {agent.title}
        </Text>
      </Billboard>
    </group>
  )
}

export default function AgentNpcs() {
  const rooms = useTeamStore((s) => s.rooms)

  // Posto de cada agente: fundo da sala do seu setor, longe da TV central
  const placed = useMemo(() => {
    return OFFICE_AGENTS.flatMap((agent, idx) => {
      const room = rooms.find((r) => r.roomType === 'sector' && r.sector === agent.sector)
      if (!room) return []
      const x = agent.slot === 0 ? room.x - room.width / 2 + 1.5 : room.x + room.width / 2 - 1.5
      const z = room.z - room.depth / 2 + 1.1
      return [{ agent, x, z, idx }]
    })
  }, [rooms])

  // Destinos dos passeios (áreas abertas: corredor, café, lounge)
  const dests = useMemo<[number, number][]>(() => {
    const lounge = rooms.find((r) => r.roomType === 'lounge')
    const out: [number, number][] = [
      [0, 0.5],
      [-10, 0.5],
      [8, 0.5],
      [-2, 13],
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

  return (
    <>
      {placed.map(({ agent, x, z, idx }) => (
        <AgentFigure key={agent.key} agent={agent} baseX={x} baseZ={z} idx={idx} dests={dests} />
      ))}
    </>
  )
}

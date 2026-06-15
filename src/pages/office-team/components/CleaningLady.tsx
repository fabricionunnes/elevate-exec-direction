// Tia Cleide — faxineira fofoqueira (NPC ambiente). Varre o corredor/área
// aberta o dia todo (rota determinística pelo relógio, NUNCA entra em sala),
// e conversa por balão + voz do navegador (Web Speech API, zero token) com
// quem passa perto. Não atrapalha reunião nem sala privada porque ela fica
// fisicamente fora das salas e a voz só toca pra quem está na área aberta.
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import HumanBody from './HumanBody'
import { SpeechBubble } from './CoffeeChat'
import { useTeamStore, AvatarConfig } from '../store/useTeamStore'
import { roomAt } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'
import { cleaningObstacles, personAvoidance } from '../lib/npcNav'
import { gossipLine, speakGossip } from '../lib/gossip'

const WALK_SPEED = 1.1 // devagar, varrendo
const WP_SECONDS = 13 // tempo em cada ponto de varrição
const NEAR_BUBBLE = 4.2 // mostra balão se alguém está a essa distância
const NEAR_VOICE = 4.5 // fala em voz alta pro jogador local a essa distância

// Aparência da Tia Cleide: cabelo preso (coque), avental, pele morena
const CLEIDE: AvatarConfig = {
  skin: '#c68642',
  hairStyle: 'bun',
  hairColor: '#3a2e22',
  shirt: '#1f7a52', // avental verde
  pants: '#3d4f5c',
  facialHair: 'none',
}

// Pontos de varrição — TODOS em corredor/área aberta (fora de qualquer sala).
// Corredor central (z≈0.5, entre setores e reuniões) + corredor de baixo
// (z≈13, entre reuniões e salas pessoais).
const SWEEP_POINTS: [number, number][] = [
  [-24, 0.5], [-16, 0.5], [-8, 0.5], [0, 0.5], [8, 0.5], [16, 0.5], [24, 0.5],
  [24, 13], [14, 13], [2, 13], [-10, 13], [-24, 13],
]

export default function CleaningLady() {
  const groupRef = useRef<THREE.Group>(null!)
  const pathRef = useRef<{ pts: [number, number][]; i: number } | null>(null)
  const rotRef = useRef(0)
  const wpRef = useRef(-1)
  const [walking, setWalking] = useState(false)
  const walkingRef = useRef(false)
  const lastSpokeIdx = useRef(-1)

  // Fala atual (muda a cada ~9s; mesma pra todos)
  const [line, setLine] = useState(() => gossipLine())
  const lineRef = useRef(line)
  lineRef.current = line

  const broomMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.8 }), [])

  // alguém (qualquer player online) perto dela?
  const someoneNear = (gx: number, gz: number): number => {
    const st = useTeamStore.getState()
    let best = Infinity
    const check = (px: number, pz: number) => {
      const d = Math.hypot(px - gx, pz - gz)
      if (d < best) best = d
    }
    const [mx, , mz] = st.playerPosition
    check(mx, mz)
    for (const p of Object.values(st.remotePlayers)) check(p.position[0], p.position[2])
    return best
  }

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    const st = useTeamStore.getState()
    if (st.rooms.length === 0) return

    // Ponto de varrição atual (determinístico pelo relógio)
    const slot = Math.floor(Date.now() / 1000 / WP_SECONDS)
    const wpIdx = slot % SWEEP_POINTS.length
    if (wpIdx !== wpRef.current) {
      wpRef.current = wpIdx
      const [tx, tz] = SWEEP_POINTS[wpIdx]
      const walls = cleaningObstacles(g.position.x, g.position.z)
      const pts = findPath(g.position.x, g.position.z, tx, tz, walls)
      pathRef.current = pts ? { pts, i: 0 } : null
    }

    // Segue a rota
    const path = pathRef.current
    let moving = false
    if (path) {
      const [wx, wz] = path.pts[path.i]
      const dx = wx - g.position.x
      const dz = wz - g.position.z
      const d = Math.hypot(dx, dz)
      const isLast = path.i === path.pts.length - 1
      if (d < (isLast ? 0.3 : 0.15)) {
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
        rotRef.current += diff * 0.16
        g.rotation.y = rotRef.current
        moving = true
      }
    }
    if (moving !== walkingRef.current) {
      walkingRef.current = moving
      setWalking(moving)
    }

    // Atualiza a fala (muda a cada ~9s) + voz pro jogador local que estiver perto
    const cur = gossipLine()
    if (cur.idx !== lineRef.current.idx) setLine(cur)

    // Voz alta SÓ pro jogador local quando ele está na ÁREA ABERTA e perto
    // (se ele está numa sala/reunião, a Tia não incomoda)
    const [mx, , mz] = st.playerPosition
    const meRoom = roomAt(mx, mz, st.rooms)
    const meInOpen = !meRoom || meRoom.roomType === 'lounge'
    const distToMe = Math.hypot(mx - g.position.x, mz - g.position.z)
    if (cur.idx !== lastSpokeIdx.current && meInOpen && distToMe < NEAR_VOICE && !st.me?.isGuest) {
      lastSpokeIdx.current = cur.idx
      speakGossip(cur.text)
    }
  })

  // Balão só quando tem gente por perto (senão ela varre caladinha)
  const nearDist = groupRef.current ? someoneNear(groupRef.current.position.x, groupRef.current.position.z) : Infinity
  const showBubble = nearDist < NEAR_BUBBLE

  return (
    <>
      <group ref={groupRef} position={[0, 0, 0.5]}>
        <HumanBody avatar={CLEIDE} isWalking={walking} />
        {/* Vassoura na mão direita */}
        <group position={[0.34, 0, 0.18]} rotation={[0.32, 0, -0.12]}>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 1.35, 8]} />
            <primitive object={broomMat} attach="material" />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.18]} />
            <meshStandardMaterial color="#caa45a" roughness={0.85} />
          </mesh>
        </group>
        <Billboard position={[0, 2.18, 0]} follow>
          <Text fontSize={0.16} color="#ffffff" outlineWidth={0.014} outlineColor="#000000" anchorX="center">
            🧹 Tia Cleide
          </Text>
        </Billboard>
        <Billboard position={[0, 1.98, 0]} follow>
          <Text fontSize={0.105} color="#9fe0c0" outlineWidth={0.011} outlineColor="#000000" anchorX="center">
            Faxineira · fofoca em dia
          </Text>
        </Billboard>
      </group>
      {showBubble && groupRef.current && (
        <SpeechBubble
          x={groupRef.current.position.x}
          z={groupRef.current.position.z}
          y={2.45}
          text={line.text}
          isDots={false}
        />
      )}
    </>
  )
}

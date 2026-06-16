// Tia Cleide — faxineira fofoqueira (NPC ambiente). Varre o corredor/área
// aberta o dia todo (rota determinística pelo relógio, NUNCA entra em sala),
// e conversa por balão + voz do navegador (Web Speech API, zero token) com
// quem passa perto. Não atrapalha reunião nem sala privada porque ela fica
// fisicamente fora das salas e a voz só toca pra quem está na área aberta.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import HumanBody from './HumanBody'
import { SpeechBubble } from './CoffeeChat'
import { useTeamStore, AvatarConfig } from '../store/useTeamStore'
import { roomAt, BUILDING } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'
import { cleaningObstacles, personAvoidance } from '../lib/npcNav'
import { gossipLine, farewellLine, speakGossip } from '../lib/gossip'
import { getCafeNames } from '../lib/cafeDialogues'

const WALK_SPEED = 1.1 // devagar, varrendo
const WP_SECONDS = 13 // tempo em cada ponto de varrição
const NEAR_BUBBLE = 4.2 // mostra balão se alguém está a essa distância
const NEAR_VOICE = 4.5 // fala em voz alta pro jogador local a essa distância
const VISIT_MS = 26_000 // tempo CURTO que ela fica fofocando no café
const COOLDOWN_MS = 95_000 // depois disso volta a trabalhar e só retorna depois

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
  const broomRef = useRef<THREE.Group>(null!)
  const pathRef = useRef<{ pts: [number, number][]; i: number } | null>(null)
  const rotRef = useRef(0)
  const wpRef = useRef(-1)
  const destRef = useRef<[number, number] | null>(null) // destino atual (sweep ou café)
  const [walking, setWalking] = useState(false)
  const walkingRef = useRef(false)
  const lastSpokeIdx = useRef(-1)
  // Mudo da Tia (individual, salvo no navegador) — clica nela pra alternar
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('tia-cleide-muted') === '1'
    } catch {
      return false
    }
  })
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const toggleMute = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    const next = !mutedRef.current
    setMuted(next) // sem efeitos colaterais dentro do updater
    try {
      localStorage.setItem('tia-cleide-muted', next ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (next && 'speechSynthesis' in window) speechSynthesis.cancel()
    useTeamStore
      .getState()
      .addToast(next ? '🔇 Tia Cleide no mudo (pra você)' : '🔊 Tia Cleide voltou a falar', next ? 'out' : 'in')
  }

  // Café: visita curta → despedida → cooldown
  const cafePhaseRef = useRef<'sweep' | 'cafe' | 'cooldown'>('sweep')
  const phaseUntilRef = useRef(0)
  const partingRef = useRef<{ text: string; until: number } | null>(null)
  const partingSpokeRef = useRef(true)

  // Nomes reais do time, pra ela tirar sarro de quem ela conhece
  const staffRef = useRef<string[]>([])
  useEffect(() => {
    let cancelled = false
    const load = () => void getCafeNames().then((n) => !cancelled && (staffRef.current = n.staff))
    load()
    const iv = setInterval(load, 600_000)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [])

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

  useFrame(({ clock }, delta) => {
    const g = groupRef.current
    if (!g) return
    const st = useTeamStore.getState()
    if (st.rooms.length === 0) return

    try {
    // Vassoura SEMPRE varrendo (vai-e-vem), trabalhe parada ou andando
    if (broomRef.current) {
      broomRef.current.rotation.z = -0.12 + Math.sin(clock.getElapsedTime() * 4.5) * 0.28
    }

    // Tem gente no café/lounge?
    const lounge = st.rooms.find((r) => r.roomType === 'lounge')
    let cafeTarget: [number, number] | null = null
    let cafePeople = 0
    if (lounge) {
      let sx = 0
      let sz = 0
      const consider = (px: number, pz: number) => {
        if (roomAt(px, pz, st.rooms)?.id === lounge.id) {
          sx += px
          sz += pz
          cafePeople++
        }
      }
      const [mx0, , mz0] = st.playerPosition
      consider(mx0, mz0)
      for (const p of Object.values(st.remotePlayers)) consider(p.position[0], p.position[2])
      if (cafePeople > 0) cafeTarget = [sx / cafePeople, sz / cafePeople]
    }

    // Máquina de estados do café: visita CURTA, despede com piada, cooldown.
    const now = Date.now()
    if (cafePhaseRef.current === 'cooldown' && now > phaseUntilRef.current) {
      cafePhaseRef.current = 'sweep'
    }
    if (cafePhaseRef.current === 'sweep' && cafeTarget) {
      cafePhaseRef.current = 'cafe'
      phaseUntilRef.current = now + VISIT_MS // fica pouco tempo
    }
    if (cafePhaseRef.current === 'cafe' && (!cafeTarget || now > phaseUntilRef.current)) {
      // Sai jogando a piadinha e entra em cooldown (não volta tão cedo)
      partingRef.current = { text: farewellLine(staffRef.current), until: now + 6000 }
      partingSpokeRef.current = false
      cafePhaseRef.current = 'cooldown'
      phaseUntilRef.current = now + COOLDOWN_MS
      wpRef.current = -1
    }

    // Define o destino: café (durante a visita) ou ponto de varrição
    let dest: [number, number]
    if (cafePhaseRef.current === 'cafe' && cafeTarget) {
      // para um pouquinho antes pra não ficar em cima das pessoas
      const dx = g.position.x - cafeTarget[0]
      const dz = g.position.z - cafeTarget[1]
      const d = Math.hypot(dx, dz) || 1
      dest = [cafeTarget[0] + (dx / d) * 1.3, cafeTarget[1] + (dz / d) * 1.3]
      wpRef.current = -1 // ao voltar, recalcula a varrição
    } else {
      const slot = Math.floor(Date.now() / 1000 / WP_SECONDS)
      const wpIdx = slot % SWEEP_POINTS.length
      if (wpIdx !== wpRef.current) wpRef.current = wpIdx
      dest = SWEEP_POINTS[wpIdx]
    }

    // (Re)calcula a rota quando o destino muda de forma relevante
    const prev = destRef.current
    if (!prev || Math.hypot(prev[0] - dest[0], prev[1] - dest[1]) > 1) {
      destRef.current = dest
      const walls = cleaningObstacles(g.position.x, g.position.z)
      const pts = findPath(g.position.x, g.position.z, dest[0], dest[1], walls)
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

    // Rede de segurança: nunca deixa a posição virar NaN ou sair do prédio
    // (senão ela "some" — fica fora da câmera ou some por transform inválido)
    if (!Number.isFinite(g.position.x) || !Number.isFinite(g.position.z)) {
      g.position.set(0, 0, 0.5)
      pathRef.current = null
      destRef.current = null
    } else {
      g.position.x = Math.min(BUILDING.maxX - 1, Math.max(BUILDING.minX + 1, g.position.x))
      g.position.z = Math.min(BUILDING.maxZ - 1, Math.max(BUILDING.minZ + 1, g.position.z))
    }

    // Despedida em andamento tem prioridade na fala; senão a fala normal
    const parting = partingRef.current && now < partingRef.current.until ? partingRef.current : null
    const cur = gossipLine(staffRef.current)
    if (!parting && cur.idx !== lineRef.current.idx) setLine(cur)
    if (parting && lineRef.current.text !== parting.text) setLine({ idx: -now, text: parting.text })

    // Voz: TODO MUNDO que está por perto ouve (cada navegador toca o seu).
    // Vale se o jogador local está na MESMA sala aberta que a Tia (ex.: café)
    // OU perto dela no corredor. Quem está em sala/reunião fechada não ouve.
    const [mx, , mz] = st.playerPosition
    const meRoom = roomAt(mx, mz, st.rooms)
    const herRoom = roomAt(g.position.x, g.position.z, st.rooms)
    const meInOpen = !meRoom || meRoom.roomType === 'lounge'
    const distToMe = Math.hypot(mx - g.position.x, mz - g.position.z)
    const sameOpenRoom = !!herRoom && herRoom.roomType === 'lounge' && meRoom?.id === herRoom.id
    const canHear = !mutedRef.current && meInOpen && !st.me?.isGuest && (sameOpenRoom || distToMe < NEAR_VOICE)
    const meFirst = (st.me?.name ?? '').split(' ')[0]
    // Chama pelo nome só de vez em quando (não em toda frase); pula se a
    // própria frase já cita alguém (evita "Fabrício, Eva e Natallia...").
    const withName = (text: string, withVocative: boolean) =>
      withVocative && meFirst ? `${meFirst}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text

    if (parting && !partingSpokeRef.current && canHear) {
      partingSpokeRef.current = true
      speakGossip(withName(parting.text, false))
    } else if (!parting && cur.idx !== lastSpokeIdx.current && canHear) {
      lastSpokeIdx.current = cur.idx
      // ~1 em cada 3 falas usa o vocativo, e nunca quando a fala já tem nome
      const hasName = /[A-ZÀ-Ý][a-zà-ÿ]+/.test(cur.text) && staffRef.current.some((n) => cur.text.includes(n))
      speakGossip(withName(cur.text, cur.idx % 3 === 0 && !hasName))
    }
    } catch {
      /* nunca deixa um erro de frame derrubar a Tia da cena */
    }
  })

  // Balão: na despedida sempre mostra; senão só quando tem gente por perto
  const partingActive = !!partingRef.current && Date.now() < partingRef.current.until
  const nearDist = groupRef.current ? someoneNear(groupRef.current.position.x, groupRef.current.position.z) : Infinity
  const showBubble = partingActive || nearDist < NEAR_BUBBLE

  return (
    <>
      <group
        ref={groupRef}
        position={[0, 0, 0.5]}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return // arrasto de câmera, não clique
          toggleMute(e)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <HumanBody avatar={CLEIDE} isWalking={walking} />
        {/* hitbox generosa pro clique de mutar */}
        <mesh position={[0, 0.95, 0]} visible={false}>
          <boxGeometry args={[0.9, 1.9, 0.9]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {/* Vassoura na mão direita — sempre varrendo (rotation.z animada) */}
        <group ref={broomRef} position={[0.34, 0, 0.18]} rotation={[0.32, 0, -0.12]}>
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
            🧹 Tia Cleide {muted ? '🔇' : ''}
          </Text>
        </Billboard>
        <Billboard position={[0, 1.98, 0]} follow>
          <Text fontSize={0.105} color="#9fe0c0" outlineWidth={0.011} outlineColor="#000000" anchorX="center">
            {muted ? 'clique pra ativar a voz' : 'Faxineira · clique pra mutar'}
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

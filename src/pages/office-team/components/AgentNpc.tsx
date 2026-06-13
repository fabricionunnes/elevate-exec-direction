// Agentes IA da UNV como robôs no escritório — cada um tem posto na sala do
// seu setor e, de tempos em tempos, sai pra dar uma volta (café, corredor,
// lounge) com pathfinding. A rotina é derivada do relógio com defasagem por
// agente, então todos os clientes veem cada agente no mesmo lugar.
//
// Café em dupla: em ciclos sorteados, DOIS agentes são escalados pra mesma
// mesinha do lounge — sentam, tomam café e conversam por balões. Agentes de
// CRM/Produto/Marketing podem citar os números públicos das TVs; Noah
// (financeiro) e MAX (CEO) nunca falam dados — só frases de personalidade.
//
// Clique abre o chat (com checagem de permissão no servidor; o master define
// quem pode falar com cada um no próprio painel).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { OFFICE_AGENTS, OfficeAgent } from '../lib/agents'
import { findPath } from '../lib/pathfinding'
import { npcObstacles, personAvoidance } from '../lib/npcNav'
import { cafeDialogueLine, summonLine, getCafeNames, getCafeFacts, CafeFact } from '../lib/cafeDialogues'
import { bistroSeatsFor, BistroSeat, CoffeeSip, SpeechBubble } from './CoffeeChat'
import RobotBody from './RobotBody'

const CYCLE = 360 // segundos por ciclo de rotina

/** Posição atual do MAX (pro balão do tour de boas-vindas). */
export const maxNpcState = { x: 0, z: 0 }

/** Posição atual de cada agente (pro balão do aceno seguir o robô). */
export const agentPosState: Record<string, { x: number; z: number }> = {}

const SUMMON_TTL = 150_000 // o agente fica ~2,5min e volta pro posto

function slotHash(slot: number): number {
  let h = slot >>> 0
  h = (h ^ (h >> 16)) * 0x45d9f3b
  h = (h ^ (h >> 16)) * 0x45d9f3b
  return (h ^ (h >> 16)) >>> 0
}

// ── Escalação do café: par de agentes + mesa, derivados do relógio ──
interface CafeShift {
  a: number
  b: number
  table: number
  phase: 'go' | 'sit' | 'back'
  slot: number
}

function cafeShift(nowS: number, nAgents: number): CafeShift | null {
  if (nAgents < 2) return null
  const slot = Math.floor(nowS / CYCLE)
  const t = nowS % CYCLE
  const h = slotHash(slot * 17 + 3)
  if (h % 2 !== 0) return null // café em ~metade dos ciclos
  const a = (h >> 3) % nAgents
  const b = (a + 1 + ((h >> 8) % (nAgents - 1))) % nAgents
  const table = (h >> 12) % 3
  let phase: CafeShift['phase'] | null = null
  if (t >= 120 && t < 155) phase = 'go'
  else if (t >= 155 && t < 290) phase = 'sit'
  else if (t >= 290 && t < 325) phase = 'back'
  if (!phase) return null
  return { a, b, table, phase, slot }
}

/** Conversa do café: DIÁLOGO de verdade (pergunta e resposta encadeadas),
 * roteiros locais com nomes reais do time e de clientes (sempre elogio),
 * sem números — e sem gastar um token de IA. */
function AgentCafeTalk({
  seatA,
  seatB,
  slot,
}: {
  agentA: OfficeAgent
  agentB: OfficeAgent
  seatA: BistroSeat
  seatB: BistroSeat
  slot: number
}) {
  const [, setTick] = useState(0)
  const [names, setNames] = useState<{ staff: string[]; clients: string[] }>({ staff: [], clients: [] })
  const [facts, setFacts] = useState<CafeFact[]>([])

  useEffect(() => {
    let cancelled = false
    void getCafeNames().then((n) => {
      if (!cancelled) setNames(n)
    })
    void getCafeFacts().then((f) => {
      if (!cancelled) setFacts(f)
    })
    const i = setInterval(() => setTick((v) => v + 1), 400)
    return () => {
      cancelled = true
      clearInterval(i)
    }
  }, [])

  const t = (Date.now() / 1000) % CYCLE
  if (t < 158) return null // pausa pra sentar antes de começar a prosa
  const elapsed = t - 158
  const turn = Math.floor(elapsed / 4.6)
  // Respiro de 0.7s entre uma fala e outra (conversa com cadência natural)
  if (elapsed % 4.6 > 3.9) return null
  const line = cafeDialogueLine(slot, turn, names, facts)
  const seat = line.who === 'A' ? seatA : seatB

  return <SpeechBubble x={seat.x} z={seat.z} y={1.92} text={line.text} isDots={false} />
}

type Pose = 'stand' | 'walk' | 'sit'

function AgentFigure({
  agent,
  baseX,
  baseZ,
  idx,
  dests,
  cafeSeat,
  cafePhase,
  cafeSlot,
}: {
  agent: OfficeAgent
  baseX: number
  baseZ: number
  idx: number
  dests: [number, number][]
  /** banqueta destinada a este agente quando escalado pro café */
  cafeSeat: BistroSeat | null
  cafePhase: 'go' | 'sit' | 'back' | null
  cafeSlot: number
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

  // Banqueta em uso (rotina de café em dupla OU aceno de usuário)
  const summon = useTeamStore((s) => s.agentSummon)
  const summonSeat =
    summon && summon.agentKey === agent.key && summon.seat
      ? { ...summon.seat, tableKey: summon.seat.tableKey }
      : null
  const sitSeat = cafeSeat ?? summonSeat
  // Caneca só no café — na sala privada é conversa de negócios, sem café
  const showCoffee = !!cafeSeat || (!!summonSeat && summon?.context === 'cafe')

  useFrame((_, delta) => {
    if (!groupRef.current || dests.length === 0) return
    const g = groupRef.current

    const planPath = (key: string, tx: number, tz: number) => {
      if (key === phaseRef.current) return
      phaseRef.current = key
      // Obstáculos completos: paredes + mobília + pessoas (não atravessa mais)
      const walls = npcObstacles(g.position.x, g.position.z)
      const pts = findPath(g.position.x, g.position.z, tx, tz, walls)
      pathRef.current = pts ? { pts, i: 0 } : null
    }

    const followPath = (): boolean => {
      const path = pathRef.current
      if (!path) return false
      const [wx, wz] = path.pts[path.i]
      const dx = wx - g.position.x
      const dz = wz - g.position.z
      const d = Math.hypot(dx, dz)
      const isLast = path.i === path.pts.length - 1
      // Último waypoint com pessoa em cima: aceita chegada mais folgada
      if (d < (isLast ? 0.5 : 0.15)) {
        path.i++
        if (path.i >= path.pts.length) pathRef.current = null
      } else {
        const step = Math.min(d, walkSpeed * delta)
        // Repulsão de pessoas no caminho (steering local)
        const [ax, az] = personAvoidance(g.position.x, g.position.z)
        g.position.x += (dx / d) * step + ax * delta
        g.position.z += (dz / d) * step + az * delta
        const targetAngle = Math.atan2(dx, dz)
        let diff = targetAngle - rotRef.current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        rotRef.current += diff * 0.18
        g.rotation.y = rotRef.current
      }
      setPoseIfChanged('walk')
      return true
    }

    // Posição exposta (balões do tour e do aceno seguem o robô)
    agentPosState[agent.key] = { x: g.position.x, z: g.position.z }
    if (agent.key === 'ceo') {
      maxNpcState.x = g.position.x
      maxNpcState.z = g.position.z
    }

    // ── Tour de boas-vindas: o MAX larga tudo e guia o usuário ──
    const tour = useTeamStore.getState().tour
    if (agent.key === 'ceo' && tour) {
      planPath(`tour:${tour.x.toFixed(1)}:${tour.z.toFixed(1)}`, tour.x, tour.z)
      if (!followPath()) {
        if (Math.hypot(g.position.x - tour.x, g.position.z - tour.z) > 4) {
          g.position.set(tour.x, 0, tour.z) // path falhou: garante presença
        }
        setPoseIfChanged('stand')
      }
      return
    }

    // ── Aceno: alguém chamou ESTE agente (sincronizado por broadcast) ──
    const summon = useTeamStore.getState().agentSummon
    if (summon && summon.agentKey === agent.key && Date.now() - summon.ts < SUMMON_TTL) {
      const target = summon.seat ?? { x: summon.x + 0.9, z: summon.z + 0.4 }
      planPath(`summon:${summon.ts}:go`, target.x, target.z)
      if (!followPath()) {
        const arrived = Math.hypot(g.position.x - target.x, g.position.z - target.z) < 0.6
        if (!arrived) {
          g.position.set(target.x, 0, target.z) // path falhou: garante presença
        }
        if (summon.seat) {
          // Senta no assento (banqueta do café OU cadeira de visita da sala)
          g.position.set(summon.seat.x, 0, summon.seat.z)
          rotRef.current =
            summon.seat.rot ?? Math.atan2(summon.seat.tableX - summon.seat.x, summon.seat.tableZ - summon.seat.z)
          g.rotation.y = rotRef.current
          setPoseIfChanged('sit')
        } else {
          // Fica em pé olhando pra quem chamou
          rotRef.current = Math.atan2(summon.x - g.position.x, summon.z - g.position.z)
          g.rotation.y = rotRef.current
          setPoseIfChanged('stand')
        }
      }
      return
    }

    // ── Escalado pro café: sobrepõe a rotina individual ──
    if (cafeSeat && cafePhase) {
      if (cafePhase === 'go') {
        planPath(`cafe:${cafeSlot}:go`, cafeSeat.x, cafeSeat.z)
        if (!followPath()) {
          // chegou (ou path falhou): senta direto
          if (Math.hypot(g.position.x - cafeSeat.x, g.position.z - cafeSeat.z) > 0.3) {
            g.position.set(cafeSeat.x, 0, cafeSeat.z)
          }
          rotRef.current = Math.atan2(cafeSeat.tableX - cafeSeat.x, cafeSeat.tableZ - cafeSeat.z)
          g.rotation.y = rotRef.current
          setPoseIfChanged('sit')
        }
      } else if (cafePhase === 'sit') {
        phaseRef.current = `cafe:${cafeSlot}:sit`
        pathRef.current = null
        if (Math.hypot(g.position.x - cafeSeat.x, g.position.z - cafeSeat.z) > 0.3) {
          g.position.set(cafeSeat.x, 0, cafeSeat.z)
        }
        rotRef.current = Math.atan2(cafeSeat.tableX - cafeSeat.x, cafeSeat.tableZ - cafeSeat.z)
        g.rotation.y = rotRef.current
        setPoseIfChanged('sit')
      } else {
        planPath(`cafe:${cafeSlot}:back`, baseX, baseZ)
        if (!followPath()) {
          if (Math.hypot(g.position.x - baseX, g.position.z - baseZ) > 0.25) {
            g.position.set(baseX, 0, baseZ)
          }
          setPoseIfChanged('stand')
        }
      }
      return
    }

    // ── Rotina individual (posto + passeios) ──
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

    if (phase === 'go') planPath(`${slot}:go`, dest[0], dest[1])
    else if (phase === 'back') planPath(`${slot}:back`, baseX, baseZ)
    else if (`${slot}:${phase}` !== phaseRef.current) {
      phaseRef.current = `${slot}:${phase}`
      pathRef.current = null
    }

    if (followPath()) return

    if (phase === 'home') {
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
    <>
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
          <RobotBody body={agent.body} accent={agent.accent} isWalking={pose === 'walk'} isSitting={pose === 'sit'} />
          {/* hitbox generosa pro clique */}
          <mesh position={[0, 0.95, 0]} visible={false}>
            <boxGeometry args={[0.9, 1.9, 0.9]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        </group>
        <Billboard position={[0, pose === 'sit' ? 1.7 : 2.22, 0]} follow>
          <Text fontSize={0.165} color="#ffffff" outlineWidth={0.014} outlineColor="#000000" anchorX="center">
            🤖 {agent.name}
          </Text>
        </Billboard>
        {pose !== 'sit' && (
          <Billboard position={[0, 2.0, 0]} follow>
            <Text fontSize={0.115} color={agent.accent} outlineWidth={0.011} outlineColor="#000000" anchorX="center">
              {agent.title}
            </Text>
          </Billboard>
        )}
      </group>
      {/* Caneca de café enquanto está sentado na banqueta (rotina ou aceno) */}
      {pose === 'sit' && sitSeat && showCoffee && (
        <CoffeeSip
          sitter={{
            id: `agent-${agent.key}`,
            name: agent.name,
            x: sitSeat.x,
            z: sitSeat.z,
            tableKey: sitSeat.tableKey,
            tableX: sitSeat.tableX,
            tableZ: sitSeat.tableZ,
          }}
        />
      )}
    </>
  )
}

/** Prosa do agente convocado por aceno: balão a cada ~6s seguindo o robô.
 * REGRA: quem chamou sem autorização só ouve papo informal — nada de
 * sistema, empresa, clientes ou colegas. Autorizado ouve elogios ao time
 * e a clientes (sem números). Tudo local — zero tokens. */
function SummonTalk() {
  const summon = useTeamStore((s) => s.agentSummon)
  const [, setTick] = useState(0)
  const [facts, setFacts] = useState<CafeFact[]>([])

  useEffect(() => {
    if (!summon) return
    let cancelled = false
    if (summon.allowed) {
      void getCafeFacts().then((f) => {
        if (!cancelled) setFacts(f)
      })
    }
    return () => {
      cancelled = true
    }
  }, [summon?.ts])

  useEffect(() => {
    const i = setInterval(() => setTick((v) => v + 1), 500)
    return () => clearInterval(i)
  }, [])

  if (!summon) return null
  const pos = agentPosState[summon.agentKey]
  if (!pos) return null

  // Só conversa depois de chegar perto do destino
  const target = summon.seat ?? { x: summon.x, z: summon.z }
  if (Math.hypot(pos.x - target.x, pos.z - target.z) > 1.6) return null

  const elapsed = Date.now() - summon.ts
  if (elapsed > SUMMON_TTL) return null
  const turn = Math.floor(elapsed / 6000)
  // Balão fica visível 4,5s de cada janela de 6s (respiro entre falas)
  if (elapsed % 6000 > 4500) return null

  const text = summonLine(summon.ts, turn, summon.allowed, facts, summon.context)
  return <SpeechBubble x={pos.x} z={pos.z} y={summon.seat ? 1.75 : 2.3} text={text} isDots={false} />
}

/** Balão do MAX durante o tour (segue a posição dele). */
function TourBubble() {
  const tour = useTeamStore((s) => s.tour)
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick((v) => v + 1), 400)
    return () => clearInterval(i)
  }, [])
  if (!tour) return null
  return <SpeechBubble x={maxNpcState.x} z={maxNpcState.z} y={2.55} text={tour.text} isDots={false} />
}

export default function AgentNpcs() {
  const rooms = useTeamStore((s) => s.rooms)
  const [cafe, setCafe] = useState<CafeShift | null>(null)

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

  const seats = useMemo(() => bistroSeatsFor(rooms), [rooms])

  // Escalação do café recalculada a cada segundo (determinística pelo relógio)
  // + expiração do aceno (agente volta pro posto depois do TTL)
  useEffect(() => {
    const update = () => {
      setCafe(cafeShift(Date.now() / 1000, placed.length))
      const st = useTeamStore.getState()
      if (st.agentSummon && Date.now() - st.agentSummon.ts > SUMMON_TTL) {
        st.setAgentSummon(null)
      }
    }
    update()
    const i = setInterval(update, 1000)
    return () => clearInterval(i)
  }, [placed.length])

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

  // 4 banquetas por mesa agora: a dupla senta frente a frente (índices 0 e 2)
  const seatA = cafe ? (seats[cafe.table * 4] ?? null) : null
  const seatB = cafe ? (seats[cafe.table * 4 + 2] ?? null) : null

  return (
    <>
      {placed.map(({ agent, x, z }, pi) => (
        <AgentFigure
          key={agent.key}
          agent={agent}
          baseX={x}
          baseZ={z}
          idx={pi}
          dests={dests}
          cafeSeat={cafe && pi === cafe.a ? seatA : cafe && pi === cafe.b ? seatB : null}
          cafePhase={cafe && (pi === cafe.a || pi === cafe.b) ? cafe.phase : null}
          cafeSlot={cafe?.slot ?? 0}
        />
      ))}
      {cafe && cafe.phase === 'sit' && seatA && seatB && placed[cafe.a] && placed[cafe.b] && (
        <AgentCafeTalk
          agentA={placed[cafe.a].agent}
          agentB={placed[cafe.b].agent}
          seatA={seatA}
          seatB={seatB}
          slot={cafe.slot}
        />
      )}
      <TourBubble />
      <SummonTalk />
    </>
  )
}

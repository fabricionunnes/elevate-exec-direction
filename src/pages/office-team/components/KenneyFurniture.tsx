// Mobília com modelos 3D reais (Kenney Furniture Kit, CC0) no lugar das
// caixas e cilindros. Cada componente aqui é a versão "modelo" de uma peça
// do ModernOffice/Elevator/DataTvs, nas MESMAS posições, rotações, assentos
// (sitAt) e footprints da versão procedural. Nenhum deles trata loading nem
// erro: quem usa embrulha em <Modeled fallback={peça procedural}>.
//
// Convenções: o kit tem a frente em +z e o encosto das cadeiras em -z; a
// cadeira procedural usa `rotation` = direção do ENCOSTO (+z local), então
// a cadeira do kit entra com rotation + PI. Sofá e poltrona já batem (encosto
// em -z nos dois). Repetição em massa usa <InstancedModel>.
import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useTeamStore } from '../store/useTeamStore'
import { graphicsParams } from '../lib/graphics'
import { sitAt, localToWorld } from '../lib/sit'
import { Model, InstancedModel, type InstanceItem, type MaterialOverrides, type Scale3 } from '../lib/models'
import { mats } from './Decor'

// ── Materiais de troca (por nome do material do glb), criados uma vez ────
type Overrides = {
  /** monitor: painel com a tela de CRM, moldura e pé pretos */
  monitor: MaterialOverrides
  /** notebook: só o painel vira tela de CRM */
  laptop: MaterialOverrides
  /** TV: tudo preto (o conteúdo é o plano de canvas que fica na frente) */
  tv: MaterialOverrides
  /** cúpula de luminária acesa */
  lamp: MaterialOverrides
  /** madeira escura (mesa de reunião, aparador da TV) */
  walnut: MaterialOverrides
  /** balcão da recepção nas cores da marca */
  reception: MaterialOverrides
  /** poltrona do auditório: estrutura escura */
  theater: MaterialOverrides
}
let _ov: Overrides | null = null
function ov(): Overrides {
  if (_ov) return _ov
  const m = mats()
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  const walnut = std({ color: '#8a5d3b', roughness: 0.55 })
  const walnutDark = std({ color: '#5f3f26', roughness: 0.6 })
  _ov = {
    monitor: { metal: m.screen, metalDark: m.bezel },
    laptop: { metal: m.screen },
    tv: { metal: m.bezel, metalDark: m.bezel },
    lamp: { lamp: m.lampGlow },
    walnut: { wood: walnut, woodDark: walnutDark },
    reception: {
      wood: std({ color: '#0D2B5E', roughness: 0.6 }),
      woodDark: std({ color: '#CC1B1B', roughness: 0.55 }),
      metal: std({ color: '#e9e3d6', roughness: 0.35 }),
    },
    theater: { wood: m.theaterBase },
  }
  return _ov
}

/** Gráficos no alto? (no médio os modelos pequenos não projetam sombra) */
function useHigh(): boolean {
  const graphics = useTeamStore((s) => s.graphics)
  return graphicsParams(graphics).high
}

const pointer = {
  onPointerOver: () => (document.body.style.cursor = 'pointer'),
  onPointerOut: () => (document.body.style.cursor = 'default'),
}
const isDrag = (e: ThreeEvent<MouseEvent>) => {
  e.stopPropagation()
  return e.delta > 6
}

// ── Cadeiras ─────────────────────────────────────────────────────────────
// Assento a ~0.47 (o boneco senta com o quadril nessa altura).
const CHAIR_SCALE: Record<'desk' | 'cushion', Scale3> = {
  desk: [1.8, 2, 1.8], // chairDesk: 0.60 x 1.22 x 0.57, assento 0.47
  cushion: [2.3, 2, 2.3], // chairCushion: 0.46 x 0.92 x 0.46, assento 0.48
}
const CHAIR_NAME = { desk: 'chairDesk', cushion: 'chairCushion' } as const

/** Cadeira clicável (uma peça). `rotation` = direção do encosto. */
export function ChairModel({ x, z, rotation = 0, color, kind = 'desk' }: { x: number; z: number; rotation?: number; color?: string; kind?: 'desk' | 'cushion' }) {
  return (
    <Model
      name={CHAIR_NAME[kind]}
      position={[x, 0, z]}
      rotation={rotation + Math.PI}
      scale={CHAIR_SCALE[kind]}
      tint={color}
      onClick={(e) => {
        if (isDrag(e)) return
        sitAt(x, z, rotation + Math.PI)
      }}
      {...pointer}
    />
  )
}

export interface SeatSpot {
  x: number
  z: number
  /** direção do encosto */
  backRot: number
}

/** Várias cadeiras iguais numa InstancedMesh por primitiva; clique por
 * instância manda sentar naquela cadeira. */
export function ChairsModel({ seats, color, kind = 'cushion', dark = false }: { seats: SeatSpot[]; color?: string; kind?: 'desk' | 'cushion'; /** madeira escura (combina com a mesa de reunião) */ dark?: boolean }) {
  const items = useMemo<InstanceItem[]>(() => seats.map((s) => ({ x: s.x, z: s.z, rot: s.backRot + Math.PI })), [seats])
  return (
    <InstancedModel
      name={CHAIR_NAME[kind]}
      items={items}
      scale={CHAIR_SCALE[kind]}
      tint={color}
      materials={dark ? ov().walnut : undefined}
      pointer
      onClickItem={(i) => {
        const s = seats[i]
        if (s) sitAt(s.x, s.z, s.backRot + Math.PI)
      }}
    />
  )
}

/** Plateia do auditório: mesmas posições/rotações do auditoriumLayout, numa
 * InstancedMesh por primitiva; clique por instância senta naquela poltrona.
 * Poltrona estofada (loungeChair) vinho com pés escuros, 0.72 de largura (o
 * passo lateral é 0.95) e assento a 0.46. */
export function TheaterSeatsModel({ seats }: { seats: { x: number; z: number; rot: number }[] }) {
  const items = useMemo<InstanceItem[]>(() => seats.map((s) => ({ x: s.x, z: s.z, rot: s.rot + Math.PI })), [seats])
  return (
    <InstancedModel
      name="loungeChair"
      items={items}
      size={{ w: 0.72, h: 0.92, d: 0.62 }}
      tint="#8c1d1d"
      materials={ov().theater}
      pointer
      onClickItem={(i) => {
        const s = seats[i]
        if (s) sitAt(s.x, s.z, s.rot + Math.PI)
      }}
    />
  )
}

// ── Mesa de trabalho ─────────────────────────────────────────────────────
const DESK_SIZE = { w: 1.7, h: 0.768, d: 0.8 } // mesmo tampo da procedural (1.7 x 0.8 a 0.77)
const DESK_TOP = DESK_SIZE.h
// Posições locais em cima do tampo (frente da mesa = +z, lado de quem senta)
const ON_DESK = {
  screen: { x: -0.08, z: -0.2, scale: 1.7 },
  keyboard: { x: -0.08, z: 0.14, scale: 1.6 },
  mouse: { x: 0.3, z: 0.15, scale: 1.6 },
  laptop: { x: -0.05, z: 0.02, scale: 1.55 },
  plant: { x: 0.62, z: -0.2, scale: 2.1 },
  lamp: { x: 0.64, z: -0.22, scale: 1.5 },
  trash: { x: -0.99, z: 0.25, scale: 0.95 },
}

/** Mesa individual (sala pessoal): desk + monitor/teclado/mouse ou notebook,
 * lixeira e, opcional, luminária de mesa. Clicar deixa recado pro dono. */
export function DeskModel({
  x,
  z,
  rotation = 0,
  noteTarget,
  laptop = false,
  lamp = false,
}: {
  x: number
  z: number
  rotation?: number
  noteTarget?: { userId: string; name: string }
  laptop?: boolean
  lamp?: boolean
}) {
  const me = useTeamStore((s) => s.me)
  const high = useHigh()
  const clickable = !!noteTarget && noteTarget.userId !== me?.id
  const o = ov()
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={
        clickable
          ? (e) => {
              if (isDrag(e)) return
              useTeamStore.getState().setComposeNoteFor(noteTarget!)
            }
          : undefined
      }
      onPointerOver={clickable ? pointer.onPointerOver : undefined}
      onPointerOut={clickable ? pointer.onPointerOut : undefined}
    >
      <Model name="desk" size={DESK_SIZE} receiveShadow />
      {laptop ? (
        <Model name="laptop" position={[ON_DESK.laptop.x, DESK_TOP, ON_DESK.laptop.z]} scale={ON_DESK.laptop.scale} materials={o.laptop} castShadow={high} />
      ) : (
        <>
          <Model name="computerScreen" position={[ON_DESK.screen.x, DESK_TOP, ON_DESK.screen.z]} scale={ON_DESK.screen.scale} materials={o.monitor} />
          <Model name="computerKeyboard" position={[ON_DESK.keyboard.x, DESK_TOP, ON_DESK.keyboard.z]} scale={ON_DESK.keyboard.scale} castShadow={high} />
          <Model name="computerMouse" position={[ON_DESK.mouse.x, DESK_TOP, ON_DESK.mouse.z]} scale={ON_DESK.mouse.scale} castShadow={high} />
        </>
      )}
      {lamp && <Model name="lampSquareTable" position={[ON_DESK.lamp.x, DESK_TOP, ON_DESK.lamp.z]} scale={ON_DESK.lamp.scale} materials={o.lamp} castShadow={high} />}
      <Model name="trashcan" position={[ON_DESK.trash.x, 0, ON_DESK.trash.z]} scale={ON_DESK.trash.scale} castShadow={high} />
    </group>
  )
}

/** Ilhas da sala de setor, tudo instanciado: duas mesas encostadas por ilha
 * (uma virada pro sul, outra pro norte), computador ou notebook alternando
 * por índice, plantinha em algumas, lixeiras e as cadeiras clicáveis dos
 * dois lados, com o tecido na cor da sala. */
export function SectorIslandsModel({ islands, color }: { islands: { x: number; z: number }[]; color: string }) {
  const high = useHigh()
  const o = ov()
  const L = useMemo(() => {
    const desks: InstanceItem[] = []
    const screens: InstanceItem[] = []
    const keyboards: InstanceItem[] = []
    const mice: InstanceItem[] = []
    const laptops: InstanceItem[] = []
    const plants: InstanceItem[][] = [[], [], []]
    const trash: InstanceItem[] = []
    const seats: SeatSpot[] = []
    const on = (d: { x: number; z: number; rot: number }, p: { x: number; z: number }, y = DESK_TOP): InstanceItem => {
      const [wx, wz] = localToWorld(d.x, d.z, d.rot, p.x, p.z)
      return { x: wx, z: wz, y, rot: d.rot }
    }
    islands.forEach((isl, i) => {
      const pair = [
        { x: isl.x, z: isl.z + 0.45, rot: 0 }, // mesa sul: quem senta olha pro norte
        { x: isl.x, z: isl.z - 0.45, rot: Math.PI }, // mesa norte: quem senta olha pro sul
      ]
      pair.forEach((d, j) => {
        const k = i * 2 + j
        desks.push({ x: d.x, z: d.z, rot: d.rot })
        if (k % 3 === 2) laptops.push(on(d, ON_DESK.laptop))
        else {
          screens.push(on(d, ON_DESK.screen))
          keyboards.push(on(d, ON_DESK.keyboard))
          mice.push(on(d, ON_DESK.mouse))
        }
        if (k % 2 === 1) plants[k % 3].push(on(d, ON_DESK.plant))
        trash.push(on(d, ON_DESK.trash, 0))
      })
      seats.push({ x: isl.x, z: isl.z + 1.12, backRot: 0 })
      seats.push({ x: isl.x, z: isl.z - 1.12, backRot: Math.PI })
    })
    return { desks, screens, keyboards, mice, laptops, plants, trash, seats }
  }, [islands])
  return (
    <group>
      <InstancedModel name="desk" items={L.desks} size={DESK_SIZE} receiveShadow />
      <InstancedModel name="computerScreen" items={L.screens} scale={ON_DESK.screen.scale} materials={o.monitor} />
      <InstancedModel name="computerKeyboard" items={L.keyboards} scale={ON_DESK.keyboard.scale} castShadow={high} />
      <InstancedModel name="computerMouse" items={L.mice} scale={ON_DESK.mouse.scale} castShadow={high} />
      <InstancedModel name="laptop" items={L.laptops} scale={ON_DESK.laptop.scale} materials={o.laptop} castShadow={high} />
      <InstancedModel name="plantSmall1" items={L.plants[0]} scale={ON_DESK.plant.scale} castShadow={high} />
      <InstancedModel name="plantSmall2" items={L.plants[1]} scale={ON_DESK.plant.scale} castShadow={high} />
      <InstancedModel name="plantSmall3" items={L.plants[2]} scale={ON_DESK.plant.scale} castShadow={high} />
      <InstancedModel name="trashcan" items={L.trash} scale={ON_DESK.trash.scale} castShadow={high} />
      <ChairsModel seats={L.seats} color={color} kind="desk" />
    </group>
  )
}

// ── Mesa de reunião ──────────────────────────────────────────────────────
/** Mesa de reunião: módulos de tableCross lado a lado cobrindo o mesmo
 * tampo da procedural (len x 1.7 a 0.78 de altura). Módulos de ~2 m em vez
 * de uma mesa só esticada (o cavalete deformaria). */
export function MeetingTableModel({ x, z, len }: { x: number; z: number; len: number }) {
  const n = Math.max(1, Math.round(len / 2.1))
  const seg = len / n
  const items = useMemo<InstanceItem[]>(() => {
    const out: InstanceItem[] = []
    for (let i = 0; i < n; i++) out.push({ x: x - len / 2 + (i + 0.5) * seg, z })
    return out
  }, [x, z, len, n, seg])
  return <InstancedModel name="tableCross" items={items} size={{ w: seg, h: 0.79, d: 1.7 }} materials={ov().walnut} receiveShadow />
}

// ── TV ───────────────────────────────────────────────────────────────────
// televisionModern em unidades do glb: painel em x -0.334..0.334, y 0.078..0.446
// (centro 0.262), z 0.021; moldura de z -0.004 (costas) a 0.027 (frente) e de
// y 0.07 pra cima; abaixo disso é o pé de mesa (base 0.354 x 0.128).
const TV = { w: 0.668, h: 0.368, cy: 0.262, back: -0.004, front: 0.027, foot: 0.069, baseW: 0.354, baseD: 0.128 }

/** Moldura de TV (televisionModern) dimensionada pra que o PAINEL do modelo
 * case com o retângulo w x h centrado em (0, y) no grupo pai, virado pra +z,
 * 4 mm atrás do plano de conteúdo que fica em `z` (canvas, tela apagada ou
 * vídeo). Dois jeitos:
 *  - de parede (padrão): sem o pé, com a moldura engrossada até encostar na
 *    parede que está `wallGap` atrás do plano de conteúdo;
 *  - `cabinet`: com o pé, apoiada num aparador (cabinetTelevision) que vai do
 *    chão (`floorY`, no espaço do grupo pai) até a base do pé. */
export function TvFrameModel({
  y,
  z,
  w,
  h,
  wallGap = 0.2,
  cabinet = false,
  floorY = 0,
}: {
  y: number
  z: number
  w: number
  h: number
  wallGap?: number
  cabinet?: boolean
  floorY?: number
}) {
  const sx = w / TV.w
  const sy = h / TV.h
  const oy = y - TV.cy * sy // origem do glb (base do pé)
  const o = ov()
  if (cabinet && oy - floorY > 0.12) {
    const depth = 2.2
    const oz = z - 0.004 - TV.front * depth
    return (
      <group>
        <Model name="televisionModern" center={false} position={[0, oy, oz]} scale={[sx, sy, depth]} materials={o.tv} />
        <Model
          name="cabinetTelevision"
          position={[0, floorY, oz + 0.05]}
          size={{ w: Math.max(TV.baseW * sx + 0.5, w * 0.8), h: oy - floorY, d: TV.baseD * depth + 0.2 }}
          materials={o.walnut}
        />
      </group>
    )
  }
  const depth = Math.max(1, (wallGap - 0.004) / (TV.front - TV.back))
  const oz = z - 0.004 - TV.front * depth
  return <Model name="televisionModern" center={false} cutBelow={TV.foot} position={[0, oy, oz]} scale={[sx, sy, depth]} materials={o.tv} />
}

// ── Lounge ───────────────────────────────────────────────────────────────
const SOFA_SEATS: [number, number][] = [
  [-0.42, 0.08],
  [0.42, 0.08],
]

/** Sofá de dois lugares (mesmo footprint 1.7 x 0.8). `variant` alterna o
 * modelo: par = loungeSofa, ímpar = loungeDesignSofa. Clique senta no
 * assento mais próximo do ponto clicado, olhando pra frente (+z local). */
export function SofaModel({ x, z, rotation = 0, color, variant = 0 }: { x: number; z: number; rotation?: number; color: string; variant?: number }) {
  const design = variant % 2 === 1
  return (
    <Model
      name={design ? 'loungeDesignSofa' : 'loungeSofa'}
      position={[x, 0, z]}
      rotation={rotation}
      size={{ w: 1.7, h: design ? 0.8 : 0.92, d: 0.8 }}
      tint={color}
      onClick={(e) => {
        if (isDrag(e)) return
        const seats = SOFA_SEATS.map(([lx, lz]) => localToWorld(x, z, rotation, lx, lz))
        const seat = seats.reduce((a, b) => (Math.hypot(a[0] - e.point.x, a[1] - e.point.z) <= Math.hypot(b[0] - e.point.x, b[1] - e.point.z) ? a : b))
        sitAt(seat[0], seat[1], rotation)
      }}
      {...pointer}
    />
  )
}

/** Poltrona (loungeChair) no footprint 0.75 x 0.7 da procedural. */
export function ArmchairModel({ x, z, rotation = 0, color }: { x: number; z: number; rotation?: number; color: string }) {
  return (
    <Model
      name="loungeChair"
      position={[x, 0, z]}
      rotation={rotation}
      size={{ w: 0.78, h: 0.9, d: 0.72 }}
      tint={color}
      onClick={(e) => {
        if (isDrag(e)) return
        const seat = localToWorld(x, z, rotation, 0, 0.06)
        sitAt(seat[0], seat[1], rotation)
      }}
      {...pointer}
    />
  )
}

/** Mesa de centro: madeira ou vidro, alternando pela posição. */
export function CoffeeTableModel({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  const glass = Math.abs(Math.round(x * 3 + z * 5)) % 2 === 1
  return <Model name={glass ? 'tableCoffeeGlass' : 'tableCoffee'} position={[x, 0, z]} rotation={rotation} scale={1.35} receiveShadow />
}

/** Tapete (redondo de 2 m como o procedural, ou retangular) na cor pedida. */
export function RugModel({ x, z, color, shape = 'round', rotation = 0 }: { x: number; z: number; color: string; shape?: 'round' | 'rect'; rotation?: number }) {
  return (
    <Model
      name={shape === 'rect' ? 'rugRectangle' : 'rugRound'}
      position={[x, 0.004, z]}
      rotation={rotation}
      size={shape === 'rect' ? { w: 2.7, h: 0.02, d: 1.6 } : { w: 2, h: 0.02, d: 2 }}
      tint={color}
      castShadow={false}
      receiveShadow
    />
  )
}

/** Estante: bookcaseOpen + bookcaseClosed lado a lado no footprint 1.3 x 0.32. */
export function BookshelfModel({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <Model name="bookcaseOpen" position={[-0.325, 0, 0]} size={{ w: 0.65, h: 1.8, d: 0.34 }} />
      <Model name="bookcaseClosed" position={[0.325, 0, 0]} size={{ w: 0.65, h: 1.74, d: 0.34 }} />
    </group>
  )
}

/** Caixa de som de piso (decoração). */
export function SpeakerModel({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return <Model name="speaker" position={[x, 0, z]} rotation={rotation} scale={1.8} />
}

/** Luminária de piso acesa (decoração, sem luz real). */
export function FloorLampModel({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return <Model name="lampRoundFloor" position={[x, 0, z]} rotation={rotation} scale={2} materials={ov().lamp} />
}

const STOOL_SCALE: Scale3 = [1.5, 1.4, 1.5] // 0.40 x 0.61 x 0.35 (assento alto)
const BISTRO_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]

/** Mesas bistrô do lounge: mesa alta de pedestal (tableRound) e 4 banquetas
 * por mesa nas mesmas posições (raio 0.75), todas instanciadas e clicáveis. */
export function BistroSetModel({ tables }: { tables: { x: number; z: number }[] }) {
  const L = useMemo(() => {
    const tops: InstanceItem[] = tables.map((t) => ({ x: t.x, z: t.z }))
    const stools: (InstanceItem & { sit: number })[] = []
    for (const t of tables)
      for (const a of BISTRO_ANGLES) stools.push({ x: t.x + Math.sin(a) * 0.75, z: t.z + Math.cos(a) * 0.75, rot: a, sit: a + Math.PI })
    return { tops, stools }
  }, [tables])
  return (
    <group>
      <InstancedModel name="tableRound" items={L.tops} size={{ w: 0.9, h: 1.04, d: 0.96 }} />
      <InstancedModel
        name="stoolBar"
        items={L.stools}
        scale={STOOL_SCALE}
        tint="#6b4f34"
        pointer
        onClickItem={(i) => {
          const s = L.stools[i]
          if (s) sitAt(s.x, s.z, s.sit)
        }}
      />
    </group>
  )
}

/** Canto de copa do lounge no footprint do balcão de café (3 x 0.8, frente
 * pro sul): ponta arredondada + dois módulos de balcão + geladeira, com a
 * cafeteira e uma plantinha em cima e duas banquetas clicáveis na frente. */
export function CopaModel({ x, z }: { x: number; z: number }) {
  const high = useHigh()
  const bars = useMemo<InstanceItem[]>(() => [{ x: -0.7875, z: 0 }, { x: 0.1375, z: 0 }], [])
  const stools = useMemo(
    () => [
      { x: x - 0.95, z: z + 0.82 },
      { x: x - 0.05, z: z + 0.82 },
    ],
    [x, z]
  )
  const stoolItems = useMemo<InstanceItem[]>(() => stools.map((s) => ({ x: s.x - x, z: s.z - z })), [stools, x, z])
  return (
    <group position={[x, 0, z]}>
      <Model name="kitchenBarEnd" position={[-1.375, 0, 0]} size={{ w: 0.25, h: 1.05, d: 0.76 }} />
      <InstancedModel name="kitchenBar" items={bars} size={{ w: 0.925, h: 1.05, d: 0.76 }} receiveShadow />
      <Model name="kitchenFridgeSmall" position={[1.05, 0, 0]} size={{ w: 0.9, h: 1.42, d: 0.74 }} />
      <Model name="kitchenCoffeeMachine" position={[-0.9, 1.05, -0.02]} scale={1.7} castShadow={high} />
      <Model name="plantSmall2" position={[0.3, 1.05, -0.12]} scale={2.2} castShadow={high} />
      {/* Banquetas do balcão: senta olhando pro balcão (norte) */}
      <InstancedModel
        name="stoolBar"
        items={stoolItems}
        scale={STOOL_SCALE}
        tint="#6b4f34"
        pointer
        onClickItem={(i) => {
          const s = stools[i]
          if (s) sitAt(s.x, s.z, Math.PI)
        }}
      />
    </group>
  )
}

// ── Recepção ─────────────────────────────────────────────────────────────
/** Balcão da recepção no retângulo do collider (w x d, frente pro sul):
 * dois módulos kitchenBar com uma ponta arredondada de cada lado, nas cores
 * da marca, monitor, plantinha e a banqueta de quem atende atrás. */
export function ReceptionDeskModel({ w, d }: { w: number; d: number }) {
  const high = useHigh()
  const o = ov()
  const end = 0.26
  const mod = (w - end * 2) / 2
  const H = 1.06
  const bars = useMemo<InstanceItem[]>(() => [{ x: -mod / 2, z: 0 }, { x: mod / 2, z: 0 }], [mod])
  return (
    <group>
      <InstancedModel name="kitchenBar" items={bars} size={{ w: mod, h: H, d }} materials={o.reception} receiveShadow />
      <Model name="kitchenBarEnd" position={[-w / 2 + end / 2, 0, 0]} size={{ w: end, h: H, d }} materials={o.reception} />
      <Model name="kitchenBarEnd" position={[w / 2 - end / 2, 0, 0]} rotation={Math.PI} size={{ w: end, h: H, d }} materials={o.reception} />
      <Model name="computerScreen" position={[-0.6, H, -0.12]} rotation={0.25} scale={1.5} materials={o.monitor} castShadow={high} />
      <Model name="plantSmall1" position={[0.95, H, -0.05]} scale={2.2} castShadow={high} />
      <Model name="stoolBar" position={[0, 0, -0.62]} scale={STOOL_SCALE} tint="#2f3640" />
    </group>
  )
}

/** Cabideiro de pé (decoração da entrada). */
export function CoatRackModel({ x, z }: { x: number; z: number }) {
  return <Model name="coatRackStanding" position={[x, 0, z]} scale={2.3} />
}

// ── Plantas ──────────────────────────────────────────────────────────────
/** Todas as plantas de vaso do andar numa InstancedMesh por primitiva (3
 * draw calls pro andar inteiro). O tamanho varia pela posição. */
export function PlantsModel({ spots }: { spots: { x: number; z: number }[] }) {
  const items = useMemo<InstanceItem[]>(
    () =>
      spots.map((p) => {
        const h = Math.abs(Math.round(p.x * 7 + p.z * 13)) % 5
        return { x: p.x, z: p.z, rot: h * 1.3, s: 0.82 + h * 0.07 }
      }),
    [spots]
  )
  return <InstancedModel name="pottedPlant" items={items} scale={2} />
}

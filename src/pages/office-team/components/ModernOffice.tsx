// Escritório moderno data-driven — renderiza piso, corredores, salas
// (paredes meia-altura + vidro), portas trancadas e mobília por tipo de sala.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, RoundedBox, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore, playerFloor } from '../store/useTeamStore'
import { BUILDING, OfficeRoom, isEffectivelyLocked, roomWalls, floorBounds, sectorIslands, loungeExtraSets, auditoriumLayout, furnitureColliders, STAGE_H } from '../lib/rooms'
import { currentReservation, hourLabel } from '../lib/clientRooms'
import { ELEVATOR } from '../lib/floors'
import { Elevator, Reception, RECEPTION_PLANTS } from './Elevator'
import { woodTexture, floorTexture, carpetTexture, artTexture, officialLogoTexture, ceilingTexture } from '../lib/textures'
import { doorProximity } from '../lib/door'
import { sitAt, localToWorld } from '../lib/sit'
import { graphicsParams } from '../lib/graphics'
import { mats, geos, fabricMaterial, CeilingLamp, Whiteboard, Poster, TrashBin, RealPlant, Curtain } from './Decor'
import { Modeled, ModelsProbe, useModelsReady, FURNITURE_LAYER } from '../lib/models'
import {
  ChairModel,
  ChairsModel,
  TheaterSeatsModel,
  DeskModel,
  SectorIslandsModel,
  MeetingTableModel,
  TvFrameModel,
  SofaModel,
  ArmchairModel,
  CoffeeTableModel,
  RugModel,
  BookshelfModel,
  FloorLampModel,
  SpeakerModel,
  BistroSetModel,
  CopaModel,
  PlantsModel,
  type SeatSpot,
} from './KenneyFurniture'
import { roomHasDataTv } from './DataTvs'

/** Layer só das sombras de contato: a câmera do ContactShadows enxerga
 * apenas o que está nela (a mobília do andar), nunca os avatares — senão o
 * boneco parado no spawn ficaria "carimbado" no piso (a sombra é estática). */
const CONTACT_LAYER = FURNITURE_LAYER

/** ContactShadows do drei calculada UMA vez por andar (frames=1), olhando
 * só pra layer da mobília. Custo: 1 render de profundidade + 2 blur na
 * montagem; zero por frame depois. */
function StaticContactShadows({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const ref = useRef<THREE.Group>(null!)
  useEffect(() => {
    const cam = ref.current?.children.find((c) => (c as THREE.Camera).isCamera) as THREE.Camera | undefined
    if (cam) cam.layers.set(CONTACT_LAYER)
  }, [])
  return (
    <ContactShadows
      ref={ref}
      position={[cx, 0.015, cz]}
      width={w}
      height={d}
      far={3}
      resolution={512}
      blur={1.6}
      opacity={0.42}
      frames={1}
      color="#1a1d2a"
    />
  )
}

const CEILING_H = 3.2 // laje de teto (altura real do pé-direito)
const WALL_H = 1.15 // parede sólida (meia-altura, estilo maquete)
const GLASS_H = 1.0 // vidro acima da parede
const DOOR_W = 2.6

// ─────────────────────────────────────────────────────────────────────────
// Mobília: cada peça tem a versão com modelo 3D (KenneyFurniture) e a
// procedural antiga (sufixo Proc), que vira o fallback do <Modeled>: aparece
// enquanto o glb carrega e fica de vez se o arquivo falhar (404, parse).
// Posições, rotações, assentos e footprints são os mesmos nas duas.
// ─────────────────────────────────────────────────────────────────────────

/** Cadeira clicável. `rotation` = direção do ENCOSTO; o jogador senta
 * olhando pro lado oposto. `kind`: 'desk' = cadeira de escritório com
 * rodízios, 'cushion' = cadeira de visita. O tecido recebe `color`. */
function OfficeChair({
  x,
  z,
  rotation = 0,
  color = '#2f3640',
  kind = 'desk',
}: {
  x: number
  z: number
  rotation?: number
  color?: string
  kind?: 'desk' | 'cushion'
}) {
  return (
    <Modeled fallback={<OfficeChairProc x={x} z={z} rotation={rotation} color={color} />}>
      <ChairModel x={x} z={z} rotation={rotation} color={color} kind={kind} />
    </Modeled>
  )
}

/** Cadeira de escritório procedural (fallback). `rotation` = direção do
 * ENCOSTO (+z local); o jogador senta olhando pro lado oposto. Encosto curvo
 * (setor de cilindro), assento com borda arredondada, braços, coluna a gás e
 * base com rodízios. */
function OfficeChairProc({
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
  const m = mats()
  const g = geos()
  const fabric = fabricMaterial(color)
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
      {/* Assento arredondado */}
      <RoundedBox args={[0.44, 0.08, 0.44]} radius={0.03} smoothness={2} position={[0, 0.43, 0]} material={fabric} castShadow />
      {/* Encosto curvo: setor de cilindro aberto, concavidade virada pra frente */}
      <mesh position={[0, 0.72, -0.11]} material={fabric} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.52, 14, 1, true, -0.85, 1.7]} />
      </mesh>
      {/* Haste do encosto */}
      <mesh geometry={g.box} material={m.metalDark} position={[0, 0.5, 0.19]} scale={[0.06, 0.2, 0.03]} />
      {/* Braços */}
      {[-0.23, 0.23].map((ax) => (
        <group key={ax}>
          <mesh geometry={g.box} material={m.plasticDark} position={[ax, 0.6, 0.02]} scale={[0.05, 0.03, 0.3]} castShadow />
          <mesh geometry={g.box} material={m.metalDark} position={[ax, 0.52, 0.1]} scale={[0.03, 0.14, 0.03]} />
        </group>
      ))}
      {/* Coluna a gás + base 5 hastes com rodízios */}
      <mesh geometry={g.cyl8} material={m.metalLight} position={[0, 0.25, 0]} scale={[0.03, 0.3, 0.03]} />
      {[0, 1.257, 2.513, 3.77, 5.027].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh geometry={g.box} material={m.metalDark} position={[0, 0.075, 0.13]} rotation={[0.25, 0, 0]} scale={[0.035, 0.03, 0.26]} />
          <mesh geometry={g.sphere8} material={m.rubber} position={[0, 0.03, 0.25]} scale={[0.03, 0.03, 0.03]} />
        </group>
      ))}
    </group>
  )
}

/** Monitor de borda fina com tela de CRM (textura) e leve reflexo. */
function Monitor({ x, z, yaw = 0, w = 0.6, h = 0.36 }: { x: number; z: number; yaw?: number; w?: number; h?: number }) {
  const m = mats()
  const g = geos()
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={g.box} material={m.bezel} position={[0, 1.04, 0]} scale={[w + 0.02, h + 0.02, 0.018]} castShadow />
      <mesh position={[0, 1.04, 0.011]} material={m.screen}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Vidro da tela: reflexo sutil por cima do conteúdo */}
      <mesh position={[0, 1.04, 0.013]} material={m.glassDark}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* Braço + base disco (alumínio) */}
      <mesh geometry={g.box} material={m.metalLight} position={[0, 0.875, -0.04]} rotation={[0.28, 0, 0]} scale={[0.05, 0.16, 0.018]} />
      <mesh geometry={g.cyl8} material={m.metalLight} position={[0, 0.775, -0.06]} scale={[0.08, 0.014, 0.08]} />
    </group>
  )
}

/** Mesa de trabalho: desk + monitor/teclado/mouse (ou notebook) + lixeira.
 * Mesa de outro usuário: clicar deixa recado pra ele. */
function Desk({
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
  /** notebook no lugar do monitor + teclado + mouse */
  laptop?: boolean
  /** luminária de mesa acesa */
  lamp?: boolean
}) {
  return (
    <Modeled fallback={<DeskProc x={x} z={z} rotation={rotation} chair={false} noteTarget={noteTarget} />}>
      <DeskModel x={x} z={z} rotation={rotation} noteTarget={noteTarget} laptop={laptop} lamp={lamp} />
    </Modeled>
  )
}

function DeskProc({
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
  const m = mats()
  const g = geos()
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
      {/* Tampo de madeira com borda arredondada */}
      <RoundedBox args={[1.7, 0.05, 0.8]} radius={0.02} smoothness={2} position={[0, 0.74, 0]} material={m.wood} castShadow receiveShadow />
      {/* Pés metálicos (4 tubos) + travessa */}
      {[-0.78, 0.78].map((px) =>
        [-0.32, 0.32].map((pz) => (
          <mesh key={`${px}${pz}`} geometry={g.cyl8} material={m.metalDark} position={[px, 0.36, pz]} scale={[0.022, 0.72, 0.022]} />
        ))
      )}
      <mesh geometry={g.box} material={m.metalDark} position={[0, 0.12, -0.32]} scale={[1.5, 0.03, 0.03]} />
      {/* Gaveteiro */}
      <mesh geometry={g.box} material={m.plasticLight} position={[0.55, 0.36, 0.05]} scale={[0.4, 0.62, 0.55]} castShadow />
      {[0.5, 0.3, 0.1].map((dy) => (
        <mesh key={dy} geometry={g.box} material={m.metalLight} position={[0.55, dy + 0.1, 0.33]} scale={[0.14, 0.012, 0.012]} />
      ))}
      {/* Dois monitores com tela de CRM */}
      <Monitor x={-0.36} z={-0.17} yaw={0.2} />
      <Monitor x={0.36} z={-0.17} yaw={-0.2} />
      {/* Teclado com teclas, mouse e caneca */}
      <mesh geometry={g.box} material={m.plasticLight} position={[-0.05, 0.775, 0.1]} scale={[0.42, 0.02, 0.15]} castShadow />
      <mesh geometry={g.box} material={m.plasticDark} position={[-0.05, 0.787, 0.1]} scale={[0.38, 0.006, 0.11]} />
      <mesh geometry={g.sphere8} material={m.plasticDark} position={[0.26, 0.785, 0.12]} scale={[0.03, 0.018, 0.05]} castShadow />
      <mesh geometry={g.cyl8} position={[-0.6, 0.805, 0.08]} scale={[0.04, 0.09, 0.04]} castShadow>
        <meshStandardMaterial color="#CC1B1B" roughness={0.45} />
      </mesh>
      <TrashBin x={-0.95} z={0.25} />
      {/* Cadeira (opcional — salas pessoais usam OfficeChair clicável) */}
      {chair && (
        <group position={[0, 0, 0.65]}>
          <mesh geometry={g.box} material={m.chairSeat} position={[0, 0.42, 0]} scale={[0.42, 0.07, 0.42]} castShadow />
          <mesh position={[0, 0.7, -0.11]} material={m.chairSeat} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.5, 14, 1, true, -0.85, 1.7]} />
          </mesh>
          <mesh geometry={g.cyl8} material={m.metalLight} position={[0, 0.2, 0]} scale={[0.04, 0.4, 0.04]} />
        </group>
      )}
    </group>
  )
}

/** TV de parede pequena (reunião e setor): moldura (televisionModern sem o
 * pé) e a tela apagada azulada na frente. Tudo local, virado pra +z: o grupo
 * pai posiciona e vira a TV. `wallGap` = distância da tela até a parede de
 * trás (a moldura engrossa até encostar); fina quando não há parede atrás. */
function WallTv({ wallGap = 0.135 }: { wallGap?: number }) {
  return (
    <group>
      <Modeled
        fallback={
          <mesh position={[0, 1.7, 0]} castShadow material={mats().bezel}>
            <boxGeometry args={[2.2, 1.15, 0.08]} />
          </mesh>
        }
      >
        <TvFrameModel y={1.7} z={0.045} w={2.05} h={1.0} wallGap={wallGap} />
      </Modeled>
      <mesh position={[0, 1.7, 0.045]} material={mats().screenOff}>
        <boxGeometry args={[2.05, 1.0, 0.005]} />
      </mesh>
    </group>
  )
}

/** Mesa de reunião com as cadeiras em volta, TV no fundo, luminárias
 * pendentes e quadro branco. `tv={false}` quando a sala já tem o telão de
 * dados (DataTvs) no mesmo lugar. */
function MeetingTable({ room, tv = true }: { room: OfficeRoom; tv?: boolean }) {
  const len = Math.max(3, room.width - 4.5)
  // Cadeiras em coordenadas de mundo (clicáveis → sentar). Encosto sempre
  // pro lado oposto da mesa (sentado olhando pra mesa).
  const chairs = useMemo(() => {
    const perSide = Math.max(2, Math.floor(len / 1.3))
    const out: SeatSpot[] = []
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
      <Modeled fallback={<MeetingTableProc room={room} len={len} />}>
        <MeetingTableModel x={room.x} z={room.z} len={len} />
      </Modeled>
      <group position={[room.x, 0, room.z]}>
        {/* TV na parede do fundo (tela acesa) */}
        {tv && (
          <group position={[0, 0, -room.depth / 2 + 0.25]}>
            {/* porta ao norte: a TV fica no vão da porta, sem parede atrás */}
            <WallTv wallGap={room.doorSide === 'N' ? 0.06 : 0.135} />
          </group>
        )}
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
      {/* Cadeiras: uma InstancedMesh por primitiva, tecido na cor da sala */}
      <Modeled
        fallback={
          <>
            {chairs.map((c, i) => (
              <OfficeChairProc key={i} x={c.x} z={c.z} rotation={c.backRot} color="#37404d" />
            ))}
          </>
        }
      >
        <ChairsModel seats={chairs} color={room.color} kind="cushion" dark />
      </Modeled>
      {/* Quadro branco na parede leste, virado pra mesa */}
      <Whiteboard x={room.x + room.width / 2 - 0.22} z={room.z} rotation={-Math.PI / 2} y={1.35} />
    </group>
  )
}

/** Tampo e pés da mesa de reunião procedural (fallback). */
function MeetingTableProc({ room, len }: { room: OfficeRoom; len: number }) {
  return (
    <group position={[room.x, 0, room.z]}>
      {/* Tampo nobre com folha de madeira e borda arredondada */}
      <RoundedBox args={[len, 0.06, 1.7]} radius={0.025} smoothness={2} position={[0, 0.76, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={woodTexture()} color="#9a6a40" roughness={0.3} />
      </RoundedBox>
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
    </group>
  )
}

/** Mesa bistrô procedural com 4 banquetas clicáveis (fallback do BistroSetModel). */
function BistroTableProc({ x, z }: { x: number; z: number }) {
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

/** Lounge aberto: praça de convivência com vários núcleos de conversa,
 * mesas bistrô e o canto de copa no fundo. (As plantas saem na lista do
 * andar: roomPlantSpots.) */
function LoungeFurniture({ room }: { room: OfficeRoom }) {
  const left = room.x - room.width / 2
  const right = room.x + room.width / 2
  const backZ = room.z - room.depth / 2
  const bistros = useMemo(
    () => [
      { x: right - 3, z: room.z + 0.6 },
      { x: right - 5.4, z: room.z + 2.2 },
      { x: right - 1.8, z: room.z + 2.8 },
    ],
    [right, room.z]
  )

  return (
    <group>
      {/* Canto de copa no lugar do balcão de café (fundo, lado leste) */}
      <Modeled
        fallback={
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
        }
      >
        <CopaModel x={right - 2.4} z={backZ + 1.1} />
      </Modeled>

      {/* Núcleo oeste: sofás em L + mesa de centro + luminária de piso no canto */}
      <Rug x={left + 3.2} z={room.z - 0.2} color="#8B6F47" />
      <Sofa x={left + 3.2} z={room.z - 1.7} rotation={0} color="#7a5c3e" variant={0} />
      <Sofa x={left + 1.6} z={room.z - 0.2} rotation={Math.PI / 2} color="#7a5c3e" variant={0} />
      <CoffeeTable x={left + 3.4} z={room.z - 0.3} />
      <Armchair x={left + 4.9} z={room.z - 0.3} rotation={-Math.PI / 2} color="#8a6248" />
      {/* Só com os modelos (sem fallback): luminária de piso no canto e caixa de som */}
      <Modeled fallback={null}>
        <FloorLampModel x={left + 1.55} z={room.z - 1.75} rotation={Math.PI / 4} />
        <SpeakerModel x={left + 4.55} z={room.z - 1.9} />
      </Modeled>

      {/* Núcleo central: sofás frente a frente */}
      <Rug x={room.x - 0.5} z={room.z + 1.4} color="#5a6b7d" shape="rect" />
      <Sofa x={room.x - 0.5} z={room.z + 2.5} rotation={Math.PI} color="#5a6b7d" variant={1} />
      <Sofa x={room.x - 0.5} z={room.z + 0.3} rotation={0} color="#5a6b7d" variant={1} />
      <CoffeeTable x={room.x - 0.5} z={room.z + 1.4} />

      {/* Lounge largo (> 12): repete sofá + mesa de centro nos vãos */}
      {loungeExtraSets(room).map((sx, i) => (
        <group key={sx}>
          <Rug x={sx} z={room.z + 1.4} color="#6b5a7d" shape="rect" />
          <Sofa x={sx} z={room.z + 2.5} rotation={Math.PI} color="#6b5a7d" variant={i} />
          <Sofa x={sx} z={room.z + 0.3} rotation={0} color="#6b5a7d" variant={i} />
          <CoffeeTable x={sx} z={room.z + 1.4} />
        </group>
      ))}

      {/* Mesas bistrô (leste) */}
      <Modeled
        fallback={
          <>
            {bistros.map((b) => (
              <BistroTableProc key={`${b.x}:${b.z}`} x={b.x} z={b.z} />
            ))}
          </>
        }
      >
        <BistroSetModel tables={bistros} />
      </Modeled>
    </group>
  )
}

/** Sofá de dois lugares; clique escolhe o assento mais próximo do ponto
 * clicado. `variant` alterna o modelo (loungeSofa / loungeDesignSofa). */
function Sofa({ x, z, rotation = 0, color = '#5a6b7d', variant = 0 }: { x: number; z: number; rotation?: number; color?: string; variant?: number }) {
  return (
    <Modeled fallback={<SofaProc x={x} z={z} rotation={rotation} color={color} />}>
      <SofaModel x={x} z={z} rotation={rotation} color={color} variant={variant} />
    </Modeled>
  )
}

function Armchair({ x, z, rotation = 0, color = '#7d6b5a' }: { x: number; z: number; rotation?: number; color?: string }) {
  return (
    <Modeled fallback={<ArmchairProc x={x} z={z} rotation={rotation} color={color} />}>
      <ArmchairModel x={x} z={z} rotation={rotation} color={color} />
    </Modeled>
  )
}

function Bookshelf({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <Modeled fallback={<BookshelfProc x={x} z={z} rotation={rotation} />}>
      <BookshelfModel x={x} z={z} rotation={rotation} />
    </Modeled>
  )
}

/** Tapete: redondo (2 m, como sempre) ou retangular entre sofás frente a frente. */
function Rug({ x, z, color, shape = 'round' }: { x: number; z: number; color: string; shape?: 'round' | 'rect' }) {
  return (
    <Modeled fallback={<RugProc x={x} z={z} color={color} />}>
      <RugModel x={x} z={z} color={color} shape={shape} />
    </Modeled>
  )
}

/** Mesa de centro. `rotation` só vale pro modelo (a procedural é redonda). */
function CoffeeTable({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <Modeled fallback={<CoffeeTableProc x={x} z={z} />}>
      <CoffeeTableModel x={x} z={z} rotation={rotation} />
    </Modeled>
  )
}

function SofaProc({ x, z, rotation = 0, color = '#5a6b7d' }: { x: number; z: number; rotation?: number; color?: string }) {
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

function ArmchairProc({ x, z, rotation = 0, color = '#7d6b5a' }: { x: number; z: number; rotation?: number; color?: string }) {
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

function BookshelfProc({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
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

function RugProc({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <mesh position={[x, 0.009, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[1, 24]} />
      <meshStandardMaterial color={color} roughness={1} transparent opacity={0.55} />
    </mesh>
  )
}

function CoffeeTableProc({ x, z }: { x: number; z: number }) {
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
    for (const p of Object.values(st.remotePlayers)) {
      if (playerFloor(p) !== st.floor) continue // quem está em outro andar não abre a porta
      check(p.position[0], p.position[2])
    }
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
 * cadeiras de visita na frente. Todas as cadeiras são clicáveis (sentar).
 * O tecido das cadeiras leva a cor da sala. (A planta sai na lista do
 * andar: roomPlantSpots.) */
function PersonalFurniture({ room }: { room: OfficeRoom }) {
  // door é sempre N nas pessoais: fundo = z + depth/2
  const backZ = room.z + room.depth / 2
  const deskZ = backZ - 1.3
  const h = hashRoom(room.id)
  const variant = h % 4
  const visitors = useMemo<SeatSpot[]>(
    () => [
      { x: room.x - 0.55, z: deskZ - 1.4, backRot: Math.PI },
      { x: room.x + 0.55, z: deskZ - 1.4, backRot: Math.PI },
    ],
    [room.x, deskZ]
  )
  return (
    <group>
      <Desk
        x={room.x}
        z={deskZ}
        rotation={0}
        laptop={(h >> 2) % 3 === 0}
        lamp
        noteTarget={
          room.ownerUserId
            ? { userId: room.ownerUserId, name: room.name.replace(/^Sala\s+/i, '') }
            : undefined
        }
      />
      {/* Cadeira do dono: atrás da mesa, de frente pra porta */}
      <OfficeChair x={room.x} z={deskZ + 0.7} rotation={0} color={room.color} />
      {/* Cadeiras de visita: na frente da mesa, de frente pro dono */}
      <Modeled
        fallback={
          <>
            {visitors.map((v) => (
              <OfficeChairProc key={v.x} x={v.x} z={v.z} rotation={v.backRot} color="#6b4f34" />
            ))}
          </>
        }
      >
        <ChairsModel seats={visitors} color={room.color} kind="cushion" />
      </Modeled>
      <WallArt x={room.x + (variant % 2 === 0 ? 1.6 : -1.6)} z={backZ - 0.25} color={room.color} />
      {variant === 0 && (
        <>
          <Rug x={room.x} z={room.z - 0.6} color={room.color} />
          <Armchair x={room.x + room.width / 2 - 0.85} z={room.z - 0.7} rotation={-Math.PI / 2} />
        </>
      )}
      {variant === 1 && (
        <>
          <Sofa x={room.x - room.width / 2 + 1.05} z={room.z - 0.5} rotation={Math.PI / 2} color="#6b5a7d" variant={h >> 4} />
          <CoffeeTable x={room.x + 0.3} z={room.z - 0.5} rotation={Math.PI / 2} />
        </>
      )}
      {variant === 2 && (
        <>
          <Bookshelf x={room.x - room.width / 2 + 0.35} z={room.z - 0.4} rotation={Math.PI / 2} />
          <Armchair x={room.x + 0.9} z={room.z - 1} rotation={Math.PI} color="#5a7d6b" />
        </>
      )}
      {variant === 3 && (
        <>
          <Armchair x={room.x - 0.9} z={room.z - 1} rotation={Math.PI / 4} color="#8a6248" />
          <Armchair x={room.x + 0.9} z={room.z - 1} rotation={-Math.PI / 4} color="#8a6248" />
          <CoffeeTable x={room.x} z={room.z - 1.4} />
          <Rug x={room.x} z={room.z - 1.2} color={room.color} />
        </>
      )}
    </group>
  )
}

/** Sala de setor: ilhas de mesas duplas proporcionais ao tamanho da sala
 * (uma a cada ~3.4 de largura, até 2 fileiras). Cada ilha = duas mesas
 * encostadas, uma cadeira ao sul (olha pro norte) e uma ao norte (olha pro
 * sul), todas clicáveis. Mesmo cálculo do collider (sectorIslands). Com os
 * modelos, a sala inteira sai instanciada (SectorIslandsModel). */
function SectorFurniture({ room }: { room: OfficeRoom }) {
  const islands = useMemo(() => sectorIslands(room), [room])
  const rooms = useTeamStore((s) => s.roomsOnFloor)
  const south = room.doorSide === 'S'
  const backZ = south ? room.z - room.depth / 2 : room.z + room.depth / 2
  return (
    <group>
      <Modeled
        fallback={
          <>
            {islands.map((isl, i) => (
              <group key={i}>
                <DeskProc x={isl.x} z={isl.z + 0.45} rotation={0} chair={false} />
                <DeskProc x={isl.x} z={isl.z - 0.45} rotation={Math.PI} chair={false} />
                <OfficeChairProc x={isl.x} z={isl.z + 1.12} rotation={0} color="#37404d" />
                <OfficeChairProc x={isl.x} z={isl.z - 1.12} rotation={Math.PI} color="#37404d" />
              </group>
            ))}
          </>
        }
      >
        <SectorIslandsModel islands={islands} color={room.color} />
      </Modeled>
      {/* TV na parede do fundo (nas salas com telão de dados, o DataTvs ocupa o lugar) */}
      {!(south && roomHasDataTv(room, rooms)) && (
        <group position={[room.x, 0, backZ + (south ? 0.25 : -0.25)]} rotation={[0, south ? 0 : Math.PI, 0]}>
          <WallTv />
        </group>
      )}
      {/* Quadro branco ao lado da TV (fundo da sala) */}
      <Whiteboard
        x={room.x - room.width / 2 + 2.4}
        z={backZ + (south ? 0.2 : -0.2)}
        rotation={south ? 0 : Math.PI}
        w={1.7}
        h={1.05}
      />
    </group>
  )
}

/** Plateia do auditório: poltronas instanciadas nas posições do
 * auditoriumLayout; clicar numa senta nela. `rot` = direção do encosto. */
function TheaterSeats({ seats }: { seats: { x: number; z: number; rot: number }[] }) {
  return (
    <Modeled fallback={<TheaterSeatsProc seats={seats} />}>
      <TheaterSeatsModel seats={seats} />
    </Modeled>
  )
}

/** Plateia procedural (fallback) em 4 InstancedMesh (assento, encosto, base,
 * braços): dezenas de poltronas = 4 draw calls. Clique no assento/encosto
 * → senta na poltrona daquele instanceId. `rot` = direção do encosto. */
function TheaterSeatsProc({ seats }: { seats: { x: number; z: number; rot: number }[] }) {
  const seatRef = useRef<THREE.InstancedMesh>(null!)
  const backRef = useRef<THREE.InstancedMesh>(null!)
  const baseRef = useRef<THREE.InstancedMesh>(null!)
  const armRef = useRef<THREE.InstancedMesh>(null!)
  const m = mats()
  const n = seats.length
  const geo = useMemo(
    () => ({
      seat: new THREE.BoxGeometry(0.66, 0.12, 0.5),
      back: new THREE.CylinderGeometry(0.42, 0.42, 0.58, 12, 1, true, -0.95, 1.9),
      base: new THREE.BoxGeometry(0.6, 0.36, 0.42),
      arm: new THREE.BoxGeometry(0.72, 0.05, 0.42),
    }),
    []
  )
  useEffect(() => {
    const mat = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const axis = new THREE.Vector3(0, 1, 0)
    const place = (mesh: THREE.InstancedMesh | null, i: number, s: { x: number; z: number; rot: number }, lx: number, ly: number, lz: number) => {
      if (!mesh) return
      q.setFromAxisAngle(axis, s.rot)
      const c = Math.cos(s.rot)
      const sn = Math.sin(s.rot)
      pos.set(s.x + lx * c + lz * sn, ly, s.z - lx * sn + lz * c)
      mat.compose(pos, q, one)
      mesh.setMatrixAt(i, mat)
    }
    seats.forEach((st, i) => {
      place(seatRef.current, i, st, 0, 0.42, 0.02)
      // Encosto curvo: centro do cilindro atrás do assento, concavidade pra frente
      place(backRef.current, i, st, 0, 0.78, -0.16)
      place(baseRef.current, i, st, 0, 0.18, 0.02)
      place(armRef.current, i, st, 0, 0.58, 0.04)
    })
    for (const r of [seatRef, backRef, baseRef, armRef]) if (r.current) r.current.instanceMatrix.needsUpdate = true
  }, [seats])
  const onClick = (e: { stopPropagation: () => void; delta: number; instanceId?: number }) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const i = e.instanceId
    if (i == null || !seats[i]) return
    const st = seats[i]
    sitAt(st.x, st.z, st.rot + Math.PI)
  }
  const hover = {
    onPointerOver: () => (document.body.style.cursor = 'pointer'),
    onPointerOut: () => (document.body.style.cursor = 'default'),
  }
  if (n === 0) return null
  return (
    <group>
      <instancedMesh ref={seatRef} args={[geo.seat, m.theaterSeat, n]} castShadow onClick={onClick} {...hover} />
      <instancedMesh ref={backRef} args={[geo.back, m.theaterBack, n]} castShadow onClick={onClick} {...hover} />
      <instancedMesh ref={baseRef} args={[geo.base, m.theaterBase, n]} />
      <instancedMesh ref={armRef} args={[geo.arm, m.theaterBase, n]} />
    </group>
  )
}

/** Spot de palco apontando pro tablado. O alvo do spotLight precisa estar na
 * cena (senão o three aponta pra origem do mundo): usamos um ref e atualizamos
 * a matriz do alvo na mão. */
function StageSpot({ targetX, targetZ, intensity }: { targetX: number; targetZ: number; intensity: number }) {
  const ref = useRef<THREE.SpotLight>(null!)
  useEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.set(targetX, 0, targetZ)
    light.target.updateMatrixWorld()
  }, [targetX, targetZ])
  return <spotLight ref={ref} angle={0.55} penumbra={0.6} intensity={intensity} distance={9} color="#fff0cc" />
}

/** Auditório UNV: palco elevado no fundo com púlpito e telão, 4 fileiras de
 * poltronas em arco viradas pro palco, corredor central, spots de palco e
 * placa na porta. (Layout = auditoriumLayout, mesma fonte do collider e das
 * regras de áudio.) O telão vira a tela compartilhada de quem está no palco
 * (ScreenShareTvs cobre este painel). */
function AuditoriumFurniture({ room }: { room: OfficeRoom }) {
  const a = useMemo(() => auditoriumLayout(room), [room])
  const st = a.stage
  const stageW = st.maxX - st.minX
  const stageD = st.maxZ - st.minZ
  const stageX = (st.minX + st.maxX) / 2
  const stageZ = (st.minZ + st.maxZ) / 2
  const frontZ = room.z + room.depth / 2
  return (
    <group>
      {/* Palco: tablado de madeira escura com frente em navy */}
      <mesh position={[stageX, STAGE_H / 2, stageZ]} castShadow receiveShadow>
        <boxGeometry args={[stageW, STAGE_H, stageD]} />
        <meshStandardMaterial map={woodTexture()} color="#6b4a2e" roughness={0.6} />
      </mesh>
      <mesh position={[stageX, STAGE_H / 2, st.maxZ + 0.01]}>
        <boxGeometry args={[stageW, STAGE_H - 0.02, 0.02]} />
        <meshStandardMaterial color="#0D2B5E" roughness={0.6} />
      </mesh>
      {/* Rampas laterais (visual: o palco não colide, o boneco sobe por qualquer lado) */}
      {[st.minX - 0.6, st.maxX + 0.6].map((rx) => (
        <mesh key={rx} position={[rx, STAGE_H / 2, stageZ]} rotation={[0, 0, rx < stageX ? 0.26 : -0.26]} receiveShadow>
          <boxGeometry args={[1.3, 0.04, stageD * 0.5]} />
          <meshStandardMaterial color="#4f3a28" roughness={0.7} />
        </mesh>
      ))}
      {/* Púlpito */}
      <group position={[a.podium.x, STAGE_H, a.podium.z]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.9, 1.1, 0.5]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.12, -0.05]} rotation={[-0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.95, 0.04, 0.5]} />
          <meshStandardMaterial map={woodTexture()} color="#caa06a" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.7, 0.26]}>
          <boxGeometry args={[0.5, 0.3, 0.01]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
        </mesh>
        {/* Microfone de haste */}
        <mesh position={[0.25, 1.4, -0.1]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.45, 6]} />
          <meshStandardMaterial color="#23262c" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.25, 1.62, -0.17]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color="#1d1f24" roughness={0.5} />
        </mesh>
      </group>
      {/* Cortina pregueada no fundo do palco (atrás do telão) */}
      <Curtain x={stageX} y={STAGE_H + 1.9} z={st.minZ + 0.08} w={stageW - 0.4} h={3.8} />
      {/* Telão no fundo do palco: moldura + tela acesa (a tela compartilhada cobre) */}
      <group position={[a.screen.x, a.screen.y, a.screen.z]}>
        <mesh position={[0, 0, -0.12]} castShadow>
          <boxGeometry args={[a.screen.w + 0.3, a.screen.h + 0.3, 0.24]} />
          <meshStandardMaterial color="#0d0f13" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[a.screen.w, a.screen.h]} />
          <meshStandardMaterial color="#13294a" emissive="#0D2B5E" emissiveIntensity={0.7} />
        </mesh>
        <Text position={[0, 0.25, 0.01]} fontSize={0.6} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#0D2B5E">
          Auditório UNV
        </Text>
        <Text position={[0, -0.45, 0.01]} fontSize={0.22} color="#FFD700" anchorX="center" anchorY="middle">
          suba ao palco e compartilhe a tela pra projetar aqui
        </Text>
      </group>
      {/* Treliça com spots de palco (luz real sem sombra: barata) */}
      <mesh position={[stageX, 3.6, st.maxZ + 0.6]}>
        <boxGeometry args={[stageW * 0.8, 0.08, 0.08]} />
        <meshStandardMaterial color="#23262c" metalness={0.6} roughness={0.4} />
      </mesh>
      {[-0.3, 0, 0.3].map((f) => {
        const lx = stageX + f * stageW * 0.8
        return (
          <group key={f} position={[lx, 3.56, st.maxZ + 0.6]}>
            <mesh rotation={[0.9, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.14, 0.3, 10]} />
              <meshStandardMaterial color="#1d1f24" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.12, -0.12]} rotation={[0.9, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.02, 10]} />
              <meshStandardMaterial color="#fff2cc" emissive="#ffe8a8" emissiveIntensity={1.6} />
            </mesh>
            <StageSpot targetX={lx} targetZ={stageZ} intensity={f === 0 ? 14 : 9} />
          </group>
        )
      })}
      {/* Corredor central (carpete vermelho) até o palco */}
      <mesh position={[a.aisle.x, 0.007, (a.aisle.zMin + a.aisle.zMax) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[a.aisle.w, a.aisle.zMax - a.aisle.zMin]} />
        <meshStandardMaterial color="#7a1a1a" roughness={1} />
      </mesh>
      {/* Plateia em arco (instanciada) */}
      <TheaterSeats seats={a.seats} />
      {/* Placa na porta (lado do corredor) */}
      <group position={[room.x, 2.45, frontZ + 0.22]}>
        <mesh castShadow>
          <boxGeometry args={[4.2, 0.62, 0.1]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.27, 0.051]}>
          <boxGeometry args={[4.2, 0.07, 0.01]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.03, 0.06]} fontSize={0.36} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#0D2B5E">
          Auditório UNV
        </Text>
      </group>
    </group>
  )
}

/** Sala de reunião com cliente: mesa de reunião (com TV no fundo, que o
 * DataTvs cobre com o painel do cliente) + placa de reserva na porta. */
function ClientFurniture({ room }: { room: OfficeRoom }) {
  const reservations = useTeamStore((s) => s.clientReservations)
  const me = useTeamStore((s) => s.me)
  const res = currentReservation(room.id, reservations)
  // Visitante não lê as reservas: a placa mostra o convite dele quando é desta sala
  const guestHere = me?.isGuest && me.invite?.roomId === room.id
  const label = res
    ? `Reservada · ${res.company} · ${hourLabel(res.scheduledAt)}`
    : guestHere
      ? `Reservada · ${me?.invite?.company ?? 'Visitante'}`
      : 'Disponível'
  const frontZ = room.z + room.depth / 2
  const busy = !!res || !!guestHere
  return (
    <group>
      {/* a TV daqui é o telão do painel do cliente (DataTvs), sobre um aparador */}
      <MeetingTable room={room} tv={false} />
      {/* Placa de reserva ao lado da porta, virada pro corredor */}
      <group position={[room.x + 2.9, 1.55, frontZ + 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[2.6, 0.5, 0.08]} />
          <meshStandardMaterial color={busy ? '#7a1414' : '#1B6B3A'} roughness={0.55} />
        </mesh>
        <Text position={[0, 0.08, 0.05]} fontSize={0.15} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={2.4}>
          {label}
        </Text>
        <Text position={[0, -0.14, 0.05]} fontSize={0.1} color="rgba(255,255,255,0.75)" anchorX="center" anchorY="middle">
          {room.name}
        </Text>
      </group>
    </group>
  )
}

/** Luminárias pendentes da sala: uma fileira ao longo da largura (a cada
 * ~4 m). Sem luz real (só emissivo): a luz vem da direcional, do ambiente e
 * das luminárias do corredor. Modo médio renderiza metade. */
function RoomLamps({ room }: { room: OfficeRoom }) {
  const graphics = useTeamStore((s) => s.graphics)
  const frac = graphicsParams(graphics).lampFraction
  const lamps = useMemo(() => {
    const n = Math.max(1, Math.round(room.width / 4.2))
    const pitch = room.width / n
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      if (frac < 1 && i % 2 === 1) continue
      out.push(room.x - room.width / 2 + pitch * (i + 0.5))
    }
    return out
  }, [room.x, room.width, frac])
  const y = room.roomType === 'auditorium' ? 3.2 : 2.5
  return (
    <group>
      {lamps.map((lx) => (
        <CeilingLamp key={lx} x={lx} z={room.z} y={y} len={Math.min(2.6, room.depth * 0.4)} rotation={Math.PI / 2} />
      ))}
    </group>
  )
}

/** Onde ficam as plantas de vaso de uma sala (as mesmas posições de sempre,
 * por tipo de sala). Planta que cairia dentro de um móvel com colisão (o
 * balcão no lounge de 10 m) fica de fora. */
function roomPlantSpots(room: OfficeRoom): { x: number; z: number }[] {
  const left = room.x - room.width / 2
  const right = room.x + room.width / 2
  const north = room.z - room.depth / 2
  const south = room.z + room.depth / 2
  let out: { x: number; z: number }[] = []
  if (room.roomType === 'lounge') {
    out = [
      { x: left + 0.8, z: north + 0.9 },
      { x: left + 0.8, z: south - 0.9 },
      { x: room.x + 1.5, z: north + 0.8 },
      { x: right - 0.8, z: south - 0.9 },
    ]
  } else if (room.roomType === 'personal') {
    // door é sempre N nas pessoais: fundo = sul
    const deskZ = south - 1.3
    const variant = hashRoom(room.id) % 4
    if (variant === 0) out = [{ x: left + 0.7, z: deskZ }]
    else if (variant === 1) out = [{ x: right - 0.7, z: south - 0.8 }]
    else if (variant === 2) out = [{ x: right - 0.7, z: deskZ }]
    else out = [{ x: left + 0.7, z: south - 0.8 }]
  } else if (room.roomType === 'sector') {
    // pontas do fundo
    const z = room.doorSide === 'S' ? north + 0.8 : south - 0.8
    out = [
      { x: right - 0.8, z },
      { x: left + 0.8, z },
    ]
  } else if (room.roomType === 'auditorium') {
    out = [
      { x: left + 0.8, z: north + 0.9 },
      { x: right - 0.8, z: north + 0.9 },
    ]
  } else if (room.roomType === 'client') {
    out = [{ x: left + 0.8, z: north + 0.9 }]
  }
  const blocks = furnitureColliders([room])
  const pad = 0.15
  return out.filter((p) => !blocks.some((b) => p.x > b.minX - pad && p.x < b.maxX + pad && p.z > b.minZ - pad && p.z < b.maxZ + pad))
}

/** Todas as plantas de vaso do andar (salas + corredor + recepção) numa
 * InstancedMesh por primitiva. Fallback: as plantas procedurais de sempre. */
function FloorPlants({ rooms, extra }: { rooms: OfficeRoom[]; extra: { x: number; z: number }[] }) {
  const spots = useMemo(() => [...extra, ...rooms.flatMap(roomPlantSpots)], [rooms, extra])
  return (
    <Modeled
      fallback={
        <>
          {spots.map((p) => (
            <RealPlant key={`${p.x}:${p.z}`} x={p.x} z={p.z} />
          ))}
        </>
      }
    >
      <PlantsModel spots={spots} />
    </Modeled>
  )
}

function RoomFurniture({ room }: { room: OfficeRoom }) {
  if (room.roomType === 'meeting') return <MeetingTable room={room} />
  if (room.roomType === 'auditorium') return <AuditoriumFurniture room={room} />
  if (room.roomType === 'client') return <ClientFurniture room={room} />
  if (room.roomType === 'lounge') return <LoungeFurniture room={room} />
  if (room.roomType === 'personal') return <PersonalFurniture room={room} />
  return <SectorFurniture room={room} />
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
            <mesh position={[cx, WALL_H / 2, cz]} castShadow receiveShadow material={mats().wall}>
              <boxGeometry args={[sx, WALL_H, sz]} />
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
            {/* Vidro (MeshPhysicalMaterial com clearcoat: reflexo do ambiente) */}
            <mesh position={[cx, WALL_H + GLASS_H / 2, cz]} material={mats().glass}>
              <boxGeometry args={[sx, GLASS_H, Math.min(sz, 0.08)]} />
            </mesh>
            {/* Perfil superior da esquadria */}
            <mesh position={[cx, WALL_H + GLASS_H, cz]} material={mats().metalDark}>
              <boxGeometry args={[sx + 0.02, 0.04, Math.min(sz + 0.02, 0.1)]} />
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
          <mesh position={[0, (2.0 + WALL_H + GLASS_H) / 2, 0]} material={mats().glass}>
            <boxGeometry args={[DOOR_W, WALL_H + GLASS_H - 2.0, 0.08]} />
          </mesh>
        </group>
      )}

      {/* Relógio de parede nas salas de trabalho/reunião */}
      {(room.roomType === 'sector' || room.roomType === 'meeting' || room.roomType === 'client') && (
        <WallClock x={room.x + room.width / 2 - 1.1} z={room.z - room.depth / 2 + 0.28} />
      )}
      {/* Pôster UNV na parede oeste (frase da marca) e luminárias pendentes */}
      {room.roomType !== 'auditorium' && room.roomType !== 'lounge' && (
        <Poster x={room.x - room.width / 2 + 0.2} z={room.z + (room.doorSide === 'N' ? 0.9 : -0.9)} rotation={Math.PI / 2} idx={hashRoom(room.id) % 4} y={1.25} />
      )}
      <RoomLamps room={room} />

      {/* Nome da sala */}
      <Billboard position={[room.x, WALL_H + GLASS_H + (room.roomType === 'auditorium' ? 2.4 : 0.55), room.z]} follow={true}>
        <Text
          fontSize={room.roomType === 'auditorium' ? 0.6 : 0.42}
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
  // Só as salas do andar atual são renderizadas (a planta é a mesma em todos)
  const rooms = useTeamStore((s) => s.roomsOnFloor)
  const floor = useTeamStore((s) => s.floor)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)

  const onlineIds = useMemo(() => {
    const ids = new Set(Object.keys(remotePlayers))
    if (me) ids.add(me.id)
    return ids
  }, [remotePlayers, me])

  // Laje do andar: térreo = BUILDING (igual ao que sempre foi); andares de
  // cima = retângulo proporcional às salas + elevador + corredor
  const bounds = useMemo(() => floorBounds(floor, rooms), [floor, rooms])
  const W = bounds.maxX - bounds.minX
  const D = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  // Faixas de corredor geradas a partir das salas/bounds (andares de cima):
  // uma horizontal entre a fileira norte (z<0) e a sul (z>0), pelas portas,
  // e uma vertical no eixo do elevador até a parede sul.
  const corridor = useMemo(() => {
    let northEdge = -Infinity
    let southEdge = Infinity
    for (const r of rooms) {
      if (r.z < 0) northEdge = Math.max(northEdge, r.z + r.depth / 2)
      else southEdge = Math.min(southEdge, r.z - r.depth / 2)
    }
    if (!Number.isFinite(northEdge)) northEdge = -2.5
    if (!Number.isFinite(southEdge)) southEdge = 2.5
    const width = Math.max(3, Math.min(6, southEdge - northEdge))
    return { z: (northEdge + southEdge) / 2, width }
  }, [rooms])

  // Janelas da fachada norte: a cada 7, a partir de minX + 4.5 (no térreo dá
  // exatamente as 8 de sempre)
  const windowsX = useMemo(() => {
    const out: number[] = []
    for (let wx = bounds.minX + 4.5; wx + 1.8 < bounds.maxX - 1; wx += 7) out.push(wx)
    return out
  }, [bounds])

  // Plantas do corredor: térreo mantém as posições de sempre
  const plantsX = useMemo(() => {
    if (floor === 0) return [-26, -14, -2, 10, 22]
    const out: number[] = []
    for (let px = bounds.minX + 4; px < bounds.maxX - 3; px += 12) {
      if (Math.abs(px) < 3) continue // não tapa o eixo do elevador
      out.push(px)
    }
    return out
  }, [floor, bounds])

  const carpet = (rep: number) => {
    const t = carpetTexture()
    t.repeat.set(rep, 1.6)
    return t
  }

  // Qualidade gráfica (fase 3): reflexo do piso, ContactShadows e orçamento
  // de luzes pontuais nas luminárias do corredor
  const graphics = useTeamStore((s) => s.graphics)
  const gp = graphicsParams(graphics)
  const floorMap = useMemo(() => {
    const t = floorTexture().clone()
    t.repeat.set(W / 4, D / 4)
    t.needsUpdate = true
    return t
  }, [W, D])
  const ceilingMap = useMemo(() => {
    const t = ceilingTexture().clone()
    t.repeat.set(W / 2.4, D / 2.4)
    t.needsUpdate = true
    return t
  }, [W, D])

  // Luminárias do corredor: as primeiras `maxPointLights` ganham luz real
  // (pointLight); as demais só o difusor emissivo. Ordenadas do centro pra
  // fora pra iluminar primeiro onde o jogador mais passa.
  const corridorLamps = useMemo(() => {
    const out: { x: number; z: number; rot: number; len: number }[] = []
    if (floor === 0) {
      for (const lx of [0, -12, 12, -24, 24]) out.push({ x: lx, z: 0, rot: 0, len: 3 })
      for (const lx of [0, -14, 14]) out.push({ x: lx, z: 13, rot: 0, len: 2.6 })
      out.push({ x: 0, z: 20.6, rot: Math.PI / 2, len: 2.6 })
    } else {
      const xs: number[] = []
      const pitch = 8
      for (let lx = 0; cx + lx < bounds.maxX - 2; lx += pitch) {
        xs.push(cx + lx)
        if (lx > 0) xs.push(cx - lx)
      }
      for (const lx of xs) out.push({ x: lx, z: corridor.z, rot: 0, len: 3 })
      out.push({ x: (ELEVATOR.minX + ELEVATOR.maxX) / 2, z: (corridor.z + bounds.maxZ - 0.3) / 2, rot: Math.PI / 2, len: 2.6 })
    }
    return out
  }, [floor, cx, bounds, corridor])

  // Janelas da fachada norte: vão real na parede (pilares entre elas, verga
  // em cima e parapeito embaixo), vidro de verdade com esquadria e peitoril.
  // A colisão continua sendo o clamp em bounds (não muda).
  const WIN_W = 3.6
  const WIN_Y0 = 0.9
  const WIN_Y1 = 2.25
  const northPillars = useMemo(() => {
    const out: { x: number; w: number }[] = []
    let x0 = bounds.minX
    for (const wx of windowsX) {
      const left = wx - WIN_W / 2
      out.push({ x: (x0 + left) / 2, w: left - x0 })
      x0 = wx + WIN_W / 2
    }
    out.push({ x: (x0 + bounds.maxX) / 2, w: bounds.maxX - x0 })
    return out.filter((p) => p.w > 0.05)
  }, [bounds, windowsX])

  // Plantas de vaso fora das salas: corredor central e, no térreo, a recepção
  const loosePlants = useMemo(() => {
    const out = plantsX.map((x) => ({ x, z: floor === 0 ? 0 : corridor.z }))
    if (floor === 0) out.push(...RECEPTION_PLANTS)
    return out
  }, [plantsX, floor, corridor.z])

  // Tudo que está dentro do grupo do escritório entra na layer das sombras
  // de contato (mobília, paredes); avatares ficam fora (são irmãos no Canvas).
  // Os modelos 3D já nascem na layer; `modelsReady` refaz a varredura (e a
  // sombra de contato, pela key) quando eles terminam de carregar.
  const modelsReady = useModelsReady()
  const officeRef = useRef<THREE.Group>(null!)
  useEffect(() => {
    officeRef.current?.traverse((o) => o.layers.enable(CONTACT_LAYER))
  }, [rooms, floor, graphics, modelsReady])

  return (
    <>
    {/* Sombras de contato sob a mobília (estáticas: calculadas uma vez por
        andar; os avatares usam a sombra da direcional + disco). Só no alto. */}
    {gp.contactShadows && <StaticContactShadows key={`cs-${floor}-${rooms.length}-${modelsReady ? 1 : 0}`} cx={cx} cz={cz} w={W} d={D} />}
    {/* Preload dos modelos 3D da mobília (cada peça cai na procedural enquanto carrega) */}
    <ModelsProbe />
    <group ref={officeRef}>
      {/* Piso geral: porcelanato com leve reflexo do ambiente (sem segunda
          passada de render: roughness baixa + envMap do Environment) */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorMap} roughness={gp.floorRoughness} metalness={0.04} envMapIntensity={gp.floorEnvIntensity} />
      </mesh>

      {/* Logomarca oficial UNV no piso do hall central (só no térreo) */}
      {floor === 0 && <FloorLogo />}

      {/* Laje de teto (casca do prédio): forro com luminárias e grelhas a
          3.2 m, plano virado pra BAIXO (FrontSide). Câmera acima dele (o
          caso de hoje: altura mínima da câmera é ~7) → backface culling o
          descarta sozinho, sem tampar nada; câmera baixa (abaixo de 3.2) →
          vê o forro por dentro. Sem transparência, custo zero. */}
      {floor === 0 && (
      <mesh position={[cx, CEILING_H, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={ceilingMap} roughness={0.9} side={THREE.FrontSide} />
      </mesh>
      )}
      {/* Borda da laje de teto (vista de cima: a moldura do andar) */}
      {floor === 0 && [
        { x: cx, z: bounds.minZ, w: W + 0.6, d: 0.6 },
        { x: cx, z: bounds.maxZ, w: W + 0.6, d: 0.6 },
        { x: bounds.minX, z: cz, w: 0.6, d: D + 0.6 },
        { x: bounds.maxX, z: cz, w: 0.6, d: D + 0.6 },
      ].map((p, i) => (
        <mesh key={`rim${i}`} position={[p.x, CEILING_H + 0.1, p.z]}>
          <boxGeometry args={[p.w, 0.2, p.d]} />
          <meshStandardMaterial color="#cfcac0" roughness={0.85} />
        </mesh>
      ))}

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

      {/* Faixas de corredor (carpete azul-petróleo). Térreo: as de sempre
          (corredor central, corredor do elevador e ala privada). Andares de
          cima: geradas dos bounds/salas. */}
      {floor === 0 ? (
        <>
          <mesh position={[cx, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[W, 5]} />
            <meshStandardMaterial map={carpet(12)} roughness={1} />
          </mesh>
          <mesh position={[cx, 0.004, 13]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[W, 3]} />
            <meshStandardMaterial map={carpet(12)} roughness={1} />
          </mesh>
          {/* Corredor entre as duas fileiras da ala privada */}
          <mesh position={[cx, 0.004, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[W, 1.6]} />
            <meshStandardMaterial map={carpet(12)} roughness={1} />
          </mesh>
          {/* Passagem vertical central da ala privada */}
          <mesh position={[0, 0.005, 21.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[10.2, 13.6]} />
            <meshStandardMaterial map={carpet(12)} roughness={1} />
          </mesh>
        </>
      ) : (
        <>
          {/* Horizontal: entre a fileira norte e a sul, passando pelas portas */}
          <mesh position={[cx, 0.004, corridor.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[W, corridor.width]} />
            <meshStandardMaterial map={carpet(Math.max(2, Math.round(W / 5)))} roughness={1} />
          </mesh>
          {/* Vertical: eixo do elevador, do corredor até a parede sul */}
          <mesh
            position={[(ELEVATOR.minX + ELEVATOR.maxX) / 2, 0.005, (corridor.z + bounds.maxZ - 0.3) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[3.2, bounds.maxZ - 0.3 - corridor.z]} />
            <meshStandardMaterial map={carpet(2)} roughness={1} />
          </mesh>
        </>
      )}

      {/* Perímetro do andar: no térreo a laje É o prédio (paredes, janelas e
          pôsteres aqui). Nos andares de cima a laje útil é menor que a torre:
          o TowerShell desenha a fachada do andar na borda do BUILDING. */}
      {floor === 0 && (
        <>
      {/* Paredes externas leste/oeste (claras, mate) */}
      {[
        { x: bounds.minX, z: cz, w: 0.4, d: D + 0.4 },
        { x: bounds.maxX, z: cz, w: 0.4, d: D + 0.4 },
      ].map((p, i) => (
        <mesh key={i} position={[p.x, CEILING_H / 2, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, CEILING_H, p.d]} />
          <meshStandardMaterial color="#ece8df" roughness={0.92} />
        </mesh>
      ))}
      {/* Parede norte com vãos de janela: parapeito, verga e pilares */}
      <mesh position={[cx, WIN_Y0 / 2, bounds.minZ]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, WIN_Y0, 0.4]} />
        <meshStandardMaterial color="#ece8df" roughness={0.92} />
      </mesh>
      <mesh position={[cx, (WIN_Y1 + CEILING_H) / 2, bounds.minZ]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, CEILING_H - WIN_Y1, 0.4]} />
        <meshStandardMaterial color="#ece8df" roughness={0.92} />
      </mesh>
      {northPillars.map((p, i) => (
        <mesh key={`np${i}`} position={[p.x, (WIN_Y0 + WIN_Y1) / 2, bounds.minZ]} castShadow receiveShadow>
          <boxGeometry args={[p.w, WIN_Y1 - WIN_Y0, 0.4]} />
          <meshStandardMaterial color="#ece8df" roughness={0.92} />
        </mesh>
      ))}
      {/* Janelas: vidro de verdade (vê-se a cidade atrás), esquadria e peitoril */}
      {windowsX.map((wx) => (
        <group key={`win${wx}`} position={[wx, 0, bounds.minZ]}>
          <mesh position={[0, (WIN_Y0 + WIN_Y1) / 2, 0]} material={mats().glass}>
            <boxGeometry args={[WIN_W, WIN_Y1 - WIN_Y0, 0.03]} />
          </mesh>
          {/* Esquadria: moldura + montante central + travessa */}
          {[-WIN_W / 2, 0, WIN_W / 2].map((mx) => (
            <mesh key={mx} geometry={geos().box} material={mats().metalDark} position={[mx, (WIN_Y0 + WIN_Y1) / 2, 0]} scale={[0.07, WIN_Y1 - WIN_Y0 + 0.06, 0.46]} />
          ))}
          {[WIN_Y0, (WIN_Y0 + WIN_Y1) / 2, WIN_Y1].map((my) => (
            <mesh key={my} geometry={geos().box} material={mats().metalDark} position={[0, my, 0]} scale={[WIN_W + 0.07, 0.06, 0.46]} />
          ))}
          {/* Peitoril (pedra clara) dos dois lados */}
          <mesh geometry={geos().box} position={[0, WIN_Y0 - 0.04, 0.3]} scale={[WIN_W + 0.3, 0.06, 0.3]} castShadow>
            <meshStandardMaterial color="#d9d4c8" roughness={0.5} />
          </mesh>
          <mesh geometry={geos().box} position={[0, WIN_Y0 - 0.04, -0.3]} scale={[WIN_W + 0.3, 0.06, 0.3]}>
            <meshStandardMaterial color="#d9d4c8" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Pôsteres UNV entre as janelas (lado de dentro da parede norte) */}
      {northPillars
        .filter((p) => p.w > 2.2)
        .map((p, i) => (
          <Poster key={`po${i}`} x={p.x} z={bounds.minZ + 0.22} rotation={0} idx={i} y={1.55} />
        ))}

        </>
      )}
      {/* FACHADA SUL — térreo: navy com faixa vermelha, letreiro e porta
          automática (portaria). Andares de cima: parede clara com janelões
          e a placa do andar; não dá pra sair do prédio por ali (colisão do
          perímetro vale em todos os andares). */}
      {floor === 0 && (
        <mesh position={[cx, 1.6, bounds.maxZ]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.4, 3.2, 0.4]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.55} />
        </mesh>
      )}
      {floor === 0 && (
        <>
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
          {/* Recepção no vão central, perto da entrada */}
          <Reception />
        </>
      )}

      {/* Elevador: mesmo lugar em todos os andares */}
      <Elevator />

      {/* Luminárias pendentes do corredor (as primeiras ganham luz real) */}
      {corridorLamps.map((l, i) => (
        <CeilingLamp key={`cl${i}`} x={l.x} z={l.z} rotation={l.rot} len={l.len} y={2.55} light={i < gp.maxPointLights} intensity={7} />
      ))}

      {/* Plantas de vaso do andar inteiro (corredor, recepção e salas) */}
      <FloorPlants rooms={rooms} extra={loosePlants} />

      {/* Salas */}
      {rooms.map((room) => (
        <Room key={room.id} room={room} locked={isEffectivelyLocked(room, onlineIds)} />
      ))}
    </group>
    </>
  )
}

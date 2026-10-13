// Elevador (mesmo lugar em todos os andares), recepção do térreo e fachada
// dos andares de cima (janelões no lugar da entrada). Tudo gerado em código,
// sem assets. Entrar na zona em frente ao elevador, apertar E perto dele ou
// clicar nele abre o painel "Andares" (visitante não tem acesso).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import type { Bounds } from '../lib/rooms'
import { ELEVATOR, ELEVATOR_ZONE, RECEPTION_DESK, floorShort, floorLabel } from '../lib/floors'
import { mats, geos, RealPlant, CeilingLamp } from './Decor'
import { sitAt, localToWorld } from '../lib/sit'

const EL_W = ELEVATOR.maxX - ELEVATOR.minX
const EL_D = ELEVATOR.maxZ - ELEVATOR.minZ
const EL_X = (ELEVATOR.minX + ELEVATOR.maxX) / 2
const EL_Z = (ELEVATOR.minZ + ELEVATOR.maxZ) / 2
const EL_H = 2.8
const DOOR_H = 2.2
const DOOR_PANEL_W = 0.95

function inZone(x: number, z: number): boolean {
  return x > ELEVATOR_ZONE.minX && x < ELEVATOR_ZONE.maxX && z > ELEVATOR_ZONE.minZ && z < ELEVATOR_ZONE.maxZ
}

function openPanel() {
  const st = useTeamStore.getState()
  if (st.me?.isGuest || st.floorChanging) return
  st.setElevatorOpen(true)
}

export function Elevator() {
  const floor = useTeamStore((s) => s.floor)
  const leftRef = useRef<THREE.Group>(null!)
  const rightRef = useRef<THREE.Group>(null!)
  const openTRef = useRef(0)
  // Começa "dentro" pra não abrir o painel no spawn (e ao chegar de elevador,
  // que deixa o jogador na frente da porta): só abre ao ENTRAR na zona.
  const wasInZoneRef = useRef(true)
  const zoneCheckRef = useRef(0)

  // Tecla E perto do elevador abre o painel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      const [px, , pz] = useTeamStore.getState().playerPosition
      if (Math.hypot(px - EL_X, pz - ELEVATOR.maxZ) < 2.8) openPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((_, delta) => {
    const st = useTeamStore.getState()
    const [px, , pz] = st.playerPosition
    const near = inZone(px, pz) || st.elevatorOpen || st.floorChanging

    // Portas deslizam quando alguém está na frente (ou o painel está aberto)
    const target = near ? 1 : 0
    openTRef.current += (target - openTRef.current) * Math.min(1, 5 * delta)
    const slide = openTRef.current * (DOOR_PANEL_W - 0.08)
    if (leftRef.current) leftRef.current.position.x = -DOOR_PANEL_W / 2 - slide
    if (rightRef.current) rightRef.current.position.x = DOOR_PANEL_W / 2 + slide

    // Entrou na zona → abre o painel uma vez (sai e volta pra abrir de novo)
    zoneCheckRef.current += delta
    if (zoneCheckRef.current > 0.2) {
      zoneCheckRef.current = 0
      const inside = inZone(px, pz)
      if (st.floorChanging) {
        wasInZoneRef.current = true // chegando de elevador: não reabre o painel
      } else {
        if (inside && !wasInZoneRef.current && !st.elevatorOpen && !st.seated) openPanel()
        wasInZoneRef.current = inside
      }
    }
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta > 6) return
        openPanel()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      {/* Caixa metálica do elevador */}
      <mesh position={[EL_X, EL_H / 2, EL_Z]} castShadow receiveShadow material={mats().brushed}>
        <boxGeometry args={[EL_W, EL_H, EL_D]} />
      </mesh>
      {/* Faixa escura no topo (caixa de máquinas) */}
      <mesh position={[EL_X, EL_H + 0.12, EL_Z]}>
        <boxGeometry args={[EL_W + 0.1, 0.24, EL_D + 0.1]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Batente da porta (sul) */}
      <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ + 0.03]}>
        <boxGeometry args={[DOOR_PANEL_W * 2 + 0.3, DOOR_H + 0.14, 0.06]} />
        <meshStandardMaterial color="#1f2227" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Vão escuro atrás das folhas */}
      <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ - 0.02]}>
        <boxGeometry args={[DOOR_PANEL_W * 2, DOOR_H, 0.08]} />
        <meshStandardMaterial color="#15171c" roughness={0.8} />
      </mesh>
      {/* Folhas de aço escovado */}
      <group ref={leftRef} position={[-DOOR_PANEL_W / 2, 0, 0]}>
        <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ + 0.08]} castShadow material={mats().brushed}>
          <boxGeometry args={[DOOR_PANEL_W - 0.04, DOOR_H, 0.05]} />
        </mesh>
      </group>
      <group ref={rightRef} position={[DOOR_PANEL_W / 2, 0, 0]}>
        <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ + 0.08]} castShadow material={mats().brushed}>
          <boxGeometry args={[DOOR_PANEL_W - 0.04, DOOR_H, 0.05]} />
        </mesh>
      </group>
      {/* Placa do andar atual, em cima da porta */}
      <group position={[EL_X, DOOR_H + 0.36, ELEVATOR.maxZ + 0.06]}>
        <mesh>
          <boxGeometry args={[2.3, 0.42, 0.05]} />
          <meshStandardMaterial color="#0f1116" roughness={0.45} />
        </mesh>
        <Text
          position={[0, 0.02, 0.03]}
          fontSize={0.2}
          color="#ffb347"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {floorShort(floor)}
        </Text>
      </group>
      {/* Botão de chamada (lado direito da porta) */}
      <group position={[EL_X + DOOR_PANEL_W + 0.42, 1.15, ELEVATOR.maxZ + 0.05]}>
        <mesh>
          <boxGeometry args={[0.18, 0.3, 0.04]} />
          <meshStandardMaterial color="#2a2d33" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.06, 0.03]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 10]} />
          <meshStandardMaterial color="#ffb347" emissive="#ff9f1c" emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0, -0.06, 0.03]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 10]} />
          <meshStandardMaterial color="#9aa3ad" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      {/* Placa de sinalização do andar (hall, à esquerda da porta): número
          grande + nome, placa escura e letra clara, em todos os andares */}
      <group position={[EL_X - DOOR_PANEL_W - 1.25, 1.5, ELEVATOR.maxZ + 0.06]}>
        <mesh>
          <boxGeometry args={[1.0, 1.25, 0.05]} />
          <meshStandardMaterial color="#15171c" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.58, 0.028]}>
          <boxGeometry args={[1.0, 0.06, 0.01]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.14, 0.03]} fontSize={0.62} color="#f4f1ea" anchorX="center" anchorY="middle">
          {floor === 0 ? 'T' : String(floor)}
        </Text>
        <Text position={[0, -0.36, 0.03]} fontSize={0.1} color="#c8d4e8" anchorX="center" anchorY="middle" maxWidth={0.92} textAlign="center">
          {floorLabel(floor).toUpperCase()}
        </Text>
      </group>
      {/* Mesma placa do lado direito, acima do botão de chamada */}
      <group position={[EL_X + DOOR_PANEL_W + 0.42, 1.75, ELEVATOR.maxZ + 0.05]}>
        <mesh>
          <boxGeometry args={[0.5, 0.42, 0.04]} />
          <meshStandardMaterial color="#15171c" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.02, 0.025]} fontSize={0.26} color="#f4f1ea" anchorX="center" anchorY="middle">
          {floor === 0 ? 'T' : String(floor)}
        </Text>
      </group>
      {/* Rótulo flutuante */}
      <Billboard position={[EL_X, EL_H + 0.75, EL_Z]} follow={true}>
        <Text fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#1a1a2e">
          Elevador
        </Text>
      </Billboard>
      {/* Tapete na frente da porta */}
      <mesh position={[EL_X, 0.007, ELEVATOR.maxZ + 0.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.6, 1.6]} />
        <meshStandardMaterial color="#3b4a5e" roughness={1} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

/** Sofá de espera da recepção (dois lugares, clicável pra sentar). */
function WaitingSofa({ x, z, rotation }: { x: number; z: number; rotation: number }) {
  const g = geos()
  const onSit = (px: number, pz: number) => {
    const seats: [number, number][] = [localToWorld(x, z, rotation, -0.42, 0.08), localToWorld(x, z, rotation, 0.42, 0.08)]
    const seat = seats.reduce((a, b) => (Math.hypot(a[0] - px, a[1] - pz) <= Math.hypot(b[0] - px, b[1] - pz) ? a : b))
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
      <mesh geometry={g.box} position={[0, 0.28, 0]} scale={[1.7, 0.5, 0.8]} castShadow>
        <meshStandardMaterial color="#2f3a4a" roughness={0.92} />
      </mesh>
      {[-0.42, 0.42].map((sx) => (
        <mesh key={sx} geometry={g.box} position={[sx, 0.55, 0.02]} scale={[0.78, 0.08, 0.72]} castShadow>
          <meshStandardMaterial color="#3a4658" roughness={0.95} />
        </mesh>
      ))}
      <mesh geometry={g.box} position={[0, 0.62, -0.32]} scale={[1.7, 0.45, 0.18]} castShadow>
        <meshStandardMaterial color="#2f3a4a" roughness={0.92} />
      </mesh>
      {[-0.78, 0.78].map((sx) => (
        <mesh key={sx} geometry={g.box} position={[sx, 0.5, 0]} scale={[0.16, 0.42, 0.8]} castShadow>
          <meshStandardMaterial color="#2f3a4a" roughness={0.92} />
        </mesh>
      ))}
      <mesh geometry={g.box} position={[-0.4, 0.62, -0.18]} rotation={[0.25, 0, 0.1]} scale={[0.34, 0.3, 0.12]} castShadow>
        <meshStandardMaterial color="#CC1B1B" roughness={0.95} />
      </mesh>
      <mesh geometry={g.box} position={[0.42, 0.62, -0.18]} rotation={[0.22, 0, -0.12]} scale={[0.34, 0.3, 0.12]} castShadow>
        <meshStandardMaterial color="#e8ddc8" roughness={0.95} />
      </mesh>
      {/* Pés metálicos */}
      {[-0.7, 0.7].map((sx) =>
        [-0.3, 0.3].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={g.cyl8} material={mats().metalDark} position={[sx, 0.03, sz]} scale={[0.02, 0.06, 0.02]} />
        ))
      )}
    </group>
  )
}

/** Recepção do térreo: balcão com frente curva, painel com a logo UNV
 * iluminada atrás, monitor, sofá de espera, plantas e luminária. O collider
 * continua o retângulo RECEPTION_DESK (a curva fica dentro dele). */
export function Reception() {
  const { x, z, w, d } = RECEPTION_DESK
  const m = mats()
  const g = geos()
  return (
    <group>
      <group position={[x, 0, z]}>
        {/* Corpo do balcão: caixa navy + frente curva (setor de cilindro) */}
        <mesh geometry={g.box} position={[0, 0.52, -0.08]} scale={[w, 1.04, d - 0.16]} castShadow receiveShadow>
          <meshStandardMaterial color="#0D2B5E" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.52, -d / 2 - 0.9]} castShadow>
          <cylinderGeometry args={[w / 2 + 0.25, w / 2 + 0.25, 1.04, 28, 1, true, -0.62, 1.24]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Friso vermelho acompanhando a curva */}
        <mesh position={[0, 0.3, -d / 2 - 0.9]}>
          <cylinderGeometry args={[w / 2 + 0.26, w / 2 + 0.26, 0.06, 28, 1, true, -0.62, 1.24]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Tampo claro (segue a curva) */}
        {/* Tampo curvo: setor de anel plano (sem a "fatia" até o centro) */}
        <mesh position={[0, 1.09, -d / 2 - 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[w / 2 - 0.3, w / 2 + 0.34, 28, 1, -Math.PI / 2 - 0.66, 1.32]} />
          <meshStandardMaterial color="#e9e3d6" roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={g.box} position={[0, 1.06, -0.12]} scale={[w + 0.16, 0.06, d - 0.1]} castShadow>
          <meshStandardMaterial color="#e9e3d6" roughness={0.35} />
        </mesh>
        {/* Monitor fino + campainha */}
        <group position={[-0.6, 1.09, -0.15]} rotation={[0, 0.25, 0]}>
          <mesh geometry={g.box} material={m.bezel} position={[0, 0.3, 0]} scale={[0.5, 0.32, 0.018]} />
          <mesh position={[0, 0.3, 0.01]} material={m.screen}>
            <planeGeometry args={[0.47, 0.29]} />
          </mesh>
          <mesh geometry={g.cyl8} material={m.metalLight} position={[0, 0.07, -0.04]} scale={[0.07, 0.012, 0.07]} />
          <mesh geometry={g.box} material={m.metalLight} position={[0, 0.16, -0.04]} scale={[0.04, 0.16, 0.015]} />
        </group>
        <mesh position={[0.7, 1.12, 0.12]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#c9a84c" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Painel atrás do balcão com a logo iluminada */}
        <group position={[0, 1.2, -d / 2 - 0.55]}>
          <mesh geometry={g.box} position={[0, 0, 0]} scale={[w + 0.4, 2.4, 0.12]} castShadow>
            <meshStandardMaterial color="#0D2B5E" roughness={0.55} />
          </mesh>
          <mesh geometry={g.box} position={[0, 0.5, 0.07]} scale={[1.9, 0.62, 0.02]}>
            <meshStandardMaterial color="#ffffff" emissive="#f2f6ff" emissiveIntensity={0.8} />
          </mesh>
          <Text position={[-0.45, 0.52, 0.09]} fontSize={0.42} color="#0D2B5E" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#0D2B5E">
            UN
          </Text>
          <Text position={[0.45, 0.52, 0.09]} fontSize={0.42} color="#CC1B1B" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#CC1B1B">
            V
          </Text>
          <Text position={[0, -0.05, 0.09]} fontSize={0.1} color="#ffffff" anchorX="center" anchorY="middle">
            UNIVERSIDADE NACIONAL DE VENDAS
          </Text>
          <mesh geometry={g.box} position={[0, -0.95, 0.07]} scale={[w + 0.4, 0.08, 0.01]}>
            <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
          </mesh>
          <pointLight position={[0, 0.6, 0.6]} intensity={2.5} distance={4} decay={2} color="#dfe9ff" />
        </group>
        {/* Cadeira da recepção (atrás do balcão) */}
        <mesh geometry={g.box} material={m.chairSeat} position={[0, 0.45, -0.75]} scale={[0.44, 0.08, 0.44]} castShadow />
        <mesh position={[0, 0.72, -1.21]} material={m.chairSeat} castShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.5, 12, 1, true, -0.75, 1.5]} />
        </mesh>
        {/* Placa */}
        <Billboard position={[0, 2.75, 0]} follow={true}>
          <Text fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#0D2B5E">
            Recepção UNV
          </Text>
        </Billboard>
      </group>
      <RealPlant x={-3.6} z={27.4} variant={1} />
      <RealPlant x={4.4} z={27.6} variant={0} />
      {/* Sofá de espera encostado na fachada, do lado oeste da porta */}
      <WaitingSofa x={-3.3} z={28.1} rotation={Math.PI} />
      <CeilingLamp x={0} z={24.5} rotation={0} len={3.2} light intensity={5} />
    </group>
  )
}

/** Centros x dos janelões da fachada sul dos andares de cima (mesma conta
 * pro vidro daqui e pros vãos na parede do ModernOffice). */
export const UPPER_PANE_W = 4.1
export const UPPER_PANE_Y0 = 0.6
export const UPPER_PANE_Y1 = 2.8
export function upperFacadePanes(bounds: Bounds): number[] {
  const out: number[] = []
  const cx = (bounds.minX + bounds.maxX) / 2
  const w = bounds.maxX - bounds.minX
  const n = Math.max(1, Math.floor((w - 2) / 4.5))
  const span = n * 4.5
  for (let i = 0; i < n; i++) out.push(cx - span / 2 + 2.25 + i * 4.5)
  return out
}

/** Andares de cima: no lugar da entrada, parede com janelões de vidro
 * (vãos reais na parede, abertos pelo ModernOffice) e a placa do andar. */
export function UpperFacade({ floor, bounds }: { floor: number; bounds: Bounds }) {
  const m = mats()
  // Parede sul da laje DESTE andar (proporcional às salas)
  const z = bounds.maxZ
  const cx = (bounds.minX + bounds.maxX) / 2
  const panes = useMemo(() => upperFacadePanes(bounds), [bounds])
  return (
    <group>
      {/* Janelões contínuos de vidro (a cidade e o céu aparecem atrás) */}
      {panes.map((wx) => (
        <group key={wx}>
          <mesh position={[wx, (UPPER_PANE_Y0 + UPPER_PANE_Y1) / 2, z]} material={m.glass}>
            <boxGeometry args={[UPPER_PANE_W, UPPER_PANE_Y1 - UPPER_PANE_Y0, 0.03]} />
          </mesh>
          {/* Esquadria: moldura, montante central e travessa */}
          {[-UPPER_PANE_W / 2, 0, UPPER_PANE_W / 2].map((mx) => (
            <mesh key={mx} geometry={geos().box} material={m.metalDark} position={[wx + mx, (UPPER_PANE_Y0 + UPPER_PANE_Y1) / 2, z]} scale={[0.07, UPPER_PANE_Y1 - UPPER_PANE_Y0 + 0.06, 0.46]} />
          ))}
          {[UPPER_PANE_Y0, (UPPER_PANE_Y0 + UPPER_PANE_Y1) / 2, UPPER_PANE_Y1].map((my) => (
            <mesh key={my} geometry={geos().box} material={m.metalDark} position={[wx, my, z]} scale={[UPPER_PANE_W + 0.07, 0.06, 0.46]} />
          ))}
        </group>
      ))}
      {/* Peitoril (dos dois lados da parede) */}
      {[-0.3, 0.3].map((dz) => (
        <mesh key={dz} position={[cx, UPPER_PANE_Y0 - 0.04, z + dz]}>
          <boxGeometry args={[bounds.maxX - bounds.minX - 0.4, 0.06, 0.3]} />
          <meshStandardMaterial color="#d9d4c8" roughness={0.6} />
        </mesh>
      ))}
      {/* Placa do andar (no meio da parede, de frente pro escritório) */}
      <group position={[cx, 1.7, z - 0.26]} rotation={[0, Math.PI, 0]}>
        <mesh>
          <boxGeometry args={[4.2, 0.6, 0.05]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.5} />
        </mesh>
        <Text position={[0, 0.02, 0.035]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle">
          {floorLabel(floor)}
        </Text>
      </group>
    </group>
  )
}

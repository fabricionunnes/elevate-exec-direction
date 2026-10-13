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
      <mesh position={[EL_X, EL_H / 2, EL_Z]} castShadow receiveShadow>
        <boxGeometry args={[EL_W, EL_H, EL_D]} />
        <meshStandardMaterial color="#8d939c" metalness={0.72} roughness={0.32} />
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
        <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ + 0.08]} castShadow>
          <boxGeometry args={[DOOR_PANEL_W - 0.04, DOOR_H, 0.05]} />
          <meshStandardMaterial color="#b9bec6" metalness={0.85} roughness={0.28} />
        </mesh>
      </group>
      <group ref={rightRef} position={[DOOR_PANEL_W / 2, 0, 0]}>
        <mesh position={[EL_X, DOOR_H / 2, ELEVATOR.maxZ + 0.08]} castShadow>
          <boxGeometry args={[DOOR_PANEL_W - 0.04, DOOR_H, 0.05]} />
          <meshStandardMaterial color="#b9bec6" metalness={0.85} roughness={0.28} />
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

function MiniPlant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.44, 12]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.04, 12]} />
        <meshStandardMaterial color="#4a3424" roughness={0.95} />
      </mesh>
      {[0, 1.1, 2.2, 3.3, 4.4, 5.5].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.16, 0.85, Math.cos(a) * 0.16]} rotation={[0.35, a, 0]} castShadow>
          <boxGeometry args={[0.1, 0.7, 0.03]} />
          <meshStandardMaterial color="#3f7a45" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/** Recepção do térreo: balcão, placa "Recepção UNV" e um vaso. */
export function Reception() {
  const { x, z, w, d } = RECEPTION_DESK
  return (
    <group>
      {/* Balcão: frente navy com friso vermelho, tampo claro */}
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 1.04, d]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.3, d / 2 + 0.005]}>
          <boxGeometry args={[w - 0.1, 0.06, 0.01]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.06, 0]} castShadow>
          <boxGeometry args={[w + 0.16, 0.06, d + 0.16]} />
          <meshStandardMaterial color="#e9e3d6" roughness={0.4} />
        </mesh>
        {/* Monitor e campainha de balcão */}
        <mesh position={[-0.6, 1.3, -0.1]} rotation={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.32, 0.02]} />
          <meshStandardMaterial color="#d3d6da" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.7, 1.12, 0.12]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#c9a84c" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Cadeira da recepção (atrás do balcão) */}
        <mesh position={[0, 0.45, -0.75]} castShadow>
          <boxGeometry args={[0.44, 0.08, 0.44]} />
          <meshStandardMaterial color="#2f3640" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.72, -0.95]} castShadow>
          <boxGeometry args={[0.44, 0.5, 0.06]} />
          <meshStandardMaterial color="#2f3640" roughness={0.75} />
        </mesh>
        {/* Placa */}
        <Billboard position={[0, 2.1, 0]} follow={true}>
          <Text fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#0D2B5E">
            Recepção UNV
          </Text>
        </Billboard>
      </group>
      <MiniPlant x={-3.6} z={27.4} />
      <MiniPlant x={4.4} z={27.6} />
    </group>
  )
}

/** Textura de céu com gradiente leve (azul no alto, claro embaixo). */
function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, '#5ea7e3')
  g.addColorStop(0.55, '#a9d0f0')
  g.addColorStop(1, '#e4f1fb')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Andares de cima: no lugar da entrada, parede com janelões e a placa do andar. */
export function UpperFacade({ floor, bounds }: { floor: number; bounds: Bounds }) {
  const tex = useMemo(() => skyTexture(), [])
  // Parede sul da laje DESTE andar (proporcional às salas)
  const z = bounds.maxZ - 0.22
  const cx = (bounds.minX + bounds.maxX) / 2
  const panes = useMemo(() => {
    const out: number[] = []
    const w = bounds.maxX - bounds.minX
    const n = Math.max(1, Math.floor((w - 2) / 4.5))
    const span = n * 4.5
    for (let i = 0; i < n; i++) out.push(cx - span / 2 + 2.25 + i * 4.5)
    return out
  }, [bounds.minX, bounds.maxX, cx])
  return (
    <group>
      {/* Janelões contínuos (plano de céu com gradiente) */}
      {panes.map((wx) => (
        <group key={wx}>
          <mesh position={[wx, 1.7, z]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[4.1, 2.2]} />
            <meshStandardMaterial map={tex} emissive="#bcd8f0" emissiveIntensity={0.25} roughness={0.15} />
          </mesh>
          {/* Caixilho */}
          <mesh position={[wx, 1.7, z - 0.02]}>
            <boxGeometry args={[0.06, 2.2, 0.03]} />
            <meshStandardMaterial color="#6b737d" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[wx, 1.7, z - 0.02]}>
            <boxGeometry args={[4.1, 0.05, 0.03]} />
            <meshStandardMaterial color="#6b737d" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Peitoril */}
      <mesh position={[cx, 0.58, z - 0.04]}>
        <boxGeometry args={[bounds.maxX - bounds.minX - 0.4, 0.08, 0.16]} />
        <meshStandardMaterial color="#d9d4c8" roughness={0.6} />
      </mesh>
      {/* Placa do andar (no meio da parede, de frente pro escritório) */}
      <group position={[cx, 2.05, z - 0.06]} rotation={[0, Math.PI, 0]}>
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

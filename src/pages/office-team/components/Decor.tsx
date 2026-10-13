// Peças de decoração procedurais da fase 3 (visual): luminárias pendentes,
// quadro branco com escrita, pôsteres UNV, lixeira, plantas com folhas de
// verdade (planos com alpha) e cortina do auditório. Geometrias e materiais
// são compartilhados em módulo (criados uma vez) pra manter o custo baixo.
import { useMemo } from 'react'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { graphicsParams } from '../lib/graphics'
import { whiteboardTexture, posterTexture, leafTexture, curtainTexture, woodTexture, brushedMetalTexture, crmScreenTexture } from '../lib/textures'

// ── Materiais compartilhados (lazy: só nascem no primeiro uso) ───────────
type Mats = {
  metalDark: THREE.MeshStandardMaterial
  metalLight: THREE.MeshStandardMaterial
  brushed: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  woodDark: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
  glassDark: THREE.MeshPhysicalMaterial
  screen: THREE.MeshStandardMaterial
  screenOff: THREE.MeshStandardMaterial
  bezel: THREE.MeshStandardMaterial
  plasticDark: THREE.MeshStandardMaterial
  plasticLight: THREE.MeshStandardMaterial
  wall: THREE.MeshStandardMaterial
  lampHousing: THREE.MeshStandardMaterial
  lampGlow: THREE.MeshStandardMaterial
  leaf: THREE.MeshStandardMaterial
  pot: THREE.MeshStandardMaterial
  soil: THREE.MeshStandardMaterial
  chairSeat: THREE.MeshStandardMaterial
  chairMesh: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  theaterSeat: THREE.MeshStandardMaterial
  theaterBack: THREE.MeshStandardMaterial
  theaterBase: THREE.MeshStandardMaterial
}
let _mats: Mats | null = null
export function mats(): Mats {
  if (_mats) return _mats
  const wood = woodTexture()
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  _mats = {
    metalDark: std({ color: '#3a3d44', metalness: 0.7, roughness: 0.35 }),
    metalLight: std({ color: '#c9ccd1', metalness: 0.8, roughness: 0.25 }),
    brushed: std({ map: brushedMetalTexture(), color: '#c4c9d0', metalness: 0.85, roughness: 0.3 }),
    wood: std({ map: wood, color: '#caa06a', roughness: 0.38 }),
    woodDark: std({ map: wood, color: '#8a6238', roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#cfe4f5',
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
    glassDark: new THREE.MeshPhysicalMaterial({
      color: '#9fc0dc',
      transparent: true,
      opacity: 0.3,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.3,
      depthWrite: false,
    }),
    screen: std({ map: crmScreenTexture(), emissive: '#ffffff', emissiveMap: crmScreenTexture(), emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1 }),
    screenOff: std({ color: '#1e3a5f', emissive: '#16304f', emissiveIntensity: 0.5, roughness: 0.2 }),
    bezel: std({ color: '#15171c', metalness: 0.4, roughness: 0.35 }),
    plasticDark: std({ color: '#23262c', roughness: 0.55 }),
    plasticLight: std({ color: '#d8d5cf', roughness: 0.6 }),
    wall: std({ color: '#f6f2ea', roughness: 0.9 }),
    lampHousing: std({ color: '#2a2d33', metalness: 0.5, roughness: 0.45 }),
    lampGlow: std({ color: '#fff4dc', emissive: '#ffe9bf', emissiveIntensity: 1.5, roughness: 0.4 }),
    leaf: std({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
    pot: std({ color: '#9aa3ad', roughness: 0.5 }),
    soil: std({ color: '#4a3424', roughness: 0.95 }),
    chairSeat: std({ color: '#2f3640', roughness: 0.8 }),
    chairMesh: std({ color: '#353b46', roughness: 0.9 }),
    rubber: std({ color: '#1d1f24', roughness: 0.6 }),
    theaterSeat: std({ color: '#8c1d1d', roughness: 0.85 }),
    theaterBack: std({ color: '#a32424', roughness: 0.85 }),
    theaterBase: std({ color: '#23262c', roughness: 0.6 }),
  }
  return _mats
}

/** Tecido de cadeira por cor (cache: dezenas de cadeiras da mesma cor
 * compartilham um material só). */
const _fabrics = new Map<string, THREE.MeshStandardMaterial>()
export function fabricMaterial(color: string): THREE.MeshStandardMaterial {
  let m = _fabrics.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
    _fabrics.set(color, m)
  }
  return m
}

// ── Geometrias compartilhadas ────────────────────────────────────────────
type Geos = {
  box: THREE.BoxGeometry
  leaf: THREE.PlaneGeometry
  cyl8: THREE.CylinderGeometry
  sphere8: THREE.SphereGeometry
}
let _geos: Geos | null = null
export function geos(): Geos {
  if (_geos) return _geos
  _geos = {
    box: new THREE.BoxGeometry(1, 1, 1),
    leaf: new THREE.PlaneGeometry(0.16, 0.34),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere8: new THREE.SphereGeometry(1, 8, 6),
  }
  return _geos
}

/** Luminária pendente linear: barra escura com difusor emissivo embaixo,
 * dois cabos até "o teto" (fora de quadro). `light` liga uma pointLight. */
export function CeilingLamp({
  x,
  z,
  rotation = 0,
  len = 2.4,
  y = 2.45,
  light = false,
  intensity = 6,
}: {
  x: number
  z: number
  rotation?: number
  len?: number
  y?: number
  light?: boolean
  intensity?: number
}) {
  const m = mats()
  const g = geos()
  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={g.box} material={m.lampHousing} scale={[len, 0.06, 0.14]} />
      <mesh geometry={g.box} material={m.lampGlow} scale={[len - 0.08, 0.02, 0.1]} position={[0, -0.035, 0]} />
      {[-len / 2 + 0.3, len / 2 - 0.3].map((cx) => (
        <mesh key={cx} geometry={g.cyl8} material={m.metalDark} scale={[0.006, 0.9, 0.006]} position={[cx, 0.48, 0]} />
      ))}
      {light && <pointLight position={[0, -0.2, 0]} intensity={intensity} distance={9} decay={2} color="#ffe9c4" />}
    </group>
  )
}

/** Quadro branco com escrita (funil e metas), moldura de alumínio e calha. */
export function Whiteboard({ x, z, rotation = 0, y = 1.45, w = 1.9, h = 1.15 }: { x: number; z: number; rotation?: number; y?: number; w?: number; h?: number }) {
  const m = mats()
  const g = geos()
  const tex = useMemo(() => whiteboardTexture(), [])
  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={g.box} material={m.metalLight} scale={[w + 0.06, h + 0.06, 0.04]} castShadow />
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.35} />
      </mesh>
      <mesh geometry={g.box} material={m.metalLight} scale={[w * 0.6, 0.03, 0.08]} position={[0, -h / 2 - 0.03, 0.04]} />
      {/* Canetas */}
      {[-0.12, 0, 0.12].map((px, i) => (
        <mesh key={px} geometry={g.cyl8} position={[px, -h / 2 - 0.005, 0.05]} rotation={[0, 0, Math.PI / 2]} scale={[0.008, 0.14, 0.008]}>
          <meshStandardMaterial color={['#0D2B5E', '#CC1B1B', '#1B6B3A'][i]} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/** Pôster UNV emoldurado (frases da marca). `idx` escolhe a frase/cor. */
export function Poster({ x, z, rotation = 0, idx = 0, y = 1.5 }: { x: number; z: number; rotation?: number; idx?: number; y?: number }) {
  const m = mats()
  const g = geos()
  const tex = useMemo(() => posterTexture(idx), [idx])
  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <mesh geometry={g.box} material={m.plasticDark} scale={[0.66, 0.86, 0.03]} castShadow />
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[0.6, 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Lixeira de escritório (cilindro escuro com aro). */
export function TrashBin({ x, z }: { x: number; z: number }) {
  const m = mats()
  const g = geos()
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={g.cyl8} material={m.plasticDark} scale={[0.13, 0.3, 0.13]} position={[0, 0.15, 0]} castShadow />
      <mesh geometry={g.cyl8} material={m.metalDark} scale={[0.14, 0.02, 0.14]} position={[0, 0.3, 0]} />
    </group>
  )
}

/** Planta com folhas (planos com alpha em roseta), vaso cerâmico e terra.
 * `variant`: 0 = folhas largas (costela-de-adão), 1 = palmeira alta. */
export function RealPlant({ x, z, variant }: { x: number; z: number; variant?: number }) {
  const m = mats()
  const g = geos()
  const graphics = useTeamStore((s) => s.graphics)
  const n = graphicsParams(graphics).leavesPerPlant
  const v = variant ?? Math.abs(Math.round(x * 7 + z * 13)) % 2
  const leaves = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number]; s: number }[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (v ? 0.4 : 0)
      const tilt = v ? 0.9 + (i % 3) * 0.15 : 0.55 + (i % 2) * 0.25
      const h = v ? 0.95 + (i % 2) * 0.12 : 0.62 + (i % 3) * 0.1
      const s = v ? 1.6 : 1.3 + (i % 2) * 0.3
      out.push({ pos: [Math.sin(a) * 0.08, h, Math.cos(a) * 0.08], rot: [tilt, a, 0], s })
    }
    return out
  }, [n, v])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={g.cyl8} material={m.pot} scale={[0.17, 0.4, 0.17]} position={[0, 0.2, 0]} castShadow />
      <mesh geometry={g.cyl8} material={m.soil} scale={[0.15, 0.04, 0.15]} position={[0, 0.41, 0]} />
      {v === 1 && <mesh geometry={g.cyl8} scale={[0.03, 0.55, 0.03]} position={[0, 0.68, 0]} castShadow><meshStandardMaterial color="#6b4f2f" roughness={0.9} /></mesh>}
      {leaves.map((l, i) => (
        <group key={i} position={l.pos} rotation={l.rot}>
          {/* Pivô na base da folha: a folha sobe a partir do caule */}
          <mesh geometry={g.leaf} material={m.leaf} position={[0, 0.17 * l.s, 0]} scale={[l.s, l.s, 1]} />
        </group>
      ))}
    </group>
  )
}

/** Cortina pregueada (fundo do palco). */
export function Curtain({ x, y, z, w, h }: { x: number; y: number; z: number; w: number; h: number }) {
  const tex = useMemo(() => {
    const t = curtainTexture().clone()
    t.repeat.set(Math.max(2, Math.round(w / 1.2)), 1)
    t.needsUpdate = true
    return t
  }, [w])
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <planeGeometry args={[w, h, 1, 1]} />
        <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Bandô */}
      <mesh position={[0, h / 2 + 0.08, 0.04]}>
        <boxGeometry args={[w + 0.2, 0.16, 0.12]} />
        <meshStandardMaterial color="#3d0c10" roughness={0.9} />
      </mesh>
    </group>
  )
}

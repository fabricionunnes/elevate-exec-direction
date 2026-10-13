// Casco do prédio na CENA PRINCIPAL: o andar atual fica em y=0 (como sempre)
// e a torre aparece em volta dele. Andares abaixo = corpo sólido na largura
// do BUILDING (fitas de janela acesas à noite, térreo com entrada e letreiro,
// rua e estacionamento lá embaixo). Andar atual = piso liso até a fachada,
// anel de parede com janelas na borda do BUILDING (andares de cima), faixa
// dourada por fora e letreiro "Você está aqui". Andares acima = fantasma
// (arestas das lajes + planos quase transparentes no alto) que NÃO pegam
// clique (raycast no-op). Posição: grupo raiz em y = -floor * FLOOR_HEIGHT.
import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { BUILDING } from '../lib/rooms'
import { FLOORS, FLOOR_HEIGHT, floorLabel } from '../lib/floors'
import { ceilingTexture } from '../lib/textures'
import type { Daylight } from '../lib/daylight'
import { mats, geos } from './Decor'
import { TowerRibbons, TowerMullions, GroundFacade, TowerRoof, TowerParking, TOWER } from './BuildingExterior'

const { W, D, CX, CZ, FRONT_Z } = TOWER
const FH = FLOOR_HEIGHT
const TOP = FLOORS.length - 1
const CEIL = 3.2
const WIN_W = 3.6
const WIN_Y0 = 0.9
const WIN_Y1 = 2.25
const PITCH = 7

const noRaycast = () => null

type Seg = { x: number; z: number; rot: number; len: number }

/** Posições das janelas de um lado (centro ao longo do lado). */
function windowsAlong(from: number, to: number): number[] {
  const out: number[] = []
  for (let v = from + 4.5; v + WIN_W / 2 < to - 1; v += PITCH) out.push(v)
  return out
}

/** Anel de fachada do andar atual na borda do BUILDING: parapeito, verga,
 * pilares entre janelas, vidro, esquadria (instanciada) e peitoris. */
function FacadeRing() {
  const m = mats()
  const g = geos()
  const sides = useMemo(() => {
    // Cada lado: ponto inicial/final ao longo do eixo e a posição fixa
    const list: { axis: 'x' | 'z'; fixed: number; from: number; to: number; rot: number }[] = [
      { axis: 'x', fixed: BUILDING.minZ, from: BUILDING.minX, to: BUILDING.maxX, rot: 0 },
      { axis: 'x', fixed: BUILDING.maxZ, from: BUILDING.minX, to: BUILDING.maxX, rot: 0 },
      { axis: 'z', fixed: BUILDING.minX, from: BUILDING.minZ, to: BUILDING.maxZ, rot: Math.PI / 2 },
      { axis: 'z', fixed: BUILDING.maxX, from: BUILDING.minZ, to: BUILDING.maxZ, rot: Math.PI / 2 },
    ]
    const pillars: Seg[] = []
    const windows: Seg[] = []
    const at = (side: (typeof list)[0], v: number): [number, number] => (side.axis === 'x' ? [v, side.fixed] : [side.fixed, v])
    for (const side of list) {
      const ws = windowsAlong(side.from, side.to)
      let v0 = side.from
      for (const wv of ws) {
        const left = wv - WIN_W / 2
        const [px, pz] = at(side, (v0 + left) / 2)
        pillars.push({ x: px, z: pz, rot: side.rot, len: left - v0 })
        const [wx, wz] = at(side, wv)
        windows.push({ x: wx, z: wz, rot: side.rot, len: WIN_W })
        v0 = wv + WIN_W / 2
      }
      const [px, pz] = at(side, (v0 + side.to) / 2)
      pillars.push({ x: px, z: pz, rot: side.rot, len: side.to - v0 })
    }
    // Esquadrias (3 verticais + 3 horizontais por janela) e peitoris num InstancedMesh
    const frames: THREE.Matrix4[] = []
    const sills: THREE.Matrix4[] = []
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const axisY = new THREE.Vector3(0, 1, 0)
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const ym = (WIN_Y0 + WIN_Y1) / 2
    for (const w of windows) {
      q.setFromAxisAngle(axisY, w.rot)
      const c = Math.cos(w.rot)
      const sn = Math.sin(w.rot)
      const place = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, out: THREE.Matrix4[]) => {
        p.set(w.x + lx * c + lz * sn, ly, w.z - lx * sn + lz * c)
        s.set(sx, sy, sz)
        out.push(mat.clone().compose(p, q, s))
      }
      for (const mx of [-WIN_W / 2, 0, WIN_W / 2]) place(mx, ym, 0, 0.07, WIN_Y1 - WIN_Y0 + 0.06, 0.46, frames)
      for (const my of [WIN_Y0, ym, WIN_Y1]) place(0, my, 0, WIN_W + 0.07, 0.06, 0.46, frames)
      place(0, WIN_Y0 - 0.04, 0.3, WIN_W + 0.3, 0.06, 0.3, sills)
      place(0, WIN_Y0 - 0.04, -0.3, WIN_W + 0.3, 0.06, 0.3, sills)
    }
    return { list, pillars, windows, frames, sills }
  }, [])

  return (
    <group>
      {sides.list.map((side, i) => {
        const len = side.to - side.from
        const [cx, cz] = side.axis === 'x' ? [(side.from + side.to) / 2, side.fixed] : [side.fixed, (side.from + side.to) / 2]
        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, side.rot, 0]}>
            <mesh position={[0, WIN_Y0 / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len + 0.4, WIN_Y0, 0.4]} />
              <meshStandardMaterial color="#ece8df" roughness={0.92} />
            </mesh>
            <mesh position={[0, (WIN_Y1 + CEIL) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[len + 0.4, CEIL - WIN_Y1, 0.4]} />
              <meshStandardMaterial color="#ece8df" roughness={0.92} />
            </mesh>
          </group>
        )
      })}
      {sides.pillars.map((pl, i) =>
        pl.len > 0.05 ? (
          <mesh key={`p${i}`} position={[pl.x, (WIN_Y0 + WIN_Y1) / 2, pl.z]} rotation={[0, pl.rot, 0]} castShadow receiveShadow>
            <boxGeometry args={[pl.len, WIN_Y1 - WIN_Y0, 0.4]} />
            <meshStandardMaterial color="#ece8df" roughness={0.92} />
          </mesh>
        ) : null
      )}
      {sides.windows.map((w, i) => (
        <mesh key={`g${i}`} position={[w.x, (WIN_Y0 + WIN_Y1) / 2, w.z]} rotation={[0, w.rot, 0]} material={m.glass}>
          <boxGeometry args={[WIN_W, WIN_Y1 - WIN_Y0, 0.03]} />
        </mesh>
      ))}
      <Instanced matrices={sides.frames} material={m.metalDark} geometry={g.box} />
      <Instanced matrices={sides.sills} material={m.plasticLight} geometry={g.box} />
    </group>
  )
}

function Instanced({ matrices, material, geometry }: { matrices: THREE.Matrix4[]; material: THREE.Material; geometry: THREE.BufferGeometry }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((mt, i) => im.setMatrixAt(i, mt))
    im.instanceMatrix.needsUpdate = true
    return im
  }, [matrices, material, geometry])
  return <primitive object={mesh} />
}

/** Andar fantasma: arestas da laje (sempre) + planos quase transparentes
 * (só no alto). Nada aqui captura clique. */
function GhostFloor({ n, planes }: { n: number; planes: boolean }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W, FH, D)), [])
  return (
    <group position={[CX, n * FH + FH / 2, CZ]}>
      <lineSegments geometry={edges} raycast={noRaycast}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
      </lineSegments>
      {planes && (
        <mesh raycast={noRaycast}>
          <boxGeometry args={[W, FH, D]} />
          <meshBasicMaterial color="#dfe6f0" transparent opacity={0.1} depthWrite={false} side={THREE.FrontSide} />
        </mesh>
      )}
    </group>
  )
}

export default function TowerShell({ daylight }: { daylight: Daylight }) {
  const floor = useTeamStore((s) => s.floor)
  const graphics = useTeamStore((s) => s.graphics)
  const lit = daylight.windowsLit
  const below = useMemo(() => Array.from({ length: floor }, (_, i) => i), [floor])
  const above = useMemo(() => Array.from({ length: Math.max(0, TOP - floor) }, (_, i) => floor + 1 + i), [floor])
  const ceilingMap = useMemo(() => {
    const t = ceilingTexture().clone()
    t.repeat.set(W / 2.4, D / 2.4)
    t.needsUpdate = true
    return t
  }, [])

  return (
    <group position={[0, -floor * FH, 0]}>
      {/* ── Corpo sólido dos andares abaixo (0..floor-1) ── */}
      {floor > 0 && (
        <group>
          <mesh position={[CX, (floor * FH) / 2 - 0.04, CZ]} receiveShadow>
            <boxGeometry args={[W, floor * FH - 0.08, D]} />
            <meshStandardMaterial color="#e6e2d8" roughness={0.85} />
          </mesh>
          {below.map((n) => (
            <mesh key={`slab${n}`} position={[CX, n * FH + FH - 0.08, CZ]}>
              <boxGeometry args={[W + 0.3, 0.16, D + 0.3]} />
              <meshStandardMaterial color="#b9b3a6" roughness={0.8} />
            </mesh>
          ))}
          <TowerRibbons floors={below} lit={lit} />
          <TowerMullions floors={below} />
          <GroundFacade lit={lit} />
          {/* Rua e estacionamento vistos de cima (no térreo o Parking real cuida) */}
          <TowerParking />
        </group>
      )}

      {/* ── Andar atual (y = 0 da cena) ── */}
      <group position={[0, floor * FH, 0]}>
        {floor > 0 && (
          <>
            {/* Piso liso até a fachada (a laje útil, texturizada, fica por cima) */}
            <mesh position={[CX, -0.005, CZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[W - 0.4, D - 0.4]} />
              <meshStandardMaterial color="#d9d6cf" roughness={0.6} />
            </mesh>
            <FacadeRing />
            {/* Forro (virado pra baixo: a câmera de cima não vê) e borda da laje */}
            <mesh position={[CX, CEIL, CZ]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[W, D]} />
              <meshStandardMaterial map={ceilingMap} roughness={0.9} side={THREE.FrontSide} />
            </mesh>
            {[
              { x: CX, z: BUILDING.minZ, w: W + 0.6, d: 0.6 },
              { x: CX, z: BUILDING.maxZ, w: W + 0.6, d: 0.6 },
              { x: BUILDING.minX, z: CZ, w: 0.6, d: D + 0.6 },
              { x: BUILDING.maxX, z: CZ, w: 0.6, d: D + 0.6 },
            ].map((p, i) => (
              <mesh key={`rim${i}`} position={[p.x, CEIL + 0.1, p.z]}>
                <boxGeometry args={[p.w, 0.2, p.d]} />
                <meshStandardMaterial color="#cfcac0" roughness={0.85} />
              </mesh>
            ))}
          </>
        )}
        {/* Faixa emissiva contornando o andar atual por fora (dourado UNV) */}
        {[
          { x: CX, z: BUILDING.minZ - 0.32, w: W + 0.7, d: 0.1 },
          { x: CX, z: BUILDING.maxZ + 0.32, w: W + 0.7, d: 0.1 },
          { x: BUILDING.minX - 0.32, z: CZ, w: 0.1, d: D + 0.7 },
          { x: BUILDING.maxX + 0.32, z: CZ, w: 0.1, d: D + 0.7 },
        ].map((p, i) => (
          <mesh key={`band${i}`} position={[p.x, 3.05, p.z]} raycast={noRaycast}>
            <boxGeometry args={[p.w, 0.14, p.d]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[CX, 2.9, FRONT_Z + 0.34]} raycast={noRaycast}>
          <boxGeometry args={[W + 0.7, 0.05, 0.08]} />
          <meshStandardMaterial color="#CC1B1B" emissive="#CC1B1B" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        {/* Letreiro flutuante na fachada sul */}
        <group position={[0, floor === 0 ? 6.4 : 4.6, FRONT_Z + 0.6]}>
          <mesh raycast={noRaycast}>
            <boxGeometry args={[9.6, 0.9, 0.12]} />
            <meshStandardMaterial color="#0D2B5E" roughness={0.5} transparent opacity={0.92} />
          </mesh>
          <mesh position={[0, -0.47, 0.02]} raycast={noRaycast}>
            <boxGeometry args={[9.6, 0.06, 0.12]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
          <Text position={[0, 0.02, 0.08]} fontSize={0.4} color="#ffffff" anchorX="center" anchorY="middle" raycast={noRaycast}>
            {`Você está aqui · ${floorLabel(floor)}`}
          </Text>
        </group>
      </group>

      {/* ── Andares acima: fantasma ── */}
      {above.map((n) => (
        <GhostFloor key={n} n={n} planes={graphics === 'alto'} />
      ))}
      {floor < TOP ? (
        <TowerRoof lit={lit} opacity={0.2} />
      ) : (
        // Cobertura real (5º): letreiro UNV em pé atrás do terraço; o forro
        // do andar já faz o papel de laje (sem tampar a câmera de cima)
        <group position={[0, TOP * FH + CEIL + 2.1, FRONT_Z - 6]}>
          <mesh>
            <boxGeometry args={[14, 4.2, 0.6]} />
            <meshStandardMaterial color="#0D2B5E" roughness={0.5} />
          </mesh>
          <Text position={[0, 0.3, 0.35]} fontSize={2.6} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.06} outlineColor="#ffffff">
            UNV
          </Text>
          <mesh position={[0, -1.5, 0.33]}>
            <boxGeometry args={[12, 0.25, 0.04]} />
            <meshStandardMaterial color="#CC1B1B" emissive="#CC1B1B" emissiveIntensity={0.4 + lit * 1.2} />
          </mesh>
        </group>
      )}
    </group>
  )
}

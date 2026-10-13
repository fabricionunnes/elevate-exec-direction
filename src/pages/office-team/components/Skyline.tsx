// Vista pelas janelas: céu com gradiente que segue a hora real, silhuetas de
// prédios em 3 planos de profundidade (paralaxe natural da câmera) com
// janelas que acendem à noite, e o chão da cidade lá embaixo. Nos andares de
// cima a vista "sobe": os prédios vizinhos ficam abaixo da laje e sobra mais
// céu. Tudo procedural: 2 InstancedMesh (~110 prédios) + 1 esfera de céu.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { BUILDING } from '../lib/rooms'
import { FLOOR_HEIGHT } from '../lib/floors'
import { cityFacadeTextures } from '../lib/textures'
import { daylightAt, currentHour, type Daylight } from '../lib/daylight'


/** Paleta do momento, atualizada a cada minuto (compartilhada pela cena). */
export function useDaylight(): Daylight {
  const [hour, setHour] = useState(() => currentHour())
  useEffect(() => {
    const iv = setInterval(() => setHour(currentHour()), 60_000)
    return () => clearInterval(iv)
  }, [])
  return useMemo(() => daylightAt(hour), [hour])
}

export function skyTexture(d: Daylight): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const g = canvas.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, `#${d.skyTop.getHexString()}`)
  grad.addColorStop(0.42, `#${d.skyTop.clone().lerp(d.skyHorizon, 0.55).getHexString()}`)
  grad.addColorStop(0.55, `#${d.skyHorizon.getHexString()}`)
  grad.addColorStop(0.6, `#${d.ground.getHexString()}`)
  grad.addColorStop(1, `#${d.ground.getHexString()}`)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// rng determinístico (a cidade é sempre a mesma)
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

interface Bld {
  x: number
  z: number
  w: number
  d: number
  h: number
  tint: THREE.Color
}

/** Prédios em anel em volta da laje: 3 faixas de distância. */
function buildCity(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): { near: Bld[]; far: Bld[] } {
  const r = rng(2026)
  const near: Bld[] = []
  const far: Bld[] = []
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2
  const halfW = (bounds.maxX - bounds.minX) / 2
  const halfD = (bounds.maxZ - bounds.minZ) / 2
  const tints = ['#d9dde3', '#c3c8cf', '#aeb4bc', '#e2dcd0', '#b8bec8']
  const ring = (gap: number, depth: number, step: number, hMin: number, hMax: number, out: Bld[], sides: ('N' | 'S' | 'E' | 'W')[]) => {
    // Cada prédio nasce com a face da frente a pelo menos `gap` da laje
    const place = (side: 'N' | 'S' | 'E' | 'W', along: number) => {
      const w = 6 + r() * 7
      const d = 6 + r() * 7
      const h = hMin + r() * (hMax - hMin)
      const off = gap + r() * depth
      let x = along
      let z = along
      if (side === 'N') z = cz - halfD - off - d / 2
      else if (side === 'S') z = cz + halfD + 16 + off + d / 2
      else if (side === 'W') x = cx - halfW - off - w / 2
      else x = cx + halfW + off + w / 2
      // Laterais: deixa livre a faixa da rua do estacionamento (sul da laje)
      if ((side === 'E' || side === 'W') && z > bounds.maxZ - 4 && z < bounds.maxZ + 18) return
      out.push({ x, z, w, d, h, tint: new THREE.Color(tints[Math.floor(r() * tints.length)]) })
    }
    const spanX = halfW + gap + depth + 30
    const spanZ = halfD + gap + depth + 20
    for (let x = cx - spanX; x <= cx + spanX; x += step) {
      const jx = (r() - 0.5) * step * 0.5
      if (sides.includes('N')) place('N', x + jx)
      if (sides.includes('S')) place('S', x + jx)
    }
    for (let z = cz - spanZ; z <= cz + spanZ; z += step) {
      const jz = (r() - 0.5) * step * 0.5
      if (sides.includes('W')) place('W', z + jz)
      if (sides.includes('E')) place('E', z + jz)
    }
  }
  ring(8, 8, 10, 7, 15, near, ['N', 'E', 'W', 'S']) // vizinhos baixos
  ring(26, 12, 12, 14, 32, near, ['N', 'E', 'W', 'S']) // quadra seguinte
  ring(52, 24, 14, 26, 62, far, ['N', 'E', 'W']) // torres ao fundo
  return { near, far }
}

/** Nuvem macia (elipses brancas com alpha) pra cobertura. */
let _cloud: THREE.CanvasTexture | null = null
function cloudTexture(): THREE.CanvasTexture {
  if (_cloud) return _cloud
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 128)
  const blobs = [
    [70, 80, 50, 30],
    [120, 60, 60, 34],
    [175, 78, 52, 28],
    [120, 90, 80, 24],
  ]
  for (const [x, y, rx, ry] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, rx)
    grad.addColorStop(0, 'rgba(255,255,255,0.95)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }
  _cloud = new THREE.CanvasTexture(c)
  _cloud.colorSpace = THREE.SRGBColorSpace
  return _cloud
}

/** Árvore simples (tronco + copa em 2 esferas), base em y=0 local. */
function Tree({ x, z, h = 6, r = 2 }: { x: number; z: number; h?: number; r?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h * 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, h * 0.8, 7]} />
        <meshStandardMaterial color="#5a3f2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, h * 0.8, 0]} castShadow>
        <sphereGeometry args={[r, 10, 8]} />
        <meshStandardMaterial color="#3f8a4f" roughness={0.9} />
      </mesh>
      <mesh position={[r * 0.45, h * 0.8 + r * 0.5, 0.2]}>
        <sphereGeometry args={[r * 0.7, 9, 7]} />
        <meshStandardMaterial color="#4c9c5a" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Carro estacionado na rua (caixa + cabine), frente pra +x. */
function StreetCar({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[4.2, 0.55, 1.85]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[-0.2, 0.9, 0]} castShadow>
        <boxGeometry args={[2.1, 0.5, 1.6]} />
        <meshStandardMaterial color="#1b2430" roughness={0.2} metalness={0.3} />
      </mesh>
      {[-1.3, 1.3].map((wx) =>
        [-0.95, 0.95].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.32, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.22, 10]} />
            <meshStandardMaterial color="#1d1f24" roughness={0.6} />
          </mesh>
        ))
      )}
    </group>
  )
}

/** Pedestre parado na calçada (cápsulas, sem animação: custo zero). */
function Pedestrian({ x, z, shirt, rot = 0 }: { x: number; z: number; shirt: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.16, 0.6, 3, 8]} />
        <meshStandardMaterial color="#2b3445" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <capsuleGeometry args={[0.2, 0.42, 3, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color="#e0ac69" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Caixa d'água + ar-condicionado no topo dos prédios vizinhos (vista dos
 * andares do meio: "telhados"). */
function RoofGear({ blds, yBase }: { blds: Bld[]; yBase: number }) {
  return (
    <group>
      {blds.map((b, i) =>
        i % 2 === 0 ? (
          <group key={i} position={[b.x, yBase + b.h, b.z]}>
            <mesh position={[b.w * 0.25, 1.1, 0]}>
              <cylinderGeometry args={[1.0, 1.0, 1.6, 10]} />
              <meshStandardMaterial color="#8aa0b8" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[-b.w * 0.2, 0.5, b.d * 0.2]}>
              <boxGeometry args={[1.8, 1, 1.2]} />
              <meshStandardMaterial color="#9aa3ad" roughness={0.7} />
            </mesh>
          </group>
        ) : null
      )}
    </group>
  )
}

/**
 * O que a janela mostra MUDA com o andar (altura real):
 *  térreo: rua, calçada, carros, pedestres, árvores, vizinhos altos ao lado
 *  1º-2º: copas de árvore e telhados baixos na altura da janela
 *  3º-4º: telhados com caixa d'água e o horizonte da cidade
 *  5º (cobertura): só skyline distante, nuvens e terraço com guarda-corpo
 */
function FloorView({ floor, yBase, bounds, near, lit }: { floor: number; yBase: number; bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; near: Bld[]; lit: number }) {
  const cx = (bounds.minX + bounds.maxX) / 2
  const cloud = useMemo(() => cloudTexture(), [])
  if (floor === 0) {
    return (
      <group>
        {[-24, -12, 0, 12, 24].map((x) => (
          <Tree key={x} x={cx + x + 3} z={bounds.minZ - 3.4} h={5.5} r={1.8} />
        ))}
        {[-20, -6, 9, 21].map((x, i) => (
          <StreetCar key={x} x={cx + x} z={bounds.minZ - 4.4} color={['#b9bcc2', '#15161a', '#7a1a1a', '#1a3f7a'][i]} />
        ))}
        <Pedestrian x={cx - 15} z={bounds.minZ - 1.4} shirt="#CC1B1B" rot={0.6} />
        <Pedestrian x={cx - 14.3} z={bounds.minZ - 1.9} shirt="#0D2B5E" rot={-2.3} />
        <Pedestrian x={cx + 16} z={bounds.minZ - 1.6} shirt="#e8d5a3" rot={2.8} />
      </group>
    )
  }
  if (floor <= 2) {
    // Árvores altas (copa na altura da janela) + telhados baixos
    const treeBase = yBase
    return (
      <group position={[0, treeBase, 0]}>
        {[-20, -8, 4, 16, 26].map((x) => (
          <Tree key={x} x={cx + x} z={bounds.minZ - 4} h={floor === 1 ? 7.5 : 10} r={2.6} />
        ))}
        {[-16, 2, 22].map((x) => (
          <Tree key={`e${x}`} x={bounds.maxX + 5} z={x} h={floor === 1 ? 7 : 9.5} r={2.4} />
        ))}
        <RoofGear blds={near.filter((b) => b.h < 15)} yBase={0} />
      </group>
    )
  }
  if (floor <= 4) {
    return <RoofGear blds={near} yBase={yBase} />
  }
  // Cobertura: nuvens e terraço com guarda-corpo de vidro (lado sul)
  const terraceW = bounds.maxX - bounds.minX - 2
  return (
    <group>
      {[-60, -20, 25, 70].map((x, i) => (
        <mesh key={x} position={[cx + x, 14 + (i % 2) * 5, bounds.minZ - 70 - i * 15]}>
          <planeGeometry args={[48, 24]} />
          <meshBasicMaterial map={cloud} transparent depthWrite={false} opacity={0.85 - lit * 0.4} fog={false} toneMapped={false} />
        </mesh>
      ))}
      {[-40, 40].map((z) => (
        <mesh key={z} position={[bounds.maxX + 75, 17, z]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[40, 20]} />
          <meshBasicMaterial map={cloud} transparent depthWrite={false} opacity={0.8 - lit * 0.4} fog={false} toneMapped={false} />
        </mesh>
      ))}
      <group position={[cx, 0, bounds.maxZ + 2.9]}>
        {/* Piso do terraço (deck) */}
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[terraceW, 5.2]} />
          <meshStandardMaterial color="#9c7d5a" roughness={0.8} />
        </mesh>
        {/* Guarda-corpo de vidro na borda sul e nas laterais */}
        <mesh position={[0, 0.6, 2.55]}>
          <boxGeometry args={[terraceW, 1.1, 0.04]} />
          <meshStandardMaterial color="#cfe4f5" transparent opacity={0.3} roughness={0.05} metalness={0} depthWrite={false} />
        </mesh>
        {[-terraceW / 2, terraceW / 2].map((x) => (
          <mesh key={x} position={[x, 0.6, 0]}>
            <boxGeometry args={[0.04, 1.1, 5.2]} />
            <meshStandardMaterial color="#cfe4f5" transparent opacity={0.3} roughness={0.05} metalness={0} depthWrite={false} />
          </mesh>
        ))}
        <mesh position={[0, 1.15, 2.55]}>
          <boxGeometry args={[terraceW, 0.06, 0.08]} />
          <meshStandardMaterial color="#b9bec6" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Floreiras e espreguiçadeiras */}
        {[-terraceW * 0.35, 0, terraceW * 0.35].map((x) => (
          <group key={x} position={[x, 0, 1.6]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[2.2, 0.6, 0.7]} />
              <meshStandardMaterial color="#4a4f57" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
              <sphereGeometry args={[0.7, 9, 7]} />
              <meshStandardMaterial color="#3f8a4f" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function CityLayer({ blds, repeatY, yBase, lit, far }: { blds: Bld[]; repeatY: number; yBase: number; lit: number; far: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const tex = useMemo(() => {
    const { map, emissive } = cityFacadeTextures()
    const m = map.clone()
    m.repeat.set(1, repeatY)
    m.needsUpdate = true
    const e = emissive.clone()
    e.repeat.set(1, repeatY)
    e.needsUpdate = true
    return { map: m, emissive: e }
  }, [repeatY])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    blds.forEach((b, i) => {
      // Caixa unitária escalada: desce 4 abaixo da base pra nunca "flutuar"
      const extra = 4
      s.set(b.w, b.h + extra, b.d)
      p.set(b.x, yBase - extra + (b.h + extra) / 2, b.z)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, b.tint)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [blds, yBase])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blds.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={tex.map}
        emissiveMap={tex.emissive}
        emissive="#ffc973"
        emissiveIntensity={lit * (far ? 0.7 : 1.0)}
        roughness={0.85}
        metalness={0.05}
      />
    </instancedMesh>
  )
}

export default function Skyline({ daylight }: { daylight: Daylight }) {
  const floor = useTeamStore((s) => s.floor)
  // A cidade se organiza em volta da TORRE (BUILDING), não da laje útil do
  // andar: o casco do prédio (TowerShell) tem a largura do térreo em todos
  const bounds = BUILDING
  const city = useMemo(() => buildCity(bounds), [bounds])
  const yBase = -floor * FLOOR_HEIGHT
  const { scene, gl } = useThree()

  // Céu: textura regenerada quando a paleta muda (1x por minuto no máximo)
  const sky = useMemo(() => skyTexture(daylight), [daylight])
  useEffect(() => () => sky.dispose(), [sky])

  // Névoa e fundo seguem a hora (profundidade sutil + horizonte coerente)
  useEffect(() => {
    const fog = scene.fog as THREE.Fog | null
    if (fog) fog.color.copy(daylight.fog)
    scene.background = daylight.fog.clone()
    gl.toneMappingExposure = daylight.exposure
  }, [scene, gl, daylight])

  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  return (
    <group>
      {/* Esfera de céu (por dentro), sem névoa, sempre atrás de tudo */}
      <mesh position={[cx, yBase, cz]} renderOrder={-10}>
        <sphereGeometry args={[210, 24, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Chão da cidade (asfalto) na cota da rua */}
      <mesh position={[cx, yBase - 0.06, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[520, 520]} />
        <meshStandardMaterial color="#3a3e44" roughness={0.95} />
      </mesh>
      {/* Térreo: calçada e rua atrás da fachada norte (a vista de quem está na laje) */}
      {floor === 0 && (
        <>
          <mesh position={[cx, -0.02, bounds.minZ - 1.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[bounds.maxX - bounds.minX + 14, 2.8]} />
            <meshStandardMaterial color="#b9b3a6" roughness={0.85} />
          </mesh>
          <mesh position={[cx, -0.04, bounds.minZ - 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[bounds.maxX - bounds.minX + 14, 0.14]} />
            <meshStandardMaterial color="#d8c44a" roughness={0.9} />
          </mesh>
          {/* Postes de rua */}
          {[-18, 0, 18].map((px) => (
            <group key={px} position={[cx + px, 0, bounds.minZ - 3.2]}>
              <mesh position={[0, 2.2, 0]}>
                <cylinderGeometry args={[0.05, 0.07, 4.4, 6]} />
                <meshStandardMaterial color="#4a4f57" metalness={0.5} roughness={0.5} />
              </mesh>
              <mesh position={[0, 4.4, 0.3]}>
                <boxGeometry args={[0.22, 0.08, 0.7]} />
                <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.5} />
              </mesh>
              <mesh position={[0, 4.35, 0.5]}>
                <boxGeometry args={[0.18, 0.02, 0.3]} />
                <meshStandardMaterial color="#fff2cc" emissive="#ffe8a8" emissiveIntensity={daylight.windowsLit * 1.6} />
              </mesh>
            </group>
          ))}
        </>
      )}
      {/* Cobertura (5º): só o skyline distante; os vizinhos ficam abaixo */}
      {floor < 5 && <CityLayer blds={city.near} repeatY={1.5} yBase={yBase} lit={daylight.windowsLit} far={false} />}
      <CityLayer blds={city.far} repeatY={3} yBase={yBase} lit={daylight.windowsLit} far />
      <FloorView floor={floor} yBase={yBase} bounds={bounds} near={city.near} lit={daylight.windowsLit} />
    </group>
  )
}

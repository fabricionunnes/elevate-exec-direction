// Cutscene da troca de andar (gráficos "alto"): o prédio UNV por fora.
// Canvas PRÓPRIO por cima do fade preto (não mexe na cena interna): torre
// procedural com os 6 andares de FLOORS na largura do BUILDING (a fachada
// externa é a mesma em todos os andares; as lajes internas menores dos
// andares de cima continuam como estão), janelas em fita que acendem à noite,
// letreiro UNV no topo, entrada e estacionamento no térreo. A câmera sai da
// fachada do andar atual, mostra a torre inteira enquanto um indicador
// luminoso sobe/desce até o destino e entra pelo andar novo; aí o fade preto
// termina e o andar troca (floorTravel). Esc ou o botão pulam.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useTeamStore } from '../store/useTeamStore'
import { BUILDING } from '../lib/rooms'
import { FLOORS, FLOOR_HEIGHT } from '../lib/floors'
import { FLOOR_CUTSCENE_MS, skipFloorCutscene } from '../lib/floorTravel'
import { daylightAt, currentHour } from '../lib/daylight'
import { skyTexture } from './Skyline'

const FLOOR_H = FLOOR_HEIGHT
const N_FLOORS = FLOORS.length
const W = BUILDING.maxX - BUILDING.minX + 0.4
const D = BUILDING.maxZ - BUILDING.minZ + 0.4
const CX = (BUILDING.minX + BUILDING.maxX) / 2
const CZ = (BUILDING.minZ + BUILDING.maxZ) / 2
const H = N_FLOORS * FLOOR_H
const FRONT_Z = BUILDING.maxZ + 0.2

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

// ── Peças da torre (compartilhadas com o TowerShell da cena principal) ──
export const TOWER = { FLOOR_H, N_FLOORS, W, D, CX, CZ, H, FRONT_Z }

/** Fitas de janela dos andares pedidos (4 faces; térreo sem a face sul,
 * que é a fachada navy). `refs` recebe o material da face sul por andar. */
export function TowerRibbons({
  floors,
  lit,
  refs,
}: {
  floors: number[]
  lit: number
  refs?: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>
}) {
  const warm = useMemo(() => new THREE.Color('#ffd27a'), [])
  const ribbonColor = useMemo(() => new THREE.Color('#9fc3e0').lerp(warm, lit * 0.8), [lit, warm])
  return (
    <group>
      {floors.map((n) => {
        const y = n * FLOOR_H + 1.65
        const faces: { pos: [number, number, number]; size: [number, number, number] }[] = [
          { pos: [CX, y, BUILDING.minZ - 0.1], size: [W - 1.5, 1.5, 0.1] },
          { pos: [BUILDING.maxX + 0.1, y, CZ], size: [0.1, 1.5, D - 1.5] },
          { pos: [BUILDING.minX - 0.1, y, CZ], size: [0.1, 1.5, D - 1.5] },
        ]
        if (n > 0) faces.unshift({ pos: [CX, y, FRONT_Z - 0.1], size: [W - 1.5, 1.5, 0.1] })
        return faces.map((face, i) => (
          <mesh key={`rib${n}-${i}`} position={face.pos}>
            <boxGeometry args={face.size} />
            <meshStandardMaterial
              ref={(el) => {
                if (refs && i === 0 && n > 0) refs.current[n] = el
              }}
              color={ribbonColor}
              emissive={warm}
              emissiveIntensity={0.15 + lit * 0.7}
              roughness={0.1}
              metalness={0.2}
            />
          </mesh>
        ))
      })}
    </group>
  )
}

/** Montantes verticais das fitas (um InstancedMesh pros andares pedidos). */
export function TowerMullions({ floors }: { floors: number[] }) {
  const mullions = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const sq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const s = new THREE.Vector3(0.12, 1.5, 0.16)
    const p = new THREE.Vector3()
    for (const f of floors) {
      const y = f * FLOOR_H + 1.65
      for (let x = BUILDING.minX + 1.8; x < BUILDING.maxX; x += 3.6) {
        if (f > 0) {
          p.set(x, y, FRONT_Z + 0.02)
          out.push(m.clone().compose(p, q, s))
        }
        p.set(x, y, BUILDING.minZ - 0.22)
        out.push(m.clone().compose(p, q, s))
      }
      for (let z = BUILDING.minZ + 1.8; z < BUILDING.maxZ; z += 3.6) {
        p.set(BUILDING.maxX + 0.22, y, z)
        out.push(m.clone().compose(p, sq, s))
        p.set(BUILDING.minX - 0.22, y, z)
        out.push(m.clone().compose(p, sq, s))
      }
    }
    return out
  }, [floors])
  const ref = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mullions.forEach((mat, i) => mesh.setMatrixAt(i, mat))
    mesh.instanceMatrix.needsUpdate = true
  }, [mullions])
  if (mullions.length === 0) return null
  return (
    <instancedMesh key={mullions.length} ref={ref} args={[undefined, undefined, mullions.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.4} />
    </instancedMesh>
  )
}

/** Térreo por fora: fachada navy com faixas vermelhas, porta de vidro e o
 * letreiro retroiluminado. */
export function GroundFacade({ lit }: { lit: number }) {
  return (
    <group>
      <mesh position={[CX, FLOOR_H / 2 - 0.05, FRONT_Z]}>
        <boxGeometry args={[W + 0.1, FLOOR_H - 0.3, 0.2]} />
        <meshStandardMaterial color="#0D2B5E" roughness={0.55} />
      </mesh>
      {[0.45, 3.05].map((y) => (
        <mesh key={y} position={[CX, y, FRONT_Z + 0.12]}>
          <boxGeometry args={[W + 0.1, y < 1 ? 0.22 : 0.12, 0.02]} />
          <meshStandardMaterial color="#CC1B1B" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.25, FRONT_Z + 0.14]}>
        <boxGeometry args={[3.7, 2.5, 0.06]} />
        <meshStandardMaterial color="#aaccee" transparent opacity={0.55} roughness={0.05} metalness={0.3} emissive="#dfe9ff" emissiveIntensity={0.3 + lit * 0.5} />
      </mesh>
      <group position={[0, 4.05, FRONT_Z + 0.3]}>
        <mesh>
          <boxGeometry args={[8.4, 2.1, 0.35]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.19]}>
          <boxGeometry args={[8.0, 1.8, 0.04]} />
          <meshStandardMaterial color="#ffffff" emissive="#f2f6ff" emissiveIntensity={0.75} />
        </mesh>
        <Text position={[0, 0.18, 0.23]} fontSize={0.7} color="#0D2B5E" anchorX="center" anchorY="middle">
          UNV
        </Text>
        <Text position={[0, -0.45, 0.23]} fontSize={0.22} color="#CC1B1B" anchorX="center" anchorY="middle">
          UNIVERSIDADE NACIONAL DE VENDAS
        </Text>
      </group>
    </group>
  )
}

/** Cobertura: platibanda, piso, casa de máquinas, letreiro UNV iluminado e
 * guarda-corpo do terraço. `opacity` < 1 = versão fantasma (sem luz). */
export function TowerRoof({ lit, opacity = 1 }: { lit: number; opacity?: number }) {
  const ghost = opacity < 1
  const tp = ghost ? { transparent: true, opacity, depthWrite: false } : {}
  const noRay = ghost ? { raycast: () => null } : {}
  return (
    <group>
      <mesh position={[CX, H + 0.35, CZ]} {...noRay}>
        <boxGeometry args={[W + 0.4, 0.7, D + 0.4]} />
        <meshStandardMaterial color="#d8d3c8" roughness={0.85} {...tp} />
      </mesh>
      {!ghost && (
        <mesh position={[CX, H + 0.7, CZ]}>
          <boxGeometry args={[W - 0.8, 0.02, D - 0.8]} />
          <meshStandardMaterial color="#8d8a84" roughness={0.95} />
        </mesh>
      )}
      <mesh position={[0, H + 1.9, CZ - 8]} {...noRay}>
        <boxGeometry args={[8, 2.4, 6]} />
        <meshStandardMaterial color="#cfcac0" roughness={0.9} {...tp} />
      </mesh>
      <group position={[0, H + 3.4, FRONT_Z - 6]}>
        <mesh {...noRay}>
          <boxGeometry args={[14, 4.2, 0.6]} />
          <meshStandardMaterial color="#0D2B5E" roughness={0.5} {...(ghost ? { transparent: true, opacity: Math.min(1, opacity * 3), depthWrite: false } : {})} />
        </mesh>
        <Text position={[0, 0.3, 0.35]} fontSize={2.6} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.06} outlineColor="#ffffff" fillOpacity={ghost ? 0.75 : 1} raycast={() => null}>
          UNV
        </Text>
        <mesh position={[0, -1.5, 0.33]} {...noRay}>
          <boxGeometry args={[12, 0.25, 0.04]} />
          <meshStandardMaterial color="#CC1B1B" emissive="#CC1B1B" emissiveIntensity={0.4 + lit * 1.2} {...tp} />
        </mesh>
        {!ghost && <pointLight position={[0, 0, 4]} intensity={6 + lit * 14} distance={30} decay={2} color="#dfe9ff" />}
      </group>
      <mesh position={[CX, H + 1.3, FRONT_Z - 0.6]} {...noRay}>
        <boxGeometry args={[W - 4, 1.1, 0.05]} />
        <meshStandardMaterial color="#cfe4f5" transparent opacity={ghost ? opacity : 0.35} roughness={0.05} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Rua e estacionamento ao sul (vista de cima): asfalto, vagas, carros,
 * calçada em volta e árvores na calçada norte. */
export function TowerParking({ sidewalk = true }: { sidewalk?: boolean }) {
  return (
    <group>
      {sidewalk && (
        <mesh position={[CX, -0.02, CZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[W + 8, D + 8]} />
          <meshStandardMaterial color="#b9b3a6" roughness={0.85} />
        </mesh>
      )}
      <group position={[0, 0, BUILDING.maxZ + 6.8]}>
        <mesh position={[1, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[62, 12.4]} />
          <meshStandardMaterial color="#44484e" roughness={0.95} />
        </mesh>
        {Array.from({ length: 13 }, (_, i) => -27 + i * 4.4).map((x) => (
          <mesh key={x} position={[x - 2.2, 0.01, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.12, 5.6]} />
            <meshStandardMaterial color="#e8e4da" roughness={0.9} />
          </mesh>
        ))}
        {[-27, -18.2, -9.4, 4, 17.2, 26].map((x, i) => (
          <group key={x} position={[x, 0, 0.8]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.9, 0.6, 4.4]} />
              <meshStandardMaterial color={['#c41e1e', '#15161a', '#b9bcc2', '#1a3f7a', '#eceff1', '#1d4a32'][i]} roughness={0.35} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.95, -0.2]} castShadow>
              <boxGeometry args={[1.6, 0.5, 2.2]} />
              <meshStandardMaterial color="#1b2430" roughness={0.2} metalness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
      {[-22, -8, 8, 22].map((x) => (
        <group key={x} position={[x, 0, BUILDING.minZ - 3]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 3, 7]} />
            <meshStandardMaterial color="#5a3f2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.6, 0]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#3f8a4f" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Torre inteira da cutscene (corpo sólido + todas as peças). */
function Tower({ lit, ribbonRefs }: { lit: number; ribbonRefs: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]> }) {
  const all = useMemo(() => FLOORS.map((f) => f.n), [])
  return (
    <group>
      <mesh position={[CX, H / 2, CZ]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#e6e2d8" roughness={0.85} />
      </mesh>
      {FLOORS.map((f) => (
        <mesh key={`slab${f.n}`} position={[CX, f.n * FLOOR_H + FLOOR_H - 0.08, CZ]}>
          <boxGeometry args={[W + 0.3, 0.16, D + 0.3]} />
          <meshStandardMaterial color="#b9b3a6" roughness={0.8} />
        </mesh>
      ))}
      <TowerRibbons floors={all} lit={lit} refs={ribbonRefs} />
      <TowerMullions floors={all} />
      <GroundFacade lit={lit} />
      <TowerRoof lit={lit} />
      <mesh position={[CX, -0.05, CZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#3a3e44" roughness={0.95} />
      </mesh>
      <TowerParking />
    </group>
  )
}

/** Câmera + indicador luminoso + fade do overlay, dirigidos pelo progresso. */
function Director({
  from,
  to,
  startedAt,
  container,
  ribbonRefs,
}: {
  from: number
  to: number
  startedAt: number
  container: React.RefObject<HTMLDivElement>
  ribbonRefs: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>
}) {
  const { camera } = useThree()
  const indicatorRef = useRef<THREE.Mesh>(null!)
  const look = useMemo(() => new THREE.Vector3(), [])
  const yFrom = from * FLOOR_H + 1.6
  const yTo = to * FLOOR_H + 1.6
  // Trecho 1 (0..0.45): sai da fachada do andar atual e afasta
  // Trecho 2 (0.45..1): contorna de longe e entra pelo andar de destino
  const path = useMemo(
    () => ({
      P0: new THREE.Vector3(0, yFrom, FRONT_Z + 8),
      L0: new THREE.Vector3(0, yFrom, FRONT_Z),
      P1: new THREE.Vector3(34, Math.max(12, (yFrom + yTo) / 2 + 6), FRONT_Z + 62),
      L1: new THREE.Vector3(0, H * 0.5, CZ),
      P2: new THREE.Vector3(0, yTo, FRONT_Z + 7),
      L2: new THREE.Vector3(0, yTo, FRONT_Z),
    }),
    [yFrom, yTo]
  )
  useFrame(() => {
    const p = Math.min(1, (Date.now() - startedAt) / FLOOR_CUTSCENE_MS)
    const { P0, L0, P1, L1, P2, L2 } = path
    if (p < 0.45) {
      const t = smooth(p / 0.45)
      camera.position.lerpVectors(P0, P1, t)
      look.lerpVectors(L0, L1, t)
    } else {
      const t = smooth((p - 0.45) / 0.55)
      camera.position.lerpVectors(P1, P2, t)
      look.lerpVectors(L1, L2, t)
    }
    camera.lookAt(look)
    // Indicador sobe/desce pelo "poço" do elevador na fachada
    const ti = smooth((p - 0.2) / 0.6)
    const y = THREE.MathUtils.lerp(from * FLOOR_H + 1.65, to * FLOOR_H + 1.65, ti)
    if (indicatorRef.current) indicatorRef.current.position.y = y
    // A fita do andar de destino acende quando o indicador chega
    ribbonRefs.current.forEach((m, n) => {
      if (!m) return
      const base = m.userData.base ?? (m.userData.base = m.emissiveIntensity)
      m.emissiveIntensity = n === to ? base + ti * 1.6 : base
    })
    // Fade do overlay (o preto do FloorFade fica embaixo)
    if (container.current) {
      const fadeIn = smooth(p / 0.12)
      const fadeOut = 1 - smooth((p - 0.88) / 0.12)
      container.current.style.opacity = String(Math.min(fadeIn, fadeOut))
    }
  })
  return (
    <group>
      <mesh ref={indicatorRef} position={[0, yFrom, FRONT_Z + 0.25]}>
        <boxGeometry args={[4.6, 0.5, 0.1]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {/* Poço do elevador desenhado na fachada (linha discreta) */}
      <mesh position={[0, H / 2 + FLOOR_H / 2, FRONT_Z + 0.2]}>
        <boxGeometry args={[4.8, H - FLOOR_H + 1, 0.02]} />
        <meshStandardMaterial color="#ffd700" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

export default function BuildingExterior() {
  const cut = useTeamStore((s) => s.floorCutscene)
  const containerRef = useRef<HTMLDivElement>(null)
  const ribbonRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const daylight = useMemo(() => daylightAt(currentHour()), [cut?.startedAt])
  const sky = useMemo(() => skyTexture(daylight), [daylight])

  // Esc pula a cutscene
  useEffect(() => {
    if (!cut) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipFloorCutscene()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cut])

  if (!cut) return null
  const fogHex = `#${daylight.fog.getHexString()}`
  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, zIndex: 210, opacity: 0, background: '#000' }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, cut.from * FLOOR_H + 1.6, FRONT_Z + 8], fov: 55, near: 0.1, far: 600 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: daylight.exposure }}
      >
        <fog attach="fog" args={[fogHex, 90, 320]} />
        <ambientLight intensity={daylight.ambient * 0.8} color="#fff6ea" />
        <hemisphereLight args={[daylight.hemiSky, daylight.hemiGround, 0.7]} />
        <directionalLight
          position={[40, 60, 50]}
          intensity={Math.max(0.6, daylight.sunIntensity)}
          color={daylight.sun}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-far={200}
          shadow-bias={-0.0008}
        />
        <mesh position={[CX, 0, CZ]}>
          <sphereGeometry args={[400, 24, 16]} />
          <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
        </mesh>
        <Tower lit={daylight.windowsLit} ribbonRefs={ribbonRefs} />
        <Director from={cut.from} to={cut.to} startedAt={cut.startedAt} container={containerRef} ribbonRefs={ribbonRefs} />
      </Canvas>
      {/* Legenda + pular */}
      <div
        style={{
          position: 'absolute',
          bottom: '28px',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          alignItems: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: '#fff',
          pointerEvents: 'none',
        }}
      >
        <div style={{ background: 'rgba(10,10,20,0.7)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '999px', padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}>
          Indo pro {FLOORS.find((f) => f.n === cut.to)?.name ?? `andar ${cut.to}`}
        </div>
        <button
          onClick={skipFloorCutscene}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(10,10,20,0.7)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#ddd',
            borderRadius: '999px',
            padding: '8px 14px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Pular (Esc)
        </button>
      </div>
    </div>
  )
}

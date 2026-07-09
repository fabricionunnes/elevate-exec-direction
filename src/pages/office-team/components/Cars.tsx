// Carros de luxo low-poly do estacionamento UNV — silhuetas por modelo
// (Panamera fastback, esportivo em cunha com aerofólio, sedan três
// volumes, SUV quadrado com grade) + rodas raiadas, retrovisores,
// grade, para-choques e vidros. Frente aponta pra -z.
import { useMemo } from 'react'

export type CarKind = 'panamera' | 'sport' | 'sedan' | 'suv'

export interface CarSpec {
  kind: CarKind
  color: string
  label: string
}

const FABRICIO_IDS = new Set(['98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3', '61688e2e-00f7-4d11-a59d-eb3617ae44f5'])

const LUXURY_FLEET: CarSpec[] = [
  { kind: 'sport', color: '#c41e1e', label: 'Ferrari' },
  { kind: 'suv', color: '#15161a', label: 'Range Rover' },
  { kind: 'sedan', color: '#b9bcc2', label: 'Mercedes' },
  { kind: 'sport', color: '#e0a800', label: 'Lamborghini' },
  { kind: 'sedan', color: '#1a3f7a', label: 'BMW' },
  { kind: 'sedan', color: '#eceff1', label: 'Audi' },
  { kind: 'sport', color: '#1d4a32', label: 'Porsche 911' },
  { kind: 'suv', color: '#3a2e26', label: 'Bentley' },
  { kind: 'sedan', color: '#5a1025', label: 'Maserati' },
]

export function carForUser(userId: string): CarSpec {
  if (FABRICIO_IDS.has(userId)) {
    return { kind: 'panamera', color: '#43464c', label: 'Porsche Panamera' }
  }
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return LUXURY_FLEET[h % LUXURY_FLEET.length]
}

export const MARCELO_CAR: CarSpec = { kind: 'sedan', color: '#d8dadd', label: 'Tesla' }

function Wheel({ x, z, r = 0.31 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, r, z]}>
      {/* Pneu */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, 0.24, 18]} />
        <meshStandardMaterial color="#141519" roughness={0.9} />
      </mesh>
      {/* Roda de liga */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.07 : -0.07, 0, 0]}>
        <cylinderGeometry args={[r * 0.58, r * 0.58, 0.1, 12]} />
        <meshStandardMaterial color="#c8ccd2" metalness={0.9} roughness={0.18} />
      </mesh>
      {/* Raios */}
      {[0, 0.628, 1.257, 1.885, 2.513].map((a) => (
        <mesh
          key={a}
          position={[x > 0 ? 0.13 : -0.13, Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.3]}
          rotation={[a, 0, Math.PI / 2]}
        >
          <boxGeometry args={[0.025, r * 0.52, 0.05]} />
          <meshStandardMaterial color="#9ca1a8" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function Mirror({ x, z, y }: { x: number; z: number; y: number }) {
  return (
    <mesh position={[x, y, z]} castShadow>
      <boxGeometry args={[0.16, 0.08, 0.12]} />
      <meshStandardMaterial color="#1c2026" metalness={0.6} roughness={0.2} />
    </mesh>
  )
}

function Plate({ z, flip = false }: { z: number; flip?: boolean }) {
  return (
    <mesh position={[0, 0.32, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <boxGeometry args={[0.42, 0.14, 0.02]} />
      <meshStandardMaterial color="#dfe3e8" roughness={0.5} />
    </mesh>
  )
}

/** Carro low-poly apontando pra -z (frente). */
export function CarMesh({ spec }: { spec: CarSpec }) {
  const paint = useMemo(
    () => ({ color: spec.color, metalness: 0.85, roughness: 0.18 }),
    [spec.color]
  )
  const glass = { color: '#11161e', metalness: 0.5, roughness: 0.06 }
  const dark = { color: '#1a1c20', metalness: 0.4, roughness: 0.45 }

  if (spec.kind === 'panamera') {
    // Fastback baixo e alongado: capô caído, teto em curva até a traseira
    return (
      <group>
        {/* Base/chassi */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.92, 0.34, 4.6]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Capô em declive */}
        <mesh position={[0, 0.62, -1.55]} rotation={[0.07, 0, 0]} castShadow>
          <boxGeometry args={[1.84, 0.16, 1.5]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Cabine fastback (teto caindo pra trás) */}
        <mesh position={[0, 0.92, 0.12]} rotation={[-0.045, 0, 0]} castShadow>
          <boxGeometry args={[1.7, 0.42, 2.5]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[0, 1.13, 0.05]} rotation={[-0.05, 0, 0]} castShadow>
          <boxGeometry args={[1.55, 0.05, 2.0]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Traseira musculosa */}
        <mesh position={[0, 0.66, 1.95]} castShadow>
          <boxGeometry args={[1.9, 0.3, 0.7]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Barra de LED traseira (assinatura Porsche) */}
        <mesh position={[0, 0.72, 2.31]}>
          <boxGeometry args={[1.7, 0.06, 0.02]} />
          <meshStandardMaterial color="#ff2020" emissive="#e01616" emissiveIntensity={1.1} />
        </mesh>
        {/* Faróis afilados */}
        {[-0.68, 0.68].map((hx) => (
          <mesh key={hx} position={[hx, 0.58, -2.31]}>
            <boxGeometry args={[0.42, 0.1, 0.03]} />
            <meshStandardMaterial color="#f4f8ff" emissive="#dfeaff" emissiveIntensity={0.9} />
          </mesh>
        ))}
        {/* Entrada de ar frontal */}
        <mesh position={[0, 0.36, -2.31]}>
          <boxGeometry args={[1.3, 0.18, 0.03]} />
          <meshStandardMaterial {...dark} />
        </mesh>
        {/* Escapamentos duplos */}
        {[-0.5, 0.5].map((ex) => (
          <mesh key={ex} position={[ex, 0.3, 2.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.06, 10]} />
            <meshStandardMaterial color="#7a7f86" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
        <Mirror x={-0.98} z={-0.85} y={0.95} />
        <Mirror x={0.98} z={-0.85} y={0.95} />
        <Plate z={-2.33} />
        <Plate z={2.33} flip />
        <Wheel x={-0.93} z={-1.5} />
        <Wheel x={0.93} z={-1.5} />
        <Wheel x={-0.93} z={1.5} />
        <Wheel x={0.93} z={1.5} />
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.15, 4.8]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.25} />
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'sport') {
    // Cunha baixa, cockpit pequeno avançado, aerofólio
    return (
      <group>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[1.94, 0.3, 4.3]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Nariz em cunha */}
        <mesh position={[0, 0.46, -1.55]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[1.86, 0.18, 1.4]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Cockpit */}
        <mesh position={[0, 0.74, -0.1]} rotation={[-0.06, 0, 0]} castShadow>
          <boxGeometry args={[1.5, 0.34, 1.6]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        {/* Motor traseiro/deck */}
        <mesh position={[0, 0.56, 1.35]} castShadow>
          <boxGeometry args={[1.86, 0.22, 1.4]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Aerofólio */}
        <mesh position={[0, 0.92, 1.95]} castShadow>
          <boxGeometry args={[1.7, 0.05, 0.4]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {[-0.6, 0.6].map((sx) => (
          <mesh key={sx} position={[sx, 0.78, 1.95]}>
            <boxGeometry args={[0.06, 0.26, 0.08]} />
            <meshStandardMaterial {...dark} />
          </mesh>
        ))}
        {/* Entradas laterais */}
        {[-0.98, 0.98].map((sx) => (
          <mesh key={sx} position={[sx, 0.5, 0.7]}>
            <boxGeometry args={[0.03, 0.16, 0.6]} />
            <meshStandardMaterial {...dark} />
          </mesh>
        ))}
        {/* Faróis */}
        {[-0.66, 0.66].map((hx) => (
          <mesh key={hx} position={[hx, 0.5, -2.16]}>
            <boxGeometry args={[0.34, 0.08, 0.03]} />
            <meshStandardMaterial color="#f4f8ff" emissive="#dfeaff" emissiveIntensity={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.52, 2.06]}>
          <boxGeometry args={[1.5, 0.08, 0.03]} />
          <meshStandardMaterial color="#ff2020" emissive="#e01616" emissiveIntensity={1.0} />
        </mesh>
        <Mirror x={-0.95} z={-0.7} y={0.78} />
        <Mirror x={0.95} z={-0.7} y={0.78} />
        <Plate z={-2.17} />
        <Wheel x={-0.93} z={-1.4} r={0.3} />
        <Wheel x={0.93} z={-1.4} r={0.3} />
        <Wheel x={-0.93} z={1.4} r={0.32} />
        <Wheel x={0.93} z={1.4} r={0.32} />
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.15, 4.5]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.25} />
        </mesh>
      </group>
    )
  }

  if (spec.kind === 'suv') {
    // Quadradão alto com grade grande e rack de teto
    return (
      <group>
        <mesh position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[1.98, 0.74, 4.6]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Cabine alta */}
        <mesh position={[0, 1.3, 0.15]} castShadow>
          <boxGeometry args={[1.8, 0.52, 2.9]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[0, 1.58, 0.15]} castShadow>
          <boxGeometry args={[1.7, 0.06, 2.8]} />
          <meshStandardMaterial {...paint} />
        </mesh>
        {/* Rack de teto */}
        {[-0.6, 0.6].map((rx) => (
          <mesh key={rx} position={[rx, 1.66, 0.15]}>
            <boxGeometry args={[0.06, 0.06, 2.4]} />
            <meshStandardMaterial color="#7a7f86" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {/* Grade imponente */}
        <mesh position={[0, 0.72, -2.31]}>
          <boxGeometry args={[1.1, 0.4, 0.04]} />
          <meshStandardMaterial color="#23262c" metalness={0.8} roughness={0.25} />
        </mesh>
        {[-0.12, 0, 0.12].map((gy) => (
          <mesh key={gy} position={[0, 0.72 + gy, -2.34]}>
            <boxGeometry args={[1.0, 0.04, 0.01]} />
            <meshStandardMaterial color="#9ca1a8" metalness={0.9} roughness={0.15} />
          </mesh>
        ))}
        {/* Faróis retangulares */}
        {[-0.75, 0.75].map((hx) => (
          <mesh key={hx} position={[hx, 0.82, -2.31]}>
            <boxGeometry args={[0.34, 0.16, 0.03]} />
            <meshStandardMaterial color="#f4f8ff" emissive="#dfeaff" emissiveIntensity={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 2.31]}>
          <boxGeometry args={[1.6, 0.1, 0.03]} />
          <meshStandardMaterial color="#ff2020" emissive="#e01616" emissiveIntensity={0.9} />
        </mesh>
        {/* Estribo */}
        {[-1.0, 1.0].map((sx) => (
          <mesh key={sx} position={[sx, 0.32, 0]}>
            <boxGeometry args={[0.08, 0.05, 2.6]} />
            <meshStandardMaterial color="#5a5f66" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <Mirror x={-1.02} z={-0.95} y={1.25} />
        <Mirror x={1.02} z={-0.95} y={1.25} />
        <Plate z={-2.33} />
        <Plate z={2.33} flip />
        <Wheel x={-0.95} z={-1.5} r={0.37} />
        <Wheel x={0.95} z={-1.5} r={0.37} />
        <Wheel x={-0.95} z={1.5} r={0.37} />
        <Wheel x={0.95} z={1.5} r={0.37} />
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 4.8]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.25} />
        </mesh>
      </group>
    )
  }

  // sedan: três volumes com teto arqueado e grade cromada
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.92, 0.42, 4.6]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Capô */}
      <mesh position={[0, 0.74, -1.6]} rotation={[0.04, 0, 0]} castShadow>
        <boxGeometry args={[1.84, 0.1, 1.3]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Cabine */}
      <mesh position={[0, 1.0, 0.05]} castShadow>
        <boxGeometry args={[1.68, 0.42, 2.2]} />
        <meshStandardMaterial {...glass} />
      </mesh>
      <mesh position={[0, 1.22, 0.05]} castShadow>
        <boxGeometry args={[1.5, 0.05, 1.9]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Porta-malas */}
      <mesh position={[0, 0.76, 1.85]} castShadow>
        <boxGeometry args={[1.86, 0.14, 0.9]} />
        <meshStandardMaterial {...paint} />
      </mesh>
      {/* Grade cromada */}
      <mesh position={[0, 0.62, -2.31]}>
        <boxGeometry args={[0.9, 0.26, 0.04]} />
        <meshStandardMaterial color="#aeb3ba" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Faróis */}
      {[-0.7, 0.7].map((hx) => (
        <mesh key={hx} position={[hx, 0.64, -2.31]}>
          <boxGeometry args={[0.38, 0.12, 0.03]} />
          <meshStandardMaterial color="#f4f8ff" emissive="#dfeaff" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {[-0.7, 0.7].map((hx) => (
        <mesh key={hx} position={[hx, 0.68, 2.31]}>
          <boxGeometry args={[0.4, 0.1, 0.03]} />
          <meshStandardMaterial color="#ff2020" emissive="#e01616" emissiveIntensity={0.9} />
        </mesh>
      ))}
      <Mirror x={-0.97} z={-0.85} y={1.0} />
      <Mirror x={0.97} z={-0.85} y={1.0} />
      <Plate z={-2.33} />
      <Plate z={2.33} flip />
      <Wheel x={-0.93} z={-1.5} />
      <Wheel x={0.93} z={-1.5} />
      <Wheel x={-0.93} z={1.5} />
      <Wheel x={0.93} z={1.5} />
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.15, 4.8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

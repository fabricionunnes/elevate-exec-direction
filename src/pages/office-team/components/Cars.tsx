// Carros de luxo low-poly do estacionamento UNV.
// Tipos: panamera (do Fabrício), sport, sedan e suv — cores por usuário.
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

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.3, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.22, 14]} />
        <meshStandardMaterial color="#15161a" roughness={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.06 : -0.06, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.12, 10]} />
        <meshStandardMaterial color="#b9bcc2" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  )
}

/** Carro low-poly apontando pra -z (frente). */
export function CarMesh({ spec }: { spec: CarSpec }) {
  // Proporções por tipo
  const p = useMemo(() => {
    switch (spec.kind) {
      case 'panamera':
        return { bodyH: 0.5, bodyY: 0.5, cabH: 0.36, cabY: 0.92, cabL: 2.3, cabOff: 0.25, len: 4.4 }
      case 'sport':
        return { bodyH: 0.42, bodyY: 0.46, cabH: 0.32, cabY: 0.82, cabL: 1.7, cabOff: 0.1, len: 4.2 }
      case 'suv':
        return { bodyH: 0.7, bodyY: 0.66, cabH: 0.46, cabY: 1.22, cabL: 2.6, cabOff: 0.2, len: 4.5 }
      default:
        return { bodyH: 0.52, bodyY: 0.54, cabH: 0.4, cabY: 1.0, cabL: 2.1, cabOff: 0.2, len: 4.4 }
    }
  }, [spec.kind])

  return (
    <group>
      {/* Carroceria */}
      <mesh position={[0, p.bodyY, 0]} castShadow>
        <boxGeometry args={[1.9, p.bodyH, p.len]} />
        <meshStandardMaterial color={spec.color} metalness={0.75} roughness={0.22} />
      </mesh>
      {/* Cabine com vidros escuros */}
      <mesh position={[0, p.cabY, p.cabOff]} castShadow>
        <boxGeometry args={[1.66, p.cabH, p.cabL]} />
        <meshStandardMaterial color="#1c2026" metalness={0.6} roughness={0.12} />
      </mesh>
      {/* Capô levemente rebaixado (detalhe) */}
      <mesh position={[0, p.bodyY + p.bodyH / 2 + 0.01, -p.len / 2 + 0.7]}>
        <boxGeometry args={[1.7, 0.02, 1.2]} />
        <meshStandardMaterial color={spec.color} metalness={0.8} roughness={0.18} />
      </mesh>
      {/* Faróis */}
      <mesh position={[-0.6, p.bodyY + 0.08, -p.len / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.12, 0.04]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff3c4" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.6, p.bodyY + 0.08, -p.len / 2 - 0.01]}>
        <boxGeometry args={[0.4, 0.12, 0.04]} />
        <meshStandardMaterial color="#fff8e0" emissive="#fff3c4" emissiveIntensity={0.8} />
      </mesh>
      {/* Lanternas */}
      <mesh position={[0, p.bodyY + 0.08, p.len / 2 + 0.01]}>
        <boxGeometry args={[1.5, 0.09, 0.04]} />
        <meshStandardMaterial color="#a01616" emissive="#c41e1e" emissiveIntensity={0.7} />
      </mesh>
      {/* Rodas */}
      <Wheel x={-0.95} z={-p.len / 2 + 0.85} />
      <Wheel x={0.95} z={-p.len / 2 + 0.85} />
      <Wheel x={-0.95} z={p.len / 2 - 0.85} />
      <Wheel x={0.95} z={p.len / 2 - 0.85} />
      {/* Sombra */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, p.len + 0.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

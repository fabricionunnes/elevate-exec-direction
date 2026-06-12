// Corpo de robô — NPCs do escritório (Marcelo e os agentes IA).
// Metálico com detalhes coloridos por agente e luzes pulsantes.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const METAL = '#9aa3ad'
const METAL_DARK = '#6b737d'
const DEFAULT_BODY = '#0D2B5E'
const DEFAULT_GLOW = '#7fd4ff'

export default function RobotBody({
  isWalking = false,
  isSitting = false,
  body = DEFAULT_BODY,
  accent = DEFAULT_GLOW,
}: {
  isWalking?: boolean
  isSitting?: boolean
  /** cor do tronco/orelhas (identidade do agente) */
  body?: string
  /** cor das luzes (núcleo, olhos, antena) */
  accent?: string
}) {
  const NAVY = body
  const GLOW = accent
  const bodyRef = useRef<THREE.Group>(null!)
  const coreRef = useRef<THREE.MeshStandardMaterial>(null!)
  const eyeLRef = useRef<THREE.MeshStandardMaterial>(null!)
  const eyeRRef = useRef<THREE.MeshStandardMaterial>(null!)
  const antennaRef = useRef<THREE.MeshStandardMaterial>(null!)
  const headRef = useRef<THREE.Group>(null!)
  const leftLegRef = useRef<THREE.Group>(null!)
  const rightLegRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (isSitting) {
      // Sentado: corpo desce até o assento, pernas recolhidas
      if (bodyRef.current) bodyRef.current.position.y = -0.3 + Math.sin(t * 1.6) * 0.015
      if (leftLegRef.current) {
        leftLegRef.current.visible = false
        rightLegRef.current.visible = false
      }
    } else if (isWalking) {
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 7)) * 0.05
      if (leftLegRef.current) {
        leftLegRef.current.visible = true
        rightLegRef.current.visible = true
        const swing = Math.sin(t * 7) * 0.45
        leftLegRef.current.rotation.x = swing
        rightLegRef.current.rotation.x = -swing
      }
    } else {
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 1.6) * 0.03
      if (leftLegRef.current) {
        leftLegRef.current.visible = true
        rightLegRef.current.visible = true
        leftLegRef.current.rotation.x = 0
        rightLegRef.current.rotation.x = 0
      }
    }
    if (headRef.current) headRef.current.rotation.y = isWalking ? 0 : Math.sin(t * 0.4) * 0.25
    // Luzes pulsando
    const pulse = 0.75 + Math.sin(t * 2.2) * 0.45
    if (coreRef.current) coreRef.current.emissiveIntensity = pulse
    if (antennaRef.current) antennaRef.current.emissiveIntensity = 0.8 + Math.sin(t * 3.5) * 0.5
    if (eyeLRef.current) eyeLRef.current.emissiveIntensity = 1.1
    if (eyeRRef.current) eyeRRef.current.emissiveIntensity = 1.1
  })

  return (
    <group ref={bodyRef}>
      {/* Sombra */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {/* Perna esquerda (pivô no quadril) */}
      <group ref={leftLegRef} position={[-0.13, 0.68, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.55, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.61, 0.02]} castShadow>
          <boxGeometry args={[0.2, 0.14, 0.32]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>

      {/* Perna direita */}
      <group ref={rightLegRef} position={[0.13, 0.68, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.55, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.61, 0.02]} castShadow>
          <boxGeometry args={[0.2, 0.14, 0.32]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.35} />
        </mesh>
      </group>

      {/* Tronco */}
      <mesh position={[0, 0.98, 0]} castShadow>
        <boxGeometry args={[0.52, 0.62, 0.34]} />
        <meshStandardMaterial color={NAVY} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Painel do peito */}
      <mesh position={[0, 1.05, 0.175]}>
        <boxGeometry args={[0.3, 0.3, 0.02]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Núcleo luminoso */}
      <mesh position={[0, 1.05, 0.19]}>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
        <meshStandardMaterial
          ref={coreRef}
          color={GLOW}
          emissive={GLOW}
          emissiveIntensity={1}
          metalness={0.2}
          roughness={0.2}
        />
      </mesh>

      {/* Ombros */}
      <mesh position={[-0.33, 1.24, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0.33, 1.24, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Braços */}
      <mesh position={[-0.33, 0.97, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.48, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0.33, 0.97, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.48, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Mãos */}
      <mesh position={[-0.33, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0.33, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Pescoço */}
      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 10]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Cabeça */}
      <group ref={headRef} position={[0, 1.56, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.36, 0.4]} />
          <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.28} />
        </mesh>
        {/* Viseira */}
        <mesh position={[0, 0.02, 0.19]}>
          <boxGeometry args={[0.36, 0.18, 0.03]} />
          <meshStandardMaterial color="#11161f" metalness={0.4} roughness={0.25} />
        </mesh>
        {/* Olhos */}
        <mesh position={[-0.09, 0.02, 0.215]}>
          <boxGeometry args={[0.08, 0.05, 0.01]} />
          <meshStandardMaterial ref={eyeLRef} color={GLOW} emissive={GLOW} emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0.09, 0.02, 0.215]}>
          <boxGeometry args={[0.08, 0.05, 0.01]} />
          <meshStandardMaterial ref={eyeRRef} color={GLOW} emissive={GLOW} emissiveIntensity={1.1} />
        </mesh>
        {/* "Orelhas" laterais */}
        <mesh position={[-0.245, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 10]} />
          <meshStandardMaterial color={NAVY} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.245, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 10]} />
          <meshStandardMaterial color={NAVY} metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Antena */}
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
          <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <meshStandardMaterial ref={antennaRef} color={GLOW} emissive={GLOW} emissiveIntensity={1} />
        </mesh>
      </group>
    </group>
  )
}

// Avatar humano low-poly — pele, cabelo, camisa e calça personalizáveis.
// Pés no y=0 (origem do grupo no chão). Altura total ~1.75.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AvatarConfig } from '../store/useTeamStore'

interface HumanBodyProps {
  avatar: AvatarConfig
  isWalking: boolean
  isSitting?: boolean
}

function Hair({ avatar }: { avatar: AvatarConfig }) {
  const { hairStyle, hairColor } = avatar
  if (hairStyle === 'bald') return null
  return (
    <group position={[0, 1.52, 0]}>
      {/* Topo (todas as variações) */}
      <mesh position={[0, 0.07, -0.015]} castShadow>
        <sphereGeometry args={[0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hairColor} roughness={0.85} />
      </mesh>
      {hairStyle === 'long' && (
        // Cabelo descendo atrás até os ombros
        <mesh position={[0, -0.12, -0.1]} castShadow>
          <boxGeometry args={[0.3, 0.42, 0.12]} />
          <meshStandardMaterial color={hairColor} roughness={0.85} />
        </mesh>
      )}
      {hairStyle === 'bun' && (
        <mesh position={[0, 0.16, -0.13]} castShadow>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color={hairColor} roughness={0.85} />
        </mesh>
      )}
    </group>
  )
}

export default function HumanBody({ avatar, isWalking, isSitting = false }: HumanBodyProps) {
  const leftLegRef = useRef<THREE.Group>(null!)
  const rightLegRef = useRef<THREE.Group>(null!)
  const leftArmRef = useRef<THREE.Group>(null!)
  const rightArmRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (isSitting) {
      // Sentado: corpo desce até o assento, coxas pra frente
      const breathe = Math.sin(t * 1.5) * 0.01
      if (bodyRef.current) bodyRef.current.position.y = -0.31 + breathe
      if (leftLegRef.current) leftLegRef.current.rotation.x = -1.45
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.45
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.35
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.35
      return
    }
    if (isWalking) {
      const swing = Math.sin(t * 8) * 0.55
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.75
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.75
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.035
    } else {
      const breathe = Math.sin(t * 1.5) * 0.012
      if (bodyRef.current) bodyRef.current.position.y = breathe
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
    }
  })

  const { skin, shirt, pants } = avatar

  return (
    <group ref={bodyRef}>
      {/* Sombra no chão */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {/* Perna esquerda (pivô no quadril) */}
      <group ref={leftLegRef} position={[-0.1, 0.78, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <capsuleGeometry args={[0.082, 0.5, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.9} />
        </mesh>
        {/* Sapato */}
        <mesh position={[0, -0.73, 0.045]} castShadow>
          <boxGeometry args={[0.15, 0.1, 0.27]} />
          <meshStandardMaterial color="#23211f" roughness={0.6} />
        </mesh>
      </group>

      {/* Perna direita */}
      <group ref={rightLegRef} position={[0.1, 0.78, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <capsuleGeometry args={[0.082, 0.5, 4, 8]} />
          <meshStandardMaterial color={pants} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.73, 0.045]} castShadow>
          <boxGeometry args={[0.15, 0.1, 0.27]} />
          <meshStandardMaterial color="#23211f" roughness={0.6} />
        </mesh>
      </group>

      {/* Quadril */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[0.36, 0.16, 0.22]} />
        <meshStandardMaterial color={pants} roughness={0.9} />
      </mesh>

      {/* Tronco (camisa) — leve afunilamento com dois volumes */}
      <mesh position={[0, 1.08, 0]} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.22]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[0.42, 0.14, 0.24]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* Gola */}
      <mesh position={[0, 1.37, 0.02]}>
        <boxGeometry args={[0.16, 0.04, 0.18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} transparent opacity={0.35} />
      </mesh>

      {/* Braço esquerdo (pivô no ombro) */}
      <group ref={leftArmRef} position={[-0.26, 1.32, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
        {/* Mão */}
        <mesh position={[0, -0.45, 0]} castShadow>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>

      {/* Braço direito */}
      <group ref={rightArmRef} position={[0.26, 1.32, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.45, 0]} castShadow>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>

      {/* Pescoço */}
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      {/* Cabeça */}
      <mesh position={[0, 1.56, 0]} scale={[1, 1.12, 1.02]} castShadow>
        <sphereGeometry args={[0.15, 18, 14]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      {/* Orelhas */}
      <mesh position={[-0.145, 1.56, 0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.145, 1.56, 0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Olhos */}
      <mesh position={[-0.055, 1.58, 0.135]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.055, 1.58, 0.135]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-0.055, 1.58, 0.152]}>
        <sphereGeometry args={[0.011, 6, 6]} />
        <meshBasicMaterial color="#1a1208" />
      </mesh>
      <mesh position={[0.055, 1.58, 0.152]}>
        <sphereGeometry args={[0.011, 6, 6]} />
        <meshBasicMaterial color="#1a1208" />
      </mesh>
      {/* Boca */}
      <mesh position={[0, 1.495, 0.142]}>
        <boxGeometry args={[0.06, 0.012, 0.01]} />
        <meshBasicMaterial color="#8a4a3a" />
      </mesh>

      <Hair avatar={avatar} />
    </group>
  )
}

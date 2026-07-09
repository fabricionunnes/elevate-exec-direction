// Avatar humano low-poly realista — pele, cabelo, camisa e calça
// personalizáveis. Pés no y=0 (origem do grupo no chão). Altura ~1.75.
// Pernas articuladas (coxa+canela com joelho) e braços com manga e pele.
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
  const mat = <meshStandardMaterial color={hairColor} roughness={0.78} />

  // Raspado (máquina): só uma calota rasa, sem laterais — visual masculino
  if (hairStyle === 'buzz') {
    return (
      <group position={[0, 1.56, 0]}>
        <mesh position={[0, 0.05, -0.02]} castShadow scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.158, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          {mat}
        </mesh>
      </group>
    )
  }

  // Cacheado volumoso
  if (hairStyle === 'curly') {
    return (
      <group position={[0, 1.56, 0]}>
        {[
          [0, 0.12, -0.02, 0.115],
          [-0.09, 0.08, -0.03, 0.085],
          [0.09, 0.08, -0.03, 0.085],
          [0, 0.07, -0.12, 0.09],
          [-0.05, 0.13, 0.05, 0.07],
          [0.06, 0.12, 0.04, 0.07],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <sphereGeometry args={[r, 10, 8]} />
            {mat}
          </mesh>
        ))}
        {/* Nuca */}
        <mesh position={[0, -0.02, -0.115]}>
          <boxGeometry args={[0.24, 0.16, 0.08]} />
          {mat}
        </mesh>
      </group>
    )
  }

  return (
    <group position={[0, 1.56, 0]}>
      {/* Topo com volume */}
      <mesh position={[0, 0.06, -0.02]} castShadow>
        <sphereGeometry args={[0.168, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        {mat}
      </mesh>
      {/* Laterais (costeletas) */}
      <mesh position={[-0.14, -0.01, -0.04]}>
        <boxGeometry args={[0.045, 0.14, 0.13]} />
        {mat}
      </mesh>
      <mesh position={[0.14, -0.01, -0.04]}>
        <boxGeometry args={[0.045, 0.14, 0.13]} />
        {mat}
      </mesh>
      {/* Nuca */}
      <mesh position={[0, -0.02, -0.115]}>
        <boxGeometry args={[0.24, 0.16, 0.08]} />
        {mat}
      </mesh>
      {hairStyle === 'long' && (
        // Comprimento descendo até os ombros
        <mesh position={[0, -0.18, -0.1]} castShadow>
          <boxGeometry args={[0.3, 0.34, 0.12]} />
          {mat}
        </mesh>
      )}
      {hairStyle === 'bun' && (
        <mesh position={[0, 0.13, -0.16]} castShadow>
          <sphereGeometry args={[0.072, 10, 8]} />
          {mat}
        </mesh>
      )}
      {hairStyle === 'ponytail' && (
        <>
          <mesh position={[0, 0.1, -0.17]} castShadow>
            <sphereGeometry args={[0.055, 10, 8]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.08, -0.2]} rotation={[0.35, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.3, 8]} />
            {mat}
          </mesh>
        </>
      )}
    </group>
  )
}

/** Barba/bigode — dá identidade masculina ao rosto. */
function FacialHair({ avatar }: { avatar: AvatarConfig }) {
  const style = avatar.facialHair ?? 'none'
  if (style === 'none') return null
  const color = avatar.hairColor
  return (
    <group position={[0, 1.56, 0]}>
      {(style === 'beard' || style === 'stubble') && (
        // Queixo + bochechas (barba cheia é mais grossa que a por fazer)
        <>
          <mesh position={[0, -0.105, 0.1]} castShadow>
            <boxGeometry args={style === 'beard' ? [0.235, 0.115, 0.1] : [0.22, 0.08, 0.075]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          <mesh position={[-0.105, -0.06, 0.06]}>
            <boxGeometry args={[0.04, style === 'beard' ? 0.12 : 0.09, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          <mesh position={[0.105, -0.06, 0.06]}>
            <boxGeometry args={[0.04, style === 'beard' ? 0.12 : 0.09, 0.12]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        </>
      )}
      {(style === 'beard' || style === 'mustache') && (
        <mesh position={[0, -0.052, 0.145]}>
          <boxGeometry args={[0.13, 0.032, 0.025]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      )}
    </group>
  )
}

export default function HumanBody({ avatar, isWalking, isSitting = false }: HumanBodyProps) {
  const leftLegRef = useRef<THREE.Group>(null!)
  const rightLegRef = useRef<THREE.Group>(null!)
  const leftShinRef = useRef<THREE.Group>(null!)
  const rightShinRef = useRef<THREE.Group>(null!)
  const leftArmRef = useRef<THREE.Group>(null!)
  const rightArmRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (isSitting) {
      // Sentado: corpo desce até o assento, coxa horizontal e JOELHO
      // dobrado 90° (canela vertical pro chão)
      const breathe = Math.sin(t * 1.5) * 0.01
      if (bodyRef.current) bodyRef.current.position.y = -0.31 + breathe
      if (leftLegRef.current) leftLegRef.current.rotation.x = -1.5
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.5
      if (leftShinRef.current) leftShinRef.current.rotation.x = 1.5
      if (rightShinRef.current) rightShinRef.current.rotation.x = 1.5
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.35
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.35
      return
    }
    if (isWalking) {
      const swing = Math.sin(t * 8) * 0.55
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
      // Joelho flexiona quando a perna vai pra trás (passada natural)
      if (leftShinRef.current) leftShinRef.current.rotation.x = Math.max(0, swing) * 0.9
      if (rightShinRef.current) rightShinRef.current.rotation.x = Math.max(0, -swing) * 0.9
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.75
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.75
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.035
    } else {
      const breathe = Math.sin(t * 1.5) * 0.012
      if (bodyRef.current) bodyRef.current.position.y = breathe
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (leftShinRef.current) leftShinRef.current.rotation.x = 0
      if (rightShinRef.current) rightShinRef.current.rotation.x = 0
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

      {/* Perna esquerda: coxa (pivô no quadril) + canela (pivô no joelho) */}
      <group ref={leftLegRef} position={[-0.1, 0.78, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.088, 0.22, 4, 10]} />
          <meshStandardMaterial color={pants} roughness={0.85} />
        </mesh>
        <group ref={leftShinRef} position={[0, -0.36, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.2, 4, 10]} />
            <meshStandardMaterial color={pants} roughness={0.85} />
          </mesh>
          {/* Sapato */}
          <mesh position={[0, -0.345, 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.09, 0.28]} />
            <meshStandardMaterial color="#2a241f" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Perna direita */}
      <group ref={rightLegRef} position={[0.1, 0.78, 0]}>
        <mesh position={[0, -0.17, 0]} castShadow>
          <capsuleGeometry args={[0.088, 0.22, 4, 10]} />
          <meshStandardMaterial color={pants} roughness={0.85} />
        </mesh>
        <group ref={rightShinRef} position={[0, -0.36, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.2, 4, 10]} />
            <meshStandardMaterial color={pants} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.345, 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.09, 0.28]} />
            <meshStandardMaterial color="#2a241f" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Quadril + cinto */}
      <mesh position={[0, 0.84, 0]} castShadow>
        <cylinderGeometry args={[0.165, 0.18, 0.18, 14]} />
        <meshStandardMaterial color={pants} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.045, 14]} />
        <meshStandardMaterial color="#2a2118" roughness={0.55} />
      </mesh>

      {/* Tronco afunilado (camisa) */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.165, 0.32, 14]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>
      {/* Peito/ombros */}
      <mesh position={[0, 1.295, 0]} castShadow>
        <cylinderGeometry args={[0.155, 0.195, 0.13, 14]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>
      {/* Colarinho */}
      <mesh position={[0, 1.375, 0]}>
        <cylinderGeometry args={[0.085, 0.105, 0.05, 12]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>

      {/* Ombros */}
      <mesh position={[-0.235, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>
      <mesh position={[0.235, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.75} />
      </mesh>

      {/* Braço esquerdo: manga + antebraço de pele + mão */}
      <group ref={leftArmRef} position={[-0.26, 1.32, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.16, 4, 10]} />
          <meshStandardMaterial color={shirt} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.16, 4, 10]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.455, 0]} castShadow>
          <sphereGeometry args={[0.058, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
      </group>

      {/* Braço direito */}
      <group ref={rightArmRef} position={[0.26, 1.32, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.16, 4, 10]} />
          <meshStandardMaterial color={shirt} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.16, 4, 10]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
        <mesh position={[0, -0.455, 0]} castShadow>
          <sphereGeometry args={[0.058, 10, 8]} />
          <meshStandardMaterial color={skin} roughness={0.62} />
        </mesh>
      </group>

      {/* Pescoço */}
      <mesh position={[0, 1.43, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.1, 12]} />
        <meshStandardMaterial color={skin} roughness={0.62} />
      </mesh>

      {/* Cabeça */}
      <mesh position={[0, 1.565, 0]} scale={[1, 1.14, 1.04]} castShadow>
        <sphereGeometry args={[0.148, 20, 16]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
      {/* Orelhas */}
      <mesh position={[-0.145, 1.56, 0]} scale={[0.5, 1, 0.8]}>
        <sphereGeometry args={[0.038, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.62} />
      </mesh>
      <mesh position={[0.145, 1.56, 0]} scale={[0.5, 1, 0.8]}>
        <sphereGeometry args={[0.038, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.62} />
      </mesh>
      {/* Nariz */}
      <mesh position={[0, 1.55, 0.148]} scale={[0.7, 1, 1]}>
        <sphereGeometry args={[0.026, 8, 6]} />
        <meshStandardMaterial color={skin} roughness={0.58} />
      </mesh>
      {/* Sobrancelhas */}
      <mesh position={[-0.055, 1.615, 0.132]} rotation={[0.15, 0, 0.06]}>
        <boxGeometry args={[0.052, 0.012, 0.012]} />
        <meshStandardMaterial color={avatar.hairStyle === 'bald' ? '#3a2e22' : avatar.hairColor} roughness={0.8} />
      </mesh>
      <mesh position={[0.055, 1.615, 0.132]} rotation={[0.15, 0, -0.06]}>
        <boxGeometry args={[0.052, 0.012, 0.012]} />
        <meshStandardMaterial color={avatar.hairStyle === 'bald' ? '#3a2e22' : avatar.hairColor} roughness={0.8} />
      </mesh>
      {/* Olhos */}
      <mesh position={[-0.055, 1.585, 0.131]} scale={[1, 1.15, 0.55]}>
        <sphereGeometry args={[0.023, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </mesh>
      <mesh position={[0.055, 1.585, 0.131]} scale={[1, 1.15, 0.55]}>
        <sphereGeometry args={[0.023, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </mesh>
      <mesh position={[-0.055, 1.583, 0.144]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshBasicMaterial color="#3b2a1a" />
      </mesh>
      <mesh position={[0.055, 1.583, 0.144]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshBasicMaterial color="#3b2a1a" />
      </mesh>
      <mesh position={[-0.055, 1.583, 0.151]}>
        <sphereGeometry args={[0.005, 6, 6]} />
        <meshBasicMaterial color="#0c0805" />
      </mesh>
      <mesh position={[0.055, 1.583, 0.151]}>
        <sphereGeometry args={[0.005, 6, 6]} />
        <meshBasicMaterial color="#0c0805" />
      </mesh>
      {/* Boca */}
      <mesh position={[0, 1.498, 0.138]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.055, 0.012, 0.012]} />
        <meshStandardMaterial color="#9c5a4a" roughness={0.6} />
      </mesh>

      <Hair avatar={avatar} />
      <FacialHair avatar={avatar} />
    </group>
  )
}

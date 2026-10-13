// Avatar humano low-poly realista — pele, cabelo, camisa e calça
// personalizáveis. Pés no y=0 (origem do grupo no chão). Altura ~1.75.
// Pernas articuladas (coxa+canela com joelho) e braços com manga e pele.
// Animação (fase 3): ciclo de caminhada proporcional à velocidade real do
// grupo pai, idle com respiração e microajustes, pose sentada de verdade e
// cabeça que acompanha a direção do movimento. Só rotações de grupos (sem
// skinned mesh), tudo num único useFrame por avatar.
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
      <group position={[0, 0.09, 0]}>
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
      <group position={[0, 0.09, 0]}>
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
    <group position={[0, 0.09, 0]}>
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
    <group position={[0, 0.09, 0]}>
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
  const torsoRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Group>(null!)
  // Estado da animação (sem re-render): velocidade medida no grupo pai
  const lastPos = useRef<{ x: number; z: number; rot: number; init: boolean }>({ x: 0, z: 0, rot: 0, init: false })
  const speedRef = useRef(0)
  const yawVelRef = useRef(0)
  const phaseRef = useRef(0)
  const blendRef = useRef(0) // 0 = parado, 1 = andando (suaviza a troca)
  const sitBlendRef = useRef(0)

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    const dt = Math.min(0.05, Math.max(0.001, delta))
    const body = bodyRef.current
    if (!body) return

    // Velocidade e giro reais (do grupo pai, que LocalPlayer/RemotePlayer movem)
    const parent = body.parent
    if (parent) {
      const lp = lastPos.current
      if (!lp.init) {
        lp.x = parent.position.x
        lp.z = parent.position.z
        lp.rot = parent.rotation.y
        lp.init = true
      }
      const d = Math.hypot(parent.position.x - lp.x, parent.position.z - lp.z)
      const sp = d > 3 ? 0 : d / dt // teleporte não conta como velocidade
      speedRef.current += (sp - speedRef.current) * Math.min(1, 10 * dt)
      let dr = parent.rotation.y - lp.rot
      while (dr > Math.PI) dr -= Math.PI * 2
      while (dr < -Math.PI) dr += Math.PI * 2
      yawVelRef.current += (dr / dt - yawVelRef.current) * Math.min(1, 8 * dt)
      lp.x = parent.position.x
      lp.z = parent.position.z
      lp.rot = parent.rotation.y
    }

    const L = leftLegRef.current
    const R = rightLegRef.current
    const LS = leftShinRef.current
    const RS = rightShinRef.current
    const LA = leftArmRef.current
    const RA = rightArmRef.current
    const torso = torsoRef.current
    const head = headRef.current

    // Blends suaves entre os estados
    const walking = !isSitting && (isWalking || speedRef.current > 0.35)
    blendRef.current += ((walking ? 1 : 0) - blendRef.current) * Math.min(1, 8 * dt)
    sitBlendRef.current += ((isSitting ? 1 : 0) - sitBlendRef.current) * Math.min(1, 10 * dt)
    const wb = blendRef.current
    const sb = sitBlendRef.current

    // Fase do passo cresce com a velocidade (parado de pé = fase congelada)
    const speedNorm = Math.min(1.4, Math.max(0.45, speedRef.current / 5)) // 5 = velocidade padrão
    if (walking) phaseRef.current += dt * (6.5 + 3.5 * speedNorm)
    const ph = phaseRef.current
    const amp = 0.5 * speedNorm * wb

    // Passada: coxas alternadas, joelho dobra na perna que vai pra trás
    const swing = Math.sin(ph) * amp
    const legL = swing
    const legR = -swing
    const shinL = Math.max(0, swing) * 1.1 * wb
    const shinR = Math.max(0, -swing) * 1.1 * wb
    const armL = -swing * 0.8
    const armR = swing * 0.8

    // Idle: respiração + microajustes (peso de um pé pro outro, braço mexe)
    const breathe = Math.sin(t * 1.5) * 0.012
    const idleArm = Math.sin(t * 0.9) * 0.03
    const idleWeight = Math.sin(t * 0.45) * 0.02

    // Sentado: coxa horizontal (-90º), canela pra baixo (+90º), braços à frente
    if (L) L.rotation.x = THREE.MathUtils.lerp(legL * (1 - sb), -1.5, sb)
    if (R) R.rotation.x = THREE.MathUtils.lerp(legR * (1 - sb), -1.5, sb)
    if (LS) LS.rotation.x = THREE.MathUtils.lerp(shinL * (1 - sb), 1.5, sb)
    if (RS) RS.rotation.x = THREE.MathUtils.lerp(shinR * (1 - sb), 1.5, sb)
    if (LA) LA.rotation.x = THREE.MathUtils.lerp(armL + idleArm * (1 - wb), -0.55, sb)
    if (RA) RA.rotation.x = THREE.MathUtils.lerp(armR - idleArm * (1 - wb), -0.55, sb)
    if (LA) LA.rotation.z = THREE.MathUtils.lerp(0.06, 0.12, sb)
    if (RA) RA.rotation.z = THREE.MathUtils.lerp(-0.06, -0.12, sb)

    // Corpo: sobe e desce com o passo, desce até o assento quando sentado
    const bob = Math.abs(Math.sin(ph)) * 0.035 * wb
    body.position.y = THREE.MathUtils.lerp(bob + breathe, -0.31 + breathe * 0.8, sb)

    // Tronco: inclina pra frente ao andar, balança de leve com o passo,
    // e um leve "ajeitar" quando parado
    if (torso) {
      torso.rotation.x = THREE.MathUtils.lerp(0.06 * wb + idleWeight * 0.3, 0.1, sb)
      torso.rotation.z = Math.sin(ph) * 0.035 * wb + idleWeight * (1 - wb)
    }

    // Cabeça: vira levemente pra onde o corpo está girando (antecipa a
    // curva), olha um pouco pra baixo sentado, e passeia o olhar no idle
    if (head) {
      const lead = Math.max(-0.45, Math.min(0.45, yawVelRef.current * 0.12))
      const idleLook = Math.sin(t * 0.35) * 0.18 * (1 - wb) * (1 - sb)
      head.rotation.y += (lead * wb + idleLook - head.rotation.y) * Math.min(1, 6 * dt)
      head.rotation.x = THREE.MathUtils.lerp(Math.sin(ph * 0.5) * 0.02 * wb, 0.08, sb)
    }
  })

  const { skin, shirt, pants } = avatar

  return (
    <group ref={bodyRef}>
      {/* Sombra no chão */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} depthWrite={false} />
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

      {/* Tronco (pivô no quadril, inclina e balança ao andar) */}
      <group ref={torsoRef} position={[0, 0.94, 0]}>
      <group position={[0, -0.94, 0]}>
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

      {/* Cabeça (pivô no pescoço: vira pra direção do movimento) */}
      <group ref={headRef} position={[0, 1.47, 0]}>
      <group position={[0, -1.47, 0]}>
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

      <group position={[0, 1.47, 0]}>
        <Hair avatar={avatar} />
        <FacialHair avatar={avatar} />
      </group>
      </group>
      </group>
      </group>
      </group>
    </group>
  )
}

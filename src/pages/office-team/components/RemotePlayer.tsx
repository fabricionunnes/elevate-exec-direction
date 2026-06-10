// Jogador remoto — recebe posição via Realtime e interpola suavemente.
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { PlayerBody } from '../../office/components/Player'
import type { RemotePlayerState } from '../store/useTeamStore'

const LERP_SPEED = 10

export default function RemotePlayer({ player }: { player: RemotePlayerState }) {
  const groupRef = useRef<THREE.Group>(null!)
  const initializedRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const g = groupRef.current
    const [tx, , tz] = player.position

    if (!initializedRef.current) {
      g.position.set(tx, 0, tz)
      g.rotation.y = player.rotation
      initializedRef.current = true
      return
    }

    const dx = tx - g.position.x
    const dz = tz - g.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Teleporta se a distância for grande demais (ex: reconexão)
    if (dist > 8) {
      g.position.set(tx, 0, tz)
    } else {
      const t = Math.min(1, LERP_SPEED * delta)
      g.position.x += dx * t
      g.position.z += dz * t
    }

    let angleDiff = player.rotation - g.rotation.y
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    g.rotation.y += angleDiff * Math.min(1, 12 * delta)

    const walking = player.moving || dist > 0.08
    if (walking !== isWalking) setIsWalking(walking)
  })

  return (
    <group ref={groupRef}>
      <PlayerBody color={player.color} pantsColor={player.pantsColor} isWalking={isWalking} />

      <Billboard position={[0, 2.1, 0]} follow={true}>
        <Text
          fontSize={0.26}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {player.name}
        </Text>
      </Billboard>

      {player.role ? (
        <Billboard position={[0, 1.86, 0]} follow={true}>
          <Text
            fontSize={0.15}
            color="#c8d4e8"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {player.role}
          </Text>
        </Billboard>
      ) : null}

      {/* Indicador de chamada: anel verde + ícone de mic */}
      {player.inCall && (
        <>
          <mesh position={[0, -0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.5, 16]} />
            <meshBasicMaterial color={player.micOn ? '#4CAF50' : '#e53935'} transparent opacity={0.7} />
          </mesh>
          <Billboard position={[0, 2.45, 0]} follow={true}>
            <Text fontSize={0.22} anchorX="center" anchorY="middle">
              {player.micOn ? '🎙️' : '🔇'}
            </Text>
          </Billboard>
        </>
      )}
    </group>
  )
}

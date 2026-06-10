// NPC Marcelo Almeida — agente consultor comercial IA, sempre presente
// na sala "Marcelo Almeida". Clique nele (ou aperte E por perto) pra conversar.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import RobotBody from './RobotBody'
import { useTeamStore } from '../store/useTeamStore'
import type { OfficeRoom } from '../lib/rooms'

const INTERACT_RADIUS = 3

export function findMarceloRoom(rooms: OfficeRoom[]): OfficeRoom | null {
  return rooms.find((r) => /marcelo/i.test(r.name)) ?? null
}

export default function MarceloNpc() {
  const rooms = useTeamStore((s) => s.rooms)
  const setNpcChatOpen = useTeamStore((s) => s.setNpcChatOpen)
  const hintRef = useRef<THREE.Group>(null!)

  const room = findMarceloRoom(rooms)
  // Em pé ao lado da mesa, olhando pra porta (norte)
  const npcX = room ? room.x + 1.2 : 0
  const npcZ = room ? room.z + room.depth / 2 - 1.7 : 0

  // Tecla E perto do Marcelo abre o chat
  useEffect(() => {
    if (!room) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const [px, , pz] = useTeamStore.getState().playerPosition
      const dist = Math.hypot(px - npcX, pz - npcZ)
      if (dist < INTERACT_RADIUS) setNpcChatOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, npcX, npcZ, setNpcChatOpen])

  // Mostra a dica "aperte E" só quando o jogador está perto
  useFrame(() => {
    if (!hintRef.current) return
    const [px, , pz] = useTeamStore.getState().playerPosition
    hintRef.current.visible = Math.hypot(px - npcX, pz - npcZ) < INTERACT_RADIUS
  })

  if (!room) return null

  return (
    <group
      position={[npcX, 0, npcZ]}
      rotation={[0, Math.PI, 0]}
      onClick={(e) => {
        e.stopPropagation()
        setNpcChatOpen(true)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <RobotBody />

      <Billboard position={[0, 2.25, 0]} follow={true}>
        <Text
          fontSize={0.26}
          color="#7fd4ff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          Marcelo Almeida
        </Text>
      </Billboard>
      <Billboard position={[0, 2.0, 0]} follow={true}>
        <Text
          fontSize={0.15}
          color="#c8d4e8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          Consultor · IA
        </Text>
      </Billboard>

      {/* Dica de interação (visível só de perto) */}
      <group ref={hintRef} visible={false}>
        <Billboard position={[0, 2.55, 0]} follow={true}>
          <Text
            fontSize={0.18}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            💬 aperte E pra conversar
          </Text>
        </Billboard>
      </group>

      {/* Anel de "sempre online" */}
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 16]} />
        <meshBasicMaterial color="#7fd4ff" transparent opacity={0.65} />
      </mesh>
    </group>
  )
}

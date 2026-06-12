// Agentes IA da UNV como robôs no escritório — cada um na sala do seu setor.
// Clique abre o chat (com checagem de permissão no servidor; o master define
// quem pode falar com cada um no próprio painel).
import { useMemo } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { useTeamStore } from '../store/useTeamStore'
import { OFFICE_AGENTS, OfficeAgent } from '../lib/agents'
import RobotBody from './RobotBody'

function AgentFigure({ agent, x, z }: { agent: OfficeAgent; x: number; z: number }) {
  const setAgentChatFor = useTeamStore((s) => s.setAgentChatFor)

  return (
    <group position={[x, 0, z]} rotation={[0, 0, 0]}>
      <group
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          setAgentChatFor(agent.key)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <RobotBody body={agent.body} accent={agent.accent} />
        {/* hitbox generosa pro clique */}
        <mesh position={[0, 0.95, 0]} visible={false}>
          <boxGeometry args={[0.9, 1.9, 0.9]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
      <Billboard position={[0, 2.22, 0]} follow>
        <Text fontSize={0.165} color="#ffffff" outlineWidth={0.014} outlineColor="#000000" anchorX="center">
          🤖 {agent.name}
        </Text>
      </Billboard>
      <Billboard position={[0, 2.0, 0]} follow>
        <Text fontSize={0.115} color={agent.accent} outlineWidth={0.011} outlineColor="#000000" anchorX="center">
          {agent.title}
        </Text>
      </Billboard>
    </group>
  )
}

export default function AgentNpcs() {
  const rooms = useTeamStore((s) => s.rooms)

  // Posiciona cada agente no fundo da sala do seu setor, longe da TV central
  const placed = useMemo(() => {
    return OFFICE_AGENTS.flatMap((agent) => {
      const room = rooms.find((r) => r.roomType === 'sector' && r.sector === agent.sector)
      if (!room) return []
      const x = agent.slot === 0 ? room.x - room.width / 2 + 1.5 : room.x + room.width / 2 - 1.5
      const z = room.z - room.depth / 2 + 1.1
      return [{ agent, x, z }]
    })
  }, [rooms])

  return (
    <>
      {placed.map(({ agent, x, z }) => (
        <AgentFigure key={agent.key} agent={agent} x={x} z={z} />
      ))}
    </>
  )
}

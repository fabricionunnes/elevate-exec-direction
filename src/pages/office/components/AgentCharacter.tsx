import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { AgentConfig } from '../config/agents'
import { useGameStore } from '../store/useGameStore'
import { findPath } from '../lib/navigation'

interface VoxelCharacterProps {
  color: string
  pantsColor: string
  isWalking: boolean
  isWorking: boolean
  isCoffee: boolean
}

function VoxelCharacter({ color, pantsColor, isWalking, isWorking, isCoffee }: VoxelCharacterProps) {
  const leftLegRef = useRef<THREE.Mesh>(null!)
  const rightLegRef = useRef<THREE.Mesh>(null!)
  const leftArmRef = useRef<THREE.Mesh>(null!)
  const rightArmRef = useRef<THREE.Mesh>(null!)
  const bodyRef = useRef<THREE.Group>(null!)
  const headRef = useRef<THREE.Mesh>(null!)
  const rightArmGroupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    if (isWalking) {
      const swing = Math.sin(t * 6) * 0.5
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.03
        bodyRef.current.rotation.z = Math.sin(t * 6) * 0.02
      }
    } else {
      // Breathing animation
      const breathe = Math.sin(t * 1.5) * 0.015
      if (bodyRef.current) {
        bodyRef.current.position.y = breathe
        bodyRef.current.rotation.z = 0
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0

      if (isWorking) {
        // Head-down working animation
        if (headRef.current) headRef.current.rotation.x = Math.PI * 0.15 + Math.sin(t * 0.8) * 0.05
        if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.PI * 0.3
      } else if (isCoffee) {
        // Raise right arm to drink
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = -Math.PI * 0.6 + Math.sin(t * 2) * 0.1
        }
        if (headRef.current) headRef.current.rotation.x = -Math.PI * 0.1
      } else {
        if (headRef.current) headRef.current.rotation.x = Math.sin(t * 0.5) * 0.05
        if (rightArmRef.current) rightArmRef.current.rotation.x = 0
        if (rightArmGroupRef.current) rightArmGroupRef.current.rotation.x = 0
      }
    }
  })

  return (
    <group ref={bodyRef}>
      {/* Shadow */}
      <mesh position={[0, -0.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.13, 1.15, 0.28]}>
        <boxGeometry args={[0.1, 0.08, 0.01]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0.13, 1.15, 0.28]}>
        <boxGeometry args={[0.1, 0.08, 0.01]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Eye whites */}
      <mesh position={[-0.13, 1.16, 0.285]}>
        <boxGeometry args={[0.06, 0.05, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.13, 1.16, 0.285]}>
        <boxGeometry args={[0.06, 0.05, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Mouth */}
      <mesh position={[0, 1.0, 0.28]}>
        <boxGeometry args={[0.2, 0.04, 0.01]} />
        <meshBasicMaterial color="#1a0a00" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Body accent line */}
      <mesh position={[0, 0.7, 0.155]}>
        <boxGeometry args={[0.15, 0.35, 0.01]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.2} />
      </mesh>

      {/* Left Arm */}
      <group position={[-0.35, 0.85, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.55, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmGroupRef} position={[0.35, 0.85, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.55, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        {/* Cup if drinking coffee */}
        {isCoffee && (
          <mesh position={[0.1, -0.45, 0.1]}>
            <cylinderGeometry args={[0.06, 0.05, 0.1, 8]} />
            <meshStandardMaterial color="#f5f5f5" roughness={0.8} />
          </mesh>
        )}
      </group>

      {/* Pants / Lower body */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.5, 0.15, 0.3]} />
        <meshStandardMaterial color={pantsColor} roughness={0.9} />
      </mesh>

      {/* Left Leg */}
      <group position={[-0.13, 0.2, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.22, 0.55, 0.25]} />
          <meshStandardMaterial color={pantsColor} roughness={0.9} />
        </mesh>
        {/* Left shoe */}
        <mesh position={[0, -0.52, 0.05]}>
          <boxGeometry args={[0.22, 0.1, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.13, 0.2, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.22, 0.55, 0.25]} />
          <meshStandardMaterial color={pantsColor} roughness={0.9} />
        </mesh>
        {/* Right shoe */}
        <mesh position={[0, -0.52, 0.05]}>
          <boxGeometry args={[0.22, 0.1, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

const STATE_LABELS: Record<string, string> = {
  IDLE: '💼 Idle',
  WALKING: '🚶 Walking',
  COFFEE: '☕ Coffee break',
  MEETING: '📊 Meeting',
  WORKING: '💻 Working',
}

interface AgentCharacterProps {
  agent: AgentConfig
  playerPosition: [number, number, number]
  meetingTriggered: boolean
}

export default function AgentCharacter({ agent, playerPosition, meetingTriggered }: AgentCharacterProps) {
  const groupRef = useRef<THREE.Group>(null!)
  // Path (list of [x, z] waypoints) toward the current target, routed through doorways
  const pathRef = useRef<[number, number][] | null>(null)
  const pathGoalRef = useRef<string | null>(null)
  const { agentStates, setAgentState, nearbyAgentId, chat } = useGameStore()

  const runtime = agentStates[agent.id]
  // Em conversa, o agente fica parado olhando pro player até o chat fechar
  const isChatting = chat.isOpen && chat.activeAgentId === agent.id

  // Initialize runtime state
  useEffect(() => {
    if (!agentStates[agent.id]) {
      setAgentState(agent.id, {
        id: agent.id,
        state: 'IDLE',
        position: [...agent.homePosition] as [number, number, number],
        targetPosition: null,
        waypointIndex: 0,
        stateTimer: 0,
        nextStateChange: 10 + Math.random() * 20,
      })
    }
  }, [agent.id])

  // Handle meeting trigger
  useEffect(() => {
    if (meetingTriggered && runtime) {
      setAgentState(agent.id, {
        state: 'MEETING',
        targetPosition: agent.meetingPosition,
      })
    } else if (!meetingTriggered && runtime?.state === 'MEETING') {
      setAgentState(agent.id, {
        state: 'WALKING',
        targetPosition: agent.homePosition,
      })
    }
  }, [meetingTriggered])

  useFrame((_, delta) => {
    if (!runtime || !groupRef.current) return

    const pos = runtime.position
    const target = runtime.targetPosition

    // Conversa aberta: congela no lugar, cancela deslocamento pendente e
    // vira de frente pro player. O timer da rotina não anda — ao fechar o
    // chat, ele retoma de onde estava.
    if (isChatting) {
      if (target) {
        pathRef.current = null
        pathGoalRef.current = null
        setAgentState(agent.id, {
          targetPosition: null,
          state: runtime.state === 'MEETING' ? 'MEETING' : 'IDLE',
        })
      }
      const fdx = playerPosition[0] - pos[0]
      const fdz = playerPosition[2] - pos[2]
      if (fdx * fdx + fdz * fdz > 0.0001) {
        groupRef.current.rotation.y = Math.atan2(fdx, fdz)
      }
      groupRef.current.position.set(pos[0], 0, pos[2])
      return
    }

    // Move toward target, following a path that goes through doorways
    if (target) {
      // (Re)compute the path whenever the goal changes
      const goalKey = `${target[0]},${target[2]}`
      if (pathGoalRef.current !== goalKey) {
        pathGoalRef.current = goalKey
        pathRef.current = findPath([pos[0], pos[2]], [target[0], target[2]])
      }

      const path = pathRef.current
      const next: [number, number] =
        path && path.length > 0 ? path[0] : [target[0], target[2]]

      const dx = next[0] - pos[0]
      const dz = next[1] - pos[2]
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > 0.15) {
        const speed = 2.5
        const newX = pos[0] + (dx / dist) * speed * delta
        const newZ = pos[2] + (dz / dist) * speed * delta

        // Rotate to face direction
        const angle = Math.atan2(dx, dz)
        groupRef.current.rotation.y = angle

        setAgentState(agent.id, {
          position: [newX, 0, newZ],
        })
        groupRef.current.position.set(newX, 0, newZ)
      } else if (path && path.length > 1) {
        // Reached an intermediate waypoint - advance to the next one
        path.shift()
      } else {
        // Arrived at the final target
        pathRef.current = null
        pathGoalRef.current = null
        setAgentState(agent.id, {
          position: target,
          targetPosition: null,
        })
        groupRef.current.position.set(target[0], 0, target[2])
      }
    } else {
      groupRef.current.position.set(pos[0], 0, pos[2])
    }

    // State machine timer
    if (runtime.state !== 'MEETING') {
      const newTimer = runtime.stateTimer + delta
      setAgentState(agent.id, { stateTimer: newTimer })

      if (newTimer >= runtime.nextStateChange && !target) {
        const rand = Math.random()

        if (rand < 0.15) {
          // Go to coffee
          setAgentState(agent.id, {
            state: 'COFFEE',
            targetPosition: agent.coffeePosition,
            stateTimer: 0,
            nextStateChange: 8 + Math.random() * 10,
          })
        } else if (rand < 0.4) {
          // Walk to waypoint
          const wp = agent.waypoints[runtime.waypointIndex % agent.waypoints.length]
          setAgentState(agent.id, {
            state: 'WALKING',
            targetPosition: wp,
            waypointIndex: (runtime.waypointIndex + 1) % agent.waypoints.length,
            stateTimer: 0,
            nextStateChange: 5 + Math.random() * 10,
          })
        } else if (rand < 0.7) {
          // Work at desk
          setAgentState(agent.id, {
            state: 'WORKING',
            targetPosition: agent.homePosition,
            stateTimer: 0,
            nextStateChange: 15 + Math.random() * 20,
          })
        } else {
          // Return home idle
          setAgentState(agent.id, {
            state: 'IDLE',
            targetPosition: agent.homePosition,
            stateTimer: 0,
            nextStateChange: 10 + Math.random() * 15,
          })
        }
      }
    }
  })

  if (!runtime) return null

  const state = runtime.state
  const isWalking = (state === 'WALKING' || state === 'COFFEE' || state === 'MEETING') && !!runtime.targetPosition
  const isWorking = state === 'WORKING' && !runtime.targetPosition
  const isCoffee = state === 'COFFEE' && !runtime.targetPosition

  const isNearby = nearbyAgentId === agent.id

  return (
    <group ref={groupRef} position={agent.homePosition}>
      <VoxelCharacter
        color={agent.color}
        pantsColor={agent.pantsColor}
        isWalking={isWalking}
        isWorking={isWorking}
        isCoffee={isCoffee}
      />

      {/* Name label */}
      <Billboard position={[0, 2.1, 0]} follow={true}>
        <Text
          fontSize={0.25}
          color={agent.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {agent.name}
        </Text>
      </Billboard>

      {/* Role label */}
      <Billboard position={[0, 1.85, 0]} follow={true}>
        <Text
          fontSize={0.15}
          color="#aaaaaa"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {agent.role}
        </Text>
      </Billboard>

      {/* Status bubble */}
      <Billboard position={[0, 2.45, 0]} follow={true}>
        <Text
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {STATE_LABELS[state] || state}
        </Text>
      </Billboard>

      {/* Interaction prompt */}
      {isNearby && (
        <Billboard position={[0, 2.8, 0]} follow={true}>
          <Text
            fontSize={0.2}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            Press E to talk
          </Text>
        </Billboard>
      )}

      {/* Colored ring below agent */}
      <mesh position={[0, -0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.45, 16]} />
        <meshBasicMaterial color={agent.color} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

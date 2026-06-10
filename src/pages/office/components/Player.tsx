import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'
import { useGameStore } from '../store/useGameStore'
import { AGENTS, PLAYER_CONFIG } from '../config/agents'
import { OFFICE_BOUNDS, COLLISION_WALLS } from '../config/office'

function checkCollision(x: number, z: number, radius: number): boolean {
  for (const wall of COLLISION_WALLS) {
    if (x + radius > wall.minX && x - radius < wall.maxX &&
        z + radius > wall.minZ && z - radius < wall.maxZ) {
      return true
    }
  }
  return false
}

const SPEED = 5
const CAMERA_DISTANCE_DEFAULT = 18
const CAMERA_HEIGHT_DEFAULT = 16
const CAMERA_LAG = 0.06
const CAMERA_MIN_DIST = 8
const CAMERA_MAX_DIST = 38

export function PlayerBody({ color, pantsColor, isWalking }: { color: string; pantsColor: string; isWalking: boolean }) {
  const leftLegRef = useRef<THREE.Mesh>(null!)
  const rightLegRef = useRef<THREE.Mesh>(null!)
  const leftArmRef = useRef<THREE.Mesh>(null!)
  const rightArmRef = useRef<THREE.Mesh>(null!)
  const bodyRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (isWalking) {
      const swing = Math.sin(t * 8) * 0.5
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.03
    } else {
      const breathe = Math.sin(t * 1.5) * 0.015
      if (bodyRef.current) {
        bodyRef.current.position.y = breathe
        bodyRef.current.rotation.z = 0
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
    }
  })

  return (
    <group ref={bodyRef}>
      {/* Shadow */}
      <mesh position={[0, -0.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.58, 0.58, 0.58]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.13, 1.15, 0.3]}>
        <boxGeometry args={[0.1, 0.08, 0.01]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh position={[0.13, 1.15, 0.3]}>
        <boxGeometry args={[0.1, 0.08, 0.01]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.13, 1.16, 0.305]}>
        <boxGeometry args={[0.05, 0.04, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.13, 1.16, 0.305]}>
        <boxGeometry args={[0.05, 0.04, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Smile */}
      <mesh position={[0, 1.0, 0.3]}>
        <boxGeometry args={[0.2, 0.04, 0.01]} />
        <meshBasicMaterial color="#1a0a00" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.52, 0.62, 0.32]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Shirt detail */}
      <mesh position={[0, 0.72, 0.165]}>
        <boxGeometry args={[0.12, 0.38, 0.01]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>

      {/* Left arm */}
      <group position={[-0.37, 0.85, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.58, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>

      {/* Right arm */}
      <group position={[0.37, 0.85, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.2, 0.58, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>

      {/* Pants */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.52, 0.15, 0.32]} />
        <meshStandardMaterial color={pantsColor} roughness={0.9} />
      </mesh>

      {/* Left leg */}
      <group position={[-0.13, 0.2, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.23, 0.56, 0.26]} />
          <meshStandardMaterial color={pantsColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.52, 0.06]}>
          <boxGeometry args={[0.23, 0.1, 0.32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.13, 0.2, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.23, 0.56, 0.26]} />
          <meshStandardMaterial color={pantsColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.52, 0.06]}>
          <boxGeometry args={[0.23, 0.1, 0.32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

export default function Player() {
  const groupRef = useRef<THREE.Group>(null!)
  const cameraDistRef = useRef(CAMERA_DISTANCE_DEFAULT)
  const cameraTargetRef = useRef(new THREE.Vector3(0, CAMERA_HEIGHT_DEFAULT, CAMERA_DISTANCE_DEFAULT))
  const cameraPanOffsetRef = useRef({ x: 0, z: 0 })
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const keys = useKeyboard()
  const { camera, gl } = useThree()

  // Scroll wheel zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      cameraDistRef.current = Math.max(
        CAMERA_MIN_DIST,
        Math.min(CAMERA_MAX_DIST, cameraDistRef.current + e.deltaY * 0.05)
      )
    }
    gl.domElement.addEventListener('wheel', onWheel)
    return () => gl.domElement.removeEventListener('wheel', onWheel)
  }, [gl])

  // Mouse drag panning
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) { // right or middle click
        isDraggingRef.current = true
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        e.preventDefault()
      }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      cameraPanOffsetRef.current.x -= dx * 0.05
      cameraPanOffsetRef.current.z -= dy * 0.05
      // Clamp pan offset
      cameraPanOffsetRef.current.x = Math.max(-15, Math.min(15, cameraPanOffsetRef.current.x))
      cameraPanOffsetRef.current.z = Math.max(-15, Math.min(15, cameraPanOffsetRef.current.z))
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp = () => { isDraggingRef.current = false }
    const onContextMenu = (e: Event) => e.preventDefault()

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    gl.domElement.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      gl.domElement.removeEventListener('contextmenu', onContextMenu)
    }
  }, [gl])

  const {
    playerPosition,
    setPlayerPosition,
    setPlayerRotation,
    agentStates,
    setNearbyAgent,
    nearbyAgentId,
    openChat,
    chat,
  } = useGameStore()

  const isMovingRef = useRef(false)
  const rotationRef = useRef(0)
  const prevInteractRef = useRef(false)

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...PLAYER_CONFIG.startPosition)
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const pos = groupRef.current.position
    let dx = 0
    let dz = 0

    if (!chat.isOpen) {
      if (keys.current.forward) dz -= 1
      if (keys.current.backward) dz += 1
      if (keys.current.left) dx -= 1
      if (keys.current.right) dx += 1
    }

    const isMoving = dx !== 0 || dz !== 0
    isMovingRef.current = isMoving

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx /= len
      dz /= len

      const RADIUS = 0.35
      const tryX = Math.max(OFFICE_BOUNDS.minX + 0.5, Math.min(OFFICE_BOUNDS.maxX - 0.5, pos.x + dx * SPEED * delta))
      const tryZ = Math.max(OFFICE_BOUNDS.minZ + 0.5, Math.min(OFFICE_BOUNDS.maxZ - 0.5, pos.z + dz * SPEED * delta))
      const newX = checkCollision(tryX, pos.z, RADIUS) ? pos.x : tryX
      const newZ = checkCollision(newX, tryZ, RADIUS) ? pos.z : tryZ

      groupRef.current.position.x = newX
      groupRef.current.position.z = newZ

      // Gradually reset pan offset when moving
      cameraPanOffsetRef.current.x *= 0.95
      cameraPanOffsetRef.current.z *= 0.95

      // Smooth rotation to face direction
      const targetAngle = Math.atan2(dx, dz)
      let angleDiff = targetAngle - rotationRef.current
      // Normalize angle
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      rotationRef.current += angleDiff * 0.2
      groupRef.current.rotation.y = rotationRef.current

      setPlayerPosition([newX, 0, newZ])
      setPlayerRotation(rotationRef.current)
    }

    // Camera follow with lag + scroll zoom
    const camDist = cameraDistRef.current
    const camHeight = camDist * 0.88
    const idealCamX = pos.x + cameraPanOffsetRef.current.x
    const idealCamZ = pos.z + camDist + cameraPanOffsetRef.current.z
    cameraTargetRef.current.x += (idealCamX - cameraTargetRef.current.x) * CAMERA_LAG
    cameraTargetRef.current.z += (idealCamZ - cameraTargetRef.current.z) * CAMERA_LAG
    camera.position.set(
      cameraTargetRef.current.x,
      camHeight,
      cameraTargetRef.current.z
    )
    camera.lookAt(pos.x, 0.5, pos.z)

    // Proximity detection
    let closestAgentId: string | null = null
    let closestDist = PLAYER_CONFIG.interactionRadius

    for (const agent of AGENTS) {
      const aState = agentStates[agent.id]
      if (!aState) continue
      const ap = aState.position
      const dx2 = ap[0] - pos.x
      const dz2 = ap[2] - pos.z
      const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2)
      if (dist < closestDist) {
        closestDist = dist
        closestAgentId = agent.id
      }
    }

    if (closestAgentId !== nearbyAgentId) {
      setNearbyAgent(closestAgentId)
    }

    // Interact key (E)
    const interactNow = keys.current.interact
    if (interactNow && !prevInteractRef.current && closestAgentId && !chat.isOpen) {
      openChat(closestAgentId)
    }
    prevInteractRef.current = interactNow
  })

  return (
    <group ref={groupRef} position={PLAYER_CONFIG.startPosition}>
      <PlayerBody
        color={PLAYER_CONFIG.color}
        pantsColor={PLAYER_CONFIG.pantsColor}
        isWalking={isMovingRef.current}
      />

      {/* Name label */}
      <Billboard position={[0, 2.1, 0]} follow={true}>
        <Text
          fontSize={0.28}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          Fabrício
        </Text>
      </Billboard>

      <Billboard position={[0, 1.85, 0]} follow={true}>
        <Text
          fontSize={0.16}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          CEO & Fundador ★
        </Text>
      </Billboard>

      {/* Player ring */}
      <mesh position={[0, -0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 16]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

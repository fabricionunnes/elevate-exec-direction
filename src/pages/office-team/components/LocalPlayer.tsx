// Jogador local do escritório multiplayer — WASD + câmera isométrica.
// Mesma engine do escritório de agentes; publica posição no canal Realtime.
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from '../../office/hooks/useKeyboard'
import { PlayerBody } from '../../office/components/Player'
import { OFFICE_BOUNDS, COLLISION_WALLS } from '../../office/config/office'
import { useTeamStore } from '../store/useTeamStore'
import type { TeamRealtime } from '../lib/realtime'

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
const CAMERA_LAG = 0.06
const CAMERA_MIN_DIST = 8
const CAMERA_MAX_DIST = 38
const START_POSITION: [number, number, number] = [0, 0, 2]

function isTypingInField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

export default function LocalPlayer({ realtime }: { realtime: TeamRealtime }) {
  const groupRef = useRef<THREE.Group>(null!)
  const cameraDistRef = useRef(CAMERA_DISTANCE_DEFAULT)
  const cameraTargetRef = useRef(new THREE.Vector3(0, 16, CAMERA_DISTANCE_DEFAULT))
  const cameraPanOffsetRef = useRef({ x: 0, z: 0 })
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const keys = useKeyboard()
  const { camera, gl } = useThree()

  const me = useTeamStore((s) => s.me)
  const setPlayerPosition = useTeamStore((s) => s.setPlayerPosition)
  const setPlayerRotation = useTeamStore((s) => s.setPlayerRotation)

  const isMovingRef = useRef(false)
  const wasMovingRef = useRef(false)
  const rotationRef = useRef(0)

  // Zoom com scroll
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

  // Pan com botão direito/meio
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) {
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

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...START_POSITION)
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const pos = groupRef.current.position
    let dx = 0
    let dz = 0

    if (!isTypingInField()) {
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

      cameraPanOffsetRef.current.x *= 0.95
      cameraPanOffsetRef.current.z *= 0.95

      const targetAngle = Math.atan2(dx, dz)
      let angleDiff = targetAngle - rotationRef.current
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      rotationRef.current += angleDiff * 0.2
      groupRef.current.rotation.y = rotationRef.current

      setPlayerPosition([newX, 0, newZ])
      setPlayerRotation(rotationRef.current)
      realtime.sendPosition(newX, newZ, rotationRef.current, true)
    } else if (wasMovingRef.current) {
      // Parou de andar — avisa os outros uma última vez
      realtime.sendPosition(pos.x, pos.z, rotationRef.current, false)
    }
    wasMovingRef.current = isMoving

    // Câmera com lag + zoom
    const camDist = cameraDistRef.current
    const camHeight = camDist * 0.88
    const idealCamX = pos.x + cameraPanOffsetRef.current.x
    const idealCamZ = pos.z + camDist + cameraPanOffsetRef.current.z
    cameraTargetRef.current.x += (idealCamX - cameraTargetRef.current.x) * CAMERA_LAG
    cameraTargetRef.current.z += (idealCamZ - cameraTargetRef.current.z) * CAMERA_LAG
    camera.position.set(cameraTargetRef.current.x, camHeight, cameraTargetRef.current.z)
    camera.lookAt(pos.x, 0.5, pos.z)
  })

  if (!me) return null

  return (
    <group ref={groupRef} position={START_POSITION}>
      <PlayerBody color={me.color} pantsColor={me.pantsColor} isWalking={isMovingRef.current} />

      <Billboard position={[0, 2.1, 0]} follow={true}>
        <Text
          fontSize={0.28}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {me.name}
        </Text>
      </Billboard>

      {me.role ? (
        <Billboard position={[0, 1.85, 0]} follow={true}>
          <Text
            fontSize={0.16}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {me.role}
          </Text>
        </Billboard>
      ) : null}

      <mesh position={[0, -0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 16]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

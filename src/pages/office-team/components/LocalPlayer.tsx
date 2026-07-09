// Jogador local do escritório multiplayer — WASD + câmera isométrica.
// Colisão dinâmica gerada das salas do banco (porta trancada = parede),
// detecção da sala atual e avatar humano personalizado.
import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from '../../office/hooks/useKeyboard'
import HumanBody from './HumanBody'
import { BUILDING, buildCollisionWalls, checkWallCollision, roomAt, setRoomLock, isEffectivelyLocked, personalOwnerSeat, furnitureColliders } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'
import { useTeamStore } from '../store/useTeamStore'
import { marceloState } from './MarceloNpc'
import type { TeamRealtime } from '../lib/realtime'

const PLAYER_BLOCK_DIST = 0.6 // raio de colisão entre pessoas

/** Bloqueia o passo se APROXIMA de outra pessoa (afastar é sempre permitido). */
function blockedByPeople(curX: number, curZ: number, nx: number, nz: number): boolean {
  const players = useTeamStore.getState().remotePlayers
  for (const p of Object.values(players)) {
    const dNew = Math.hypot(p.position[0] - nx, p.position[2] - nz)
    if (dNew < PLAYER_BLOCK_DIST) {
      const dOld = Math.hypot(p.position[0] - curX, p.position[2] - curZ)
      if (dNew < dOld) return true
    }
  }
  if (marceloState.active) {
    const dNew = Math.hypot(marceloState.x - nx, marceloState.z - nz)
    if (dNew < PLAYER_BLOCK_DIST) {
      const dOld = Math.hypot(marceloState.x - curX, marceloState.z - curZ)
      if (dNew < dOld) return true
    }
  }
  return false
}

/** A cadeira/assento alvo já está ocupado por alguém sentado? */
function seatOccupied(x: number, z: number): boolean {
  const players = useTeamStore.getState().remotePlayers
  for (const p of Object.values(players)) {
    if (p.sitting && Math.hypot(p.position[0] - x, p.position[2] - z) < 0.5) return true
  }
  if (marceloState.active && marceloState.sitting && Math.hypot(marceloState.x - x, marceloState.z - z) < 0.5) {
    return true
  }
  return false
}

const SPEED = 5
const CAMERA_DISTANCE_DEFAULT = 18
const CAMERA_LAG = 0.06
const CAMERA_MIN_DIST = 8
const CAMERA_MAX_DIST = 44
const START_POSITION: [number, number, number] = [0, 0, 0.5]

function isTypingInField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
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
  const rooms = useTeamStore((s) => s.rooms)
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const myRoomId = useTeamStore((s) => s.myRoomId)
  const seated = useTeamStore((s) => s.seated)
  const setMyRoomId = useTeamStore((s) => s.setMyRoomId)
  const setPlayerPosition = useTeamStore((s) => s.setPlayerPosition)
  const setPlayerRotation = useTeamStore((s) => s.setPlayerRotation)

  const isMovingRef = useRef(false)
  const wasMovingRef = useRef(false)
  const rotationRef = useRef(0)
  const roomCheckRef = useRef(0)

  // Paredes de colisão: dependem das salas, de quem está online (locks órfãos
  // não valem) e da minha sala atual (porta trancada abre por dentro)
  const walls = useMemo(() => {
    const onlineIds = new Set(Object.keys(remotePlayers))
    if (me) onlineIds.add(me.id)
    return buildCollisionWalls(rooms, onlineIds, myRoomId, me?.id)
  }, [rooms, remotePlayers, me, myRoomId])
  const wallsRef = useRef(walls)
  wallsRef.current = walls

  // Mobília colide também (mesa, sofá, balcão) — exceto quando indo sentar
  const furniture = useMemo(() => furnitureColliders(rooms), [rooms])
  const furnitureRef = useRef(furniture)
  furnitureRef.current = furniture
  const blockedSinceRef = useRef(0)

  // Auto-walk (tecla X / "Ir pra minha sala"): waypoints a seguir
  const autoPathRef = useRef<{ points: [number, number][]; idx: number } | null>(null)

  // Tecla X → andar até a minha sala individual
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyX' || isTypingInField()) return
      const state = useTeamStore.getState()
      const myRoom = state.rooms.find(
        (r) => r.roomType === 'personal' && r.ownerUserId === state.me?.id
      )
      if (myRoom) {
        // Vai até a sala E senta na própria cadeira
        const seat = personalOwnerSeat(myRoom)
        state.setPendingWalkTo({ x: seat.x, z: seat.z, teleportFallback: true })
        state.setPendingSeat(seat)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Tecla C → andar até o Café & Lounge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyC' || isTypingInField()) return
      const state = useTeamStore.getState()
      const lounge = state.rooms.find((r) => r.roomType === 'lounge')
      if (lounge) {
        state.setPendingSeat(null)
        // Vai pra parte aberta do lounge (perto das mesinhas), não pra parede
        state.setPendingWalkTo({ x: lounge.x - 1, z: lounge.z + 1, teleportFallback: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Tecla Z → tranca/destranca a sala em que estou
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyZ' || isTypingInField()) return
      const state = useTeamStore.getState()
      const meId = state.me?.id
      if (!meId || !state.myRoomId) return
      const room = state.rooms.find((r) => r.id === state.myRoomId)
      if (!room || room.roomType === 'lounge') return
      const onlineIds = new Set([meId, ...Object.keys(state.remotePlayers)])
      const locked = isEffectivelyLocked(room, onlineIds)
      if (locked && room.lockedBy !== meId) return // trancada por outra pessoa
      void setRoomLock(room.id, !locked, meId).then(() => realtime.announceRoomsChanged())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [realtime])

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

  // Pan da câmera: arrastar com QUALQUER botão no canvas explora o escritório
  // sem mover o boneco (andar traz a câmera de volta pro jogador)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      if (e.button === 2 || e.button === 1) e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      cameraPanOffsetRef.current.x -= dx * 0.05
      cameraPanOffsetRef.current.z -= dy * 0.05
      // Alcance cobre o prédio inteiro
      cameraPanOffsetRef.current.x = Math.max(-48, Math.min(48, cameraPanOffsetRef.current.x))
      cameraPanOffsetRef.current.z = Math.max(-42, Math.min(42, cameraPanOffsetRef.current.z))
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp = () => { isDraggingRef.current = false }
    const onContextMenu = (e: Event) => e.preventDefault()

    // mousedown só no canvas (não rouba cliques dos painéis/botões da UI)
    gl.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    gl.domElement.addEventListener('contextmenu', onContextMenu)
    return () => {
      gl.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      gl.domElement.removeEventListener('contextmenu', onContextMenu)
    }
  }, [gl])

  // Spawn: última posição salva do usuário (ou centro do corredor)
  useEffect(() => {
    const spawn = useTeamStore.getState().me?.spawn
    const sx = Math.max(BUILDING.minX + 0.5, Math.min(BUILDING.maxX - 0.5, spawn?.[0] ?? START_POSITION[0]))
    const sz = Math.max(BUILDING.minZ + 0.5, Math.min(BUILDING.maxZ - 0.5, spawn?.[1] ?? START_POSITION[2]))
    if (groupRef.current) {
      groupRef.current.position.set(sx, 0, sz)
      rotationRef.current = spawn?.[2] ?? 0
      groupRef.current.rotation.y = rotationRef.current
    }
    cameraTargetRef.current.set(sx, 16, sz + CAMERA_DISTANCE_DEFAULT)
    useTeamStore.getState().setPlayerPosition([sx, 0, sz])
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const pos = groupRef.current.position

    // Teleporte pendente
    const teleport = useTeamStore.getState().pendingTeleport
    if (teleport) {
      pos.x = teleport[0]
      pos.z = teleport[1]
      useTeamStore.getState().setPendingTeleport(null)
      autoPathRef.current = null
      setPlayerPosition([pos.x, 0, pos.z])
      realtime.sendPosition(pos.x, pos.z, rotationRef.current, false)
    }

    // Novo destino de auto-walk (tecla X / "Ir pra minha sala" / duplo clique)
    const walkTo = useTeamStore.getState().pendingWalkTo
    if (walkTo) {
      useTeamStore.getState().setPendingWalkTo(null)
      const path = findPath(pos.x, pos.z, walkTo.x, walkTo.z, [...wallsRef.current, ...furnitureRef.current])
      if (path && path.length > 0) {
        autoPathRef.current = { points: path, idx: 0 }
      } else if (walkTo.teleportFallback) {
        // Sem rota (ex: caminho trancado) — teleporta como fallback
        pos.x = walkTo.x
        pos.z = walkTo.z
        autoPathRef.current = null
        setPlayerPosition([pos.x, 0, pos.z])
        realtime.sendPosition(pos.x, pos.z, rotationRef.current, false)
      }
      // Duplo clique sem rota (sala trancada etc): não se move
    }

    let dx = 0
    let dz = 0

    if (!isTypingInField()) {
      if (keys.current.forward) dz -= 1
      if (keys.current.backward) dz += 1
      if (keys.current.left) dx -= 1
      if (keys.current.right) dx += 1
    }

    // Input manual cancela o auto-walk e levanta da cadeira
    if (dx !== 0 || dz !== 0) {
      autoPathRef.current = null
      const st = useTeamStore.getState()
      if (st.seated) st.setSeated(false)
      if (st.pendingSeat) st.setPendingSeat(null)
    } else if (autoPathRef.current) {
      // Segue os waypoints do caminho calculado
      const ap = autoPathRef.current
      const [wx, wz] = ap.points[ap.idx]
      const ddx = wx - pos.x
      const ddz = wz - pos.z
      const d = Math.sqrt(ddx * ddx + ddz * ddz)
      if (d < 0.18) {
        ap.idx++
        if (ap.idx >= ap.points.length) {
          autoPathRef.current = null
          // O A* desvia de mesas, então o fim do caminho pode parar do
          // lado da cadeira — aproximação final em linha reta até o
          // assento (a mobília já não colide perto do assento)
          const seat = useTeamStore.getState().pendingSeat
          if (seat) {
            const dSeat = Math.hypot(seat.x - pos.x, seat.z - pos.z)
            if (dSeat > 0.25 && dSeat < 2.6) {
              autoPathRef.current = { points: [[seat.x, seat.z]], idx: 0 } as typeof ap
            }
          }
        }
      } else {
        dx = ddx / d
        dz = ddz / d
      }
    }

    const isMoving = dx !== 0 || dz !== 0
    isMovingRef.current = isMoving

    // Qualquer movimento (manual OU auto-walk) levanta da cadeira
    if (isMoving && useTeamStore.getState().seated) {
      useTeamStore.getState().setSeated(false)
    }

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dz * dz)
      dx /= len
      dz /= len

      const RADIUS = 0.32
      const tryX = Math.max(BUILDING.minX + 0.5, Math.min(BUILDING.maxX - 0.5, pos.x + dx * SPEED * delta))
      const tryZ = Math.max(BUILDING.minZ + 0.5, Math.min(BUILDING.maxZ - 0.5, pos.z + dz * SPEED * delta))
      // Mobília colide, exceto: (a) aproximação final do assento (encaixe)
      // e (b) quando JÁ está encostado/dentro dela — deixa escapar
      // (ex: levantando da cadeira atrás da mesa)
      const seatTarget = useTeamStore.getState().pendingSeat
      const nearSeat = !!seatTarget && Math.hypot(seatTarget.x - pos.x, seatTarget.z - pos.z) < 1.6
      const stuckInFurniture = checkWallCollision(pos.x, pos.z, RADIUS, furnitureRef.current)
      const ignoreFurniture = nearSeat || stuckInFurniture
      const solids = ignoreFurniture ? wallsRef.current : [...wallsRef.current, ...furnitureRef.current]
      let newX = checkWallCollision(tryX, pos.z, RADIUS, solids) ? pos.x : tryX
      let newZ = checkWallCollision(newX, tryZ, RADIUS, solids) ? pos.z : tryZ
      // Pessoas não se atravessam
      if (blockedByPeople(pos.x, pos.z, newX, newZ)) {
        newX = pos.x
        newZ = pos.z
      }
      // Auto-walk travado por alguém parado no caminho? Desiste após 1.5s
      if (newX === pos.x && newZ === pos.z && autoPathRef.current) {
        blockedSinceRef.current += delta
        if (blockedSinceRef.current > 1.5) {
          autoPathRef.current = null
          useTeamStore.getState().setPendingSeat(null)
          blockedSinceRef.current = 0
        }
      } else {
        blockedSinceRef.current = 0
      }

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

    // Chegou no assento pendente → senta (vira pro lado certo e avisa todos)
    if (!isMoving && !autoPathRef.current) {
      const st = useTeamStore.getState()
      const seat = st.pendingSeat
      if (seat && !st.seated) {
        const dSeat = Math.hypot(seat.x - pos.x, seat.z - pos.z)
        // Alguém sentou aqui antes de você chegar? Fica em pé do lado.
        if (dSeat < 1.2 && seatOccupied(seat.x, seat.z)) {
          st.setPendingSeat(null)
          st.addToast('Essa cadeira já está ocupada', 'out')
        } else if (dSeat < 0.9) {
          pos.x = seat.x
          pos.z = seat.z
          rotationRef.current = seat.rot
          groupRef.current.rotation.y = seat.rot
          st.setSeated(true)
          st.setPendingSeat(null)
          setPlayerPosition([seat.x, 0, seat.z])
          setPlayerRotation(seat.rot)
          realtime.sendPosition(seat.x, seat.z, seat.rot, false, true)
        }
      }
    }

    // Detecção da sala atual (a cada ~150ms)
    roomCheckRef.current += delta
    if (roomCheckRef.current > 0.15) {
      roomCheckRef.current = 0
      const state = useTeamStore.getState()
      const room = roomAt(pos.x, pos.z, state.rooms)
      const current = state.myRoomId
      if ((room?.id ?? null) !== current) {
        // Saí de uma sala que EU tranquei → destranca automaticamente
        // (tranca esquecida não fica escondendo a sala dos outros)
        const prevRoom = current ? state.rooms.find((r) => r.id === current) : null
        if (prevRoom && prevRoom.isLocked && prevRoom.lockedBy === state.me?.id) {
          void setRoomLock(prevRoom.id, false, state.me!.id).then(() => realtime.announceRoomsChanged())
        }
        setMyRoomId(room?.id ?? null)
      }
    }

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
      <HumanBody avatar={me.avatar} isWalking={isMovingRef.current} isSitting={seated} />

      <Billboard position={[0, 2.25, 0]} follow={true}>
        <Text
          fontSize={0.27}
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
        <Billboard position={[0, 2.0, 0]} follow={true}>
          <Text
            fontSize={0.155}
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

      {/* Anel de identificação do jogador local */}
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 16]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

// Estacionamento UNV (lado sul do prédio): vaga nomeada por colaborador,
// carros de luxo de quem está online e as cutscenes de chegada/saída —
// carro chega pela rua, estaciona, o boneco desce e anda até a sala;
// na saída, anda até o carro, entra e vai embora.
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import HumanBody from './HumanBody'
import { CarMesh, carForUser, MARCELO_CAR, CarSpec } from './Cars'
import { useTeamStore, Cutscene } from '../store/useTeamStore'
import { BUILDING, buildCollisionWalls, furnitureColliders } from '../lib/rooms'
import { findPath } from '../lib/pathfinding'

// Geometria do lote (ao sul do prédio; BUILDING.maxZ = 29)
const LOT_Z0 = BUILDING.maxZ + 0.6 // início do asfalto
const LOT_Z1 = BUILDING.maxZ + 13
const ROAD_Z = BUILDING.maxZ + 3.2 // rua interna
const SPOT_Z = BUILDING.maxZ + 7.6 // centro do carro estacionado
const SPOT_W = 4.4
const DOOR_X = 0 // porta de vidro do prédio
const CAR_SPAWN_X = 46
const WALK_SPEED = 3.2
const CAR_SPEED = 11

interface Spot {
  userId: string
  name: string
  x: number
  car: CarSpec
}

function useSpots(): Spot[] {
  const rooms = useTeamStore((s) => s.rooms)
  return useMemo(() => {
    const personal = rooms
      .filter((r) => r.roomType === 'personal' && r.ownerUserId)
      .sort((a, b) => a.z - b.z || a.x - b.x)
    const spots: Spot[] = personal.map((r, i) => ({
      userId: r.ownerUserId!,
      name: r.name.replace(/^Sala\s+/i, ''),
      x: -27 + i * SPOT_W,
      car: carForUser(r.ownerUserId!),
    }))
    // Vaga do Marcelo (IA) — o carro dele nunca sai
    spots.push({ userId: 'marcelo-npc', name: 'Marcelo Almeida', x: -27 + spots.length * SPOT_W, car: MARCELO_CAR })
    return spots
  }, [rooms])
}

/**
 * Ator da cutscene: anima carro + boneco.
 * arrive: carro entra pela rua → estaciona → boneco desce e anda até a
 * posição real do jogador (que está oculto até o fim).
 * leave: boneco anda da última posição até o carro → carro vai embora.
 */
function CutsceneActor({ cutscene, spot }: { cutscene: Cutscene; spot: Spot }) {
  const carRef = useRef<THREE.Group>(null!)
  const personRef = useRef<THREE.Group>(null!)
  const phaseRef = useRef<'carIn' | 'park' | 'walk' | 'toCar' | 'carOut' | 'done'>(
    cutscene.kind === 'arrive' ? 'carIn' : 'toCar'
  )
  const pathRef = useRef<{ pts: [number, number][]; i: number } | null>(null)
  const personRotRef = useRef(0)
  const [personVisible, setPersonVisible] = useState(cutscene.kind === 'leave')
  const [walking, setWalking] = useState(false)
  const startedRef = useRef(Date.now())

  // Caminho do boneco (computado uma vez por fase de caminhada)
  const buildWalkPath = (from: [number, number], to: [number, number], viaDoor: boolean): [number, number][] => {
    const st = useTeamStore.getState()
    const onlineIds = new Set(Object.keys(st.remotePlayers))
    if (st.me) onlineIds.add(st.me.id)
    const solids = [...buildCollisionWalls(st.rooms, onlineIds, null), ...furnitureColliders(st.rooms)]
    if (!viaDoor) {
      return [to]
    }
    // Trecho externo (reta) + trecho interno (A*)
    const outside: [number, number][] = []
    const doorOut: [number, number] = [DOOR_X, BUILDING.maxZ + 1.6]
    const doorIn: [number, number] = [DOOR_X, BUILDING.maxZ - 1.6]
    if (cutscene.kind === 'arrive') {
      outside.push([from[0], ROAD_Z], doorOut, doorIn)
      const inner = findPath(doorIn[0], doorIn[1], to[0], to[1], solids)
      return inner ? [...outside, ...inner] : [...outside, to]
    }
    // leave: interno até a porta, depois reta até a vaga
    const inner = findPath(from[0], from[1], doorIn[0], doorIn[1], solids)
    const base = inner ? inner : [doorIn]
    return [...base, doorOut, [to[0], ROAD_Z], to]
  }

  useFrame((_, delta) => {
    const st = useTeamStore.getState()
    // Failsafe: cutscene nunca passa de 35s
    if (Date.now() - startedRef.current > 35000) {
      st.removeCutscene(cutscene.id)
      return
    }
    const car = carRef.current
    const person = personRef.current
    if (!car || !person) return

    const movePersonAlong = (): boolean => {
      const path = pathRef.current
      if (!path) return true
      const [wx, wz] = path.pts[path.i]
      const dx = wx - person.position.x
      const dz = wz - person.position.z
      const d = Math.hypot(dx, dz)
      if (d < 0.18) {
        path.i++
        if (path.i >= path.pts.length) {
          pathRef.current = null
          return true
        }
        return false
      }
      const step = Math.min(d, WALK_SPEED * delta)
      person.position.x += (dx / d) * step
      person.position.z += (dz / d) * step
      const target = Math.atan2(dx, dz)
      let diff = target - personRotRef.current
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      personRotRef.current += diff * 0.2
      person.rotation.y = personRotRef.current
      return false
    }

    switch (phaseRef.current) {
      case 'carIn': {
        // Carro vem pela rua até a vaga
        car.position.z = ROAD_Z
        car.rotation.y = Math.PI / 2 // apontando -x
        const dx = spot.x - car.position.x
        if (Math.abs(dx) > 0.3) {
          car.position.x += Math.sign(dx) * Math.min(Math.abs(dx), CAR_SPEED * delta)
        } else {
          phaseRef.current = 'park'
        }
        break
      }
      case 'park': {
        // Entra de frente na vaga
        car.position.x = spot.x
        car.rotation.y += (0 - car.rotation.y) * Math.min(1, 6 * delta)
        const dz = SPOT_Z - car.position.z
        if (Math.abs(dz) > 0.15) {
          car.position.z += Math.sign(dz) * Math.min(Math.abs(dz), 4 * delta)
        } else {
          car.rotation.y = 0
          // Boneco desce do carro e anda até a posição real do jogador
          person.position.set(spot.x + 1.4, 0, SPOT_Z - 0.5)
          setPersonVisible(true)
          setWalking(true)
          const real = st.remotePlayers[cutscene.userId]
          const target: [number, number] = real ? [real.position[0], real.position[2]] : [DOOR_X, BUILDING.maxZ - 2]
          pathRef.current = { pts: buildWalkPath([spot.x + 1.4, SPOT_Z - 0.5], target, true), i: 0 }
          phaseRef.current = 'walk'
        }
        break
      }
      case 'walk': {
        if (movePersonAlong()) {
          st.removeCutscene(cutscene.id) // revela o jogador real
          phaseRef.current = 'done'
        }
        break
      }
      case 'toCar': {
        if (!pathRef.current && personVisible) {
          const from = cutscene.lastPos ?? [DOOR_X, BUILDING.maxZ - 2]
          person.position.set(from[0], 0, from[1])
          setWalking(true)
          pathRef.current = { pts: buildWalkPath(from, [spot.x + 1.4, SPOT_Z - 0.5], true), i: 0 }
        }
        if (pathRef.current && movePersonAlong()) {
          setPersonVisible(false) // entrou no carro
          phaseRef.current = 'carOut'
        }
        break
      }
      case 'carOut': {
        // Sai da vaga de ré e vai embora pela rua
        if (car.position.z > ROAD_Z + 0.2) {
          car.position.z -= 3.5 * delta
          car.rotation.y += (-Math.PI / 2 - car.rotation.y) * Math.min(1, 2.5 * delta) * 0.3
        } else {
          car.rotation.y += (-Math.PI / 2 - car.rotation.y) * Math.min(1, 5 * delta)
          car.position.x += CAR_SPEED * delta // vai embora pra +x
          if (car.position.x > CAR_SPAWN_X) {
            useTeamStore.getState().removeCutscene(cutscene.id)
            phaseRef.current = 'done'
          }
        }
        break
      }
      default:
        break
    }
  })

  return (
    <group>
      <group
        ref={carRef}
        position={
          cutscene.kind === 'arrive' ? [CAR_SPAWN_X, 0, ROAD_Z] : [spot.x, 0, SPOT_Z]
        }
        rotation={[0, cutscene.kind === 'arrive' ? Math.PI / 2 : 0, 0]}
      >
        <CarMesh spec={spot.car} />
      </group>
      <group ref={personRef} visible={personVisible}>
        <HumanBody avatar={cutscene.avatar} isWalking={walking} />
      </group>
    </group>
  )
}

export default function Parking() {
  const spots = useSpots()
  const remotePlayers = useTeamStore((s) => s.remotePlayers)
  const me = useTeamStore((s) => s.me)
  const cutscenes = useTeamStore((s) => s.cutscenes)

  // Carro estacionado: usuário online sem cutscene ativa (Marcelo sempre)
  const onlineIds = useMemo(() => {
    const ids = new Set(Object.keys(remotePlayers))
    if (me) ids.add(me.id)
    return ids
  }, [remotePlayers, me])
  const cutsceneUserIds = useMemo(() => new Set(cutscenes.map((c) => c.userId)), [cutscenes])

  const lotW = Math.max(spots.length * SPOT_W + 6, 30)
  const lotX0 = -29

  return (
    <group>
      {/* Asfalto */}
      <mesh position={[lotX0 + lotW / 2, -0.01, (LOT_Z0 + LOT_Z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[lotW, LOT_Z1 - LOT_Z0]} />
        <meshStandardMaterial color="#3c4045" roughness={0.95} />
      </mesh>
      {/* Faixa central da rua */}
      <mesh position={[lotX0 + lotW / 2, 0.002, ROAD_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lotW, 0.12]} />
        <meshStandardMaterial color="#d8c44a" roughness={0.9} />
      </mesh>
      {/* Calçada junto ao prédio */}
      <mesh position={[lotX0 + lotW / 2, 0.02, BUILDING.maxZ + 0.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[lotW, 1.6]} />
        <meshStandardMaterial color="#b9b3a6" roughness={0.85} />
      </mesh>

      {/* Vagas: faixas + nome + carro (se online) */}
      {spots.map((s) => {
        const parked = s.userId === 'marcelo-npc' || (onlineIds.has(s.userId) && !cutsceneUserIds.has(s.userId))
        return (
          <group key={s.userId}>
            {/* Linhas da vaga */}
            {[-SPOT_W / 2, SPOT_W / 2].map((off) => (
              <mesh key={off} position={[s.x + off, 0.003, SPOT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.12, 5.6]} />
                <meshStandardMaterial color="#e8e4da" roughness={0.9} />
              </mesh>
            ))}
            {/* Nome pintado na vaga */}
            <Text
              position={[s.x, 0.004, SPOT_Z + 3.2]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.42}
              color="#e8e4da"
              anchorX="center"
              anchorY="middle"
              maxWidth={SPOT_W - 0.6}
              textAlign="center"
            >
              {s.name.toUpperCase()}
            </Text>
            {parked && (
              <group position={[s.x, 0, SPOT_Z]}>
                <CarMesh spec={s.car} />
              </group>
            )}
          </group>
        )
      })}

      {/* Cutscenes ativas (sem vaga = descarta na hora pra não esconder o jogador) */}
      {cutscenes.map((c) => {
        const spot = spots.find((s) => s.userId === c.userId)
        if (!spot) {
          if (spots.length > 0) {
            setTimeout(() => useTeamStore.getState().removeCutscene(c.id), 0)
          }
          return null
        }
        return <CutsceneActor key={c.id} cutscene={c} spot={spot} />
      })}
    </group>
  )
}

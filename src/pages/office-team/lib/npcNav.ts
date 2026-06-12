// Navegação dos NPCs (Marcelo e agentes): obstáculos completos pro A*
// (paredes + mobília + pessoas paradas) e repulsão local de pessoas durante
// a caminhada — robô não atravessa mais mesa nem gente.
import { useTeamStore } from '../store/useTeamStore'
import { buildCollisionWalls, furnitureColliders, Wall } from './rooms'

const PERSON_R = 0.3

/** Paredes + mobília + pessoas (ignora quem está colado no ponto de partida,
 * senão o A* nasce bloqueado e o path falha). */
export function npcObstacles(fromX: number, fromZ: number): Wall[] {
  const state = useTeamStore.getState()
  const onlineIds = new Set(Object.keys(state.remotePlayers))
  if (state.me) onlineIds.add(state.me.id)
  const walls = buildCollisionWalls(state.rooms, onlineIds, null)
  const furniture = furnitureColliders(state.rooms)

  const people: Wall[] = []
  const addPerson = (px: number, pz: number) => {
    if (Math.hypot(px - fromX, pz - fromZ) < 1.2) return
    people.push({ minX: px - PERSON_R, maxX: px + PERSON_R, minZ: pz - PERSON_R, maxZ: pz + PERSON_R })
  }
  const [mx, , mz] = state.playerPosition
  addPerson(mx, mz)
  for (const p of Object.values(state.remotePlayers)) addPerson(p.position[0], p.position[2])

  return walls.concat(furniture, people)
}

/** Repulsão suave de pessoas próximas (aplicada ao passo do NPC andando). */
export function personAvoidance(x: number, z: number): [number, number] {
  const state = useTeamStore.getState()
  let ax = 0
  let az = 0
  const repel = (px: number, pz: number) => {
    const dx = x - px
    const dz = z - pz
    const d = Math.hypot(dx, dz)
    if (d > 0.85 || d < 0.001) return
    const f = (0.85 - d) * 2.2
    ax += (dx / d) * f
    az += (dz / d) * f
  }
  const [mx, , mz] = state.playerPosition
  repel(mx, mz)
  for (const p of Object.values(state.remotePlayers)) repel(p.position[0], p.position[2])
  return [ax, az]
}

// Troca de andar pelo elevador: fade pra preto (400ms), troca o conjunto de
// salas (store.floor), avisa o presence, toca o "ding" e acende de novo.
// Quem chama é o LocalPlayer, ao consumir um teleporte/auto-walk cujo
// `floor` é diferente do andar atual (painel do elevador, X/C, "ir até",
// deep-link de sala). O destino em si (x/z) continua pendente no store e é
// aplicado pelo LocalPlayer assim que o andar novo está carregado.
import { useTeamStore } from '../store/useTeamStore'
import type { TeamRealtime } from './realtime'
import { ELEVATOR_FRONT, floorLabel } from './floors'
import { playElevatorDing } from './sfx'

export const FLOOR_FADE_MS = 400

let traveling = false

export function isTraveling(): boolean {
  return traveling
}

/** Inicia a viagem. Retorna false se já está viajando ou se já é o andar. */
export function travelToFloor(floor: number, realtime: TeamRealtime): boolean {
  const st = useTeamStore.getState()
  if (traveling || floor === st.floor) return false
  traveling = true
  st.setElevatorOpen(false)
  st.setFloorChanging(true)

  window.setTimeout(() => {
    const s = useTeamStore.getState()
    s.setFloor(floor)
    s.setMyRoomId(null)
    if (s.seated) s.setSeated(false)
    // Sem destino explícito neste andar → aparece na frente do elevador
    const pt = s.pendingTeleport
    if (!pt || (pt.floor != null && pt.floor !== floor)) {
      s.setPendingTeleport({ x: ELEVATOR_FRONT.x, z: ELEVATOR_FRONT.z, floor })
    }
    void realtime.updateFloor(floor)
    playElevatorDing()
    s.addToast(`Você está no ${floorLabel(floor)}`, 'in')
    window.setTimeout(() => {
      useTeamStore.getState().setFloorChanging(false)
      traveling = false
    }, 140)
  }, FLOOR_FADE_MS)
  return true
}

/** Pede pra ir a um andar pelo elevador (aparece na frente da porta lá). */
export function requestFloor(floor: number) {
  const st = useTeamStore.getState()
  if (st.me?.isGuest) return
  if (floor === st.floor) {
    st.setElevatorOpen(false)
    return
  }
  st.setPendingSeat(null)
  st.setPendingWalkTo(null)
  st.setPendingTeleport({ x: ELEVATOR_FRONT.x, z: ELEVATOR_FRONT.z, floor })
  st.setElevatorOpen(false)
}

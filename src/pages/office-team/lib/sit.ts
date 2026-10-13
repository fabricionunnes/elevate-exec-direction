// Sentar num assento clicável (compartilhado pela mobília do ModernOffice e
// pela recepção). Movido do ModernOffice na fase 3 sem mudar o comportamento.
import { useTeamStore } from '../store/useTeamStore'
import { marceloState } from '../components/MarceloNpc'

/** Clicar numa cadeira manda o boneco andar até ela e sentar —
 * se ninguém estiver sentado nela. */
export function sitAt(x: number, z: number, rot: number) {
  const st = useTeamStore.getState()
  const occupied =
    Object.values(st.remotePlayers).some(
      (p) => p.sitting && Math.hypot(p.position[0] - x, p.position[2] - z) < 0.5
    ) ||
    (marceloState.active && marceloState.sitting && Math.hypot(marceloState.x - x, marceloState.z - z) < 0.5)
  if (occupied) {
    st.addToast('Essa cadeira já está ocupada', 'out')
    return
  }
  st.setPendingWalkTo({ x, z })
  st.setPendingSeat({ x, z, rot })
}

/** Converte um ponto local de um móvel rotacionado pra coordenada de mundo. */
export function localToWorld(x: number, z: number, rotation: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  return [x + lx * c + lz * s, z - lx * s + lz * c]
}

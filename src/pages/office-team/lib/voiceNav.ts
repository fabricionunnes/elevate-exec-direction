// Navegação por voz no UNV Office: "vai na sala do Ricardo", "reunião principal",
// "café", "auditório", "comercial" → acha a sala (qualquer andar) e manda o avatar
// andar até lá (troca de andar pelo elevador se precisar).
import { supabase } from '@/integrations/supabase/client'
import { useTeamStore } from '../store/useTeamStore'
import type { OfficeRoom } from './rooms'
import { RECEPTION_DESK } from './floors'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(a|o|na|no|da|do|de|pra|para|sala|ir|vai|até|ate|em)\b/g, ' ').replace(/\s+/g, ' ').trim()

let directory: { user_id: string; name: string }[] | null = null
async function loadDirectory() {
  if (directory) return directory
  const { data } = await supabase.from('office_team_directory' as never).select('user_id, name')
  directory = (data as unknown as { user_id: string; name: string }[]) || []
  return directory
}

export interface Destino { x: number; z: number; floor: number; label: string; room?: OfficeRoom }

/** Resolve o que o dono falou pra um ponto do escritório. null = não achou. */
export async function resolverDestino(fala: string): Promise<Destino | null> {
  const st = useTeamStore.getState()
  const rooms = st.rooms
  const q = norm(fala)
  if (!q) return null

  // recepção / entrada
  if (/recep|entrada|hall|terreo|elevador/.test(q)) return { x: RECEPTION_DESK.x, z: RECEPTION_DESK.z + 2, floor: 0, label: 'Recepção' }

  const centro = (r: OfficeRoom): Destino => ({ x: r.x, z: r.z, floor: r.floor ?? 0, label: r.name, room: r })

  // 1) nome da sala (parcial)
  const porNome = rooms.filter((r) => norm(r.name).includes(q) || q.includes(norm(r.name)))
  if (porNome.length) return centro(porNome.sort((a, b) => a.name.length - b.name.length)[0])

  // 2) tipo: café/lounge, auditório, reunião
  if (/cafe|lounge|conviv/.test(q)) { const r = rooms.find((r) => r.roomType === 'lounge'); if (r) return centro(r) }
  if (/auditor|palco|palestra/.test(q)) { const r = rooms.find((r) => r.roomType === 'auditorium'); if (r) return centro(r) }
  if (/reuniao|meeting/.test(q)) { const r = rooms.find((r) => r.roomType === 'meeting' && /principal/i.test(r.name)) || rooms.find((r) => r.roomType === 'meeting'); if (r) return centro(r) }

  // 3) setor
  const setores: [RegExp, string][] = [[/comercial|venda/, 'comercial'], [/market|trafego/, 'marketing'], [/financ|caixa/, 'financeiro'], [/produto|entrega|cs\b/, 'produto'], [/lideran|diretoria|ceo/, 'lideranca']]
  for (const [re, sector] of setores) if (re.test(q)) { const r = rooms.find((r) => r.roomType === 'sector' && r.sector === sector); if (r) return centro(r) }

  // 4) sala de alguém (pelo nome da pessoa)
  const dir = await loadDirectory()
  const pessoa = dir.find((p) => { const n = norm(p.name); return n.split(' ').some((parte) => parte.length > 2 && q.includes(parte)) })
  if (pessoa) {
    const r = rooms.find((r) => r.roomType === 'personal' && r.ownerUserId === pessoa.user_id)
    if (r) return { ...centro(r), label: `sala de ${pessoa.name.split(' ')[0]}` }
  }
  // 5) nome de pessoa dentro do nome da sala ("Sala Fabrício")
  const porPessoaNoNome = rooms.find((r) => r.roomType === 'personal' && q.split(' ').some((w) => w.length > 2 && norm(r.name).includes(w)))
  if (porPessoaNoNome) return centro(porPessoaNoNome)
  return null
}

/** Manda o avatar até o destino (elevador + caminhada). */
export function irPara(d: Destino) {
  const st = useTeamStore.getState()
  st.setPendingSeat?.(null)
  st.setPendingWalkTo({ x: d.x, z: d.z, floor: d.floor, teleportFallback: true })
  st.addToast(`🚶 Indo pra ${d.label}`, 'in')
}

// Salas de reunião com cliente (fase 2 do prédio, 13/10/2026).
// Reserva = convite de visitante (office_guest_invites) com room_id de uma
// sala 'client' e scheduled_at no dia de hoje. A TV da sala mostra um resumo
// do painel público do cliente (RPC project_dashboard_dados_public) enquanto
// houver reserva do dia com project_id; a placa da porta mostra a reserva.
//
// TODO (fase 3): integrar com o Google Calendar (lib/agenda.ts já lê a view
// office_agenda_today). Nesta fase SÓ o convite reserva a sala.
import { supabase } from '@/integrations/supabase/client'
import type { ClientReservation } from '../store/useTeamStore'
import { alertas, calcMes, type Bruto } from '@/components/painel-cliente/modelo'

/** Início/fim do dia de hoje em Brasília, em ISO (o banco guarda timestamptz). */
function todayRangeBRT(): { start: string; end: string } {
  const now = new Date()
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const y = brt.getFullYear()
  const m = String(brt.getMonth() + 1).padStart(2, '0')
  const d = String(brt.getDate()).padStart(2, '0')
  return { start: `${y}-${m}-${d}T00:00:00-03:00`, end: `${y}-${m}-${d}T23:59:59-03:00` }
}

/**
 * Reservas de hoje das salas de cliente (staff: lê office_guest_invites com a
 * policy de SELECT do staff + o token do painel em project_custom_dashboards).
 * Visitante não chama isso: o convite dele já traz a própria reserva.
 */
export async function fetchClientReservationsToday(): Promise<ClientReservation[]> {
  const { start, end } = todayRangeBRT()
  const { data, error } = await supabase
    .from('office_guest_invites' as never)
    .select('room_id, guest_company, scheduled_at, project_id, lead_id')
    .not('room_id', 'is', null)
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)
    .order('scheduled_at', { ascending: true })
  if (error || !data) return []
  const rows = data as unknown as Array<{
    room_id: string
    guest_company: string | null
    scheduled_at: string
    project_id: string | null
    lead_id: string | null
  }>
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter((x): x is string => !!x))]
  const tokens = new Map<string, string>()
  if (projectIds.length) {
    const { data: dash } = await supabase
      .from('project_custom_dashboards' as never)
      .select('project_id, public_token')
      .in('project_id', projectIds)
    for (const d of (dash ?? []) as unknown as Array<{ project_id: string; public_token: string | null }>) {
      if (d.public_token) tokens.set(d.project_id, d.public_token)
    }
  }
  return rows.map((r) => ({
    roomId: r.room_id,
    company: r.guest_company ?? 'Cliente',
    scheduledAt: r.scheduled_at,
    projectId: r.project_id,
    dashboardToken: r.project_id ? tokens.get(r.project_id) ?? null : null,
    leadId: r.lead_id,
  }))
}

/** Reserva "vigente" da sala: a de hoje mais próxima do horário atual
 * (a que está acontecendo ou a próxima; se todas já passaram, a última). */
export function currentReservation(roomId: string, list: ClientReservation[]): ClientReservation | null {
  const mine = list.filter((r) => r.roomId === roomId)
  if (mine.length === 0) return null
  const now = Date.now()
  const live = mine.find((r) => {
    const t = new Date(r.scheduledAt).getTime()
    return now >= t - 15 * 60_000 && now <= t + 90 * 60_000
  })
  if (live) return live
  const next = mine.find((r) => new Date(r.scheduledAt).getTime() > now)
  return next ?? mine[mine.length - 1]
}

/** "14h" / "14h30" */
export function hourLabel(iso: string): string {
  const d = new Date(iso)
  const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(/\D/g, '')
  const mm = d.toLocaleTimeString('pt-BR', { minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(/\D/g, '')
  return mm === '00' || mm === '0' ? `${hh}h` : `${hh}h${mm.padStart(2, '0')}`
}

/** Resumo do painel do cliente pra TV da sala (desenhado em canvas). */
export interface ClientPanelSummary {
  title: string
  mesLabel: string
  vendas: number
  receita: number | null
  ticket: number | null
  agendadas: number
  realizadas: number
  presenca: number | null
  conv: number | null
  /** itens que pedem decisão do dono (alertas do painel) */
  pendencias: string[]
  metaTotal: number | null
  updatedAt: string | null
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Lê o painel público pelo token e condensa o mês mais recente. */
export async function fetchClientPanelSummary(token: string): Promise<ClientPanelSummary | null> {
  const { data, error } = await supabase.rpc('project_dashboard_dados_public' as never, { p_token: token } as never)
  if (error || !data) return null
  const r = (Array.isArray(data) ? data[0] : data) as { title?: string; dados?: Bruto; updated_at?: string } | null
  const b = r?.dados
  if (!b || !b.meses?.length) return null
  const m = b.meses[b.meses.length - 1]
  const c = calcMes(b, m)
  const al = alertas(b, m)
  return {
    title: r?.title ?? 'Painel do cliente',
    mesLabel: `${MESES_CURTO[(m.n - 1 + 12) % 12]}/${String(b.ano).slice(2)}`,
    vendas: c.vendas,
    receita: c.receita,
    ticket: c.ticket,
    agendadas: c.agendadas,
    realizadas: c.realizadas,
    presenca: c.presenca,
    conv: c.conv,
    pendencias: al.slice(0, 3).map((a) => a.titulo),
    metaTotal: c.meta?.total ?? null,
    updatedAt: r?.updated_at ?? null,
  }
}

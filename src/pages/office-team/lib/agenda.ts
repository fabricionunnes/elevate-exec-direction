// Agenda do time — fonte: views no banco (security definer).
// office_in_meeting_now → quem está em reunião AGORA (status no HUD).
// office_agenda_today → reuniões de hoje (placa da sala + cutucada na hora).
import { supabase } from '@/integrations/supabase/client'

export interface AgendaItem {
  id: string
  meeting_title: string | null
  meeting_date: string
  calendar_owner_name: string | null
  owner_user_id: string | null
}

/** user_ids com reunião acontecendo agora (janela de 60min). */
export async function fetchInMeetingNow(): Promise<string[]> {
  const { data } = await supabase.from('office_in_meeting_now' as never).select('user_id')
  if (!data) return []
  return (data as unknown as Array<{ user_id: string }>).map((r) => r.user_id)
}

/** Reuniões de hoje (BRT), em ordem de horário. */
export async function fetchAgendaToday(): Promise<AgendaItem[]> {
  const { data } = await supabase.from('office_agenda_today' as never).select('*')
  if (!data) return []
  return data as unknown as AgendaItem[]
}

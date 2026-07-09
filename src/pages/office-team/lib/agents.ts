// Agentes IA da UNV no escritório — config dos NPCs + permissões de acesso.
// O master (Fabrício) escolhe quem pode falar com cada agente
// (office_agent_permissions); o agente-unv valida o mesmo no servidor.
import { supabase } from '@/integrations/supabase/client'

export interface OfficeAgent {
  /** key enviada ao agente-unv (?agent=) e gravada em office_agent_permissions */
  key: string
  name: string
  title: string
  /** setor da sala onde o robô fica */
  sector: 'comercial' | 'financeiro' | 'produto' | 'marketing' | 'lideranca'
  /** cor do tronco do robô */
  body: string
  /** cor das luzes */
  accent: string
  /** deslocamento dentro da sala (a partir do canto noroeste interno) */
  slot: number
  intro: string
}

export const OFFICE_AGENTS: OfficeAgent[] = [
  { key: 'ceo', name: 'MAX', title: 'CEO · IA', sector: 'lideranca', body: '#0D2B5E', accent: '#FFD700', slot: 0, intro: 'Fala com o MAX — visão geral do negócio, reuniões de alinhamento e direcionamento dos agentes.' },
  { key: 'gerente', name: 'Cris', title: 'Gerente · IA', sector: 'lideranca', body: '#37474F', accent: '#80cbc4', slot: 1, intro: 'Fala com a Cris — gestão do dia a dia, cobranças e acompanhamento do time.' },
  { key: 'crm', name: 'Sophia', title: 'Comercial · IA', sector: 'comercial', body: '#1B6B3A', accent: '#7CFC9A', slot: 0, intro: 'Fala com a Sophia — leads, pipeline, follow-ups e atividades do CRM.' },
  { key: 'financeiro', name: 'Noah', title: 'Financeiro · IA', sector: 'financeiro', body: '#4E342E', accent: '#FFB74D', slot: 0, intro: 'Fala com o Noah — contas, fluxo de caixa, cobranças e indicadores financeiros.' },
  { key: 'projetos', name: 'Melissa', title: 'Projetos · IA', sector: 'produto', body: '#4A148C', accent: '#CE93D8', slot: 0, intro: 'Fala com a Melissa — projetos, tarefas, entregas e onboarding de clientes.' },
  { key: 'marketing', name: 'Luna', title: 'Marketing · IA', sector: 'marketing', body: '#880E4F', accent: '#F48FB1', slot: 0, intro: 'Fala com a Luna — tráfego pago, campanhas e métricas de marketing.' },
  { key: 'social', name: 'Mika', title: 'Social Media · IA', sector: 'marketing', body: '#0277BD', accent: '#81D4FA', slot: 1, intro: 'Fala com a Mika — conteúdo, calendário editorial e redes sociais.' },
]

export function agentByKey(key: string | null): OfficeAgent | null {
  return OFFICE_AGENTS.find((a) => a.key === key) ?? null
}

/** user_ids com permissão pra falar com o agente. */
export async function fetchAgentPermissions(agentKey: string): Promise<string[]> {
  const { data } = await supabase
    .from('office_agent_permissions' as never)
    .select('user_id')
    .eq('agent', agentKey)
  if (!data) return []
  return (data as unknown as Array<{ user_id: string }>).map((r) => r.user_id)
}

/** keys dos agentes que EU posso usar (pro não-master saber o que está liberado). */
export async function fetchMyAgentKeys(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('office_agent_permissions' as never)
    .select('agent')
    .eq('user_id', userId)
  if (!data) return []
  return (data as unknown as Array<{ agent: string }>).map((r) => r.agent)
}

export async function grantAgentPermission(agentKey: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('office_agent_permissions' as never)
    .insert({ agent: agentKey, user_id: userId } as never)
  return !error
}

export async function revokeAgentPermission(agentKey: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('office_agent_permissions' as never)
    .delete()
    .eq('agent', agentKey)
    .eq('user_id', userId)
  return !error
}

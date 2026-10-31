// Agentes IA da UNV no escritório — config dos NPCs + permissões de acesso.
// O master (Fabrício) escolhe quem pode falar com cada agente
// (office_agent_permissions); o chat (ai-team-chat) valida o acesso à empresa.
// Elenco = Time de IA (ai_team_agents da UNV): cada NPC tem a chave do agente
// real (teamKey), que liga rodadas, fila de aprovação e conversa.
import { supabase } from '@/integrations/supabase/client'

export type TeamKey =
  | 'orquestrador' | 'atendimento' | 'briefing' | 'anuncios'
  | 'conteudo' | 'reativacao' | 'trafego' | 'qualificacao'

export interface OfficeAgent {
  /** key de permissão (office_agent_permissions) e id do NPC */
  key: string
  /** agente do Time de IA (ai_team_agents.agent_key) */
  teamKey: TeamKey
  name: string
  title: string
  /** setor da sala onde o robô fica */
  sector: 'comercial' | 'financeiro' | 'produto' | 'marketing' | 'lideranca'
  /** cor do tronco do robô */
  body: string
  /** cor das luzes */
  accent: string
  /** posição dentro da sala (0 = canto noroeste, 1 = canto nordeste, 2+ = meio) */
  slot: number
  intro: string
}

export const OFFICE_AGENTS: OfficeAgent[] = [
  { key: 'ceo', teamKey: 'orquestrador', name: 'MAX', title: 'Coordenador · IA', sector: 'lideranca', body: '#0D2B5E', accent: '#FFD700', slot: 0, intro: 'Fala com o MAX — ele lê o Nexus inteiro (caixa, CRM, carteira, tráfego), coordena o time e executa ordens: roda agentes, aprova itens, sobe anúncio na Meta.' },
  { key: 'crm', teamKey: 'briefing', name: 'Sophia', title: 'Head comercial · IA', sector: 'comercial', body: '#1A4A8A', accent: '#7CB8FF', slot: 0, intro: 'Fala com a Sophia — briefing do dia: financeiro, leads, reuniões, fechamentos, carteira e onde apertar hoje.' },
  { key: 'atendimento', teamKey: 'atendimento', name: 'Lia', title: 'Atendimento · IA', sector: 'comercial', body: '#CC1B1B', accent: '#FF8A8A', slot: 1, intro: 'Fala com a Lia — atendimento 24h no Direct e no WhatsApp, qualificação e agendamento.' },
  { key: 'reativacao', teamKey: 'reativacao', name: 'Theo', title: 'Reativação · IA', sector: 'comercial', body: '#0F766E', accent: '#5EEAD4', slot: 2, intro: 'Fala com o Theo — leads parados e clientes que saíram: mensagens com nome, prontas pra disparar.' },
  { key: 'qualificacao', teamKey: 'qualificacao', name: 'Júlia', title: 'Qualificação · IA', sector: 'comercial', body: '#9D174D', accent: '#F9A8D4', slot: 3, intro: 'Fala com a Júlia — leads das últimas 24h: quem está sem dono, sem contato e quem ligar primeiro.' },
  { key: 'marketing', teamKey: 'trafego', name: 'Luna', title: 'Head de marketing · IA', sector: 'marketing', body: '#6D28D9', accent: '#C4B5FD', slot: 0, intro: 'Fala com a Luna — campanhas da Meta: o que merece verba, o que está queimando dinheiro, CPL por campanha.' },
  { key: 'social', teamKey: 'conteudo', name: 'Mika', title: 'Conteúdo · IA', sector: 'marketing', body: '#0277BD', accent: '#81D4FA', slot: 1, intro: 'Fala com a Mika — posts e calendário editorial a partir do que o comercial está vivendo.' },
  { key: 'anuncios', teamKey: 'anuncios', name: 'Rafa', title: 'Anúncios · IA', sector: 'marketing', body: '#B45309', accent: '#FCD34D', slot: 2, intro: 'Fala com o Rafa — anúncios prontos (copy, CTA, público) apoiados nas campanhas que já trazem lead barato.' },
]

export function agentByKey(key: string | null): OfficeAgent | null {
  return OFFICE_AGENTS.find((a) => a.key === key) ?? null
}
export function agentByTeamKey(teamKey: string | null): OfficeAgent | null {
  return OFFICE_AGENTS.find((a) => a.teamKey === teamKey) ?? null
}

/** Empresa da própria UNV no Nexus (dona do Time de IA): id fixo; a leitura por
 * CNPJ dependia de RLS e falhava pro master. Cai na busca só se o id sumir. */
export const UNV_COMPANY_ID = '4d3e83ba-4521-4a3d-839f-21dd53dc8554'
const UNV_CNPJ = '51356237000140'
let unvCompanyId: string | null | undefined
export async function fetchUnvCompanyId(): Promise<string | null> {
  if (unvCompanyId !== undefined) return unvCompanyId
  const { data: fixo } = await supabase.from('onboarding_companies').select('id').eq('id', UNV_COMPANY_ID).maybeSingle()
  if (fixo?.id) { unvCompanyId = fixo.id as string; return unvCompanyId }
  const { data } = await supabase.from('onboarding_companies').select('id').eq('cnpj', UNV_CNPJ).maybeSingle()
  unvCompanyId = (data?.id as string | undefined) ?? UNV_COMPANY_ID
  return unvCompanyId
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

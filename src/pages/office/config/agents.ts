export type AgentState = 'IDLE' | 'WALKING' | 'COFFEE' | 'MEETING' | 'WORKING'

// Chave do agente no Time de IA (ai_team_agents.agent_key): liga o personagem 3D
// ao agente que roda de verdade (rodadas, fila de aprovação, chat ai-team-chat).
export type TeamKey =
  | 'orquestrador' | 'atendimento' | 'briefing' | 'anuncios'
  | 'conteudo' | 'reativacao' | 'trafego' | 'qualificacao'

export interface AgentConfig {
  id: string
  name: string
  role: string
  color: string
  pantsColor: string
  room: string
  apiType: string          // persona no backend antigo (agente-unv) e histórico legado
  teamKey: TeamKey         // agente do Time de IA
  homePosition: [number, number, number]
  meetingPosition: [number, number, number]
  coffeePosition: [number, number, number]
  waypoints: [number, number, number][]
  deskRotation: number
}

// Elenco = Time de IA. Max, Sophia, Luna e Mika mantêm as mesas antigas;
// Rafa, Theo e Júlia ocupam as mesas que eram de Noah, Melissa e Cris; Lia
// (atendimento) senta na sala do CRM, ao lado da Sophia.
export const AGENTS: AgentConfig[] = [
  {
    id: 'max',
    name: 'MAX',
    role: 'Coordenador',
    color: '#0D2B5E',
    pantsColor: '#0e1a36',
    room: 'CEO Office',
    apiType: 'ceo',
    teamKey: 'orquestrador',
    homePosition: [-14, 0, -8],
    meetingPosition: [-4.8, 0, 5.2],
    coffeePosition: [-12, 0, 11],
    waypoints: [
      [-16, 0, -10],
      [-12, 0, -6],
      [-14, 0, -5],
      [-16, 0, -8],
    ],
    deskRotation: 0,
  },
  {
    id: 'rafa',
    name: 'Rafa',
    role: 'Anúncios',
    color: '#B45309',
    pantsColor: '#6b3200',
    room: 'Finance Room',
    apiType: 'financeiro',
    teamKey: 'anuncios',
    homePosition: [4, 0, -8],
    meetingPosition: [-3.6, 0, 5.2],
    coffeePosition: [-11, 0, 11.8],
    waypoints: [
      [2, 0, -10],
      [6, 0, -6],
      [4, 0, -5],
      [2, 0, -8],
    ],
    deskRotation: Math.PI,
  },
  {
    id: 'sophia',
    name: 'Sophia',
    role: 'Head comercial',
    color: '#1A4A8A',
    pantsColor: '#0e2d57',
    room: 'CRM Room',
    apiType: 'crm',
    teamKey: 'briefing',
    homePosition: [-14, 0, 0],
    meetingPosition: [-2.4, 0, 5.2],
    coffeePosition: [-10, 0, 12],
    waypoints: [
      [-16, 0, -2],
      [-12, 0, 2],
      [-14, 0, 3],
      [-16, 0, 0],
    ],
    deskRotation: Math.PI / 2,
  },
  {
    id: 'lia',
    name: 'Lia',
    role: 'Atendimento',
    color: '#CC1B1B',
    pantsColor: '#7a1010',
    room: 'CRM Room',
    apiType: 'crm',
    teamKey: 'atendimento',
    homePosition: [-11, 0, -2],
    meetingPosition: [-4.8, 0, 7.8],
    coffeePosition: [-10.5, 0, 14],
    waypoints: [
      [-12, 0, -1],
      [-11, 0, 1],
      [-13, 0, 1],
      [-11, 0, -2],
    ],
    deskRotation: Math.PI / 2,
  },
  {
    id: 'theo',
    name: 'Theo',
    role: 'Reativação',
    color: '#0F766E',
    pantsColor: '#07403c',
    room: 'Projects Room',
    apiType: 'projetos',
    teamKey: 'reativacao',
    homePosition: [4, 0, 0],
    meetingPosition: [-1.2, 0, 5.2],
    coffeePosition: [-12, 0, 13],
    waypoints: [
      [2, 0, -2],
      [6, 0, 2],
      [4, 0, 3],
      [2, 0, 0],
    ],
    deskRotation: Math.PI,
  },
  {
    id: 'julia',
    name: 'Júlia',
    role: 'Qualificação',
    color: '#DB2777',
    pantsColor: '#7a1445',
    room: 'Projects Room',
    apiType: 'gerente',
    teamKey: 'qualificacao',
    homePosition: [10, 0, 0],
    meetingPosition: [-3.6, 0, 7.8],
    coffeePosition: [-13, 0, 14],
    waypoints: [
      [8, 0, -2],
      [12, 0, 2],
      [10, 0, 3],
      [8, 0, 0],
    ],
    deskRotation: Math.PI,
  },
  {
    id: 'luna',
    name: 'Luna',
    role: 'Head de marketing',
    color: '#9333EA',
    pantsColor: '#4c1d95',
    room: 'Marketing Room',
    apiType: 'marketing',
    teamKey: 'trafego',
    homePosition: [-6, 0, 10],
    meetingPosition: [-2.4, 0, 7.8],
    coffeePosition: [-11.5, 0, 14.5],
    waypoints: [
      [-5, 0, 10.5],
      [-4, 0, 12],
      [-6, 0, 13.5],
      [-2, 0, 11],
    ],
    deskRotation: -Math.PI / 2,
  },
  {
    id: 'mika',
    name: 'Mika',
    role: 'Conteúdo e social',
    color: '#7C3AED',
    pantsColor: '#3d1a5c',
    room: 'Creative Room',
    apiType: 'social',
    teamKey: 'conteudo',
    homePosition: [6, 0, 10],
    meetingPosition: [-1.2, 0, 7.8],
    coffeePosition: [-13, 0, 14],
    waypoints: [
      [4, 0, 10.5],
      [8, 0, 12],
      [6, 0, 13.5],
      [4, 0, 12],
    ],
    deskRotation: -Math.PI / 2,
  },
]

// Falas de reunião gravadas com os ids antigos continuam achando um personagem
export const LEGACY_AGENT_IDS: Record<string, string> = { noah: 'rafa', melissa: 'theo', cris: 'julia' }
export const agentIdFromLegacy = (id: string) => LEGACY_AGENT_IDS[id] || id
export const agentByTeamKey = (key: string) => AGENTS.find((a) => a.teamKey === key)

export const PLAYER_CONFIG = {
  id: 'fabricio',
  name: 'Fabrício',
  color: '#8B4513',
  pantsColor: '#5c2d0d',
  startPosition: [0, 0, 0] as [number, number, number],
  speed: 5,
  interactionRadius: 2.5,
}

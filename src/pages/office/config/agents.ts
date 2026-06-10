export type AgentState = 'IDLE' | 'WALKING' | 'COFFEE' | 'MEETING' | 'WORKING'

export interface AgentConfig {
  id: string
  name: string
  role: string
  color: string
  pantsColor: string
  room: string
  apiType: string
  homePosition: [number, number, number]
  meetingPosition: [number, number, number]
  coffeePosition: [number, number, number]
  waypoints: [number, number, number][]
  deskRotation: number
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'max',
    name: 'MAX',
    role: 'CEO',
    color: '#1B2951',
    pantsColor: '#0e1a36',
    room: 'CEO Office',
    apiType: 'ceo',
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
    id: 'noah',
    name: 'Noah',
    role: 'Financeiro',
    color: '#1B6B3A',
    pantsColor: '#0f3d21',
    room: 'Finance Room',
    apiType: 'financeiro',
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
    role: 'CRM',
    color: '#1A4A8A',
    pantsColor: '#0e2d57',
    room: 'CRM Room',
    apiType: 'crm',
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
    id: 'melissa',
    name: 'Melissa',
    role: 'Projetos',
    color: '#6B2FA0',
    pantsColor: '#3d1a5c',
    room: 'Projects Room',
    apiType: 'projetos',
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
    id: 'cris',
    name: 'Cris',
    role: 'Gerente',
    color: '#006B6B',
    pantsColor: '#003d3d',
    room: 'Projects Room',
    apiType: 'gerente',
    homePosition: [10, 0, 0],
    meetingPosition: [-4.8, 0, 7.8],
    coffeePosition: [-10.5, 0, 14],
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
    role: 'Marketing',
    color: '#B85C00',
    pantsColor: '#6b3500',
    room: 'Marketing Room',
    apiType: 'marketing',
    homePosition: [-6, 0, 10],
    meetingPosition: [-3.6, 0, 7.8],
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
    role: 'Social Media',
    color: '#C2185B',
    pantsColor: '#7a0f39',
    room: 'Creative Room',
    apiType: 'social',
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

export const PLAYER_CONFIG = {
  id: 'fabricio',
  name: 'Fabrício',
  color: '#8B4513',
  pantsColor: '#5c2d0d',
  startPosition: [0, 0, 0] as [number, number, number],
  speed: 5,
  interactionRadius: 2.5,
}

import { create } from 'zustand'
import { AgentState } from '../config/agents'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AgentRuntimeState {
  id: string
  state: AgentState
  position: [number, number, number]
  targetPosition: [number, number, number] | null
  waypointIndex: number
  stateTimer: number
  nextStateChange: number
}

interface ChatState {
  isOpen: boolean
  activeAgentId: string | null
  messages: Record<string, Message[]>
  isLoading: boolean
}

interface GameState {
  playerPosition: [number, number, number]
  playerRotation: number
  agentStates: Record<string, AgentRuntimeState>
  nearbyAgentId: string | null
  chat: ChatState
  meetingTriggered: boolean
  meetingStartTime: number | null

  // Actions
  setPlayerPosition: (pos: [number, number, number]) => void
  setPlayerRotation: (rot: number) => void
  setAgentState: (id: string, state: Partial<AgentRuntimeState>) => void
  setNearbyAgent: (id: string | null) => void
  openChat: (agentId: string) => void
  closeChat: () => void
  addMessage: (agentId: string, message: Message) => void
  setLoading: (loading: boolean) => void
  triggerMeeting: () => void
  endMeeting: () => void
  initAgentStates: (states: AgentRuntimeState[]) => void
}

export const useGameStore = create<GameState>((set) => ({
  playerPosition: [0, 0, 0],
  playerRotation: 0,
  agentStates: {},
  nearbyAgentId: null,
  meetingTriggered: false,
  meetingStartTime: null,
  chat: {
    isOpen: false,
    activeAgentId: null,
    messages: {},
    isLoading: false,
  },

  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  setPlayerRotation: (rot) => set({ playerRotation: rot }),

  setAgentState: (id, state) =>
    set((prev) => ({
      agentStates: {
        ...prev.agentStates,
        [id]: { ...prev.agentStates[id], ...state },
      },
    })),

  setNearbyAgent: (id) => set({ nearbyAgentId: id }),

  openChat: (agentId) =>
    set((prev) => ({
      chat: {
        ...prev.chat,
        isOpen: true,
        activeAgentId: agentId,
        messages: prev.chat.messages[agentId]
          ? prev.chat.messages
          : { ...prev.chat.messages, [agentId]: [] },
      },
    })),

  closeChat: () =>
    set((prev) => ({
      chat: { ...prev.chat, isOpen: false, activeAgentId: null },
    })),

  addMessage: (agentId, message) =>
    set((prev) => ({
      chat: {
        ...prev.chat,
        messages: {
          ...prev.chat.messages,
          [agentId]: [...(prev.chat.messages[agentId] || []), message],
        },
      },
    })),

  setLoading: (loading) =>
    set((prev) => ({ chat: { ...prev.chat, isLoading: loading } })),

  triggerMeeting: () =>
    set({ meetingTriggered: true, meetingStartTime: Date.now() }),

  endMeeting: () =>
    set({ meetingTriggered: false, meetingStartTime: null }),

  initAgentStates: (states) =>
    set({
      agentStates: states.reduce((acc, s) => ({ ...acc, [s.id]: s }), {}),
    }),
}))

// Exposto no dev para debug/automação (não entra no build de produção)
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  ;(window as unknown as Record<string, unknown>).gameStore = useGameStore
}

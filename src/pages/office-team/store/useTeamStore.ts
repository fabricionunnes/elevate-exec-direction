// Escritório UNV multiplayer — estado global (zustand).
// Jogador local + jogadores remotos (via Supabase Realtime) + chat + chamada
// + salas dinâmicas (banco) + avatar personalizado.
import { create } from 'zustand'
import type { OfficeRoom } from '../lib/rooms'

export interface AvatarConfig {
  skin: string
  hairStyle: 'short' | 'long' | 'bun' | 'bald'
  hairColor: string
  shirt: string
  pants: string
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#e0ac69',
  hairStyle: 'short',
  hairColor: '#2d2017',
  shirt: '#1A4A8A',
  pants: '#2b3445',
}

export interface TeamProfile {
  id: string // user_id do Supabase Auth
  name: string
  role: string
  color: string
  pantsColor: string
  avatar: AvatarConfig
  /** última posição salva [x, z, rot] — spawn ao reabrir o escritório */
  spawn?: [number, number, number]
  /** false para terceirizados/não-staff: não ganha sala individual */
  canHavePersonalRoom?: boolean
}

export interface RemotePlayerState extends TeamProfile {
  position: [number, number, number]
  rotation: number
  moving: boolean
  sitting: boolean
  inCall: boolean
  micOn: boolean
  camOn: boolean
  /** compartilhando a tela (pra projetar no telão da sala) */
  screenOn: boolean
  /** modo foco: não recebe cutucada (auto-responde) */
  focused: boolean
}

/** Assento alvo: clicar numa cadeira anda até lá e senta */
export interface Seat {
  x: number
  z: number
  /** rotação do jogador sentado (pra onde olha) */
  rot: number
}

/** Cutscene do estacionamento: alguém chegando de carro ou indo embora. */
export interface Cutscene {
  id: string
  kind: 'arrive' | 'leave'
  userId: string
  name: string
  avatar: AvatarConfig
  /** última posição conhecida (pra saída: de onde o boneco sai andando) */
  lastPos?: [number, number]
  ts: number
}

/** Recado deixado na mesa de alguém (texto ou áudio). */
export interface DeskNote {
  id: string
  from_user: string
  from_name: string | null
  kind: 'text' | 'audio'
  content: string | null
  audio_path: string | null
  created_at: string
}

export interface TeamMessage {
  id: string
  userId: string
  name: string
  color: string
  content: string
  timestamp: number
}

interface CallState {
  joined: boolean
  micOn: boolean
  camOn: boolean
  /** compartilhando a tela (substitui o vídeo da câmera) */
  screenOn: boolean
  /** stream local (mic/cam) — para preview e para os peers */
  localStream: MediaStream | null
  /** streams remotos por user_id */
  remoteStreams: Record<string, MediaStream>
}

interface TeamState {
  me: TeamProfile | null
  playerPosition: [number, number, number]
  playerRotation: number
  remotePlayers: Record<string, RemotePlayerState>

  rooms: OfficeRoom[]
  /** sala em que o jogador local está (null = corredor/área aberta) */
  myRoomId: string | null
  avatarEditorOpen: boolean
  /** teleporte pendente (consumido pelo LocalPlayer no próximo frame) */
  pendingTeleport: [number, number] | null
  /** destino de auto-walk (anda sozinho até lá; WASD cancela).
   * teleportFallback: se não houver rota, teleporta (usado pelo "minha sala") */
  pendingWalkTo: { x: number; z: number; teleportFallback?: boolean } | null
  /** assento pendente: ao chegar no destino, senta */
  pendingSeat: Seat | null
  /** jogador local está sentado */
  seated: boolean

  chatOpen: boolean
  chatMessages: TeamMessage[]
  unreadCount: number

  /** chat com o NPC Marcelo Almeida (agente IA na sala dele) */
  npcChatOpen: boolean

  /** campainha recebida (alguém me chamando/cutucando) */
  incomingRing: { fromId: string; fromName: string; x: number; z: number; ts: number } | null
  /** notificações pequenas (entrou/saiu do escritório) */
  toasts: { id: string; text: string; kind: 'in' | 'out' }[]
  /** gravação de reunião em andamento (visível pra todos) */
  recording: { on: boolean; byId: string | null; byName: string | null }

  /** recados na mesa */
  composeNoteFor: { userId: string; name: string } | null
  unreadNotes: DeskNote[]
  notesPanelOpen: boolean

  /** cutscenes do estacionamento (chegada/saída de carro) */
  cutscenes: Cutscene[]
  /** voz automática falhou (permissão negada) — mostra fallback manual */
  voiceBlocked: boolean

  /** modo foco local (F): silencia cutucadas com auto-resposta */
  focused: boolean
  /** venda ganha no CRM (sino + confete pra todo o escritório) */
  saleEvent: { lead: string; value: number; by: string; ts: number } | null
  /** user_ids com reunião agendada acontecendo agora (status "Em reunião") */
  inMeetingIds: string[]
  /** agente IA com painel de chat aberto (key: ceo, financeiro, crm...) */
  agentChatFor: string | null

  call: CallState

  // Actions
  setMe: (me: TeamProfile) => void
  setAvatar: (avatar: AvatarConfig) => void
  setPlayerPosition: (pos: [number, number, number]) => void
  setPlayerRotation: (rot: number) => void
  upsertRemotePlayer: (player: Partial<RemotePlayerState> & { id: string }) => void
  setRemotePlayerPos: (id: string, pos: [number, number, number], rot: number, moving: boolean, sitting: boolean) => void
  removeRemotePlayer: (id: string) => void
  setRemotePlayers: (players: Record<string, RemotePlayerState>) => void

  setRooms: (rooms: OfficeRoom[]) => void
  setMyRoomId: (id: string | null) => void
  setAvatarEditorOpen: (open: boolean) => void
  setPendingTeleport: (target: [number, number] | null) => void
  setPendingWalkTo: (target: { x: number; z: number; teleportFallback?: boolean } | null) => void
  setPendingSeat: (seat: Seat | null) => void
  setSeated: (seated: boolean) => void

  toggleChat: () => void
  addChatMessage: (msg: TeamMessage) => void
  setChatHistory: (msgs: TeamMessage[]) => void
  setNpcChatOpen: (open: boolean) => void
  setIncomingRing: (ring: { fromId: string; fromName: string; x: number; z: number; ts: number } | null) => void
  addToast: (text: string, kind: 'in' | 'out') => void
  removeToast: (id: string) => void
  setRecording: (rec: { on: boolean; byId: string | null; byName: string | null }) => void
  setComposeNoteFor: (target: { userId: string; name: string } | null) => void
  setUnreadNotes: (notes: DeskNote[]) => void
  setNotesPanelOpen: (open: boolean) => void
  addCutscene: (c: Cutscene) => void
  removeCutscene: (id: string) => void
  setVoiceBlocked: (blocked: boolean) => void
  setFocused: (on: boolean) => void
  setSaleEvent: (s: { lead: string; value: number; by: string; ts: number } | null) => void
  setInMeetingIds: (ids: string[]) => void
  setAgentChatFor: (key: string | null) => void

  setCall: (patch: Partial<CallState>) => void
  setRemoteStream: (id: string, stream: MediaStream | null) => void
}

export const useTeamStore = create<TeamState>((set) => ({
  me: null,
  playerPosition: [0, 0, 0],
  playerRotation: 0,
  remotePlayers: {},

  rooms: [],
  myRoomId: null,
  avatarEditorOpen: false,
  pendingTeleport: null,
  pendingWalkTo: null,
  pendingSeat: null,
  seated: false,

  chatOpen: false,
  chatMessages: [],
  unreadCount: 0,
  npcChatOpen: false,
  incomingRing: null,
  toasts: [],
  recording: { on: false, byId: null, byName: null },
  composeNoteFor: null,
  unreadNotes: [],
  notesPanelOpen: false,
  cutscenes: [],
  voiceBlocked: false,
  focused: false,
  saleEvent: null,
  inMeetingIds: [],
  agentChatFor: null,

  call: {
    joined: false,
    micOn: false,
    camOn: false,
    screenOn: false,
    localStream: null,
    remoteStreams: {},
  },

  setMe: (me) => set({ me }),
  setAvatar: (avatar) =>
    set((prev) => (prev.me ? { me: { ...prev.me, avatar } } : prev)),
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  setPlayerRotation: (rot) => set({ playerRotation: rot }),

  upsertRemotePlayer: (player) =>
    set((prev) => {
      const existing = prev.remotePlayers[player.id]
      return {
        remotePlayers: {
          ...prev.remotePlayers,
          [player.id]: {
            name: 'Usuário',
            role: '',
            color: '#1A4A8A',
            pantsColor: '#0e2d57',
            avatar: DEFAULT_AVATAR,
            position: [0, 0, 1] as [number, number, number],
            rotation: 0,
            moving: false,
            sitting: false,
            inCall: false,
            micOn: false,
            camOn: false,
            screenOn: false,
            focused: false,
            ...existing,
            ...player,
          },
        },
      }
    }),

  setRemotePlayerPos: (id, pos, rot, moving, sitting) =>
    set((prev) => {
      const existing = prev.remotePlayers[id]
      if (!existing) return prev
      return {
        remotePlayers: {
          ...prev.remotePlayers,
          [id]: { ...existing, position: pos, rotation: rot, moving, sitting },
        },
      }
    }),

  removeRemotePlayer: (id) =>
    set((prev) => {
      const next = { ...prev.remotePlayers }
      delete next[id]
      return { remotePlayers: next }
    }),

  setRemotePlayers: (players) => set({ remotePlayers: players }),

  setRooms: (rooms) => set({ rooms }),
  setMyRoomId: (id) => set({ myRoomId: id }),
  setAvatarEditorOpen: (open) => set({ avatarEditorOpen: open }),
  setPendingTeleport: (target) => set({ pendingTeleport: target }),
  setPendingWalkTo: (target) => set({ pendingWalkTo: target }),
  setPendingSeat: (seat) => set({ pendingSeat: seat }),
  setSeated: (seated) => set({ seated }),

  toggleChat: () =>
    set((prev) => ({
      chatOpen: !prev.chatOpen,
      unreadCount: prev.chatOpen ? prev.unreadCount : 0,
    })),

  addChatMessage: (msg) =>
    set((prev) => ({
      chatMessages: [...prev.chatMessages.slice(-199), msg],
      unreadCount: prev.chatOpen ? 0 : prev.unreadCount + 1,
    })),

  setChatHistory: (msgs) => set({ chatMessages: msgs }),
  setNpcChatOpen: (open) => set({ npcChatOpen: open }),
  setIncomingRing: (ring) => set({ incomingRing: ring }),
  addToast: (text, kind) =>
    set((prev) => ({
      toasts: [...prev.toasts.slice(-3), { id: crypto.randomUUID(), text, kind }],
    })),
  removeToast: (id) =>
    set((prev) => ({ toasts: prev.toasts.filter((t) => t.id !== id) })),
  setRecording: (rec) => set({ recording: rec }),
  setComposeNoteFor: (target) => set({ composeNoteFor: target }),
  setUnreadNotes: (notes) => set({ unreadNotes: notes }),
  setNotesPanelOpen: (open) => set({ notesPanelOpen: open }),
  addCutscene: (c) =>
    set((prev) => ({
      // máx 4 simultâneas; substitui cutscene anterior do mesmo usuário
      cutscenes: [...prev.cutscenes.filter((x) => x.userId !== c.userId).slice(-3), c],
    })),
  removeCutscene: (id) =>
    set((prev) => ({ cutscenes: prev.cutscenes.filter((c) => c.id !== id) })),
  setVoiceBlocked: (blocked) => set({ voiceBlocked: blocked }),
  setFocused: (on) => set({ focused: on }),
  setSaleEvent: (s) => set({ saleEvent: s }),
  setInMeetingIds: (ids) => set({ inMeetingIds: ids }),
  setAgentChatFor: (key) => set({ agentChatFor: key }),

  setCall: (patch) => set((prev) => ({ call: { ...prev.call, ...patch } })),

  setRemoteStream: (id, stream) =>
    set((prev) => {
      const next = { ...prev.call.remoteStreams }
      if (stream) next[id] = stream
      else delete next[id]
      return { call: { ...prev.call, remoteStreams: next } }
    }),
}))

// Paleta para colorir avatares dos usuários de forma estável (hash do user_id)
const AVATAR_PALETTE: { color: string; pantsColor: string }[] = [
  { color: '#1B2951', pantsColor: '#0e1a36' },
  { color: '#1B6B3A', pantsColor: '#0f3d21' },
  { color: '#1A4A8A', pantsColor: '#0e2d57' },
  { color: '#6B2FA0', pantsColor: '#3d1a5c' },
  { color: '#006B6B', pantsColor: '#003d3d' },
  { color: '#B85C00', pantsColor: '#6b3500' },
  { color: '#C2185B', pantsColor: '#7a0f39' },
  { color: '#8B4513', pantsColor: '#5c2d0d' },
  { color: '#455A64', pantsColor: '#263238' },
  { color: '#7B1FA2', pantsColor: '#4a0072' },
]

export function avatarColorsFor(userId: string) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

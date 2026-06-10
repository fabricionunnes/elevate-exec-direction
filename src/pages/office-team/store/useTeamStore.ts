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
}

export interface RemotePlayerState extends TeamProfile {
  position: [number, number, number]
  rotation: number
  moving: boolean
  inCall: boolean
  micOn: boolean
  camOn: boolean
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

  chatOpen: boolean
  chatMessages: TeamMessage[]
  unreadCount: number

  call: CallState

  // Actions
  setMe: (me: TeamProfile) => void
  setAvatar: (avatar: AvatarConfig) => void
  setPlayerPosition: (pos: [number, number, number]) => void
  setPlayerRotation: (rot: number) => void
  upsertRemotePlayer: (player: Partial<RemotePlayerState> & { id: string }) => void
  setRemotePlayerPos: (id: string, pos: [number, number, number], rot: number, moving: boolean) => void
  removeRemotePlayer: (id: string) => void
  setRemotePlayers: (players: Record<string, RemotePlayerState>) => void

  setRooms: (rooms: OfficeRoom[]) => void
  setMyRoomId: (id: string | null) => void
  setAvatarEditorOpen: (open: boolean) => void
  setPendingTeleport: (target: [number, number] | null) => void
  setPendingWalkTo: (target: { x: number; z: number; teleportFallback?: boolean } | null) => void

  toggleChat: () => void
  addChatMessage: (msg: TeamMessage) => void
  setChatHistory: (msgs: TeamMessage[]) => void

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

  chatOpen: false,
  chatMessages: [],
  unreadCount: 0,

  call: {
    joined: false,
    micOn: false,
    camOn: false,
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
            inCall: false,
            micOn: false,
            camOn: false,
            ...existing,
            ...player,
          },
        },
      }
    }),

  setRemotePlayerPos: (id, pos, rot, moving) =>
    set((prev) => {
      const existing = prev.remotePlayers[id]
      if (!existing) return prev
      return {
        remotePlayers: {
          ...prev.remotePlayers,
          [id]: { ...existing, position: pos, rotation: rot, moving },
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

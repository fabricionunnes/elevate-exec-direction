// Escritório UNV multiplayer — estado global (zustand).
// Jogador local + jogadores remotos (via Supabase Realtime) + chat + chamada
// + salas dinâmicas (banco) + avatar personalizado.
import { create } from 'zustand'
import type { OfficeRoom } from '../lib/rooms'

export interface AvatarConfig {
  skin: string
  hairStyle: 'short' | 'long' | 'bun' | 'bald' | 'buzz' | 'curly' | 'ponytail'
  hairColor: string
  shirt: string
  pants: string
  /** barba/bigode (opcional — payloads antigos não têm) */
  facialHair?: 'none' | 'stubble' | 'beard' | 'mustache'
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#e0ac69',
  hairStyle: 'short',
  hairColor: '#2d2017',
  shirt: '#1A4A8A',
  pants: '#2b3445',
  facialHair: 'none',
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
  /** visitante convidado (login anônimo): UI reduzida, sem dados de negócio */
  isGuest?: boolean
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
  /** mão levantada na call (pediu pra falar) */
  handRaised?: boolean
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
  /** mão levantada (pedi pra falar) */
  handRaised: boolean
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
  /** gravações de reunião em andamento POR SALA (roomKey -> quem grava).
   * Salas diferentes gravam simultaneamente; o aviso só vale pra sala. */
  recordings: Record<string, { byId: string; byName: string }>
  /** pedido do master pra parar a gravação de UMA sala (broadcast) */
  recStop: { nonce: number; room: string }

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
  /** deep-link de sala de reunião pediu pra abrir o modo reunião ao chegar */
  meetingViewRequested: boolean
  /** tour de boas-vindas: destino atual do MAX + fala do balão */
  tour: { x: number; z: number; text: string } | null
  /** aceno: agente chamado até alguém (sincronizado por broadcast pra todos) */
  agentSummon: {
    agentKey: string
    x: number
    z: number
    /** assento livre (banqueta do café OU cadeira de visita da sala) */
    seat: { x: number; z: number; rot?: number; tableX: number; tableZ: number; tableKey: string } | null
    byId: string
    byName: string
    /** chamador tem permissão de falar com o agente (libera dados na prosa) */
    allowed: boolean
    /** 'cafe' = papo informal no lounge · 'office' = negócios na sala privada */
    context: 'cafe' | 'office'
    ts: number
  } | null
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
  setRoomRecording: (roomKey: string, rec: { byId: string; byName: string } | null) => void
  clearRecordingsBy: (userId: string) => void
  bumpRecStop: (room: string) => void
  setComposeNoteFor: (target: { userId: string; name: string } | null) => void
  setUnreadNotes: (notes: DeskNote[]) => void
  setNotesPanelOpen: (open: boolean) => void
  addCutscene: (c: Cutscene) => void
  removeCutscene: (id: string) => void
  setVoiceBlocked: (blocked: boolean) => void
  setFocused: (on: boolean) => void
  setMeetingViewRequested: (on: boolean) => void
  setTour: (t: { x: number; z: number; text: string } | null) => void
  setAgentSummon: (s: TeamState['agentSummon']) => void
  setSaleEvent: (s: { lead: string; value: number; by: string; ts: number } | null) => void
  setInMeetingIds: (ids: string[]) => void
  setAgentChatFor: (key: string | null) => void

  setCall: (patch: Partial<CallState>) => void
  setRemoteStream: (id: string, stream: MediaStream | null) => void
}

// ── Throttle de movimento ────────────────────────────────────────────────
// Posições chegam ~9x/s POR jogador (broadcast) e a local muda a cada frame.
// Os bonecos leem posição dentro do useFrame (sem re-render); o restante da
// UI só precisa de uma visão "fresca o bastante" — notificamos em lote.
let motionNotifyTimer: ReturnType<typeof setTimeout> | null = null
let lastLocalPosSetAt = 0

export const useTeamStore = create<TeamState>((set, get) => ({
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
  recordings: {},
  recStop: { nonce: 0, room: '' },
  composeNoteFor: null,
  unreadNotes: [],
  notesPanelOpen: false,
  cutscenes: [],
  voiceBlocked: false,
  focused: false,
  meetingViewRequested: false,
  tour: null,
  agentSummon: null,
  saleEvent: null,
  inMeetingIds: [],
  agentChatFor: null,

  call: {
    joined: false,
    micOn: false,
    camOn: false,
    screenOn: false,
    handRaised: false,
    localStream: null,
    remoteStreams: {},
  },

  setMe: (me) => set({ me }),
  setAvatar: (avatar) =>
    set((prev) => (prev.me ? { me: { ...prev.me, avatar } } : prev)),
  setPlayerPosition: (pos) => {
    // Chamado do useFrame (até 60x/s andando). Throttle: quem deriva UI da
    // posição local (sala, volumes, café) não precisa de mais que ~7x/s.
    const now = Date.now()
    const prev = get().playerPosition
    const moved = Math.hypot(pos[0] - prev[0], pos[2] - prev[2])
    if (now - lastLocalPosSetAt < 140 && moved < 0.5) return
    lastLocalPosSetAt = now
    set({ playerPosition: pos })
  },
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

  setRemotePlayerPos: (id, pos, rot, moving, sitting) => {
    // Caminho QUENTE (broadcast 'pos', ~9x/s por jogador andando): muta o
    // objeto do jogador in place — o RemotePlayer lê position/rotation dentro
    // do useFrame, então o movimento fica fluido SEM re-render de React.
    // A UI derivada (listas, salas, café) é notificada em lote (500ms).
    const existing = get().remotePlayers[id]
    if (!existing) return
    const satChanged = existing.sitting !== sitting
    existing.position = pos
    existing.rotation = rot
    existing.moving = moving
    existing.sitting = sitting
    if (satChanged) {
      // sentar/levantar é raro e muda UI (balões do café) → notifica na hora
      set((p) => ({ remotePlayers: { ...p.remotePlayers } }))
    } else if (!motionNotifyTimer) {
      motionNotifyTimer = setTimeout(() => {
        motionNotifyTimer = null
        set((p) => ({ remotePlayers: { ...p.remotePlayers } }))
      }, 500)
    }
  },

  removeRemotePlayer: (id) =>
    set((prev) => {
      const next = { ...prev.remotePlayers }
      delete next[id]
      return { remotePlayers: next }
    }),

  setRemotePlayers: (players) => {
    // Presence sync roda a cada re-track (keepalive de cada usuário ~20s).
    // Reutiliza a referência do jogador quando nada relevante mudou — e se
    // NADA mudou, nem notifica (evita re-render geral em sync sem novidade).
    const current = get().remotePlayers
    const next: Record<string, RemotePlayerState> = {}
    let changed = false
    for (const [id, p] of Object.entries(players)) {
      const ex = current[id]
      if (
        ex &&
        ex.name === p.name &&
        ex.role === p.role &&
        ex.color === p.color &&
        ex.pantsColor === p.pantsColor &&
        ex.inCall === p.inCall &&
        ex.micOn === p.micOn &&
        ex.camOn === p.camOn &&
        ex.screenOn === p.screenOn &&
        ex.focused === p.focused &&
        ex.handRaised === p.handRaised &&
        ex.sitting === p.sitting &&
        JSON.stringify(ex.avatar) === JSON.stringify(p.avatar)
      ) {
        next[id] = ex // mantém a ref (posição segue fluindo por mutação)
      } else {
        next[id] = p
        changed = true
      }
    }
    if (Object.keys(current).length !== Object.keys(next).length) changed = true
    if (changed) set({ remotePlayers: next })
  },

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
  setRoomRecording: (roomKey, rec) =>
    set((prev) => {
      const next = { ...prev.recordings }
      if (rec) next[roomKey] = rec
      else delete next[roomKey]
      return { recordings: next }
    }),
  clearRecordingsBy: (userId) =>
    set((prev) => {
      const entries = Object.entries(prev.recordings).filter(([, r]) => r.byId !== userId)
      if (entries.length === Object.keys(prev.recordings).length) return prev
      return { recordings: Object.fromEntries(entries) }
    }),
  bumpRecStop: (room) => set((prev) => ({ recStop: { nonce: prev.recStop.nonce + 1, room } })),
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
  setMeetingViewRequested: (on) => set({ meetingViewRequested: on }),
  setTour: (t) => set({ tour: t }),
  setAgentSummon: (s) => set({ agentSummon: s }),
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

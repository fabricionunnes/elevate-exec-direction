// Canal Supabase Realtime do escritório multiplayer.
// Presence = quem está online (perfil + avatar + estado de chamada).
// Broadcast 'pos' = posição dos jogadores (throttled).
// Broadcast 'chat' = mensagens de texto.
// Broadcast 'rtc' = signaling WebRTC (offer/answer/ice), endereçado por "to".
// Broadcast 'rooms' = alguém criou/trancou sala → todos refazem o fetch.
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  useTeamStore,
  TeamProfile,
  TeamMessage,
  RemotePlayerState,
  AvatarConfig,
  DEFAULT_AVATAR,
} from '../store/useTeamStore'
import { fetchRooms } from './rooms'

const POS_INTERVAL_MS = 110

export interface RtcSignal {
  from: string
  to: string
  type: 'offer' | 'answer' | 'ice'
  sdp?: string
  candidate?: RTCIceCandidateInit
}

interface PresencePayload {
  name: string
  role: string
  color: string
  pantsColor: string
  avatar: AvatarConfig
  inCall: boolean
  micOn: boolean
  camOn: boolean
  // Última posição parada — quem entra depois sincroniza por aqui
  // (o broadcast 'pos' é efêmero e só flui enquanto o jogador anda)
  x: number
  z: number
  rot: number
  sit: boolean
}

export class TeamRealtime {
  private channel: RealtimeChannel | null = null
  private me: TeamProfile
  private lastPosSent = 0
  private lastPosPayload = ''
  private presenceState: PresencePayload
  private onRtcSignal: ((signal: RtcSignal) => void) | null = null
  /** Keepalive num Web Worker: timers de worker NÃO sofrem throttling em aba
   * background, então o presence continua vivo mesmo com a aba inativa. */
  private keepaliveWorker: Worker | null = null

  constructor(me: TeamProfile) {
    this.me = me
    this.presenceState = {
      name: me.name,
      role: me.role,
      color: me.color,
      pantsColor: me.pantsColor,
      avatar: me.avatar,
      inCall: false,
      micOn: false,
      camOn: false,
      x: me.spawn?.[0] ?? 0,
      z: me.spawn?.[1] ?? 0.5,
      rot: me.spawn?.[2] ?? 0,
      sit: false,
    }
  }

  setRtcHandler(handler: (signal: RtcSignal) => void) {
    this.onRtcSignal = handler
  }

  connect() {
    this.channel = supabase.channel('office-team', {
      config: {
        presence: { key: this.me.id },
        broadcast: { self: false },
      },
    })

    this.channel
      .on('presence', { event: 'sync' }, () => {
        if (!this.channel) return
        const state = this.channel.presenceState<PresencePayload>()
        const current = useTeamStore.getState().remotePlayers
        const next: Record<string, RemotePlayerState> = {}
        for (const [key, metas] of Object.entries(state)) {
          if (key === this.me.id) continue
          const meta = metas[metas.length - 1]
          if (!meta) continue
          const existing = current[key]
          next[key] = {
            id: key,
            name: meta.name,
            role: meta.role,
            color: meta.color,
            pantsColor: meta.pantsColor,
            avatar: meta.avatar ?? DEFAULT_AVATAR,
            inCall: meta.inCall,
            micOn: meta.micOn,
            camOn: meta.camOn,
            // Jogador novo pra mim: usa a posição do presence; se eu já
            // acompanho ele, mantém a posição dos broadcasts (mais fresca)
            position: existing?.position ?? [meta.x ?? 0, 0, meta.z ?? 0.5],
            rotation: existing?.rotation ?? meta.rot ?? 0,
            moving: existing?.moving ?? false,
            sitting: existing?.sitting ?? meta.sit ?? false,
          }
        }
        useTeamStore.getState().setRemotePlayers(next)
      })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        const p = payload as { id: string; x: number; z: number; rot: number; moving: boolean; sit?: boolean }
        if (!p || p.id === this.me.id) return
        useTeamStore.getState().setRemotePlayerPos(p.id, [p.x, 0, p.z], p.rot, p.moving, p.sit ?? false)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const m = payload as TeamMessage
        if (!m || m.userId === this.me.id) return
        useTeamStore.getState().addChatMessage(m)
      })
      .on('broadcast', { event: 'rooms' }, () => {
        void this.refreshRooms()
      })
      .on('broadcast', { event: 'rtc' }, ({ payload }) => {
        const signal = payload as RtcSignal
        if (!signal || signal.to !== this.me.id) return
        this.onRtcSignal?.(signal)
      })
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        const r = payload as { to: string; fromName: string }
        if (!r || r.to !== this.me.id) return
        useTeamStore.getState().setIncomingRing({ fromName: r.fromName, ts: Date.now() })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track(this.presenceState)
        }
      })

    // Keepalive imune ao throttling de aba em background
    try {
      const blob = new Blob(["setInterval(function(){postMessage('tick')}, 20000)"], {
        type: 'application/javascript',
      })
      this.keepaliveWorker = new Worker(URL.createObjectURL(blob))
      this.keepaliveWorker.onmessage = () => {
        void this.channel?.track(this.presenceState)
      }
    } catch {
      // sem worker (ambiente restrito): segue com o heartbeat padrão
    }

    void this.loadChatHistory()
    void this.refreshRooms()
  }

  /** Toca a campainha de outro usuário online. */
  sendRing(toUserId: string) {
    void this.channel?.send({
      type: 'broadcast',
      event: 'ring',
      payload: { to: toUserId, fromName: this.me.name },
    })
  }

  async refreshRooms() {
    const rooms = await fetchRooms()
    useTeamStore.getState().setRooms(rooms)
  }

  /** Avisa os outros clientes que o conjunto de salas mudou (criação/lock). */
  announceRoomsChanged() {
    void this.channel?.send({ type: 'broadcast', event: 'rooms', payload: { by: this.me.id } })
    void this.refreshRooms()
  }

  private async loadChatHistory() {
    const { data } = await supabase
      .from('office_team_messages' as never)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      const msgs: TeamMessage[] = (data as unknown as Array<{
        id: string
        user_id: string
        name: string
        color: string
        content: string
        created_at: string
      }>)
        .reverse()
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          color: row.color,
          content: row.content,
          timestamp: new Date(row.created_at).getTime(),
        }))
      useTeamStore.getState().setChatHistory(msgs)
    }
  }

  /** Publica posição do jogador local (throttled, só quando muda). */
  sendPosition(x: number, z: number, rot: number, moving: boolean, sitting = false) {
    if (!this.channel) return
    const now = performance.now()
    const payload = `${x.toFixed(2)}|${z.toFixed(2)}|${rot.toFixed(2)}|${moving}|${sitting}`
    if (payload === this.lastPosPayload) return
    if (now - this.lastPosSent < POS_INTERVAL_MS && moving) return
    this.lastPosSent = now
    this.lastPosPayload = payload
    void this.channel.send({
      type: 'broadcast',
      event: 'pos',
      payload: {
        id: this.me.id,
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
        rot: Number(rot.toFixed(2)),
        moving,
        sit: sitting,
      },
    })
    // Parou de andar → grava a posição no presence (pra quem entrar depois)
    // e agenda a persistência no banco (spawn da próxima sessão)
    if (!moving) {
      this.presenceState = {
        ...this.presenceState,
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
        rot: Number(rot.toFixed(2)),
        sit: sitting,
      }
      void this.channel.track(this.presenceState)
      this.schedulePositionSave()
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null

  private schedulePositionSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.savePositionNow(), 1500)
  }

  private async savePositionNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await supabase.from('office_team_avatars' as never).upsert(
      {
        user_id: this.me.id,
        last_x: this.presenceState.x,
        last_z: this.presenceState.z,
        last_rot: this.presenceState.rot,
      } as never,
      { onConflict: 'user_id' } as never
    )
  }

  async sendChat(content: string) {
    if (!this.channel) return
    const msg: TeamMessage = {
      id: crypto.randomUUID(),
      userId: this.me.id,
      name: this.me.name,
      color: this.me.color,
      content,
      timestamp: Date.now(),
    }
    useTeamStore.getState().addChatMessage(msg)
    void this.channel.send({ type: 'broadcast', event: 'chat', payload: msg })
    // Persistência para histórico (best-effort)
    void supabase.from('office_team_messages' as never).insert({
      id: msg.id,
      user_id: msg.userId,
      name: msg.name,
      color: msg.color,
      content: msg.content,
    } as never)
  }

  sendRtcSignal(signal: Omit<RtcSignal, 'from'>) {
    if (!this.channel) return
    void this.channel.send({
      type: 'broadcast',
      event: 'rtc',
      payload: { ...signal, from: this.me.id } satisfies RtcSignal,
    })
  }

  /** Atualiza estado de chamada no presence (todos veem). */
  async updateCallState(patch: Partial<Pick<PresencePayload, 'inCall' | 'micOn' | 'camOn'>>) {
    this.presenceState = { ...this.presenceState, ...patch }
    await this.channel?.track(this.presenceState)
  }

  /** Atualiza o avatar no presence (após salvar personalização). */
  async updateAvatar(avatar: AvatarConfig) {
    this.presenceState = { ...this.presenceState, avatar }
    await this.channel?.track(this.presenceState)
  }

  disconnect() {
    if (this.keepaliveWorker) {
      this.keepaliveWorker.terminate()
      this.keepaliveWorker = null
    }
    // Salva a posição final antes de sair
    void this.savePositionNow()
    if (this.channel) {
      void supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}

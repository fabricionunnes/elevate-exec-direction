// Canal Supabase Realtime do escritório multiplayer.
// Presence = quem está online (com perfil e estado de chamada).
// Broadcast 'pos' = posição dos jogadores (throttled).
// Broadcast 'chat' = mensagens de texto.
// Broadcast 'rtc' = signaling WebRTC (offer/answer/ice), endereçado por "to".
import { supabase } from '@/integrations/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useTeamStore, TeamProfile, TeamMessage, RemotePlayerState } from '../store/useTeamStore'

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
  inCall: boolean
  micOn: boolean
  camOn: boolean
}

export class TeamRealtime {
  private channel: RealtimeChannel | null = null
  private me: TeamProfile
  private lastPosSent = 0
  private lastPosPayload = ''
  private presenceState: PresencePayload
  private onRtcSignal: ((signal: RtcSignal) => void) | null = null

  constructor(me: TeamProfile) {
    this.me = me
    this.presenceState = {
      name: me.name,
      role: me.role,
      color: me.color,
      pantsColor: me.pantsColor,
      inCall: false,
      micOn: false,
      camOn: false,
    }
  }

  setRtcHandler(handler: (signal: RtcSignal) => void) {
    this.onRtcSignal = handler
  }

  connect() {
    const store = useTeamStore.getState()

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
            inCall: meta.inCall,
            micOn: meta.micOn,
            camOn: meta.camOn,
            position: existing?.position ?? [0, 0, 4],
            rotation: existing?.rotation ?? 0,
            moving: existing?.moving ?? false,
          }
        }
        useTeamStore.getState().setRemotePlayers(next)
      })
      .on('broadcast', { event: 'pos' }, ({ payload }) => {
        const p = payload as { id: string; x: number; z: number; rot: number; moving: boolean }
        if (!p || p.id === this.me.id) return
        useTeamStore.getState().setRemotePlayerPos(p.id, [p.x, 0, p.z], p.rot, p.moving)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const m = payload as TeamMessage
        if (!m || m.userId === this.me.id) return
        useTeamStore.getState().addChatMessage(m)
      })
      .on('broadcast', { event: 'rtc' }, ({ payload }) => {
        const signal = payload as RtcSignal
        if (!signal || signal.to !== this.me.id) return
        this.onRtcSignal?.(signal)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track(this.presenceState)
        }
      })

    // Histórico de chat
    void this.loadChatHistory()
    void store
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
  sendPosition(x: number, z: number, rot: number, moving: boolean) {
    if (!this.channel) return
    const now = performance.now()
    const payload = `${x.toFixed(2)}|${z.toFixed(2)}|${rot.toFixed(2)}|${moving}`
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
      },
    })
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

  disconnect() {
    if (this.channel) {
      void supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}

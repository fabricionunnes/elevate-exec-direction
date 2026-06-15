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
import { fetchUnreadNotes } from './notes'

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
  /** compartilhando tela (projeta no telão 3D da sala) */
  screen: boolean
  /** modo foco (não recebe cutucada) */
  focus: boolean
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
  /** primeira sync já aconteceu (evita toasts de entrada no mount) */
  private hadFirstSync = false
  /** Saídas em quarentena: um soluço de rede derruba o presence por 1-3s e
   * o usuário volta — sem isso, cada flap vira "fulano foi embora" + cutscene
   * de chegada (que esconde o boneco). Só confirma a saída após 12s fora. */
  private pendingLeaves = new Map<string, { player: RemotePlayerState; timer: ReturnType<typeof setTimeout> }>()

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
      screen: false,
      focus: false,
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
    // Reconexão limpa (auto-heal): derruba canal/worker anteriores
    if (this.channel) {
      void supabase.removeChannel(this.channel)
      this.channel = null
    }
    if (this.keepaliveWorker) {
      this.keepaliveWorker.terminate()
      this.keepaliveWorker = null
    }

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

          // Posição: broadcasts são a fonte mais fresca, mas se o jogador
          // está PARADO e a posição local divergiu do presence (broadcast
          // perdido por hiccup de rede), reconcilia pela do presence —
          // qualquer dessincronização se corrige em até 20s (keepalive)
          let position: [number, number, number] = existing?.position ?? [meta.x ?? 0, 0, meta.z ?? 0.5]
          let rotation = existing?.rotation ?? meta.rot ?? 0
          let sitting = existing?.sitting ?? meta.sit ?? false
          if (existing && !existing.moving && typeof meta.x === 'number' && typeof meta.z === 'number') {
            const drift = Math.hypot(existing.position[0] - meta.x, existing.position[2] - meta.z)
            if (drift > 1.5) {
              position = [meta.x, 0, meta.z]
              rotation = meta.rot ?? rotation
              sitting = meta.sit ?? false
            }
          }

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
            screenOn: meta.screen ?? false,
            focused: meta.focus ?? false,
            position,
            rotation,
            moving: existing?.moving ?? false,
            sitting,
          }
        }

        // Voltou dentro da quarentena → cancela a saída (era só um flap)
        for (const id of Object.keys(next)) {
          const pending = this.pendingLeaves.get(id)
          if (pending) {
            clearTimeout(pending.timer)
            this.pendingLeaves.delete(id)
          }
        }

        // Notificações de entrada/saída + cutscenes do estacionamento
        if (this.hadFirstSync) {
          const store = useTeamStore.getState()
          for (const id of Object.keys(next)) {
            if (!current[id]) {
              store.addToast(`🚗 ${next[id].name} está chegando`, 'in')
              store.addCutscene({
                id: crypto.randomUUID(),
                kind: 'arrive',
                userId: id,
                name: next[id].name,
                avatar: next[id].avatar,
                ts: Date.now(),
              })
            }
          }
          for (const id of Object.keys(current)) {
            if (!next[id] && !this.pendingLeaves.has(id)) {
              // Quarentena: mantém o boneco parado por 12s; só então confirma
              const player = current[id]
              const timer = setTimeout(() => this.confirmLeave(id), 12_000)
              this.pendingLeaves.set(id, { player, timer })
            }
          }
        } else {
          this.hadFirstSync = true
        }

        // Bonecos em quarentena continuam visíveis (congelados) até confirmar
        for (const [id, pending] of this.pendingLeaves) {
          if (!next[id]) next[id] = { ...pending.player, moving: false }
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
      .on('broadcast', { event: 'note' }, ({ payload }) => {
        const n = payload as { to: string; fromName: string }
        if (!n || n.to !== this.me.id) return
        void fetchUnreadNotes(this.me.id)
        useTeamStore.getState().addToast(`📨 Recado novo de ${n.fromName}`, 'in')
      })
      .on('broadcast', { event: 'rec' }, ({ payload }) => {
        const r = payload as { on: boolean; byId: string; byName: string }
        if (!r || r.byId === this.me.id) return
        useTeamStore.getState().setRecording({ on: r.on, byId: r.on ? r.byId : null, byName: r.on ? r.byName : null })
      })
      .on('broadcast', { event: 'rec-stop' }, () => {
        // Master mandou parar a gravação — quem está gravando reage (CallDock)
        useTeamStore.getState().bumpRecStop()
      })
      .on('broadcast', { event: 'sale' }, ({ payload }) => {
        // Disparado pelo TRIGGER do Postgres (realtime.send) quando um lead
        // vira GANHO no CRM — sino + confete pra todo mundo no escritório
        const s = payload as { lead?: string; value?: number; by?: string }
        if (!s) return
        useTeamStore.getState().setSaleEvent({
          lead: s.lead ?? 'Novo cliente',
          value: Number(s.value ?? 0),
          by: s.by ?? '',
          ts: Date.now(),
        })
      })
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        const r = payload as { to: string; fromId: string; fromName: string; x?: number; z?: number }
        if (!r || r.to !== this.me.id) return
        // Modo foco: não toca — responde sozinho pra quem chamou
        if (useTeamStore.getState().focused) {
          void this.channel?.send({
            type: 'broadcast',
            event: 'focus-reply',
            payload: { to: r.fromId, name: this.me.name },
          })
          return
        }
        useTeamStore.getState().setIncomingRing({
          fromId: r.fromId,
          fromName: r.fromName,
          x: r.x ?? 0,
          z: r.z ?? 0.5,
          ts: Date.now(),
        })
      })
      .on('broadcast', { event: 'summon' }, ({ payload }) => {
        // Aceno: agente chamado pro café/até alguém — TODOS veem a mesma cena
        const s = payload as NonNullable<ReturnType<typeof useTeamStore.getState>['agentSummon']>
        if (!s || !s.agentKey) return
        useTeamStore.getState().setAgentSummon(s)
        useTeamStore.getState().addToast(`👋 ${s.byName} chamou um agente pro café`, 'in')
      })
      .on('broadcast', { event: 'focus-reply' }, ({ payload }) => {
        const r = payload as { to: string; name: string }
        if (!r || r.to !== this.me.id) return
        useTeamStore.getState().addToast(`🔕 ${r.name} está em modo foco — te chama assim que sair`, 'out')
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
        // Auto-heal: se o canal caiu, refaz a conexão; senão, re-track
        const chState = (this.channel as unknown as { state?: string } | null)?.state
        if (!this.channel || chState === 'closed' || chState === 'errored') {
          this.connect()
        } else {
          void this.channel.track(this.presenceState)
        }
      }
    } catch {
      // sem worker (ambiente restrito): segue com o heartbeat padrão
    }

    void this.loadChatHistory()
    void this.refreshRooms()
    void fetchUnreadNotes(this.me.id)
  }

  /** Saída confirmada (ficou 12s fora do presence): remove o boneco,
   * avisa e roda a cutscene de ida embora. */
  private confirmLeave(id: string) {
    const pending = this.pendingLeaves.get(id)
    if (!pending) return
    this.pendingLeaves.delete(id)
    const store = useTeamStore.getState()
    store.removeRemotePlayer(id)
    store.addToast(`🚗 ${pending.player.name} foi embora`, 'out')
    store.addCutscene({
      id: crypto.randomUUID(),
      kind: 'leave',
      userId: id,
      name: pending.player.name,
      avatar: pending.player.avatar,
      lastPos: [pending.player.position[0], pending.player.position[2]],
      ts: Date.now(),
    })
    // Quem estava gravando saiu de verdade → limpa o indicador
    const rec = store.recording
    if (rec.on && rec.byId === id) {
      store.setRecording({ on: false, byId: null, byName: null })
    }
  }

  /** Avisa o destinatário que ganhou um recado novo. */
  announceNote(toUserId: string) {
    void this.channel?.send({
      type: 'broadcast',
      event: 'note',
      payload: { to: toUserId, fromName: this.me.name },
    })
  }

  /** Avisa todos que a gravação de reunião começou/terminou. */
  sendRecording(on: boolean) {
    void this.channel?.send({
      type: 'broadcast',
      event: 'rec',
      payload: { on, byId: this.me.id, byName: this.me.name },
    })
  }

  /** Master pede pra parar a gravação ativa (quem grava recebe e para). */
  sendStopRecording() {
    void this.channel?.send({ type: 'broadcast', event: 'rec-stop', payload: { by: this.me.id } })
  }

  /** Toca a campainha/cutuca outro usuário online (leva minha posição
   * pra ele poder aceitar e vir andando até mim). */
  sendRing(toUserId: string) {
    const [x, , z] = useTeamStore.getState().playerPosition
    void this.channel?.send({
      type: 'broadcast',
      event: 'ring',
      payload: {
        to: toUserId,
        fromId: this.me.id,
        fromName: this.me.name,
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
      },
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
  async updateCallState(patch: Partial<Pick<PresencePayload, 'inCall' | 'micOn' | 'camOn' | 'screen'>>) {
    this.presenceState = { ...this.presenceState, ...patch }
    await this.channel?.track(this.presenceState)
  }

  /** Acena pra um agente: todos os clientes veem ele atender o chamado. */
  sendAgentSummon(summon: NonNullable<ReturnType<typeof useTeamStore.getState>['agentSummon']>) {
    useTeamStore.getState().setAgentSummon(summon)
    void this.channel?.send({ type: 'broadcast', event: 'summon', payload: summon })
  }

  /** Liga/desliga o modo foco no presence. */
  async updateFocus(on: boolean) {
    this.presenceState = { ...this.presenceState, focus: on }
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
    for (const { timer } of this.pendingLeaves.values()) clearTimeout(timer)
    this.pendingLeaves.clear()
    // Salva a posição final antes de sair
    void this.savePositionNow()
    if (this.channel) {
      void supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}

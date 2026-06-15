// Chamada de áudio/vídeo do escritório — WebRTC mesh P2P.
// Signaling via broadcast 'rtc' no canal Supabase (TeamRealtime).
// Regra anti-glare: para cada par, quem tem o user_id lexicograficamente
// MENOR cria a offer. Transceivers de áudio+vídeo são criados na primeira
// negociação; ligar/desligar câmera usa replaceTrack (sem renegociar).
import { useTeamStore } from '../store/useTeamStore'
import { CameraFx, CameraBg } from './cameraFx'
import type { TeamRealtime, RtcSignal } from './realtime'

const BG_KEY = 'office-camera-bg'
function loadBg(): CameraBg {
  try {
    const v = localStorage.getItem(BG_KEY)
    if (v) return JSON.parse(v) as CameraBg
  } catch { /* ignore */ }
  return { kind: 'none' }
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface PeerEntry {
  pc: RTCPeerConnection
  pendingCandidates: RTCIceCandidateInit[]
  remoteStream: MediaStream
  /** última vez que a conexão esteve 'connected' (ou criação) — watchdog */
  lastOk: number
}

export class CallManager {
  private myId: string
  private realtime: TeamRealtime
  private peers = new Map<string, PeerEntry>()
  private localStream: MediaStream | null = null
  private camTrack: MediaStreamTrack | null = null // o que é transmitido (cru OU processado)
  private rawCamTrack: MediaStreamTrack | null = null // câmera crua (antes do fundo)
  private camFx: CameraFx | null = null
  private bgMode: CameraBg = loadBg()
  private screenTrack: MediaStreamTrack | null = null
  private unsubscribe: (() => void) | null = null
  /** watchdog: reconecta pares que ficaram presos (offer/ICE perdidos) */
  private watchdog: ReturnType<typeof setInterval> | null = null
  /** áudio da tela compartilhada, mixado com o microfone num track só
   * (replaceTrack no sender de áudio — sem renegociação) */
  private screenAudioTrack: MediaStreamTrack | null = null
  private mixedAudioTrack: MediaStreamTrack | null = null
  private mixCtx: AudioContext | null = null

  /** vídeo ativo a transmitir: tela compartilhada tem prioridade sobre câmera */
  private get activeVideoTrack(): MediaStreamTrack | null {
    return this.screenTrack ?? this.camTrack
  }

  /** áudio ativo a transmitir: mix mic+tela durante o compartilhamento */
  private get activeAudioTrack(): MediaStreamTrack | null {
    return this.mixedAudioTrack ?? this.localStream?.getAudioTracks()[0] ?? null
  }

  constructor(myId: string, realtime: TeamRealtime) {
    this.myId = myId
    this.realtime = realtime
    realtime.setRtcHandler((signal) => void this.handleSignal(signal))
  }

  get joined() {
    return useTeamStore.getState().call.joined
  }

  async joinCall() {
    if (this.joined) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    this.localStream = stream
    useTeamStore.getState().setCall({ joined: true, micOn: true, camOn: false, localStream: stream })
    await this.realtime.updateCallState({ inCall: true, micOn: true, camOn: false })

    // Conecta com quem já está na chamada (eu ofereço se meu id < peer id;
    // senão o peer vai me ver entrar via presence e oferecer pra mim)
    this.syncPeers()

    // Observa entradas/saídas da chamada
    this.unsubscribe = useTeamStore.subscribe(() => this.syncPeers())

    // Watchdog: com 3+ pessoas, offers/ICE podem se perder no signaling.
    // Qualquer par que não fique 'connected' em ~12s é derrubado e
    // renegociado do zero (o lado de menor id re-oferece).
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = setInterval(() => this.checkPeerHealth(), 4000)
  }

  private checkPeerHealth() {
    if (!this.joined) return
    const now = Date.now()
    for (const [id, entry] of [...this.peers.entries()]) {
      const state = entry.pc.connectionState
      if (state === 'connected') {
        entry.lastOk = now
        continue
      }
      // 'new'/'connecting' preso, ou 'disconnected' sem se recuperar
      if (now - entry.lastOk > 12_000) {
        this.closePeer(id)
        // quem tem o menor id re-oferece na hora; o outro lado vai
        // receber a offer nova (ou o watchdog dele faz o mesmo)
        const player = useTeamStore.getState().remotePlayers[id]
        if (player?.inCall && this.myId < id) void this.createOfferTo(id)
      }
    }
    // Garante pares que nunca chegaram a ser criados (sinal perdido)
    this.syncPeers()
  }

  /** Cria/derruba conexões conforme quem está com inCall=true no presence. */
  private syncPeers() {
    if (!this.joined || !this.localStream) return
    const remotePlayers = useTeamStore.getState().remotePlayers

    for (const [id, player] of Object.entries(remotePlayers)) {
      if (player.inCall && !this.peers.has(id) && this.myId < id) {
        void this.createOfferTo(id)
      }
      if (!player.inCall && this.peers.has(id)) {
        this.closePeer(id)
      }
    }
    // Peers que saíram do escritório
    for (const id of [...this.peers.keys()]) {
      if (!remotePlayers[id]) this.closePeer(id)
    }
  }

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const entry: PeerEntry = { pc, pendingCandidates: [], remoteStream: new MediaStream(), lastOk: Date.now() }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.realtime.sendRtcSignal({ to: peerId, type: 'ice', candidate: ev.candidate.toJSON() })
      }
    }
    pc.ontrack = (ev) => {
      entry.remoteStream.addTrack(ev.track)
      useTeamStore.getState().setRemoteStream(peerId, entry.remoteStream)
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        entry.lastOk = Date.now()
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(peerId)
        // Renegocia na hora em vez de esperar o watchdog
        const player = useTeamStore.getState().remotePlayers[peerId]
        if (player?.inCall && this.myId < peerId) void this.createOfferTo(peerId)
      }
      // 'disconnected' costuma se recuperar sozinho — o watchdog cuida se não
    }

    this.peers.set(peerId, entry)
    return entry
  }

  private async createOfferTo(peerId: string) {
    if (!this.localStream) return
    const entry = this.createPeer(peerId)
    const audioTrack = this.activeAudioTrack
    if (audioTrack) entry.pc.addTrack(audioTrack, this.localStream)
    const videoTx = entry.pc.addTransceiver('video', { direction: 'sendrecv' })
    if (this.activeVideoTrack) await videoTx.sender.replaceTrack(this.activeVideoTrack)

    const offer = await entry.pc.createOffer()
    await entry.pc.setLocalDescription(offer)
    this.realtime.sendRtcSignal({ to: peerId, type: 'offer', sdp: offer.sdp })
  }

  private async handleSignal(signal: RtcSignal) {
    if (!this.joined) return
    const peerId = signal.from

    if (signal.type === 'offer') {
      // Recebi offer: sou o answerer deste par
      this.closePeer(peerId, true)
      const entry = this.createPeer(peerId)
      await entry.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })

      if (this.localStream) {
        const audioTrack = this.activeAudioTrack
        if (audioTrack) entry.pc.addTrack(audioTrack, this.localStream)
      }
      const videoTx = entry.pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video')
      if (videoTx) {
        videoTx.direction = 'sendrecv'
        if (this.activeVideoTrack) await videoTx.sender.replaceTrack(this.activeVideoTrack)
      }

      const answer = await entry.pc.createAnswer()
      await entry.pc.setLocalDescription(answer)
      this.realtime.sendRtcSignal({ to: peerId, type: 'answer', sdp: answer.sdp })
      await this.flushCandidates(entry)
      return
    }

    const entry = this.peers.get(peerId)
    if (!entry) return

    if (signal.type === 'answer') {
      await entry.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
      await this.flushCandidates(entry)
    } else if (signal.type === 'ice' && signal.candidate) {
      if (entry.pc.remoteDescription) {
        await entry.pc.addIceCandidate(signal.candidate).catch(() => undefined)
      } else {
        entry.pendingCandidates.push(signal.candidate)
      }
    }
  }

  private async flushCandidates(entry: PeerEntry) {
    for (const c of entry.pendingCandidates.splice(0)) {
      await entry.pc.addIceCandidate(c).catch(() => undefined)
    }
  }

  toggleMic() {
    const { call } = useTeamStore.getState()
    if (!this.localStream || !call.joined) return
    const next = !call.micOn
    for (const track of this.localStream.getAudioTracks()) track.enabled = next
    useTeamStore.getState().setCall({ micOn: next })
    void this.realtime.updateCallState({ micOn: next })
  }

  /** Compartilhar tela: substitui o vídeo transmitido (modelo "câmera OU tela"). */
  async toggleScreenShare() {
    const { call } = useTeamStore.getState()
    if (!this.localStream || !call.joined) return
    if (this.screenTrack) {
      await this.stopScreenShare()
      return
    }
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15 } },
      // Pede o áudio da tela também (Chrome: marque "compartilhar áudio da
      // guia/sistema" no seletor). Se o usuário não marcar, segue sem.
      audio: true,
    })
    const track = display.getVideoTracks()[0]
    if (!track) return
    this.screenTrack = track
    // Usuário pode parar pelo controle do navegador
    track.addEventListener('ended', () => void this.stopScreenShare())
    for (const { pc } of this.peers.values()) {
      const videoTx = pc.getTransceivers().find(
        (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
      )
      if (videoTx) await videoTx.sender.replaceTrack(track)
    }

    // Áudio da tela: mixa com o microfone num único track e troca o que está
    // sendo transmitido (replaceTrack — sem renegociar). Mutar o mic continua
    // funcionando: o track original silencia e o mix só leva o som da tela.
    const sAudio = display.getAudioTracks()[0] ?? null
    if (sAudio) {
      this.screenAudioTrack = sAudio
      try {
        const Ctx =
          window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        this.mixCtx = ctx
        const dest = ctx.createMediaStreamDestination()
        ctx.createMediaStreamSource(new MediaStream([sAudio])).connect(dest)
        const micTrack = this.localStream.getAudioTracks()[0]
        if (micTrack) ctx.createMediaStreamSource(new MediaStream([micTrack])).connect(dest)
        this.mixedAudioTrack = dest.stream.getAudioTracks()[0] ?? null
        if (this.mixedAudioTrack) {
          for (const { pc } of this.peers.values()) {
            const aSender = pc.getSenders().find((s) => s.track?.kind === 'audio')
            if (aSender) await aSender.replaceTrack(this.mixedAudioTrack)
          }
        }
      } catch {
        // mix indisponível: segue compartilhando só o vídeo
        this.mixedAudioTrack = null
      }
    }
    // Preview local mostra a tela no lugar da câmera
    if (this.camTrack) this.localStream.removeTrack(this.camTrack)
    this.localStream.addTrack(track)
    useTeamStore.getState().setCall({ screenOn: true, camOn: true })
    await this.realtime.updateCallState({ camOn: true, screen: true })
  }

  async stopScreenShare() {
    if (!this.screenTrack || !this.localStream) return
    const track = this.screenTrack
    this.screenTrack = null
    track.stop()
    this.localStream.removeTrack(track)

    // Desfaz o mix de áudio: volta a transmitir só o microfone
    if (this.mixedAudioTrack) {
      const micTrack = this.localStream.getAudioTracks()[0] ?? null
      for (const { pc } of this.peers.values()) {
        const aSender = pc.getSenders().find((s) => s.track?.kind === 'audio')
        if (aSender) await aSender.replaceTrack(micTrack)
      }
      this.mixedAudioTrack.stop()
      this.mixedAudioTrack = null
    }
    if (this.screenAudioTrack) {
      this.screenAudioTrack.stop()
      this.screenAudioTrack = null
    }
    if (this.mixCtx) {
      void this.mixCtx.close().catch(() => undefined)
      this.mixCtx = null
    }
    // Restaura a câmera se estava ligada antes do compartilhamento
    const restore = this.camTrack
    if (restore) this.localStream.addTrack(restore)
    for (const { pc } of this.peers.values()) {
      const videoTx = pc.getTransceivers().find(
        (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
      )
      if (videoTx) await videoTx.sender.replaceTrack(restore ?? null)
    }
    const camOn = !!restore
    useTeamStore.getState().setCall({ screenOn: false, camOn })
    await this.realtime.updateCallState({ camOn, screen: false })
  }

  async toggleCam() {
    const { call } = useTeamStore.getState()
    if (!this.localStream || !call.joined) return
    if (call.screenOn) return // pare o compartilhamento de tela primeiro

    if (call.camOn && this.camTrack) {
      if (this.camTrack !== this.rawCamTrack) this.camTrack.stop()
      this.localStream.removeTrack(this.camTrack)
      for (const { pc } of this.peers.values()) {
        const sender = pc.getSenders().find((s) => s.track === this.camTrack)
        if (sender) await sender.replaceTrack(null)
      }
      this.camFx?.stop()
      this.camFx = null
      this.rawCamTrack?.stop()
      this.rawCamTrack = null
      this.camTrack = null
      useTeamStore.getState().setCall({ camOn: false })
      await this.realtime.updateCallState({ camOn: false })
      return
    }

    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
    })
    this.rawCamTrack = camStream.getVideoTracks()[0]
    // Aplica o fundo escolhido (blur/imagem); 'none' = câmera crua
    this.camTrack = await this.buildCamTrack()
    this.localStream.addTrack(this.camTrack)
    for (const { pc } of this.peers.values()) {
      const videoTx = pc.getTransceivers().find(
        (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video'
      )
      if (videoTx) await videoTx.sender.replaceTrack(this.camTrack)
    }
    useTeamStore.getState().setCall({ camOn: true })
    await this.realtime.updateCallState({ camOn: true })
  }

  /** Monta a track da câmera com (ou sem) o fundo configurado. */
  private async buildCamTrack(): Promise<MediaStreamTrack> {
    if (!this.rawCamTrack) throw new Error('sem câmera')
    this.camFx?.stop()
    this.camFx = null
    if (this.bgMode.kind === 'none') return this.rawCamTrack
    this.camFx = new CameraFx(this.rawCamTrack, this.bgMode)
    return await this.camFx.start()
  }

  /** Troca o fundo da câmera (blur / imagem / nenhum). Aplica ao vivo. */
  async setCameraBackground(mode: CameraBg) {
    this.bgMode = mode
    try {
      localStorage.setItem(BG_KEY, JSON.stringify(mode))
    } catch { /* ignore */ }
    const st = useTeamStore.getState()
    if (!st.call.camOn || !this.localStream || !this.rawCamTrack) return // aplica quando ligar a câmera

    if (mode.kind !== 'none') st.addToast('🪄 Aplicando fundo...', 'in')

    // Caso simples: já tem FX rodando e só mudou o modo (sem trocar a track)
    if (this.camFx && mode.kind !== 'none') {
      this.camFx.setMode(mode)
      return
    }

    // Remonta a track (none↔fx) e substitui no preview e nos peers
    const old = this.camTrack
    const next = await this.buildCamTrack()
    if (old && old !== this.rawCamTrack) old.stop()
    if (old) this.localStream.removeTrack(old)
    this.camTrack = next
    this.localStream.addTrack(next)
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(next)
    }
    useTeamStore.getState().setCall({ localStream: this.localStream })

    // Feedback: o modelo carregou e o efeito está de fato no ar?
    if (mode.kind !== 'none') {
      if (this.camFx?.usingModel) {
        useTeamStore.getState().addToast('🪄 Fundo aplicado', 'in')
      } else {
        useTeamStore
          .getState()
          .addToast('Não consegui carregar o fundo virtual neste navegador/rede — segue sem efeito', 'out')
      }
    }
  }

  getCameraBackground(): CameraBg {
    return this.bgMode
  }

  async leaveCall() {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.watchdog) {
      clearInterval(this.watchdog)
      this.watchdog = null
    }
    for (const id of [...this.peers.keys()]) this.closePeer(id)
    if (this.screenTrack) {
      this.screenTrack.stop()
      this.screenTrack = null
    }
    if (this.screenAudioTrack) {
      this.screenAudioTrack.stop()
      this.screenAudioTrack = null
    }
    if (this.mixedAudioTrack) {
      this.mixedAudioTrack.stop()
      this.mixedAudioTrack = null
    }
    if (this.mixCtx) {
      void this.mixCtx.close().catch(() => undefined)
      this.mixCtx = null
    }
    this.camFx?.stop()
    this.camFx = null
    if (this.rawCamTrack) {
      this.rawCamTrack.stop()
      this.rawCamTrack = null
    }
    if (this.camTrack) {
      this.camTrack.stop()
      this.camTrack = null
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
      this.localStream = null
    }
    useTeamStore.getState().setCall({
      joined: false,
      micOn: false,
      camOn: false,
      screenOn: false,
      localStream: null,
      remoteStreams: {},
    })
    await this.realtime.updateCallState({ inCall: false, micOn: false, camOn: false })
  }

  private closePeer(id: string, silent = false) {
    const entry = this.peers.get(id)
    if (!entry) return
    entry.pc.onicecandidate = null
    entry.pc.ontrack = null
    entry.pc.onconnectionstatechange = null
    entry.pc.close()
    this.peers.delete(id)
    if (!silent) useTeamStore.getState().setRemoteStream(id, null)
  }

  destroy() {
    void this.leaveCall()
  }
}

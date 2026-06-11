// Chamada de áudio/vídeo do escritório — WebRTC mesh P2P.
// Signaling via broadcast 'rtc' no canal Supabase (TeamRealtime).
// Regra anti-glare: para cada par, quem tem o user_id lexicograficamente
// MENOR cria a offer. Transceivers de áudio+vídeo são criados na primeira
// negociação; ligar/desligar câmera usa replaceTrack (sem renegociar).
import { useTeamStore } from '../store/useTeamStore'
import type { TeamRealtime, RtcSignal } from './realtime'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

interface PeerEntry {
  pc: RTCPeerConnection
  pendingCandidates: RTCIceCandidateInit[]
  remoteStream: MediaStream
}

export class CallManager {
  private myId: string
  private realtime: TeamRealtime
  private peers = new Map<string, PeerEntry>()
  private localStream: MediaStream | null = null
  private camTrack: MediaStreamTrack | null = null
  private screenTrack: MediaStreamTrack | null = null
  private unsubscribe: (() => void) | null = null

  /** vídeo ativo a transmitir: tela compartilhada tem prioridade sobre câmera */
  private get activeVideoTrack(): MediaStreamTrack | null {
    return this.screenTrack ?? this.camTrack
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
    const entry: PeerEntry = { pc, pendingCandidates: [], remoteStream: new MediaStream() }

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
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(peerId)
      }
    }

    this.peers.set(peerId, entry)
    return entry
  }

  private async createOfferTo(peerId: string) {
    if (!this.localStream) return
    const entry = this.createPeer(peerId)
    const audioTrack = this.localStream.getAudioTracks()[0]
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
        const audioTrack = this.localStream.getAudioTracks()[0]
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
      audio: false,
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
    // Preview local mostra a tela no lugar da câmera
    if (this.camTrack) this.localStream.removeTrack(this.camTrack)
    this.localStream.addTrack(track)
    useTeamStore.getState().setCall({ screenOn: true, camOn: true })
    await this.realtime.updateCallState({ camOn: true })
  }

  async stopScreenShare() {
    if (!this.screenTrack || !this.localStream) return
    const track = this.screenTrack
    this.screenTrack = null
    track.stop()
    this.localStream.removeTrack(track)
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
    await this.realtime.updateCallState({ camOn })
  }

  async toggleCam() {
    const { call } = useTeamStore.getState()
    if (!this.localStream || !call.joined) return
    if (call.screenOn) return // pare o compartilhamento de tela primeiro

    if (call.camOn && this.camTrack) {
      this.camTrack.stop()
      this.localStream.removeTrack(this.camTrack)
      for (const { pc } of this.peers.values()) {
        const sender = pc.getSenders().find((s) => s.track === this.camTrack)
        if (sender) await sender.replaceTrack(null)
      }
      this.camTrack = null
      useTeamStore.getState().setCall({ camOn: false })
      await this.realtime.updateCallState({ camOn: false })
      return
    }

    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
    })
    this.camTrack = camStream.getVideoTracks()[0]
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

  async leaveCall() {
    this.unsubscribe?.()
    this.unsubscribe = null
    for (const id of [...this.peers.keys()]) this.closePeer(id)
    if (this.screenTrack) {
      this.screenTrack.stop()
      this.screenTrack = null
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

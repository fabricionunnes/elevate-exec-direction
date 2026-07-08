// Gravação de reuniões em VÍDEO: compõe os participantes num canvas
// (grid estilo Meet, 1280x720 @ 8fps) com o áudio de todos mixado via
// WebAudio. Em paralelo, grava uma trilha só de áudio (32kbps) usada na
// transcrição (Whisper via rota transcribe do marcelo-webhook).
// Resultado vai pro bucket privado office-recordings + tabela
// office_meeting_recordings (30 dias; leitura master/admin; delete só Fabrício).
import { supabase } from '@/integrations/supabase/client'
import type { TeamProfile } from '../store/useTeamStore'

const TRANSCRIBE_URL = 'https://kktocqnwlmmxjzgmnxgs.supabase.co/functions/v1/marcelo-webhook?transcribe=1'
const ATA_URL = 'https://kktocqnwlmmxjzgmnxgs.supabase.co/functions/v1/marcelo-webhook?ata=1'
export const MAX_RECORDING_MS = 90 * 60 * 1000 // 90 min

/** Gera a ata estruturada (resumo/tópicos/decisões/ações) a partir da transcrição. */
export async function generateAta(transcript: string): Promise<Record<string, unknown> | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return null
    const res = await fetch(ATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ transcript }),
    })
    const data = await res.json()
    return data?.ok && data.ata ? (data.ata as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export interface RecordingParticipant {
  id: string
  name: string
  stream: MediaStream | null
  camOn: boolean
  color: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 960x540 compõe/encoda ~44% menos pixels que 720p — diferença visual mínima
// num registro de reunião, e alivia MUITO a CPU durante a gravação.
const W = 960
const H = 540

export class MeetingRecorder {
  private ctx: AudioContext | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private audioRecorder: MediaRecorder | null = null
  private videoRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private videoChunks: Blob[] = []
  private sources = new Map<string, MediaStreamAudioSourceNode>()
  private videoEls = new Map<string, HTMLVideoElement>()
  private canvas: HTMLCanvasElement | null = null
  private drawTimer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private videoMime = 'video/webm'
  private getParticipants: (() => RecordingParticipant[]) | null = null

  get active() {
    return !!this.audioRecorder
  }

  start(
    localStream: MediaStream | null,
    remoteStreams: Record<string, MediaStream>,
    getParticipants: () => RecordingParticipant[]
  ) {
    if (this.audioRecorder) return
    this.getParticipants = getParticipants
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    void this.ctx.resume()
    this.dest = this.ctx.createMediaStreamDestination()
    if (localStream) this.addStream('me', localStream)
    for (const [id, s] of Object.entries(remoteStreams)) this.addStream(id, s)

    // Trilha de áudio dedicada (leve) — vira a transcrição
    const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    this.audioRecorder = new MediaRecorder(this.dest.stream, { mimeType: audioMime, audioBitsPerSecond: 32000 })
    this.audioChunks = []
    this.audioRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data)
    }
    this.audioRecorder.start(2000)

    // Vídeo: canvas com o grid dos participantes + áudio mixado
    try {
      this.canvas = document.createElement('canvas')
      this.canvas.width = W
      this.canvas.height = H
      const canvasStream = this.canvas.captureStream(8)
      const composed = new MediaStream([...canvasStream.getVideoTracks(), ...this.dest.stream.getAudioTracks()])
      this.videoMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'
      this.videoRecorder = new MediaRecorder(composed, {
        mimeType: this.videoMime,
        videoBitsPerSecond: 420_000,
        audioBitsPerSecond: 32000,
      })
      this.videoChunks = []
      this.videoRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.videoChunks.push(e.data)
      }
      this.videoRecorder.start(2000)
      this.drawTimer = setInterval(() => this.drawFrame(), 125)
    } catch {
      // sem suporte a vídeo: segue só com áudio
      this.videoRecorder = null
    }

    this.startedAt = Date.now()
  }

  /** Pluga o áudio de um peer que entrou no meio da gravação. */
  addStream(id: string, stream: MediaStream) {
    if (!this.ctx || !this.dest || this.sources.has(id)) return
    if (stream.getAudioTracks().length === 0) return
    try {
      const src = this.ctx.createMediaStreamSource(stream)
      src.connect(this.dest)
      this.sources.set(id, src)
    } catch {
      // stream sem áudio utilizável
    }
  }

  /** Remove o áudio de um peer (saiu da sala gravada). */
  removeStream(id: string) {
    const src = this.sources.get(id)
    if (src) {
      try {
        src.disconnect()
      } catch {
        // já desconectado
      }
      this.sources.delete(id)
    }
    const el = this.videoEls.get(id)
    if (el) {
      el.srcObject = null
      this.videoEls.delete(id)
    }
  }

  /** Sincroniza o áudio gravado com quem está NA SALA agora: pluga quem
   * entrou e desconecta quem saiu (a gravação é da sala, não do escritório). */
  syncStreams(allowed: Record<string, MediaStream>) {
    if (!this.active) return
    for (const id of [...this.sources.keys()]) {
      if (id !== 'me' && !allowed[id]) this.removeStream(id)
    }
    for (const [id, s] of Object.entries(allowed)) this.addStream(id, s)
  }

  private videoElFor(id: string, stream: MediaStream): HTMLVideoElement {
    let el = this.videoEls.get(id)
    if (!el) {
      el = document.createElement('video')
      el.muted = true
      el.playsInline = true
      el.autoplay = true
      this.videoEls.set(id, el)
    }
    if (el.srcObject !== stream) {
      el.srcObject = stream
      void el.play().catch(() => undefined)
    }
    return el
  }

  private drawFrame() {
    if (!this.canvas || !this.getParticipants) return
    const g = this.canvas.getContext('2d')
    if (!g) return
    const parts = this.getParticipants()
    g.fillStyle = '#0a0a14'
    g.fillRect(0, 0, W, H)
    if (parts.length === 0) return

    const cols = parts.length <= 1 ? 1 : parts.length <= 4 ? 2 : 3
    const rows = Math.ceil(parts.length / cols)
    const tw = W / cols
    const th = H / rows

    parts.forEach((p, i) => {
      const x = (i % cols) * tw
      const y = Math.floor(i / cols) * th
      const hasVideo = p.camOn && p.stream && p.stream.getVideoTracks().length > 0
      if (hasVideo && p.stream) {
        const el = this.videoElFor(p.id, p.stream)
        if (el.readyState >= 2 && el.videoWidth > 0) {
          // cover: corta pra preencher o tile
          const scale = Math.max((tw - 8) / el.videoWidth, (th - 8) / el.videoHeight)
          const dw = el.videoWidth * scale
          const dh = el.videoHeight * scale
          g.save()
          g.beginPath()
          g.rect(x + 4, y + 4, tw - 8, th - 8)
          g.clip()
          g.drawImage(el, x + 4 + (tw - 8 - dw) / 2, y + 4 + (th - 8 - dh) / 2, dw, dh)
          g.restore()
        }
      } else {
        // sem câmera: círculo com a inicial
        g.fillStyle = '#15171f'
        g.fillRect(x + 4, y + 4, tw - 8, th - 8)
        g.fillStyle = p.color || '#1A4A8A'
        g.beginPath()
        g.arc(x + tw / 2, y + th / 2 - 10, Math.min(tw, th) * 0.16, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#ffffff'
        g.font = `bold ${Math.round(Math.min(tw, th) * 0.16)}px -apple-system, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(p.name.charAt(0).toUpperCase(), x + tw / 2, y + th / 2 - 8)
      }
      // Label com o nome
      g.fillStyle = 'rgba(0,0,0,0.65)'
      g.fillRect(x + 4, y + th - 34, tw - 8, 30)
      g.fillStyle = '#ffffff'
      g.font = 'bold 16px -apple-system, sans-serif'
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(p.name.slice(0, 40), x + 14, y + th - 19)
    })

    // Timestamp da gravação
    const elapsed = Math.round((Date.now() - this.startedAt) / 1000)
    const mm = Math.floor(elapsed / 60)
    const ss = String(elapsed % 60).padStart(2, '0')
    g.fillStyle = 'rgba(150,20,20,0.85)'
    g.fillRect(W - 110, 10, 100, 28)
    g.fillStyle = '#fff'
    g.font = 'bold 14px -apple-system, sans-serif'
    g.textAlign = 'center'
    g.fillText(`⏺ ${mm}:${ss}`, W - 60, 24)
  }

  async stop(): Promise<{ videoBlob: Blob | null; audioBlob: Blob; durationS: number } | null> {
    const audioRec = this.audioRecorder
    if (!audioRec) return null
    const videoRec = this.videoRecorder
    if (this.drawTimer) clearInterval(this.drawTimer)
    this.drawTimer = null
    const durationS = Math.round((Date.now() - this.startedAt) / 1000)

    const audioBlob = await new Promise<Blob>((resolve) => {
      audioRec.onstop = () => resolve(new Blob(this.audioChunks, { type: 'audio/webm' }))
      audioRec.stop()
    })
    let videoBlob: Blob | null = null
    if (videoRec && videoRec.state !== 'inactive') {
      videoBlob = await new Promise<Blob>((resolve) => {
        videoRec.onstop = () => resolve(new Blob(this.videoChunks, { type: this.videoMime }))
        videoRec.stop()
      })
    }

    this.audioRecorder = null
    this.videoRecorder = null
    this.audioChunks = []
    this.videoChunks = []
    this.sources.clear()
    for (const el of this.videoEls.values()) {
      el.srcObject = null
    }
    this.videoEls.clear()
    this.canvas = null
    this.getParticipants = null
    void this.ctx?.close()
    this.ctx = null
    this.dest = null
    return { videoBlob, audioBlob, durationS }
  }
}

/** Sobe a gravação (vídeo se houver, senão áudio), transcreve e registra. */
export async function saveRecording(
  videoBlob: Blob | null,
  audioBlob: Blob,
  durationS: number,
  roomName: string | null,
  me: TeamProfile
): Promise<{ ok: boolean; transcribed: boolean }> {
  const safeRoom = (roomName || 'escritorio').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)
  const main = videoBlob && videoBlob.size > 1000 ? videoBlob : audioBlob
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeRoom}.webm`

  const { error: upErr } = await supabase.storage
    .from('office-recordings')
    .upload(path, main, { contentType: main.type || 'video/webm' })
  if (upErr) return { ok: false, transcribed: false }

  // Transcrição da trilha de áudio (não bloqueia o salvamento se falhar)
  let transcript: string | null = null
  try {
    if (audioBlob.size < 24_000_000) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const base64 = await blobToBase64(audioBlob)
        const res = await fetch(TRANSCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ audioBase64: base64, audioMime: 'audio/webm' }),
        })
        const data = await res.json()
        if (data?.ok && typeof data.text === 'string') transcript = data.text
      }
    }
  } catch {
    // segue sem transcrição
  }

  // Ata estruturada (resumo executivo) — best-effort
  let minutes: Record<string, unknown> | null = null
  if (transcript && transcript.length > 80) {
    minutes = await generateAta(transcript)
  }

  const { error } = await supabase.from('office_meeting_recordings' as never).insert({
    room_name: roomName,
    started_by: me.id,
    started_by_name: me.name,
    duration_s: durationS,
    audio_path: path,
    transcript,
    minutes,
  } as never)
  return { ok: !error, transcribed: !!transcript }
}

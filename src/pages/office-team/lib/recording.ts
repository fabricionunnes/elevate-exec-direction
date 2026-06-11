// Gravação de reuniões: mixa o áudio local + de todos os peers num único
// stream (WebAudio) e grava em webm/opus. Ao parar: sobe pro Storage
// (bucket privado office-recordings), transcreve via Whisper (rota
// transcribe do marcelo-webhook) e registra em office_meeting_recordings
// (30 dias de retenção; leitura só pra master/admin via RLS).
import { supabase } from '@/integrations/supabase/client'
import type { TeamProfile } from '../store/useTeamStore'

const TRANSCRIBE_URL = 'https://kktocqnwlmmxjzgmnxgs.supabase.co/functions/v1/marcelo-webhook?transcribe=1'
export const MAX_RECORDING_MS = 90 * 60 * 1000 // 90 min

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export class MeetingRecorder {
  private ctx: AudioContext | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private sources = new Map<string, MediaStreamAudioSourceNode>()
  private startedAt = 0
  private mime = 'audio/webm'

  get active() {
    return !!this.recorder
  }

  start(localStream: MediaStream | null, remoteStreams: Record<string, MediaStream>) {
    if (this.recorder) return
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    void this.ctx.resume()
    this.dest = this.ctx.createMediaStreamDestination()
    if (localStream) this.addStream('me', localStream)
    for (const [id, s] of Object.entries(remoteStreams)) this.addStream(id, s)
    this.mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    // 32kbps opus ≈ 14MB/h — cabe no limite da transcrição
    this.recorder = new MediaRecorder(this.dest.stream, { mimeType: this.mime, audioBitsPerSecond: 32000 })
    this.chunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start(2000)
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

  async stop(): Promise<{ blob: Blob; durationS: number } | null> {
    const rec = this.recorder
    if (!rec) return null
    const durationS = Math.round((Date.now() - this.startedAt) / 1000)
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: this.mime }))
      rec.stop()
    })
    this.recorder = null
    this.chunks = []
    this.sources.clear()
    void this.ctx?.close()
    this.ctx = null
    this.dest = null
    return { blob, durationS }
  }
}

/** Sobe a gravação, transcreve (best-effort) e registra os metadados. */
export async function saveRecording(
  blob: Blob,
  durationS: number,
  roomName: string | null,
  me: TeamProfile
): Promise<{ ok: boolean; transcribed: boolean }> {
  const safeRoom = (roomName || 'escritorio').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeRoom}.webm`

  const { error: upErr } = await supabase.storage
    .from('office-recordings')
    .upload(path, blob, { contentType: 'audio/webm' })
  if (upErr) return { ok: false, transcribed: false }

  // Transcrição (não bloqueia o salvamento se falhar)
  let transcript: string | null = null
  try {
    if (blob.size < 24_000_000) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const base64 = await blobToBase64(blob)
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

  const { error } = await supabase.from('office_meeting_recordings' as never).insert({
    room_name: roomName,
    started_by: me.id,
    started_by_name: me.name,
    duration_s: durationS,
    audio_path: path,
    transcript,
  } as never)
  return { ok: !error, transcribed: !!transcript }
}

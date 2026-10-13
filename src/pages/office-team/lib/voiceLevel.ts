// Nível de voz de um MediaStream (0..1) pra animar o indicador de fala
// dos avatares. Um AudioContext só, um AnalyserNode por stream (cache por
// stream), leitura barata (fftSize 256) feita no useFrame de cada avatar.
let ctx: AudioContext | null = null
const analysers = new WeakMap<MediaStream, { node: AnalyserNode; buf: Uint8Array; last: number; at: number }>()

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/** Nível RMS do stream (0..1), com cache de ~50ms. 0 se não der pra medir. */
export function voiceLevel(stream: MediaStream | null | undefined): number {
  if (!stream || stream.getAudioTracks().length === 0) return 0
  let entry = analysers.get(stream)
  if (!entry) {
    const c = getCtx()
    if (!c) return 0
    try {
      const src = c.createMediaStreamSource(stream)
      const node = c.createAnalyser()
      node.fftSize = 256
      node.smoothingTimeConstant = 0.6
      src.connect(node)
      entry = { node, buf: new Uint8Array(node.fftSize), last: 0, at: 0 }
      analysers.set(stream, entry)
    } catch {
      return 0
    }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  const now = performance.now()
  if (now - entry.at < 50) return entry.last
  entry.at = now
  entry.node.getByteTimeDomainData(entry.buf)
  let sum = 0
  for (let i = 0; i < entry.buf.length; i++) {
    const v = (entry.buf[i] - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / entry.buf.length)
  // 0.02 = silêncio de fundo; 0.25 = fala firme
  entry.last = Math.max(0, Math.min(1, (rms - 0.02) / 0.23))
  return entry.last
}

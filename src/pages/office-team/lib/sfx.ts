// Efeitos sonoros do escritório (WebAudio, zero assets).
// O AudioContext nasce suspenso por autoplay policy — destravamos no primeiro
// clique/tecla do usuário (mesmo padrão do ringtone do CallDock).
let ctx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
      const unlock = () => {
        void ctx?.resume()
        window.removeEventListener('click', unlock)
        window.removeEventListener('keydown', unlock)
      }
      window.addEventListener('click', unlock)
      window.addEventListener('keydown', unlock)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, gainPeak: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, c.currentTime + start)
  gain.gain.linearRampToValueAtTime(gainPeak, c.currentTime + start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.05)
}

/** Sino de vendas — três marteladas brilhantes de campainha (estilo gongo de meta). */
export function playSaleBell() {
  const c = ensureCtx()
  if (!c) return
  for (let i = 0; i < 3; i++) {
    const t = i * 0.28
    // fundamental + harmônicos = timbre metálico de sino
    tone(c, 1318.5, t, 0.9, 0.22)
    tone(c, 1975.5, t, 0.7, 0.1)
    tone(c, 2637, t, 0.5, 0.06)
  }
}

/** Ping curto de "sua reunião vai começar". */
export function playMeetingPing() {
  const c = ensureCtx()
  if (!c) return
  tone(c, 880, 0, 0.35, 0.16)
  tone(c, 1174.7, 0.18, 0.45, 0.16)
}

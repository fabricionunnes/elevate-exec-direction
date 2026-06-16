// Tom de chamada (ringback) tocado no navegador da atendente enquanto o cliente ainda não atendeu.
// Cadência brasileira: ~1s de tom (425 Hz) + 4s de silêncio. Usa WebAudio (sem arquivo).
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

export function startRingback() {
  stopRingback();
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    ctx = new AC();
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 425; // tom padrão Brasil
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    const ring = () => {
      if (!ctx || !gain) return;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      gain.gain.setValueAtTime(0.12, t + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.06);
    };
    ring();
    interval = setInterval(ring, 5000); // 1s tom + 4s silêncio
  } catch {
    stopRingback();
  }
}

export function stopRingback() {
  if (interval) { clearInterval(interval); interval = null; }
  try { osc?.stop(); } catch { /* noop */ }
  try { osc?.disconnect(); } catch { /* noop */ }
  try { gain?.disconnect(); } catch { /* noop */ }
  try { ctx?.close(); } catch { /* noop */ }
  osc = null; gain = null; ctx = null;
}

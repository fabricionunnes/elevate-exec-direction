// Simple notification sound utility
let audioContext: AudioContext | null = null;
let hasUserInteracted = false;

// Track user interaction to enable audio
if (typeof window !== 'undefined') {
  const enableAudio = () => {
    hasUserInteracted = true;
    // Create audio context on first interaction
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };
  
  window.addEventListener('click', enableAudio, { once: true });
  window.addEventListener('keydown', enableAudio, { once: true });
  window.addEventListener('touchstart', enableAudio, { once: true });
}

export const playNotificationSound = async () => {
  try {
    // Create audio context if not exists
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume if suspended (browser policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pleasant notification tone (two-tone chime)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
    
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    console.log('🔔 Notification sound played');
  } catch (error) {
    console.log('Could not play notification sound:', error);
  }
};

// Som de comemoração (venda nova no Quadro de Gestão à Vista): fanfarra curta
// sintetizada — arpejo maior ascendente + "brilho" no fim. Sem arquivo externo,
// então toca na TV mesmo offline. Respeita a política do navegador: precisa de
// um clique na página antes (o primeiro clique em qualquer lugar libera).
export const playCelebrationSound = async () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === "suspended") await audioContext.resume();
    const ctx = audioContext;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    // fanfarra: C5 E5 G5 C6 (arpejo) + acorde final sustentado
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.11;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
    });
    // acorde final (C6 + E6 + G6) com brilho
    const tEnd = now + 0.46;
    [1046.5, 1318.5, 1568.0].forEach((f) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, tEnd);
      g.gain.linearRampToValueAtTime(0.35, tEnd + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, tEnd + 0.9);
      o.connect(g); g.connect(master); o.start(tEnd); o.stop(tEnd + 0.95);
    });
    // "chuva de brilho": ruído curto filtrado em agudos
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000;
    const ng = ctx.createGain(); ng.gain.value = 0.18;
    src.connect(hp); hp.connect(ng); ng.connect(master); src.start(tEnd); src.stop(tEnd + 0.5);
  } catch (e) {
    console.warn("celebration sound:", e);
  }
};

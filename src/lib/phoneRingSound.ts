// Phone ring sound using Web Audio API
let audioContext: AudioContext | null = null;
let isRinging = false;
let ringInterval: NodeJS.Timeout | null = null;

const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// Create a phone ring tone pattern
const playRingTone = async () => {
  const ctx = initAudioContext();
  
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const now = ctx.currentTime;
  
  // Ring pattern: two tones alternating (classic phone ring)
  const frequencies = [440, 480]; // Standard dial tone frequencies
  const ringDuration = 0.1;
  const gapDuration = 0.05;
  
  for (let i = 0; i < 4; i++) {
    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, now);
      
      gainNode.gain.setValueAtTime(0, now + (i * (ringDuration * 2 + gapDuration)));
      gainNode.gain.linearRampToValueAtTime(0.15, now + (i * (ringDuration * 2 + gapDuration)) + 0.01);
      gainNode.gain.setValueAtTime(0.15, now + (i * (ringDuration * 2 + gapDuration)) + ringDuration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, now + (i * (ringDuration * 2 + gapDuration)) + ringDuration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      const startTime = now + (i * (ringDuration * 2 + gapDuration)) + (index * ringDuration);
      oscillator.start(startTime);
      oscillator.stop(startTime + ringDuration);
    });
  }
};

export const startPhoneRing = () => {
  if (isRinging) return;
  
  isRinging = true;
  
  // Play immediately
  playRingTone();
  
  // Then repeat every 2 seconds (ring pattern with pause)
  ringInterval = setInterval(() => {
    if (isRinging) {
      playRingTone();
    }
  }, 2000);
};

export const stopPhoneRing = () => {
  isRinging = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
};

// Initialize audio context on first user interaction
if (typeof window !== "undefined") {
  const initOnInteraction = () => {
    initAudioContext();
    window.removeEventListener("click", initOnInteraction);
    window.removeEventListener("touchstart", initOnInteraction);
  };
  
  window.addEventListener("click", initOnInteraction);
  window.addEventListener("touchstart", initOnInteraction);
}

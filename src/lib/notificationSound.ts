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

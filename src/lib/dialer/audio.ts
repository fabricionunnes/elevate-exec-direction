// URL do player de gravação: passa pelo proxy autenticado (a URL crua da Twilio é privada e pede senha).
export function dialerAudioSrc(callId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return `${base}/functions/v1/dialer-audio?callId=${callId}&apikey=${key}`;
}

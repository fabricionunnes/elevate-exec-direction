// Voz do Time de IA: ouve pelo reconhecimento do navegador (pt-BR), manda o texto
// pro Max (ask), fala a resposta (ai-team-tts; sem provedor cai pro sintetizador do
// navegador) e, em mãos livres, volta a ouvir sozinho. Usado pela tela principal.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FaseVoz = "parado" | "ouvindo" | "pensando" | "falando";

const SR: any = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
export const temReconhecimento = !!SR;

export function useMaxVoice(ask: (text: string) => Promise<string>) {
  const [fase, setFase] = useState<FaseVoz>("parado");
  const [parcial, setParcial] = useState("");
  const [falaAtual, setFalaAtual] = useState("");   // o que o Max está dizendo (legenda)
  const [erro, setErro] = useState<string | null>(null);
  const [maosLivres, setMaosLivres] = useState(true);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vivoRef = useRef(true);
  const faseRef = useRef<FaseVoz>("parado");
  const maosRef = useRef(true);
  const setFaseSafe = (f: FaseVoz) => { faseRef.current = f; setFase(f); };
  useEffect(() => { maosRef.current = maosLivres; }, [maosLivres]);

  const pararAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }, []);

  /** Pede o áudio de um texto ao servidor (null se não der). */
  const sintetizar = useCallback(async (texto: string): Promise<Blob | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-team-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: texto }),
      });
      if (r.ok && (r.headers.get("Content-Type") || "").includes("audio")) return await r.blob();
    } catch { /* cai pro sintetizador */ }
    return null;
  }, []);

  const tocar = useCallback((blob: Blob): Promise<void> => new Promise<void>((resolve) => {
    if (!vivoRef.current) return resolve();
    const a = new Audio(URL.createObjectURL(blob));
    audioRef.current = a;
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  }), []);

  // "deixa eu olhar aqui": toca na hora em que você termina de falar, enquanto o Max pensa
  const fillerRef = useRef<Blob | null>(null);
  const fillerTocando = useRef<Promise<void> | null>(null);
  const prepararFiller = useCallback(async () => {
    if (fillerRef.current) return;
    fillerRef.current = await sintetizar("Deixa eu olhar aqui.");
  }, [sintetizar]);

  /** Divide em primeira frase + resto: o áudio da primeira sai antes, o resto chega enquanto ela toca. */
  const partir = (texto: string): string[] => {
    const t = texto.trim();
    const m = t.match(/^(.{20,220}?[.!?])\s+([\s\S]+)$/);
    return m ? [m[1], m[2]] : [t];
  };

  /** Fala um texto (TTS do servidor; fallback navegador). Resolve quando termina. */
  const falar = useCallback(async (texto: string): Promise<void> => {
    if (!texto.trim()) return;
    setFalaAtual(texto);
    setFaseSafe("falando");
    let ok = false;
    try {
      const partes = partir(texto);
      const pedidos = partes.map((p) => sintetizar(p));
      // espera o "deixa eu olhar" terminar pra não falar por cima
      if (fillerTocando.current) { await fillerTocando.current; fillerTocando.current = null; }
      for (const pedido of pedidos) {
        const blob = await pedido;
        if (!blob) { ok = false; break; }
        if (!vivoRef.current) return;
        await tocar(blob);
        ok = true;
      }
    } catch { ok = false; }
    if (!ok) {
      pararAudio();
      await new Promise<void>((resolve) => {
        try {
          const u = new SpeechSynthesisUtterance(texto);
          u.lang = "pt-BR";
          const voz = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt-br")) || null;
          if (voz) u.voice = voz;
          u.rate = 1.05;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
        } catch { resolve(); }
      });
    }
    if (faseRef.current === "falando") setFaseSafe("parado");
  }, [pararAudio, sintetizar, tocar]);

  const ouvir = useCallback(() => {
    if (!SR) { setErro("Seu navegador não tem reconhecimento de voz. Use Chrome ou Safari."); return; }
    if (!vivoRef.current) return;
    pararAudio();
    try { recRef.current?.abort(); } catch { /* noop */ }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalTxt = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += t; else interim += t;
      }
      setParcial(finalTxt || interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") { if (vivoRef.current && faseRef.current === "ouvindo") setTimeout(ouvir, 300); return; }
      setErro(e.error === "not-allowed" ? "Libera o microfone pro Nexus no navegador." : `Microfone: ${e.error}`);
      setFaseSafe("parado");
    };
    rec.onend = async () => {
      if (!vivoRef.current || faseRef.current !== "ouvindo") return;
      const texto = finalTxt.trim();
      setParcial("");
      if (!texto) { setTimeout(ouvir, 200); return; }
      setFaseSafe("pensando");
      if (fillerRef.current) fillerTocando.current = tocar(fillerRef.current);
      try {
        const resposta = await ask(texto);
        if (!vivoRef.current) return;
        await falar(resposta);
      } catch (e: any) {
        setErro(e?.message || "O Max não respondeu");
        setFaseSafe("parado");
        return;
      }
      if (!vivoRef.current) return;
      if (maosRef.current) { setFaseSafe("ouvindo"); setTimeout(ouvir, 150); }
      else setFaseSafe("parado");
    };
    recRef.current = rec;
    setErro(null);
    setFaseSafe("ouvindo");
    prepararFiller();
    try { rec.start(); } catch { setTimeout(ouvir, 300); }
  }, [ask, falar, pararAudio, prepararFiller, tocar]);

  const parar = useCallback(() => {
    setFaseSafe("parado");
    try { recRef.current?.abort(); } catch { /* noop */ }
    setParcial("");
    pararAudio();
  }, [pararAudio]);

  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; try { recRef.current?.abort(); } catch { /* noop */ } pararAudio(); };
  }, [pararAudio]);

  return { fase, parcial, falaAtual, erro, maosLivres, setMaosLivres, ouvir, parar, falar, setFalaAtual };
}

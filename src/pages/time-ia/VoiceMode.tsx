// Modo voz do Time de IA: você fala, o Max ouve (reconhecimento do navegador,
// pt-BR), pensa (ai-team-chat) e responde falando (ai-team-tts; se não houver
// provedor, cai pro sintetizador do navegador). Loop de conversa: quando o Max
// termina de falar, volta a ouvir sozinho até você encerrar.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Loader2, Volume2, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAVY = "#0D2B5E";
const RED = "#CC1B1B";

type Fase = "ouvindo" | "pensando" | "falando" | "parado";

interface Props {
  maxName: string;
  ask: (text: string) => Promise<string>;   // manda pro Max e devolve a resposta em texto
  onClose: () => void;
}

const SR: any = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

export default function VoiceMode({ maxName, ask, onClose }: Props) {
  const [fase, setFase] = useState<Fase>("parado");
  const [parcial, setParcial] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState("");
  const [ultimaResposta, setUltimaResposta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [maosLivres, setMaosLivres] = useState(true);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vivoRef = useRef(true);
  const faseRef = useRef<Fase>("parado");
  const setFaseSafe = (f: Fase) => { faseRef.current = f; setFase(f); };

  const pararAudio = () => {
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  };

  const falar = useCallback(async (texto: string): Promise<void> => {
    setFaseSafe("falando");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-team-tts`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: texto }),
      });
      if (r.ok && (r.headers.get("Content-Type") || "").includes("audio")) {
        const blob = await r.blob();
        await new Promise<void>((resolve) => {
          const a = new Audio(URL.createObjectURL(blob));
          audioRef.current = a;
          a.onended = () => resolve();
          a.onerror = () => resolve();
          a.play().catch(() => resolve());
        });
        return;
      }
    } catch { /* cai pro sintetizador */ }
    // fallback: voz do navegador
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
  }, []);

  const ouvir = useCallback(() => {
    if (!SR) { setErro("Seu navegador não tem reconhecimento de voz. Use Chrome ou Safari."); return; }
    if (!vivoRef.current) return;
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
      if (e.error === "not-allowed") setErro("Libera o microfone pro Nexus no navegador.");
      else setErro(`Microfone: ${e.error}`);
      setFaseSafe("parado");
    };
    rec.onend = async () => {
      if (!vivoRef.current || faseRef.current !== "ouvindo") return;
      const texto = finalTxt.trim();
      setParcial("");
      if (!texto) { setTimeout(ouvir, 200); return; }
      setUltimaPergunta(texto);
      setFaseSafe("pensando");
      try {
        const resposta = await ask(texto);
        if (!vivoRef.current) return;
        setUltimaResposta(resposta);
        await falar(resposta);
      } catch (e: any) {
        setErro(e?.message || "O Max não respondeu");
      }
      if (!vivoRef.current) return;
      if (maosLivres) { setFaseSafe("ouvindo"); setTimeout(ouvir, 150); }
      else setFaseSafe("parado");
    };
    recRef.current = rec;
    setErro(null);
    setFaseSafe("ouvindo");
    try { rec.start(); } catch { setTimeout(ouvir, 300); }
  }, [ask, falar, maosLivres]);

  // começa ouvindo
  useEffect(() => {
    vivoRef.current = true;
    const t = setTimeout(ouvir, 300);
    return () => {
      vivoRef.current = false;
      clearTimeout(t);
      try { recRef.current?.abort(); } catch { /* noop */ }
      pararAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    if (fase === "ouvindo") { setFaseSafe("parado"); try { recRef.current?.abort(); } catch { /* noop */ } setParcial(""); return; }
    if (fase === "falando") { pararAudio(); ouvir(); return; }
    if (fase === "parado") ouvir();
  };

  const legenda = { ouvindo: "Estou ouvindo. Pode falar.", pensando: `${maxName} está olhando os números...`, falando: `${maxName} está falando`, parado: "Toque no microfone pra falar" }[fase];

  return (
    <div className="fixed inset-0 z-50 flex flex-col text-white" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #17408f 0%, ${NAVY} 45%, #071a3a 100%)` }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-white/70">Time de IA · modo voz</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white gap-1.5" onClick={() => setMaosLivres((v) => !v)} title="Mãos livres: volta a ouvir sozinho depois da resposta">
            <Volume2 className="h-4 w-4" />{maosLivres ? "mãos livres" : "toque pra falar"}
          </Button>
          <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={onClose} title="Voltar pro texto">
            <Keyboard className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Orbe do Max */}
        <div className="relative flex items-center justify-center">
          <div className={cn("absolute rounded-full transition-all", fase === "falando" ? "h-56 w-56 animate-ping" : fase === "ouvindo" ? "h-48 w-48 animate-pulse" : "h-40 w-40")} style={{ background: fase === "ouvindo" ? `${RED}33` : "rgba(255,255,255,0.08)" }} />
          <div className={cn("relative h-36 w-36 rounded-full flex items-center justify-center text-5xl font-semibold shadow-2xl transition-transform", fase === "falando" && "scale-105")} style={{ background: fase === "ouvindo" ? RED : "#ffffff", color: fase === "ouvindo" ? "#fff" : NAVY }}>
            {fase === "pensando" ? <Loader2 className="h-12 w-12 animate-spin" /> : maxName.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="text-center space-y-1">
          <div className="text-xl font-semibold">{maxName}</div>
          <div className="text-sm text-white/70">{legenda}</div>
        </div>

        {/* Transcrição */}
        <div className="w-full max-w-2xl min-h-[120px] space-y-3 text-center">
          {(parcial || ultimaPergunta) && (
            <p className="text-base text-white/90">
              <span className="text-white/50 text-xs block mb-0.5">você</span>
              {parcial || ultimaPergunta}
            </p>
          )}
          {ultimaResposta && fase !== "ouvindo" && (
            <p className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
              <span className="text-white/50 text-xs block mb-0.5">{maxName}</span>
              {ultimaResposta}
            </p>
          )}
          {erro && <p className="text-sm" style={{ color: "#ffb4b4" }}>{erro}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center pb-10 pt-4">
        <button
          onClick={toggleMic}
          className={cn("h-20 w-20 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95", fase === "ouvindo" ? "ring-8 ring-white/20" : "")}
          style={{ background: fase === "ouvindo" ? RED : "#ffffff", color: fase === "ouvindo" ? "#fff" : NAVY }}
          title={fase === "ouvindo" ? "Parar de ouvir" : fase === "falando" ? "Interromper e falar" : "Falar"}
        >
          {fase === "ouvindo" ? <MicOff className="h-8 w-8" /> : fase === "pensando" ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
        </button>
      </div>
    </div>
  );
}

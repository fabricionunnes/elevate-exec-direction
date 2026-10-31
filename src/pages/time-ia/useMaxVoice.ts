// Voz do Time de IA: ouve pelo reconhecimento do navegador (pt-BR), manda o texto
// pro Max (ask), fala a resposta (ai-team-tts; sem provedor cai pro sintetizador do
// navegador) e, em mãos livres, volta a ouvir sozinho. Enquanto o Max fala, um
// reconhecedor "vigia" fica ligado: se você começar a falar por cima, o áudio para e
// o que você disse já vira a próxima pergunta (interrupção, como numa conversa).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FaseVoz = "parado" | "ouvindo" | "pensando" | "falando";

const SR: any = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
export const temReconhecimento = !!SR;

const palavras = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
/** Quanto do que o microfone pegou é eco do próprio Max (0 a 1). */
const ecoRatio = (ouvido: string, falado: string) => {
  const o = palavras(ouvido); if (!o.length) return 1;
  const f = new Set(palavras(falado));
  return o.filter((w) => f.has(w)).length / o.length;
};

export function useMaxVoice(ask: (text: string) => Promise<string>) {
  const [fase, setFase] = useState<FaseVoz>("parado");
  const [parcial, setParcial] = useState("");
  const [falaAtual, setFalaAtual] = useState("");   // o que o Max está dizendo (legenda)
  const [erro, setErro] = useState<string | null>(null);
  const [maosLivres, setMaosLivres] = useState(true);
  const recRef = useRef<any>(null);        // reconhecedor principal (ouvir)
  const vigiaRef = useRef<any>(null);      // reconhecedor de interrupção (enquanto o Max fala)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveTocar = useRef<(() => void) | null>(null);
  const vivoRef = useRef(true);
  const faseRef = useRef<FaseVoz>("parado");
  const maosRef = useRef(true);
  const falaRef = useRef("");
  const interrompido = useRef<string | null>(null); // texto que interrompeu o Max
  const setFaseSafe = (f: FaseVoz) => { faseRef.current = f; setFase(f); };
  useEffect(() => { maosRef.current = maosLivres; }, [maosLivres]);

  const pararAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    resolveTocar.current?.(); resolveTocar.current = null;
  }, []);
  const pararVigia = () => { try { vigiaRef.current?.abort(); } catch { /* noop */ } vigiaRef.current = null; };

  /** Pede o áudio de um texto ao servidor (null se não der; o motivo vai pra `erro`). */
  const sintetizar = useCallback(async (texto: string): Promise<Blob | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-team-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: texto }),
      });
      if (r.ok && (r.headers.get("Content-Type") || "").includes("audio")) return await r.blob();
      let motivo = `HTTP ${r.status}`;
      try { const j = await r.json(); motivo = [j?.error, ...(j?.falhas || [])].filter(Boolean).join(" · ") || motivo; } catch { /* sem corpo */ }
      setErro(`Voz do servidor falhou (${motivo}). Usando a voz do navegador por enquanto.`);
    } catch (e: any) {
      setErro(`Voz do servidor fora do ar (${e?.message || "rede"}). Usando a voz do navegador por enquanto.`);
    }
    return null;
  }, []);

  /** Voz do navegador (reserva): a mais masculina em pt-BR que existir. */
  const vozNavegador = () => {
    const vozes = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("pt-br"));
    const masc = vozes.find((v) => /daniel|felipe|ricardo|eddy|rocko|reed|male|masc/i.test(v.name));
    return masc || vozes.find((v) => !/luciana|joana|fernanda|female|femin/i.test(v.name)) || vozes[0] || null;
  };

  const tocar = useCallback((blob: Blob): Promise<void> => new Promise<void>((resolve) => {
    if (!vivoRef.current) return resolve();
    const a = new Audio(URL.createObjectURL(blob));
    audioRef.current = a;
    resolveTocar.current = resolve;
    const fim = () => { if (resolveTocar.current === resolve) resolveTocar.current = null; resolve(); };
    a.onended = fim;
    a.onerror = fim;
    a.play().catch(fim);
  }), []);

  // Resposta imediata enquanto o Max pensa: uma frase curta, escolhida pelo assunto,
  // sai no mesmo segundo em que você termina de falar (áudios pré-gerados na entrada).
  const FILLERS: { re: RegExp; frases: string[] }[] = [
    { re: /caixa|financ|fatur|dinheiro|receb|pagar|conta|boleto/i, frases: ["Deixa eu puxar o financeiro aqui.", "Um segundo, olhando o caixa."] },
    { re: /lead|ligar|negocia|fechar|venda|vender|meta|cliente|pipeline|funil/i, frases: ["Vou olhar o CRM, um segundo.", "Deixa eu ver as negociações."] },
    { re: /manda|envia|cobra|mensagem|whats|avisa|tarefa|cria|agenda|roda|sobe|an[uú]ncio/i, frases: ["Beleza, vou preparar isso.", "Deixa comigo, já faço."] },
    { re: /tr[aá]fego|campanha|anúncio|meta ads|cpl|verba/i, frases: ["Olhando as campanhas aqui.", "Um segundo, puxando o tráfego."] },
    { re: /.*/, frases: ["Deixa eu olhar aqui.", "Um segundo.", "Já te falo."] },
  ];
  const fillerCache = useRef<Map<string, Blob | null>>(new Map());
  const fillerTocando = useRef<Promise<void> | null>(null);
  const prepararFiller = useCallback(async () => {
    if (fillerCache.current.size) return;
    for (const f of FILLERS) for (const frase of f.frases) {
      if (!fillerCache.current.has(frase)) fillerCache.current.set(frase, await sintetizar(frase));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sintetizar]);
  const escolherFiller = (texto: string): Blob | null => {
    const grupo = FILLERS.find((f) => f.re.test(texto)) || FILLERS[FILLERS.length - 1];
    const frase = grupo.frases[Math.floor(Math.random() * grupo.frases.length)];
    return fillerCache.current.get(frase) || null;
  };

  /** Divide em primeira frase + resto: o áudio da primeira sai antes, o resto chega enquanto ela toca. */
  const partir = (texto: string): string[] => {
    const t = texto.trim();
    const m = t.match(/^(.{20,220}?[.!?])\s+([\s\S]+)$/);
    return m ? [m[1], m[2]] : [t];
  };

  /** Processa o que o dono disse: pensa, fala a resposta e decide se volta a ouvir. */
  const processar = useCallback(async (texto: string) => {
    setFaseSafe("pensando");
    const filler = escolherFiller(texto);
    if (filler) fillerTocando.current = tocar(filler);
    try {
      const resposta = await ask(texto);
      if (!vivoRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await falarRef.current(resposta);
    } catch (e: any) {
      setErro(e?.message || "O Max não respondeu");
      setFaseSafe("parado");
      return;
    }
    if (!vivoRef.current) return;
    if (interrompido.current) {
      // o dono falou por cima: o que ele disse já é a próxima pergunta
      const t = interrompido.current; interrompido.current = null;
      setParcial("");
      await processar(t);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (maosRef.current) { setFaseSafe("ouvindo"); setTimeout(() => ouvirRef.current(), 150); }
    else setFaseSafe("parado");
  }, [ask, tocar]);

  /** Enquanto o Max fala: escuta pra detectar que o dono começou a falar por cima. */
  const vigiar = useCallback(() => {
    if (!SR || !vivoRef.current) return;
    pararVigia();
    const rec = new SR();
    rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    let acumulado = "";
    let timer: any = null;
    let disparou = false;
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + " ";
      txt = txt.trim();
      if (!disparou) {
        // precisa de 2+ palavras que NÃO sejam eco do que o Max está falando
        if (palavras(txt).length >= 2 && ecoRatio(txt, falaRef.current) < 0.5) {
          disparou = true;
          interrompido.current = txt;
          pararAudio();
          setFaseSafe("ouvindo");
        } else return;
      }
      acumulado = txt;
      interrompido.current = txt;
      setParcial(txt);
      clearTimeout(timer);
      timer = setTimeout(() => { try { rec.stop(); } catch { /* noop */ } }, 1100); // pausa de 1,1 s = terminou de falar
    };
    rec.onerror = () => { /* vigia é melhor esforço */ };
    rec.onend = () => {
      if (vigiaRef.current === rec) vigiaRef.current = null;
      if (disparou && acumulado) interrompido.current = acumulado;
    };
    vigiaRef.current = rec;
    try { rec.start(); } catch { /* noop */ }
  }, [pararAudio]);

  /** Fala um texto (TTS do servidor; fallback navegador). Resolve quando termina ou é interrompido. */
  const falar = useCallback(async (texto: string): Promise<void> => {
    if (!texto.trim()) return;
    interrompido.current = null;
    falaRef.current = texto;
    setFalaAtual(texto);
    setFaseSafe("falando");
    vigiar();
    let ok = false;
    try {
      const partes = partir(texto);
      const pedidos = partes.map((p) => sintetizar(p));
      if (fillerTocando.current) { await fillerTocando.current; fillerTocando.current = null; }
      for (const pedido of pedidos) {
        if (interrompido.current) { ok = true; break; }
        const blob = await pedido;
        if (!blob) { ok = false; break; }
        if (!vivoRef.current || interrompido.current) { ok = true; break; }
        await tocar(blob);
        ok = true;
      }
    } catch { ok = false; }
    if (!ok && !interrompido.current) {
      pararAudio();
      await new Promise<void>((resolve) => {
        try {
          const u = new SpeechSynthesisUtterance(texto);
          u.lang = "pt-BR";
          const voz = vozNavegador();
          if (voz) u.voice = voz;
          u.rate = 1.0;
          u.pitch = 0.85;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
        } catch { resolve(); }
      });
    }
    // se o dono interrompeu, espera o vigia fechar a frase dele (até 2 s)
    if (interrompido.current) {
      for (let i = 0; i < 20 && vigiaRef.current; i++) await new Promise((r) => setTimeout(r, 100));
    }
    pararVigia();
    if (faseRef.current === "falando") setFaseSafe("parado");
  }, [pararAudio, sintetizar, tocar, vigiar]);
  const falarRef = useRef(falar);
  useEffect(() => { falarRef.current = falar; }, [falar]);

  const ouvir = useCallback(() => {
    if (!SR) { setErro("Seu navegador não tem reconhecimento de voz. Use Chrome ou Safari."); return; }
    if (!vivoRef.current) return;
    pararAudio();
    pararVigia();
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
      if (e.error === "no-speech" || e.error === "aborted") { if (vivoRef.current && faseRef.current === "ouvindo") setTimeout(() => ouvirRef.current(), 300); return; }
      setErro(e.error === "not-allowed" ? "Libera o microfone pro Nexus no navegador." : `Microfone: ${e.error}`);
      setFaseSafe("parado");
    };
    rec.onend = async () => {
      if (!vivoRef.current || faseRef.current !== "ouvindo") return;
      const texto = finalTxt.trim();
      setParcial("");
      if (!texto) { setTimeout(() => ouvirRef.current(), 200); return; }
      await processar(texto);
    };
    recRef.current = rec;
    setErro(null);
    setFaseSafe("ouvindo");
    prepararFiller();
    try { rec.start(); } catch { setTimeout(() => ouvirRef.current(), 300); }
  }, [pararAudio, prepararFiller, processar]);
  const ouvirRef = useRef(ouvir);
  useEffect(() => { ouvirRef.current = ouvir; }, [ouvir]);

  const parar = useCallback(() => {
    setFaseSafe("parado");
    try { recRef.current?.abort(); } catch { /* noop */ }
    pararVigia();
    interrompido.current = null;
    setParcial("");
    pararAudio();
  }, [pararAudio]);

  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; try { recRef.current?.abort(); } catch { /* noop */ } pararVigia(); pararAudio(); };
  }, [pararAudio]);

  return { fase, parcial, falaAtual, erro, maosLivres, setMaosLivres, ouvir, parar, falar, setFalaAtual };
}

// Deck de apresentação do onboarding: slides 16:9 com a marca UNV, tela cheia
// de verdade (Fullscreen API), transições animadas, profundidade 3D e gráficos.
//
// O palco é FIXO em 1600x900 e entra na tela por transform: scale(). Antes o
// conteúdo era medido em vh (altura da janela, não do slide): em monitor largo
// e baixo o slide passava da tela, cortava topo e rodapé e empurrava a barra de
// controles pra fora. Com escala, o slide cabe sempre inteiro e a proporção não
// muda — é assim que apresentação se comporta.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";

const NAVY = "#0D2B5E";
const NAVY_DEEP = "#071A3C";
const RED = "#CC1B1B";
const LOGO = "/images/unv-logo.png";
const LOGO_WHITE = "/images/unv-logo-white.png";

const STAGE_W = 1600;
const STAGE_H = 900;

export interface DeckPhase {
  title: string; period: string; objective: string;
  deliverables: string[]; client_actions: string[]; outcome: string;
}
export interface DeckPlan {
  title: string; subtitle?: string | null; intro?: string | null;
  phases: DeckPhase[];
  expectations?: { unv?: string[]; cliente?: string[] };
  success_metrics?: { label: string; target: string }[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};
const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 70 : -70, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -70 : 70, scale: 0.985, transition: { duration: 0.3 } }),
};

/** tamanho da fonte que cabe: encolhe conforme o texto cresce */
const fit = (texto: string | null | undefined, grande: number, medio: number, pequeno: number) => {
  const n = (texto || "").length;
  return n > 420 ? pequeno : n > 240 ? medio : grande;
};

const DarkBg = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-full w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 55%, #12386F 100%)` }}>
    <div className="absolute -top-1/3 -right-1/4 h-[70%] w-[55%] rounded-full opacity-25 blur-3xl"
      style={{ background: `radial-gradient(circle, ${RED} 0%, transparent 70%)` }} />
    <div className="absolute -bottom-1/3 -left-1/5 h-[60%] w-[45%] rounded-full opacity-20 blur-3xl"
      style={{ background: "radial-gradient(circle, #3B7DD8 0%, transparent 70%)" }} />
    <div className="absolute inset-0 opacity-[0.07]"
      style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
    <div className="relative h-full w-full">{children}</div>
  </div>
);

const Ring = ({ atual, total }: { atual: number; total: number }) => {
  const r = 34, c = 2 * Math.PI * r, pct = atual / total;
  return (
    <svg width="86" height="86" viewBox="0 0 86 86" className="shrink-0">
      <circle cx="43" cy="43" r={r} fill="none" stroke="#E6EAF2" strokeWidth="8" />
      <motion.circle cx="43" cy="43" r={r} fill="none" stroke={RED} strokeWidth="8" strokeLinecap="round"
        transform="rotate(-90 43 43)" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} />
      <text x="43" y="50" textAnchor="middle" fontSize="24" fontWeight="800" fill={NAVY}>{atual}</text>
    </svg>
  );
};

const Card3D = ({ children, delay = 0, tint = "light" }: { children: React.ReactNode; delay?: number; tint?: "light" | "red" }) => (
  <motion.div
    initial={{ opacity: 0, y: 28, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    style={{ transformStyle: "preserve-3d", boxShadow: "0 26px 55px -34px rgba(13,43,94,.55)" }}
    className={`rounded-2xl p-7 min-h-0 overflow-hidden ${tint === "red" ? "bg-red-50/70" : "bg-slate-50"}`}
  >{children}</motion.div>
);

export function OnboardingDeck({ plan, companyName, onClose }: {
  plan: DeckPlan; companyName?: string; onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(1);
  const [ocioso, setOcioso] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const temFinal = !!(plan.success_metrics?.length || plan.expectations?.unv?.length || plan.expectations?.cliente?.length);
  const total = 2 + plan.phases.length + (temFinal ? 1 : 0) + 1;

  const go = useCallback((d: number) => {
    setDir(d);
    setI((x) => Math.min(Math.max(x + d, 0), total - 1));
  }, [total]);

  // escala o palco pra caber inteiro na área disponível
  useLayoutEffect(() => {
    const calc = () => {
      const el = boxRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (boxRef.current) ro.observe(boxRef.current);
    window.addEventListener("resize", calc);
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch (e: any) {
      // navegador embutido ou política de permissão pode bloquear: avisa em vez
      // de não fazer nada (o deck já ocupa a janela inteira de qualquer forma)
      toast.info("Este navegador bloqueou a tela cheia. Use F11 — a apresentação já ocupa a janela toda.");
      console.warn("[deck] fullscreen:", e?.message);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
      else if (e.key.toLowerCase() === "f") { e.preventDefault(); toggleFull(); }
    };
    const onFs = () => setFull(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [go, onClose, toggleFull]);

  // controles somem sozinhos quando o mouse para (só em tela cheia)
  useEffect(() => {
    if (!full) { setOcioso(false); return; }
    let t: number;
    const mexeu = () => { setOcioso(false); window.clearTimeout(t); t = window.setTimeout(() => setOcioso(true), 2600); };
    mexeu();
    window.addEventListener("mousemove", mexeu);
    return () => { window.removeEventListener("mousemove", mexeu); window.clearTimeout(t); };
  }, [full]);

  const rodape = (n: number) => (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-16 py-4 border-t border-slate-100">
      <span className="text-xs text-slate-400 truncate max-w-[40%]">{companyName}</span>
      <span className="text-xs text-slate-400 tabular-nums">{n} / {total - 1}</span>
      <img src={LOGO} alt="UNV" className="h-7 w-auto object-contain" />
    </div>
  );

  const slides: React.ReactNode[] = useMemo(() => {
    const out: React.ReactNode[] = [];

    out.push(
      <DarkBg key="capa">
        <div className="h-full w-full flex flex-col justify-center px-24">
          <motion.img src={LOGO_WHITE} alt="UNV" custom={0} variants={fadeUp} initial="hidden" animate="show"
            className="h-28 w-auto object-contain self-start mb-14 drop-shadow-2xl" />
          {plan.subtitle && (
            <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show"
              className="text-base font-bold uppercase tracking-[0.35em] text-red-300 mb-5">{plan.subtitle}</motion.p>
          )}
          <motion.h1 custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="font-black text-white leading-[1.05] max-w-[75%]"
            style={{ fontSize: fit(plan.title, 76, 62, 50) }}>{plan.title}</motion.h1>
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-8 flex items-center gap-5">
            <span className="h-1.5 w-24 rounded-full" style={{ background: RED }} />
            <p className="text-2xl text-slate-300">Plano de trabalho e caminho para o resultado</p>
          </motion.div>
        </div>
      </DarkBg>
    );

    out.push(
      <div key="caminho" className="h-full w-full bg-white px-16 pt-14 pb-24 flex flex-col">
        <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: RED }}>O que vamos construir juntos</motion.p>
        <motion.h2 custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="text-6xl font-black mt-2" style={{ color: NAVY }}>O caminho</motion.h2>
        <div className="flex-1 min-h-0 flex items-center">
          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="leading-relaxed text-slate-800 max-w-[92%]"
            style={{ fontSize: fit(plan.intro, 32, 28, 24) }}>{plan.intro}</motion.p>
        </div>
        <div className="flex items-start gap-1 pb-2">
          {plan.phases.map((ph, x) => (
            <motion.div key={x} className="flex-1 min-w-0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + x * 0.13, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0"
                  style={{ background: x === 0 ? RED : NAVY, boxShadow: `0 10px 24px -10px ${x === 0 ? RED : NAVY}` }}>{x + 1}</div>
                {x < plan.phases.length - 1 && (
                  <motion.div className="h-[3px] flex-1 rounded-full origin-left" style={{ background: "#DDE3EC" }}
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.62 + x * 0.13, duration: 0.4 }} />
                )}
              </div>
              <p className="text-base font-bold mt-3 pr-4 leading-tight" style={{ color: NAVY }}>{ph.title}</p>
              {ph.period && <p className="text-sm text-slate-400 pr-4 mt-1">{ph.period}</p>}
            </motion.div>
          ))}
        </div>
        {rodape(1)}
      </div>
    );

    plan.phases.forEach((ph, x) => {
      const itens = [...(ph.deliverables || []), ...(ph.client_actions || [])].filter(Boolean);
      const denso = itens.length > 7 || itens.join(" ").length > 420;
      out.push(
        <div key={`f${x}`} className="h-full w-full bg-white px-16 pt-12 pb-24 flex flex-col">
          <div className="flex items-center gap-6">
            <Ring atual={x + 1} total={plan.phases.length} />
            <div className="min-w-0">
              <motion.h2 custom={0} variants={fadeUp} initial="hidden" animate="show"
                className="font-black leading-tight" style={{ color: NAVY, fontSize: fit(ph.title, 54, 46, 38) }}>{ph.title}</motion.h2>
              {ph.period && (
                <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show" className="text-xl text-slate-500 mt-1">{ph.period}</motion.p>
              )}
            </div>
          </div>
          {ph.objective && (
            <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show"
              className="mt-6 text-slate-800 max-w-[92%]" style={{ fontSize: denso ? 22 : 26 }}>{ph.objective}</motion.p>
          )}
          <div className="mt-7 grid gap-8 grid-cols-2 flex-1 min-h-0">
            {!!(ph.deliverables || []).filter(Boolean).length && (
              <Card3D delay={0.25}>
                <p className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: NAVY }}>A UNV entrega</p>
                <ul className="space-y-3">
                  {ph.deliverables.filter(Boolean).map((d, y) => (
                    <motion.li key={y} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + y * 0.09, duration: 0.4 }}
                      className="flex gap-3 text-slate-800 leading-snug" style={{ fontSize: denso ? 19 : 22 }}>
                      <span className="mt-2.5 h-2 w-2 rounded-full shrink-0" style={{ background: NAVY }} />{d}
                    </motion.li>
                  ))}
                </ul>
              </Card3D>
            )}
            {!!(ph.client_actions || []).filter(Boolean).length && (
              <Card3D delay={0.35} tint="red">
                <p className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: RED }}>O que precisamos de você</p>
                <ul className="space-y-3">
                  {ph.client_actions.filter(Boolean).map((d, y) => (
                    <motion.li key={y} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + y * 0.09, duration: 0.4 }}
                      className="flex gap-3 text-slate-800 leading-snug" style={{ fontSize: denso ? 19 : 22 }}>
                      <span className="mt-2.5 h-2 w-2 rounded-full shrink-0" style={{ background: RED }} />{d}
                    </motion.li>
                  ))}
                </ul>
              </Card3D>
            )}
          </div>
          {ph.outcome && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-6 rounded-xl px-8 py-5 text-white"
              style={{ background: `linear-gradient(100deg, ${NAVY_DEEP}, ${NAVY})`, boxShadow: `0 26px 50px -32px ${NAVY}` }}>
              <span className="text-xs font-bold uppercase tracking-wider text-red-300 mr-3">No fim desta fase</span>
              <span style={{ fontSize: denso ? 19 : 21 }}>{ph.outcome}</span>
            </motion.div>
          )}
          {rodape(2 + x)}
        </div>
      );
    });

    if (temFinal) {
      const metricas = plan.success_metrics || [];
      out.push(
        <div key="metricas" className="h-full w-full bg-white px-16 pt-12 pb-24 flex flex-col">
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show"
            className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: RED }}>Como vamos medir</motion.p>
          <motion.h2 custom={1} variants={fadeUp} initial="hidden" animate="show"
            className="text-5xl font-black mt-2 mb-8" style={{ color: NAVY }}>Sucesso e combinado</motion.h2>
          <div className="grid gap-12 grid-cols-2 flex-1 min-h-0">
            {!!metricas.length && (
              <div className="space-y-5">
                {metricas.map((m, x) => (
                  <div key={x}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xl text-slate-800">{m.label}</span>
                      <span className="text-xl font-bold" style={{ color: RED }}>{m.target || "a definir no kick-off"}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div className="h-full rounded-full origin-left"
                        style={{ background: `linear-gradient(90deg, ${NAVY}, ${RED})` }}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + x * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-6 min-h-0">
              {!!plan.expectations?.unv?.filter(Boolean).length && (
                <Card3D delay={0.3}>
                  <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: NAVY }}>Da UNV</p>
                  <ul className="space-y-2.5">{plan.expectations.unv.filter(Boolean).map((e, x) => (
                    <li key={x} className="flex gap-3 text-xl text-slate-800"><span className="mt-2.5 h-2 w-2 rounded-full shrink-0" style={{ background: NAVY }} />{e}</li>))}
                  </ul>
                </Card3D>
              )}
              {!!plan.expectations?.cliente?.filter(Boolean).length && (
                <Card3D delay={0.42} tint="red">
                  <p className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: RED }}>De você</p>
                  <ul className="space-y-2.5">{plan.expectations.cliente.filter(Boolean).map((e, x) => (
                    <li key={x} className="flex gap-3 text-xl text-slate-800"><span className="mt-2.5 h-2 w-2 rounded-full shrink-0" style={{ background: RED }} />{e}</li>))}
                  </ul>
                </Card3D>
              )}
            </div>
          </div>
          {rodape(total - 2)}
        </div>
      );
    }

    out.push(
      <DarkBg key="fim">
        <div className="h-full w-full flex flex-col items-center justify-center">
          <motion.img src={LOGO_WHITE} alt="UNV" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-36 w-auto object-contain mb-10 drop-shadow-2xl" />
          <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show" className="text-6xl font-black text-white">Bora pra cima.</motion.p>
          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show" className="mt-4 text-xl text-slate-300">Universidade Nacional de Vendas</motion.p>
        </div>
      </DarkBg>
    );
    return out;
  }, [plan, companyName, total, temFinal]);

  const controles = `transition-opacity duration-300 ${ocioso ? "opacity-0 pointer-events-none" : "opacity-100"}`;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[95] bg-black flex flex-col select-none">
      <div className="h-[3px] w-full bg-white/10 shrink-0">
        <motion.div className="h-full" style={{ background: RED }}
          animate={{ width: `${((i + 1) / total) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>

      {/* controles do topo: sempre alcançáveis, mesmo em tela cheia */}
      <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 ${controles}`}>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 bg-black/30 backdrop-blur gap-1.5" onClick={toggleFull}>
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {full ? "Sair da tela cheia" : "Tela cheia"}
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 bg-black/30 backdrop-blur" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* palco: 1600x900 fixo, escalado pra caber */}
      <div ref={boxRef} className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        <div style={{ width: STAGE_W * scale, height: STAGE_H * scale }} className="relative">
          <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
            className="absolute top-0 left-0 overflow-hidden rounded-lg shadow-2xl bg-white">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={i} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
                className="absolute inset-0">
                {slides[i]}
              </motion.div>
            </AnimatePresence>
          </div>
          <button className="absolute left-0 top-0 h-full w-[14%] cursor-w-resize" aria-label="anterior" onClick={() => go(-1)} />
          <button className="absolute right-0 top-0 h-full w-[14%] cursor-e-resize" aria-label="próximo" onClick={() => go(1)} />
        </div>
      </div>

      <div className={`flex items-center justify-center gap-2 py-3 shrink-0 ${controles}`}>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(-1)} disabled={i === 0}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-white/80 tabular-nums w-16 text-center">{i + 1} / {total}</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(1)} disabled={i === total - 1}>
          <ChevronRight className="h-5 w-5" />
        </Button>
        <span className="text-xs text-white/40 ml-4 hidden sm:inline">setas navegam · F tela cheia · Esc fecha</span>
      </div>
    </div>
  );
}

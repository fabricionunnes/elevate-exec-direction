// Deck de apresentação do onboarding: slides em 16:9 com a marca UNV, tela
// cheia de verdade (Fullscreen API), transição animada, profundidade 3D nos
// cards e gráficos (trilha das fases, anel de progresso, barras das métricas).
// Navegação: setas/espaço/clique, Esc sai.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";

const NAVY = "#0D2B5E";
const NAVY_DEEP = "#071A3C";
const RED = "#CC1B1B";
const LOGO = "/images/unv-logo.png";
const LOGO_WHITE = "/images/unv-logo-white.png";

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

/* animações reutilizadas */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};
const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60, scale: 0.98, transition: { duration: 0.3 } }),
};

/** fundo navy com brilho e grade — dá profundidade sem pesar */
const DarkBg = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-full w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 55%, #123karma 100%)`.replace("#123karma", "#12386F") }}>
    <div className="absolute -top-1/3 -right-1/4 h-[70%] w-[55%] rounded-full opacity-25 blur-3xl"
      style={{ background: `radial-gradient(circle, ${RED} 0%, transparent 70%)` }} />
    <div className="absolute -bottom-1/3 -left-1/5 h-[60%] w-[45%] rounded-full opacity-20 blur-3xl"
      style={{ background: "radial-gradient(circle, #3B7DD8 0%, transparent 70%)" }} />
    <div className="absolute inset-0 opacity-[0.07]"
      style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
    <div className="relative h-full w-full">{children}</div>
  </div>
);

/** anel de progresso (fase X de N) */
const Ring = ({ atual, total }: { atual: number; total: number }) => {
  const r = 26, c = 2 * Math.PI * r, pct = atual / total;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#E6EAF2" strokeWidth="6" />
      <motion.circle
        cx="34" cy="34" r={r} fill="none" stroke={RED} strokeWidth="6" strokeLinecap="round"
        transform="rotate(-90 34 34)" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      />
      <text x="34" y="38" textAnchor="middle" fontSize="18" fontWeight="800" fill={NAVY}>{atual}</text>
    </svg>
  );
};

/** card com profundidade — leve rotação 3D na entrada */
const Card3D = ({ children, delay = 0, tint = "light" }: { children: React.ReactNode; delay?: number; tint?: "light" | "red" }) => (
  <motion.div
    initial={{ opacity: 0, y: 28, rotateX: 8 }}
    animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    style={{ transformStyle: "preserve-3d", perspective: 1000 }}
    className={`rounded-2xl p-[clamp(14px,2.2vh,26px)] ${tint === "red" ? "bg-red-50/70" : "bg-slate-50"}`}
  >
    <div style={{ boxShadow: "0 18px 40px -24px rgba(13,43,94,.45)" }} className="rounded-2xl">{children}</div>
  </motion.div>
);

export function OnboardingDeck({ plan, companyName, onClose }: {
  plan: DeckPlan; companyName?: string; onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const temFinal = !!(plan.success_metrics?.length || plan.expectations?.unv?.length || plan.expectations?.cliente?.length);
  const total = 2 + plan.phases.length + (temFinal ? 1 : 0) + 1;

  const go = useCallback((d: number) => {
    setDir(d);
    setI((x) => Math.min(Math.max(x + d, 0), total - 1));
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
      else if (e.key.toLowerCase() === "f") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [go, onClose]);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { /* navegador pode bloquear sem gesto do usuário */ }
  };

  const rodape = (n: number) => (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-[6%] py-[1.6vh] border-t border-slate-100 bg-white/80 backdrop-blur">
      <span className="text-[clamp(9px,1.2vh,12px)] text-slate-400 truncate max-w-[40%]">{companyName}</span>
      <span className="text-[clamp(9px,1.2vh,12px)] text-slate-400 tabular-nums">{n} / {total - 1}</span>
      <img src={LOGO} alt="UNV" className="h-[clamp(16px,2.6vh,26px)] w-auto object-contain" />
    </div>
  );

  const slides: React.ReactNode[] = useMemo(() => {
    const out: React.ReactNode[] = [];

    // 1. capa
    out.push(
      <DarkBg key="capa">
        <div className="h-full w-full flex flex-col justify-center px-[8%]">
          <motion.img src={LOGO_WHITE} alt="UNV" custom={0} variants={fadeUp} initial="hidden" animate="show"
            className="h-[clamp(48px,11vh,110px)] w-auto object-contain self-start mb-[5vh] drop-shadow-2xl" />
          {plan.subtitle && (
            <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show"
              className="text-[clamp(10px,1.6vh,16px)] font-bold uppercase tracking-[0.35em] text-red-300 mb-[2vh]">
              {plan.subtitle}
            </motion.p>
          )}
          <motion.h1 custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="text-[clamp(28px,6.4vh,64px)] font-black text-white leading-[1.05] max-w-[80%]">
            {plan.title}
          </motion.h1>
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="mt-[3vh] flex items-center gap-4">
            <span className="h-1 w-[clamp(40px,6vw,90px)] rounded-full" style={{ background: RED }} />
            <p className="text-[clamp(12px,2vh,20px)] text-slate-300">Plano de trabalho e caminho para o resultado</p>
          </motion.div>
        </div>
      </DarkBg>
    );

    // 2. o caminho (trilha animada)
    out.push(
      <div key="caminho" className="h-full w-full bg-white px-[6%] pt-[6vh] pb-[10vh] flex flex-col">
        <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="text-[clamp(9px,1.4vh,13px)] font-bold uppercase tracking-[0.3em]" style={{ color: RED }}>
          O que vamos construir juntos
        </motion.p>
        <motion.h2 custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="text-[clamp(24px,5vh,52px)] font-black mt-[1vh]" style={{ color: NAVY }}>O caminho</motion.h2>
        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="mt-[3vh] text-[clamp(13px,2.3vh,24px)] leading-relaxed text-slate-800 max-w-[85%]">
          {plan.intro}
        </motion.p>
        <div className="mt-auto flex items-start gap-1">
          {plan.phases.map((ph, x) => (
            <motion.div key={x} className="flex-1 min-w-0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + x * 0.13, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center gap-2">
                <div className="h-[clamp(24px,4vh,40px)] w-[clamp(24px,4vh,40px)] rounded-full flex items-center justify-center text-[clamp(10px,1.7vh,16px)] font-black text-white shrink-0"
                  style={{ background: x === 0 ? RED : NAVY, boxShadow: `0 8px 20px -8px ${x === 0 ? RED : NAVY}` }}>{x + 1}</div>
                {x < plan.phases.length - 1 && (
                  <motion.div className="h-[3px] flex-1 rounded-full origin-left" style={{ background: "#DDE3EC" }}
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.6 + x * 0.13, duration: 0.4 }} />
                )}
              </div>
              <p className="text-[clamp(9px,1.5vh,14px)] font-bold mt-[1.2vh] pr-3 leading-tight" style={{ color: NAVY }}>{ph.title}</p>
              {ph.period && <p className="text-[clamp(8px,1.2vh,12px)] text-slate-400 pr-3">{ph.period}</p>}
            </motion.div>
          ))}
        </div>
        {rodape(1)}
      </div>
    );

    // 3. uma fase por slide
    plan.phases.forEach((ph, x) => {
      out.push(
        <div key={`f${x}`} className="h-full w-full bg-white px-[6%] pt-[5vh] pb-[9vh] flex flex-col">
          <div className="flex items-center gap-[2vw]">
            <Ring atual={x + 1} total={plan.phases.length} />
            <div className="min-w-0">
              <motion.h2 custom={0} variants={fadeUp} initial="hidden" animate="show"
                className="text-[clamp(20px,4.4vh,46px)] font-black leading-tight" style={{ color: NAVY }}>{ph.title}</motion.h2>
              {ph.period && (
                <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show"
                  className="text-[clamp(10px,1.7vh,17px)] text-slate-500">{ph.period}</motion.p>
              )}
            </div>
          </div>
          {ph.objective && (
            <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show"
              className="mt-[2.5vh] text-[clamp(12px,2.1vh,22px)] text-slate-800 max-w-[88%]">{ph.objective}</motion.p>
          )}
          <div className="mt-[2.5vh] grid gap-[2vw] sm:grid-cols-2 flex-1 min-h-0">
            {!!(ph.deliverables || []).filter(Boolean).length && (
              <Card3D delay={0.25}>
                <p className="text-[clamp(9px,1.3vh,13px)] font-bold uppercase tracking-wider mb-[1.6vh]" style={{ color: NAVY }}>A UNV entrega</p>
                <ul className="space-y-[1.2vh]">
                  {ph.deliverables.filter(Boolean).map((d, y) => (
                    <motion.li key={y} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + y * 0.09, duration: 0.4 }}
                      className="flex gap-3 text-[clamp(11px,1.9vh,19px)] text-slate-800 leading-snug">
                      <span className="mt-[0.9vh] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: NAVY }} />{d}
                    </motion.li>
                  ))}
                </ul>
              </Card3D>
            )}
            {!!(ph.client_actions || []).filter(Boolean).length && (
              <Card3D delay={0.35} tint="red">
                <p className="text-[clamp(9px,1.3vh,13px)] font-bold uppercase tracking-wider mb-[1.6vh]" style={{ color: RED }}>O que precisamos de você</p>
                <ul className="space-y-[1.2vh]">
                  {ph.client_actions.filter(Boolean).map((d, y) => (
                    <motion.li key={y} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + y * 0.09, duration: 0.4 }}
                      className="flex gap-3 text-[clamp(11px,1.9vh,19px)] text-slate-800 leading-snug">
                      <span className="mt-[0.9vh] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: RED }} />{d}
                    </motion.li>
                  ))}
                </ul>
              </Card3D>
            )}
          </div>
          {ph.outcome && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5 }}
              className="mt-[2.2vh] rounded-xl px-[3%] py-[2vh] text-white"
              style={{ background: `linear-gradient(100deg, ${NAVY_DEEP}, ${NAVY})`, boxShadow: `0 22px 45px -28px ${NAVY}` }}>
              <span className="text-[clamp(8px,1.2vh,12px)] font-bold uppercase tracking-wider text-red-300 mr-3">No fim desta fase</span>
              <span className="text-[clamp(11px,1.9vh,19px)]">{ph.outcome}</span>
            </motion.div>
          )}
          {rodape(2 + x)}
        </div>
      );
    });

    // 4. métricas + combinado
    if (temFinal) {
      const metricas = plan.success_metrics || [];
      out.push(
        <div key="metricas" className="h-full w-full bg-white px-[6%] pt-[5vh] pb-[9vh] flex flex-col">
          <motion.p custom={0} variants={fadeUp} initial="hidden" animate="show"
            className="text-[clamp(9px,1.4vh,13px)] font-bold uppercase tracking-[0.3em]" style={{ color: RED }}>Como vamos medir</motion.p>
          <motion.h2 custom={1} variants={fadeUp} initial="hidden" animate="show"
            className="text-[clamp(22px,4.6vh,48px)] font-black mt-[1vh] mb-[3vh]" style={{ color: NAVY }}>Sucesso e combinado</motion.h2>
          <div className="grid gap-[3vw] sm:grid-cols-2 flex-1 min-h-0">
            {!!metricas.length && (
              <div className="space-y-[1.8vh]">
                {metricas.map((m, x) => (
                  <div key={x}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[clamp(11px,1.9vh,19px)] text-slate-800">{m.label}</span>
                      <span className="text-[clamp(11px,1.9vh,19px)] font-bold" style={{ color: RED }}>{m.target || "a definir no kick-off"}</span>
                    </div>
                    <div className="mt-[0.8vh] h-[6px] rounded-full bg-slate-100 overflow-hidden">
                      <motion.div className="h-full rounded-full origin-left"
                        style={{ background: `linear-gradient(90deg, ${NAVY}, ${RED})` }}
                        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3 + x * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-[2.5vh]">
              {!!plan.expectations?.unv?.filter(Boolean).length && (
                <Card3D delay={0.3}>
                  <p className="text-[clamp(9px,1.3vh,13px)] font-bold uppercase tracking-wider mb-[1.2vh]" style={{ color: NAVY }}>Da UNV</p>
                  <ul className="space-y-[1vh]">{plan.expectations.unv.filter(Boolean).map((e, x) => (
                    <li key={x} className="flex gap-3 text-[clamp(11px,1.8vh,18px)] text-slate-800"><span className="mt-[0.9vh] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: NAVY }} />{e}</li>))}
                  </ul>
                </Card3D>
              )}
              {!!plan.expectations?.cliente?.filter(Boolean).length && (
                <Card3D delay={0.42} tint="red">
                  <p className="text-[clamp(9px,1.3vh,13px)] font-bold uppercase tracking-wider mb-[1.2vh]" style={{ color: RED }}>De você</p>
                  <ul className="space-y-[1vh]">{plan.expectations.cliente.filter(Boolean).map((e, x) => (
                    <li key={x} className="flex gap-3 text-[clamp(11px,1.8vh,18px)] text-slate-800"><span className="mt-[0.9vh] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: RED }} />{e}</li>))}
                  </ul>
                </Card3D>
              )}
            </div>
          </div>
          {rodape(total - 2)}
        </div>
      );
    }

    // 5. fechamento
    out.push(
      <DarkBg key="fim">
        <div className="h-full w-full flex flex-col items-center justify-center">
          <motion.img src={LOGO_WHITE} alt="UNV" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-[clamp(54px,13vh,130px)] w-auto object-contain mb-[4vh] drop-shadow-2xl" />
          <motion.p custom={1} variants={fadeUp} initial="hidden" animate="show"
            className="text-[clamp(24px,5.5vh,56px)] font-black text-white">Bora pra cima.</motion.p>
          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="show"
            className="mt-[1.5vh] text-[clamp(11px,1.9vh,19px)] text-slate-300">Universidade Nacional de Vendas</motion.p>
        </div>
      </DarkBg>
    );
    return out;
  }, [plan, companyName, total, temFinal]);

  return (
    <div ref={rootRef} className="fixed inset-0 z-[95] bg-black flex flex-col select-none">
      {/* progresso */}
      <div className="h-[3px] w-full bg-white/10 shrink-0">
        <motion.div className="h-full" style={{ background: RED }}
          animate={{ width: `${((i + 1) / total) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-[2vh]">
        <div className="w-full max-w-[1600px] aspect-video relative overflow-hidden rounded-lg shadow-2xl bg-white"
          style={{ perspective: 1600 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={i} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit"
              className="absolute inset-0">
              {slides[i]}
            </motion.div>
          </AnimatePresence>
          {/* zonas de clique */}
          <button className="absolute left-0 top-0 h-full w-[12%] cursor-w-resize" aria-label="anterior" onClick={() => go(-1)} />
          <button className="absolute right-0 top-0 h-full w-[12%] cursor-e-resize" aria-label="próximo" onClick={() => go(1)} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-[2vh] shrink-0">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(-1)} disabled={i === 0}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm text-white/80 tabular-nums w-16 text-center">{i + 1} / {total}</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(1)} disabled={i === total - 1}>
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 gap-1.5 ml-3" onClick={toggleFull}>
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} {full ? "Sair da tela cheia" : "Tela cheia (F)"}
        </Button>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 gap-1.5" onClick={onClose}>
          <X className="h-4 w-4" /> Fechar
        </Button>
      </div>
    </div>
  );
}

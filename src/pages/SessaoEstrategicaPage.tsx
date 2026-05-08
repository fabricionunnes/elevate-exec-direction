import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Target,
  TrendingUp,
  Users,
  Calendar,
  ClipboardCheck,
  LineChart,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Star,
  MessageCircle,
  Lock,
  AlertTriangle,
} from "lucide-react";
import fabricioHero from "@/assets/fabricio-hero.webp";
import fabricioMentor from "@/assets/fabricio-mentor.webp";

const FORM_TOKEN = "b4116f2e0b338035238f5750a7436135";

const howItWorks = [
  {
    icon: ClipboardCheck,
    num: "01",
    title: "Diagnóstico do seu comercial",
    desc: "Mapeamos time, processo, metas e gargalos em uma sessão estratégica gratuita.",
  },
  {
    icon: Calendar,
    num: "02",
    title: "Treinamento e acompanhamento diário",
    desc: "Atuamos como seu Diretor Comercial: agenda de calls, ritmo de prospecção, scripts e cobrança de meta.",
  },
  {
    icon: LineChart,
    num: "03",
    title: "Vendedores batendo meta todo mês",
    desc: "Previsibilidade de faturamento com indicadores acompanhados semana a semana.",
  },
];

const painPoints = [
  { title: "Vendedor não bate meta", desc: "Resultado sobe e desce todo mês, sem previsibilidade" },
  { title: "Você está virando gerente de vendas", desc: "Sobra pra você cobrar, treinar e ainda vender" },
  { title: "Sem processo, sem ritmo", desc: "Não tem reunião de pipeline, script ou indicador rodando" },
  { title: "Leads chegando e sumindo", desc: "Investimento em marketing sem conversão no comercial" },
  { title: "Time desmotivado", desc: "Ninguém puxa o time, ninguém treina, ninguém cobra" },
  { title: "Faturamento estagnado", desc: "Empresa parou de crescer e você não sabe por onde começar" },
];

const testimonialVideos = [
  "Mw24mKQ30LI",
  "WjlTR6qDhlA",
  "pOUL5pil2kk",
  "r2XWLQlig30",
  "66pAUJmga0Q",
  "pVdibOvP7E0",
];

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function LazyYouTube({ videoId, title }: { videoId: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (loaded) {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setLoaded(true)}
      className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-white/5 group cursor-pointer"
      aria-label={`Reproduzir ${title}`}
    >
      <img src={thumbUrl} alt={title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 via-black/20 to-transparent">
        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 group-hover:scale-110 transition-transform">
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </div>
    </button>
  );
}

const WHATSAPP_URL = `https://wa.me/5531984935274?text=${encodeURIComponent("Olá, vi o anúncio e quero o Fabricio Nunnes como meu Diretor Comercial para fazer meu time bater meta")}`;

const SessaoEstrategicaPage = () => {
  const [searchParams] = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openPopup = () => setShowPopup(true);

  // SEO
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Diretor Comercial dedicado para seu time bater meta | Fabricio Nunnes";

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    };
    setMeta("description", "Tenha um Diretor Comercial dedicado treinando e acompanhando seu time todos os dias para bater meta de vendas todo mês.");

    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Pixel - mais agressivamente adiado (após interação ou 4s)
  useEffect(() => {
    let loaded = false;
    const loadPixel = () => {
      if (loaded) return;
      loaded = true;
      const pixelId = "247392077001023";
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      (window as any).fbq("init", pixelId);
      (window as any).fbq("track", "PageView");
    };

    const timeout = setTimeout(loadPixel, 4000);
    const onInteract = () => loadPixel();
    window.addEventListener("scroll", onInteract, { once: true, passive: true });
    window.addEventListener("pointerdown", onInteract, { once: true });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("pointerdown", onInteract);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedNome = nome.trim();
    const trimmedEmail = email.trim();
    const cleanTelefone = telefone.trim();

    if (!trimmedNome || !cleanTelefone || !trimmedEmail) {
      setError("Preencha nome, WhatsApp e e-mail.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      (window as any).fbq?.("track", "Lead");
    } catch {}

    const params = new URLSearchParams({
      auto_submit: "1",
      nome: trimmedNome,
      telefone: cleanTelefone,
      email: trimmedEmail,
    });

    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "ad_name", "adset_name", "campaign_name"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });

    const targetUrl = `${window.location.origin}/#/form/${FORM_TOKEN}?${params.toString()}`;
    window.location.href = targetUrl;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden selection:bg-red-500/30 selection:text-white -mt-16 md:-mt-20 antialiased">
      {/* ── HERO ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden">
        {/* Background grid + glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(0,0,0,1),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute -top-32 -right-20 w-[480px] h-[480px] rounded-full bg-red-600/15 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-5 sm:px-8 pt-28 sm:pt-24 lg:pt-0 pb-32 lg:pb-0">
          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-center">
            {/* Copy */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-red-400 font-semibold bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5 backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                  Sessão estratégica gratuita · Vagas limitadas
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="font-serif text-[2rem] xs:text-[2.4rem] sm:text-5xl lg:text-[3.4rem] xl:text-6xl font-bold leading-[1.05] tracking-[-0.02em] text-white"
              >
                Tenha um{" "}
                <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-br from-red-400 via-red-500 to-orange-400">
                  Diretor Comercial
                </span>{" "}
                dedicado fazendo seu time{" "}
                <span className="italic text-red-400">bater meta todo mês.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="text-base sm:text-lg text-white/70 leading-relaxed max-w-lg"
              >
                Eu entro como <strong className="text-white font-semibold">seu Diretor Comercial</strong>, treino e acompanho seus vendedores <strong className="text-white font-semibold">todos os dias</strong> até a meta virar rotina — não exceção.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-white/80"
              >
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-400" /> Treinamento diário</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-400" /> Cobrança de meta</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-400" /> Processo comercial</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.24 }}
                className="space-y-3 pt-1"
              >
                <Button
                  onClick={openPopup}
                  className="group w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold text-sm sm:text-base px-8 py-7 rounded-2xl shadow-[0_20px_60px_-15px_rgba(239,68,68,0.5)] hover:shadow-[0_25px_70px_-15px_rgba(239,68,68,0.7)] hover:-translate-y-0.5 transition-all duration-300 ring-1 ring-red-400/30"
                >
                  <span className="flex items-center gap-2">
                    QUERO MEU DIRETOR COMERCIAL
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>

                <div className="flex items-center gap-4 text-[11px] sm:text-xs text-white/50">
                  <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Sem compromisso</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-emerald-400" /> Resposta em até 24h</span>
                </div>
              </motion.div>

              {/* PROVA SOCIAL */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.32 }}
                className="pt-6 mt-2 border-t border-white/10"
              >
                <div className="grid grid-cols-3 divide-x divide-white/10">
                  {[
                    { v: "+1 Bi", l: "em vendas" },
                    { v: "+500", l: "empresas" },
                    { v: "+20 anos", l: "no comercial" },
                  ].map((s, i) => (
                    <div key={s.l} className={`${i === 0 ? "pr-3" : i === 2 ? "pl-3" : "px-3"} text-center sm:text-left`}>
                      <div className="font-serif text-xl sm:text-2xl font-bold text-white leading-none tracking-tight">{s.v}</div>
                      <div className="text-[10px] sm:text-[11px] text-white/50 mt-1.5 uppercase tracking-[0.15em]">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-xs text-white/50">4,9/5 · centenas de empresas atendidas</span>
                </div>
              </motion.div>
            </div>

            {/* Image */}
            <div className="hidden lg:flex justify-center items-end">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute -inset-6 bg-gradient-to-br from-red-500/30 via-orange-500/10 to-transparent rounded-[2.5rem] blur-2xl" />
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/0 backdrop-blur-sm border border-white/10 -rotate-3" />
                <img
                  src={fabricioHero}
                  alt="Fabrício Nunnes - Diretor Comercial"
                  className="relative z-10 w-auto max-w-[400px] xl:max-w-[440px] h-auto max-h-[520px] object-contain rounded-3xl"
                  loading="eager"
                  fetchPriority="high"
                  width={440}
                  height={520}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#0a0a0b] border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.06),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.25em] text-red-400 font-semibold mb-3">Como funciona</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight text-white">
              Direção comercial em <span className="italic text-red-400">3 passos</span>
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
            {howItWorks.map((step) => (
              <AnimatedSection key={step.num}>
                <div className="relative h-full p-7 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-red-500/30 hover:from-white/[0.06] transition-all duration-500 group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:border-red-400 transition-all duration-500">
                      <step.icon className="h-5 w-5 text-red-400 group-hover:text-white transition-colors" strokeWidth={2} />
                    </div>
                    <span className="font-serif text-5xl font-bold text-white/5 group-hover:text-red-500/20 transition-colors">{step.num}</span>
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-white mb-2 leading-snug">{step.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{step.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-gradient-to-b from-[#0a0a0b] to-[#0f0f11] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.25em] text-red-400 font-semibold mb-3">Você se identifica?</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight text-white">
              Essa direção é para quem <span className="italic text-red-400">vive isso:</span>
            </h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <div className="h-full p-5 sm:p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-500/30 transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-serif text-base sm:text-lg font-bold text-white mb-1 leading-tight">{card.title}</h3>
                      <p className="text-xs sm:text-sm text-white/55 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="text-center mt-12 sm:mt-16">
            <p className="text-sm text-white/60 mb-5">
              Marcou <strong className="text-white font-semibold">2 ou mais</strong>? Sua sessão estratégica gratuita está esperando.
            </p>
            <Button
              onClick={openPopup}
              className="group w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold text-sm sm:text-base px-8 py-7 rounded-2xl shadow-[0_20px_50px_-12px_rgba(239,68,68,0.5)] hover:-translate-y-0.5 transition-all duration-300 ring-1 ring-red-400/30"
            >
              <span className="flex items-center justify-center gap-2">
                AGENDAR SESSÃO ESTRATÉGICA
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── MENTOR ── */}
      <section className="relative py-20 sm:py-28 px-5 sm:px-8 bg-[#0f0f11] border-t border-white/5 overflow-hidden">
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-red-600/10 blur-[120px]" />
        <div className="relative max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">
            <AnimatedSection className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-red-500/20 to-orange-500/10 rounded-[2.5rem] blur-2xl" />
                <div className="absolute inset-0 rounded-3xl border border-white/10 -rotate-3" />
                <img
                  src={fabricioMentor}
                  alt="Fabrício Nunnes - Diretor Comercial"
                  className="relative z-10 max-h-[440px] object-contain rounded-2xl"
                  loading="lazy"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection className="space-y-5 lg:order-1">
              <p className="text-xs uppercase tracking-[0.25em] text-red-400 font-semibold">Seu Diretor Comercial</p>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                Fabrício <span className="italic text-red-400">Nunnes</span>
              </h2>
              <div className="space-y-4 text-white/70 text-base leading-relaxed">
                <p>
                  Mais de <strong className="text-white font-semibold">20 anos dirigindo operações comerciais</strong> e mais de <strong className="text-white font-semibold">1 bilhão em vendas geradas</strong> para empresas que faturam de 6 a 7 dígitos por mês.
                </p>
                <p>
                  Não é mentoria solta. É <strong className="text-white font-semibold">direção comercial executiva:</strong> entro no seu time, monto o processo, treino diariamente e cobro a meta como se fosse meu próprio CNPJ.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { icon: TrendingUp, v: "+1 Bi", l: "vendas" },
                  { icon: Users, v: "+500", l: "empresas" },
                  { icon: Target, v: "+20", l: "anos" },
                ].map((b) => (
                  <div key={b.l} className="text-center p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <b.icon className="h-4 w-4 text-red-400 mx-auto mb-2" />
                    <div className="font-serif text-base font-bold text-white">{b.v}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{b.l}</div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-[#0a0a0b] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.25em] text-red-400 font-semibold mb-3">Quem já é dirigido</p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight text-white">
              Empresas que pararam de <span className="italic text-red-400">depender da sorte</span>
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {testimonialVideos.map((videoId, i) => (
              <AnimatedSection key={videoId}>
                <LazyYouTube videoId={videoId} title={`Depoimento ${i + 1}`} />
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── GARANTIA + ESCASSEZ ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-[#0f0f11] border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
              <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border border-emerald-500/20">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mb-3">Garantia da sessão</h3>
                <p className="text-sm sm:text-base text-white/65 leading-relaxed">
                  Se ao final da sessão estratégica você não sair com <strong className="text-white">clareza absoluta</strong> dos 3 gargalos do seu comercial e o caminho pra resolver, a conversa não custa nada — e nunca custou.
                </p>
              </div>
              <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02] border border-red-500/20">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-5">
                  <Lock className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mb-3">Vagas limitadas</h3>
                <p className="text-sm sm:text-base text-white/65 leading-relaxed">
                  Atendo pessoalmente apenas <strong className="text-white">poucas empresas por mês</strong> como Diretor Comercial. As sessões gratuitas são o filtro — e elas se esgotam rápido.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-20 sm:py-32 px-5 sm:px-8 bg-[#0a0a0b] border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15),transparent_60%)]" />
        <AnimatedSection className="relative max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.18em] text-red-400 font-semibold bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Últimas vagas do mês
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-white">
            Pare de carregar o comercial <span className="italic text-red-400">sozinho.</span>
          </h2>
          <p className="text-white/65 text-base sm:text-lg max-w-lg mx-auto">
            Agende agora sua sessão estratégica e descubra como ter um Diretor Comercial dedicado treinando seu time todos os dias.
          </p>
          <Button
            onClick={openPopup}
            className="group bg-red-600 hover:bg-red-500 text-white font-bold text-sm sm:text-base px-8 sm:px-10 py-7 rounded-2xl shadow-[0_25px_70px_-15px_rgba(239,68,68,0.6)] hover:-translate-y-0.5 transition-all duration-300 ring-1 ring-red-400/30"
          >
            <span className="flex items-center gap-2">
              QUERO MEU DIRETOR COMERCIAL
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <div className="flex items-center justify-center gap-5 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Sem compromisso</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 100% gratuito</span>
          </div>
        </AnimatedSection>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 bg-black text-center text-xs text-white/40 px-5 border-t border-white/5">
        Todos os direitos reservados · Universidade Nacional de Vendas LTDA
      </footer>

      {/* ── STICKY MOBILE CTA BAR ── */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/95 to-[#0a0a0b]/0 pt-6 pb-3 px-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={openPopup}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-sm py-6 rounded-2xl shadow-[0_15px_40px_-10px_rgba(239,68,68,0.6)] ring-1 ring-red-400/30"
          >
            QUERO MEU DIRETOR
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            className="flex-shrink-0 w-14 h-14 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl shadow-[0_15px_40px_-10px_rgba(16,185,129,0.5)] transition-colors"
          >
            <MessageCircle className="h-6 w-6" />
          </a>
        </div>
      </div>

      {/* ── FLOATING WHATSAPP (desktop only) ── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden lg:flex fixed bottom-6 right-6 z-50 items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-[0_15px_40px_-10px_rgba(16,185,129,0.5)] transition-all duration-300"
      >
        <MessageCircle className="h-5 w-5" />
        <span>Falar comigo</span>
      </a>

      {/* ── POPUP FORM ── */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-[#111114] border-white/10 text-white rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold text-center text-white">
              Agende sua sessão estratégica
            </DialogTitle>
            <p className="text-sm text-center text-white/60 mt-1">É gratuito. Vou avaliar pessoalmente seu cenário comercial.</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="popup-nome" className="text-white/70 text-sm font-medium">Nome completo *</Label>
              <Input
                id="popup-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                maxLength={200}
                placeholder="Seu nome"
                autoComplete="name"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-telefone" className="text-white/70 text-sm font-medium">WhatsApp com DDD *</Label>
              <PhoneInput
                id="popup-telefone"
                value={telefone}
                onChange={setTelefone}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-email" className="text-white/70 text-sm font-medium">E-mail *</Label>
              <Input
                id="popup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="seu@email.com"
                autoComplete="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-6 text-base rounded-xl shadow-[0_15px_40px_-10px_rgba(239,68,68,0.5)] ring-1 ring-red-400/30 transition-all duration-300"
            >
              {submitting ? "ENVIANDO..." : "QUERO MINHA SESSÃO"}
            </Button>

            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-white/40">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-emerald-400" /> Seus dados protegidos</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> 100% gratuito</span>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessaoEstrategicaPage;

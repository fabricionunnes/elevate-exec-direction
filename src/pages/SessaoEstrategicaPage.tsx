import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useInView, LazyMotion, domAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  Target,
  TrendingUp,
  Users,
  BarChart3,
  Zap,
  Award,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Star,
  MessageCircle,
} from "lucide-react";
import fabricioHero from "@/assets/fabricio-hero.png";
import fabricioMentor from "@/assets/fabricio-mentor.png";

const FORM_TOKEN = "b4116f2e0b338035238f5750a7436135";

const painPoints = [
  { icon: Target, title: "Time sem bater metas", desc: "Vendedores que não entregam resultados consistentes mês a mês" },
  { icon: TrendingUp, title: "Faturamento estagnado", desc: "Sem processo comercial estruturado para escalar" },
  { icon: Users, title: "Equipe desmotivada", desc: "Vendedores sem direção e sem resultados" },
  { icon: BarChart3, title: "Leads desperdiçados", desc: "Investimento em marketing sem conversão" },
  { icon: Zap, title: "Urgência em resultados", desc: "Precisa acelerar o faturamento agora" },
  { icon: Award, title: "Falta de alta performance", desc: "Quer vendedores que realmente entregam" },
];

const stats = [
  { display: "+1 Bi", label: "em vendas geradas", icon: TrendingUp },
  { display: "+20", label: "anos de experiência", icon: Clock },
  { display: "+500", label: "empresas atendidas", icon: Star },
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
      initial={{ opacity: 0, y: 30 }}
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
      <img src={thumbUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div className="w-14 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </button>
  );
}
const WHATSAPP_URL = `https://wa.me/5531984935274?text=${encodeURIComponent("Olá, tenho uma empresa, vi seu anúncio e quero saber mais sobre como ter o Fabricio Nunnes como meu diretor comercial")}`;

const SessaoEstrategicaPage = () => {
  const [searchParams] = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openPopup = () => setShowPopup(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
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

      const noscript = document.createElement("noscript");
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
      noscript.appendChild(img);
      document.body.appendChild(noscript);
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedNome = nome.trim();
    const trimmedEmail = email.trim();
    const cleanTelefone = telefone.trim();

    if (!trimmedNome || !cleanTelefone || !trimmedEmail) {
      setError("Preencha nome, WhatsApp e e-mail.");
      return;
    }

    setError(null);

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

    setShowPopup(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-red-500/20 -mt-16 md:-mt-20">
      {/* ── HERO ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-red-50/40">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-red-500/[0.03] to-orange-500/[0.02] rounded-full blur-[150px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Copy */}
            <div className="pt-24 sm:pt-20 lg:pt-0 pb-8 lg:pb-0 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-[0.15em] text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Vagas limitadas · 100% gratuito
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="text-[1.75rem] sm:text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight"
              >
                <span className="text-slate-900">Seu time de vendas</span>
                <br />
                <span className="text-red-600">não bate metas?</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-md"
              >
                Descubra <strong className="text-slate-900">o que está travando seu faturamento</strong> e receba um plano prático para{" "}
                <strong className="text-slate-900">vender mais ainda este mês.</strong>
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.22 }}
                className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-md"
              >
                Nosso time vai analisar sua operação comercial, identificar os gargalos e criar um{" "}
                <strong className="text-slate-800">plano de ação personalizado</strong> para aumentar suas vendas de forma consistente.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-600"
              >
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Diagnóstico completo</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Plano de ação</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Previsão de faturamento</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.28 }}
                className="space-y-3 pt-1"
              >
                <Button
                  onClick={openPopup}
                  className="group w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-2xl shadow-xl shadow-red-500/25 hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-300"
                >
                  <span className="flex items-center gap-2">
                    QUERO MINHA ANÁLISE GRATUITA
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>

                <div className="flex items-center gap-4 text-[11px] sm:text-xs text-slate-400">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-500" /> Sem compromisso</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-green-500" /> Resposta em 24h</span>
                </div>
              </motion.div>
            </div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="hidden lg:flex justify-center items-end"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-red-100/60 to-orange-50/40 rounded-[2rem] -rotate-2" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-16 bg-red-500/[0.08] blur-[40px] rounded-full" />
                <img
                  src={fabricioHero}
                  alt="Fabrício Nunnes - Mentor de Vendas"
                  className="relative z-10 w-auto max-w-[380px] xl:max-w-[420px] h-auto max-h-[480px] object-contain rounded-3xl"
                  loading="eager"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 48L1440 48L1440 0C1440 0 1080 36 720 36C360 36 0 0 0 0L0 48Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-slate-50 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-8">
            {stats.map((stat, i) => (
              <AnimatedSection key={i}>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-50 mb-2">
                    <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                  </div>
                  <div className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                    {stat.display}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-10 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold mb-2">Você se identifica?</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
              Essa análise é para quem:
            </h2>
          </AnimatedSection>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 sm:p-6 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md hover:border-red-100 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-3">
                    <card.icon className="h-5 w-5 text-red-500" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">{card.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="text-center mt-10 sm:mt-14">
            <p className="text-sm text-slate-500 mb-4">
              Se você marcou <strong className="text-slate-900">pelo menos 2 desses itens</strong>, essa análise foi feita pra você.
            </p>
            <Button
              onClick={openPopup}
              className="group w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300"
            >
              <span className="flex items-center justify-center gap-2">
                AGENDAR MINHA ANÁLISE GRATUITA
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── O QUE VOCÊ RECEBE ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-gradient-to-br from-slate-50 to-red-50/30">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold mb-2">Na análise você recebe</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
              Um plano completo para{" "}
              <span className="text-red-600">vender mais</span>
            </h2>
          </AnimatedSection>

          <div className="space-y-3 sm:space-y-4">
            {[
              { num: "01", title: "Diagnóstico do seu time", desc: "Identificamos exatamente onde estão os gargalos de vendas" },
              { num: "02", title: "Plano de ação personalizado", desc: "Estratégia prática e aplicável para o seu cenário específico" },
              { num: "03", title: "Previsão de faturamento", desc: "Quanto você pode vender nos próximos 30, 60 e 90 dias" },
            ].map((item, i) => (
              <AnimatedSection key={i}>
                <div className="flex gap-4 sm:gap-5 items-start p-5 sm:p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <span className="text-white font-black text-sm sm:text-base">{item.num}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── MENTOR ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <AnimatedSection className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl -rotate-2 scale-105" />
                <img
                  src={fabricioMentor}
                  alt="Fabrício Nunnes"
                  className="relative z-10 max-h-[400px] object-contain rounded-2xl"
                  loading="lazy"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection className="space-y-4 lg:order-1">
              <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold">Quem vai analisar sua operação?</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
                Fabrício <span className="text-red-600">Nunnes</span>
              </h2>
              <div className="space-y-3 text-slate-500 text-sm sm:text-base leading-relaxed">
                <p>
                  Diretor comercial com <strong className="text-slate-900">mais de 20 anos de experiência</strong> e{" "}
                  <strong className="text-slate-900">mais de 1 bilhão em vendas realizadas.</strong>
                </p>
                <p>
                  Atende empresas que faturam de <strong className="text-slate-900">6 a 7 dígitos por mês</strong>, ajudando a estruturar processos comerciais que geram resultados previsíveis.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {["+1 Bi em vendas", "+20 anos", "+500 empresas"].map((badge) => (
                  <span key={badge} className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
                    {badge}
                  </span>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-red-400 font-bold mb-2">Prova social</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
              Quem já fez, <span className="text-red-400">recomenda</span>
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

      {/* ── FINAL CTA ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-gradient-to-br from-white via-red-50/30 to-orange-50/20">
        <AnimatedSection className="max-w-xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Últimas vagas disponíveis
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
            Não espere mais para{" "}
            <span className="text-red-600">vender mais.</span>
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            Agende agora sua análise gratuita e receba um plano personalizado.
          </p>
          <Button
            onClick={openPopup}
            className="group bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-2xl shadow-xl shadow-red-500/25 hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-300"
          >
            <span className="flex items-center gap-2">
              AGENDAR ANÁLISE GRATUITA
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-500" /> Sem compromisso</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> 100% gratuito</span>
          </div>
        </AnimatedSection>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-6 bg-slate-900 text-center text-xs text-slate-500 px-5">
        Todos os direitos reservados · Universidade Nacional de Vendas LTDA
      </footer>

      {/* ── FLOATING WHATSAPP ── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300 animate-bounce hover:animate-none"
        style={{ animationDuration: '2s', animationIterationCount: 3 }}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Falar comigo</span>
      </a>

      {/* ── POPUP FORM ── */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-slate-900">
              Agende sua análise gratuita
            </DialogTitle>
            <p className="text-sm text-center text-slate-400 mt-1">Preencha abaixo e o formulário abrirá imediatamente</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="popup-nome" className="text-slate-600 text-sm font-medium">Nome completo *</Label>
              <Input
                id="popup-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                maxLength={200}
                placeholder="Seu nome"
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-telefone" className="text-slate-600 text-sm font-medium">WhatsApp com DDD *</Label>
              <PhoneInput
                id="popup-telefone"
                value={telefone}
                onChange={setTelefone}
                required
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="popup-email" className="text-slate-600 text-sm font-medium">E-mail *</Label>
              <Input
                id="popup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="seu@email.com"
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-red-500/20 transition-all duration-300"
            >
              CONTINUAR
            </Button>

            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> 100% gratuito</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Sem compromisso</span>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessaoEstrategicaPage;

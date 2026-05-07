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
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-red-500/20 -mt-16 md:-mt-20">
      {/* ── HERO ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-red-50/40">
        {/* Decorative blob (apenas 1 leve) */}
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-red-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Copy */}
            <div className="pt-24 sm:pt-20 lg:pt-0 pb-8 lg:pb-0 space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-[0.15em] text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Sessão estratégica gratuita · Vagas limitadas
                </span>
              </div>

              <h1 className="text-[1.75rem] sm:text-4xl lg:text-[2.85rem] font-black leading-[1.15] sm:leading-[1.12] tracking-[-0.01em]">
                <span className="text-slate-900">Tenha um </span>
                <span className="text-red-600">Diretor Comercial</span>
                <span className="text-slate-900"> dedicado fazendo seu time </span>
                <span className="text-red-600">bater meta todo mês.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-md">
                Eu entro como <strong className="text-slate-900">seu Diretor Comercial</strong>, treino e acompanho seus vendedores <strong className="text-slate-900">todos os dias</strong> até a meta virar rotina — não exceção.
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-700">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Treinamento diário</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Cobrança de meta</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-red-500" /> Processo comercial</span>
              </div>

              <div className="space-y-3 pt-1">
                <Button
                  onClick={openPopup}
                  className="group w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-2xl shadow-xl shadow-red-500/25 hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-300"
                >
                  <span className="flex items-center gap-2">
                    QUERO MEU DIRETOR COMERCIAL
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>

                <div className="flex items-center gap-4 text-[11px] sm:text-xs text-slate-500">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Sem compromisso</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-green-600" /> Resposta em até 24h</span>
                </div>
              </div>

              {/* PROVA SOCIAL ACIMA DA DOBRA */}
              <div className="pt-5 mt-2 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {[
                    { v: "+1 Bi", l: "em vendas" },
                    { v: "+500", l: "empresas" },
                    { v: "+20 anos", l: "no comercial" },
                  ].map((s) => (
                    <div key={s.l} className="text-center sm:text-left">
                      <div className="text-base sm:text-xl font-black text-slate-900 leading-none">{s.v}</div>
                      <div className="text-[10px] sm:text-xs text-slate-500 mt-1 uppercase tracking-wider">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">4,9/5 · centenas de empresas atendidas</span>
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="hidden lg:flex justify-center items-end">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-red-100/60 to-orange-50/40 rounded-[2rem] -rotate-2" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-16 bg-red-500/[0.08] blur-[40px] rounded-full" />
                <img
                  src={fabricioHero}
                  alt="Fabrício Nunnes - Diretor Comercial"
                  className="relative z-10 w-auto max-w-[380px] xl:max-w-[420px] h-auto max-h-[480px] object-contain rounded-3xl"
                  loading="eager"
                  fetchPriority="high"
                  width={420}
                  height={480}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" aria-hidden="true">
            <path d="M0 48L1440 48L1440 0C1440 0 1080 36 720 36C360 36 0 0 0 0L0 48Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="bg-slate-50 py-16 sm:py-20 px-5 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold mb-2">Como funciona</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
              Direção comercial em <span className="text-red-600">3 passos</span>
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {howItWorks.map((step) => (
              <AnimatedSection key={step.num}>
                <div className="relative h-full p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="absolute -top-3 left-6 text-xs font-black text-red-600 bg-white border border-red-100 rounded-full px-3 py-1">
                    PASSO {step.num}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4 mt-2">
                    <step.icon className="h-6 w-6 text-white" strokeWidth={2} />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold mb-2">Você se identifica?</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
              Essa direção é para quem vive isso:
            </h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <div className="p-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md hover:border-red-100 transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center mt-0.5">
                      <span className="text-red-600 font-black text-xs">✓</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">{card.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="text-center mt-10 sm:mt-14">
            <p className="text-sm text-slate-500 mb-4">
              Marcou <strong className="text-slate-900">2 ou mais</strong>? Sua sessão estratégica gratuita está esperando.
            </p>
            <Button
              onClick={openPopup}
              className="group w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300"
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
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-gradient-to-br from-slate-50 to-red-50/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <AnimatedSection className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl -rotate-2 scale-105" />
                <img
                  src={fabricioMentor}
                  alt="Fabrício Nunnes - Diretor Comercial"
                  className="relative z-10 max-h-[400px] object-contain rounded-2xl"
                  loading="lazy"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection className="space-y-4 lg:order-1">
              <p className="text-xs uppercase tracking-[0.2em] text-red-500 font-bold">Seu Diretor Comercial</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
                Fabrício <span className="text-red-600">Nunnes</span>
              </h2>
              <div className="space-y-3 text-slate-600 text-sm sm:text-base leading-relaxed">
                <p>
                  Mais de <strong className="text-slate-900">20 anos dirigindo operações comerciais</strong> e mais de <strong className="text-slate-900">1 bilhão em vendas geradas</strong> para empresas que faturam de 6 a 7 dígitos por mês.
                </p>
                <p>
                  Não é mentoria solta. É <strong className="text-slate-900">direção comercial executiva:</strong> entro no seu time, monto o processo, treino diariamente e cobro a meta como se fosse meu próprio CNPJ.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { icon: TrendingUp, v: "+1 Bi", l: "vendas" },
                  { icon: Users, v: "+500", l: "empresas" },
                  { icon: Target, v: "+20", l: "anos" },
                ].map((b) => (
                  <div key={b.l} className="text-center p-3 rounded-xl bg-white border border-slate-100">
                    <b.icon className="h-4 w-4 text-red-500 mx-auto mb-1" />
                    <div className="text-sm font-black text-slate-900">{b.v}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{b.l}</div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-red-400 font-bold mb-2">Quem já é dirigido</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
              Empresas que pararam de <span className="text-red-400">depender da sorte</span>
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
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Garantia da sessão</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Se ao final da sessão estratégica você não sair com <strong>clareza absoluta</strong> dos 3 gargalos do seu comercial e o caminho pra resolver, a conversa não custa nada — e nunca custou.
                </p>
              </div>
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100">
                <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Vagas limitadas</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Atendo pessoalmente apenas <strong>poucas empresas por mês</strong> como Diretor Comercial. As sessões gratuitas são o filtro — e elas se esgotam rápido.
                </p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-gradient-to-br from-white via-red-50/30 to-orange-50/20">
        <AnimatedSection className="max-w-xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Últimas vagas do mês
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
            Pare de carregar o comercial <span className="text-red-600">sozinho.</span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Agende agora sua sessão estratégica e descubra como ter um Diretor Comercial dedicado treinando seu time todos os dias.
          </p>
          <Button
            onClick={openPopup}
            className="group bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-2xl shadow-xl shadow-red-500/25 hover:shadow-2xl hover:shadow-red-500/30 transition-all duration-300"
          >
            <span className="flex items-center gap-2">
              QUERO MEU DIRETOR COMERCIAL
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Falar comigo</span>
      </a>

      {/* ── POPUP FORM ── */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-slate-900">
              Agende sua sessão estratégica
            </DialogTitle>
            <p className="text-sm text-center text-slate-500 mt-1">É gratuito. Vou avaliar pessoalmente seu cenário comercial.</p>
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
                autoComplete="name"
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
                autoComplete="email"
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-12 rounded-xl focus:border-red-500 focus:ring-red-500/20"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-red-500/20 transition-all duration-300"
            >
              {submitting ? "ENVIANDO..." : "QUERO MINHA SESSÃO"}
            </Button>

            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3 text-green-500" /> Seus dados protegidos</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> 100% gratuito</span>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessaoEstrategicaPage;

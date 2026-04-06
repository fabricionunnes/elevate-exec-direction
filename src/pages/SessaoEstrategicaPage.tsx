import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useInView } from "framer-motion";
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
  ArrowDown,
  CheckCircle2,
} from "lucide-react";
import fabricioHero from "@/assets/fabricio-hero.png";
import fabricioMentor from "@/assets/fabricio-mentor.png";

const FORM_TOKEN = "b4116f2e0b338035238f5750a7436135";

const painPoints = [
  { icon: Target, title: "Metas de vendas", desc: "O time não bate as metas todos os meses" },
  { icon: TrendingUp, title: "Escalar vendas", desc: "Sem processo comercial estruturado" },
  { icon: Users, title: "Time desmotivado", desc: "Vendedores sem direção e sem resultados" },
  { icon: BarChart3, title: "Leads que não convertem", desc: "Marketing investe, vendas não fecham" },
  { icon: Zap, title: "Faturamento estagnado", desc: "Precisa acelerar ainda este mês" },
  { icon: Award, title: "Alta performance", desc: "Quer vendedores que realmente entregam" },
];

const stats = [
  { value: "R$ 1BI+", label: "em vendas geradas" },
  { value: "20+", label: "anos de experiência" },
  { value: "500+", label: "empresas atendidas" },
];

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ target, suffix = "" }: { target: string; suffix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const numMatch = target.match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : 0;
  const prefix = target.replace(/[\d.]+.*/, "");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const steps = 40;
    const increment = num / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= num) {
        setCount(num);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, num]);

  return (
    <span ref={ref}>
      {prefix}{isInView ? (num >= 100 ? count.toLocaleString("pt-BR") : count) : 0}{suffix}
    </span>
  );
}

const SessaoEstrategicaPage = () => {
  const [searchParams] = useSearchParams();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Meta Pixel
  useEffect(() => {
    const pixelId = "1854664928501352";
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
    return () => { noscript.remove(); };
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone || !email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-pipeline-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_token: FORM_TOKEN,
            nome: nome.trim(),
            telefone,
            email: email.trim(),
            utm_source: searchParams.get("utm_source") || undefined,
            utm_medium: searchParams.get("utm_medium") || undefined,
            utm_campaign: searchParams.get("utm_campaign") || undefined,
            utm_content: searchParams.get("utm_content") || undefined,
            fbclid: searchParams.get("fbclid") || undefined,
            ad_name: searchParams.get("ad_name") || undefined,
            adset_name: searchParams.get("adset_name") || undefined,
            campaign_name: searchParams.get("campaign_name") || undefined,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao enviar");

      const leadId = data.lead_id;
      window.location.hash = `/form/${FORM_TOKEN}?lead_id=${leadId}`;
    } catch (err: any) {
      setError(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden selection:bg-red-500/30">
      {/* ── Hero ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center px-5 sm:px-8 lg:px-12">
        {/* Subtle grain + glow */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left copy */}
            <div className="space-y-6 lg:space-y-8 pt-12 lg:pt-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.25em] text-red-400/80 font-semibold border border-red-500/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
                  Vagas limitadas · Análise gratuita
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.05] tracking-tight"
              >
                Seu time de vendas{" "}
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                    não bate metas?
                  </span>
                  <span className="absolute -bottom-1 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-transparent rounded-full" />
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-base sm:text-lg lg:text-xl text-neutral-400 leading-relaxed max-w-xl"
              >
                Agende uma <strong className="text-white">análise individual gratuita</strong> com a
                equipe do Fabrício Nunnes e descubra o que está travando o crescimento da sua empresa.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-start gap-4"
              >
                <Button
                  onClick={scrollToForm}
                  className="group relative bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(220,38,38,0.15)] hover:shadow-[0_0_60px_rgba(220,38,38,0.25)] transition-all duration-500 w-full sm:w-auto overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    QUERO MINHA ANÁLISE GRATUITA
                    <ArrowDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </Button>
                <span className="text-xs text-neutral-500 sm:pt-4">
                  <span className="line-through">R$ 297</span>{" "}
                  <span className="text-red-400 font-semibold">Grátis</span>
                </span>
              </motion.div>
            </div>

            {/* Right image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:flex justify-center items-end"
            >
              <div className="relative">
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-24 bg-red-600/[0.06] blur-[60px] rounded-full" />
                <img
                  src={fabricioHero}
                  alt="Fabrício Nunnes - Mentor de Vendas"
                  className="relative z-10 max-h-[560px] object-contain"
                  loading="eager"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-5 h-8 border-2 border-neutral-700 rounded-full flex justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 bg-neutral-500 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-neutral-800/60">
        <div className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {stats.map((stat, i) => (
              <AnimatedSection key={i}>
                <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                  <CountUp target={stat.value} suffix={stat.value.includes("+") ? "+" : ""} />
                </div>
                <p className="text-[11px] sm:text-sm text-neutral-500 mt-1 uppercase tracking-wider">{stat.label}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-14 sm:mb-20">
            <p className="text-xs uppercase tracking-[0.2em] text-red-400/70 font-medium mb-3">
              Você se identifica?
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold max-w-2xl mx-auto leading-tight">
              A análise é para empresários que vivem{" "}
              <span className="text-red-400">esses desafios</span>
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <motion.div
                  whileHover={{ y: -4, borderColor: "rgba(239,68,68,0.3)" }}
                  transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 rounded-2xl border border-neutral-800/40 bg-neutral-900/20 backdrop-blur-sm cursor-default"
                >
                  <card.icon className="h-7 w-7 text-red-500/80 mb-4" strokeWidth={1.5} />
                  <h3 className="text-base sm:text-lg font-semibold mb-1.5">{card.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{card.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Inline form ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8" ref={formRef}>
        <div className="max-w-lg mx-auto">
          <AnimatedSection>
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-red-400/70 font-medium mb-3">
                Inscrição gratuita
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Garanta sua análise agora</h2>
              <p className="text-sm text-neutral-500">
                Preencha seus dados abaixo e nossa equipe entrará em contato
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="form-nome" className="text-neutral-400 text-sm">
                  Nome completo *
                </Label>
                <Input
                  id="form-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Seu nome"
                  className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-red-500/50 focus:ring-red-500/20 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-telefone" className="text-neutral-400 text-sm">
                  WhatsApp com DDD *
                </Label>
                <PhoneInput
                  id="form-telefone"
                  value={telefone}
                  onChange={setTelefone}
                  required
                  className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-red-500/50 focus:ring-red-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-email" className="text-neutral-400 text-sm">
                  E-mail *
                </Label>
                <Input
                  id="form-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="seu@email.com"
                  className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-red-500/50 focus:ring-red-500/20 transition-colors"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-base rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.12)] hover:shadow-[0_0_40px_rgba(220,38,38,0.2)] transition-all duration-500 mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "QUERO MINHA ANÁLISE GRATUITA"
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-neutral-600">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> 100% gratuito
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Sem compromisso
                </span>
              </div>
            </form>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Mentor ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 border-t border-neutral-800/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <AnimatedSection className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[70%] h-20 bg-red-600/[0.05] blur-[50px] rounded-full" />
                <img
                  src={fabricioMentor}
                  alt="Fabrício Nunnes"
                  className="relative z-10 max-h-[460px] object-contain rounded-2xl"
                  loading="lazy"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection className="space-y-6 lg:order-1">
              <p className="text-xs uppercase tracking-[0.2em] text-red-400/70 font-medium">
                Sobre o mentor
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                Fabrício <span className="text-red-400">Nunnes</span>
              </h2>
              <div className="space-y-4 text-neutral-400 text-sm sm:text-base leading-relaxed">
                <p>
                  Empresário, mentor e diretor de vendas. Criador da{" "}
                  <strong className="text-white">Universidade Nacional de Vendas</strong>. Com mais de 20
                  anos de experiência e uma década como diretor comercial, atende empresas que{" "}
                  <strong className="text-white">faturam entre 6 a 7 dígitos todos os meses.</strong>
                </p>
                <p>
                  Alcançou a marca de{" "}
                  <strong className="text-white">mais de 1 bilhão em vendas</strong> de serviços e
                  produtos. Focado em empresários de pequenas e médias empresas que desejam escalar.
                </p>
                <p>
                  Sua missão: fazer cada empresário{" "}
                  <strong className="text-white">alcançar metas regularmente</strong>, aumentar o
                  faturamento e construir um negócio{" "}
                  <strong className="text-white">autogerenciável</strong> com{" "}
                  <strong className="text-white">resultados exponenciais.</strong>
                </p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8">
        <AnimatedSection className="max-w-2xl mx-auto text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
            Não deixe seu faturamento{" "}
            <span className="text-red-400">estagnado</span>
          </h2>
          <p className="text-neutral-500 text-sm sm:text-base max-w-lg mx-auto">
            Empresários que passaram pela análise estratégica já estão colhendo resultados.
            A próxima vaga pode ser sua.
          </p>
          <Button
            onClick={scrollToForm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base px-10 py-6 rounded-xl shadow-[0_0_40px_rgba(220,38,38,0.12)] hover:shadow-[0_0_60px_rgba(220,38,38,0.2)] transition-all duration-500"
          >
            FAZER INSCRIÇÃO GRATUITA
          </Button>
        </AnimatedSection>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-neutral-800/40 text-center text-xs text-neutral-600 px-5">
        Todos os direitos reservados · Universidade Nacional de Vendas LTDA
      </footer>
    </div>
  );
};

export default SessaoEstrategicaPage;

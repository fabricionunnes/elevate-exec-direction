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
  BarChart3,
  Zap,
  Megaphone,
  MousePointerClick,
  ArrowDown,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

const FORM_TOKEN = "fb1b3d1493801e71251af772d921b74b";

const painPoints = [
  { icon: DollarSign, title: "Gasta sem retorno", desc: "Investe em anúncios, mas não vê resultado nas vendas" },
  { icon: Target, title: "Sem estratégia", desc: "Campanhas no escuro, sem segmentação inteligente" },
  { icon: MousePointerClick, title: "Cliques caros", desc: "CPC alto e taxa de conversão abaixo do esperado" },
  { icon: BarChart3, title: "Sem mensuração", desc: "Não sabe quais campanhas realmente geram receita" },
  { icon: TrendingUp, title: "Escala travada", desc: "Dificuldade em aumentar verba mantendo o ROAS" },
  { icon: Megaphone, title: "Sem presença", desc: "Concorrentes aparecem mais e roubam seus clientes" },
];

const stats = [
  { display: "+R$ 50M", label: "em receita gerada via ads" },
  { display: "+300", label: "empresas atendidas" },
  { display: "8x", label: "ROAS médio dos clientes" },
];

const benefits = [
  "Gestão completa de Meta Ads e Google Ads",
  "Segmentação avançada de público-alvo",
  "Criativos de alta conversão",
  "Relatórios transparentes em tempo real",
  "Otimização contínua de campanhas",
  "Estratégia personalizada para seu negócio",
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

const TrafegoPagoPage = () => {
  const [searchParams] = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPopup = () => setShowPopup(true);

  useEffect(() => {
    const pixelId = "1854664928501352";
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    (window as any).fbq("init", pixelId);
    (window as any).fbq("track", "PageView");

    const noscript = document.createElement("noscript");
    const img = document.createElement("img");
    img.height = 1; img.width = 1; img.style.display = "none";
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);
    return () => { noscript.remove(); };
  }, []);

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

      // Fire Meta Pixel Lead event
      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Tráfego Pago',
          content_category: 'trafego-pago',
        });
      }

      const leadId = data.lead_id;
      window.location.hash = `/form/${FORM_TOKEN}?lead_id=${leadId}`;
    } catch (err: any) {
      setError(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden selection:bg-blue-500/30">
      {/* ── Hero ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center px-5 sm:px-8 lg:px-12">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-600/[0.03] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="max-w-3xl mx-auto text-center space-y-6 lg:space-y-8 pt-12 lg:pt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.25em] text-blue-400/80 font-semibold border border-blue-500/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
                Meta Ads · Google Ads · Alta Performance
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.05] tracking-tight">
              Pare de{" "}
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">queimar dinheiro</span>
                <span className="absolute -bottom-1 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-transparent rounded-full" />
              </span>{" "}
              em anúncios
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="text-base sm:text-lg lg:text-xl text-neutral-400 leading-relaxed max-w-2xl mx-auto">
              Gestão profissional de <strong className="text-white">tráfego pago</strong> para empresas que querem
              escalar suas vendas com <strong className="text-white">previsibilidade e retorno real.</strong>
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col items-center gap-4">
              <Button onClick={openPopup}
                className="group relative bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(37,99,235,0.15)] hover:shadow-[0_0_60px_rgba(37,99,235,0.25)] transition-all duration-500 overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">
                  QUERO ESCALAR MEUS RESULTADOS
                  <ArrowDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                </span>
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-5 h-8 border-2 border-neutral-700 rounded-full flex justify-center pt-1.5">
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
                <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">{stat.display}</div>
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
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400/70 font-medium mb-3">Você se identifica?</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold max-w-2xl mx-auto leading-tight">
              Se você enfrenta <span className="text-blue-400">esses problemas</span>, podemos ajudar
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <motion.div whileHover={{ y: -4, borderColor: "rgba(59,130,246,0.3)" }} transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 rounded-2xl border border-neutral-800/40 bg-neutral-900/20 backdrop-blur-sm cursor-default">
                  <card.icon className="h-7 w-7 text-blue-500/80 mb-4" strokeWidth={1.5} />
                  <h3 className="text-base sm:text-lg font-semibold mb-1.5">{card.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{card.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 border-t border-neutral-800/40">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400/70 font-medium mb-3">O que você recebe</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
              Gestão <span className="text-blue-400">completa</span> de tráfego pago
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((item, i) => (
              <AnimatedSection key={i}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-neutral-800/30 bg-neutral-900/10">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-sm sm:text-base text-neutral-300">{item}</span>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8">
        <AnimatedSection className="max-w-2xl mx-auto text-center space-y-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
            Transforme cada real investido em{" "}
            <span className="text-blue-400">resultado real</span>
          </h2>
          <p className="text-neutral-500 text-sm sm:text-base max-w-lg mx-auto">
            Fale com nossa equipe e descubra como podemos multiplicar seus resultados com tráfego pago estratégico.
          </p>
          <Button onClick={openPopup}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base px-10 py-6 rounded-xl shadow-[0_0_40px_rgba(37,99,235,0.12)] hover:shadow-[0_0_60px_rgba(37,99,235,0.2)] transition-all duration-500">
            QUERO ESCALAR MEUS RESULTADOS
          </Button>
        </AnimatedSection>
      </section>

      <footer className="py-8 border-t border-neutral-800/40 text-center text-xs text-neutral-600 px-5">
        Todos os direitos reservados · Universidade Nacional de Vendas LTDA
      </footer>

      {/* Popup Form */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-[#111] border-neutral-800 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Solicite uma proposta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tp-nome" className="text-neutral-400 text-sm">Nome completo *</Label>
              <Input id="tp-nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} placeholder="Seu nome"
                className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-telefone" className="text-neutral-400 text-sm">WhatsApp com DDD *</Label>
              <PhoneInput id="tp-telefone" value={telefone} onChange={setTelefone} required
                className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-email" className="text-neutral-400 text-sm">E-mail *</Label>
              <Input id="tp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="seu@email.com"
                className="bg-neutral-900/60 border-neutral-800 text-white placeholder:text-neutral-600 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 text-base rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.12)] hover:shadow-[0_0_40px_rgba(37,99,235,0.2)] transition-all duration-500">
              {submitting ? (<><Loader2 className="h-5 w-5 animate-spin mr-2" />Enviando...</>) : "QUERO ESCALAR MEUS RESULTADOS"}
            </Button>
            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-neutral-600">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Sem compromisso</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Proposta gratuita</span>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrafegoPagoPage;

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
  ArrowRight,
  CheckCircle2,
  Play,
} from "lucide-react";
import fabricioHero from "@/assets/fabricio-hero.png";
import fabricioMentor from "@/assets/fabricio-mentor.png";
import unvWatermark from "@/assets/unv-watermark.png";

const FORM_TOKEN = "b4116f2e0b338035238f5750a7436135";

const painPoints = [
  { icon: Target, title: "Têm um time de vendas", desc: "Mas ele não bate as metas todos os meses de forma consistente" },
  { icon: TrendingUp, title: "Querem escalar o faturamento", desc: "Mas não possuem um processo comercial estruturado para isso" },
  { icon: Users, title: "Sentem que o time está desmotivado", desc: "Vendedores sem direção, sem treinamento e sem resultados" },
  { icon: BarChart3, title: "Investem em marketing", desc: "Mas os leads chegam e as vendas não fecham como deveriam" },
  { icon: Zap, title: "Precisam de resultados rápidos", desc: "Precisam acelerar o faturamento ainda este mês" },
  { icon: Award, title: "Querem vendedores de alta performance", desc: "Que realmente entregam resultados e fazem a empresa crescer" },
];

const stats = [
  { display: "+1 Bilhão", label: "em vendas realizadas" },
  { display: "+20", label: "anos de experiência" },
  { display: "+500", label: "empresas atendidas" },
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

const SessaoEstrategicaPage = () => {
  const [searchParams] = useSearchParams();
  const [showPopup, setShowPopup] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPopup = () => setShowPopup(true);

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
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-red-500/20 -mt-16 md:-mt-20">
      {/* ── Hero ── */}
      <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden">
        {/* Navy diagonal background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1b3a] via-[#0f2247] to-[#162d5a]" />
        {/* Watermark text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <img src={unvWatermark} alt="" className="w-[500px] sm:w-[700px] lg:w-[900px] opacity-[0.04]" />
        </div>
        {/* Subtle red accent glow */}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-red-600/[0.07] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-400/[0.05] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left copy */}
            <div className="space-y-5 sm:space-y-6 lg:space-y-7 pt-24 sm:pt-20 lg:pt-0 pb-16 sm:pb-12 lg:pb-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-red-300 font-semibold bg-white/[0.08] border border-white/10 rounded-full px-3 sm:px-4 py-1.5 backdrop-blur-sm leading-snug">
                  Análise exclusiva para empresários que têm times de vendas
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-[2rem] sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.1] tracking-tight text-white">
              >
                Análise Individual{" "}
                <span className="text-red-400">Gratuita</span>
              </motion.h1>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="text-lg sm:text-xl lg:text-2xl font-semibold leading-snug text-blue-100/90"
              >
                Quer um time de vendas que bate metas todos os meses? Descubra como as melhores empresas fazem isso!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-base sm:text-lg text-blue-200/60 leading-relaxed max-w-xl"
              >
                Seus vendedores estão perdidos e você não sabe mais o que fazer para{" "}
                <strong className="text-white">aumentar as vendas?</strong>
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="text-base sm:text-lg text-blue-200/60 leading-relaxed max-w-xl"
              >
                Agende uma <strong className="text-white">reunião gratuita</strong> com minha equipe. Vamos olhar juntos para sua empresa,{" "}
                <strong className="text-white">identificar o que está travando seu crescimento</strong> e criar um{" "}
                <strong className="text-white">plano para você vender mais ainda este mês!</strong>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-start gap-4 pt-2"
              >
                <Button
                  onClick={openPopup}
                  className="group bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base px-8 py-6 rounded-xl shadow-lg shadow-red-600/20 hover:shadow-xl hover:shadow-red-600/30 transition-all duration-300 w-full sm:w-auto"
                >
                  <span className="flex items-center gap-2">
                    QUERO AUMENTAR MINHAS VENDAS
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                <span className="text-sm text-blue-300/50 sm:pt-4">
                  De <span className="line-through">R$ 297,00</span>{" "}
                  <span className="text-red-400 font-bold">por R$ 0,00</span>
                </span>
              </motion.div>
            </div>

            {/* Right image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:flex justify-center items-center"
            >
              <div className="relative">
                {/* Background geometric shape */}
                <div className="absolute inset-0 -m-6 rounded-[2.5rem] bg-white/[0.04] border border-white/[0.08]" />
                <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-b from-white/[0.06] to-transparent" />
                {/* Subtle glow behind */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-20 bg-red-500/[0.1] blur-[50px] rounded-full" />
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
            className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>

        {/* Bottom wave transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 60L1440 60L1440 0C1440 0 1080 40 720 40C360 40 0 0 0 0L0 60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {stats.map((stat, i) => (
              <AnimatedSection key={i}>
                <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#0f2247] tracking-tight">
                  {stat.display}
                </div>
                <p className="text-[11px] sm:text-sm text-slate-400 mt-1 uppercase tracking-wider font-medium">{stat.label}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-14 sm:mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold max-w-2xl mx-auto leading-tight text-[#0f2247]">
              A análise estratégica é para{" "}
              <span className="text-red-600">empresários que:</span>
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {painPoints.map((card, i) => (
              <AnimatedSection key={i}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 20px 40px -12px rgba(15, 34, 71, 0.12)" }}
                  transition={{ duration: 0.25 }}
                  className="p-6 sm:p-7 rounded-2xl border border-slate-200 bg-white shadow-sm cursor-default"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0f2247]/[0.06] flex items-center justify-center mb-4">
                    <card.icon className="h-6 w-6 text-[#0f2247]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0f2247] mb-1.5">{card.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection className="text-center mt-12">
            <Button
              onClick={openPopup}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base px-10 py-6 rounded-xl shadow-lg shadow-red-600/15 hover:shadow-xl hover:shadow-red-600/25 transition-all duration-300"
            >
              <span className="flex items-center gap-2">
                QUERO AUMENTAR MINHAS VENDAS
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Mentor ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <AnimatedSection className="flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f2247]/5 to-red-600/5 rounded-3xl -rotate-3 scale-105" />
                <img
                  src={fabricioMentor}
                  alt="Fabrício Nunnes"
                  className="relative z-10 max-h-[460px] object-contain rounded-2xl"
                  loading="lazy"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection className="space-y-6 lg:order-1">
              <p className="text-xs uppercase tracking-[0.2em] text-red-600 font-semibold">
                Quem é o seu mentor?
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-[#0f2247]">
                Fabrício <span className="text-red-600">Nunnes</span>
              </h2>
              <div className="space-y-4 text-slate-500 text-sm sm:text-base leading-relaxed">
                <p>
                  Empresário, mentor, diretor de vendas,{" "}
                  <strong className="text-[#0f2247]">criador da Universidade Nacional de Vendas.</strong> Com mais de 20
                  anos de experiência na área e uma década como diretor comercial, atualmente atende diversas empresas que{" "}
                  <strong className="text-[#0f2247]">faturam entre 6 a 7 dígitos todos os meses.</strong>
                </p>
                <p>
                  Durante sua carreira, alcançou a marca de{" "}
                  <strong className="text-[#0f2247]">mais de 1 bilhão em vendas de serviços e produtos</strong>. Com toda a experiência adquirida, decidiu focar o seu trabalho em empresários de pequenas e médias empresas que desejam escalar o seu negócio.
                </p>
                <p>
                  Sua principal missão é fazer com que cada um{" "}
                  <strong className="text-[#0f2247]">alcance suas metas regularmente, aumente seu faturamento</strong> e consiga estruturar um negócio totalmente{" "}
                  <strong className="text-[#0f2247]">autogerenciável</strong> que traz{" "}
                  <strong className="text-[#0f2247]">resultados exponenciais</strong> e mais{" "}
                  <strong className="text-[#0f2247]">qualidade de vida.</strong>
                </p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-gradient-to-b from-[#0c1b3a] to-[#0f2247]">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-14 sm:mb-20">
            <p className="text-xs uppercase tracking-[0.2em] text-red-400 font-semibold mb-3">
              Depoimentos
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white">
              Resultados de quem já é{" "}
              <span className="text-red-400">nosso cliente</span>
            </h2>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {testimonialVideos.map((videoId, i) => (
              <AnimatedSection key={videoId}>
                <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-lg">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={`Depoimento ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                    loading="lazy"
                  />
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-8 bg-white">
        <AnimatedSection className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-[#0f2247]">
            Não perca mais tempo.{" "}
            <span className="text-red-600">Agende sua análise agora.</span>
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto">
            Empresários que passaram pela análise estratégica já estão colhendo resultados.
            A próxima vaga pode ser sua.
          </p>
          <Button
            onClick={openPopup}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base px-10 py-6 rounded-xl shadow-lg shadow-red-600/15 hover:shadow-xl hover:shadow-red-600/25 transition-all duration-300"
          >
            <span className="flex items-center gap-2">
              QUERO AUMENTAR MINHAS VENDAS
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </AnimatedSection>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 bg-[#0c1b3a] text-center text-xs text-blue-300/40 px-5">
        Todos os direitos reservados · Universidade Nacional de Vendas LTDA
      </footer>

      {/* Popup Form */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-[#0f2247]">Preencha seus dados</DialogTitle>
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
              disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-base rounded-xl shadow-lg shadow-red-600/15 hover:shadow-xl hover:shadow-red-600/25 transition-all duration-300"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                "QUERO AUMENTAR MINHAS VENDAS"
              )}
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

import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  Brain,
  Heart,
  Eye,
  Shield,
  Calendar,
  XCircle,
  Sparkles
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoLeDesir from "@/assets/logo-le-desir.png";

const problems = [
  "Exaustão mental silenciosa",
  "Decisões tomadas sob ansiedade",
  "Repetição de padrões destrutivos",
  "Dificuldade de separar identidade pessoal da empresa",
  "Solidão de liderança"
];

const deliverables = [
  "Clareza decisória",
  "Redução de ansiedade",
  "Aumento de foco",
  "Melhoria de relações profissionais",
  "Sustentação emocional para ciclos de crescimento"
];

const notFor = [
  "Quem busca respostas rápidas",
  "Quem quer fórmula",
  "Quem não tolera silêncio e profundidade"
];

export default function LeDesirPage() {
  // Le Désir brand colors - deep burgundy/wine red theme
  const leDesirColors = {
    primary: "hsl(355, 45%, 35%)", // Deep burgundy
    primaryLight: "hsl(355, 40%, 45%)", // Lighter burgundy
    primaryDark: "hsl(355, 50%, 25%)", // Darker burgundy
    accent: "hsl(355, 35%, 55%)", // Soft wine
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${leDesirColors.primaryDark} 0%, ${leDesirColors.primary} 50%, ${leDesirColors.primaryLight} 100%)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block mb-6 p-4 bg-white/95 rounded-2xl shadow-lg">
              <img src={logoLeDesir} alt="Le Désir" className="h-32 md:h-40 w-auto object-contain" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/30 mb-6">
              <Heart className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Escuta Estratégica</span>
            </div>
            <p className="text-2xl text-white font-medium mb-4">
              Escuta Profunda para Quem Decide
            </p>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Um espaço reservado para empresários que precisam de clareza, presença e equilíbrio.
              Sessões individuais 100% online para quem carrega o peso das decisões.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-white hover:bg-white/90 text-[hsl(355,45%,35%)]" asChild>
                <Link to="/apply">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" className="border-white/50 text-white hover:bg-white/10 bg-transparent border" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="red"
        productNumber={12}
        productName="LE DÉSIR"
        tagline="Escuta Estratégica"
        whatItDoes="Espaço reservado de escuta profunda, reflexão e consciência para quem lidera."
        keyPoints={[
          "Entendimento de padrões",
          "Clareza nas decisões",
          "Equilíbrio emocional",
          "Presença como líder"
        ]}
        arrow="Sustenta crescimento com equilíbrio e lucidez."
        targetAudience={{
          revenue: "Empresários, Fundadores, Sócios, C-Level"
        }}
        schedule={[
          { period: "Semanal", description: "1 sessão por semana" },
          { period: "Quinzenal", description: "1 sessão a cada 2 semanas" },
          { period: "100% Online", description: "Sessões individuais" }
        ]}
        scheduleType="recurring"
      />

      {/* O problema real */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-white text-center mb-12">
              O Problema Real que Resolve
            </h2>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 md:p-12 backdrop-blur-sm">
              <p className="text-lg text-white/80 mb-8 text-center">
                <span className="text-white font-semibold">Empresários não quebram apenas por números.</span> Quebram por:
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-white/10 border border-white/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-white/70 shrink-0 mt-0.5" />
                    <span className="text-sm text-white/80">{problem}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-white/15 border border-white/25 rounded-lg">
                <p className="text-sm text-white/90 text-center">
                  Esses fatores afetam <span className="text-white font-semibold">vendas, liderança, relações e visão de longo prazo</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como resolve */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-12">
            Como Funciona
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-white/80 text-center mb-8">
              Através de um <span className="text-white font-semibold">espaço de escuta profunda, reflexão e consciência</span>, você:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Brain, text: "Entende o que te leva a agir de certa forma" },
                { icon: Shield, text: "Para de decidir no impulso" },
                { icon: Eye, text: "Recupera clareza sobre o que realmente importa" },
                { icon: Sparkles, text: "Fortalece sua presença como líder" },
                { icon: Heart, text: "Cresce com equilíbrio, sem se destruir no processo" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-white/10 border border-white/20 rounded-lg">
                  <item.icon className="h-5 w-5 text-white shrink-0" />
                  <span className="text-white/80">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-white" />
                Estrutura da Entrega
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
                  <span className="text-white/80">Sessões individuais 100% online</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
                  <span className="text-white/80">Frequência: semanal ou quinzenal</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
                  <span className="text-white/80">Atendimento 100% confidencial</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-white shrink-0 mt-0.5" />
                  <span className="text-white/80">Sem agenda de conteúdo fixa (respeita seu momento)</span>
                </li>
              </ul>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-white" />
                Entregáveis
              </h3>
              <p className="text-sm text-white/70 mb-4 italic">Intangíveis, porém mensuráveis:</p>
              <ul className="space-y-3">
                {deliverables.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-white shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <h2 className="heading-section text-white text-center mb-12">
            Para Quem É e Para Quem NÃO É
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6">Para Quem É</h3>
              <ul className="space-y-4">
                {["Empresários", "Fundadores", "Sócios", "Executivos C-level"].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-white shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6">Para Quem NÃO É</h3>
              <ul className="space-y-4">
                {notFor.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-white/70 shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 45%, 35%)" }}>
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-white mb-8">
              Investimento
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/95 rounded-2xl p-8 shadow-lg">
                <p className="text-sm text-[hsl(355,45%,35%)] mb-2">Semanal</p>
                <p className="text-4xl font-bold text-[hsl(355,45%,35%)] mb-2">R$ 2.000</p>
                <p className="text-[hsl(355,45%,35%)]/70 mb-6">/mês</p>
                <Button size="lg" className="w-full bg-[hsl(355,45%,35%)] hover:bg-[hsl(355,50%,25%)] text-white" asChild>
                  <Link to="/apply">
                    Iniciar Processo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-sm">
                <p className="text-sm text-white/70 mb-2">Quinzenal</p>
                <p className="text-4xl font-bold text-white mb-2">R$ 1.200</p>
                <p className="text-white/70 mb-6">/mês</p>
                <Button size="lg" className="w-full border-white/50 text-white hover:bg-white/10 bg-transparent border" asChild>
                  <Link to="/apply">
                    Iniciar Processo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">Alta retenção</span>
              <span className="px-3 py-1 bg-white/10 text-white/80 text-sm rounded-full">100% Online</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding" style={{ backgroundColor: "hsl(355, 50%, 25%)" }}>
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-white mb-4">
              Pronto para Ter Clareza?
            </h2>
            <p className="text-white/80 mb-8">
              O Le Désir é para quem quer liderar com lucidez, presença e equilíbrio.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-white hover:bg-white/90 text-[hsl(355,45%,35%)]" asChild>
                <Link to="/apply">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" className="border-white/50 text-white hover:bg-white/10 bg-transparent border" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

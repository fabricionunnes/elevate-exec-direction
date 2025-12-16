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
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block mb-6">
              <img src={logoLeDesir} alt="Le Désir" className="h-32 md:h-40 w-auto object-contain" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Psicanálise Estratégica</span>
            </div>
            <p className="text-2xl text-primary font-medium mb-4">
              Psicanálise Estratégica para Empresários
            </p>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Não é terapia clínica tradicional. Não é mentoria.
              É psicanálise estratégica 100% online voltada à lucidez, presença e tomada de decisão.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                <Link to="/apply">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
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
        tagline="Psicanálise Estratégica"
        whatItDoes="Espaço estruturado de escuta, elaboração e consciência para empresários."
        keyPoints={[
          "Entendimento de padrões",
          "Redução de decisões reativas",
          "Clareza estratégica",
          "Presença como líder"
        ]}
        arrow="Sustenta crescimento sem colapso emocional."
        targetAudience={{
          revenue: "Empresários, Fundadores, Sócios, C-Level"
        }}
        schedule={[
          { period: "Semanal", description: "R$ 2.000/mês" },
          { period: "Quinzenal", description: "R$ 1.200/mês" },
          { period: "100% Online", description: "Sessões individuais" }
        ]}
        scheduleType="recurring"
      />

      {/* O problema real */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Problema Real que Resolve
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8 text-center">
                <span className="text-foreground font-semibold">Empresários não quebram apenas por números.</span> Quebram por:
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{problem}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Esses fatores afetam <span className="text-foreground font-semibold">vendas, liderança, relações e visão de longo prazo</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como resolve */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Como o Le Désir Resolve
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-muted-foreground text-center mb-8">
              Através de um <span className="text-foreground font-semibold">espaço estruturado de escuta, elaboração e consciência</span>, o empresário:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Brain, text: "Entende seus padrões de comportamento" },
                { icon: Shield, text: "Reduz decisões reativas" },
                { icon: Eye, text: "Recupera clareza estratégica" },
                { icon: Sparkles, text: "Fortalece presença como líder" },
                { icon: Heart, text: "Sustenta crescimento sem colapsar" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                  <item.icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Estrutura da Entrega
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Sessões individuais 100% online</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Frequência: semanal ou quinzenal</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Atendimento 100% confidencial</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Sem agenda de conteúdo fixa (respeita o processo analítico)</span>
                </li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Entregáveis
              </h3>
              <p className="text-sm text-muted-foreground mb-4 italic">Intangíveis, porém mensuráveis:</p>
              <ul className="space-y-3">
                {deliverables.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Para Quem É e Para Quem NÃO É
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Para Quem É</h3>
              <ul className="space-y-4">
                {["Empresários", "Fundadores", "Sócios", "Executivos C-level"].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Para Quem NÃO É</h3>
              <ul className="space-y-4">
                {notFor.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Investimento
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-8">
                <p className="text-sm text-muted-foreground mb-2">Semanal</p>
                <p className="text-4xl font-bold text-foreground mb-2">R$ 2.000</p>
                <p className="text-muted-foreground mb-6">/mês</p>
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                  <Link to="/apply">
                    Iniciar Processo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
              <div className="bg-card border border-border rounded-2xl p-8">
                <p className="text-sm text-muted-foreground mb-2">Quinzenal</p>
                <p className="text-4xl font-bold text-foreground mb-2">R$ 1.200</p>
                <p className="text-muted-foreground mb-6">/mês</p>
                <Button size="lg" variant="outline" className="w-full" asChild>
                  <Link to="/apply">
                    Iniciar Processo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">Alta retenção</span>
              <span className="px-3 py-1 bg-secondary text-muted-foreground text-sm rounded-full">100% Online</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-4">
              Pronto para Ganhar Clareza?
            </h2>
            <p className="text-muted-foreground mb-8">
              O Le Désir é para quem quer liderar com lucidez, presença e sustentação emocional.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
                <Link to="/apply">
                  Iniciar Processo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
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

import { Layout } from "@/components/layout/Layout";
import { Target, Users, Zap, CheckCircle2, Calendar, MessageSquare, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import strategySession from "@/assets/strategy-session.jpg";

const pillars = [
  {
    icon: Target,
    title: "Direção",
    description:
      "Definimos prioridades comerciais claras, metas e o caminho estratégico para alcançá-las. Sem achismo—apenas execução focada.",
  },
  {
    icon: Users,
    title: "Treinamento",
    description:
      "Seu time recebe treinamento prático em scripts, objeções, negociação e fechamento—desenhado para aplicação imediata.",
  },
  {
    icon: Zap,
    title: "Execução",
    description:
      "Implementamos processos, pipelines e rotinas que transformam estratégia em ação diária. Cada atividade tem propósito.",
  },
  {
    icon: CheckCircle2,
    title: "Cobrança",
    description:
      "Check-ins semanais, scorecards e feedback direto garantem que seu time entregue. Não apenas aconselhamos—exigimos resultados.",
  },
];

const cadence = [
  {
    icon: Calendar,
    title: "Encontro Estratégico Mensal",
    description:
      "Uma sessão estratégica por mês para revisar prioridades, ajustar metas e alinhar o roadmap.",
  },
  {
    icon: MessageSquare,
    title: "Check-in Semanal de Execução",
    description:
      "Acompanhamento semanal focado em execução: o que foi feito, o que está travado e o que precisa de ação imediata.",
  },
  {
    icon: ClipboardCheck,
    title: "Checklists Semanais",
    description:
      "Checklists estruturados garantem que cada vendedor saiba suas prioridades e acompanhe seu próprio progresso.",
  },
  {
    icon: Zap,
    title: "Suporte UNV AI Advisor",
    description:
      "Camada de suporte com IA para dúvidas diárias, preparação de reuniões e lembretes de execução. Não é SaaS—é ferramenta de suporte.",
  },
];

export default function HowItWorksPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">
              O Método UNV
            </h1>
            <p className="text-body text-lg">
              Um framework comprovado de direção comercial que transforma como
              seu time de vendas opera. Quatro pilares. Cadência consistente.
              Resultados mensuráveis.
            </p>
          </div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Quatro Pilares da Direção
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Todo engajamento segue o mesmo framework fundamental, adaptado ao
              seu contexto específico e tamanho do time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {pillars.map((pillar, i) => (
              <div
                key={i}
                className="card-premium p-8 hover:border-accent/30 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
                  <pillar.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="heading-card text-foreground mb-3">
                  {pillar.title}
                </h3>
                <p className="text-body">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[50vh] min-h-[400px]">
        <img
          src={strategySession}
          alt="Sessão estratégica executiva revisando dashboard de vendas"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-overlay flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Direção não é conselho.
              <span className="block text-primary">É cobrança.</span>
            </h2>
          </div>
        </div>
      </section>

      {/* Cadence */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Cadência de Execução
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Consistência vence intensidade. Nossa cadência garante progresso
              contínuo, não picos esporádicos de atividade.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cadence.map((item, i) => (
              <div key={i} className="card-premium p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-small">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-6">
            Pronto para direção comercial estruturada?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Aplique para um diagnóstico e descubra qual produto UNV se encaixa
            no seu estágio atual.
          </p>
          <Link to="/diagnostico">
            <Button variant="hero" size="xl">
              Aplicar para Diagnóstico
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  RefreshCw, 
  Shield, 
  MessageSquare, 
  Users,
  Calendar,
  FileText,
  BarChart3,
  Clock,
  Sparkles,
  TrendingUp
} from "lucide-react";
import controlHero from "@/assets/control-hero.jpg";

const deliverables = [
  {
    icon: Calendar,
    title: "Direção Recorrente",
    description: "Cadência definida de acompanhamento para manter o momentum da sua operação comercial.",
    details: [
      "Encontros mensais de direção",
      "Revisão de prioridades",
      "Ajustes de rota",
      "Definição de próximos passos"
    ]
  },
  {
    icon: BarChart3,
    title: "Monitoria Estratégica Mensal",
    description: "Análise mensal dos números e indicadores para identificar oportunidades e problemas.",
    details: [
      "Análise de conversão",
      "Revisão de metas",
      "Identificação de gargalos",
      "Recomendações de ação"
    ]
  },
  {
    icon: FileText,
    title: "Templates de Gestão",
    description: "Documentos prontos para uso que padronizam a gestão do seu time comercial.",
    details: [
      "Template de reunião semanal",
      "Modelo de feedback",
      "Checklist de atividades",
      "Relatório de performance"
    ]
  },
  {
    icon: Users,
    title: "Comunidade Fechada",
    description: "Acesso a uma comunidade exclusiva de empresários no mesmo estágio de crescimento.",
    details: [
      "Networking qualificado",
      "Troca de experiências",
      "Cases de sucesso",
      "Suporte entre pares"
    ]
  },
  {
    icon: Sparkles,
    title: "UNV AI Advisor — Nível Execução",
    description: "Suporte IA com cobrança semanal para manter a disciplina e consistência.",
    details: [
      "Cobrança semanal automatizada",
      "Lembretes de atividades",
      "Preparação de reuniões",
      "Checklists por fase"
    ]
  }
];

const gains = [
  {
    icon: RefreshCw,
    title: "Consistência",
    description: "Execução comercial constante sem os altos e baixos do improviso."
  },
  {
    icon: TrendingUp,
    title: "Momentum Sustentado",
    description: "Manter o ritmo de crescimento sem regressão aos velhos hábitos."
  },
  {
    icon: Clock,
    title: "Disciplina de Longo Prazo",
    description: "Rotinas que se mantêm mesmo quando a agenda aperta."
  }
];

const cadence = [
  { period: "Semanal", action: "Cobrança via AI Advisor", icon: Sparkles },
  { period: "Mensal", action: "Sessão de monitoria estratégica", icon: BarChart3 },
  { period: "Contínuo", action: "Acesso à comunidade e templates", icon: Users },
];

const icp = [
  { label: "Faturamento", value: "R$ 100k–400k/mês", icon: BarChart3 },
];

const notIncluded = [
  "Treinamento completo do time (veja Sales Acceleration)",
  "Imersões presenciais (veja Growth Room)",
  "Acesso a mentoria elite (veja Partners)",
  "Construção de funil do zero (veja Core)"
];

export default function ControlPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${controlHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 backdrop-blur-sm">
              Direção Recorrente
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Control
            </h1>
            <p className="text-2xl md:text-3xl text-primary-foreground/90 font-medium mb-4">
              Sustentar execução contínua.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8 max-w-2xl">
              Mantenha a consistência de execução com direção comercial recorrente. 
              Check-ins mensais, templates e suporte com IA para manter seu time no trilho.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar Agora
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Papel da UNV */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O Papel da UNV no Control
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto mb-8">
              No Control, a UNV atua como seu parceiro de responsabilização, 
              garantindo que a execução comercial não perca ritmo.
            </p>
            <div className="p-6 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-foreground font-medium text-lg">
                "O problema não é saber o que fazer. É fazer consistentemente. O Control resolve isso."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cadence */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ritmo de Acompanhamento
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {cadence.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center group hover:border-accent/50 transition-colors">
                  <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                    <item.icon className="h-7 w-7 text-accent" />
                  </div>
                  <p className="text-accent font-semibold text-lg mb-2">
                    {item.period}
                  </p>
                  <p className="text-body">
                    {item.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="card-premium p-8 text-center">
              <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
              <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                Faturamento
              </p>
              <p className="font-semibold text-foreground text-3xl mb-4">
                R$ 100k–400k/mês
              </p>
              <p className="text-body max-w-md mx-auto">
                Empresas que já têm processo definido mas precisam de acompanhamento 
                para manter a disciplina e consistência na execução.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              O Que Você Recebe
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Tudo que você precisa para manter a execução comercial no trilho, 
              mês após mês.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {deliverables.map((item, i) => (
              <div 
                key={i} 
                className="card-premium p-6 bg-background group hover:border-accent/50 transition-all hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-body text-sm mb-4">
                  {item.description}
                </p>
                <ul className="space-y-2">
                  {item.details.map((detail, j) => (
                    <li key={j} className="flex items-center gap-2 text-small">
                      <CheckCircle className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor Highlight */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-10 w-10 text-accent" />
                </div>
                <div>
                  <h3 className="heading-card text-foreground mb-3">
                    UNV AI Advisor — Nível Execução
                  </h3>
                  <p className="text-body text-lg mb-6">
                    Diferente do nível básico, o AI Advisor no Control faz cobrança semanal ativa. 
                    Ele não espera você lembrar — ele cobra.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {["Cobrança semanal", "Preparação de reuniões", "Checklists automáticos", "Alertas de desvio"].map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
                        <span className="text-small">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Esperados
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {gains.map((gain, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <gain.icon className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-2">
                    {gain.title}
                  </h3>
                  <p className="text-body">
                    {gain.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que NÃO Está Incluso
            </h2>
            <p className="text-body text-center mb-12">
              O Control é manutenção. Para transformação completa, veja Sales Acceleration.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-secondary rounded-lg"
                >
                  <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium text-center">
          <h2 className="heading-section mb-6">Investimento</h2>
          <p className="text-5xl md:text-6xl font-display font-bold text-accent mb-4">
            R$ 297
          </p>
          <p className="text-primary-foreground/70 text-lg mb-4">
            por mês
          </p>
          <p className="text-primary-foreground/50 text-sm mb-10 max-w-md mx-auto">
            Sem fidelidade. Cancele quando quiser. Resultados dependem da execução.
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar Agora
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Next Step */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-small uppercase tracking-wider text-muted-foreground mb-4">
              Quer ir além?
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Acelere com Sales Acceleration
            </h2>
            <p className="text-body text-lg mb-8 max-w-2xl mx-auto">
              Se você quer transformação completa — treinar o time, estruturar todo o processo 
              e ter direção anual — o Sales Acceleration é o caminho.
            </p>
            <Link to="/sales-acceleration">
              <Button variant="premium" size="lg">
                Conhecer Sales Acceleration
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

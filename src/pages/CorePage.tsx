import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Target, 
  Layers, 
  Shield, 
  MessageSquare,
  FileText,
  Users,
  BarChart3,
  Clock,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import coreHero from "@/assets/core-hero.jpg";

const deliverables = [
  {
    icon: FileText,
    title: "Diagnóstico Direcional Detalhado",
    description: "Análise profunda da sua operação comercial atual, identificando gargalos, oportunidades e pontos críticos de melhoria.",
    details: [
      "Mapeamento do funil atual",
      "Análise de conversão por etapa",
      "Identificação de perdas evitáveis",
      "Benchmark com operações similares"
    ]
  },
  {
    icon: Layers,
    title: "Funil Base Estruturado",
    description: "Construção de um funil comercial claro com etapas definidas, critérios de passagem e métricas de acompanhamento.",
    details: [
      "Definição de etapas do funil",
      "Critérios de qualificação",
      "Tempo médio por etapa",
      "Taxas de conversão esperadas"
    ]
  },
  {
    icon: MessageSquare,
    title: "Scripts Essenciais",
    description: "Roteiros validados para as principais situações de venda: abordagem, qualificação e fechamento.",
    details: [
      "Script de primeira abordagem",
      "Roteiro de qualificação",
      "Argumentos de fechamento",
      "Tratamento de objeções básicas"
    ]
  },
  {
    icon: Target,
    title: "Metas Básicas por Vendedor",
    description: "Definição de metas realistas e mensuráveis para cada membro do time comercial.",
    details: [
      "Meta de atividades diárias",
      "Meta de conversão por etapa",
      "Indicadores de performance",
      "Critérios de avaliação"
    ]
  },
  {
    icon: Clock,
    title: "Rotina Mínima de Cobrança",
    description: "Estrutura básica de acompanhamento para garantir que o time execute o mínimo necessário.",
    details: [
      "Check-in diário simples",
      "Reunião semanal de time",
      "Relatório de atividades",
      "Pontos de controle essenciais"
    ]
  },
  {
    icon: Sparkles,
    title: "AI Advisor Básico",
    description: "Acesso à camada de suporte com inteligência artificial para organização e lembretes.",
    details: [
      "Lembretes de atividades",
      "Organização de tarefas",
      "Suporte a dúvidas básicas",
      "Checklists automatizados"
    ]
  }
];

const gains = [
  {
    icon: BarChart3,
    title: "Clareza e Organização",
    description: "Processo comercial estruturado que todos entendem e conseguem seguir."
  },
  {
    icon: MessageSquare,
    title: "Redução do Improviso",
    description: "Scripts e roteiros que padronizam a comunicação com leads."
  },
  {
    icon: Target,
    title: "Base para Escalar",
    description: "Fundação sólida que permite crescer sem reconstruir do zero."
  }
];

const icp = [
  { label: "Faturamento", value: "R$ 50k–150k/mês", icon: BarChart3 },
  { label: "Time", value: "1–5 vendedores", icon: Users },
];

const notIncluded = [
  "Direção contínua mensal (veja UNV Control)",
  "Treinamento avançado do time",
  "Monitoria de performance ou scorecards",
  "Acompanhamento semanal de execução"
];

export default function CorePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coreHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 backdrop-blur-sm">
              Fundação Comercial
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Core
            </h1>
            <p className="text-2xl md:text-3xl text-primary-foreground/90 font-medium mb-4">
              Organizar o caos comercial inicial.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8 max-w-2xl">
              Construa a base estrutural da sua operação comercial. Frameworks
              essenciais para parar de improvisar e começar a vender com método.
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
              O Papel da UNV no Core
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto mb-8">
              No Core, a UNV atua como arquiteta da sua operação comercial inicial,
              construindo os alicerces que vão sustentar todo o crescimento futuro.
            </p>
            <div className="p-6 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-foreground font-medium text-lg">
                "Não é sobre vender mais agora. É sobre criar a estrutura que permite vender mais sempre."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="grid sm:grid-cols-2 gap-8 mb-12">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-8 text-center group hover:border-accent/50 transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                    <item.icon className="h-8 w-8 text-accent" />
                  </div>
                  <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground text-2xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="card-premium p-6 bg-accent/5 border-accent/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Ideal para quem está começando</h4>
                  <p className="text-body">
                    Empresas que já vendem mas não têm processo definido. O Core é o primeiro passo 
                    para sair do improviso e construir uma operação comercial profissional.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              O Que Você Recebe
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Cada entregável foi desenhado para resolver um problema específico 
              da sua operação comercial inicial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {deliverables.map((item, i) => (
              <div 
                key={i} 
                className="card-premium p-6 group hover:border-accent/50 transition-all hover:shadow-lg"
                style={{ animationDelay: `${i * 100}ms` }}
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
              O Core é fundação. Para direção contínua, considere nossos outros produtos.
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
            R$ 997 – R$ 1.997
          </p>
          <p className="text-primary-foreground/70 text-lg mb-4">
            Investimento único
          </p>
          <p className="text-primary-foreground/50 text-sm mb-10 max-w-md mx-auto">
            Valor varia conforme complexidade da operação. Resultados dependem da execução do cliente.
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
              Próximo passo
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Depois do Core, vem o Control
            </h2>
            <p className="text-body text-lg mb-8 max-w-2xl mx-auto">
              Depois de estruturar a fundação, mantenha a execução com direção recorrente. 
              O UNV Control garante que seu time continue no trilho.
            </p>
            <Link to="/control">
              <Button variant="premium" size="lg">
                Conhecer UNV Control
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

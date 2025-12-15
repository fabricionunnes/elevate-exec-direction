import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  Users,
  Brain,
  Target,
  BarChart3,
  MessageSquare,
  Shield,
  Calendar,
  Sparkles,
  XCircle
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

const dimensions = [
  {
    title: "Autoliderança & Maturidade",
    objective: "Desenvolver líderes emocionalmente maduros.",
    topics: [
      "Responsabilidade pessoal",
      "Postura de dono",
      "Gestão emocional sob pressão",
      "Clareza de papel",
      "Limites e autoridade"
    ],
    deliverables: [
      "Diagnóstico de perfil de liderança",
      "Plano individual de desenvolvimento (PDI)",
      "Rotina pessoal de liderança"
    ],
    gain: "Eu paro de reagir e começo a liderar."
  },
  {
    title: "Gestão de Pessoas & Performance",
    objective: "Ensinar o líder a cobrar sem desgastar e desenvolver sem passar pano.",
    topics: [
      "Cobrança clara",
      "Feedback estruturado",
      "Conversas difíceis",
      "Desenvolvimento de talentos",
      "Gestão de conflitos"
    ],
    deliverables: [
      "Roteiro de feedback",
      "Agenda de gestão de pessoas",
      "Checklist de cobrança",
      "Modelo de PDI para liderados"
    ],
    gain: "Meu time entende o que é esperado."
  },
  {
    title: "Liderança na Execução",
    objective: "Transformar estratégia em ação diária.",
    topics: [
      "Gestão por indicadores",
      "Rotinas de acompanhamento",
      "Prioridade vs. urgência",
      "Ritmo de execução",
      "Reuniões produtivas"
    ],
    deliverables: [
      "Agenda oficial do líder",
      "Roteiro de reuniões",
      "Painel simples de indicadores",
      "Checklist semanal de execução"
    ],
    gain: "A execução deixa de depender do fundador."
  },
  {
    title: "Liderança, Cultura & Decisão",
    objective: "Criar líderes que sustentam cultura e tomam decisões.",
    topics: [
      "Tomada de decisão",
      "Sustentação de cultura",
      "Exemplos e rituais",
      "Alinhamento com a direção",
      "Comunicação de decisões difíceis"
    ],
    deliverables: [
      "Guia de decisões do líder",
      "Ritual de cultura",
      "Estrutura de alinhamento com a direção",
      "Código de conduta de liderança"
    ],
    gain: "O time sabe o que é aceitável e o que não é."
  }
];

const notFor = [
  "Curso motivacional",
  "Terapia",
  "RH terceirizado",
  "Coaching individual vazio"
];

export default function LeadershipPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-b from-card to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.08),transparent_50%)]" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Brain className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Formação de Liderança</span>
            </div>
            <h1 className="heading-display text-foreground mb-6">
              UNV Leadership Development
            </h1>
            <p className="text-2xl text-accent font-medium mb-4">
              Liderança que sustenta pessoas, performance e crescimento
            </p>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Empresas quebram menos por falta de vendas e mais por lideranças fracas.
              Esse produto existe para resolver isso.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link to="/apply">
                  Quero Formar Meus Líderes
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
        color="blue"
        productNumber={9}
        productName="UNV LEADERSHIP DEVELOPMENT"
        tagline="Formação de Líderes"
        whatItDoes="Forma líderes que sustentam pessoas, cultura e execução."
        keyPoints={[
          "Autoliderança",
          "Cobrança e feedback",
          "Gestão de pessoas",
          "Decisão e cultura"
        ]}
        arrow="Remove o fundador do centro."
        targetAudience={{
          revenue: "Empresas com líderes intermediários"
        }}
        schedule={[
          { period: "Mês 0", description: "Diagnóstico" },
          { period: "Mensal", description: "Desenvolvimento" },
          { period: "Contínuo", description: "Aplicação prática" }
        ]}
        scheduleType="recurring"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O que é o UNV Leadership Development
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8">
                O UNV Leadership Development é o programa da UNV focado exclusivamente em 
                <span className="text-foreground font-semibold"> formar líderes capazes de sustentar pessoas, performance e crescimento</span>, 
                sem depender do fundador para tudo.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Users className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Desenvolvedora de líderes</p>
                    <p className="text-sm text-muted-foreground">Estruturadora de comportamento de gestão</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Target className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Tradutora da estratégia</p>
                    <p className="text-sm text-muted-foreground">Transformamos estratégia em ação humana</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Criadora de padrão</p>
                    <p className="text-sm text-muted-foreground">Padrão de liderança consistente</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-6 w-6 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Guardiã da cultura</p>
                    <p className="text-sm text-muted-foreground">Cultura de execução sustentável</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">⚠️ A UNV não substitui RH</span>, não executa gestão, não faz terapia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Para Quem é Este Programa
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Perfil da Empresa</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Faturamento: <span className="text-foreground font-medium">R$ 100k a R$ 2M+/mês</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Times com líderes intermediários: gestores, coordenadores, heads, líderes técnicos</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Dor principal:</span>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground ml-4">
                      <li>• Líder não cobra</li>
                      <li>• Líder não desenvolve</li>
                      <li>• Líder vira gargalo</li>
                      <li>• Fundador centraliza tudo</li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Perfil do Participante</h3>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Líder em formação ou em consolidação</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Responsável por pessoas</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Aberto a feedback</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Com responsabilidade por resultado</span>
                </li>
              </ul>
              <div className="border-t border-border pt-6">
                <h4 className="font-semibold text-foreground mb-3">Quem não entra:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Pessoas sem time
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Profissionais sem responsabilidade real
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Empresas que querem "motivação"
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Objective */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central
            </h2>
            <p className="text-2xl text-muted-foreground mb-6">
              Formar líderes que sabem <span className="text-accent font-semibold">cobrar, desenvolver, decidir e sustentar pessoas</span> sem depender do fundador.
            </p>
            <p className="text-lg text-muted-foreground">
              Não é sobre carisma. É sobre <span className="text-foreground font-medium">responsabilidade, clareza e maturidade</span>.
            </p>
          </div>
        </div>
      </section>

      {/* 4 Dimensions */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Arquitetura do Programa
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              4 grandes dimensões, cada uma com entregáveis práticos
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {dimensions.map((dimension, index) => (
              <div key={index} className="bg-card border border-border rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-accent font-bold">{index + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{dimension.title}</h3>
                </div>
                <p className="text-accent font-medium mb-4">{dimension.objective}</p>
                
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2">O que é trabalhado:</h4>
                  <div className="flex flex-wrap gap-2">
                    {dimension.topics.map((topic, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Entregáveis:</h4>
                  <ul className="space-y-1">
                    {dimension.deliverables.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-4 p-3 bg-accent/10 rounded-lg">
                  <p className="text-sm font-medium text-accent">"{dimension.gain}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Metodologia de Ensino
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8 text-center">
                O UNV Leadership Development <span className="text-foreground font-semibold">não é aula</span>. Ele funciona em ciclos:
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {["Direção clara", "Aplicação prática", "Cobrança", "Feedback", "Ajuste"].map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-accent-foreground font-bold text-sm">{index + 1}</span>
                    </div>
                    <span className="font-medium text-foreground">{step}</span>
                    {index < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />}
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {["Encontros ao vivo", "Casos reais da empresa", "Exercícios aplicados", "Avaliação de comportamento", "Evolução monitorada"].map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Format */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Calendar className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Duração</h3>
              <p className="text-muted-foreground">6 ou 12 meses</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Users className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Formato</h3>
              <p className="text-muted-foreground">Híbrido: ao vivo + aplicação + acompanhamento</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <BarChart3 className="h-10 w-10 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Avaliação</h3>
              <p className="text-muted-foreground">Contínua de evolução</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-8 w-8 text-accent" />
                <h2 className="heading-section text-foreground">UNV AI Advisor — Nível Leadership</h2>
              </div>
              <p className="text-lg text-muted-foreground mb-6">
                Apoio ao líder no dia a dia:
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {["Prepara conversas difíceis", "Ajuda em feedbacks", "Reforça rotinas", "Organiza decisões", "Apoia reflexão de liderança"].map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ Não substitui desenvolvimento humano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Ganhos Reais
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Para a Empresa</h3>
              <ul className="space-y-4">
                {["Menos dependência do fundador", "Lideranças mais fortes", "Cultura mais clara", "Execução consistente"].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6">Para o Líder</h3>
              <ul className="space-y-4">
                {["Clareza de papel", "Segurança para cobrar", "Capacidade de decidir", "Evolução profissional real"].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What it's not */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              O Que Este Produto Não É
            </h2>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {notFor.map((item, index) => (
                <div key={index} className="flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-full">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xl text-accent font-semibold">
              👉 É formação de liderança responsável.
            </p>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Investimento
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">Por Líder</h3>
                <p className="text-4xl font-bold text-accent mb-2">R$ 1.500</p>
                <p className="text-muted-foreground">/mês por líder</p>
              </div>
              <div className="bg-card border-2 border-accent rounded-2xl p-8 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">
                  RECOMENDADO
                </div>
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">Por Empresa</h3>
                <p className="text-4xl font-bold text-accent mb-2">R$ 15.000</p>
                <p className="text-muted-foreground">/ano</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-card border-t border-border">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              UNV Leadership Development
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Forma líderes que sustentam crescimento quando o fundador sai do centro.
            </p>
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
              <Link to="/apply">
                Quero Formar Meus Líderes
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
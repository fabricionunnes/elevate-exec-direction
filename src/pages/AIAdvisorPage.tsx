import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  Sparkles,
  AlertTriangle,
  XCircle,
  Video,
  MessageCircle,
  MonitorSmartphone,
  BarChart3,
  Target,
  Megaphone,
  CalendarClock,
  Wrench
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

const problems = [
  "Assina ChatGPT ou Claude e usa só para escrever e-mail",
  "Já tentou implementar IA sozinho e travou na primeira dificuldade",
  "Rotinas de gestão, comercial e marketing ainda feitas na mão",
  "Vê o concorrente acelerando com IA e não sabe por onde começar"
];

const consequences = [
  "Horas perdidas toda semana",
  "Time lento e sem padrão",
  "Dono preso na operação",
  "Custo maior que o necessário"
];

const areas = [
  {
    title: "Gestão",
    icon: BarChart3,
    items: [
      "Resumo e ata de reunião automáticos",
      "Análise de indicadores e relatórios",
      "Rotinas de cobrança e acompanhamento do time",
      "Padronização de processos e documentos"
    ]
  },
  {
    title: "Comercial",
    icon: Target,
    items: [
      "Scripts de abordagem e follow-up",
      "Propostas comerciais em minutos",
      "Análise de conversas e objeções",
      "Qualificação e priorização de leads"
    ]
  },
  {
    title: "Marketing",
    icon: Megaphone,
    items: [
      "Conteúdo no tom da empresa",
      "Copy de anúncios e páginas",
      "Roteiros de vídeo e calendário editorial",
      "Reaproveitamento de conteúdo em vários canais"
    ]
  }
];

const steps = [
  {
    icon: Wrench,
    title: "Preparação",
    description: "Diagnóstico de IA da empresa, contas criadas nas ferramentas e os casos de uso prioritários escolhidos antes da primeira reunião."
  },
  {
    icon: Video,
    title: "Reunião quinzenal — 1h individual",
    description: "A cada 15 dias, uma implementação nova ao vivo. Você compartilha a tela e clica, o Fabrício conduz cada passo."
  },
  {
    icon: MessageCircle,
    title: "Suporte no WhatsApp entre as reuniões",
    description: "Travou em alguma coisa? Manda no grupo. O Fabrício ajuda a destravar e ajustar enquanto você coloca em uso no dia a dia."
  },
  {
    icon: BarChart3,
    title: "Revisão trimestral de ganhos",
    description: "A cada 3 meses, o que já está rodando, quantas horas foram economizadas e quais são os próximos gargalos a atacar."
  }
];

const deliverables = [
  "24 reuniões individuais de 1h com o Fabrício no ano (2 por mês)",
  "Diagnóstico de IA da empresa",
  "Implementação guiada com tela compartilhada",
  "Suporte no grupo de WhatsApp durante os 12 meses",
  "Biblioteca de prompts da sua operação, atualizada no ano",
  "Revisão trimestral de ganhos com IA"
];

const idealFor = [
  "Empresas com faturamento acima de R$ 50 mil/mês",
  "Dono ou gestor que vai participar da implementação",
  "Rotinas repetitivas em gestão, comercial ou marketing",
  "Quem quer aprender fazendo, na própria operação"
];

const notFor = [
  "Quem quer que alguém faça tudo por ele",
  "Quem não vai separar tempo para aplicar entre as reuniões",
  "Projetos de desenvolvimento de software sob medida"
];

export default function AIAdvisorPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">IA aplicada lado a lado com o Fabrício</span>
            </div>
            <h1 className="heading-display text-foreground mb-6">UNV AI Advisor</h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              Um ano com o Fabrício Nunes ao seu lado, em 2 reuniões individuais por mês, para colocar a inteligência artificial para trabalhar na gestão, no comercial e no marketing da sua empresa.
            </p>
            <p className="text-lg text-primary font-medium mb-8">
              Não é curso. Não é feito para você.<br />
              É implementação guiada: você clica, o Fabrício conduz.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/diagnostico">
                  Quero Implementar IA na Minha Empresa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/products">Ver Todos os Serviços</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="purple"
        productNumber={17}
        productName="UNV AI ADVISOR"
        tagline="IA aplicada à operação"
        whatItDoes="Implementação guiada de IA (Claude, ChatGPT e outras ferramentas) em gestão, comercial e marketing, com 2 reuniões individuais por mês com o Fabrício e suporte no WhatsApp durante 12 meses."
        keyPoints={[
          "2 reuniões individuais de 1h por mês",
          "Quinzenais, com tela compartilhada",
          "Suporte no WhatsApp entre as reuniões",
          "Gestão, comercial e marketing"
        ]}
        arrow="IA nova rodando na operação a cada 15 dias."
        targetAudience={{
          revenue: "R$ 50k+/mês",
          team: "Dono ou gestor participando"
        }}
        schedule={[
          { period: "Quinzenal", description: "Reunião individual de 1h com implementação ao vivo" },
          { period: "Contínuo", description: "Suporte no grupo de WhatsApp" },
          { period: "Trimestral", description: "Revisão de ganhos e próximos casos de uso" },
          { period: "Anual", description: "12 meses, 24 reuniões" }
        ]}
        scheduleType="recurring"
      />

      {/* O problema real */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Problema Real que o AI Advisor Resolve
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8 text-center">
                <span className="text-foreground font-semibold">Todo mundo fala de IA, mas na maioria das PMEs:</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{problem}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  <span className="text-foreground font-semibold">O resultado:</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {consequences.map((item, index) => (
                    <span key={index} className="px-3 py-1 bg-destructive/10 text-destructive text-sm rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-4">
            Como Funciona
          </h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Um ano de implementação contínua. O Fabrício não faz por você: ele faz com você, na sua tela, dentro das suas ferramentas.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-primary">Etapa {index + 1}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Áreas */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Onde a IA Entra na Sua Empresa
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {areas.map((area, index) => (
              <div key={index} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <area.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{area.title}</h3>
                </div>
                <ul className="space-y-2">
                  {area.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-8 max-w-2xl mx-auto">
            Ferramentas: Claude, ChatGPT ou a que fizer mais sentido para a sua operação. A escolha é feita no diagnóstico.
          </p>
        </div>
      </section>

      {/* Entregáveis */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              O Que Está Incluso
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {deliverables.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-muted-foreground text-left">{item}</span>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {[
                { icon: CalendarClock, text: "Reuniões quinzenais de 1h" },
                { icon: MonitorSmartphone, text: "Tela compartilhada, ao vivo" },
                { icon: MessageCircle, text: "Suporte no grupo de WhatsApp" }
              ].map((item, index) => (
                <div key={index} className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-lg text-center">
                  <item.icon className="h-6 w-6 text-primary" />
                  <span className="text-sm text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Para quem é
                </h3>
                <ul className="space-y-3">
                  {idealFor.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Para quem NÃO é
                </h3>
                <ul className="space-y-3">
                  {notFor.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-8">Investimento</h2>
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12 max-w-lg mx-auto">
            <p className="text-4xl font-bold text-foreground mb-2">R$ 36.000</p>
            <p className="text-muted-foreground mb-2">/ano, em até 12x de R$ 3.000 no cartão</p>
            <p className="text-sm text-muted-foreground/70 mb-8">
              24 reuniões individuais + suporte no WhatsApp durante 12 meses
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/diagnostico">
                Quero Implementar IA na Minha Empresa
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xl md:text-2xl font-medium text-primary mb-6">
              "IA não substitui o seu time. Ela tira o seu time do trabalho repetitivo."
            </p>
            <h2 className="heading-section text-foreground mb-4">
              Pronto para Colocar a IA para Trabalhar?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              A cada 15 dias, uma rotina nova com IA rodando em gestão, comercial ou marketing. Em um ano, a operação inteira trabalha diferente.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/diagnostico">
                Quero Implementar IA na Minha Empresa
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Target,
  Users2,
  TrendingUp,
  Calendar,
  Shield,
  Lock,
  Zap,
  Clock,
  DollarSign,
  FileText,
  AlertTriangle,
  Handshake,
  Crown,
  Building2,
  UserCheck
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoExecutionPartnership from "@/assets/logo-execution-partnership.png";

const monthlyPhases = [
  {
    month: "MÊS 1",
    title: "DIAGNÓSTICO PROFUNDO + DIREÇÃO",
    color: "bg-blue-500",
    objective: "Entender tudo e decidir rápido",
    items: [
      "Diagnóstico completo da operação comercial",
      "Análise de funil, conversões, metas e discurso",
      "Avaliação da liderança comercial",
      "Revisão de oferta e modelo de vendas",
      "Definição de metas agressivas e realistas",
      "Redesenho do modelo de gestão comercial",
      "Criação do plano de execução dos próximos 60 dias"
    ],
    result: "Clareza total, prioridades definidas, fim da confusão operacional"
  },
  {
    month: "MÊS 2",
    title: "IMPLEMENTAÇÃO NA OPERAÇÃO",
    color: "bg-amber-500",
    objective: "Colocar tudo para rodar",
    items: [
      "Implementação do novo modelo de gestão",
      "Implantação de rotina de cobrança",
      "Ajustes no processo comercial",
      "Treinamento prático da liderança",
      "Correções semanais com base em dados",
      "Acompanhamento direto do gerente comercial"
    ],
    result: "Time executando, metas acompanhadas, gargalos corrigidos em tempo real"
  },
  {
    month: "MÊS 3",
    title: "ACELERAÇÃO E PREVISIBILIDADE",
    color: "bg-green-500",
    objective: "Gerar resultado financeiro e estabilidade",
    items: [
      "Ajustes finais no funil",
      "Otimização de conversões",
      "Estabilização da rotina de gestão",
      "Criação de previsibilidade mínima",
      "Preparação da empresa para escalar sem o Fabrício",
      "Fechamento do projeto com análise de ROI"
    ],
    result: "Faturamento maior, gestão clara, empresa menos dependente do dono"
  }
];

const deliverables = [
  "Novo modelo de gestão comercial implementado",
  "Rotina semanal e mensal de cobrança funcionando",
  "Metas por função definidas",
  "Funil estruturado e acompanhado",
  "Liderança treinada e operante",
  "Previsibilidade mínima de receita",
  "Plano pós-90 dias"
];

const expectedResults = [
  { text: "Payback em até 3 meses", icon: DollarSign },
  { text: "Crescimento de faturamento", icon: TrendingUp },
  { text: "Aumento de controle e clareza", icon: Target },
  { text: "Redução da dependência do dono", icon: UserCheck },
  { text: "Base sólida para escala", icon: Building2 }
];

const eligibleCompanies = [
  "Faturamento acima de R$ 500.000/mês",
  "Time comercial estruturado",
  "Existência de gerente(s) comercial(is) ou liderança intermediária",
  "Dono disposto a abrir a operação",
  "Empresa que aceita cobrança, mudança e decisão dura"
];

const notEligibleCompanies = [
  "Empresas pequenas ou em início",
  "Negócios sem liderança interna",
  "Donos que não aceitam interferência",
  "Empresas sem margem para crescimento rápido"
];

const positioningPhrases = [
  "Aqui eu entro para fazer funcionar.",
  "Se sua empresa não aguenta mudança, esse serviço não é para você.",
  "Não é consultoria. É intervenção.",
  "Eu entro para estruturar. Se fizer sentido, posso ficar."
];

export default function ExecutionPartnershipPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container-premium relative z-10 py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-sm font-medium mb-8 animate-fade-up">
              <Zap className="h-4 w-4" />
              Implementação Comercial com Fabrício Nunnes
            </div>
            
            <div className="inline-block p-3 bg-white/95 rounded-xl shadow-lg mb-6 animate-fade-up delay-100">
              <img src={logoExecutionPartnership} alt="UNV Execution Partnership" className="h-20 md:h-24" />
            </div>
            
            <p className="text-2xl md:text-3xl text-foreground/90 mb-6 animate-fade-up delay-200 italic">
              "Aqui eu não aconselho.{" "}
              <span className="text-primary font-bold">Eu entro, implemento, cobro e faço a empresa funcionar.</span>"
            </p>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-up delay-300">
              Programa exclusivo de implementação comercial profunda, com intervenção executiva direta por 90 dias, 
              focado em reestruturação, execução e resultados mensuráveis.
            </p>

            <div className="flex flex-wrap gap-6 mb-10 justify-center animate-fade-up delay-400">
              <div className="flex items-center gap-2 text-primary">
                <Lock className="h-5 w-5" />
                <span className="font-medium">Máximo 10 empresas simultâneas</span>
              </div>
              <div className="flex items-center gap-2 text-primary">
                <Shield className="h-5 w-5" />
                <span className="font-medium">Vagas extremamente limitadas</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center animate-fade-up delay-500">
              <Link to="/diagnostico">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                  Candidatar-se ao Programa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="outline" size="xl" className="border-primary/30 text-foreground hover:bg-primary/10">
                  Comparar Serviços
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="red"
        productNumber={16}
        productName="UNV EXECUTION PARTNERSHIP"
        tagline="Intervenção Executiva"
        whatItDoes="Fabrício Nunnes entra diretamente na operação, implementa, cobra e faz a empresa funcionar."
        keyPoints={[
          "Projeto fechado de 3 meses",
          "Reunião estratégica semanal",
          "Implementação prática direta",
          "Cobrança intensa de execução",
          "Possibilidade de sociedade futura"
        ]}
        arrow="Não é consultoria. É intervenção."
        targetAudience={{
          revenue: "Acima de R$ 500k/mês"
        }}
        schedule={[
          { period: "Mês 1", description: "Diagnóstico + Direção" },
          { period: "Mês 2", description: "Implementação" },
          { period: "Mês 3", description: "Aceleração + Previsibilidade" }
        ]}
        scheduleType="phases"
      />

      {/* What it is NOT */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              O Que É o Execution Partnership
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é consultoria tradicional</p>
              </div>
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é mentoria</p>
              </div>
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é treinamento</p>
              </div>
            </div>

            <div className="p-8 bg-primary/10 border border-primary/30 rounded-2xl">
              <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
              <p className="text-2xl text-foreground font-bold">
                É intervenção executiva.
              </p>
              <p className="text-muted-foreground mt-4 text-lg">
                Reestruturação do modelo de gestão comercial, implementação prática, cobrança direta e aceleração de faturamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Central Objective */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central
            </h2>
            <p className="text-2xl text-muted-foreground mb-8">
              Reestruturar completamente a gestão comercial e fazer a empresa gerar{" "}
              <span className="text-foreground font-semibold">resultado financeiro mensurável em até 90 dias.</span>
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Previsibilidade mínima",
                "Aumento de faturamento",
                "Clareza de gestão",
                "Time funcionando sem o dono"
              ].map((item, i) => (
                <div key={i} className="p-4 bg-card border border-border rounded-xl">
                  <CheckCircle className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-foreground font-medium text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Para Quem é Este Serviço
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Empresas Elegíveis</h3>
              </div>
              
              <ul className="space-y-4">
                {eligibleCompanies.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-premium p-8 border-destructive/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Empresas NÃO Elegíveis</h3>
              </div>
              
              <ul className="space-y-4">
                {notEligibleCompanies.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Format */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Formato do Programa
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="card-premium p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Duração</h3>
              <p className="text-muted-foreground">3 meses (90 dias)</p>
              <p className="text-sm text-muted-foreground mt-1">Projeto fechado</p>
            </div>

            <div className="card-premium p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Atuação Direta</h3>
              <p className="text-muted-foreground">Fabrício Nunnes atua pessoalmente</p>
              <p className="text-sm text-muted-foreground mt-1">Nas decisões, reuniões e cobrança</p>
            </div>

            <div className="card-premium p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Rotina Fixa</h3>
              <p className="text-muted-foreground">1 reunião estratégica/semana</p>
              <p className="text-sm text-muted-foreground mt-1">+ acompanhamento contínuo</p>
            </div>

            <div className="card-premium p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Capacidade Máxima</h3>
              <p className="text-muted-foreground">Até 10 empresas simultâneas</p>
              <p className="text-sm text-muted-foreground mt-1">Limite rígido de profundidade</p>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Phases */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Estrutura dos 3 Meses
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {monthlyPhases.map((phase, index) => (
              <div key={index} className="card-premium p-8 relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-2 ${phase.color}`} />
                
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl ${phase.color} flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">{phase.month}</span>
                  </div>
                  <h3 className="font-bold text-foreground">{phase.title}</h3>
                </div>
                
                <p className="text-sm text-primary font-medium mb-4">
                  Objetivo: {phase.objective}
                </p>
                
                <ul className="space-y-2 mb-6">
                  {phase.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-xl">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Resultado esperado: </span>
                    {phase.result}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Entregáveis Concretos
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {deliverables.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Expected Results */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-6 text-center">
            Resultado Esperado
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Promessa realista baseada em intervenção direta + execução intensa. Não é promessa mágica.
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
            {expectedResults.map((result, i) => (
              <div key={i} className="card-premium p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <result.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-foreground font-medium text-sm">{result.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl max-w-3xl mx-auto">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
              <div>
                <p className="text-foreground font-semibold mb-2">Importante</p>
                <p className="text-muted-foreground">
                  Os resultados dependem da execução. Este é um serviço de meio, não de resultado garantido. 
                  A UNV entra para implementar e cobrar, mas a empresa precisa executar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground mb-12 text-center">
              Investimento
            </h2>
            
            <div className="card-premium p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              
              <div className="text-5xl font-bold text-foreground mb-2">R$ 40.000</div>
              <p className="text-muted-foreground mb-8">Projeto fechado — 3 meses</p>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-foreground font-medium">Não recorrente</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-foreground font-medium">Sem reembolso</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-foreground font-medium">Condições específicas</p>
                </div>
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-foreground font-medium">Serviço de meio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Possibility */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-sm font-medium mb-4">
                <Crown className="h-4 w-4" />
                Diferencial Único
              </div>
              <h2 className="heading-section text-foreground mb-4">
                Possibilidade de Sociedade
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Ao final dos 3 meses, se houver alinhamento estratégico e potencial real, 
                Fabrício Nunnes pode avaliar entrar como sócio do negócio.
              </p>
            </div>
            
            <div className="card-premium p-8 md:p-10 border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Avaliação */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Avaliação da Empresa</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Será realizada uma avaliação detalhada da empresa para determinar o valor justo 
                    e as condições de uma possível sociedade.
                  </p>
                </div>

                {/* Percentual */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Handshake className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Percentual Negociado</h3>
                  </div>
                  <p className="text-muted-foreground">
                    O percentual de participação será decidido em comum acordo entre ambas as partes, 
                    de forma justa e transparente.
                  </p>
                </div>

                {/* Investimento ou Troca */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Investimento ou Troca</h3>
                  </div>
                  <p className="text-muted-foreground">
                    A entrada pode ocorrer via investimento financeiro ou através de troca por trabalho 
                    estratégico e operacional na empresa.
                  </p>
                </div>

                {/* Executivo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Users2 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Fabrício ou Executivo</h3>
                  </div>
                  <p className="text-muted-foreground">
                    A atuação pós-sociedade pode ser do próprio Fabrício Nunnes ou de um executivo 
                    selecionado e aprovado por ele.
                  </p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-6 bg-secondary/50 rounded-xl border border-border/50">
                <h4 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Importante Entender
                </h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-bold">1</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      A sociedade <strong className="text-foreground">não é automática</strong> — 
                      depende de avaliação e interesse mútuo.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-bold">2</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Não faz parte</strong> do contrato inicial — 
                      é uma possibilidade futura.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-bold">3</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      É uma <strong className="text-foreground">oportunidade estratégica</strong> — 
                      não uma garantia do serviço.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-bold">4</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Termos negociáveis</strong> — 
                      definidos caso a caso conforme o potencial.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-muted-foreground mt-8 text-sm italic">
              "Eu entro para estruturar. Se fizer sentido, posso ficar."
            </p>
          </div>
        </div>
      </section>

      {/* Why it exists */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Por Que Este Serviço Existe
            </h2>
            
            <p className="text-xl text-muted-foreground mb-8">
              Porque empresas grandes não precisam de dica. Precisam de{" "}
              <span className="text-foreground font-semibold">execução</span>,{" "}
              <span className="text-foreground font-semibold">alguém que já fez</span>,{" "}
              <span className="text-foreground font-semibold">decisão e cobrança</span>.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {positioningPhrases.map((phrase, i) => (
                <div key={i} className="p-4 bg-card border border-border rounded-xl">
                  <p className="text-foreground font-medium italic">"{phrase}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Role */}
      <section className="section-padding bg-card border-t border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Papel no Ecossistema UNV
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {[
                "É o topo da pirâmide",
                "Gera autoridade máxima",
                "Cria cases profundos",
                "Alimenta Partners & Mastermind",
                "Posiciona como operador",
                "Abre portas para equity deals"
              ].map((item, i) => (
                <div key={i} className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                  <p className="text-foreground font-medium text-sm">{item}</p>
                </div>
              ))}
            </div>
            
            <div className="p-8 bg-primary/10 border border-primary/30 rounded-2xl">
              <p className="text-2xl text-foreground font-bold">
                "Três meses comigo dentro da sua empresa para fazê-la funcionar de verdade."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-padding bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pronto para transformar sua operação comercial?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Apenas 10 vagas simultâneas disponíveis. Candidaturas são analisadas individualmente.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/diagnostico">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                  Candidatar-se ao Programa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="outline" size="xl" className="border-primary/30 text-foreground hover:bg-primary/10">
                  Comparar Serviços
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

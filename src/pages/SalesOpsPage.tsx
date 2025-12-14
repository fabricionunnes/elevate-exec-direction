import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Users2, 
  Shield, 
  MessageSquare, 
  BarChart,
  TrendingUp,
  FileText,
  Target,
  Sparkles,
  Layers,
  UserCheck,
  GraduationCap,
  ClipboardCheck,
  XCircle,
  AlertTriangle,
  Compass,
  Settings,
  Bot,
  Zap,
  Clock,
  Phone,
  Briefcase
} from "lucide-react";
import salesOpsHero from "@/assets/sales-ops-hero.jpg";

// Papel da UNV
const papelUNV = [
  { icon: Settings, text: "Arquiteto da operação comercial" },
  { icon: MessageSquare, text: "Padronizador do discurso e do processo" },
  { icon: GraduationCap, text: "Estruturador de trilhas por cargo" },
  { icon: Shield, text: "Guardião do padrão de vendas" },
  { icon: Users2, text: "Redutor da dependência do dono/gestor" },
];

// ICP - Quem é cliente ideal
const icpIdeal = [
  "Empresas faturando R$ 200k+/mês",
  "Times comerciais com 5 ou mais vendedores",
  "Geração de leads existente",
  "Demanda recorrente",
  "Estrutura mínima de gestão",
];

const doresClientes = [
  "Cada vendedor vende de um jeito",
  "Queda de performance quando alguém sai",
  "Onboarding lento",
  "Dono/gestor sobrecarregado",
];

// Quem NÃO entra
const icpNao = [
  "Empresas sem time",
  "Negócios pequenos demais",
  "Donos que querem terceirizar gestão",
  "Times sem liderança mínima",
];

// Formato
const formato = [
  { label: "Tipo", value: "Produto recorrente" },
  { label: "Cobrança", value: "Por usuário" },
  { label: "Contrato mínimo", value: "6 meses recomendado" },
  { label: "Escala", value: "Cresce com o time" },
];

// Trilhas por cargo
const trilhaSDR = {
  cargo: "SDR",
  titulo: "Trilha SDR (Pré-vendas)",
  icon: Phone,
  conteudo: [
    "Abordagem inicial",
    "Qualificação real",
    "Critérios de passagem",
    "Agendamento eficiente",
    "Registro correto de informações",
  ],
  entregaveis: [
    "Script padrão de abordagem",
    "Checklist diário do SDR",
    "Critérios objetivos de qualificação",
    "Indicadores de performance",
  ],
};

const trilhaCloser = {
  cargo: "Closer",
  titulo: "Trilha Closer (Vendas)",
  icon: Target,
  conteudo: [
    "Diagnóstico profundo",
    "Condução consultiva",
    "Argumentação de valor",
    "Gestão de objeções",
    "Fechamento com método",
    "Follow-up avançado",
  ],
  entregaveis: [
    "Script master de vendas",
    "Playbook de propostas",
    "Sequência de follow-up",
    "Scorecard individual",
  ],
};

const trilhaGestor = {
  cargo: "Gestor",
  titulo: "Trilha Gestor Comercial",
  icon: Briefcase,
  conteudo: [
    "Gestão por indicadores",
    "Cobrança eficiente",
    "Feedback estruturado",
    "Desenvolvimento do time",
    "Leitura de pipeline",
  ],
  entregaveis: [
    "Agenda de gestão semanal",
    "Roteiro de reunião comercial",
    "Modelo de feedback",
    "Checklist de cobrança",
  ],
};

const trilhas = [trilhaSDR, trilhaCloser, trilhaGestor];

// Pilares de entrega
const pilares = [
  {
    numero: "2",
    titulo: "Padronização do Discurso Comercial",
    icon: MessageSquare,
    descricao: "Criação de um único padrão de comunicação comercial.",
    oQueUNVDefine: [
      "Linguagem oficial da empresa",
      "Estrutura de conversa por etapa",
      "O que pode e o que não pode ser dito",
      "Como apresentar proposta",
      "Como lidar com objeções recorrentes",
    ],
    entregaveis: [
      "Manual de discurso por etapa do funil",
      "Scripts padronizados e versionados",
      "Regras claras de comunicação",
    ],
    ganho: "O cliente tem a mesma experiência, independente de quem vende.",
  },
  {
    numero: "3",
    titulo: "Onboarding Comercial Estruturado",
    icon: GraduationCap,
    descricao: "Processo claro para entrada de novos vendedores.",
    oQueUNVEntrega: [
      "Roteiro de onboarding (30–60–90 dias)",
      "Ordem de aprendizado",
      "Critérios mínimos de liberação para vender",
      "Avaliação de entendimento",
    ],
    entregaveis: [
      "Checklist de onboarding",
      "Trilha inicial obrigatória",
      "Avaliação de readiness",
    ],
    ganho: "Novo vendedor performa mais rápido.",
  },
  {
    numero: "4",
    titulo: "Avaliação e Controle de Performance",
    icon: BarChart,
    descricao: "Sistema simples de avaliação contínua.",
    oQueUNVDefine: [
      "Indicadores por cargo",
      "Métricas mínimas obrigatórias",
      "Critérios de alerta",
      "Critérios de evolução",
    ],
    entregaveis: [
      "Scorecard por função",
      "Relatórios claros para o gestor",
      "Sinalização de gargalos individuais",
    ],
    ganho: "Eu sei exatamente quem está performando e por quê.",
  },
  {
    numero: "5",
    titulo: "UNV AI Advisor (Por Cargo)",
    icon: Bot,
    descricao: "Suporte diário ao time, sem depender do gestor.",
    oQueIAFaz: [
      "Tira dúvidas de script",
      "Reforça padrão",
      "Ajuda no follow-up",
      "Orienta execução diária",
      "Reforça rotina",
    ],
    limites: [
      "Não vende",
      "Não substitui pessoas",
      "Não analisa CRM",
    ],
    ganho: "O padrão não se perde no dia a dia.",
  },
];

// Cadência
const cadenciaDiaria = [
  "Uso de scripts e checklists",
  "Apoio do AI Advisor",
];

const cadenciaSemanal = [
  "Reunião de time (modelo UNV)",
  "Leitura de indicadores",
];

const cadenciaMensal = [
  "Avaliação de performance",
  "Ajustes de trilha e padrão",
];

// Entregáveis consolidados
const entregaveisConsolidados = [
  "Trilhas por cargo",
  "Scripts padronizados",
  "Manual do vendedor",
  "Processo de onboarding",
  "Scorecards de performance",
  "Relatórios para gestão",
  "UNV AI Advisor por função",
];

// Ganhos
const ganhosImediatos = [
  { icon: Layers, text: "Organização do time" },
  { icon: Shield, text: "Menos erros básicos" },
  { icon: MessageSquare, text: "Comunicação alinhada" },
];

const ganhosEstruturais = [
  { icon: Users2, text: "Time replicável" },
  { icon: TrendingUp, text: "Escala sem caos" },
  { icon: UserCheck, text: "Menos dependência do dono" },
  { icon: Zap, text: "Menor impacto de turnover" },
];

// O que NÃO entrega
const naoEntrega = [
  "Não acelera vendas sozinho",
  "Não substitui liderança",
  "Não garante resultado financeiro",
  "Não é produto estratégico",
];

// Próximos passos
const proximosProdutos = [
  { nome: "UNV Sales Acceleration", descricao: "Sustenta Sales Acceleration", href: "/sales-acceleration" },
  { nome: "UNV Control", descricao: "Complementa UNV Control", href: "/control" },
];

export default function SalesOpsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${salesOpsHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              <Settings className="h-4 w-4" />
              Sales Operations & Padronização
            </div>
            <h1 className="heading-display text-foreground mb-6">
              UNV Sales Ops
            </h1>
            <p className="text-2xl md:text-3xl text-foreground/90 font-medium mb-4">
              Onde vendedores viram um time de verdade.
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              Padronizar, treinar e sustentar a operação comercial. 
              Garantindo que o time de vendas opere sob um único padrão, 
              independentemente de quem esteja vendendo.
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

      {/* Posicionamento */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                Posicionamento Oficial
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto">
                O UNV Sales Ops é o produto da UNV focado em padronizar, treinar e sustentar 
                a operação comercial, garantindo que o time de vendas opere sob um único padrão, 
                independentemente de quem esteja vendendo.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 bg-accent/5 border-accent/20">
                <p className="text-foreground font-medium text-lg">
                  📌 Sales Ops existe quando o problema não é vender, 
                  mas vender sempre do mesmo jeito, com previsibilidade.
                </p>
              </div>
              <div className="card-premium p-6">
                <p className="text-muted-foreground">
                  Não é curso para vendedor. Não é onboarding genérico. 
                  É <span className="text-foreground font-semibold">estrutura operacional de vendas.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Papel da UNV */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Papel da UNV no Sales Ops
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Neste produto, a UNV atua como:
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {papelUNV.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-foreground font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-muted-foreground text-sm flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <span>
                  ⚠️ A UNV não executa vendas, não recruta, não gerencia o time no dia a dia.
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              ICP Ultra Definido
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Quem É */}
              <div className="card-premium p-8 bg-accent/5 border-accent/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Quem É o Cliente Ideal</h3>
                </div>
                <ul className="space-y-3 mb-6">
                  {icpIdeal.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="border-t border-border/30 pt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Dores típicas:</p>
                  <ul className="space-y-2">
                    {doresClientes.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        <span className="text-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Quem NÃO É */}
              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Quem NÃO Entra</h3>
                </div>
                <ul className="space-y-3">
                  {icpNao.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Formato */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Formato, Duração e Escala
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {formato.map((item, i) => (
                <div key={i} className="card-premium p-5 text-center">
                  <p className="text-small uppercase tracking-wider text-muted-foreground mb-1">
                    {item.label}
                  </p>
                  <p className="text-foreground font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-muted-foreground">
              Integrável com Sales Acceleration e UNV Control
            </p>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central do Sales Ops
            </h2>
            <p className="text-xl text-foreground mb-8 max-w-3xl mx-auto">
              Criar um time comercial replicável, onde:
            </p>
            
            <div className="grid sm:grid-cols-3 gap-4 text-left">
              {[
                "Qualquer vendedor novo entra e performa mais rápido",
                "A saída de alguém não quebra o faturamento",
                "O dono deixa de ser o 'manual vivo' da empresa",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 card-premium">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pilar 1 - Trilhas por Cargo */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-accent font-bold text-sm uppercase tracking-wider mb-2">Pilar 1</p>
              <h2 className="heading-section text-foreground mb-4">
                Trilhas de Treinamento por Cargo
              </h2>
              <p className="text-body text-lg max-w-2xl mx-auto">
                O Sales Ops não treina "vendedor genérico". Ele treina funções específicas.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {trilhas.map((trilha, i) => (
                <div key={i} className="card-premium p-6 bg-background">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <trilha.icon className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-accent font-bold text-sm">{trilha.cargo}</p>
                      <h3 className="font-semibold text-foreground">{trilha.titulo}</h3>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Conteúdo:</p>
                    <ul className="space-y-2">
                      {trilha.conteudo.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Entregáveis:</p>
                    <ul className="space-y-2">
                      {trilha.entregaveis.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Outros Pilares */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Pilares de Entrega
            </h2>

            <div className="space-y-6">
              {pilares.map((pilar, i) => (
                <div key={i} className="card-premium p-6 lg:p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <pilar.icon className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-accent font-bold text-sm uppercase tracking-wider mb-1">
                        Pilar {pilar.numero}
                      </p>
                      <h3 className="font-semibold text-foreground text-xl">
                        {pilar.titulo}
                      </h3>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-foreground mb-4">{pilar.descricao}</p>
                      
                      {pilar.oQueUNVDefine && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">A UNV define:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVDefine.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueUNVEntrega && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a UNV entrega:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVEntrega.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueIAFaz && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">A IA faz:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueIAFaz.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.limites && (
                        <div className="mt-4 p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                          <p className="text-sm font-medium text-muted-foreground mb-2">⚠️ Limites:</p>
                          <ul className="space-y-1">
                            {pilar.limites.map((item, j) => (
                              <li key={j} className="text-sm text-muted-foreground">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Entregáveis:</p>
                      <ul className="space-y-2 mb-6">
                        {pilar.entregaveis.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <FileText className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                            <span className="text-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Ganho percebido:</p>
                        <p className="text-foreground italic">"{pilar.ganho}"</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cadência Operacional */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Cadência Operacional do Sales Ops
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-premium p-6 bg-background">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-foreground">Diário</h3>
                </div>
                <ul className="space-y-2">
                  {cadenciaDiaria.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-premium p-6 bg-background">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Semanal</h3>
                </div>
                <ul className="space-y-2">
                  {cadenciaSemanal.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-premium p-6 bg-background">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-foreground">Mensal</h3>
                </div>
                <ul className="space-y-2">
                  {cadenciaMensal.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Entregáveis Consolidados */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Entregáveis Consolidados
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {entregaveisConsolidados.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ganhos */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Reais do Sales Ops
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Ganhos Imediatos */}
              <div className="card-premium p-6 bg-background">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  Ganhos Imediatos
                </h3>
                <div className="space-y-4">
                  {ganhosImediatos.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-accent" />
                      </div>
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ganhos Estruturais */}
              <div className="card-premium p-6 bg-background">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ganhos Estruturais
                </h3>
                <div className="space-y-4">
                  {ganhosEstruturais.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que NÃO entrega */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que o Sales Ops NÃO Entrega
            </h2>
            <p className="text-body text-center mb-8">
              👉 Ele sustenta a operação.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {naoEntrega.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
                  <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Próximos Passos */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Caminho Natural Após o Sales Ops
            </h2>
            <p className="text-body text-center mb-12">
              O Sales Ops sustenta, complementa e prepara empresas para escala.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6">
              {proximosProdutos.map((produto, i) => (
                <Link key={i} to={produto.href} className="card-premium p-6 text-center hover:border-accent/50 transition-colors group">
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
                    {produto.nome}
                  </h3>
                  <p className="text-muted-foreground text-sm">{produto.descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-6">Investimento</h2>
          <p className="text-5xl md:text-6xl font-display font-bold text-primary mb-4">
            R$ 197
          </p>
          <p className="text-muted-foreground text-lg mb-2">
            Por usuário / mês
          </p>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Contrato mínimo recomendado • Escala conforme crescimento do time
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar Agora
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Frase Final */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-2xl md:text-3xl font-display text-foreground italic">
              "UNV Sales Ops é o que transforma vendedores em um time de verdade."
            </blockquote>
          </div>
        </div>
      </section>
    </Layout>
  );
}

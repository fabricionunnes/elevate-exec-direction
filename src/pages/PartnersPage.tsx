import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Crown, 
  Shield, 
  MessageSquare, 
  Users, 
  Home,
  Calendar,
  BarChart3,
  TrendingUp,
  Sparkles,
  Star,
  Globe,
  XCircle,
  UserCheck,
  AlertTriangle,
  Target,
  Compass,
  Eye,
  Zap,
  FileText,
  Bot,
  Clock
} from "lucide-react";
import partnersHero from "@/assets/partners-hero.jpg";
import mansionImage from "@/assets/mansion-experience.jpg";

// Papel da UNV
const papelUNV = [
  { icon: Compass, text: "Diretor estratégico externo" },
  { icon: Users, text: "Membro de board" },
  { icon: Target, text: "Conselheiro de decisões críticas" },
  { icon: Shield, text: "Guardião da direção" },
  { icon: Eye, text: "Provocador de foco e clareza" },
];

// ICP - Quem é cliente ideal
const icpIdeal = [
  "Empresas faturando R$ 300k a R$ 2M/mês",
  "Fundador/CEO decisor",
  "Estrutura mínima de operação",
  "Solidão na liderança",
  "Decisões de alto impacto sem contraponto",
  "Crescimento gerando complexidade",
  "Falta de benchmark real",
];

const perfilComportamental = [
  "Dono aberto a ser confrontado",
  "Disposto a ouvir verdades duras",
  "Busca clareza, não validação",
];

// Quem NÃO entra
const icpNao = [
  "Quem quer execução terceirizada",
  "Quem busca motivação",
  "Quem não decide",
  "Empresas pequenas demais",
];

// Formato
const formato = [
  { label: "Contrato", value: "12 meses" },
  { label: "Renovação", value: "Seletiva" },
  { label: "Vagas", value: "Número limitado" },
  { label: "Curadoria", value: "Pessoal do Fabrício" },
  { label: "Confidencialidade", value: "Total" },
];

// Pilares de entrega
const pilares = [
  {
    numero: "1",
    titulo: "Board Estratégico Mensal",
    icon: Calendar,
    descricao: "Reunião mensal de board externo, com pauta estruturada.",
    oQueAcontece: [
      "Análise de decisões críticas",
      "Avaliação de indicadores estratégicos",
      "Discussão de cenários",
      "Direcionamento claro",
    ],
    participantes: [
      "CEO/fundador",
      "UNV (board externo)",
      "Convidados estratégicos (quando aplicável)",
    ],
    entregaveis: [
      "Ata de decisões",
      "Lista de prioridades estratégicas",
      "Direcionamento documentado",
    ],
    ganho: "Eu não decido mais sozinho.",
  },
  {
    numero: "2",
    titulo: "Acompanhamento Semanal (Checkpoints)",
    icon: MessageSquare,
    descricao: "Acompanhamento tático para garantir que decisões não fiquem no papel.",
    oQueUNVFaz: [
      "Verifica execução do que foi decidido",
      "Ajusta rota quando necessário",
      "Apoia o CEO em decisões emergenciais",
    ],
    frequencia: "Semanal (reuniões curtas ou check-ins)",
    entregaveis: [
      "Correções de rota",
      "Repriorização quando necessário",
    ],
    ganho: "Decisão vira ação.",
  },
  {
    numero: "3",
    titulo: "Benchmark Estruturado",
    icon: BarChart3,
    descricao: "Acesso a padrões reais de empresas em estágio semelhante.",
    comoFunciona: [
      "Comparativos anonimizados",
      "Discussão de práticas que funcionam",
      "Identificação de padrões vencedores",
    ],
    aviso: "Sem exposição de dados sensíveis.",
    ganho: "Eu paro de reinventar a roda.",
  },
  {
    numero: "4",
    titulo: "Eventos Presenciais Exclusivos",
    icon: Globe,
    descricao: "Encontros fechados para discussão de alto nível.",
    caracteristicas: [
      "Grupos pequenos",
      "Curadoria rígida",
      "Discussão de decisões reais",
      "Networking de elite",
    ],
    ganho: "Conversas que eu não teria em nenhum outro lugar.",
  },
  {
    numero: "5",
    titulo: "Mansão Empresarial (Exclusivo)",
    icon: Home,
    descricao: "Experiência mensal ultra exclusiva na casa do Fabrício.",
    comoFunciona: [
      "Até 5 empresários por mês",
      "Convidados selecionados",
      "Ambiente privado",
      "Discussões reais de negócio",
      "Networking de altíssimo nível",
      "Custos por conta do cliente",
    ],
    aviso: "Não é evento. É bastidor.",
    ganho: "Acesso que dinheiro não compra facilmente.",
  },
  {
    numero: "6",
    titulo: "UNV AI Advisor (Nível Strategic)",
    icon: Bot,
    descricao: "Camada de apoio estratégico contínuo.",
    oQueIAFaz: [
      "Organiza decisões",
      "Prepara pautas de board",
      "Gera resumos executivos",
      "Apoia follow-ups estratégicos",
    ],
    aviso: "Não substitui pessoas, amplifica clareza.",
    ganho: "Clareza multiplicada.",
  },
];

// Cadência
const cadenciaMensal = [
  "Board estratégico",
  "Decisões-chave",
  "Redefinição de prioridades",
];

const cadenciaSemanal = [
  "Checkpoint de execução",
  "Correção de rota",
];

const cadenciaTrimestral = [
  "Revisão estratégica profunda",
  "Avaliação de cenário",
  "Ajuste de direção",
];

// Entregáveis consolidados
const entregaveisConsolidados = [
  "Board mensal com atas",
  "Direcionamento estratégico documentado",
  "Correção de rota contínua",
  "Benchmark estruturado",
  "Eventos presenciais exclusivos",
  "Mansão Empresarial",
  "UNV AI Advisor estratégico",
];

// Ganhos
const ganhosImediatos = [
  { icon: Zap, text: "Menos ruído" },
  { icon: Eye, text: "Mais clareza" },
  { icon: Shield, text: "Decisões mais seguras" },
];

const ganhosEstrategicos = [
  { icon: Target, text: "Menos erros caros" },
  { icon: TrendingUp, text: "Crescimento sustentável" },
  { icon: Users, text: "Redução da solidão do CEO" },
];

// O que NÃO entrega
const naoEntrega = [
  "Não executa operações",
  "Não substitui gestores",
  "Não garante crescimento",
  "Não aceita todos",
];

export default function PartnersPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center hero-dark">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${partnersHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              <Crown className="h-4 w-4" />
              Direção Estratégica & Parceria Executiva
            </div>
            <h1 className="heading-display hero-title mb-6">
              UNV Partners
            </h1>
            <p className="text-2xl md:text-3xl hero-subtitle font-medium mb-4">
              Onde decisões grandes são tomadas com critério.
            </p>
            <p className="text-lg hero-description mb-8 max-w-2xl">
              A UNV atua como direção estratégica contínua, no formato de board externo,
              ajudando o empresário a tomar decisões melhores, mais rápidas e com menos risco.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar para Membership
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-white/30 text-white hover:bg-white/10">
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
                O UNV Partners é o programa onde a UNV atua como direção estratégica contínua, 
                no formato de board externo, ajudando o empresário a tomar decisões melhores, 
                mais rápidas e com menos risco.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 bg-accent/5 border-accent/20">
                <p className="text-foreground font-medium text-lg">
                  📌 UNV Partners existe quando decidir errado custa caro demais.
                </p>
              </div>
              <div className="card-premium p-6">
                <p className="text-muted-foreground">
                  Não é mentoria. Não é consultoria pontual. É <span className="text-foreground font-semibold">parceria estratégica de decisão.</span>
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
              O Papel da UNV no Partners
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
                  ⚠️ A UNV não executa operações, não substitui C-levels, não gerencia equipes.
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
                  <p className="text-sm font-medium text-muted-foreground mb-3">Perfil Comportamental:</p>
                  <ul className="space-y-2">
                    {perfilComportamental.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
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
              Duração, Formato e Governança
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {formato.map((item, i) => (
                <div key={i} className="card-premium p-5 text-center">
                  <p className="text-small uppercase tracking-wider text-muted-foreground mb-1">
                    {item.label}
                  </p>
                  <p className="text-foreground font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central do Partners
            </h2>
            <p className="text-xl text-foreground mb-8 max-w-3xl mx-auto">
              Garantir direção estratégica consistente, ajudando o empresário a:
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
              {[
                "Tomar melhores decisões",
                "Evitar erros caros",
                "Priorizar com critério",
                "Sustentar crescimento saudável",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura de Entrega - 6 Pilares */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Estrutura Completa de Entrega
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              6 pilares que sustentam sua direção estratégica.
            </p>

            <div className="space-y-6">
              {pilares.map((pilar, i) => (
                <div key={i} className="card-premium p-6 lg:p-8 bg-background">
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
                      
                      {pilar.oQueAcontece && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que acontece:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueAcontece.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueUNVFaz && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a UNV faz:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVFaz.map((item, j) => (
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
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a IA faz:</p>
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

                      {pilar.comoFunciona && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Como funciona:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.comoFunciona.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.caracteristicas && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Características:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.caracteristicas.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.participantes && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Participantes:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.participantes.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.frequencia && (
                        <p className="text-sm text-muted-foreground mb-4">
                          <span className="font-medium">Frequência:</span> {pilar.frequencia}
                        </p>
                      )}

                      {pilar.aviso && (
                        <p className="text-sm text-muted-foreground/80 italic">
                          ⚠️ {pilar.aviso}
                        </p>
                      )}
                    </div>

                    <div>
                      {pilar.entregaveis && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Entregáveis:</p>
                          <ul className="space-y-2 mb-6">
                            {pilar.entregaveis.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <FileText className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

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

      {/* Mansion Experience Highlight */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-6xl mx-auto">
            <div className="card-highlight overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Home className="h-8 w-8 text-accent" />
                    <h2 className="heading-card text-foreground text-2xl">
                      Mansão Empresarial
                    </h2>
                  </div>
                  <p className="text-body text-lg mb-6">
                    Experiência mensal ultra exclusiva na casa do Fabrício.
                    Não é evento. É bastidor.
                  </p>
                  <ul className="space-y-3 mb-6">
                    {[
                      "Até 5 empresários por mês",
                      "Convidados selecionados",
                      "Ambiente privado",
                      "Discussões reais de negócio",
                      "Networking de altíssimo nível",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-accent" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <p className="text-small text-muted-foreground">
                      Custos (viagem, hospedagem, atividades) por conta do cliente.
                    </p>
                  </div>
                </div>
                <div className="relative min-h-[400px] lg:min-h-0">
                  <img
                    src={mansionImage}
                    alt="Mansão Empresarial UNV Partners"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent lg:bg-gradient-to-l" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cadência Operacional */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Cadência Operacional do Partners
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-premium p-6">
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

              <div className="card-premium p-6">
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

              <div className="card-premium p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-accent" />
                  <h3 className="font-semibold text-foreground">Trimestral</h3>
                </div>
                <ul className="space-y-2">
                  {cadenciaTrimestral.map((item, i) => (
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
              Ganhos Reais do Partners
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Ganhos Imediatos */}
              <div className="card-premium p-6">
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

              {/* Ganhos Estratégicos */}
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ganhos Estratégicos
                </h3>
                <div className="space-y-4">
                  {ganhosEstrategicos.map((item, i) => (
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
              O Que o Partners NÃO Entrega
            </h2>
            <p className="text-body text-center mb-8">
              👉 Ele orienta decisões.
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

      {/* Caminho Natural */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Caminho Natural Após o Partners
            </h2>
            <div className="card-premium p-8 bg-accent/5 border-accent/20">
              <Crown className="h-12 w-12 text-accent mx-auto mb-4" />
              <p className="text-xl text-foreground font-medium">
                O UNV Partners não é ponte.
              </p>
              <p className="text-xl text-foreground font-bold">
                Ele é o topo da escada.
              </p>
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
            R$ 4.000
          </p>
          <p className="text-muted-foreground text-lg mb-2">
            Por mês
          </p>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Aplicação obrigatória • Vagas limitadas
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar para Membership
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
              "UNV Partners é onde decisões grandes são tomadas com critério."
            </blockquote>
          </div>
        </div>
      </section>
    </Layout>
  );
}

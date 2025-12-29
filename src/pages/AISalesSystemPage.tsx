import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Brain, 
  MessageSquare, 
  Bot,
  Zap,
  TrendingUp,
  Users,
  Clock,
  Phone,
  Instagram,
  Database,
  Settings,
  Sparkles,
  Shield,
  XCircle,
  Target,
  BarChart,
  Layers,
  Rocket,
  Crown
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoAISalesSystem from "@/assets/logo-ai-sales-system.png";

// Funcionalidades CRM
const crmFeatures = [
  "Pipeline focado em outbound e inbound",
  "Registro automático de interações",
  "Lead scoring por IA",
  "Histórico unificado (WhatsApp + Instagram)",
];

// Agentes de IA
const agentTypes = [
  {
    name: "AI SDR",
    icon: Phone,
    actions: ["Prospecta (B2B)", "Qualifica", "Agenda reuniões"],
    color: "bg-blue-500",
  },
  {
    name: "AI Atendimento",
    icon: MessageSquare,
    actions: ["Responde dúvidas", "Direciona para vendas", "Retém leads"],
    color: "bg-emerald-500",
  },
  {
    name: "AI Social Setter",
    icon: Instagram,
    actions: ["Atua no Instagram DM", "Qualifica", "Agenda"],
    color: "bg-pink-500",
  },
];

// Problemas
const problemasReais = [
  { icon: Users, text: "SDR caro e difícil de escalar" },
  { icon: Clock, text: "Follow-ups manuais e esquecidos" },
  { icon: Database, text: "CRM cheio, mas improdutivo" },
  { icon: MessageSquare, text: "Atendimento lento no WhatsApp e Instagram" },
  { icon: XCircle, text: "Leads não respondidos = dinheiro perdido" },
];

// Solução
const solucoes = [
  { icon: Zap, text: "Velocidade" },
  { icon: TrendingUp, text: "Escala" },
  { icon: Shield, text: "Padronização" },
  { icon: Target, text: "Redução de custo por venda" },
  { icon: Clock, text: "Atendimento 24/7" },
];

// Pacotes
const pacotes = [
  {
    nome: "STARTER AI",
    cor: "bg-blue-500",
    corBorder: "border-blue-500/30",
    corBg: "bg-blue-500/10",
    descricao: "Para empresas iniciando automação comercial",
    tokens: "500.000 tokens/mês",
    features: [
      "1 agente de IA",
      "CRM de prospecção",
      "1 conexão WhatsApp",
      "Atendimento básico via Instagram",
      "Templates prontos de SDR",
      "Relatórios básicos",
    ],
    implementacao: "R$ 2.500",
    mensalidade: "R$ 297/mês",
  },
  {
    nome: "GROWTH AI",
    cor: "bg-emerald-500",
    corBorder: "border-emerald-500/30",
    corBg: "bg-emerald-500/10",
    descricao: "Para times comerciais em crescimento",
    tokens: "1.000.000 tokens/mês",
    features: [
      "Até 3 agentes de IA",
      "CRM completo",
      "1 conexão WhatsApp",
      "Atendimento WhatsApp + Instagram",
      "Agentes treináveis",
      "Funil e follow-up automáticos",
      "Relatórios avançados",
    ],
    implementacao: "R$ 4.500",
    mensalidade: "R$ 597/mês",
    popular: true,
  },
  {
    nome: "SCALE AI",
    cor: "bg-amber-500",
    corBorder: "border-amber-500/30",
    corBg: "bg-amber-500/10",
    descricao: "Para operações B2B estruturadas",
    tokens: "5.000.000 tokens/mês",
    features: [
      "Até 5 agentes de IA",
      "CRM avançado",
      "Playbooks customizados",
      "Lead scoring por IA",
      "Integração com processo do cliente",
      "Dashboards de performance",
    ],
    implementacao: "R$ 7.500",
    mensalidade: "R$ 1.197/mês",
  },
  {
    nome: "PRO AI",
    cor: "bg-red-500",
    corBorder: "border-red-500/30",
    corBg: "bg-red-500/10",
    descricao: "Para empresas com alto volume comercial",
    tokens: "10.000.000 tokens/mês",
    features: [
      "Até 10 agentes de IA",
      "Orquestração multi-agente",
      "Regras complexas de decisão",
      "Integração com SDR humano",
      "Relatórios executivos",
    ],
    implementacao: "R$ 12.000",
    mensalidade: "R$ 2.497/mês",
  },
  {
    nome: "ENTERPRISE AI",
    cor: "bg-violet-500",
    corBorder: "border-violet-500/30",
    corBg: "bg-violet-500/10",
    descricao: "Infraestrutura comercial com IA",
    tokens: "50M a 100M tokens/mês",
    features: [
      "Agentes ilimitados",
      "Arquitetura dedicada",
      "Customizações avançadas",
      "SLA prioritário",
      "Integração total com stack do cliente",
    ],
    implementacao: "a partir de R$ 25.000",
    mensalidade: "R$ 4.997 a R$ 9.997/mês",
  },
];

// Canais
const canaisIntegrados = [
  { icon: Phone, text: "WhatsApp (1 conexão inclusa)", status: "available" },
  { icon: Instagram, text: "Instagram DM", status: "available" },
  { icon: MessageSquare, text: "E-mail (roadmap)", status: "soon" },
];

// Conexão ecossistema
const conexaoEcossistema = [
  { nome: "UNV Sales Acceleration", descricao: "Estratégia", href: "/sales-acceleration" },
  { nome: "UNV Sales Ops", descricao: "Processo", href: "/sales-ops" },
  { nome: "UNV Ads", descricao: "Leads", href: "/ads" },
  { nome: "UNV Sales Force", descricao: "Humano + IA", href: "/sales-force" },
  { nome: "UNV Growth Room", descricao: "Decisão", href: "/growth-room" },
];

export default function AISalesSystemPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center bg-gradient-to-br from-background via-background to-cyan-500/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-4 bg-white/95 rounded-2xl shadow-xl mb-8">
              <img src={logoAISalesSystem} alt="UNV Sales System" className="h-20 md:h-28" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-600 text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-cyan-500/30">
              <Brain className="h-4 w-4" />
              AI-Driven CRM, Autonomous Sales Agents & B2B Prospecting
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
              UNV Sales System
            </h1>
            <p className="text-xl md:text-2xl text-foreground/80 mb-4 font-medium">
              Não é um CRM. Não é um chatbot.
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              É um sistema de inteligência comercial que prospecta, qualifica e atende.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/diagnostico">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
                  Solicitar Demo
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-cyan-500/30 text-foreground hover:bg-cyan-500/10">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="blue"
        productNumber={0}
        productName="UNV SALES SYSTEM"
        tagline="Inteligência Comercial Autônoma"
        whatItDoes="Sistema completo de IA para vendas: CRM + Agentes Autônomos + Atendimento (B2B e B2C)."
        keyPoints={[
          "CRM inteligente com lead scoring por IA",
          "Agentes de IA autônomos (SDR, Atendimento, Qualificação)",
          "Atendimento via WhatsApp e Instagram",
          "Prospecção automatizada (exclusivo B2B)",
          "Aprendizado contínuo com dados reais"
        ]}
        arrow="Infraestrutura de vendas com IA aplicada."
        targetAudience={{
          revenue: "Empresas B2B e B2C",
          team: "Buscando escala comercial"
        }}
        schedule={[
          { period: "Setup", description: "Implementação guiada" },
          { period: "Mensal", description: "SaaS + Tokens" },
          { period: "Contínuo", description: "Aprendizado da IA" }
        ]}
        scheduleType="recurring"
      />

      {/* O que é */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                O Que É o Produto
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto mb-8">
                O UNV Sales System é um sistema completo de inteligência artificial para vendas, que combina:
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Database, text: "CRM inteligente com lead scoring" },
                { icon: Bot, text: "Agentes de IA autônomos" },
                { icon: Phone, text: "Atendimento via WhatsApp e Instagram" },
                { icon: Layers, text: "Orquestração de funil e follow-ups" },
                { icon: Sparkles, text: "Aprendizado contínuo com dados reais" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium bg-cyan-500/5 border-cyan-500/20">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <span className="text-foreground font-medium text-sm">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-premium p-6 bg-cyan-500/5 border-cyan-500/20">
                <p className="text-foreground font-medium text-lg">
                  👉 Diferente do mercado, não é só ferramenta
                </p>
              </div>
              <div className="card-premium p-6 bg-blue-500/5 border-blue-500/20">
                <p className="text-foreground font-medium text-lg">
                  👉 É infraestrutura de vendas com IA aplicada
                </p>
              </div>
              <div className="card-premium p-6 bg-amber-500/5 border-amber-500/20">
                <p className="text-foreground font-medium text-lg">
                  👉 B2B e B2C (prospecção exclusiva B2B)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problema Real */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Problema Real Que Ele Resolve
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Empresas hoje enfrentam:
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Problemas */}
              <div className="card-premium p-8">
                <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-destructive" />
                  Desafios Atuais
                </h3>
                <div className="space-y-4">
                  {problemasReais.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                      <item.icon className="h-5 w-5 text-destructive" />
                      <span className="text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Soluções */}
              <div className="card-premium p-8 bg-cyan-500/5 border-cyan-500/20">
                <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-cyan-600" />
                  O UNV A.I. Resolve
                </h3>
                <div className="space-y-4">
                  {solucoes.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                      <item.icon className="h-5 w-5 text-cyan-600" />
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-6xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Funcionalidades-Chave do Sistema
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Tudo que você precisa para escalar vendas B2B com inteligência artificial.
            </p>

            {/* CRM */}
            <div className="card-premium p-8 mb-8 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Database className="h-7 w-7 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">🧠 CRM de Prospecção B2B</h3>
                  <p className="text-muted-foreground">Nativo e integrado</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {crmFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                    <span className="text-foreground text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agentes de IA */}
            <div className="card-premium p-8 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">🤖 Agentes de IA</h3>
                  <p className="text-muted-foreground">Core do Produto</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6">
                Dentro do próprio sistema, o cliente pode criar e treinar agentes:
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                {agentTypes.map((agent, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${agent.color}/20 bg-gradient-to-br from-${agent.color}/5 to-transparent`}>
                    <div className={`w-12 h-12 rounded-xl ${agent.color} flex items-center justify-center mb-4`}>
                      <agent.icon className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">{agent.name}</h4>
                    <ul className="space-y-2">
                      {agent.actions.map((action, j) => (
                        <li key={j} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <CheckCircle className="h-4 w-4 text-accent" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Cada agente:</span> segue playbooks, respeita regras de negócio, aprende com conversas reais.
                </p>
              </div>
            </div>

            {/* Canais Integrados */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Phone className="h-7 w-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">📲 Canais Integrados</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {canaisIntegrados.map((canal, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${canal.status === 'available' ? 'bg-green-500/10 border border-green-500/20' : 'bg-secondary/50'}`}>
                      <div className="flex items-center gap-2">
                        <canal.icon className={`h-5 w-5 ${canal.status === 'available' ? 'text-green-600' : 'text-muted-foreground'}`} />
                        <span className="text-foreground text-sm">{canal.text}</span>
                      </div>
                      {canal.status === 'available' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground">Em breve</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-premium p-8 bg-accent/5 border-accent/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Settings className="h-7 w-7 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">⚙️ Implementação Guiada</h3>
                    <p className="text-muted-foreground text-sm">Diferencial UNV</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    "Setup técnico completo",
                    "Treinamento dos agentes",
                    "Parametrização de mensagens",
                    "Integração com processo comercial do cliente",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-foreground">
                      <CheckCircle className="h-5 w-5 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pacotes */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-7xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Pacotes Oficiais
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Escolha o plano ideal para o momento da sua empresa.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pacotes.slice(0, 3).map((pacote, i) => (
                <div key={i} className={`card-premium p-6 relative ${pacote.popular ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-500/20' : ''}`}>
                  {pacote.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold rounded-full">
                      Mais Popular
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl ${pacote.cor} flex items-center justify-center mb-4`}>
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{pacote.nome}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{pacote.descricao}</p>
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${pacote.corBg} ${pacote.cor.replace('bg-', 'text-').replace('-500', '-600')} mb-4`}>
                    {pacote.tokens}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {pacote.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border/30 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Implementação:</span>
                      <span className="font-semibold text-foreground">{pacote.implementacao}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mensalidade:</span>
                      <span className="font-bold text-lg text-foreground">{pacote.mensalidade}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pacotes maiores */}
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {pacotes.slice(3).map((pacote, i) => (
                <div key={i} className="card-premium p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${pacote.cor} flex items-center justify-center flex-shrink-0`}>
                      {i === 0 ? <Rocket className="h-6 w-6 text-white" /> : <Crown className="h-6 w-6 text-white" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-2">{pacote.nome}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{pacote.descricao}</p>
                      <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${pacote.corBg} ${pacote.cor.replace('bg-', 'text-').replace('-500', '-600')} mb-4`}>
                        {pacote.tokens}
                      </div>
                      <ul className="grid sm:grid-cols-2 gap-2 mb-4">
                        {pacote.features.map((feature, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Implementação: </span>
                          <span className="font-semibold text-foreground">{pacote.implementacao}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mensalidade: </span>
                          <span className="font-bold text-foreground">{pacote.mensalidade}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Por que faz sentido */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Por Que Esse Preço Faz Sentido
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="card-premium p-6">
                <div className="text-3xl font-bold text-destructive mb-2">R$ 4k–6k</div>
                <p className="text-muted-foreground">Custo de 1 SDR/mês</p>
              </div>
              <div className="card-premium p-6">
                <div className="text-3xl font-bold text-destructive mb-2">R$ 15k+</div>
                <p className="text-muted-foreground">Custo de um time mínimo</p>
              </div>
              <div className="card-premium p-6 bg-cyan-500/10 border-cyan-500/30">
                <div className="text-3xl font-bold text-cyan-600 mb-2">&lt; 60 dias</div>
                <p className="text-foreground font-medium">ROI típico</p>
              </div>
            </div>

            <div className="card-premium p-8 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
              <h3 className="text-xl font-bold text-foreground mb-4">O UNV AI:</h3>
              <div className="grid sm:grid-cols-4 gap-4">
                {[
                  { icon: Clock, text: "Trabalha 24/7" },
                  { icon: CheckCircle, text: "Não falta" },
                  { icon: Target, text: "Não esquece follow-up" },
                  { icon: TrendingUp, text: "Escala instantaneamente" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 p-4">
                    <item.icon className="h-8 w-8 text-cyan-600" />
                    <span className="text-foreground font-medium text-sm text-center">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conexão Ecossistema */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Conexão com o Ecossistema UNV
            </h2>
            <p className="text-body text-center mb-12">
              Upsells naturais para potencializar seus resultados:
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {conexaoEcossistema.map((item, i) => (
                <Link 
                  key={i} 
                  to={item.href}
                  className="card-premium p-5 hover:border-primary/50 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.nome}</h4>
                      <p className="text-sm text-muted-foreground">{item.descricao}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Frase Final */}
      <section className="section-padding bg-gradient-to-br from-cyan-500/10 via-background to-blue-500/10">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <Brain className="h-16 w-16 text-cyan-600 mx-auto mb-8" />
            <blockquote className="text-3xl md:text-4xl font-bold text-foreground mb-8 leading-tight">
              "Não aumente seu time.<br />
              <span className="text-cyan-600">Aumente sua inteligência comercial."</span>
            </blockquote>
            <Link to="/diagnostico">
              <Button variant="hero" size="xl" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700">
                Solicitar Demonstração
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
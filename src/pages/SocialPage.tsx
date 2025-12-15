import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Users2, 
  Target, 
  MessageSquare, 
  BarChart3, 
  Sparkles, 
  XCircle,
  FileText,
  Eye,
  Megaphone,
  TrendingUp,
  Heart,
  Zap
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoSocial from "@/assets/logo-social.png";

const pillars = [
  {
    title: "Diagnóstico de Posicionamento Comercial",
    description: "Análise profunda de como a empresa se apresenta hoje.",
    items: [
      "Mensagem atual",
      "Clareza da oferta",
      "Conteúdos existentes",
      "Perfil do público",
      "Alinhamento com o discurso de vendas"
    ],
    deliverables: [
      "Diagnóstico de posicionamento",
      "Lista de ajustes prioritários",
      "Direcionamento de mensagem"
    ],
    gain: "Meu conteúdo finalmente conversa com o que eu vendo.",
    icon: Eye
  },
  {
    title: "Estratégia de Conteúdo Orientada a Vendas",
    description: "Definição de linhas editoriais com intenção comercial.",
    items: [
      "Conteúdo de autoridade",
      "Conteúdo de prova",
      "Conteúdo de decisão",
      "Conteúdo de objeção",
      "Conteúdo de bastidor (confiança)"
    ],
    deliverables: [
      "Mapa editorial estratégico",
      "Calendário mensal",
      "Objetivo comercial por tipo de post"
    ],
    gain: "Cada post tem um porquê.",
    icon: FileText
  },
  {
    title: "Conteúdo como Pré-Venda",
    description: "Uso do social como filtro e aquecimento.",
    items: [
      "Conteúdos que afastam lead errado",
      "Conteúdos que qualificam o lead",
      "Conteúdos que antecipam objeções",
      "Conteúdos que validam a oferta"
    ],
    deliverables: [
      "Roteiros de posts e vídeos",
      "Estrutura de stories comerciais",
      "Conteúdos de reforço pós-contato"
    ],
    gain: "O lead chega mais preparado para comprar.",
    icon: Target
  },
  {
    title: "Integração com o Comercial",
    description: "Social não anda sozinho.",
    items: [
      "Alinhamento com scripts de vendas",
      "Conteúdos usados pelo vendedor",
      "Uso do social no follow-up",
      "Ajuste de mensagem conforme objeções reais"
    ],
    deliverables: [
      "Biblioteca de conteúdos para vendas",
      "Roteiro de uso do social no processo comercial",
      "Ajustes contínuos de mensagem"
    ],
    gain: "O vendedor para de vender no escuro.",
    icon: Users2
  },
  {
    title: "Integração com Tráfego (Ads)",
    description: "Social preparado para performar melhor com tráfego.",
    items: [
      "Conteúdos que viram criativos",
      "Conteúdos para remarketing",
      "Conteúdos de aquecimento pré-anúncio",
      "Conteúdos de validação pós-anúncio"
    ],
    deliverables: [
      "Conteúdos reaproveitáveis em Ads",
      "Alinhamento Social ↔ Ads ↔ Comercial"
    ],
    gain: "Meu tráfego converte melhor porque o social sustenta.",
    icon: Megaphone
  },
  {
    title: "Produção, Publicação e Controle",
    description: "Gestão contínua do social.",
    items: [
      "Planeja conteúdo",
      "Cria ou orienta criação",
      "Publica conforme estratégia",
      "Ajusta conforme performance"
    ],
    deliverables: [
      "Conteúdos publicados",
      "Relatórios simples de performance",
      "Ajustes mensais"
    ],
    gain: "O social vira ativo, não custo.",
    icon: BarChart3
  },
  {
    title: "UNV AI Advisor (Nível Social)",
    description: "Apoiar decisões de conteúdo e uso comercial.",
    items: [
      "Sugere pautas alinhadas à venda",
      "Ajuda o vendedor a usar conteúdo",
      "Resume aprendizados do mês",
      "Apoia ajustes de mensagem"
    ],
    deliverables: [
      "Suporte contínuo via IA",
      "Recomendações estratégicas"
    ],
    gain: "Não cria post sozinha, apoia estratégia.",
    icon: Sparkles
  }
];

const deliverables = [
  "Diagnóstico de posicionamento",
  "Estratégia editorial orientada a vendas",
  "Calendário mensal",
  "Roteiros de conteúdo",
  "Conteúdos de pré-venda",
  "Biblioteca para vendedores",
  "Integração com Ads",
  "Relatórios orientados a conversão",
  "UNV AI Advisor (social)"
];

const immediateGains = [
  "Mensagem mais clara",
  "Conteúdo mais estratégico",
  "Menos objeções na venda"
];

const structuralGains = [
  "Autoridade construída",
  "Ciclo de venda encurtado",
  "Melhor conversão de tráfego",
  "Marca com intenção"
];

const notDelivered = [
  "Não promete seguidores",
  "Não promete viral",
  "Não cria conteúdo sem intenção",
  "Não substitui o comercial"
];

export default function SocialPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-background to-background" />
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="container-premium relative z-10 py-32">
          <div className="max-w-4xl">
            <img src={logoSocial} alt="UNV Social" className="h-20 md:h-24 mb-6 animate-fade-up" />
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-full text-pink-400 text-sm font-medium mb-8 animate-fade-up">
              <Heart className="h-4 w-4" />
              Social Media as a Sales Enablement Channel
            </div>
            
            <p className="text-2xl md:text-3xl text-muted-foreground mb-6 animate-fade-up delay-200">
              Transforme redes sociais em um{" "}
              <span className="text-foreground font-semibold">ativo comercial.</span>
            </p>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl animate-fade-up delay-300">
              A UNV Social não existe para "postar conteúdo". Ela existe para preparar o lead para comprar.
              Não é social de engajamento vazio. É conteúdo com função comercial clara.
            </p>

            <div className="flex flex-wrap gap-4 animate-fade-up delay-400">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar para Diagnóstico
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="hero-outline" size="xl">
                  Comparar Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="purple"
        productNumber={8}
        productName="UNV SOCIAL"
        tagline="Social como Pré-Venda"
        whatItDoes="Usa redes sociais para aquecer, filtrar e convencer o lead."
        keyPoints={[
          "Autoridade",
          "Conteúdo com intenção",
          "Redução de objeções",
          "Suporte ao vendedor",
          "Integração com Ads"
        ]}
        arrow="Conteúdo que ajuda a vender."
        targetAudience={{
          revenue: "Empresas onde confiança influencia a compra"
        }}
        schedule={[
          { period: "Mensal", description: "Planejamento" },
          { period: "Semanal", description: "Publicações" },
          { period: "Contínuo", description: "Ajustes" }
        ]}
        scheduleType="recurring"
      />

      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground mb-8 text-center">
              O Papel da UNV no Social
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Diretor de Comunicação Comercial", desc: "Estratégia de conteúdo orientada a vendas" },
                { title: "Estrategista de Autoridade", desc: "Construção de credibilidade no mercado" },
                { title: "Tradutor da Oferta", desc: "Oferta transformada em conteúdo" },
                { title: "Integrador Social ↔ Vendas ↔ Tráfego", desc: "Canais conectados em uma estratégia única" },
                { title: "Guardião da Mensagem", desc: "Consistência em toda comunicação" }
              ].map((role, i) => (
                <div key={i} className="card-premium p-6">
                  <h3 className="font-semibold text-foreground mb-2">{role.title}</h3>
                  <p className="text-sm text-muted-foreground">{role.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-pink-500/10 border border-pink-500/30 rounded-xl">
              <p className="text-center text-muted-foreground">
                <span className="text-pink-400 font-semibold">⚠️ Importante:</span> A UNV não promete seguidores, 
                não promete viralização, não substitui o comercial.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Para Quem é a UNV Social
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Cliente Ideal</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Empresas faturando <span className="text-foreground font-semibold">R$ 80k a R$ 1M+/mês</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Decisão de compra envolve <span className="text-foreground font-semibold">confiança</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Lead <span className="text-foreground font-semibold">pesquisa antes de comprar</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Empresários, especialistas, B2B, serviços de ticket médio/alto</span>
                </li>
              </ul>

              <div className="mt-6 p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-semibold">Perfil ideal:</span> Já vendem, mas social não ajuda a vender,
                  conteúdo não conversa com a venda, vendedores precisam "convencer demais".
                </p>
              </div>
            </div>

            <div className="card-premium p-8 border-destructive/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Não é Para</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem quer viral por vaidade</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem só quer crescer seguidores</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Negócios de impulso puro</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Empresas sem oferta clara</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Objective */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central
            </h2>
            <p className="text-2xl text-muted-foreground mb-8">
              Criar <span className="text-foreground font-semibold">autoridade que reduz objeções</span> e{" "}
              <span className="text-foreground font-semibold">encurta o ciclo de vendas.</span>
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Zap, text: "Aquecer o lead antes da conversa" },
                { icon: CheckCircle, text: "Reforçar a decisão depois do contato" },
                { icon: MessageSquare, text: "Dar munição para o vendedor" },
                { icon: TrendingUp, text: "Aumentar taxa de conversão" }
              ].map((item, i) => (
                <div key={i} className="card-premium p-4">
                  <item.icon className="h-8 w-8 text-pink-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-4 text-center">
            Estrutura de Entrega
          </h2>
          <p className="text-body text-center mb-12 max-w-2xl mx-auto">
            7 pilares de atuação para transformar seu social em canal de vendas.
          </p>

          <div className="space-y-8">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div key={index} className="card-premium p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-7 w-7 text-pink-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        Pilar {index + 1} — {pillar.title}
                      </h3>
                      <p className="text-muted-foreground mb-6">{pillar.description}</p>
                      
                      <div className="grid lg:grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">O que a UNV faz</h4>
                          <ul className="space-y-2">
                            {pillar.items.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">Entregáveis</h4>
                          <ul className="space-y-2">
                            {pillar.deliverables.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-2 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="lg:col-span-1">
                          <h4 className="text-sm font-semibold text-foreground mb-3">Ganho</h4>
                          <p className="text-sm text-pink-400 font-medium italic">"{pillar.gain}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Entregáveis Consolidados
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {deliverables.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
                <CheckCircle className="h-5 w-5 text-pink-400 flex-shrink-0" />
                <span className="text-foreground font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Ganhos Reais
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="card-premium p-8">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Zap className="h-6 w-6 text-pink-400" />
                Ganhos Imediatos
              </h3>
              <ul className="space-y-3">
                {immediateGains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-premium p-8">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-pink-400" />
                Ganhos Estruturais
              </h3>
              <ul className="space-y-3">
                {structuralGains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What's Not Included */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground mb-8 text-center">
              O Que a UNV Social Não Entrega
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {notDelivered.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            
            <p className="text-center text-xl text-foreground font-semibold">
              👉 Ela prepara a venda.
            </p>
          </div>
        </div>
      </section>

      {/* Format & Investment */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card-premium p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">Formato</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                    <div>
                      <span className="text-foreground font-semibold">Produto recorrente</span>
                      <p className="text-sm text-muted-foreground">Gestão estratégica + produção orientada</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                    <div>
                      <span className="text-foreground font-semibold">Contrato mínimo recomendado</span>
                      <p className="text-sm text-muted-foreground">3 a 6 meses</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5" />
                    <div>
                      <span className="text-foreground font-semibold">Integrável com</span>
                      <p className="text-sm text-muted-foreground">UNV Ads e UNV Sales Acceleration</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="card-highlight p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">Investimento</h3>
                <div className="text-4xl font-bold text-primary mb-2">
                  R$ 1.500 a R$ 3.500<span className="text-lg font-normal text-muted-foreground">/mês</span>
                </div>
                <p className="text-muted-foreground mb-6">
                  De acordo com a quantidade de posts
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    Contrato mínimo recomendado
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-accent" />
                    Produção e gestão conforme plano
                  </li>
                </ul>
                <Link to="/apply">
                  <Button variant="premium" className="w-full" size="lg">
                    Aplicar Agora
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Natural Path */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Caminho Natural com a UNV Social
            </h2>
            <p className="text-muted-foreground mb-8">
              A UNV Social funciona melhor quando combinada com:
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/sales-acceleration">
                <Button variant="premium-outline">UNV Sales Acceleration</Button>
              </Link>
              <Link to="/ads">
                <Button variant="premium-outline">UNV Ads</Button>
              </Link>
              <Link to="/control">
                <Button variant="premium-outline">UNV Control</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Quote */}
      <section className="section-padding bg-gradient-to-br from-pink-900/30 via-background to-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-3xl md:text-4xl font-display font-bold text-foreground mb-8">
              "UNV Social transforma conteúdo em pré-venda — não em enfeite."
            </blockquote>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Comece Agora
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

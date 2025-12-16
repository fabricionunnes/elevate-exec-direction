import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Product {
  name: string;
  tagline: string;
  description: string;
  icp: string;
  href: string;
  investment: string;
  highlight?: boolean;
  external?: boolean;
}

const ProductCard = ({ product, index, compact }: { product: Product; index: number; compact?: boolean }) => (
  <div
    className={`${
      product.highlight ? "card-highlight" : "card-premium"
    } ${compact ? "p-6" : "p-8 lg:p-10"}`}
  >
    <div className={`flex flex-col ${compact ? "" : "lg:flex-row lg:items-center"} gap-4 ${compact ? "" : "lg:gap-12"}`}>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-medium text-accent uppercase tracking-wider">
            {product.tagline}
          </span>
          {product.highlight && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
              <Sparkles className="h-3 w-3" />
              Destaque
            </span>
          )}
        </div>
        <h2 className={`${compact ? "text-lg" : "heading-card"} font-bold text-foreground mb-2`}>
          {product.name}
        </h2>
        <p className={`text-body ${compact ? "text-sm" : ""} mb-3`}>{product.description}</p>
        <p className="text-small">{product.icp}</p>
      </div>
      <div className={`${compact ? "mt-4" : "lg:text-right lg:min-w-[200px]"}`}>
        <p className={`${compact ? "text-base" : "text-lg"} font-semibold text-foreground mb-4`}>
          {product.investment}
        </p>
        {product.external ? (
          <a href={product.href} target="_blank" rel="noopener noreferrer">
            <Button
              variant="premium-outline"
              size={compact ? "default" : "lg"}
              className="w-full lg:w-auto"
            >
              Conhecer
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Link to={product.href}>
            <Button
              variant={product.highlight ? "premium" : "premium-outline"}
              size={compact ? "default" : "lg"}
              className="w-full lg:w-auto"
            >
              Saiba Mais
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  </div>
);

// Main trail: Core → Control → Sales Acceleration
const mainTrail: Product[] = [
  {
    name: "UNV Core",
    tagline: "Fundação comercial",
    description:
      "Construa a fundação da sua operação comercial. Scripts, funil básico, metas e rotinas mínimas de cobrança.",
    icp: "Faturamento R$ 50k–150k/mês • 1–5 vendedores",
    href: "/core",
    investment: "R$ 1.997",
  },
  {
    name: "UNV Control",
    tagline: "Disciplina de execução",
    description:
      "Direção recorrente para manter seu time executando com consistência. Check-ins mensais, templates e suporte com IA.",
    icp: "Faturamento R$ 100k–400k/mês",
    href: "/control",
    investment: "R$ 5.997/ano",
  },
  {
    name: "UNV Sales Acceleration",
    tagline: "Produto principal",
    description:
      "Programa anual de direção comercial. Treinamos, acompanhamos e cobramos seu time para crescimento acelerado e previsível.",
    icp: "Faturamento R$ 150k–1M/mês • 3+ vendedores",
    href: "/sales-acceleration",
    investment: "R$ 24.000/ano",
    highlight: true,
  },
];

// Support trail: Sales Ops / Ads / Social
const supportTrail: Product[] = [
  {
    name: "UNV Sales Ops",
    tagline: "Padronização de times",
    description:
      "Padronize seu time comercial em escala. Trilhas de treinamento por cargo, scorecards e suporte IA por função.",
    icp: "Faturamento R$ 200k+/mês • 5+ vendedores",
    href: "/sales-ops",
    investment: "R$ 2.500/ano",
  },
  {
    name: "UNV Ads",
    tagline: "Geração de demanda",
    description:
      "Gestão de tráfego pago com foco em geração de leads qualificados. Estratégia, execução e otimização contínua das suas campanhas.",
    icp: "Faturamento R$ 100k+/mês",
    href: "/ads",
    investment: "R$ 1.500–4.000/mês",
  },
  {
    name: "UNV Social",
    tagline: "Social selling",
    description:
      "Posicionamento estratégico nas redes sociais para vendas. Conteúdo, presença e relacionamento que geram oportunidades.",
    icp: "Faturamento R$ 100k+/mês",
    href: "/social",
    investment: "R$ 1.500–3.500/mês",
  },
  {
    name: "UNV Sales Force",
    tagline: "Terceirização de vendas",
    description:
      "SDR e Closer terceirizados. A UNV executa a venda para empresas com demanda qualificada que precisam de conversão profissional.",
    icp: "Faturamento R$ 100k–1M+/mês • 200+ leads/mês",
    href: "/sales-force",
    investment: "R$ 6.000/mês + comissão",
  },
];

// Advanced trail: Growth Room → Partners → Mastermind
const advancedTrail: Product[] = [
  {
    name: "UNV Growth Room",
    tagline: "Estratégia presencial",
    description:
      "Imersão presencial intensiva de 3 dias. Redesenhe sua rota comercial com orientação hands-on e saia com um plano de execução de 90 dias.",
    icp: "Faturamento R$ 150k–600k/mês",
    href: "/growth-room",
    investment: "R$ 12.000",
  },
  {
    name: "UNV Partners",
    tagline: "Elite estratégico",
    description:
      "Reuniões de board mensais, cobrança semanal, eventos exclusivos e a Experiência Mansão. Para empresas estabelecidas que buscam mentoria de elite.",
    icp: "Faturamento R$ 300k–2M/mês",
    href: "/partners",
    investment: "R$ 4.000/mês",
  },
  {
    name: "UNV Mastermind",
    tagline: "Conselho de decisão",
    description:
      "Mastermind exclusivo para empreendedores avançados. Sessões mensais, hot seats, Experiência Mansão e acesso direto a Fabrício.",
    icp: "Faturamento R$ 1M–10M/mês",
    href: "/mastermind",
    investment: "R$ 36.000/ano",
  },
];

// Leadership standalone
const leadershipProduct: Product = {
  name: "UNV Leadership",
  tagline: "Desenvolvimento de líderes",
  description:
    "Desenvolva líderes intermediários capazes de sustentar a execução sem depender do fundador. Gestão de pessoas, performance e decisões.",
  icp: "Faturamento R$ 100k–2M+/mês",
  href: "/leadership",
  investment: "R$ 15.000/ano",
};

// New products
const strategicProducts: Product[] = [
  {
    name: "Le Désir",
    tagline: "Análise estratégica",
    description:
      "Análise estratégica 100% online para empresários. Espaço de escuta, elaboração e consciência voltado à lucidez, presença e tomada de decisão.",
    icp: "Empresários, Fundadores, Sócios, C-Level",
    href: "/le-desir",
    investment: "A partir de R$ 1.200/mês",
  },
  {
    name: "UNV Finance",
    tagline: "Controle financeiro",
    description:
      "Clareza financeira simples, visual e acionável. DRE gerencial, fluxo de caixa, margem por produto e projeção de 90 dias.",
    icp: "Empresários • Empresas em crescimento",
    href: "/finance",
    investment: "R$ 3.000/mês",
  },
  {
    name: "UNV People",
    tagline: "Gestão de pessoas",
    description:
      "Gestão estratégica de pessoas orientada a resultado. Contratação, estrutura de cargos, avaliação de desempenho e formação de líderes.",
    icp: "Empresas em crescimento • Times comerciais",
    href: "/people",
    investment: "R$ 2.500–6.000/mês",
  },
];

// External
const externalProduct: Product = {
  name: "Mansão Empreendedora",
  tagline: "Experiência imersiva",
  description:
    "Imersão presencial exclusiva em ambiente privado. Experiência transformadora para empreendedores que buscam conexão e estratégia de alto nível.",
  icp: "Empreendedores selecionados",
  href: "https://mansaoempreendedora.com.br",
  investment: "Consultar",
  external: true,
};

export default function ProductsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">
              Nossos Produtos
            </h1>
            <p className="text-body text-lg">
              Não é um catálogo—é uma progressão. Cada produto endereça um
              estágio específico de maturidade comercial. Encontre onde você se
              encaixa e cresça a partir daí.
            </p>
          </div>
        </div>
      </section>

      {/* Main Trail: Core → Control → Sales Acceleration */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <h2 className="text-xl font-bold text-foreground">Trilha Principal</h2>
            <span className="text-sm text-muted-foreground">Core → Control → Sales Acceleration</span>
          </div>
          <div className="grid gap-6">
            {mainTrail.map((product, i) => (
              <ProductCard key={product.href} product={product} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Support Trail: Sales Ops / Ads / Social */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <h2 className="text-xl font-bold text-foreground">Suporte à Operação</h2>
            <span className="text-sm text-muted-foreground">Sales Ops • Ads • Social</span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {supportTrail.map((product, i) => (
              <ProductCard key={product.href} product={product} index={i} compact />
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Trail: Growth Room → Partners → Mastermind */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-xl font-bold text-foreground">Trilha Avançada</h2>
            <span className="text-sm text-muted-foreground">Growth Room → Partners → Mastermind</span>
          </div>
          <div className="grid gap-6">
            {advancedTrail.map((product, i) => (
              <ProductCard key={product.href} product={product} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-xl font-bold text-foreground">Desenvolvimento de Líderes</h2>
          </div>
          <ProductCard product={leadershipProduct} index={0} />
        </div>
      </section>

      {/* Strategic Products */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <h2 className="text-xl font-bold text-foreground">Estratégia & Estrutura</h2>
            <span className="text-sm text-muted-foreground">Le Désir • Finance • People</span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {strategicProducts.map((product, i) => (
              <ProductCard key={product.href} product={product} index={i} compact />
            ))}
          </div>
        </div>
      </section>

      {/* External */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <h2 className="text-xl font-bold text-foreground">Experiência Exclusiva</h2>
          </div>
          <ProductCard product={externalProduct} index={0} />
        </div>
      </section>

      {/* Not Sure */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="card-premium p-8 lg:p-12 text-center max-w-3xl mx-auto">
            <h2 className="heading-card text-foreground mb-4">
              Não sabe qual produto é ideal para você?
            </h2>
            <p className="text-body mb-6">
              Use nossa ferramenta de diagnóstico para receber uma recomendação
              personalizada baseada no perfil da sua empresa.
            </p>
            <Link to="/for-closers">
              <Button variant="gold" size="lg">
                Receber Recomendação
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

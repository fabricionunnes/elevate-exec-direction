import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  {
    name: "UNV Core",
    tagline: "Comece com estrutura",
    description:
      "Construa a fundação da sua operação comercial. Scripts, funil básico, metas e rotinas mínimas de cobrança.",
    icp: "Faturamento R$ 50k–150k/mês • 1–5 vendedores",
    href: "/core",
    investment: "R$ 997–R$ 1.997",
  },
  {
    name: "UNV Control",
    tagline: "Mantenha a execução",
    description:
      "Direção recorrente para manter seu time executando com consistência. Check-ins mensais, templates e suporte com IA.",
    icp: "Faturamento R$ 100k–400k/mês",
    href: "/control",
    investment: "R$ 297–R$ 597/mês",
  },
  {
    name: "UNV Sales Acceleration",
    tagline: "Programa principal",
    description:
      "Programa anual de direção comercial. Treinamos, acompanhamos e cobramos seu time para crescimento acelerado e previsível.",
    icp: "Faturamento R$ 150k–1M/mês • 3+ vendedores",
    href: "/sales-acceleration",
    investment: "R$ 24.000–R$ 36.000/ano",
    highlight: true,
  },
  {
    name: "UNV Growth Room",
    tagline: "Estratégia presencial",
    description:
      "Imersão presencial intensiva de 3 dias. Redesenhe sua rota comercial com orientação hands-on e saia com um plano de execução de 90 dias.",
    icp: "Faturamento R$ 150k–600k/mês",
    href: "/growth-room",
    investment: "R$ 12.000–R$ 20.000",
  },
  {
    name: "UNV Partners",
    tagline: "Elite estratégico",
    description:
      "Reuniões de board mensais, cobrança semanal, eventos exclusivos e a Experiência Mansão. Para empresas estabelecidas que buscam mentoria de elite.",
    icp: "Faturamento R$ 300k–2M/mês",
    href: "/partners",
    investment: "R$ 3.000–R$ 6.000/mês",
  },
  {
    name: "UNV Sales Ops",
    tagline: "Padronização de times",
    description:
      "Padronize seu time comercial em escala. Trilhas de treinamento por cargo, scorecards e suporte IA por função.",
    icp: "Faturamento R$ 200k+/mês • 5+ vendedores",
    href: "/sales-ops",
    investment: "R$ 97–R$ 297/usuário/mês",
  },
];

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

      {/* Product Grid */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="grid gap-8">
            {products.map((product, i) => (
              <div
                key={product.href}
                className={`${
                  product.highlight ? "card-highlight" : "card-premium"
                } p-8 lg:p-10`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
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
                    <h2 className="heading-card text-foreground mb-3">
                      {product.name}
                    </h2>
                    <p className="text-body mb-4">{product.description}</p>
                    <p className="text-small">{product.icp}</p>
                  </div>
                  <div className="lg:text-right lg:min-w-[200px]">
                    <p className="text-lg font-semibold text-foreground mb-4">
                      {product.investment}
                    </p>
                    <Link to={product.href}>
                      <Button
                        variant={product.highlight ? "premium" : "premium-outline"}
                        size="lg"
                        className="w-full lg:w-auto"
                      >
                        Saiba Mais
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

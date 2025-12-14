import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  {
    name: "UNV Core",
    tagline: "Start with structure",
    description:
      "Build the foundation of your commercial operation. Scripts, basic funnel, goals, and minimal accountability routines.",
    icp: "R$ 50k–150k/month revenue • 1–5 salespeople",
    href: "/core",
    investment: "R$ 997–R$ 1.997",
  },
  {
    name: "UNV Control",
    tagline: "Maintain execution",
    description:
      "Recurring direction to keep your team executing consistently. Monthly check-ins, templates, and AI-powered support.",
    icp: "R$ 100k–400k/month revenue",
    href: "/control",
    investment: "R$ 297–R$ 597/month",
  },
  {
    name: "UNV Sales Acceleration",
    tagline: "Main program",
    description:
      "Annual commercial direction program. We train, monitor, and hold your sales team accountable for accelerated, predictable growth.",
    icp: "R$ 150k–1M/month revenue • 3+ salespeople",
    href: "/sales-acceleration",
    investment: "R$ 24.000–R$ 36.000/year",
    highlight: true,
  },
  {
    name: "UNV Growth Room",
    tagline: "In-person strategy",
    description:
      "Intensive 3-day in-person immersion. Redesign your commercial route with hands-on guidance and leave with a 90-day execution plan.",
    icp: "R$ 150k–600k/month revenue",
    href: "/growth-room",
    investment: "R$ 12.000–R$ 20.000",
  },
  {
    name: "UNV Partners",
    tagline: "Elite strategic",
    description:
      "Monthly board meetings, weekly accountability, exclusive events, and the Mansion Experience. For established companies seeking elite advisory.",
    icp: "R$ 300k–2M/month revenue",
    href: "/partners",
    investment: "R$ 3.000–R$ 6.000/month",
  },
  {
    name: "UNV Sales Ops",
    tagline: "Team standardization",
    description:
      "Standardize your sales team at scale. Role-based training tracks, scorecards, and AI support per role.",
    icp: "R$ 200k+/month revenue • 5+ salespeople",
    href: "/sales-ops",
    investment: "R$ 97–R$ 297/user/month",
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
              Our Products
            </h1>
            <p className="text-body text-lg">
              Not a catalog—a progression. Each product addresses a specific
              stage of commercial maturity. Find where you fit and grow from
              there.
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
                          Featured
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
                        Learn More
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
              Not sure which product is right for you?
            </h2>
            <p className="text-body mb-6">
              Use our diagnostic tool to get a personalized recommendation based
              on your company profile.
            </p>
            <Link to="/for-closers">
              <Button variant="gold" size="lg">
                Get Your Recommendation
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

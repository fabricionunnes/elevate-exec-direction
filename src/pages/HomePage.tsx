import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Target, TrendingUp, Users, Zap, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import salesTeam from "@/assets/sales-team.jpg";

const problems = [
  "Sales team improvising instead of following a proven process",
  "Leads dying in the pipeline without proper follow-up",
  "Conversion rates fluctuating with no predictability",
  "Owner becoming the bottleneck for every deal",
  "No clear metrics or accountability structure",
];

const products = [
  {
    name: "UNV Core",
    description: "Structure your sales foundation",
    icp: "R$ 50k–150k/month",
    href: "/core",
  },
  {
    name: "UNV Control",
    description: "Maintain execution consistency",
    icp: "R$ 100k–400k/month",
    href: "/control",
  },
  {
    name: "Sales Acceleration",
    description: "Full commercial direction program",
    icp: "R$ 150k–1M/month",
    href: "/sales-acceleration",
    highlight: true,
  },
  {
    name: "Growth Room",
    description: "Intensive in-person strategic immersion",
    icp: "R$ 150k–600k/month",
    href: "/growth-room",
  },
  {
    name: "UNV Partners",
    description: "Elite strategic advisory + Mansion Experience",
    icp: "R$ 300k–2M/month",
    href: "/partners",
  },
  {
    name: "Sales Ops",
    description: "Team standardization at scale",
    icp: "5+ salespeople",
    href: "/sales-ops",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Application",
    description: "Submit your company profile for initial analysis",
  },
  {
    step: "02",
    title: "Diagnosis",
    description: "Deep-dive assessment of your commercial operation",
  },
  {
    step: "03",
    title: "Proposal",
    description: "Custom direction plan tailored to your context",
  },
  {
    step: "04",
    title: "Onboarding",
    description: "Begin structured execution with accountability",
  },
];

export default function HomePage() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBoardroom})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>

        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <h1 className="heading-display text-primary-foreground mb-6 opacity-0 animate-fade-up">
              We act as your Commercial Director.
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8 opacity-0 animate-fade-up delay-100">
              UNV trains, monitors, and holds your sales team accountable to
              accelerate revenue with method and predictability.
            </p>

            <ul className="space-y-3 mb-10 opacity-0 animate-fade-up delay-200">
              {[
                "Practical team training with proven frameworks",
                "Continuous monitoring and accountability",
                "Quick wins in the 1st month (operational target)",
                "Projected payback by the 3rd month (projection, no guarantee)",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-primary-foreground/90"
                >
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up delay-300">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Apply for Diagnosis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a
                href="https://wa.me/5500000000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="hero-outline" size="xl">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="heading-section text-foreground mb-6">
              Your sales problem isn't effort.
              <span className="block text-accent">It's lack of direction.</span>
            </h2>
            <p className="text-body">
              Without proper commercial direction, even talented teams
              underperform. These symptoms might sound familiar:
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {problems.map((problem, i) => (
              <div
                key={i}
                className="card-premium p-6 hover:border-accent/30 transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <p className="text-foreground font-medium">{problem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Product Highlight */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="card-highlight p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row gap-8 lg:gap-16 items-center">
            <div className="flex-1">
              <div className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-6">
                Main Program
              </div>
              <h2 className="heading-section text-foreground mb-4">
                UNV Sales Acceleration
              </h2>
              <p className="text-body mb-8">
                Annual commercial direction program to train, monitor, and
                accelerate your sales team. From quick wins to sustainable
                growth, with full execution accountability.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/sales-acceleration">
                  <Button variant="premium" size="lg">
                    Explore Program
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
                <Link to="/apply">
                  <Button variant="premium-outline" size="lg">
                    Apply Now
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full lg:w-auto">
              <img
                src={salesTeam}
                alt="Professional sales team in modern office"
                className="rounded-lg shadow-premium w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Ladder */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Find Your Entry Point
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Every company has different needs. Our product ladder meets you
              where you are and grows with you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.href}
                to={product.href}
                className={`group ${
                  product.highlight ? "card-highlight" : "card-premium"
                } p-6 hover:border-accent/50 transition-all`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="heading-card text-foreground group-hover:text-accent transition-colors">
                    {product.name}
                  </h3>
                  {product.highlight && (
                    <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
                      Featured
                    </span>
                  )}
                </div>
                <p className="text-body mb-4">{product.description}</p>
                <p className="text-small">ICP: {product.icp}</p>
                <div className="mt-4 flex items-center text-accent text-sm font-medium">
                  Learn more
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/products">
              <Button variant="premium-outline" size="lg">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section mb-4">How We Start</h2>
            <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto">
              A structured onboarding process ensures we understand your context
              before proposing solutions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, i) => (
              <div key={i} className="text-center lg:text-left">
                <div className="text-5xl font-display font-bold text-accent/30 mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-primary-foreground/70">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Start Your Application
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

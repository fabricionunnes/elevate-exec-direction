import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Target, Layers, Shield } from "lucide-react";

const deliverables = [
  "Directional diagnosis of your current operation",
  "Basic funnel structure with stage definitions",
  "Essential scripts (approach, qualification, closing)",
  "Basic goals per salesperson",
  "Minimal accountability routine",
];

const gains = [
  "Clarity and organization in your commercial process",
  "Reduced improvisation in sales conversations",
  "Foundation ready to scale when you grow",
];

const icp = [
  { label: "Revenue", value: "R$ 50k–150k/month" },
  { label: "Team", value: "1–5 salespeople" },
];

const notIncluded = [
  "Ongoing direction (see UNV Control)",
  "Team training beyond initial frameworks",
  "Performance monitoring or scorecards",
];

export default function CorePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Foundation
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Core
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8">
              Build the structural foundation of your commercial operation.
              Essential frameworks to stop improvising and start selling with
              method.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Apply Now
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Who This Is For
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <p className="text-small uppercase tracking-wider mb-2">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground text-lg">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="heading-card text-foreground">Deliverables</h2>
                </div>
                <ul className="space-y-4">
                  {deliverables.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="heading-card text-foreground">
                    Expected Gains
                  </h2>
                </div>
                <ul className="space-y-4">
                  {gains.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              What's NOT Included
            </h2>
            <div className="space-y-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-background rounded-lg"
                >
                  <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium text-center">
          <h2 className="heading-section mb-6">Investment</h2>
          <p className="text-4xl md:text-5xl font-display font-bold text-accent mb-4">
            R$ 997 – R$ 1.997
          </p>
          <p className="text-primary-foreground/70 text-lg mb-10">
            One-time investment
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Apply Now
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

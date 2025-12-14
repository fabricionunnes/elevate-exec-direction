import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Crown, Shield, MessageSquare, Users, Home } from "lucide-react";
import mansionImage from "@/assets/mansion-experience.jpg";

const deliverables = [
  "Monthly board meeting with strategic review",
  "Weekly accountability check-ins",
  "Structured benchmark (anonymized across members)",
  "Exclusive in-person events",
  "UNV AI Advisor (strategic level)",
];

const mansionExperience = [
  "5 invited guests per month",
  "Curated selection process",
  "All costs (travel, accommodation, activities) paid by the client",
  "Limited availability — application required",
];

const gains = [
  "Better decisions with peer advisory",
  "Reduced isolation as a business owner",
  "Growth with criteria, not chaos",
];

const icp = [
  { label: "Revenue", value: "R$ 300k–2M/month" },
];

const notIncluded = [
  "Operational team training (see Sales Acceleration)",
  "CRM management or tech implementation",
  "Guaranteed revenue outcomes",
];

export default function PartnersPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              <Crown className="h-4 w-4" />
              Elite Strategic
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Partners
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8">
              Elite advisory for established companies. Monthly board meetings,
              weekly accountability, exclusive events, and the Mansion
              Experience.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Apply for Membership
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Who This Is For
            </h2>
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
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-accent" />
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
                    <Users className="h-5 w-5 text-accent" />
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

      {/* Mansion Experience */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <div className="card-highlight overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Home className="h-6 w-6 text-accent" />
                    <h2 className="heading-card text-foreground">
                      Mansion Experience
                    </h2>
                  </div>
                  <p className="text-body mb-6">
                    An exclusive in-person gathering for Partners members.
                    Strategic conversations in an intimate setting, away from
                    the noise of daily operations.
                  </p>
                  <ul className="space-y-3">
                    {mansionExperience.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-small">
                        <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative min-h-[300px] lg:min-h-0">
                  <img
                    src={mansionImage}
                    alt="Luxury estate for Mansion Experience"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="py-12 bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-premium p-8 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  UNV AI Advisor — Strategic Level
                </h3>
                <p className="text-body">
                  Enhanced AI support for strategic preparation, board meeting
                  briefings, and decision framework assistance.
                </p>
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
            R$ 3.000 – R$ 6.000
          </p>
          <p className="text-primary-foreground/70 text-lg mb-10">
            Per month • Application and selection required
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Apply for Membership
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

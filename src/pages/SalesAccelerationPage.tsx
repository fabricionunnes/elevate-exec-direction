import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  Target,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  FileText,
  BarChart3,
  ClipboardList,
  MessageSquare,
  Shield,
} from "lucide-react";
import salesTeam from "@/assets/sales-team.jpg";

const deliverables = [
  {
    phase: "Month 1",
    title: "Quick Wins & Sales Unblocking",
    items: [
      "Script Master (approach, diagnosis, proposal, closing)",
      "Follow-up System (cadence + templates)",
      "Daily salesperson checklist (activity and focus)",
      "Weekly team meeting script",
      "Minimum pipeline with stage criteria",
    ],
    gains: [
      "Increase in qualified conversations",
      "Reduction in losses due to inertia",
      "Better closing through refined pitch (operational target)",
    ],
    icon: Zap,
  },
  {
    phase: "Months 2–3",
    title: "Conversion & Payback Track",
    items: [
      "Qualification structure (criteria)",
      "Pipeline + simple forecast",
      "Proposal and objection playbook",
      "Lost lead recovery plan",
      "Scorecard per salesperson (activity + conversion)",
    ],
    gains: [
      "Higher conversion with same lead volume",
      "More controlled sales cycle",
      "Projected payback by month 3 (projection)",
    ],
    icon: TrendingUp,
  },
  {
    phase: "Months 4–6",
    title: "Performance & Management",
    items: [
      "Management cadence (leader's agenda)",
      "Feedback and accountability model",
      "Individual development plan per salesperson",
      "Performance rules",
    ],
    gains: [
      "Less owner dependency",
      "Team accountable for their numbers",
    ],
    icon: Users,
  },
  {
    phase: "Months 7–9",
    title: "Standardization & Scale",
    items: [
      "Simple and effective commission structure",
      "Salesperson manual (company standard)",
      "Standardized pitch by funnel stage",
    ],
    gains: ["Aligned and replicable team"],
    icon: FileText,
  },
  {
    phase: "Months 10–12",
    title: "Growth Control & Decisions",
    items: [
      "Executive indicator dashboard",
      "Priority and decision map",
      "Validated growth plan + scaling checklist",
    ],
    gains: ["Growth with control, without chaos"],
    icon: BarChart3,
  },
];

const icp = [
  { label: "Revenue", value: "R$ 150k to R$ 1M/month" },
  { label: "Team", value: "Minimum 3 salespeople" },
  { label: "Decision-maker", value: "Owner directly involved" },
  { label: "Pain", value: "Low conversion, inconsistency, owner dependency" },
];

const notIncluded = [
  "We don't make sales on your behalf",
  "We don't guarantee specific revenue numbers",
  "We don't manage your CRM directly",
  "We don't provide paid traffic or marketing services",
];

export default function SalesAccelerationPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${salesTeam})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Main Program
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Sales Acceleration
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8">
              Annual commercial direction program to train, monitor, and
              accelerate your sales team with method and predictability.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Apply for Diagnosis
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Who This Is For
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <p className="text-small uppercase tracking-wider mb-2">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables by Phase */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              12-Month Roadmap
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              A structured progression from quick wins to sustainable growth
              systems. Each phase builds on the previous.
            </p>
          </div>

          <div className="space-y-8">
            {deliverables.map((phase, i) => (
              <div key={i} className="card-premium p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-1/3">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                        <phase.icon className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-accent font-medium">{phase.phase}</p>
                        <h3 className="heading-card text-foreground">
                          {phase.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="lg:w-1/3">
                    <h4 className="font-semibold text-foreground mb-3">
                      Deliverables
                    </h4>
                    <ul className="space-y-2">
                      {phase.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-small"
                        >
                          <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:w-1/3">
                    <h4 className="font-semibold text-foreground mb-3">
                      Expected Gains
                    </h4>
                    <ul className="space-y-2">
                      {phase.gains.map((gain, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-small"
                        >
                          <TrendingUp className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          <span>{gain}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h3 className="heading-card text-foreground mb-3">
                    UNV AI Advisor
                  </h3>
                  <p className="text-body mb-4">
                    Included support layer for accountability, checklists, and
                    meeting preparation. Available throughout the program to
                    keep execution on track.
                  </p>
                  <p className="text-small italic">
                    Note: This is a support tool, not a standalone SaaS product.
                    It does not provide revenue predictions or automated
                    decision-making.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              What's NOT Included
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-secondary rounded-lg"
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
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section mb-6">Investment</h2>
            <p className="text-4xl md:text-5xl font-display font-bold text-accent mb-4">
              R$ 24.000 – R$ 36.000
            </p>
            <p className="text-primary-foreground/70 text-lg mb-6">
              Annual program • Cash or installments available
            </p>
            <p className="text-sm text-primary-foreground/50 mb-10 max-w-xl mx-auto">
              Results vary based on execution. Payback projection is
              operational, not guaranteed. UNV directs and holds accountable—the
              client executes.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Apply for Diagnosis
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

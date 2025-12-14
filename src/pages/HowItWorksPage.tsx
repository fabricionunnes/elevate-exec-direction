import { Layout } from "@/components/layout/Layout";
import { Target, Users, Zap, CheckCircle2, Calendar, MessageSquare, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import strategySession from "@/assets/strategy-session.jpg";

const pillars = [
  {
    icon: Target,
    title: "Direction",
    description:
      "We define clear commercial priorities, targets, and the strategic path to achieve them. No guesswork—only focused execution.",
  },
  {
    icon: Users,
    title: "Training",
    description:
      "Your team receives practical training on scripts, objection handling, negotiation, and closing—designed for immediate application.",
  },
  {
    icon: Zap,
    title: "Execution",
    description:
      "We implement processes, pipelines, and routines that turn strategy into daily action. Every activity is purposeful.",
  },
  {
    icon: CheckCircle2,
    title: "Accountability",
    description:
      "Weekly check-ins, scorecards, and direct feedback ensure your team delivers. We don't just advise—we demand results.",
  },
];

const cadence = [
  {
    icon: Calendar,
    title: "Monthly Strategic Meeting",
    description:
      "One strategic session per month to review priorities, adjust targets, and align on the roadmap ahead.",
  },
  {
    icon: MessageSquare,
    title: "Weekly Execution Check-in",
    description:
      "Weekly follow-up focused on execution: what was done, what's blocked, and what needs immediate action.",
  },
  {
    icon: ClipboardCheck,
    title: "Weekly Checklists",
    description:
      "Structured checklists ensure every salesperson knows their priorities and tracks their own progress.",
  },
  {
    icon: Zap,
    title: "UNV AI Advisor Support",
    description:
      "AI-powered support layer for daily questions, meeting preparation, and execution reminders. Not a SaaS—a support tool.",
  },
];

export default function HowItWorksPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">
              The UNV Method
            </h1>
            <p className="text-body text-lg">
              A proven framework for commercial direction that transforms how
              your sales team operates. Four pillars. Consistent cadence.
              Measurable results.
            </p>
          </div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Four Pillars of Direction
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Every engagement follows the same foundational framework, adapted
              to your specific context and team size.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {pillars.map((pillar, i) => (
              <div
                key={i}
                className="card-premium p-8 hover:border-accent/30 transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6">
                  <pillar.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="heading-card text-foreground mb-3">
                  {pillar.title}
                </h3>
                <p className="text-body">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Break */}
      <section className="relative h-[50vh] min-h-[400px]">
        <img
          src={strategySession}
          alt="Executive strategy session reviewing sales dashboard"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-overlay flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground">
              Direction is not advice.
              <span className="block text-accent">It's accountability.</span>
            </h2>
          </div>
        </div>
      </section>

      {/* Cadence */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Execution Cadence
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Consistency beats intensity. Our cadence ensures continuous
              progress, not sporadic bursts of activity.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cadence.map((item, i) => (
              <div key={i} className="card-premium p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-small">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium text-center">
          <h2 className="heading-section mb-6">
            Ready for structured commercial direction?
          </h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-2xl mx-auto">
            Apply for a diagnosis and discover which UNV product fits your
            current stage.
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Apply for Diagnosis
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

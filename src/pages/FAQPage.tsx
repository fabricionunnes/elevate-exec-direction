import { Layout } from "@/components/layout/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    question: "Is this a course?",
    answer:
      "No. UNV is not an educational platform. We act as your Commercial Director: we structure your sales operation, train your team on practical execution, monitor progress, and hold everyone accountable. There are no modules, certificates, or recorded classes. This is direction, not education.",
  },
  {
    question: "Do you sell on my behalf?",
    answer:
      "No. UNV provides direction—we define what needs to be done, train your team how to do it, and hold them accountable for execution. Your team does the selling. We ensure they're doing it with method and consistency.",
  },
  {
    question: "Can I expect results in the first month?",
    answer:
      "Our programs are designed for quick wins in the first month through practical implementation of scripts, follow-up systems, and basic pipeline structure. These are operational targets based on improved execution. Revenue impact varies based on your team's execution quality and market conditions.",
  },
  {
    question: "Is the 3-month payback guaranteed?",
    answer:
      "No. Payback by the third month is a projection based on operational improvements, not a guarantee. Results depend on multiple factors including team execution, market conditions, lead quality, and your product/service. UNV provides the direction and accountability; the client executes.",
  },
  {
    question: "How does the Mansion Experience work?",
    answer:
      "The Mansion Experience is an exclusive in-person gathering for UNV Partners members. It hosts up to 5 carefully curated guests per month for strategic discussions in an intimate setting. All costs (travel, accommodation, activities) are the client's responsibility. Entry is by invitation and selection only.",
  },
  {
    question: "Do I need a CRM to work with UNV?",
    answer:
      "Not necessarily. While having a CRM helps with pipeline visibility, we can work with simple tools initially. During the program, we'll help you define what level of tooling makes sense for your stage and implement accordingly.",
  },
  {
    question: "How long does each program last?",
    answer:
      "It varies by product. UNV Core is a one-time implementation. UNV Control is monthly/annual recurring. Sales Acceleration is a 12-month program. Growth Room is a 3-day immersion with 90-day follow-up. Partners is ongoing membership. Sales Ops is monthly per user.",
  },
  {
    question: "Which product should I choose?",
    answer:
      "It depends on your stage, team size, and primary challenge. Use our diagnostic tool at /for-closers for a personalized recommendation, or apply for a diagnosis and our team will guide you to the best fit.",
  },
  {
    question: "What's included in UNV AI Advisor?",
    answer:
      "UNV AI Advisor is a support layer—not a standalone SaaS product. It helps with weekly accountability reminders, checklist tracking, and meeting preparation. It does not make revenue predictions or automated decisions. It's a tool to reinforce execution, not replace human direction.",
  },
  {
    question: "Can I cancel or change programs?",
    answer:
      "Cancellation and change policies vary by product. One-time implementations (Core, Growth Room) are non-refundable once started. Recurring products (Control, Partners, Sales Ops) require notice as per contract terms. Annual programs (Sales Acceleration) have specific commitment terms outlined in the agreement.",
  },
];

export default function FAQPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-body text-lg">
              Common questions about our approach, products, and what to expect
              when working with UNV.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="card-premium px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-accent py-6">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-body pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Still have questions */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="card-premium p-8 lg:p-12 text-center max-w-3xl mx-auto">
            <h2 className="heading-card text-foreground mb-4">
              Still have questions?
            </h2>
            <p className="text-body mb-6">
              Apply for a diagnosis and our team will address any specific
              questions about your situation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/apply">
                <Button variant="premium" size="lg">
                  Apply for Diagnosis
                </Button>
              </Link>
              <a
                href="https://wa.me/5500000000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="premium-outline" size="lg">
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

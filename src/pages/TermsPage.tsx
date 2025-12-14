import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-foreground mb-6">
              Terms & Disclaimers
            </h1>
            <p className="text-body text-lg">
              Important information about our services, expectations, and
              limitations.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto prose prose-slate">
            <div className="card-premium p-8 md:p-12 space-y-12">
              {/* Results Disclaimer */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  Results Disclaimer
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    UNV provides commercial direction, training, and
                    accountability services. <strong>Results are not guaranteed.</strong>{" "}
                    Any references to "quick wins," "payback," or revenue
                    improvements are operational projections based on improved
                    execution—not promises of specific outcomes.
                  </p>
                  <p>
                    Actual results depend on multiple factors including but not
                    limited to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Quality and consistency of team execution</li>
                    <li>Market conditions and competitive landscape</li>
                    <li>Lead quality and volume</li>
                    <li>Product/service market fit</li>
                    <li>Client's commitment to the process</li>
                    <li>External economic factors</li>
                  </ul>
                </div>
              </div>

              {/* Service Scope */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  Service Scope
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    UNV acts as an external Commercial Director. We provide:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      Strategic direction and priority definition
                    </li>
                    <li>
                      Practical training on sales processes and scripts
                    </li>
                    <li>Ongoing monitoring and accountability</li>
                    <li>Frameworks, templates, and support tools</li>
                  </ul>
                  <p className="font-medium">
                    UNV does NOT:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Make sales or close deals on behalf of clients</li>
                    <li>Manage client CRM systems or databases</li>
                    <li>Provide paid traffic or marketing services</li>
                    <li>Guarantee specific revenue outcomes</li>
                    <li>Replace client responsibility for execution</li>
                  </ul>
                </div>
              </div>

              {/* Payback Projection */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  Payback Projection Clarification
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    References to "payback by month 3" or similar timeframes are{" "}
                    <strong>operational projections</strong>, not guarantees.
                    These projections assume:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      Full implementation of recommended processes
                    </li>
                    <li>Consistent team execution of trained methods</li>
                    <li>Adequate lead flow to work with</li>
                    <li>Client availability for scheduled sessions</li>
                    <li>No major external disruptions</li>
                  </ul>
                  <p>
                    Clients who do not execute consistently or who face
                    unexpected challenges may experience different timelines or
                    results.
                  </p>
                </div>
              </div>

              {/* Mansion Experience */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  Mansion Experience Terms
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    The Mansion Experience is an exclusive benefit available to
                    UNV Partners members under the following conditions:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      Limited to 5 invited guests per month
                    </li>
                    <li>
                      Entry is by invitation and curation—not guaranteed with
                      membership
                    </li>
                    <li>
                      <strong>
                        All costs (travel, accommodation, food, activities) are
                        the client's responsibility
                      </strong>
                    </li>
                    <li>
                      UNV reserves the right to accept or decline participation
                    </li>
                    <li>
                      Participants must comply with conduct guidelines
                    </li>
                    <li>
                      Dates and locations are determined by UNV and may change
                    </li>
                  </ul>
                </div>
              </div>

              {/* Cancellation */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  Cancellation & Refund Policy
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    Policies vary by product type:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>One-time implementations</strong> (Core, Growth
                      Room): Non-refundable once work has begun
                    </li>
                    <li>
                      <strong>Recurring subscriptions</strong> (Control,
                      Partners, Sales Ops): Cancellation with 30-day notice;
                      prorated refunds not provided
                    </li>
                    <li>
                      <strong>Annual programs</strong> (Sales Acceleration):
                      Subject to specific commitment terms in the signed
                      agreement
                    </li>
                  </ul>
                  <p>
                    All terms are subject to the specific agreement signed at
                    the time of engagement.
                  </p>
                </div>
              </div>

              {/* UNV AI Advisor */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  UNV AI Advisor Disclaimer
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    UNV AI Advisor is a support tool, not a standalone SaaS
                    product. It:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      Assists with accountability, checklists, and meeting
                      preparation
                    </li>
                    <li>
                      Does NOT make revenue predictions or automated business
                      decisions
                    </li>
                    <li>
                      Is not a replacement for human direction and judgment
                    </li>
                    <li>
                      Availability depends on the specific product purchased
                    </li>
                  </ul>
                </div>
              </div>

              {/* General */}
              <div>
                <h2 className="heading-card text-foreground mb-4">
                  General Terms
                </h2>
                <div className="text-body space-y-4">
                  <p>
                    By engaging with UNV services, clients acknowledge and
                    accept that:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      They are responsible for executing the recommended
                      strategies
                    </li>
                    <li>
                      UNV intellectual property and materials remain UNV
                      property
                    </li>
                    <li>
                      Confidential information shared during engagements is
                      protected
                    </li>
                    <li>
                      UNV may use anonymized case data for marketing purposes
                    </li>
                    <li>
                      Terms may be updated; clients will be notified of material
                      changes
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <p className="text-small mb-6">
                Last updated: December 2024
              </p>
              <Link to="/apply">
                <Button variant="premium" size="lg">
                  Apply for Diagnosis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

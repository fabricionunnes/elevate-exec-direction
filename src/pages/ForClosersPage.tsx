import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, CheckCircle, Copy, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  clientName: string;
  company: string;
  role: string;
  revenue: string;
  teamSize: string;
  avgTicket: string;
  leadVolume: string;
  conversion: string;
  mainPain: string;
  urgency: number[];
  goal90Days: string;
  notes: string;
}

interface Recommendation {
  product: string;
  href: string;
  reasons: string[];
  nextSteps: string[];
}

const revenueOptions = [
  { value: "under-50k", label: "Under R$ 50k/month" },
  { value: "50k-150k", label: "R$ 50k–150k/month" },
  { value: "150k-400k", label: "R$ 150k–400k/month" },
  { value: "400k-1m", label: "R$ 400k–1M/month" },
  { value: "1m-2m", label: "R$ 1M–2M/month" },
  { value: "over-2m", label: "Over R$ 2M/month" },
];

const teamSizeOptions = [
  { value: "1", label: "1 salesperson" },
  { value: "2-3", label: "2–3 salespeople" },
  { value: "4-5", label: "4–5 salespeople" },
  { value: "6-10", label: "6–10 salespeople" },
  { value: "over-10", label: "10+ salespeople" },
];

const leadVolumeOptions = [
  { value: "under-50", label: "Under 50 leads/month" },
  { value: "50-100", label: "50–100 leads/month" },
  { value: "100-300", label: "100–300 leads/month" },
  { value: "300-500", label: "300–500 leads/month" },
  { value: "over-500", label: "500+ leads/month" },
];

const conversionOptions = [
  { value: "under-5", label: "Under 5%" },
  { value: "5-10", label: "5–10%" },
  { value: "10-20", label: "10–20%" },
  { value: "20-30", label: "20–30%" },
  { value: "over-30", label: "Over 30%" },
];

const painOptions = [
  { value: "no-process", label: "No sales process defined" },
  { value: "inconsistency", label: "Inconsistent execution" },
  { value: "low-conversion", label: "Low conversion rates" },
  { value: "owner-dependent", label: "Owner is the bottleneck" },
  { value: "team-scaling", label: "Difficulty scaling the team" },
  { value: "lack-direction", label: "Lack of commercial direction" },
];

function getRecommendation(data: FormData): Recommendation {
  const { revenue, teamSize, mainPain } = data;

  // Scoring logic
  if (mainPain === "no-process" && ["1", "2-3", "4-5"].includes(teamSize)) {
    return {
      product: "UNV Core",
      href: "/core",
      reasons: [
        "You need to establish a foundational sales process",
        "Your team size is ideal for structural implementation",
        "Quick-start solution to stop improvising",
      ],
      nextSteps: [
        "Apply for a diagnostic session",
        "We'll assess your current state",
        "Receive your Core implementation plan",
      ],
    };
  }

  if (mainPain === "inconsistency" && ["50k-150k", "150k-400k"].includes(revenue)) {
    return {
      product: "UNV Control",
      href: "/control",
      reasons: [
        "You have a process but struggle with consistency",
        "Recurring direction will maintain momentum",
        "AI-powered weekly accountability fits your needs",
      ],
      nextSteps: [
        "Apply for membership evaluation",
        "We'll review your current systems",
        "Start with monthly strategic check-ins",
      ],
    };
  }

  if (
    ["6-10", "over-10"].includes(teamSize) &&
    ["team-scaling", "inconsistency"].includes(mainPain)
  ) {
    return {
      product: "UNV Sales Ops",
      href: "/sales-ops",
      reasons: [
        "Team standardization is critical at your scale",
        "Role-based training will unify performance",
        "Scorecards will drive accountability across roles",
      ],
      nextSteps: [
        "Apply for a team assessment",
        "We'll map your role structure",
        "Deploy standardized tracks per role",
      ],
    };
  }

  if (
    ["400k-1m", "1m-2m", "over-2m"].includes(revenue) &&
    ["lack-direction", "owner-dependent"].includes(mainPain)
  ) {
    return {
      product: "UNV Partners",
      href: "/partners",
      reasons: [
        "You need strategic advisory, not just execution help",
        "Board-level guidance will accelerate decisions",
        "Peer network reduces isolation and provides benchmarks",
      ],
      nextSteps: [
        "Submit your Partners application",
        "We'll evaluate fit for the program",
        "Begin with a strategic diagnostic call",
      ],
    };
  }

  if (
    mainPain === "lack-direction" &&
    ["150k-400k", "400k-1m"].includes(revenue)
  ) {
    return {
      product: "UNV Growth Room",
      href: "/growth-room",
      reasons: [
        "You need a complete route redesign",
        "In-person immersion delivers rapid clarity",
        "You'll leave with a locked 90-day plan",
      ],
      nextSteps: [
        "Apply for Growth Room",
        "Complete pre-immersion diagnosis",
        "Block 3 days for intensive work",
      ],
    };
  }

  // Default: Sales Acceleration
  return {
    product: "UNV Sales Acceleration",
    href: "/sales-acceleration",
    reasons: [
      "Your profile fits our comprehensive direction program",
      "Annual commitment ensures sustained transformation",
      "From quick wins to scalable growth systems",
    ],
    nextSteps: [
      "Apply for a diagnostic session",
      "We'll analyze your commercial operation",
      "Receive a custom acceleration proposal",
    ],
  };
}

export default function ForClosersPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    clientName: "",
    company: "",
    role: "",
    revenue: "",
    teamSize: "",
    avgTicket: "",
    leadVolume: "",
    conversion: "",
    mainPain: "",
    urgency: [3],
    goal90Days: "",
    notes: "",
  });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rec = getRecommendation(formData);
    setRecommendation(rec);
    setIsSubmitted(true);
  };

  const generateWhatsAppSummary = () => {
    if (!recommendation) return "";
    return `*Sales Diagnostic Summary*

Client: ${formData.clientName}
Company: ${formData.company}
Revenue: ${revenueOptions.find((o) => o.value === formData.revenue)?.label || "Not specified"}
Team: ${teamSizeOptions.find((o) => o.value === formData.teamSize)?.label || "Not specified"}
Main Pain: ${painOptions.find((o) => o.value === formData.mainPain)?.label || "Not specified"}
Urgency: ${formData.urgency[0]}/5
90-Day Goal: ${formData.goal90Days || "Not specified"}

*Recommended Product: ${recommendation.product}*

Reasons:
${recommendation.reasons.map((r) => `• ${r}`).join("\n")}

Next Steps:
${recommendation.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateWhatsAppSummary());
    toast({
      title: "Copied to clipboard",
      description: "Summary ready to paste in WhatsApp",
    });
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-6">
              Internal Tool
            </div>
            <h1 className="heading-display text-foreground mb-6">
              Sales Diagnostic & Product Fit
            </h1>
            <p className="text-body text-lg">
              Complete the client profile to receive a personalized product
              recommendation with justification and next steps.
            </p>
          </div>
        </div>
      </section>

      {/* Form or Result */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client Info */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Client Information
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Client Name *</Label>
                      <Input
                        id="clientName"
                        value={formData.clientName}
                        onChange={(e) =>
                          setFormData({ ...formData, clientName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company *</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({ ...formData, company: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="role">Role/Position</Label>
                      <Input
                        id="role"
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({ ...formData, role: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Company Profile */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Company Profile
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Monthly Revenue *</Label>
                      <Select
                        value={formData.revenue}
                        onValueChange={(value) =>
                          setFormData({ ...formData, revenue: value })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {revenueOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Team Size *</Label>
                      <Select
                        value={formData.teamSize}
                        onValueChange={(value) =>
                          setFormData({ ...formData, teamSize: value })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamSizeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="avgTicket">Average Ticket (R$)</Label>
                      <Input
                        id="avgTicket"
                        value={formData.avgTicket}
                        onChange={(e) =>
                          setFormData({ ...formData, avgTicket: e.target.value })
                        }
                        placeholder="e.g., 5000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Volume</Label>
                      <Select
                        value={formData.leadVolume}
                        onValueChange={(value) =>
                          setFormData({ ...formData, leadVolume: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select volume" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadVolumeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated Conversion</Label>
                      <Select
                        value={formData.conversion}
                        onValueChange={(value) =>
                          setFormData({ ...formData, conversion: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select rate" />
                        </SelectTrigger>
                        <SelectContent>
                          {conversionOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Main Pain Point *</Label>
                      <Select
                        value={formData.mainPain}
                        onValueChange={(value) =>
                          setFormData({ ...formData, mainPain: value })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pain" />
                        </SelectTrigger>
                        <SelectContent>
                          {painOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Urgency & Goals */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Urgency & Goals
                  </h2>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label>Urgency Level (1–5)</Label>
                      <div className="flex items-center gap-4">
                        <span className="text-small">Low</span>
                        <Slider
                          value={formData.urgency}
                          onValueChange={(value) =>
                            setFormData({ ...formData, urgency: value })
                          }
                          min={1}
                          max={5}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-small">High</span>
                        <span className="w-8 text-center font-semibold text-accent">
                          {formData.urgency[0]}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal90Days">90-Day Goal</Label>
                      <Textarea
                        id="goal90Days"
                        value={formData.goal90Days}
                        onChange={(e) =>
                          setFormData({ ...formData, goal90Days: e.target.value })
                        }
                        placeholder="What does the client want to achieve in the next 90 days?"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Additional Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Any other relevant information..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" variant="premium" size="xl" className="w-full">
                  Generate Recommendation
                  <ArrowRight className="ml-2" />
                </Button>
              </form>
            ) : (
              /* Result */
              <div className="space-y-8">
                <div className="card-highlight p-8 md:p-12">
                  <div className="text-center mb-8">
                    <p className="text-small uppercase tracking-wider text-muted-foreground mb-2">
                      Recommended Product
                    </p>
                    <h2 className="heading-display text-foreground">
                      {recommendation?.product}
                    </h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-semibold text-foreground mb-4">
                        Why This Product
                      </h3>
                      <ul className="space-y-3">
                        {recommendation?.reasons.map((reason, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                            <span className="text-body">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-4">
                        Suggested Next Steps
                      </h3>
                      <ol className="space-y-3">
                        {recommendation?.nextSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-sm font-medium flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-body">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="gold"
                    size="lg"
                    onClick={copyToClipboard}
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Summary for WhatsApp
                  </Button>
                  <Button
                    variant="premium-outline"
                    size="lg"
                    onClick={() => {
                      setIsSubmitted(false);
                      setRecommendation(null);
                    }}
                    className="flex-1"
                  >
                    New Diagnostic
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

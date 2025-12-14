import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const revenueOptions = [
  { value: "under-50k", label: "Under R$ 50k/month" },
  { value: "50k-150k", label: "R$ 50k–150k/month" },
  { value: "150k-400k", label: "R$ 150k–400k/month" },
  { value: "400k-1m", label: "R$ 400k–1M/month" },
  { value: "over-1m", label: "Over R$ 1M/month" },
];

const teamSizeOptions = [
  { value: "1", label: "1 salesperson" },
  { value: "2-3", label: "2–3 salespeople" },
  { value: "4-5", label: "4–5 salespeople" },
  { value: "6-10", label: "6–10 salespeople" },
  { value: "over-10", label: "10+ salespeople" },
];

const productOptions = [
  { value: "unsure", label: "Not sure yet — need guidance" },
  { value: "core", label: "UNV Core" },
  { value: "control", label: "UNV Control" },
  { value: "acceleration", label: "UNV Sales Acceleration" },
  { value: "growth-room", label: "UNV Growth Room" },
  { value: "partners", label: "UNV Partners" },
  { value: "sales-ops", label: "UNV Sales Ops" },
];

export default function ApplyPage() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    role: "",
    revenue: "",
    teamSize: "",
    product: "",
    challenge: "",
    acceptTerms: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.acceptTerms) {
      toast({
        title: "Terms required",
        description: "Please accept the terms and disclaimers to continue.",
        variant: "destructive",
      });
      return;
    }
    // In a real app, this would submit to a backend
    setIsSubmitted(true);
    toast({
      title: "Application submitted",
      description: "We'll be in touch within 48 hours.",
    });
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="heading-display text-primary-foreground mb-6">
              Apply for Diagnosis
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Complete this form to start the evaluation process. We'll review
              your profile and reach out to schedule a diagnostic session.
            </p>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-2xl mx-auto">
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Contact */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Contact Information
                  </h2>
                  <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone/WhatsApp *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Your Role</Label>
                        <Input
                          id="role"
                          value={formData.role}
                          onChange={(e) =>
                            setFormData({ ...formData, role: e.target.value })
                          }
                          placeholder="e.g., CEO, Commercial Director"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Company Information
                  </h2>
                  <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company Name *</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) =>
                            setFormData({ ...formData, company: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website}
                          onChange={(e) =>
                            setFormData({ ...formData, website: e.target.value })
                          }
                          placeholder="https://"
                        />
                      </div>
                    </div>
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
                        <Label>Sales Team Size *</Label>
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
                    </div>
                  </div>
                </div>

                {/* Interest */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6">
                    Your Interest
                  </h2>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Product of Interest</Label>
                      <Select
                        value={formData.product}
                        onValueChange={(value) =>
                          setFormData({ ...formData, product: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="challenge">
                        Main Commercial Challenge *
                      </Label>
                      <Textarea
                        id="challenge"
                        value={formData.challenge}
                        onChange={(e) =>
                          setFormData({ ...formData, challenge: e.target.value })
                        }
                        placeholder="Describe your biggest sales challenge right now..."
                        rows={4}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, acceptTerms: checked === true })
                    }
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    I accept the{" "}
                    <Link to="/terms" className="text-accent hover:underline">
                      terms and disclaimers
                    </Link>
                    , including that results vary based on execution, payback is a
                    projection (not a guarantee), and UNV provides direction while
                    the client executes.
                  </Label>
                </div>

                <Button
                  type="submit"
                  variant="premium"
                  size="xl"
                  className="w-full"
                >
                  Submit Application
                  <ArrowRight className="ml-2" />
                </Button>
              </form>
            ) : (
              /* Success State */
              <div className="card-highlight p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <h2 className="heading-section text-foreground mb-4">
                  Application Received
                </h2>
                <p className="text-body mb-8 max-w-md mx-auto">
                  Thank you for your interest in UNV. Our team will review your
                  profile and contact you within 48 hours to schedule a
                  diagnostic session.
                </p>
                <Link to="/">
                  <Button variant="premium-outline" size="lg">
                    Return to Home
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

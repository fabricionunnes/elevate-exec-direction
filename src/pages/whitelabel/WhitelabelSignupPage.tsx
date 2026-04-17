import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, Rocket, Crown, ShieldCheck, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  enabled_modules: Record<string, boolean>;
  max_projects: number | null;
  max_users: number | null;
  is_featured: boolean;
  sort_order: number;
}

const planIcons: Record<string, JSX.Element> = {
  starter: <Sparkles className="h-5 w-5" />,
  pro: <Rocket className="h-5 w-5" />,
  enterprise: <Crown className="h-5 w-5" />,
};

function sanitizeSlug(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WhitelabelSignupPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [submitting, setSubmitting] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    slug: "",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
    cpf_cnpj: "",
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["whitelabel-public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whitelabel_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const currentPlan = useMemo(
    () => plans.find((p) => p.slug === selectedPlan),
    [plans, selectedPlan],
  );

  const handleSubmit = async () => {
    // Validações simples
    const errs: string[] = [];
    if (!form.company_name.trim()) errs.push("Nome da empresa");
    if (!form.admin_name.trim()) errs.push("Seu nome");
    if (!form.admin_email.trim()) errs.push("Email");
    if (!form.admin_phone.trim()) errs.push("WhatsApp");
    if (!form.cpf_cnpj.trim()) errs.push("CPF/CNPJ");
    if (errs.length) {
      toast.error("Preencha: " + errs.join(", "));
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whitelabel-checkout", {
        body: {
          ...form,
          slug: sanitizeSlug(form.slug || form.company_name),
          plan_slug: selectedPlan,
          billing_cycle: cycle,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      setPaymentLink(data.payment_link);
      toast.success("Pronto! Conclua o pagamento para liberar seu ambiente.");
      // Abre nova aba
      if (data.payment_link) window.open(data.payment_link, "_blank");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao processar inscrição");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 text-center">
          <Badge variant="outline" className="mb-4">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Plataforma white-label
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Sua direção comercial em uma plataforma com sua marca
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            CRM, financeiro, gestão de projetos e IA — tudo integrado, com a
            identidade visual e o domínio da sua empresa.
          </p>
        </div>
      </section>

      {/* Toggle ciclo */}
      <section className="max-w-6xl mx-auto px-6 pt-10">
        <Tabs value={cycle} onValueChange={(v) => setCycle(v as any)} className="w-fit mx-auto">
          <TabsList>
            <TabsTrigger value="monthly">Mensal</TabsTrigger>
            <TabsTrigger value="yearly" disabled>
              Anual <Badge variant="secondary" className="ml-2 text-xs">em breve</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Planos */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Carregando planos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const price = cycle === "yearly" && plan.price_yearly ? plan.price_yearly : plan.price_monthly;
              const isSelected = selectedPlan === plan.slug;
              const moduleCount = Object.values(plan.enabled_modules || {}).filter(Boolean).length;
              return (
                <Card
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`cursor-pointer transition-all relative ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"
                  }`}
                >
                  {plan.is_featured && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Mais popular</Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {planIcons[plan.slug] || <Sparkles className="h-5 w-5" />}
                      <CardTitle>{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description || "—"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-3xl font-bold">
                        R$ {Number(price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground">/{cycle === "yearly" ? "ano" : "mês"}</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Até {plan.max_projects ?? "∞"} projetos ativos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {plan.max_users ? `${plan.max_users} usuários` : "Usuários ilimitados"}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {moduleCount} módulos inclusos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Marca e domínio próprio
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Onboarding incluso
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Formulário */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <Card>
          <CardHeader>
            <CardTitle>Crie seu ambiente</CardTitle>
            <CardDescription>
              Após o pagamento, seu ambiente é provisionado automaticamente e você recebe
              os dados de acesso por email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Nome da sua empresa *</Label>
                <Input id="company" value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Acme Consultoria" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Endereço da sua plataforma</Label>
                <div className="flex items-center gap-1">
                  <Input id="slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: sanitizeSlug(e.target.value) })}
                    placeholder="acme" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.nexus.com.br</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin">Seu nome *</Label>
                <Input id="admin" value={form.admin_name}
                  onChange={(e) => setForm({ ...form, admin_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" value={form.admin_phone}
                  onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
                  placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc">CPF ou CNPJ *</Label>
                <Input id="doc" value={form.cpf_cnpj}
                  onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plano selecionado</p>
                  <p className="font-semibold">{currentPlan?.name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">
                    R$ {currentPlan ? Number(currentPlan.price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              </div>
            </div>

            {paymentLink ? (
              <div className="rounded-lg border border-primary p-4 space-y-3">
                <p className="font-semibold text-primary flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Pagamento gerado!
                </p>
                <p className="text-sm">Conclua o pagamento para liberar seu ambiente. Assim que confirmado, criamos tudo automaticamente.</p>
                <Button asChild size="lg" className="w-full">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                    Ir para o pagamento
                  </a>
                </Button>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando pagamento...</>
                ) : (
                  <>Quero esta plataforma</>
                )}
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Pagamento processado via Asaas (boleto, PIX ou cartão). Cancele quando quiser.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

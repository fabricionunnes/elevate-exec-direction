import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Check, Crown, ExternalLink, Loader2, Sparkles } from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  max_projects: number | null;
  max_users: number | null;
  is_featured: boolean;
}

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  currentPlanSlug: string | null;
  currentMaxProjects: number;
  activeProjectsCount: number;
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  currentPlanSlug,
  currentMaxProjects,
  activeProjectsCount,
}: UpgradePlanDialogProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSlug, setProcessingSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("whitelabel_plans")
      .select("id, slug, name, price_monthly, max_projects, max_users, is_featured, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        setPlans((data || []) as Plan[]);
        setLoading(false);
      });
  }, [open]);

  const currentPlan = plans.find((p) => p.slug === currentPlanSlug);
  const upgradePlans = plans.filter((p) => {
    if (!currentPlan) return true;
    return Number(p.price_monthly) > Number(currentPlan.price_monthly);
  });

  const handleUpgrade = async (plan: Plan) => {
    setProcessingSlug(plan.slug);
    try {
      const { data, error } = await supabase.functions.invoke("whitelabel-upgrade-checkout", {
        body: { tenant_id: tenantId, target_plan_slug: plan.slug },
      });
      if (error) throw error;
      if (data?.invoice_url) {
        window.open(data.invoice_url, "_blank");
        toast.success("Link de pagamento gerado! Conclua o pagamento para ativar o novo plano.");
        onOpenChange(false);
      } else {
        throw new Error("Link de pagamento não retornado");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar pagamento: " + (err?.message || "tente novamente"));
    } finally {
      setProcessingSlug(null);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Limite de projetos atingido</DialogTitle>
              <DialogDescription className="mt-1">
                Você está usando <strong>{activeProjectsCount}</strong> de{" "}
                <strong>{currentMaxProjects}</strong> projetos do plano{" "}
                <strong>{currentPlan?.name || currentPlanSlug || "atual"}</strong>. Faça upgrade
                para criar mais projetos em <strong>{tenantName}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando planos...
          </div>
        ) : upgradePlans.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Você já está no plano mais alto disponível. Entre em contato com o suporte para
            opções customizadas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {upgradePlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-5 transition-all ${
                  plan.is_featured
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {plan.is_featured && (
                  <Badge className="absolute -top-2 right-4 bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Recomendado
                  </Badge>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">{fmt(Number(plan.price_monthly))}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                <ul className="space-y-2 text-sm mb-5">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      <strong>{plan.max_projects ?? "∞"}</strong> projetos ativos
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      <strong>{plan.max_users ?? "∞"}</strong> usuários
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>Todos os módulos do sistema</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>

                <Button
                  className="w-full"
                  variant={plan.is_featured ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan)}
                  disabled={processingSlug !== null}
                >
                  {processingSlug === plan.slug ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando pagamento...
                    </>
                  ) : (
                    <>
                      Fazer upgrade
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          O pagamento abre em nova aba via Pix ou Boleto. Após confirmação, o plano é ativado
          automaticamente.
        </p>
      </DialogContent>
    </Dialog>
  );
}

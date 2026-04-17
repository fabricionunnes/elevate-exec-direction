import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, Check, History } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    name: string;
    plan_slug: string | null;
    max_active_projects: number;
    max_users: number | null;
  } | null;
  onShowHistory?: () => void;
}

export function ChangeTenantPlanDialog({ open, onOpenChange, tenant, onShowHistory }: Props) {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["plans-for-change", tenant?.id],
    queryFn: async () => {
      if (!tenant) return [];
      const { data, error } = await supabase
        .from("whitelabel_plans")
        .select("*")
        .eq("is_active", true)
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant && open,
  });

  useEffect(() => {
    if (open && tenant && plans) {
      const current = plans.find((p: any) => p.slug === tenant.plan_slug);
      setSelectedPlanId(current?.id || null);
      setReason("");
    }
  }, [open, tenant, plans]);

  const selectedPlan = plans?.find((p: any) => p.id === selectedPlanId);
  const currentPlan = plans?.find((p: any) => p.slug === tenant?.plan_slug);

  const handleConfirm = async () => {
    if (!tenant || !selectedPlan) return;
    if (selectedPlan.slug === tenant.plan_slug) {
      toast.info("Este já é o plano atual");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("name")
        .eq("user_id", user?.id || "")
        .maybeSingle();

      const newMaxProjects = selectedPlan.max_projects ?? tenant.max_active_projects;
      const newMaxUsers = selectedPlan.max_users;

      const { error: upErr } = await supabase
        .from("whitelabel_tenants")
        .update({
          plan_slug: selectedPlan.slug,
          max_active_projects: newMaxProjects,
          max_users: newMaxUsers,
          enabled_modules: selectedPlan.enabled_modules,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);
      if (upErr) throw upErr;

      const { error: histErr } = await supabase
        .from("whitelabel_tenant_plan_history")
        .insert({
          tenant_id: tenant.id,
          previous_plan_slug: tenant.plan_slug,
          new_plan_slug: selectedPlan.slug,
          previous_max_projects: tenant.max_active_projects,
          new_max_projects: newMaxProjects,
          previous_max_users: tenant.max_users,
          new_max_users: newMaxUsers,
          changed_by: user?.id,
          changed_by_name: staff?.name || user?.email || null,
          reason: reason.trim() || null,
        });
      if (histErr) console.warn("Falha ao registrar histórico:", histErr.message);

      toast.success(`Plano alterado para ${selectedPlan.name}`);
      queryClient.invalidateQueries({ queryKey: ["unv-whitelabel-tenants"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao alterar plano"));
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Alterar Plano: {tenant.name}</span>
            {onShowHistory && (
              <Button variant="ghost" size="sm" onClick={onShowHistory} className="gap-1">
                <History className="h-3.5 w-3.5" />
                Histórico
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">Plano atual:</p>
            <p className="font-medium text-foreground">
              {currentPlan?.name || tenant.plan_slug || "Sem plano"}
              {currentPlan && (
                <span className="text-xs text-muted-foreground ml-2">
                  R$ {Number(currentPlan.price_monthly).toFixed(2)}/mês •{" "}
                  {currentPlan.max_projects ?? "∞"} projetos •{" "}
                  {currentPlan.max_users ?? "∞"} usuários
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Selecione o novo plano</Label>
            <div className="grid grid-cols-1 gap-2">
              {plans?.map((p: any) => {
                const isSelected = p.id === selectedPlanId;
                const isCurrent = p.slug === tenant.plan_slug;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">Atual</Badge>
                          )}
                          {p.tenant_id && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Personalizado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          R$ {Number(p.price_monthly).toFixed(2)}/mês •{" "}
                          {p.max_projects ?? "∞"} projetos • {p.max_users ?? "∞"} usuários
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPlan && currentPlan && selectedPlan.id !== currentPlan.id && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span>{currentPlan.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{selectedPlan.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Limites e módulos inclusos serão atualizados imediatamente.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Upgrade solicitado pelo cliente, retenção, downgrade por inadimplência..."
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || !selectedPlan || selectedPlan.slug === tenant.plan_slug}
              className="flex-1"
            >
              {saving ? "Aplicando..." : "Confirmar Mudança"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

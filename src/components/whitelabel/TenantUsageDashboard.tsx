import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FolderOpen, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

export function TenantUsageDashboard() {
  const { tenant } = useTenant();

  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ["whitelabel-subscription", tenant?.id],
    queryFn: async () => {
      if (!tenant) return null;
      const { data, error } = await supabase
        .from("whitelabel_subscriptions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant,
  });

  const { data: projectCount } = useQuery({
    queryKey: ["whitelabel-project-count", tenant?.id],
    queryFn: async () => {
      if (!tenant) return 0;
      const { count, error } = await supabase
        .from("onboarding_projects")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "active");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenant,
  });

  const maxProjects = tenant?.max_active_projects || 5;
  const activeProjects = projectCount || subscription?.active_projects_count || 0;
  const usagePercent = Math.min((activeProjects / maxProjects) * 100, 100);
  const isOverLimit = activeProjects >= maxProjects;

  const statusLabel = (status?: string) => {
    switch (status) {
      case "active": return "Ativa";
      case "trial": return "Período de teste";
      case "suspended": return "Suspensa";
      case "cancelled": return "Cancelada";
      default: return status || "—";
    }
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case "active": return "default";
      case "trial": return "secondary";
      case "suspended": return "destructive";
      default: return "outline" as any;
    }
  };

  if (!tenant) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant ativo. Este painel é para administradores de tenants white-label.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={statusColor(tenant.status)}>
                    {statusLabel(tenant.status)}
                  </Badge>
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                <p className="text-2xl font-bold text-foreground">
                  {activeProjects} <span className="text-sm font-normal text-muted-foreground">/ {maxProjects}</span>
                </p>
              </div>
              <FolderOpen className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor por Projeto</p>
                <p className="text-2xl font-bold text-foreground">
                  {subscription?.price_per_project
                    ? `R$ ${Number(subscription.price_per_project).toFixed(2)}`
                    : "—"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            Uso de Projetos
          </CardTitle>
          <CardDescription>
            Consumo atual do seu plano
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Projetos ativos</span>
              <span className="font-medium text-foreground">
                {activeProjects} de {maxProjects}
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
          </div>

          {isOverLimit && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                Você atingiu o limite de projetos do seu plano. Entre em contato para upgrade.
              </p>
            </div>
          )}

          {subscription && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Valor estimado mensal:{" "}
                <span className="font-medium text-foreground">
                  R$ {(activeProjects * Number(subscription.price_per_project || 0)).toFixed(2)}
                </span>
              </p>
              {subscription.current_period_end && (
                <p className="text-xs text-muted-foreground mt-1">
                  Próxima cobrança:{" "}
                  <span className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { ReactNode } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModuleGuardProps {
  module: string;
  /** Nome amigável exibido no bloqueio (ex: "Financeiro") */
  label?: string;
  children: ReactNode;
}

/**
 * Bloqueia o acesso à rota se o módulo NÃO estiver habilitado em
 * whitelabel_tenants.enabled_modules para o tenant atual.
 *
 * Master UNV (sem tenant) sempre passa.
 */
export function ModuleGuard({ module, label, children }: ModuleGuardProps) {
  const { tenant, isLoading, isModuleEnabled } = useTenant();
  const navigate = useNavigate();

  if (isLoading) return null; // evita flash
  if (!tenant) return <>{children}</>; // master UNV
  if (isModuleEnabled(module)) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Módulo {label || module} indisponível
          </h2>
          <p className="text-sm text-muted-foreground">
            Este módulo não está incluído no plano do tenant{" "}
            <strong className="text-foreground">{tenant.name}</strong>. Entre em
            contato com o suporte UNV para liberar.
          </p>
          <Button variant="outline" onClick={() => navigate("/onboarding-tasks")} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

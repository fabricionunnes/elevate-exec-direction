import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, LogOut, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TenantBlockedScreenProps {
  tenantName: string;
  status: string;
  paymentStatus?: string;
  paymentLink?: string | null;
}

export function TenantBlockedScreen({
  tenantName,
  status,
  paymentStatus,
  paymentLink,
}: TenantBlockedScreenProps) {
  const isPaymentPending = status === "pending_payment" || paymentStatus === "pending";
  const isSuspended = status === "suspended";
  const isInactive = status === "inactive";

  const title = isPaymentPending
    ? "Pagamento pendente"
    : isSuspended
      ? "Conta suspensa"
      : isInactive
        ? "Conta inativada"
        : "Acesso indisponível";

  const description = isPaymentPending
    ? "O acesso será liberado automaticamente após a confirmação do primeiro pagamento."
    : isSuspended
      ? "Sua conta foi suspensa. Entre em contato com o suporte para regularizar."
      : isInactive
        ? "Esta conta foi desativada pelo administrador. Entre em contato com o suporte."
        : "Não foi possível liberar o acesso ao painel.";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            {isPaymentPending ? (
              <Lock className="h-7 w-7 text-destructive" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-destructive" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{tenantName}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>

          {isPaymentPending && paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full">Pagar agora</Button>
            </a>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

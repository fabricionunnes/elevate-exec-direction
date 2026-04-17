import { Clock, ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantName: string;
  paymentLink: string | null;
  dueDate: string | null;
  onRefresh?: () => void;
}

export function TenantPendingPaymentScreen({ tenantName, paymentLink, dueDate, onRefresh }: Props) {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-amber-500/30 shadow-xl">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Aguardando Pagamento
            </h1>
            <p className="text-muted-foreground">
              Sua conta <strong>{tenantName}</strong> está criada, mas o acesso só será liberado após a confirmação do pagamento da primeira mensalidade.
            </p>
            {dueDate && (
              <p className="text-sm text-muted-foreground">
                Vencimento: {format(new Date(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {paymentLink ? (
              <Button asChild size="lg" className="w-full">
                <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pagar Agora (Boleto / PIX / Cartão)
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Link de pagamento não disponível. Entre em contato com o suporte.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Já paguei — verificar novamente
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Após a confirmação, seu acesso é liberado <strong>automaticamente</strong>.
            Você não precisa fazer nada manualmente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

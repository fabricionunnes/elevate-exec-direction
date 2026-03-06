import { AlertTriangle, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface Props {
  companyId: string;
  companyName?: string;
}

export function BillingBlockedScreen({ companyId, companyName }: Props) {
  const navigate = useNavigate();
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverdueInvoice = async () => {
      const { data } = await supabase
        .from("company_invoices")
        .select("public_token, payment_link_url")
        .eq("company_id", companyId)
        .eq("status", "overdue")
        .order("due_date", { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        if (data[0].payment_link_url) {
          setPaymentLink(data[0].payment_link_url);
        } else if (data[0].public_token) {
          const baseUrl = getPublicBaseUrl();
          setPaymentLink(`${baseUrl}/#/fatura?token=${data[0].public_token}`);
        }
      }
      setLoading(false);
    };
    fetchOverdueInvoice();
  }, [companyId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/onboarding-tasks/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-destructive/30 shadow-xl">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Acesso Temporariamente Suspenso
            </h1>
            <p className="text-muted-foreground">
              {companyName ? (
                <>O acesso da empresa <strong>{companyName}</strong> foi suspenso devido a uma pendência financeira.</>
              ) : (
                <>Seu acesso foi suspenso devido a uma pendência financeira.</>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Para restabelecer o acesso, regularize o pagamento da fatura em atraso.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {!loading && paymentLink && (
              <Button asChild size="lg" className="w-full">
                <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pagar Fatura em Atraso
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Link2, AlertTriangle } from "lucide-react";

export function BillingPaymentsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cobranças & Pagamentos</h2>
        <p className="text-muted-foreground">Gerencie links de pagamento e cobranças</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="font-medium">Links de Pagamento</p>
            <p className="text-sm text-muted-foreground">Gere e gerencie links de cobrança</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="font-medium">Integração Conta Azul</p>
            <p className="text-sm text-muted-foreground">Configure para buscar links automaticamente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500/50 mb-4" />
            <p className="font-medium">Inadimplência</p>
            <p className="text-sm text-muted-foreground">Monitore e gerencie atrasos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Configure a integração com Conta Azul para ver cobranças aqui
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Building2, CreditCard, RefreshCw } from "lucide-react";

export function IntegrationsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrações</h2>
        <p className="text-muted-foreground">Conecte sistemas externos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </div>
                Conta Azul
              </CardTitle>
              <Badge variant="outline">Não configurado</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sincronize clientes, contratos, contas a pagar/receber e pagamentos automaticamente.
            </p>
            <Button variant="outline" className="w-full">
              <Link2 className="h-4 w-4 mr-2" />
              Configurar Integração
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
                Open Banking
              </CardTitle>
              <Badge variant="outline">Em breve</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte suas contas bancárias para importar extratos e conciliar automaticamente.
            </p>
            <Button variant="outline" className="w-full" disabled>
              <Link2 className="h-4 w-4 mr-2" />
              Em Desenvolvimento
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status das Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma integração ativa. Configure acima para começar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

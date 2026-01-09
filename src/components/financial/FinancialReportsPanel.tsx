import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, PieChart, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinancialReportsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Relatórios Financeiros</h2>
        <p className="text-muted-foreground">DRE, DFC e indicadores</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <FileText className="h-10 w-10 mx-auto text-primary mb-3" />
            <p className="font-medium">DRE</p>
            <p className="text-xs text-muted-foreground">Demonstração de Resultado</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-blue-500 mb-3" />
            <p className="font-medium">DFC</p>
            <p className="text-xs text-muted-foreground">Fluxo de Caixa</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium">KPIs</p>
            <p className="text-xs text-muted-foreground">MRR, ARR, Churn, LTV</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <PieChart className="h-10 w-10 mx-auto text-purple-500 mb-3" />
            <p className="font-medium">Análise</p>
            <p className="text-xs text-muted-foreground">Por categoria e período</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relatório do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Selecione um tipo de relatório acima para visualizar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

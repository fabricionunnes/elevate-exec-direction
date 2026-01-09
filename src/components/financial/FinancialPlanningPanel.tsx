import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Target, TrendingUp } from "lucide-react";

export function FinancialPlanningPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Planejamento Financeiro</h2>
        <p className="text-muted-foreground">Orçamento, metas e simulações</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-12 w-12 mx-auto text-primary/50 mb-4" />
            <p className="font-medium">Orçamento Mensal</p>
            <p className="text-sm text-muted-foreground">Defina metas por categoria</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calculator className="h-12 w-12 mx-auto text-blue-500/50 mb-4" />
            <p className="font-medium">Planejado vs Realizado</p>
            <p className="text-sm text-muted-foreground">Compare performance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-emerald-500/50 mb-4" />
            <p className="font-medium">Simulações</p>
            <p className="text-sm text-muted-foreground">Cenários de crescimento</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projeções</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Configure orçamentos para ver projeções aqui
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

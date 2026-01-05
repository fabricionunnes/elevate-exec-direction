import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, DollarSign, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CACFormData {
  id: string;
  facebook_ads_investment: number | null;
  google_ads_investment: number | null;
  linkedin_ads_investment: number | null;
  sales_quantity_3_months: number | null;
  sales_value_3_months: number | null;
  submitted_at: string;
}

interface ClientMetricsViewProps {
  projectId: string;
}

export const ClientMetricsView = ({ projectId }: ClientMetricsViewProps) => {
  const [cacData, setCacData] = useState<CACFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCACData = async () => {
      try {
        const { data, error } = await supabase
          .from("onboarding_cac_forms")
          .select("*")
          .eq("project_id", projectId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setCacData(data);
      } catch (error) {
        console.error("Error fetching CAC data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCACData();
  }, [projectId]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!cacData) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-lg mb-2">Métricas não disponíveis</h3>
          <p className="text-muted-foreground text-sm">
            Os dados de investimento e vendas ainda não foram preenchidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate metrics
  const totalInvestment = 
    (cacData.facebook_ads_investment || 0) + 
    (cacData.google_ads_investment || 0) + 
    (cacData.linkedin_ads_investment || 0);
  const totalInvestment3Months = totalInvestment * 3;
  const totalSalesQty = cacData.sales_quantity_3_months || 0;
  const totalSalesValue = cacData.sales_value_3_months || 0;

  const cac = totalSalesQty > 0 ? totalInvestment3Months / totalSalesQty : null;
  const ticketMedio = totalSalesQty > 0 && totalSalesValue > 0 ? totalSalesValue / totalSalesQty : null;
  const lucroLiquido = totalSalesValue - totalInvestment3Months;
  const roi = totalInvestment3Months > 0 ? (lucroLiquido / totalInvestment3Months) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-xs text-muted-foreground">
          Atualizado em {format(new Date(cacData.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Custo por Venda */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500/10 via-green-500/10 to-emerald-500/10 p-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Economia do Tráfego</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Custo por venda */}
            <div className="text-center p-4 rounded-xl bg-white/80 dark:bg-card/80 border">
              <p className="text-sm text-muted-foreground mb-2">Para cada venda de</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(ticketMedio)}</p>
              <p className="text-sm text-muted-foreground my-2">você gasta</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(cac)}</p>
            </div>

            {/* Projeção 10x */}
            <div className="text-center p-4 rounded-xl bg-white/80 dark:bg-card/80 border">
              <p className="text-sm text-muted-foreground mb-2">Se quiser vender</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesValue * 10)}</p>
              <p className="text-sm text-muted-foreground my-2">precisa investir</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalInvestment3Months * 10)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">CAC</span>
          </div>
          <p className="text-xl font-bold text-primary">
            {cac ? formatCurrency(cac) : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Custo por cliente</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-muted-foreground">Ticket Médio</span>
          </div>
          <p className="text-xl font-bold text-green-600">
            {ticketMedio ? formatCurrency(ticketMedio) : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Valor por venda</p>
        </Card>

        <Card className={`p-4 ${roi && roi > 0 ? '' : 'bg-red-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium text-muted-foreground">ROI</span>
          </div>
          <p className={`text-xl font-bold ${roi && roi > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {roi ? `${roi.toFixed(0)}%` : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Retorno sobre investimento</p>
        </Card>

        <Card className={`p-4 ${lucroLiquido > 0 ? '' : 'bg-red-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium text-muted-foreground">Lucro</span>
          </div>
          <p className={`text-xl font-bold ${lucroLiquido > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(lucroLiquido)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Faturamento - Investimento</p>
        </Card>
      </div>

      {/* Investimento por canal */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Investimento Mensal por Canal</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/5">
              <span className="text-sm">Facebook ADS</span>
              <span className="font-medium">{formatCurrency(cacData.facebook_ads_investment)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-red-500/5">
              <span className="text-sm">Google ADS</span>
              <span className="font-medium">{formatCurrency(cacData.google_ads_investment)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-sky-500/5">
              <span className="text-sm">LinkedIn ADS</span>
              <span className="font-medium">{formatCurrency(cacData.linkedin_ads_investment)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-primary/5 border-t">
              <span className="text-sm font-medium">Total/mês</span>
              <span className="font-bold text-primary">{formatCurrency(totalInvestment)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

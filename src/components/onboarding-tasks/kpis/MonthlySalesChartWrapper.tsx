import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SingleMonthlySalesChart } from "./SingleMonthlySalesChart";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface Salesperson {
  id: string;
  team_id: string | null;
  sector_id: string | null;
  unit_id?: string | null;
}

interface MonthlySalesChartWrapperProps {
  companyId: string;
  projectId?: string;
  companyName?: string;
  salespeople?: Salesperson[];
  sectorTeams?: SectorTeam[];
  selectedUnit?: string;
  selectedTeam?: string;
  selectedSector?: string;
  selectedSalesperson?: string;
}

interface MonetaryKpi {
  id: string;
  name: string;
  kpi_type: string;
  target_value: number;
  is_main_goal: boolean | null;
}

/**
 * Wrapper that detects if company has both "Faturamento" and "Receita" KPIs
 * and renders separate charts for each. Otherwise, renders a single combined chart.
 */
export const MonthlySalesChartWrapper = (props: MonthlySalesChartWrapperProps) => {
  const { companyId, ...rest } = props;
  const [loading, setLoading] = useState(true);
  const [monetaryKpis, setMonetaryKpis] = useState<MonetaryKpi[]>([]);

  useEffect(() => {
    const fetchMonetaryKpis = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("company_kpis")
          .select("id, name, kpi_type, target_value, is_main_goal")
          .eq("company_id", companyId)
          .eq("kpi_type", "monetary")
          .or("is_active.is.null,is_active.eq.true");

        if (error) throw error;
        setMonetaryKpis((data || []) as MonetaryKpi[]);
      } catch (err) {
        console.error("Error fetching monetary KPIs:", err);
        setMonetaryKpis([]);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchMonetaryKpis();
    }
  }, [companyId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Detect if we have separate Faturamento and Receita KPIs
  const isFaturamento = (name: string) => /faturamento/i.test(name);
  const isReceita = (name: string) => /receita|dinheiro.*(entrou|recebido)/i.test(name);

  const faturamentoKpi = monetaryKpis.find(k => isFaturamento(k.name));
  const receitaKpi = monetaryKpis.find(k => isReceita(k.name));

  const hasBothTypes = faturamentoKpi && receitaKpi && faturamentoKpi.id !== receitaKpi.id;

  if (hasBothTypes) {
    // Render two separate charts
    return (
      <div className="space-y-4">
        <SingleMonthlySalesChart
          companyId={companyId}
          kpiId={faturamentoKpi.id}
          kpiName={faturamentoKpi.name}
          kpiTargetValue={faturamentoKpi.target_value}
          {...rest}
        />
        <SingleMonthlySalesChart
          companyId={companyId}
          kpiId={receitaKpi.id}
          kpiName={receitaKpi.name}
          kpiTargetValue={receitaKpi.target_value}
          {...rest}
        />
      </div>
    );
  }

  // Single chart for all monetary KPIs combined
  return (
    <SingleMonthlySalesChart
      companyId={companyId}
      kpiIds={monetaryKpis.map(k => k.id)}
      kpiName={monetaryKpis[0]?.name || "Vendas"}
      kpiTargetValue={monetaryKpis[0]?.target_value || 0}
      {...rest}
    />
  );
};

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
  filterKpiIds?: string[];
  titleSuffix?: string;
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
  const { companyId, filterKpiIds, titleSuffix, ...rest } = props;
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

  // If filterKpiIds is provided, only use those specific KPIs
  const effectiveKpis = filterKpiIds && filterKpiIds.length > 0
    ? monetaryKpis.filter(k => filterKpiIds.includes(k.id))
    : monetaryKpis;

  if (effectiveKpis.length === 0) return null;

  // If filtering to specific KPIs (per main goal), render a single chart
  if (filterKpiIds && filterKpiIds.length > 0) {
    const mainKpi = effectiveKpis[0];
    return (
      <SingleMonthlySalesChart
        companyId={companyId}
        kpiIds={effectiveKpis.map(k => k.id)}
        kpiName={titleSuffix ? `Vendas Mês a Mês — ${titleSuffix}` : mainKpi.name}
        kpiTargetValue={mainKpi.target_value}
        {...rest}
      />
    );
  }

  // Detect Faturamento and Receita KPIs
  const isFaturamento = (name: string) => /faturamento|vendas?|pedido|contrato/i.test(name) && !/receit|dinheiro|caixa|recebid/i.test(name);
  const isReceita = (name: string) => /receita|dinheiro|caixa|recebid/i.test(name);

  // Group KPIs by type
  const faturamentoKpis = effectiveKpis.filter(k => isFaturamento(k.name));
  const receitaKpis = effectiveKpis.filter(k => isReceita(k.name));
  
  // KPIs that don't match either pattern - treat as faturamento
  const otherKpis = effectiveKpis.filter(k => !isFaturamento(k.name) && !isReceita(k.name));
  const allFaturamentoKpis = [...faturamentoKpis, ...otherKpis];

  const hasBothTypes = allFaturamentoKpis.length > 0 && receitaKpis.length > 0;

  if (hasBothTypes) {
    const mainFaturamento = allFaturamentoKpis.find(k => k.is_main_goal) || allFaturamentoKpis[0];
    const mainReceita = receitaKpis.find(k => k.is_main_goal) || receitaKpis[0];
    
    return (
      <div className="space-y-4">
        <SingleMonthlySalesChart
          companyId={companyId}
          kpiIds={allFaturamentoKpis.map(k => k.id)}
          kpiName={mainFaturamento.name}
          kpiTargetValue={mainFaturamento.target_value}
          {...rest}
        />
        <SingleMonthlySalesChart
          companyId={companyId}
          kpiIds={receitaKpis.map(k => k.id)}
          kpiName={mainReceita.name}
          kpiTargetValue={mainReceita.target_value}
          {...rest}
        />
      </div>
    );
  }

  // Single chart for all monetary KPIs combined
  const mainKpi = effectiveKpis.find(k => k.is_main_goal) || effectiveKpis[0];
  return (
    <SingleMonthlySalesChart
      companyId={companyId}
      kpiIds={effectiveKpis.map(k => k.id)}
      kpiName={mainKpi?.name || "Vendas"}
      kpiTargetValue={mainKpi?.target_value || 0}
      {...rest}
    />
  );
};

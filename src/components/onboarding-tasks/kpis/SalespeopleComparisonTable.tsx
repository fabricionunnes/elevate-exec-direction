import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  is_individual: boolean;
  is_main_goal?: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  unit_id: string | null;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  value: number;
  unit_id: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface SalespeopleComparisonTableProps {
  kpis: KPI[];
  salespeople: Salesperson[];
  entries: Entry[];
  units: Unit[];
  selectedUnit: string;
}

export const SalespeopleComparisonTable = ({
  kpis,
  salespeople,
  entries,
  units,
  selectedUnit,
}: SalespeopleComparisonTableProps) => {
  // Filter salespeople by unit if selected
  const filteredSalespeople = useMemo(() => {
    if (selectedUnit === "all") return salespeople;
    return salespeople.filter((sp) => sp.unit_id === selectedUnit);
  }, [salespeople, selectedUnit]);

  // Get the main goal KPI for the comparison (or fallback to monetary)
  const mainGoalKpi = useMemo(() => {
    const mainGoal = kpis.find((k) => k.is_main_goal);
    return mainGoal || kpis.find((k) => k.kpi_type === "monetary");
  }, [kpis]);

  // Get sales count KPI
  const salesKpi = useMemo(() => {
    return kpis.find((k) =>
      k.name.toLowerCase().includes("venda") ||
      k.name.toLowerCase().includes("fechamento")
    );
  }, [kpis]);

  // Calculate totals per salesperson
  const salespeopleData = useMemo(() => {
    const data = filteredSalespeople.map((sp) => {
      const spEntries = entries.filter((e) => e.salesperson_id === sp.id);

      // Main goal total
      const mainGoalTotal = mainGoalKpi
        ? spEntries
            .filter((e) => e.kpi_id === mainGoalKpi.id)
            .reduce((sum, e) => sum + e.value, 0)
        : 0;

      // Sales count total
      const salesTotal = salesKpi
        ? spEntries
            .filter((e) => e.kpi_id === salesKpi.id)
            .reduce((sum, e) => sum + e.value, 0)
        : 0;

      // Calculate all KPI totals
      const kpiTotals: Record<string, number> = {};
      kpis.forEach((kpi) => {
        kpiTotals[kpi.id] = spEntries
          .filter((e) => e.kpi_id === kpi.id)
          .reduce((sum, e) => sum + e.value, 0);
      });

      // Calculate average ticket
      const avgTicket = salesTotal > 0 ? mainGoalTotal / salesTotal : 0;

      // Get unit name
      const unit = units.find((u) => u.id === sp.unit_id);

      return {
        id: sp.id,
        name: sp.name,
        unitName: unit?.name || "-",
        mainGoalValue: mainGoalTotal,
        salesCount: salesTotal,
        avgTicket,
        kpiTotals,
      };
    });

    // Sort by main goal value descending
    return data.sort((a, b) => b.mainGoalValue - a.mainGoalValue);
  }, [filteredSalespeople, entries, kpis, mainGoalKpi, salesKpi, units]);

  // Calculate team averages for comparison
  const teamAverages = useMemo(() => {
    const total = salespeopleData.length;
    if (total === 0) return { mainGoalValue: 0, salesCount: 0, avgTicket: 0 };

    const totals = salespeopleData.reduce(
      (acc, sp) => ({
        mainGoalValue: acc.mainGoalValue + sp.mainGoalValue,
        salesCount: acc.salesCount + sp.salesCount,
        avgTicket: acc.avgTicket + sp.avgTicket,
      }),
      { mainGoalValue: 0, salesCount: 0, avgTicket: 0 }
    );

    return {
      mainGoalValue: totals.mainGoalValue / total,
      salesCount: totals.salesCount / total,
      avgTicket: totals.avgTicket / total,
    };
  }, [salespeopleData]);

  const formatValue = (value: number, kpiType?: string) => {
    if (kpiType === "monetary") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } else if (kpiType === "percentage") {
      return `${value.toFixed(1)}%`;
    }
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  const getComparisonBadge = (value: number, average: number) => {
    if (average === 0) return null;
    const diff = ((value - average) / average) * 100;

    if (diff > 10) {
      return (
        <Badge variant="default" className="ml-2 gap-1 bg-green-600">
          <TrendingUp className="h-3 w-3" />
          +{diff.toFixed(0)}%
        </Badge>
      );
    } else if (diff < -10) {
      return (
        <Badge variant="destructive" className="ml-2 gap-1">
          <TrendingDown className="h-3 w-3" />
          {diff.toFixed(0)}%
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="ml-2 gap-1">
        <Minus className="h-3 w-3" />
        Média
      </Badge>
    );
  };

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <Badge className="bg-yellow-500 text-yellow-950">
          <Trophy className="h-3 w-3 mr-1" />1º
        </Badge>
      );
    } else if (index === 1) {
      return (
        <Badge className="bg-gray-400 text-gray-900">
          2º
        </Badge>
      );
    } else if (index === 2) {
      return (
        <Badge className="bg-amber-600 text-amber-50">
          3º
        </Badge>
      );
    }
    return <span className="text-muted-foreground">{index + 1}º</span>;
  };

  if (salespeopleData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Comparativo de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum vendedor encontrado para o filtro selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Comparativo de Vendedores
          <Badge variant="outline" className="ml-2">
            {salespeopleData.length} vendedor{salespeopleData.length !== 1 ? "es" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Vendedor</TableHead>
                {selectedUnit === "all" && <TableHead>Unidade</TableHead>}
                <TableHead className="text-right">{mainGoalKpi?.name || "Meta Principal"}</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-center">vs. Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salespeopleData.map((sp, index) => (
                <TableRow key={sp.id}>
                  <TableCell>{getRankBadge(index)}</TableCell>
                  <TableCell className="font-medium">{sp.name}</TableCell>
                  {selectedUnit === "all" && (
                    <TableCell>
                      <Badge variant="outline">{sp.unitName}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right font-bold">
                    {formatValue(sp.mainGoalValue, mainGoalKpi?.kpi_type)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(sp.salesCount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(sp.avgTicket)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getComparisonBadge(sp.mainGoalValue, teamAverages.mainGoalValue)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Team Average Row */}
              <TableRow className="bg-muted/50 font-medium border-t-2">
                <TableCell></TableCell>
                <TableCell>Média da Equipe</TableCell>
                {selectedUnit === "all" && <TableCell>-</TableCell>}
                <TableCell className="text-right">
                  {formatValue(teamAverages.mainGoalValue, mainGoalKpi?.kpi_type)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(teamAverages.salesCount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(teamAverages.avgTicket)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

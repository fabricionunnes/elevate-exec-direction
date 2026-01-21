import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  FileText,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projectId: string;
}

interface DREData {
  totalRevenue: number;
  revenueByCategory: Record<string, number>;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  operationalResult: number;
  netResult: number;
}

interface DFCData {
  operationalFlow: number;
  investmentFlow: number;
  financingFlow: number;
  cashVariation: number;
  openingBalance: number;
  closingBalance: number;
}

export function ClientFinancialReportsPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<"dre" | "dfc">("dre");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [dreData, setDreData] = useState<DREData>({
    totalRevenue: 0,
    revenueByCategory: {},
    totalExpenses: 0,
    expensesByCategory: {},
    operationalResult: 0,
    netResult: 0,
  });
  const [dfcData, setDfcData] = useState<DFCData>({
    operationalFlow: 0,
    investmentFlow: 0,
    financingFlow: 0,
    cashVariation: 0,
    openingBalance: 0,
    closingBalance: 0,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  useEffect(() => {
    loadData();
  }, [projectId, selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));

      // Fetch receivables
      const { data: receivables } = await supabase
        .from("client_financial_receivables")
        .select("*, category:client_financial_categories(*)")
        .eq("project_id", projectId)
        .eq("status", "paid");

      // Fetch payables
      const { data: payables } = await supabase
        .from("client_financial_payables")
        .select("*, category:client_financial_categories(*)")
        .eq("project_id", projectId)
        .eq("status", "paid");

      // Fetch sales
      const { data: sales } = await supabase
        .from("client_financial_sales")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "completed");

      const recArr = receivables || [];
      const payArr = payables || [];
      const salesArr = sales || [];

      // Filter by month for DRE
      const monthReceivables = recArr.filter(r => 
        r.paid_at && new Date(r.paid_at) >= monthStart && new Date(r.paid_at) <= monthEnd
      );

      const monthPayables = payArr.filter(p => 
        p.paid_at && new Date(p.paid_at) >= monthStart && new Date(p.paid_at) <= monthEnd
      );

      const monthSales = salesArr.filter(s => {
        const saleDate = new Date(s.sale_date);
        return saleDate >= monthStart && saleDate <= monthEnd;
      });

      // Calculate DRE
      const revenueByCategory: Record<string, number> = {};
      let totalRevenue = 0;

      // Add receivables revenue
      monthReceivables.forEach(r => {
        const amount = Number(r.paid_amount || r.amount);
        totalRevenue += amount;
        const catName = r.category?.name || "Sem categoria";
        revenueByCategory[catName] = (revenueByCategory[catName] || 0) + amount;
      });

      // Add sales revenue
      monthSales.forEach(s => {
        const amount = Number(s.total_amount);
        totalRevenue += amount;
        revenueByCategory["Vendas"] = (revenueByCategory["Vendas"] || 0) + amount;
      });

      const expensesByCategory: Record<string, number> = {};
      let totalExpenses = 0;

      monthPayables.forEach(p => {
        const amount = Number(p.paid_amount || p.amount);
        totalExpenses += amount;
        const catName = p.category?.name || "Sem categoria";
        expensesByCategory[catName] = (expensesByCategory[catName] || 0) + amount;
      });

      const operationalResult = totalRevenue - totalExpenses;

      setDreData({
        totalRevenue,
        revenueByCategory,
        totalExpenses,
        expensesByCategory,
        operationalResult,
        netResult: operationalResult, // Simplified - no taxes for now
      });

      // Calculate DFC
      const totalPaidInBefore = recArr
        .filter(r => r.paid_at && new Date(r.paid_at) < monthStart)
        .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

      const totalSalesBefore = salesArr
        .filter(s => new Date(s.sale_date) < monthStart)
        .reduce((sum, s) => sum + Number(s.total_amount), 0);

      const totalPaidOutBefore = payArr
        .filter(p => p.paid_at && new Date(p.paid_at) < monthStart)
        .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

      const openingBalance = totalPaidInBefore + totalSalesBefore - totalPaidOutBefore;

      // Categorize flows (simplified)
      const operationalIncomeReceivables = monthReceivables.reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);
      const operationalIncomeSales = monthSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const operationalIncome = operationalIncomeReceivables + operationalIncomeSales;
      
      const operationalExpense = monthPayables.reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);
      const operationalFlow = operationalIncome - operationalExpense;

      const cashVariation = operationalFlow;
      const closingBalance = openingBalance + cashVariation;

      setDfcData({
        operationalFlow,
        investmentFlow: 0, // Would need specific categories
        financingFlow: 0, // Would need specific categories
        cashVariation,
        openingBalance,
        closingBalance,
      });

    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExport = () => {
    let content = "";
    const monthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

    if (reportType === "dre") {
      content = `DRE - ${monthLabel}\n\n`;
      content += "RECEITAS\n";
      Object.entries(dreData.revenueByCategory).forEach(([cat, val]) => {
        content += `  ${cat}: ${formatCurrency(val)}\n`;
      });
      content += `  TOTAL RECEITAS: ${formatCurrency(dreData.totalRevenue)}\n\n`;
      content += "DESPESAS\n";
      Object.entries(dreData.expensesByCategory).forEach(([cat, val]) => {
        content += `  ${cat}: ${formatCurrency(val)}\n`;
      });
      content += `  TOTAL DESPESAS: ${formatCurrency(dreData.totalExpenses)}\n\n`;
      content += `RESULTADO OPERACIONAL: ${formatCurrency(dreData.operationalResult)}\n`;
      content += `RESULTADO LÍQUIDO: ${formatCurrency(dreData.netResult)}\n`;
    } else {
      content = `DFC - ${monthLabel}\n\n`;
      content += `Saldo Inicial: ${formatCurrency(dfcData.openingBalance)}\n\n`;
      content += `Fluxo Operacional: ${formatCurrency(dfcData.operationalFlow)}\n`;
      content += `Fluxo de Investimentos: ${formatCurrency(dfcData.investmentFlow)}\n`;
      content += `Fluxo de Financiamentos: ${formatCurrency(dfcData.financingFlow)}\n\n`;
      content += `Variação de Caixa: ${formatCurrency(dfcData.cashVariation)}\n`;
      content += `Saldo Final: ${formatCurrency(dfcData.closingBalance)}\n`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType.toUpperCase()}-${selectedMonth}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Relatórios Financeiros</h2>
          <p className="text-sm text-muted-foreground">DRE e DFC</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={reportType} onValueChange={(v) => setReportType(v as "dre" | "dfc")}>
        <TabsList>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="dfc">DFC</TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Demonstração do Resultado do Exercício
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Receitas */}
              <div>
                <h3 className="text-sm font-semibold text-green-600 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4" />
                  RECEITAS
                </h3>
                <div className="space-y-2 pl-4 border-l-2 border-green-200">
                  {Object.entries(dreData.revenueByCategory).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma receita no período</p>
                  ) : (
                    Object.entries(dreData.revenueByCategory).map(([cat, val]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span>{cat}</span>
                        <span className="font-medium">{formatCurrency(val)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span>Total Receitas</span>
                    <span className="text-green-600">{formatCurrency(dreData.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* Despesas */}
              <div>
                <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4" />
                  DESPESAS
                </h3>
                <div className="space-y-2 pl-4 border-l-2 border-red-200">
                  {Object.entries(dreData.expensesByCategory).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma despesa no período</p>
                  ) : (
                    Object.entries(dreData.expensesByCategory).map(([cat, val]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span>{cat}</span>
                        <span className="font-medium">({formatCurrency(val)})</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span>Total Despesas</span>
                    <span className="text-red-600">({formatCurrency(dreData.totalExpenses)})</span>
                  </div>
                </div>
              </div>

              {/* Resultado */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>RESULTADO OPERACIONAL</span>
                  <span className={dreData.operationalResult >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(dreData.operationalResult)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>RESULTADO LÍQUIDO</span>
                  <span className={dreData.netResult >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(dreData.netResult)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dfc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Demonstração do Fluxo de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Saldo Inicial */}
              <div className="flex justify-between text-sm font-medium bg-muted/50 rounded-lg p-3">
                <span>Saldo Inicial</span>
                <span className={dfcData.openingBalance >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(dfcData.openingBalance)}
                </span>
              </div>

              {/* Fluxos */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Fluxo Operacional</h4>
                  <div className="flex justify-between text-sm pl-4 border-l-2 border-blue-200">
                    <span>Atividades Operacionais</span>
                    <span className={dfcData.operationalFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(dfcData.operationalFlow)}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Fluxo de Investimentos</h4>
                  <div className="flex justify-between text-sm pl-4 border-l-2 border-amber-200">
                    <span>Atividades de Investimento</span>
                    <span className={dfcData.investmentFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(dfcData.investmentFlow)}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Fluxo de Financiamentos</h4>
                  <div className="flex justify-between text-sm pl-4 border-l-2 border-purple-200">
                    <span>Atividades de Financiamento</span>
                    <span className={dfcData.financingFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(dfcData.financingFlow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resultado */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>VARIAÇÃO DE CAIXA</span>
                  <span className={dfcData.cashVariation >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(dfcData.cashVariation)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>SALDO FINAL</span>
                  <span className={dfcData.closingBalance >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(dfcData.closingBalance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

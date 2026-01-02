import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target, TrendingUp, TrendingDown, CheckCircle2, Pencil, Save, X, ChevronLeft, ChevronRight, History, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MonthlyGoal {
  id: string;
  project_id: string;
  month: number;
  year: number;
  sales_target: number | null;
  sales_result: number | null;
  target_set_at: string | null;
  result_set_at: string | null;
  notes: string | null;
  is_historical?: boolean;
}

interface MonthlyGoalsCardProps {
  projectId: string;
  canEdit: boolean;
  currentStaffId: string | null;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const MonthlyGoalsCard = ({ projectId, canEdit, currentStaffId }: MonthlyGoalsCardProps) => {
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [showHistoricalDialog, setShowHistoricalDialog] = useState(false);
  const [historicalInputs, setHistoricalInputs] = useState<{[key: string]: { target: string; result: string }}>({});

  useEffect(() => {
    fetchGoals();
  }, [projectId]);

  useEffect(() => {
    const currentGoal = goals.find(g => g.month === selectedMonth && g.year === selectedYear);
    if (currentGoal) {
      setTargetValue(currentGoal.sales_target?.toString() || "");
      setResultValue(currentGoal.sales_result?.toString() || "");
      setNotesValue(currentGoal.notes || "");
    } else {
      setTargetValue("");
      setResultValue("");
      setNotesValue("");
    }
  }, [selectedMonth, selectedYear, goals]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_monthly_goals")
        .select("*")
        .eq("project_id", projectId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error: any) {
      console.error("Error fetching goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentGoal = goals.find(g => g.month === selectedMonth && g.year === selectedYear);

  const handleSaveTarget = async () => {
    try {
      const value = parseFloat(targetValue.replace(/[^\d.,]/g, "").replace(",", "."));
      
      if (isNaN(value)) {
        toast.error("Valor inválido");
        return;
      }

      if (currentGoal) {
        const { error } = await supabase
          .from("onboarding_monthly_goals")
          .update({
            sales_target: value,
            target_set_at: new Date().toISOString(),
            target_set_by: currentStaffId,
            notes: notesValue || null,
          })
          .eq("id", currentGoal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("onboarding_monthly_goals")
          .insert({
            project_id: projectId,
            month: selectedMonth,
            year: selectedYear,
            sales_target: value,
            target_set_at: new Date().toISOString(),
            target_set_by: currentStaffId,
            notes: notesValue || null,
          });

        if (error) throw error;
      }

      setEditingTarget(false);
      fetchGoals();
      toast.success("Meta salva com sucesso!");
    } catch (error: any) {
      console.error("Error saving target:", error);
      toast.error("Erro ao salvar meta");
    }
  };

  const handleSaveResult = async () => {
    try {
      const value = parseFloat(resultValue.replace(/[^\d.,]/g, "").replace(",", "."));
      
      if (isNaN(value)) {
        toast.error("Valor inválido");
        return;
      }

      if (currentGoal) {
        const { error } = await supabase
          .from("onboarding_monthly_goals")
          .update({
            sales_result: value,
            result_set_at: new Date().toISOString(),
            result_set_by: currentStaffId,
            notes: notesValue || null,
          })
          .eq("id", currentGoal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("onboarding_monthly_goals")
          .insert({
            project_id: projectId,
            month: selectedMonth,
            year: selectedYear,
            sales_result: value,
            result_set_at: new Date().toISOString(),
            result_set_by: currentStaffId,
            notes: notesValue || null,
          });

        if (error) throw error;
      }

      setEditingResult(false);
      fetchGoals();
      toast.success("Resultado salvo com sucesso!");
    } catch (error: any) {
      console.error("Error saving result:", error);
      toast.error("Erro ao salvar resultado");
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPerformanceStatus = () => {
    if (!currentGoal?.sales_target || !currentGoal?.sales_result) return null;
    
    const percentage = (currentGoal.sales_result / currentGoal.sales_target) * 100;
    
    if (percentage >= 100) {
      return { status: "success", label: "Meta atingida!", percentage, color: "text-green-500" };
    } else if (percentage >= 80) {
      return { status: "warning", label: "Quase lá!", percentage, color: "text-amber-500" };
    } else {
      return { status: "danger", label: "Abaixo da meta", percentage, color: "text-red-500" };
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
    setEditingTarget(false);
    setEditingResult(false);
  };

  const performance = getPerformanceStatus();

  // Get last 12 months for historical data entry (before current month)
  const getHistoricalMonths = () => {
    const result: { month: number; year: number; key: string }[] = [];
    let m = new Date().getMonth(); // Start from previous month
    let y = new Date().getFullYear();
    
    if (m === 0) {
      m = 12;
      y--;
    }
    
    for (let i = 0; i < 12; i++) {
      const key = `${y}-${m}`;
      result.push({ month: m, year: y, key });
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }
    return result;
  };

  // Get months for display - current month + 5 previous months
  const getRecentMonths = () => {
    const result: { month: number; year: number; goal?: MonthlyGoal }[] = [];
    let m = new Date().getMonth() + 1; // Current month
    let y = new Date().getFullYear();
    
    for (let i = 0; i < 6; i++) {
      const goal = goals.find(g => g.month === m && g.year === y);
      result.push({ month: m, year: y, goal });
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }
    return result.reverse(); // Show oldest to newest (left to right)
  };

  const handleSaveHistorical = async () => {
    try {
      const entries = Object.entries(historicalInputs).filter(
        ([_, values]) => values.target || values.result
      );

      if (entries.length === 0) {
        toast.error("Preencha pelo menos um mês");
        return;
      }

      for (const [key, values] of entries) {
        const [yearStr, monthStr] = key.split("-");
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        
        const target = values.target ? parseFloat(values.target.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
        const result = values.result ? parseFloat(values.result.replace(/[^\d.,]/g, "").replace(",", ".")) : null;

        if ((values.target && isNaN(target!)) || (values.result && isNaN(result!))) {
          toast.error(`Valor inválido para ${MONTH_NAMES[month - 1]}/${year}`);
          continue;
        }

        const existingGoal = goals.find(g => g.month === month && g.year === year);

        if (existingGoal) {
          const { error } = await supabase
            .from("onboarding_monthly_goals")
            .update({
              sales_target: target ?? existingGoal.sales_target,
              sales_result: result ?? existingGoal.sales_result,
              notes: "Dados históricos (antes do acompanhamento)",
            })
            .eq("id", existingGoal.id);

          if (error) throw error;
        } else if (target !== null || result !== null) {
          const { error } = await supabase
            .from("onboarding_monthly_goals")
            .insert({
              project_id: projectId,
              month,
              year,
              sales_target: target,
              sales_result: result,
              notes: "Dados históricos (antes do acompanhamento)",
            });

          if (error) throw error;
        }
      }

      setShowHistoricalDialog(false);
      setHistoricalInputs({});
      fetchGoals();
      toast.success("Dados históricos salvos com sucesso!");
    } catch (error: any) {
      console.error("Error saving historical data:", error);
      toast.error("Erro ao salvar dados históricos");
    }
  };

  const historicalMonths = getHistoricalMonths();
  const recentMonths = getRecentMonths();

  // Check if there are any historical entries
  const hasHistoricalData = goals.some(g => g.notes?.includes("históricos"));

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Acompanhamento de Metas
          </CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Dialog open={showHistoricalDialog} onOpenChange={setShowHistoricalDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <History className="h-4 w-4" />
                    Histórico
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Registrar Dados Históricos
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground mb-4">
                    Registre as metas e resultados dos últimos 12 meses antes de iniciar o acompanhamento. 
                    Isso permite visualizar a evolução "antes e depois" do cliente.
                  </p>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {historicalMonths.map(({ month, year, key }) => {
                        const existingGoal = goals.find(g => g.month === month && g.year === year);
                        const inputValues = historicalInputs[key] || { 
                          target: existingGoal?.sales_target?.toString() || "", 
                          result: existingGoal?.sales_result?.toString() || "" 
                        };
                        
                        return (
                          <div key={key} className="border rounded-lg p-3">
                            <div className="font-medium text-sm mb-2 flex items-center justify-between">
                              <span>{MONTH_NAMES[month - 1]} {year}</span>
                              {existingGoal && (
                                <Badge variant="outline" className="text-xs">
                                  {existingGoal.notes?.includes("históricos") ? "Histórico" : "Atual"}
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground">Meta (R$)</label>
                                <Input
                                  placeholder="Ex: 100000"
                                  value={inputValues.target}
                                  onChange={(e) => setHistoricalInputs(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], target: e.target.value, result: prev[key]?.result || inputValues.result }
                                  }))}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Resultado (R$)</label>
                                <Input
                                  placeholder="Ex: 95000"
                                  value={inputValues.result}
                                  onChange={(e) => setHistoricalInputs(prev => ({
                                    ...prev,
                                    [key]: { target: prev[key]?.target || inputValues.target, result: e.target.value }
                                  }))}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowHistoricalDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveHistorical}>
                      <Save className="h-4 w-4 mr-1" />
                      Salvar Histórico
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current month details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Card */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Target className="h-4 w-4" />
                Meta do Mês
              </span>
              {canEdit && !editingTarget && (
                <Button variant="ghost" size="sm" onClick={() => setEditingTarget(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editingTarget ? (
              <div className="space-y-2">
                <Input
                  placeholder="Ex: 100000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="text-lg font-semibold"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveTarget}>
                    <Save className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTarget(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(currentGoal?.sales_target ?? null)}
              </div>
            )}
            {currentGoal?.target_set_at && (
              <p className="text-xs text-muted-foreground">
                Definida em {format(new Date(currentGoal.target_set_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
            {currentGoal?.notes?.includes("históricos") && (
              <Badge variant="secondary" className="text-xs">
                <History className="h-3 w-3 mr-1" />
                Dado histórico
              </Badge>
            )}
          </div>

          {/* Result Card */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                {performance?.status === "success" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : performance?.status === "danger" ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                Resultado Alcançado
              </span>
              {canEdit && !editingResult && (
                <Button variant="ghost" size="sm" onClick={() => setEditingResult(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editingResult ? (
              <div className="space-y-2">
                <Input
                  placeholder="Ex: 95000"
                  value={resultValue}
                  onChange={(e) => setResultValue(e.target.value)}
                  className="text-lg font-semibold"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveResult}>
                    <Save className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingResult(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(currentGoal?.sales_result ?? null)}
              </div>
            )}
            {currentGoal?.result_set_at && (
              <p className="text-xs text-muted-foreground">
                Registrado em {format(new Date(currentGoal.result_set_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
            {currentGoal?.notes?.includes("históricos") && (
              <Badge variant="secondary" className="text-xs">
                <History className="h-3 w-3 mr-1" />
                Dado histórico
              </Badge>
            )}
          </div>
        </div>

        {/* Performance indicator */}
        {performance && (
          <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${
            performance.status === "success" ? "bg-green-500/10" :
            performance.status === "warning" ? "bg-amber-500/10" :
            "bg-red-500/10"
          }`}>
            {performance.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            <span className={`font-medium ${performance.color}`}>
              {performance.label} ({performance.percentage.toFixed(1)}%)
            </span>
          </div>
        )}

        {/* Progress bar */}
        {currentGoal?.sales_target && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span>{((currentGoal.sales_result || 0) / currentGoal.sales_target * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  performance?.status === "success" ? "bg-green-500" :
                  performance?.status === "warning" ? "bg-amber-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${Math.min(((currentGoal.sales_result || 0) / currentGoal.sales_target * 100), 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Historical summary - Current month first, then 5 previous */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Histórico Recente</h4>
          <div className="grid grid-cols-6 gap-2">
            {recentMonths.map(({ month, year, goal }) => {
              const hasTarget = goal?.sales_target != null;
              const hasResult = goal?.sales_result != null;
              const isCurrentSelection = month === selectedMonth && year === selectedYear;
              const isHistorical = goal?.notes?.includes("históricos");
              const percentage = hasTarget && hasResult ? 
                (goal.sales_result! / goal.sales_target!) * 100 : null;
              
              return (
                <button
                  key={`${month}-${year}`}
                  onClick={() => {
                    setSelectedMonth(month);
                    setSelectedYear(year);
                    setEditingTarget(false);
                    setEditingResult(false);
                  }}
                  className={`p-2 rounded-lg text-center transition-colors ${
                    isCurrentSelection ? "bg-primary text-primary-foreground" :
                    isHistorical ? "bg-muted/50 hover:bg-muted" :
                    "hover:bg-muted"
                  }`}
                >
                  <div className="text-xs font-medium">
                    {MONTH_NAMES[month - 1].slice(0, 3)}
                  </div>
                  <div className="text-[10px] opacity-70">{year}</div>
                  {percentage !== null ? (
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] mt-1 ${
                        percentage >= 100 ? "border-green-500 text-green-500" :
                        percentage >= 80 ? "border-amber-500 text-amber-500" :
                        "border-red-500 text-red-500"
                      }`}
                    >
                      {percentage.toFixed(0)}%
                    </Badge>
                  ) : hasTarget || hasResult ? (
                    <Badge variant="outline" className="text-[10px] mt-1">
                      Parcial
                    </Badge>
                  ) : (
                    <div className="h-5 mt-1" />
                  )}
                  {isHistorical && !isCurrentSelection && (
                    <History className="h-3 w-3 mx-auto mt-1 opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Before vs After Comparison */}
        <BeforeAfterComparison goals={goals} formatCurrency={formatCurrency} />
      </CardContent>
    </Card>
  );
};

// Before vs After Comparison Component
const BeforeAfterComparison = ({ 
  goals, 
  formatCurrency 
}: { 
  goals: MonthlyGoal[]; 
  formatCurrency: (value: number | null) => string;
}) => {
  const historicalGoals = goals.filter(g => g.notes?.includes("históricos"));
  const currentGoals = goals.filter(g => !g.notes?.includes("históricos"));
  
  // Sort current goals by date (most recent first)
  const sortedCurrentGoals = [...currentGoals]
    .filter(g => g.sales_target && g.sales_result)
    .sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1);
      const dateB = new Date(b.year, b.month - 1);
      return dateB.getTime() - dateA.getTime();
    });
  
  const historicalWithBoth = historicalGoals.filter(g => g.sales_target && g.sales_result);
  
  // Get data for different periods
  const shortTermGoals = sortedCurrentGoals.slice(0, 1); // Last 1 month
  const mediumTermGoals = sortedCurrentGoals.slice(0, 3); // Last 3 months
  const longTermGoals = sortedCurrentGoals.slice(0, 12); // Last 12 months
  
  // If no data to compare, don't show the section
  if (historicalWithBoth.length === 0 && sortedCurrentGoals.length === 0) {
    return null;
  }

  // Helper function to calculate averages
  const calculateAverages = (goalsData: MonthlyGoal[]) => {
    if (goalsData.length === 0) return { target: 0, result: 0, performance: 0 };
    const avgTarget = goalsData.reduce((sum, g) => sum + (g.sales_target || 0), 0) / goalsData.length;
    const avgResult = goalsData.reduce((sum, g) => sum + (g.sales_result || 0), 0) / goalsData.length;
    const performance = avgTarget > 0 ? (avgResult / avgTarget) * 100 : 0;
    return { target: avgTarget, result: avgResult, performance };
  };

  const historicalAvg = calculateAverages(historicalWithBoth);
  const shortTermAvg = calculateAverages(shortTermGoals);
  const mediumTermAvg = calculateAverages(mediumTermGoals);
  const longTermAvg = calculateAverages(longTermGoals);

  // Calculate changes for each period
  const calculateChange = (currentPerf: number, currentResult: number, histPerf: number, histResult: number) => {
    const performanceChange = currentPerf - histPerf;
    const resultChange = histResult > 0 ? ((currentResult - histResult) / histResult) * 100 : 0;
    return { performanceChange, resultChange };
  };

  const shortTermChange = calculateChange(shortTermAvg.performance, shortTermAvg.result, historicalAvg.performance, historicalAvg.result);
  const mediumTermChange = calculateChange(mediumTermAvg.performance, mediumTermAvg.result, historicalAvg.performance, historicalAvg.result);
  const longTermChange = calculateChange(longTermAvg.performance, longTermAvg.result, historicalAvg.performance, historicalAvg.result);

  const periods = [
    { 
      label: "Curto Prazo", 
      sublabel: "Último mês",
      months: shortTermGoals.length,
      avg: shortTermAvg,
      change: shortTermChange,
      icon: "📅"
    },
    { 
      label: "Médio Prazo", 
      sublabel: "Últimos 3 meses",
      months: mediumTermGoals.length,
      avg: mediumTermAvg,
      change: mediumTermChange,
      icon: "📊"
    },
    { 
      label: "Longo Prazo", 
      sublabel: "Últimos 12 meses",
      months: longTermGoals.length,
      avg: longTermAvg,
      change: longTermChange,
      icon: "📈"
    }
  ];

  const hasHistorical = historicalWithBoth.length > 0;

  return (
    <div className="pt-4 border-t">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Comparativo: Antes vs Depois do Acompanhamento
      </h4>
      
      {/* Historical Reference Card */}
      <div className="border rounded-lg p-4 bg-muted/30 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">PERÍODO HISTÓRICO (Referência)</span>
          <Badge variant="secondary" className="text-xs">
            {historicalWithBoth.length} meses
          </Badge>
        </div>
        {hasHistorical ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Média de meta</span>
              <span className="font-medium">{formatCurrency(historicalAvg.target)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Média de resultado</span>
              <span className="font-medium">{formatCurrency(historicalAvg.result)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Performance média</span>
              <span className={`font-medium ${
                historicalAvg.performance >= 100 ? "text-green-500" :
                historicalAvg.performance >= 80 ? "text-amber-500" :
                "text-red-500"
              }`}>
                {historicalAvg.performance.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem dados históricos. Clique em "Histórico" para registrar dados anteriores ao acompanhamento.
          </p>
        )}
      </div>

      {/* Period Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periods.map((period, index) => {
          const hasData = period.months > 0;
          const hasComparison = hasHistorical && hasData;
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 ${
                hasComparison && period.change.performanceChange > 0 
                  ? "bg-green-500/5 border-green-500/20" 
                  : hasComparison && period.change.performanceChange < 0 
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{period.icon}</span>
                <div>
                  <span className="font-medium text-sm block">{period.label}</span>
                  <span className="text-xs text-muted-foreground">{period.sublabel}</span>
                </div>
                <Badge variant="outline" className="text-xs ml-auto">
                  {period.months} {period.months === 1 ? "mês" : "meses"}
                </Badge>
              </div>
              
              {hasData ? (
                <div className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Resultado médio:</span>
                      <span className="font-medium">{formatCurrency(period.avg.result)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Performance:</span>
                      <span className={`font-medium ${
                        period.avg.performance >= 100 ? "text-green-500" :
                        period.avg.performance >= 80 ? "text-amber-500" :
                        "text-red-500"
                      }`}>
                        {period.avg.performance.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  {hasComparison && (
                    <div className="pt-2 border-t border-dashed">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">vs Histórico:</span>
                        <div className="flex items-center gap-2">
                          {period.change.performanceChange > 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : period.change.performanceChange < 0 ? (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          ) : null}
                          <span className={`text-sm font-bold ${
                            period.change.performanceChange > 0 ? "text-green-500" : 
                            period.change.performanceChange < 0 ? "text-red-500" : 
                            "text-muted-foreground"
                          }`}>
                            {period.change.performanceChange > 0 ? "+" : ""}
                            {period.change.performanceChange.toFixed(1)}pp
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">Faturamento:</span>
                        <span className={`text-sm font-bold ${
                          period.change.resultChange > 0 ? "text-green-500" : 
                          period.change.resultChange < 0 ? "text-red-500" : 
                          "text-muted-foreground"
                        }`}>
                          {period.change.resultChange > 0 ? "+" : ""}
                          {period.change.resultChange.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sem dados para este período.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
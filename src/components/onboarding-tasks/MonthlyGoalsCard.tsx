import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target, TrendingUp, TrendingDown, CheckCircle2, Pencil, Save, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  // Get last 6 months for summary
  const getRecentMonths = () => {
    const result: { month: number; year: number; goal?: MonthlyGoal }[] = [];
    let m = new Date().getMonth() + 1;
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
    return result.reverse();
  };

  const recentMonths = getRecentMonths();

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

        {/* Historical summary */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Histórico Recente</h4>
          <div className="grid grid-cols-6 gap-2">
            {recentMonths.map(({ month, year, goal }) => {
              const hasTarget = goal?.sales_target != null;
              const hasResult = goal?.sales_result != null;
              const isCurrentSelection = month === selectedMonth && year === selectedYear;
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
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

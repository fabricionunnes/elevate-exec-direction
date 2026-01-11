import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, DollarSign, Target, TrendingUp, Trophy, History, Check, X, Pencil, TrendingDown, Lock } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SalesComparisonChart } from "@/components/onboarding-tasks/kpis/SalesComparisonChart";

interface CACFormData {
  id: string;
  facebook_ads_investment: number | null;
  google_ads_investment: number | null;
  linkedin_ads_investment: number | null;
  sales_quantity_3_months: number | null;
  sales_value_3_months: number | null;
  submitted_at: string;
}

interface MonthlyGoal {
  id: string;
  month: number;
  year: number;
  sales_target: number | null;
  sales_result: number | null;
}

interface ClientMetricsViewProps {
  projectId: string;
}

export const ClientMetricsView = ({ projectId }: ClientMetricsViewProps) => {
  const [cacData, setCacData] = useState<CACFormData | null>(null);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingResult, setEditingResult] = useState(false);
  const [resultValue, setResultValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [newTargetValue, setNewTargetValue] = useState<string>("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const fetchData = async () => {
    try {
      // First fetch the project to get company_id
      const { data: projectData, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("company_id, onboarding_companies(id, name)")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      
      if (projectData?.company_id) {
        setCompanyId(projectData.company_id);
        setCompanyName((projectData.onboarding_companies as any)?.name || "");
      }

      const [cacResponse, goalsResponse] = await Promise.all([
        supabase
          .from("onboarding_cac_forms")
          .select("*")
          .eq("project_id", projectId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("onboarding_monthly_goals")
          .select("*")
          .eq("project_id", projectId)
          .order("year", { ascending: false })
          .order("month", { ascending: false })
      ]);

      if (cacResponse.error) throw cacResponse.error;
      if (goalsResponse.error) throw goalsResponse.error;

      setCacData(cacResponse.data);
      setGoals(goalsResponse.data || []);

      // Set current month result for editing
      const currentGoal = goalsResponse.data?.find(
        g => g.month === currentMonth && g.year === currentYear
      );
      if (currentGoal?.sales_result) {
        setResultValue(currentGoal.sales_result.toString());
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return format(date, "MMMM", { locale: ptBR });
  };

  const currentGoal = goals.find(g => g.month === currentMonth && g.year === currentYear);
  const pastGoals = goals.filter(g => !(g.month === currentMonth && g.year === currentYear));

  const handleSaveResult = async () => {
    if (!currentGoal) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_monthly_goals")
        .update({ 
          sales_result: parseFloat(resultValue) || null,
          result_set_at: new Date().toISOString()
        })
        .eq("id", currentGoal.id);

      if (error) throw error;

      toast.success("Resultado atualizado!");
      setEditingResult(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving result:", error);
      toast.error("Erro ao salvar resultado");
    } finally {
      setSaving(false);
    }
  };

  // Cliente pode apenas INSERIR meta, não pode alterar depois
  const handleAddGoal = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_monthly_goals")
        .insert({
          project_id: projectId,
          month: currentMonth,
          year: currentYear,
          sales_target: parseFloat(newTargetValue) || null,
          target_set_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success("Meta cadastrada com sucesso!");
      setAddingGoal(false);
      setNewTargetValue("");
      fetchData();
    } catch (error: any) {
      console.error("Error adding goal:", error);
      toast.error("Erro ao cadastrar meta");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Calculate CAC metrics
  const totalInvestment = cacData
    ? (cacData.facebook_ads_investment || 0) + 
      (cacData.google_ads_investment || 0) + 
      (cacData.linkedin_ads_investment || 0)
    : 0;
  const totalInvestment3Months = totalInvestment * 3;
  const totalSalesQty = cacData?.sales_quantity_3_months || 0;
  const totalSalesValue = cacData?.sales_value_3_months || 0;
  const cac = totalSalesQty > 0 ? totalInvestment3Months / totalSalesQty : null;
  const ticketMedio = totalSalesQty > 0 && totalSalesValue > 0 ? totalSalesValue / totalSalesQty : null;
  const lucroLiquido = totalSalesValue - totalInvestment3Months;
  const roi = totalInvestment3Months > 0 ? (lucroLiquido / totalInvestment3Months) * 100 : null;

  const progressPercent = currentGoal?.sales_target && currentGoal.sales_result
    ? Math.min(100, (currentGoal.sales_result / currentGoal.sales_target) * 100)
    : 0;

  // Calculate projection based on days elapsed in month
  const today = new Date();
  const totalDaysInMonth = getDaysInMonth(today);
  const daysPassed = today.getDate();
  const timeProgress = daysPassed / totalDaysInMonth;
  
  const projection = currentGoal?.sales_target && currentGoal.sales_result && timeProgress > 0
    ? ((currentGoal.sales_result / currentGoal.sales_target) / timeProgress) * 100
    : null;

  return (
    <div className="space-y-6">
      {/* Sales Comparison Chart - visible to all users */}
      {companyId && (
        <SalesComparisonChart 
          companyId={companyId}
          projectId={projectId}
          companyName={companyName}
        />
      )}

      {/* Meta do Mês Atual */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Meta de {getMonthName(currentMonth)} {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentGoal ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-primary/5 border text-center relative">
                  <div className="absolute top-2 right-2">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Meta (definida)</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(currentGoal.sales_target)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Apenas CS pode alterar
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                  {editingResult ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={resultValue}
                        onChange={(e) => setResultValue(e.target.value)}
                        className="text-center h-8"
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(currentGoal.sales_result)}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso</span>
                  <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      progressPercent >= 100 ? 'bg-green-500' : 
                      progressPercent >= 70 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Projection */}
              {projection !== null && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                  projection >= 100 ? 'bg-green-500/10 border-green-500/30' :
                  projection >= 70 ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-red-500/10 border-red-500/30'
                }`}>
                  {projection >= 100 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Projeção para fim do mês ({totalDaysInMonth - daysPassed} dias restantes)
                    </p>
                    <p className={`text-lg font-bold ${
                      projection >= 100 ? 'text-green-600' :
                      projection >= 70 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {projection.toFixed(0)}% da meta
                    </p>
                  </div>
                </div>
              )}

              {/* Edit button */}
              {editingResult ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingResult(false)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={handleSaveResult}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setEditingResult(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Atualizar Resultado
                </Button>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              {addingGoal ? (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Informe a meta de vendas para {getMonthName(currentMonth)}</p>
                    <Input
                      type="number"
                      value={newTargetValue}
                      onChange={(e) => setNewTargetValue(e.target.value)}
                      className="text-center"
                      placeholder="Ex: 50000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setAddingGoal(false);
                        setNewTargetValue("");
                      }}
                      disabled={saving}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={handleAddGoal}
                      disabled={saving || !newTargetValue}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {saving ? "Salvando..." : "Cadastrar"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Nenhuma meta definida para este mês</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAddingGoal(true)}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Cadastrar Meta
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Metas */}
      {pastGoals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-muted-foreground" />
              Histórico de Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastGoals.slice(0, 6).map((goal) => {
                const achieved = goal.sales_result && goal.sales_target 
                  ? goal.sales_result >= goal.sales_target 
                  : false;
                const percent = goal.sales_target && goal.sales_result
                  ? (goal.sales_result / goal.sales_target) * 100
                  : 0;

                return (
                  <div 
                    key={goal.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      achieved ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'
                    }`}
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {getMonthName(goal.month)} {goal.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Meta: {formatCurrency(goal.sales_target)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${achieved ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {formatCurrency(goal.sales_result)}
                      </p>
                      <p className={`text-xs ${achieved ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {percent.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CAC Metrics */}
      {cacData && (
        <>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Dados CAC atualizados em {format(new Date(cacData.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
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
                <div className="text-center p-4 rounded-xl bg-white/80 dark:bg-card/80 border">
                  <p className="text-sm text-muted-foreground mb-2">Para cada venda de</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(ticketMedio)}</p>
                  <p className="text-sm text-muted-foreground my-2">você gasta</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(cac)}</p>
                </div>

                <div className="text-center p-4 rounded-xl bg-white/80 dark:bg-card/80 border">
                  <p className="text-sm text-muted-foreground mb-2">Se quiser vender 3x mais</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesValue * 3)}</p>
                  <p className="text-sm text-muted-foreground my-2">precisa investir</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalInvestment3Months * 3)}</p>
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
        </>
      )}

      {/* Empty state when no CAC data */}
      {!cacData && goals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-lg mb-2">Métricas não disponíveis</h3>
            <p className="text-muted-foreground text-sm">
              Os dados ainda não foram configurados para este projeto.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

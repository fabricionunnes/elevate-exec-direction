import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, DollarSign, BarChart3, ChevronLeft, ChevronRight, Plus, Edit2, Check, Trash2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PlanningData {
  id?: string;
  year: number;
  month: number;
  revenue_target: number;
  revenue_actual: number;
  mrr_target: number;
  mrr_actual: number;
  clients_target: number;
  clients_actual: number;
  churn_target: number;
  churn_actual: number;
  notes: string | null;
  scenario: string;
}

interface StrategicGoal {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  target_date: string | null;
  target_period: string | null;
  status: string;
  priority: string;
  category: string | null;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function CEOFuturePlanning() {
  const [planningData, setPlanningData] = useState<PlanningData[]>([]);
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<PlanningData | null>(null);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<StrategicGoal | null>(null);
  const [goalForm, setGoalForm] = useState({
    title: "",
    description: "",
    target_value: "",
    current_value: "",
    unit: "",
    target_period: "",
    priority: "medium",
    category: "",
  });

  const fetchData = async () => {
    try {
      // Fetch planning data for selected year
      const { data: planning } = await (supabase as any)
        .from("ceo_planning")
        .select("*")
        .eq("year", selectedYear)
        .order("month", { ascending: true });

      setPlanningData(planning || []);

      // Fetch strategic goals
      const { data: goalsData } = await (supabase as any)
        .from("ceo_strategic_goals")
        .select("*")
        .eq("status", "active")
        .order("priority", { ascending: false });

      setGoals(goalsData || []);
    } catch (error) {
      console.error("Error fetching planning data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const getMonthData = (month: number): PlanningData => {
    const existing = planningData.find(p => p.month === month);
    if (existing) return existing;
    return {
      year: selectedYear,
      month,
      revenue_target: 0,
      revenue_actual: 0,
      mrr_target: 0,
      mrr_actual: 0,
      clients_target: 0,
      clients_actual: 0,
      churn_target: 0,
      churn_actual: 0,
      notes: null,
      scenario: "realistic",
    };
  };

  const handleSaveMonth = async () => {
    if (!editData) return;

    try {
      const { id, ...data } = editData;

      if (id) {
        await (supabase as any)
          .from("ceo_planning")
          .update(data)
          .eq("id", id);
      } else {
        await (supabase as any)
          .from("ceo_planning")
          .insert(data);
      }

      toast.success("Planejamento salvo!");
      setIsEditing(false);
      setSelectedMonth(null);
      fetchData();
    } catch (error) {
      console.error("Error saving planning:", error);
      toast.error("Erro ao salvar planejamento");
    }
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title) {
      toast.error("Preencha o título da meta");
      return;
    }

    try {
      const goalData = {
        title: goalForm.title,
        description: goalForm.description || null,
        target_value: goalForm.target_value ? Number(goalForm.target_value) : null,
        current_value: goalForm.current_value ? Number(goalForm.current_value) : 0,
        unit: goalForm.unit || null,
        target_period: goalForm.target_period || null,
        priority: goalForm.priority,
        category: goalForm.category || null,
      };

      if (editingGoal) {
        await (supabase as any)
          .from("ceo_strategic_goals")
          .update(goalData)
          .eq("id", editingGoal.id);
      } else {
        await (supabase as any)
          .from("ceo_strategic_goals")
          .insert(goalData);
      }

      toast.success(editingGoal ? "Meta atualizada!" : "Meta criada!");
      setIsGoalDialogOpen(false);
      setEditingGoal(null);
      setGoalForm({
        title: "",
        description: "",
        target_value: "",
        current_value: "",
        unit: "",
        target_period: "",
        priority: "medium",
        category: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error saving goal:", error);
      toast.error("Erro ao salvar meta");
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await (supabase as any)
        .from("ceo_strategic_goals")
        .update({ status: "cancelled" })
        .eq("id", id);
      toast.success("Meta removida");
      fetchData();
    } catch (error) {
      toast.error("Erro ao remover meta");
    }
  };

  const openEditGoal = (goal: StrategicGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      description: goal.description || "",
      target_value: goal.target_value?.toString() || "",
      current_value: goal.current_value?.toString() || "",
      unit: goal.unit || "",
      target_period: goal.target_period || "",
      priority: goal.priority,
      category: goal.category || "",
    });
    setIsGoalDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getChartData = () => {
    return MONTHS_SHORT.map((month, i) => {
      const data = getMonthData(i + 1);
      return {
        month,
        meta: data.revenue_target,
        realizado: data.revenue_actual,
        mrr_meta: data.mrr_target,
        mrr_real: data.mrr_actual,
      };
    });
  };

  const getTotals = () => {
    let totalTargetRevenue = 0;
    let totalActualRevenue = 0;
    let avgMrrTarget = 0;
    let avgMrrActual = 0;
    let count = 0;

    planningData.forEach(p => {
      totalTargetRevenue += Number(p.revenue_target) || 0;
      totalActualRevenue += Number(p.revenue_actual) || 0;
      if (p.mrr_target) {
        avgMrrTarget += Number(p.mrr_target) || 0;
        count++;
      }
      avgMrrActual += Number(p.mrr_actual) || 0;
    });

    return {
      totalTargetRevenue,
      totalActualRevenue,
      avgMrrTarget: count > 0 ? avgMrrTarget / count : 0,
      latestMrr: planningData.length > 0 ? Number(planningData[planningData.length - 1]?.mrr_actual) || 0 : 0,
    };
  };

  const totals = getTotals();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader><div className="h-6 w-48 bg-muted rounded" /></CardHeader>
          <CardContent><div className="h-64 bg-muted rounded" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold">{selectedYear}</h2>
            <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Year Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Meta {selectedYear}</p>
                <p className="text-xl font-bold">{formatCurrency(totals.totalTargetRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Realizada</p>
                <p className="text-xl font-bold">{formatCurrency(totals.totalActualRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR Médio Meta</p>
                <p className="text-xl font-bold">{formatCurrency(totals.avgMrrTarget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Target className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último MRR</p>
                <p className="text-xl font-bold">{formatCurrency(totals.latestMrr)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Planning Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Planejamento Mensal - {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {MONTHS.map((month, i) => {
              const data = getMonthData(i + 1);
              const hasData = planningData.some(p => p.month === i + 1);
              const progress = data.revenue_target > 0 ? (data.revenue_actual / data.revenue_target) * 100 : 0;

              return (
                <div
                  key={month}
                  onClick={() => {
                    setSelectedMonth(i + 1);
                    setEditData(data);
                    setIsEditing(true);
                  }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary",
                    hasData ? "bg-card" : "bg-muted/50",
                    selectedMonth === i + 1 && "ring-2 ring-primary"
                  )}
                >
                  <p className="font-medium text-sm">{MONTHS_SHORT[i]}</p>
                  {hasData ? (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        Meta: {formatCurrency(data.revenue_target)}
                      </p>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            progress >= 100 ? "bg-green-500" : progress >= 70 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Clique para planejar</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita: Meta vs Realizado - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="meta" name="Meta" fill="#94a3b8" />
                <Bar dataKey="realizado" name="Realizado" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Goals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Metas Estratégicas
          </CardTitle>
          <Button size="sm" onClick={() => {
            setEditingGoal(null);
            setGoalForm({
              title: "",
              description: "",
              target_value: "",
              current_value: "",
              unit: "",
              target_period: "",
              priority: "medium",
              category: "",
            });
            setIsGoalDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Meta
          </Button>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma meta cadastrada</p>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const progress = goal.target_value ? (goal.current_value / goal.target_value) * 100 : 0;
                return (
                  <div key={goal.id} className="space-y-2 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{goal.title}</span>
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded",
                          goal.priority === "critical" && "bg-red-500/10 text-red-500",
                          goal.priority === "high" && "bg-orange-500/10 text-orange-500",
                          goal.priority === "medium" && "bg-blue-500/10 text-blue-500",
                          goal.priority === "low" && "bg-gray-500/10 text-gray-500"
                        )}>
                          {goal.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">{goal.target_period}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGoal(goal)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGoal(goal.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {goal.target_value && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              progress >= 100 ? "bg-green-500" : progress >= 70 ? "bg-primary" : "bg-orange-500"
                            )}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-20 text-right">
                          {goal.current_value?.toLocaleString()} / {goal.target_value?.toLocaleString()} {goal.unit}
                        </span>
                      </div>
                    )}
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Month Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Planejamento - {selectedMonth ? MONTHS[selectedMonth - 1] : ""} {selectedYear}
            </DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Receita Meta (R$)</Label>
                  <Input
                    type="number"
                    value={editData.revenue_target}
                    onChange={(e) => setEditData({ ...editData, revenue_target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Receita Realizada (R$)</Label>
                  <Input
                    type="number"
                    value={editData.revenue_actual}
                    onChange={(e) => setEditData({ ...editData, revenue_actual: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>MRR Meta (R$)</Label>
                  <Input
                    type="number"
                    value={editData.mrr_target}
                    onChange={(e) => setEditData({ ...editData, mrr_target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>MRR Realizado (R$)</Label>
                  <Input
                    type="number"
                    value={editData.mrr_actual}
                    onChange={(e) => setEditData({ ...editData, mrr_actual: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Clientes Meta</Label>
                  <Input
                    type="number"
                    value={editData.clients_target}
                    onChange={(e) => setEditData({ ...editData, clients_target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Clientes Real</Label>
                  <Input
                    type="number"
                    value={editData.clients_actual}
                    onChange={(e) => setEditData({ ...editData, clients_actual: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Churn Meta (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editData.churn_target}
                    onChange={(e) => setEditData({ ...editData, churn_target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Churn Real (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editData.churn_actual}
                    onChange={(e) => setEditData({ ...editData, churn_actual: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Cenário</Label>
                <Select value={editData.scenario} onValueChange={(v) => setEditData({ ...editData, scenario: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservador</SelectItem>
                    <SelectItem value="realistic">Realista</SelectItem>
                    <SelectItem value="aggressive">Agressivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editData.notes || ""}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Notas sobre este mês..."
                />
              </div>
              <Button onClick={handleSaveMonth} className="w-full">
                <Check className="h-4 w-4 mr-2" />
                Salvar Planejamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta Estratégica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                placeholder="Ex: Atingir 100 clientes ativos"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Valor Alvo</Label>
                <Input
                  type="number"
                  value={goalForm.target_value}
                  onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor Atual</Label>
                <Input
                  type="number"
                  value={goalForm.current_value}
                  onChange={(e) => setGoalForm({ ...goalForm, current_value: e.target.value })}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input
                  value={goalForm.unit}
                  onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                  placeholder="Ex: clientes, R$"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período Alvo</Label>
                <Input
                  value={goalForm.target_period}
                  onChange={(e) => setGoalForm({ ...goalForm, target_period: e.target.value })}
                  placeholder="Ex: Q2 2026"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={goalForm.priority} onValueChange={(v) => setGoalForm({ ...goalForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                value={goalForm.category}
                onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                placeholder="Ex: Crescimento, Financeiro, Produto"
              />
            </div>
            <Button onClick={handleSaveGoal} className="w-full">
              {editingGoal ? "Atualizar Meta" : "Criar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

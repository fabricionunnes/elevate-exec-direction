import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingDown, Target, AlertTriangle, Lightbulb, ArrowRight, CheckCircle2 } from "lucide-react";
import { getDaysInMonth, startOfMonth, endOfMonth, format } from "date-fns";

interface GoalProjectionAlertDialogProps {
  projectId: string;
  companyName: string;
  isStaff: boolean;
  onNavigateToGoals?: () => void;
}

interface GoalData {
  hasGoal: boolean;
  salesTarget: number | null;
  salesResult: number | null;
  projection: number | null;
  daysRemaining: number;
}

const ACTION_SUGGESTIONS = [
  "Revisar pipeline e priorizar oportunidades quentes",
  "Agendar reunião de alinhamento com o time comercial",
  "Avaliar se há gargalos no processo de vendas",
  "Verificar qualidade e volume de leads",
  "Analisar métricas de conversão por etapa do funil",
  "Propor ações de upsell/cross-sell para clientes ativos",
];

export const GoalProjectionAlertDialog = ({
  projectId,
  companyName,
  isStaff,
  onNavigateToGoals,
}: GoalProjectionAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [goalData, setGoalData] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkGoalProjection();
  }, [projectId]);

  const checkGoalProjection = async () => {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const totalDaysInMonth = getDaysInMonth(today);
      const daysPassed = today.getDate();
      const daysRemaining = totalDaysInMonth - daysPassed;

      // Check if already dismissed in this session
      const sessionKey = `goal_alert_dismissed_${projectId}_${currentMonth}_${currentYear}`;
      const wasDismissed = sessionStorage.getItem(sessionKey);
      
      if (wasDismissed) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      // Get company_id from project
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id")
        .eq("id", projectId)
        .maybeSingle();

      if (!project?.onboarding_company_id) {
        setLoading(false);
        return;
      }

      const companyId = project.onboarding_company_id;
      const currentMonthYear = format(today, "yyyy-MM");

      // Check if ANY KPI has a target value set (not just monetary)
      const { data: allKpis } = await supabase
        .from("company_kpis")
        .select("id, target_value, kpi_type")
        .eq("company_id", companyId)
        .eq("is_active", true);

      // Also check for monthly targets for the current month
      const { data: monthlyTargets } = await supabase
        .from("kpi_monthly_targets")
        .select("kpi_id, target_value")
        .eq("company_id", companyId)
        .eq("month_year", currentMonthYear);

      // Build a map of monthly targets for quick lookup
      const monthlyTargetMap: Record<string, number> = {};
      (monthlyTargets || []).forEach((mt: any) => {
        monthlyTargetMap[mt.kpi_id] = mt.target_value;
      });

      // Check if any KPI has a target (either monthly or default)
      const hasGoal = allKpis && allKpis.length > 0 && allKpis.some(k => {
        const monthlyTarget = monthlyTargetMap[k.id];
        const effectiveTarget = monthlyTarget !== undefined ? monthlyTarget : k.target_value;
        return effectiveTarget > 0;
      });
      
      // Get monetary KPIs for projection calculation
      const monetaryKpis = allKpis?.filter(k => k.kpi_type === "currency") || [];
      
      // Calculate total target from monetary KPIs (use monthly target if exists, else default)
      const salesTarget = monetaryKpis.reduce((sum, kpi) => {
        const monthlyTarget = monthlyTargetMap[kpi.id];
        const effectiveTarget = monthlyTarget !== undefined ? monthlyTarget : kpi.target_value;
        return sum + (effectiveTarget || 0);
      }, 0);

      // Get current month entries for monetary KPIs
      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
      
      const kpiIds = monetaryKpis?.map(k => k.id) || [];
      
      let salesResult = 0;
      if (kpiIds.length > 0) {
        const { data: entries } = await supabase
          .from("kpi_entries")
          .select("value")
          .eq("company_id", companyId)
          .in("kpi_id", kpiIds)
          .gte("entry_date", monthStart)
          .lte("entry_date", monthEnd);

        salesResult = entries?.reduce((sum, e) => sum + (e.value || 0), 0) || 0;
      }

      let projection: number | null = null;
      if (hasGoal && salesTarget > 0 && daysPassed > 0) {
        const timeProgress = daysPassed / totalDaysInMonth;
        projection = ((salesResult / salesTarget) / timeProgress) * 100;
      }

      setGoalData({
        hasGoal: hasGoal || false,
        salesTarget: salesTarget || null,
        salesResult,
        projection,
        daysRemaining,
      });

      // Determine if we should show the dialog
      const shouldShowForStaff = isStaff && (!hasGoal || (projection !== null && projection < 100));
      const shouldShowForClient = !isStaff && !hasGoal;

      if (shouldShowForStaff || shouldShowForClient) {
        setOpen(true);
      }
    } catch (error) {
      console.error("Error checking goal projection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    const today = new Date();
    const sessionKey = `goal_alert_dismissed_${projectId}_${today.getMonth() + 1}_${today.getFullYear()}`;
    sessionStorage.setItem(sessionKey, "true");
    setDismissed(true);
    setOpen(false);
  };

  const handleNavigateToGoals = () => {
    setOpen(false);
    if (onNavigateToGoals) {
      onNavigateToGoals();
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading || dismissed || !goalData) return null;

  // For staff: show low projection or missing goal alert
  if (isStaff) {
    // No goal set
    if (!goalData.hasGoal) {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Target className="h-5 w-5" />
                Meta não cadastrada
              </DialogTitle>
              <DialogDescription>
                {companyName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm">
                  Este projeto ainda não possui metas cadastradas nos KPIs.
                  Cadastre metas para acompanhar a projeção de resultados.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDismiss} className="flex-1">
                  Lembrar depois
                </Button>
                <Button onClick={handleNavigateToGoals} className="flex-1">
                  <Target className="h-4 w-4 mr-2" />
                  Ir para KPIs
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    // Low projection
    if (goalData.projection !== null && goalData.projection < 100) {
      const isVeryLow = goalData.projection < 70;

      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${isVeryLow ? 'text-red-600' : 'text-amber-600'}`}>
                <TrendingDown className="h-5 w-5" />
                {isVeryLow ? 'Projeção Crítica' : 'Projeção Abaixo da Meta'}
              </DialogTitle>
              <DialogDescription>
                {companyName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Projection stats */}
              <div className={`p-4 rounded-lg border ${
                isVeryLow ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Meta</p>
                    <p className="font-bold">{formatCurrency(goalData.salesTarget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Realizado</p>
                    <p className="font-bold text-primary">{formatCurrency(goalData.salesResult)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Projeção</p>
                    <p className={`font-bold text-xl ${isVeryLow ? 'text-red-600' : 'text-amber-600'}`}>
                      {goalData.projection?.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {goalData.daysRemaining} dias restantes no mês
                </p>
              </div>

              {/* Suggestions */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Sugestões de ação:</span>
                </div>
                <ul className="space-y-1.5">
                  {ACTION_SUGGESTIONS.slice(0, 4).map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0 text-primary" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDismiss} className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Entendido
                </Button>
                <Button onClick={handleNavigateToGoals} className="flex-1">
                  <Target className="h-4 w-4 mr-2" />
                  Ver Metas
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
  }

  // For client: notify to send goal
  if (!isStaff && !goalData.hasGoal) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Meta de Vendas Pendente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm">
                Para acompanharmos melhor seu progresso, precisamos das suas <strong>metas de KPIs</strong>.
              </p>
              <p className="text-sm mt-2 text-muted-foreground">
                Acesse o menu de KPIs para cadastrar suas metas de vendas e acompanhar seu desempenho.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDismiss} className="flex-1">
                Lembrar depois
              </Button>
              <Button onClick={handleNavigateToGoals} className="flex-1">
                <Target className="h-4 w-4 mr-2" />
                Ir para KPIs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
};

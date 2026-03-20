import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Award, Wallet, Target, TrendingUp, Calendar } from "lucide-react";
import { getRemainingBusinessDaysInMonth } from "@/lib/businessDays";

interface TierInfo {
  minPercent: number;
  maxPercent: number;
  commissionValue: number;
  missingValue: number;
  dailyNeeded: number;
  isCurrentTier: boolean;
  isAchieved: boolean;
}

interface CommissionData {
  staffId: string;
  staffName: string;
  role: string;
  fixedSalary: number;
  commission: number;
  total: number;
  achieved: number;
  metaValue: number;
  achievedPercent: number;
  tierLabel: string;
  tiers: TierInfo[];
  missingToFirstTier: number;
  isCommissioning: boolean;
  metricLabel: string;
}

interface Props {
  staffId: string | null;
  staffRole: string | null;
  isMaster: boolean;
}

export const CRMCommissionCard = ({ staffId, staffRole, isMaster }: Props) => {
  const [commissionData, setCommissionData] = useState<CommissionData[]>([]);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatMetric = (value: number, role: string) =>
    role === "closer" ? formatCurrency(value) : Math.round(value).toString();

  useEffect(() => {
    const loadCommissions = async () => {
      try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const remainingDays = getRemainingBusinessDaysInMonth(now);

        const staffQuery = supabase
          .from("onboarding_staff")
          .select("id, name, role")
          .eq("is_active", true)
          .in("role", ["closer", "sdr"]);

        if (!isMaster && staffId) {
          staffQuery.eq("id", staffId);
        }

        const { data: staffList } = await staffQuery;
        if (!staffList?.length) { setLoading(false); return; }

        const { data: goalTypes } = await supabase
          .from("crm_goal_types")
          .select("id, name, category")
          .eq("is_active", true)
          .eq("has_ote", true);

        if (!goalTypes?.length) { setLoading(false); return; }

        const goalTypeIds = goalTypes.map(g => g.id);

        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("id, staff_id, goal_type_id, meta_value, ote_base")
          .in("goal_type_id", goalTypeIds)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .in("staff_id", staffList.map(s => s.id));

        if (!goalValues?.length) { setLoading(false); return; }

        const goalValueIds = goalValues.map(g => g.id);
        const { data: tiers } = await supabase
          .from("crm_goal_commission_tiers")
          .select("*")
          .in("goal_value_id", goalValueIds)
          .order("min_percent", { ascending: true });

        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0);

        const { data: salesData } = await supabase
          .from("crm_sales")
          .select("billing_value, closer_staff_id")
          .gte("sale_date", monthStart.toISOString().split("T")[0])
          .lte("sale_date", monthEnd.toISOString().split("T")[0]);

        const { data: meetingsData } = await supabase
          .from("crm_activities")
          .select("responsible_staff_id")
          .eq("type", "meeting")
          .eq("status", "completed")
          .gte("completed_at", monthStart.toISOString())
          .lte("completed_at", monthEnd.toISOString());

        const results: CommissionData[] = [];

        for (const staff of staffList) {
          const goalType = goalTypes.find(g =>
            staff.role === "closer" ? g.category === "closer" || g.name === "Vendas" :
            staff.role === "sdr" ? g.category === "sdr" || g.name === "Reuniões Realizadas" : false
          );

          if (!goalType) continue;

          const goalValue = goalValues.find(g => g.staff_id === staff.id && g.goal_type_id === goalType.id);
          if (!goalValue) continue;

          const metaValue = Number(goalValue.meta_value) || 0;
          const fixedSalary = Number(goalValue.ote_base) || 0;

          let achieved = 0;
          if (staff.role === "closer") {
            achieved = (salesData || [])
              .filter(s => s.closer_staff_id === staff.id)
              .reduce((sum, s) => sum + (Number(s.billing_value) || 0), 0);
          } else if (staff.role === "sdr") {
            achieved = (meetingsData || [])
              .filter(m => m.responsible_staff_id === staff.id).length;
          }

          const achievedPercent = metaValue > 0 ? (achieved / metaValue) * 100 : 0;

          const staffTiers = (tiers || []).filter(t => t.goal_value_id === goalValue.id);
          let commission = 0;
          let tierLabel = "Sem comissão";

          for (const tier of staffTiers) {
            if (achievedPercent >= tier.min_percent && achievedPercent <= tier.max_percent) {
              commission = tier.commission_value;
              tierLabel = `${tier.min_percent}%–${tier.max_percent}%`;
              break;
            }
          }

          if (staffTiers.length > 0 && commission === 0) {
            const lastTier = staffTiers[staffTiers.length - 1];
            if (achievedPercent > lastTier.max_percent) {
              commission = lastTier.commission_value;
              tierLabel = `Acima de ${lastTier.min_percent}%`;
            }
          }

          // Build tier info with missing values and daily targets
          const tierInfos: TierInfo[] = staffTiers.map(tier => {
            const tierMinValue = (tier.min_percent / 100) * metaValue;
            const missingValue = Math.max(0, tierMinValue - achieved);
            const dailyNeeded = remainingDays > 0 ? missingValue / remainingDays : missingValue;
            const isCurrentTier = achievedPercent >= tier.min_percent && achievedPercent <= tier.max_percent;
            const isAchieved = achievedPercent >= tier.min_percent;

            return {
              minPercent: tier.min_percent,
              maxPercent: tier.max_percent,
              commissionValue: tier.commission_value,
              missingValue,
              dailyNeeded,
              isCurrentTier,
              isAchieved,
            };
          });

          // Calculate missing to first tier
          const firstTier = staffTiers[0];
          const missingToFirstTier = firstTier
            ? Math.max(0, ((firstTier.min_percent / 100) * metaValue) - achieved)
            : 0;

          const isCommissioning = commission > 0;

          results.push({
            staffId: staff.id,
            staffName: staff.name,
            role: staff.role,
            fixedSalary,
            commission,
            total: fixedSalary + commission,
            achieved,
            metaValue,
            achievedPercent: Math.round(achievedPercent),
            tierLabel,
            tiers: tierInfos,
            missingToFirstTier,
            isCommissioning,
            metricLabel: staff.role === "closer" ? "em faturamento" : "reuniões",
          });
        }

        setCommissionData(results);
      } catch (error) {
        console.error("Error loading commission data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (staffId && (staffRole === "closer" || staffRole === "sdr" || isMaster)) {
      loadCommissions();
    } else {
      setLoading(false);
    }
  }, [staffId, staffRole, isMaster]);

  if (loading || commissionData.length === 0) return null;

  const remainingDays = getRemainingBusinessDaysInMonth(new Date());

  const renderTierRow = (tier: TierInfo, role: string) => {
    const progressPercent = tier.missingValue <= 0 ? 100 : Math.max(0, 100 - (tier.missingValue / ((tier.minPercent / 100) * 1) * 100));

    return (
      <div
        key={`${tier.minPercent}-${tier.maxPercent}`}
        className={`rounded-lg border p-3 transition-all duration-200 ${
          tier.isCurrentTier
            ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
            : tier.isAchieved
            ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20"
            : "border-border/50 bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {tier.isAchieved ? (
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
            ) : tier.isCurrentTier ? (
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
            <span className="text-xs font-medium">
              Faixa {tier.minPercent}% – {tier.maxPercent}%
            </span>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] font-bold ${
              tier.isAchieved
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {formatCurrency(tier.commissionValue)}
          </Badge>
        </div>

        {tier.isAchieved && tier.missingValue <= 0 ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            ✅ Faixa alcançada
          </p>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Falta: <span className="font-semibold text-foreground">{formatMetric(tier.missingValue, role)}</span> {role === "sdr" ? "reuniões" : ""}
              </span>
              {remainingDays > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="font-semibold text-foreground">{formatMetric(tier.dailyNeeded, role)}</span>/dia útil
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Ganho total: {formatCurrency(tier.commissionValue)} de comissão
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderStaffCard = (data: CommissionData) => (
    <div
      key={data.staffId}
      className="relative overflow-hidden rounded-2xl border border-border/40 p-5 transition-all duration-300"
      style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.04))" }}
    >
      <div className="absolute top-0 left-0 h-1 w-full" style={{ background: "linear-gradient(90deg, #10b981, #3b82f6)" }} />

      {isMaster && (
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">{data.staffName}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {data.role === "closer" ? "Closer" : "SDR"}
          </Badge>
        </div>
      )}

      {/* Current status */}
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">
        <span className="text-xs">Meta atingida:</span>
        <Badge
          variant="secondary"
          className={`text-[10px] font-bold ${
            data.achievedPercent >= 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
            data.achievedPercent >= 70 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {data.achievedPercent}%
        </Badge>
        <span className="text-[10px] text-muted-foreground">({data.tierLabel})</span>
      </div>

      {/* Salary summary */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wallet className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] text-muted-foreground">Fixo</span>
          </div>
          <p className="text-sm font-bold">{formatCurrency(data.fixedSalary)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] text-muted-foreground">Comissão</span>
          </div>
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(data.commission)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
          <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.total)}</p>
        </div>
      </div>

      {/* Missing to commission alert */}
      {!data.isCommissioning && data.missingToFirstTier > 0 && (
        <div className="mt-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-3">
          <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Para começar a comissionar:</span>
          </div>
          <p className="text-sm font-bold text-orange-800 dark:text-orange-300 mt-1">
            Faltam {formatMetric(data.missingToFirstTier, data.role)} {data.metricLabel}
          </p>
          {remainingDays > 0 && (
            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
              ≈ {formatMetric(data.missingToFirstTier / remainingDays, data.role)}/{data.role === "sdr" ? "reunião" : ""} por dia útil ({remainingDays} dias restantes)
            </p>
          )}
        </div>
      )}

      {/* Tier breakdown */}
      {data.tiers.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Faixas de Comissão</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{remainingDays} dias úteis restantes</span>
          </div>
          <div className="space-y-2">
            {data.tiers.map(tier => renderTierRow(tier, data.role))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card className="border-border/40 shadow-md overflow-hidden">
      <div className="p-4 pb-2 flex items-center gap-2">
        <div className="p-2 rounded-xl" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
          <DollarSign className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">
            {isMaster ? "Remuneração da Equipe" : "Sua Remuneração"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {isMaster ? "Fixo + Comissão de todos os comerciais" : "Fixo + Comissão do mês atual"}
          </p>
        </div>
      </div>
      <CardContent className="p-4 pt-2">
        <div className={`grid gap-3 ${isMaster && commissionData.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {commissionData.map(renderStaffCard)}
        </div>
      </CardContent>
    </Card>
  );
};

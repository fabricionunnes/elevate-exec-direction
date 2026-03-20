import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Award, Wallet } from "lucide-react";

interface CommissionData {
  staffId: string;
  staffName: string;
  role: string;
  fixedSalary: number;
  commission: number;
  total: number;
  achievedPercent: number;
  tierLabel: string;
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

  useEffect(() => {
    const loadCommissions = async () => {
      try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Get relevant staff
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

        // Get goal types
        const { data: goalTypes } = await supabase
          .from("crm_goal_types")
          .select("id, name, category")
          .eq("is_active", true)
          .eq("has_ote", true);

        if (!goalTypes?.length) { setLoading(false); return; }

        const goalTypeIds = goalTypes.map(g => g.id);

        // Get goal values for current month
        const { data: goalValues } = await supabase
          .from("crm_goal_values")
          .select("id, staff_id, goal_type_id, meta_value, ote_base")
          .in("goal_type_id", goalTypeIds)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .in("staff_id", staffList.map(s => s.id));

        if (!goalValues?.length) { setLoading(false); return; }

        // Get commission tiers
        const goalValueIds = goalValues.map(g => g.id);
        const { data: tiers } = await supabase
          .from("crm_goal_commission_tiers")
          .select("*")
          .in("goal_value_id", goalValueIds)
          .order("min_percent", { ascending: true });

        // Get actual sales for closers
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0);
        
        const { data: salesData } = await supabase
          .from("crm_sales")
          .select("billing_value, closer_staff_id")
          .gte("sale_date", monthStart.toISOString().split("T")[0])
          .lte("sale_date", monthEnd.toISOString().split("T")[0]);

        // Get meetings held for SDRs
        const { data: meetingsData } = await supabase
          .from("crm_activities")
          .select("responsible_staff_id")
          .eq("type", "meeting")
          .eq("status", "completed")
          .gte("completed_at", monthStart.toISOString())
          .lte("completed_at", monthEnd.toISOString());

        // Build commission data
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

          // Calculate achieved
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

          // Find matching tier
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

          // If above the highest tier max
          if (staffTiers.length > 0 && commission === 0) {
            const lastTier = staffTiers[staffTiers.length - 1];
            if (achievedPercent > lastTier.max_percent) {
              commission = lastTier.commission_value;
              tierLabel = `Acima de ${lastTier.min_percent}%`;
            }
          }

          results.push({
            staffId: staff.id,
            staffName: staff.name,
            role: staff.role,
            fixedSalary,
            commission,
            total: fixedSalary + commission,
            achievedPercent: Math.round(achievedPercent),
            tierLabel,
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

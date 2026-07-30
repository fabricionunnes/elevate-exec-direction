import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Calendar, TrendingUp, Target, Users, Plus, Trash2, Settings2, Gift, Trophy, Star, Copy } from "lucide-react";
import { toast } from "sonner";

interface GoalType {
  id: string;
  name: string;
  unit_type: string;
  category: string | null;
  has_super_meta: boolean;
  has_hiper_meta: boolean;
  has_ote: boolean;
  is_active: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  is_crm_closer?: boolean;
}

interface GoalValue {
  id?: string;
  staff_id: string;
  goal_type_id: string;
  meta_value: number;
  super_meta_value: number | null;
  hiper_meta_value: number | null;
  ote_base: number;
  ote_variable: number;
  ote_accelerator: number | null;
  super_meta_bonus_text: string | null;
  super_meta_bonus_value: number | null;
  super_meta_bonus_image_url: string | null;
  hiper_meta_bonus_text: string | null;
  hiper_meta_bonus_value: number | null;
  hiper_meta_bonus_image_url: string | null;
}

interface CommissionTier {
  id?: string;
  goal_value_id?: string;
  min_percent: number;
  max_percent: number;
  commission_value: number;
  sort_order: number;
}

const CLOSER_ROLES = ["closer", "head_comercial"];
const SDR_ROLES = ["sdr", "social_setter", "bdr"];

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const getRoleBadge = (role: string) => {
  const colors: Record<string, string> = {
    closer: "bg-blue-500/10 text-blue-500",
    sdr: "bg-green-500/10 text-green-500",
    social_setter: "bg-purple-500/10 text-purple-500",
    bdr: "bg-orange-500/10 text-orange-500",
    head_comercial: "bg-red-500/10 text-red-500",
  };
  const labels: Record<string, string> = {
    closer: "Closer",
    sdr: "SDR",
    social_setter: "Social Setter",
    bdr: "BDR",
    head_comercial: "Head Comercial",
  };
  return (
    <Badge className={colors[role] || "bg-muted"}>
      {labels[role] || role}
    </Badge>
  );
};

const DEFAULT_TIERS: CommissionTier[] = [
  { min_percent: 0, max_percent: 70, commission_value: 0, sort_order: 0 },
  { min_percent: 70, max_percent: 85, commission_value: 0, sort_order: 1 },
  { min_percent: 85, max_percent: 100, commission_value: 0, sort_order: 2 },
  { min_percent: 100, max_percent: 120, commission_value: 0, sort_order: 3 },
  { min_percent: 120, max_percent: 150, commission_value: 0, sort_order: 4 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);

export const CRMGoalValuesManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replicating, setReplicating] = useState(false);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [goalValues, setGoalValues] = useState<Map<string, GoalValue>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [closerOteGoalType, setCloserOteGoalType] = useState<GoalType | null>(null);
  const [sdrOteGoalType, setSdrOteGoalType] = useState<GoalType | null>(null);

  // Commission tiers dialog
  const [tiersDialogOpen, setTiersDialogOpen] = useState(false);
  const [tiersStaff, setTiersStaff] = useState<StaffMember | null>(null);
  const [editingTiers, setEditingTiers] = useState<CommissionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tiersSaving, setTiersSaving] = useState(false);
  const [tiersCountMap, setTiersCountMap] = useState<Map<string, number>>(new Map());

  // Bonus dialog
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [bonusStaff, setBonusStaff] = useState<StaffMember | null>(null);

  // Metas extra (quantidade de vendas / por produto)
  interface SecondaryGoal { id?: string; kind: "sales_count" | "product"; product_id: string | null; target_qty: number; reward_kind: "multiplier" | "fixed" | "percent_product"; reward_value: number; }
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [extraStaff, setExtraStaff] = useState<StaffMember | null>(null);
  const [extraGoals, setExtraGoals] = useState<SecondaryGoal[]>([]);
  const [extraProducts, setExtraProducts] = useState<{ id: string; name: string }[]>([]);
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraCounts, setExtraCounts] = useState<Map<string, number>>(new Map());

  const loadExtraCounts = async () => {
    const { data } = await supabase.from("crm_secondary_goals")
      .select("staff_id").eq("month", selectedMonth).eq("year", selectedYear);
    const m = new Map<string, number>();
    (data || []).forEach((r: any) => m.set(r.staff_id, (m.get(r.staff_id) || 0) + 1));
    setExtraCounts(m);
  };

  const openExtraDialog = async (staff: StaffMember) => {
    setExtraStaff(staff);
    setExtraDialogOpen(true);
    const [{ data: prods }, { data: rows }] = await Promise.all([
      supabase.from("crm_products").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("crm_secondary_goals").select("*")
        .eq("staff_id", staff.id).eq("month", selectedMonth).eq("year", selectedYear).order("created_at"),
    ]);
    setExtraProducts(prods || []);
    setExtraGoals((rows || []).map((r: any) => ({
      id: r.id, kind: r.kind, product_id: r.product_id,
      target_qty: Number(r.target_qty) || 0, reward_kind: r.reward_kind, reward_value: Number(r.reward_value) || 0,
    })));
  };

  const saveExtraGoals = async () => {
    if (!extraStaff) return;
    const invalid = extraGoals.some(g =>
      g.target_qty <= 0 || (g.kind === "product" && !g.product_id) || (g.reward_kind !== "multiplier" && g.reward_value <= 0) || (g.reward_kind === "multiplier" && g.reward_value <= 1));
    if (invalid) { toast.error("Confira as metas extra: alvo > 0, produto escolhido e premiação preenchida (multiplicador > 1)"); return; }
    setExtraSaving(true);
    try {
      await supabase.from("crm_secondary_goals").delete()
        .eq("staff_id", extraStaff.id).eq("month", selectedMonth).eq("year", selectedYear);
      if (extraGoals.length) {
        const { error } = await supabase.from("crm_secondary_goals").insert(
          extraGoals.map(g => ({
            staff_id: extraStaff.id, month: selectedMonth, year: selectedYear,
            kind: g.kind, product_id: g.kind === "product" ? g.product_id : null,
            target_qty: g.target_qty, reward_kind: g.reward_kind, reward_value: g.reward_value,
          })),
        );
        if (error) throw error;
      }
      toast.success("Metas extra salvas");
      setExtraDialogOpen(false);
      loadExtraCounts();
    } catch (e: any) { toast.error(e.message || "Erro ao salvar metas extra"); }
    finally { setExtraSaving(false); }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const getGoalTypeForStaff = (staff: StaffMember): GoalType | null => {
    if (staff.is_crm_closer || CLOSER_ROLES.includes(staff.role)) return closerOteGoalType;
    if (SDR_ROLES.includes(staff.role)) return sdrOteGoalType;
    return closerOteGoalType;
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (closerOteGoalType || sdrOteGoalType) {
      loadGoalValues();
    }
    loadExtraCounts();
  }, [selectedMonth, selectedYear, closerOteGoalType, sdrOteGoalType, staffMembers]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { data: typesData, error: typesError } = await supabase
        .from("crm_goal_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (typesError) throw typesError;
      setGoalTypes(typesData || []);

      // Métrica principal de cada papel: prefere o tipo com OTE; se NENHUM tiver OTE,
      // cai pro 1º tipo de meta do papel — senão a linha do colaborador não renderiza
      // e não dá pra definir meta nenhuma.
      const closerOte = (typesData || []).find(t => t.category === "closer" && t.has_ote)
        || (typesData || []).find(t => t.category === "closer");
      const sdrOte = (typesData || []).find(t => t.category === "sdr" && t.has_ote)
        || (typesData || []).find(t => t.category === "sdr");
      setCloserOteGoalType(closerOte || null);
      setSdrOteGoalType(sdrOte || null);

      const { data: staffWithAccess } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      const staffIdsWithCRMAccess = new Set((staffWithAccess || []).map((p) => p.staff_id));

      const { data: staffData, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, is_crm_closer")
        .eq("is_active", true)
        .order("name");

      if (staffError) throw staffError;

      const filteredStaff = (staffData || []).filter(
        (s) =>
          (s as any).is_crm_closer ||
          ((s.role === "master" || staffIdsWithCRMAccess.has(s.id)) &&
            [...CLOSER_ROLES, ...SDR_ROLES].includes(s.role))
      );
      setStaffMembers(filteredStaff);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadGoalValues = async () => {
    try {
      const goalTypeIds: string[] = [];
      if (closerOteGoalType) goalTypeIds.push(closerOteGoalType.id);
      if (sdrOteGoalType) goalTypeIds.push(sdrOteGoalType.id);
      if (goalTypeIds.length === 0) return;

      const { data, error } = await supabase
        .from("crm_goal_values")
        .select("*")
        .in("goal_type_id", goalTypeIds)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);

      if (error) throw error;

      const valuesMap = new Map<string, GoalValue>();
      const goalValueIds: string[] = [];
      (data || []).forEach((v: any) => {
        valuesMap.set(v.staff_id, {
          ...v,
          super_meta_bonus_text: v.super_meta_bonus_text || null,
          super_meta_bonus_value: v.super_meta_bonus_value ?? null,
          super_meta_bonus_image_url: v.super_meta_bonus_image_url || null,
          hiper_meta_bonus_text: v.hiper_meta_bonus_text || null,
          hiper_meta_bonus_value: v.hiper_meta_bonus_value ?? null,
          hiper_meta_bonus_image_url: v.hiper_meta_bonus_image_url || null,
        });
        if (v.id) goalValueIds.push(v.id);
      });

      staffMembers.forEach((staff) => {
        if (!valuesMap.has(staff.id)) {
          const goalType = getGoalTypeForStaff(staff);
          if (goalType) {
            valuesMap.set(staff.id, {
              staff_id: staff.id,
              goal_type_id: goalType.id,
              meta_value: 0,
              super_meta_value: null,
              hiper_meta_value: null,
              ote_base: 0,
              ote_variable: 0,
              ote_accelerator: null,
              super_meta_bonus_text: null,
              super_meta_bonus_value: null,
              super_meta_bonus_image_url: null,
              hiper_meta_bonus_text: null,
              hiper_meta_bonus_value: null,
              hiper_meta_bonus_image_url: null,
            });
          }
        }
      });

      setGoalValues(valuesMap);

      if (goalValueIds.length > 0) {
        const { data: tiersData } = await supabase
          .from("crm_goal_commission_tiers")
          .select("goal_value_id")
          .in("goal_value_id", goalValueIds);

        const countMap = new Map<string, number>();
        (tiersData || []).forEach((t: any) => {
          countMap.set(t.goal_value_id, (countMap.get(t.goal_value_id) || 0) + 1);
        });
        setTiersCountMap(countMap);
      } else {
        setTiersCountMap(new Map());
      }
    } catch (error) {
      console.error("Error loading goal values:", error);
    }
  };

  const updateValue = (staffId: string, field: keyof GoalValue, value: any) => {
    setGoalValues((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(staffId);
      if (current) {
        newMap.set(staffId, { ...current, [field]: value });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Uma linha tem conteúdo se qualquer campo de meta/comissão/bônus foi preenchido.
      const hasAnyValue = (v: GoalValue) =>
        (v.meta_value || 0) > 0 ||
        (v.super_meta_value || 0) > 0 ||
        (v.hiper_meta_value || 0) > 0 ||
        (v.ote_base || 0) > 0 ||
        (v.ote_variable || 0) > 0 ||
        (v.super_meta_bonus_value || 0) > 0 ||
        (v.hiper_meta_bonus_value || 0) > 0 ||
        !!v.super_meta_bonus_text ||
        !!v.hiper_meta_bonus_text;

      const valuesToUpsert = Array.from(goalValues.values())
        // Linhas que JÁ existem no banco (v.id) são sempre salvas, mesmo zeradas —
        // senão zerar a meta não persistia e o valor antigo voltava ao recarregar.
        // Só ignora linha nova que está totalmente vazia (não cria registro à toa).
        .filter(v => !!v.id || hasAnyValue(v))
        .map((v) => ({
          staff_id: v.staff_id,
          goal_type_id: v.goal_type_id,
          month: selectedMonth,
          year: selectedYear,
          meta_value: v.meta_value,
          super_meta_value: v.super_meta_value,
          hiper_meta_value: v.hiper_meta_value,
          ote_base: v.ote_base,
          ote_variable: v.ote_variable,
          ote_accelerator: v.ote_accelerator,
          super_meta_bonus_text: v.super_meta_bonus_text,
          super_meta_bonus_value: v.super_meta_bonus_value,
          super_meta_bonus_image_url: v.super_meta_bonus_image_url,
          hiper_meta_bonus_text: v.hiper_meta_bonus_text,
          hiper_meta_bonus_value: v.hiper_meta_bonus_value,
          hiper_meta_bonus_image_url: v.hiper_meta_bonus_image_url,
        }));

      if (valuesToUpsert.length > 0) {
        const { error } = await supabase
          .from("crm_goal_values")
          .upsert(valuesToUpsert, {
            onConflict: "staff_id,goal_type_id,month,year",
          });

        if (error) throw error;
      }

      toast.success("Metas salvas com sucesso!");
      loadGoalValues();
    } catch (error: any) {
      console.error("Error saving goals:", error);
      toast.error(error.message || "Erro ao salvar metas");
    } finally {
      setSaving(false);
    }
  };

  const handleReplicatePreviousMonth = async () => {
    const goalTypeIds: string[] = [];
    if (closerOteGoalType) goalTypeIds.push(closerOteGoalType.id);
    if (sdrOteGoalType) goalTypeIds.push(sdrOteGoalType.id);
    if (goalTypeIds.length === 0) return;

    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

    setReplicating(true);
    try {
      // 1. Carrega as metas do mês anterior
      const { data: prevValues, error: pvErr } = await supabase
        .from("crm_goal_values")
        .select("*")
        .in("goal_type_id", goalTypeIds)
        .eq("month", prevMonth)
        .eq("year", prevYear);
      if (pvErr) throw pvErr;

      if (!prevValues || prevValues.length === 0) {
        toast.info(`O mês ${String(prevMonth).padStart(2, "0")}/${prevYear} não tem metas configuradas para replicar.`);
        return;
      }

      if (!confirm(`Replicar metas, comissões e bônus de ${String(prevMonth).padStart(2, "0")}/${prevYear} para ${String(selectedMonth).padStart(2, "0")}/${selectedYear}?\n\nIsso substitui o que estiver configurado no mês atual. Depois você pode ajustar e salvar.`)) {
        return;
      }

      // 2. Copia as metas para o mês selecionado (upsert substitui o que já existir)
      const rows = prevValues.map((v: any) => ({
        staff_id: v.staff_id,
        goal_type_id: v.goal_type_id,
        month: selectedMonth,
        year: selectedYear,
        meta_value: v.meta_value,
        super_meta_value: v.super_meta_value,
        hiper_meta_value: v.hiper_meta_value,
        ote_base: v.ote_base,
        ote_variable: v.ote_variable,
        ote_accelerator: v.ote_accelerator,
        super_meta_bonus_text: v.super_meta_bonus_text,
        super_meta_bonus_value: v.super_meta_bonus_value,
        super_meta_bonus_image_url: v.super_meta_bonus_image_url,
        hiper_meta_bonus_text: v.hiper_meta_bonus_text,
        hiper_meta_bonus_value: v.hiper_meta_bonus_value,
        hiper_meta_bonus_image_url: v.hiper_meta_bonus_image_url,
      }));
      const { data: newValues, error: upErr } = await supabase
        .from("crm_goal_values")
        .upsert(rows, { onConflict: "staff_id,goal_type_id,month,year" })
        .select();
      if (upErr) throw upErr;

      // 3. Copia as faixas de comissão de cada meta
      const prevIds = prevValues.map((v: any) => v.id).filter(Boolean);
      if (prevIds.length > 0 && newValues && newValues.length > 0) {
        const { data: prevTiers } = await supabase
          .from("crm_goal_commission_tiers")
          .select("*")
          .in("goal_value_id", prevIds);

        const keyOf = (v: any) => `${v.staff_id}|${v.goal_type_id}`;
        const prevById = new Map(prevValues.map((v: any) => [v.id, v]));
        const tiersByKey = new Map<string, any[]>();
        (prevTiers || []).forEach((t: any) => {
          const gv = prevById.get(t.goal_value_id);
          if (!gv) return;
          const k = keyOf(gv);
          if (!tiersByKey.has(k)) tiersByKey.set(k, []);
          tiersByKey.get(k)!.push(t);
        });

        // Limpa faixas existentes no mês atual e insere as do mês anterior
        const newIds = newValues.map((v: any) => v.id);
        if (newIds.length > 0) {
          await supabase.from("crm_goal_commission_tiers").delete().in("goal_value_id", newIds);
        }
        const tiersToInsert: any[] = [];
        newValues.forEach((nv: any) => {
          (tiersByKey.get(keyOf(nv)) || []).forEach((t: any) => {
            tiersToInsert.push({
              goal_value_id: nv.id,
              min_percent: t.min_percent,
              max_percent: t.max_percent,
              commission_value: t.commission_value,
              sort_order: t.sort_order,
            });
          });
        });
        if (tiersToInsert.length > 0) {
          const { error: tErr } = await supabase.from("crm_goal_commission_tiers").insert(tiersToInsert);
          if (tErr) throw tErr;
        }
      }

      toast.success(`Metas de ${String(prevMonth).padStart(2, "0")}/${prevYear} replicadas. Ajuste o que precisar e salve.`);
      await loadGoalValues();
    } catch (error: any) {
      console.error("Error replicating goals:", error);
      toast.error(error.message || "Erro ao replicar metas do mês anterior");
    } finally {
      setReplicating(false);
    }
  };

  // ---- Commission Tiers Dialog ----

  const openTiersDialog = async (staff: StaffMember) => {
    setTiersStaff(staff);
    setTiersDialogOpen(true);
    setTiersLoading(true);

    const goalValue = goalValues.get(staff.id);

    if (!goalValue?.id) {
      setEditingTiers(DEFAULT_TIERS.map(t => ({ ...t })));
      setTiersLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("crm_goal_commission_tiers")
        .select("*")
        .eq("goal_value_id", goalValue.id)
        .order("sort_order");

      if (error) throw error;

      if (data && data.length > 0) {
        setEditingTiers(data);
      } else {
        setEditingTiers(DEFAULT_TIERS.map(t => ({ ...t })));
      }
    } catch (err) {
      console.error("Error loading tiers:", err);
      setEditingTiers(DEFAULT_TIERS.map(t => ({ ...t })));
    } finally {
      setTiersLoading(false);
    }
  };

  const addTier = () => {
    const lastTier = editingTiers[editingTiers.length - 1];
    const newMin = lastTier ? lastTier.max_percent : 0;
    setEditingTiers(prev => [
      ...prev,
      {
        min_percent: newMin,
        max_percent: newMin + 20,
        commission_value: 0,
        sort_order: prev.length,
      },
    ]);
  };

  const removeTier = (index: number) => {
    setEditingTiers(prev => prev.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof CommissionTier, value: number) => {
    setEditingTiers(prev =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const handleSaveTiers = async () => {
    if (!tiersStaff) return;
    setTiersSaving(true);

    try {
      let goalValue = goalValues.get(tiersStaff.id);
      const goalType = getGoalTypeForStaff(tiersStaff);

      if (!goalValue?.id && goalType) {
        const { data: created, error: createErr } = await supabase
          .from("crm_goal_values")
          .upsert({
            staff_id: tiersStaff.id,
            goal_type_id: goalType.id,
            month: selectedMonth,
            year: selectedYear,
            meta_value: goalValue?.meta_value || 0,
            super_meta_value: goalValue?.super_meta_value ?? null,
            hiper_meta_value: goalValue?.hiper_meta_value ?? null,
            ote_base: goalValue?.ote_base || 0,
            ote_variable: goalValue?.ote_variable || 0,
            ote_accelerator: goalValue?.ote_accelerator ?? null,
          }, { onConflict: "staff_id,goal_type_id,month,year" })
          .select()
          .single();

        if (createErr) throw createErr;
        goalValue = created as GoalValue;
      }

      const goalValueId = goalValue!.id!;

      await supabase
        .from("crm_goal_commission_tiers")
        .delete()
        .eq("goal_value_id", goalValueId);

      if (editingTiers.length > 0) {
        const tiersToInsert = editingTiers.map((t, i) => ({
          goal_value_id: goalValueId,
          min_percent: t.min_percent,
          max_percent: t.max_percent,
          commission_value: t.commission_value,
          sort_order: i,
        }));

        const { error } = await supabase
          .from("crm_goal_commission_tiers")
          .insert(tiersToInsert);

        if (error) throw error;
      }

      toast.success("Faixas de comissão salvas!");
      setTiersDialogOpen(false);
      loadGoalValues();
    } catch (err: any) {
      console.error("Error saving tiers:", err);
      toast.error(err.message || "Erro ao salvar faixas");
    } finally {
      setTiersSaving(false);
    }
  };

  // ---- Bonus Dialog ----
  const openBonusDialog = (staff: StaffMember) => {
    setBonusStaff(staff);
    setBonusDialogOpen(true);
  };

  const getMetricLabel = (staff: StaffMember): string => {
    const goalType = getGoalTypeForStaff(staff);
    return goalType?.name || "—";
  };

  const getInputPrefix = (staff: StaffMember) => {
    const goalType = getGoalTypeForStaff(staff);
    if (!goalType) return null;
    if (goalType.unit_type === "currency") return "R$";
    if (goalType.unit_type === "percentage") return "%";
    return null;
  };

  const closers = staffMembers.filter(s => s.is_crm_closer || CLOSER_ROLES.includes(s.role));
  const sdrs = staffMembers.filter(s => SDR_ROLES.includes(s.role));
  // Meta da Head Comercial = soma das metas dos closers (exclui ela mesma). Read-only.
  const realClosers = closers.filter(s => s.role !== "head_comercial");
  const closersMetaSum = realClosers.reduce((s, c) => s + (goalValues.get(c.id)?.meta_value || 0), 0);
  const closersSuperSum = realClosers.reduce((s, c) => s + (goalValues.get(c.id)?.super_meta_value || 0), 0);
  const closersHiperSum = realClosers.reduce((s, c) => s + (goalValues.get(c.id)?.hiper_meta_value || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!closerOteGoalType && !sdrOteGoalType) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum tipo de meta com comissão configurado. Ative o OTE em algum tipo de meta.</p>
        </CardContent>
      </Card>
    );
  }

  const hasBonusConfigured = (staffId: string) => {
    const v = goalValues.get(staffId);
    if (!v) return false;
    return !!(v.super_meta_bonus_text || v.hiper_meta_bonus_text || (v.super_meta_bonus_value && v.super_meta_bonus_value > 0) || (v.hiper_meta_bonus_value && v.hiper_meta_bonus_value > 0));
  };

  const renderStaffRow = (staff: StaffMember) => {
    const value = goalValues.get(staff.id);
    const prefix = getInputPrefix(staff);
    const goalType = getGoalTypeForStaff(staff);
    const tiersCount = value?.id ? (tiersCountMap.get(value.id) || 0) : 0;
    const hasBonus = hasBonusConfigured(staff.id);

    if (!goalType) return null;

    return (
      <TableRow key={staff.id}>
        <TableCell className="font-medium">{staff.name}</TableCell>
        <TableCell>{getRoleBadge(staff.role)}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs font-normal">
            {goalType.name}
          </Badge>
        </TableCell>
        <TableCell>
          {staff.role === "head_comercial" ? (
            <div className="flex items-center justify-end gap-1 text-right" title="Soma das metas dos closers (automático)">
              {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
              <span className="w-24 text-right font-semibold tabular-nums">{closersMetaSum.toLocaleString("pt-BR")}</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {prefix && (
                <span className="text-muted-foreground text-sm">{prefix}</span>
              )}
              <Input
                type="number"
                value={value?.meta_value || 0}
                onChange={(e) =>
                  updateValue(staff.id, "meta_value", parseFloat(e.target.value) || 0)
                }
                className="w-24 text-right"
              />
            </div>
          )}
        </TableCell>
        <TableCell>
          {staff.role === "head_comercial" ? (
            <div className="flex items-center justify-end gap-1 text-right" title="Soma das super metas dos closers (automático)">
              {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
              <span className="w-24 text-right font-semibold tabular-nums">{closersSuperSum ? closersSuperSum.toLocaleString("pt-BR") : "—"}</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {prefix && (
                <span className="text-muted-foreground text-sm">{prefix}</span>
              )}
              <Input
                type="number"
                value={value?.super_meta_value || ""}
                placeholder="—"
                onChange={(e) =>
                  updateValue(staff.id, "super_meta_value", e.target.value ? parseFloat(e.target.value) : null)
                }
                className="w-24 text-right"
              />
            </div>
          )}
        </TableCell>
        <TableCell>
          {staff.role === "head_comercial" ? (
            <div className="flex items-center justify-end gap-1 text-right" title="Soma das hiper metas dos closers (automático)">
              {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
              <span className="w-24 text-right font-semibold tabular-nums">{closersHiperSum ? closersHiperSum.toLocaleString("pt-BR") : "—"}</span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {prefix && (
                <span className="text-muted-foreground text-sm">{prefix}</span>
              )}
              <Input
                type="number"
                value={value?.hiper_meta_value || ""}
                placeholder="—"
                onChange={(e) =>
                  updateValue(staff.id, "hiper_meta_value", e.target.value ? parseFloat(e.target.value) : null)
                }
                className="w-24 text-right"
              />
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <span className="text-muted-foreground text-sm">R$</span>
            <Input
              type="number"
              value={value?.ote_base || 0}
              onChange={(e) =>
                updateValue(staff.id, "ote_base", parseFloat(e.target.value) || 0)
              }
              className="w-24 text-right"
              placeholder="Fixo"
            />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openTiersDialog(staff)}
              className="gap-1"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Faixas
              {tiersCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                  {tiersCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openBonusDialog(staff)}
              className={`gap-1 ${hasBonus ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400" : ""}`}
            >
              <Gift className="h-3.5 w-3.5" />
              Bônus
              {hasBonus && (
                <div className="h-2 w-2 rounded-full bg-amber-500" />
              )}
            </Button>
            {(CLOSER_ROLES.includes(staff.role) || staff.is_crm_closer) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openExtraDialog(staff)}
                className="gap-1"
                title="Metas extra: quantidade de vendas e meta por produto, com premiação atrelada"
              >
                <Trophy className="h-3.5 w-3.5" />
                Metas extra
                {(extraCounts.get(staff.id) || 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                    {extraCounts.get(staff.id)}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderExtraDialog = () => {
    if (!extraStaff) return null;
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;
    return (
      <Dialog open={extraDialogOpen} onOpenChange={setExtraDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Metas extra — {extraStaff.name} · {monthLabel}/{selectedYear}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Metas paralelas à meta principal em R$. A premiação entra na remuneração do mês quando a meta extra é batida:
            multiplicador aplica sobre a comissão das faixas; bônus fixo soma em R$; % do produto soma sobre o faturamento daquele produto no mês.
          </p>
          <div className="space-y-3">
            {extraGoals.map((g, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={g.kind} onValueChange={(v: any) =>
                    setExtraGoals(p => p.map((x, k) => k === i ? { ...x, kind: v, product_id: v === "product" ? x.product_id : null, reward_kind: v === "product" ? x.reward_kind : (x.reward_kind === "percent_product" ? "fixed" : x.reward_kind) } : x))}>
                    <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales_count">Quantidade de vendas</SelectItem>
                      <SelectItem value="product">Vendas de um produto</SelectItem>
                    </SelectContent>
                  </Select>
                  {g.kind === "product" && (
                    <Select value={g.product_id || ""} onValueChange={(v) =>
                      setExtraGoals(p => p.map((x, k) => k === i ? { ...x, product_id: v } : x))}>
                      <SelectTrigger className="w-[210px] h-9"><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                      <SelectContent>
                        {extraProducts.map(pr => <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">alvo</span>
                    <Input type="number" min={1} className="w-20 h-9 text-right" value={g.target_qty || ""}
                      onChange={(e) => setExtraGoals(p => p.map((x, k) => k === i ? { ...x, target_qty: parseFloat(e.target.value) || 0 } : x))} />
                    <span className="text-xs text-muted-foreground">venda(s) no mês</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-destructive"
                    onClick={() => setExtraGoals(p => p.filter((_, k) => k !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-20">Premiação:</span>
                  <Select value={g.reward_kind} onValueChange={(v: any) =>
                    setExtraGoals(p => p.map((x, k) => k === i ? { ...x, reward_kind: v } : x))}>
                    <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Bônus fixo (R$)</SelectItem>
                      <SelectItem value="multiplier">Multiplicador da comissão</SelectItem>
                      {g.kind === "product" && <SelectItem value="percent_product">% do faturamento do produto</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    {g.reward_kind === "fixed" && <span className="text-xs text-muted-foreground">R$</span>}
                    <Input type="number" step="0.01" className="w-24 h-9 text-right" value={g.reward_value || ""}
                      placeholder={g.reward_kind === "multiplier" ? "1,10" : g.reward_kind === "percent_product" ? "5" : "500"}
                      onChange={(e) => setExtraGoals(p => p.map((x, k) => k === i ? { ...x, reward_value: parseFloat(e.target.value) || 0 } : x))} />
                    {g.reward_kind === "multiplier" && <span className="text-xs text-muted-foreground">x (ex.: 1,1 = +10%)</span>}
                    {g.reward_kind === "percent_product" && <span className="text-xs text-muted-foreground">%</span>}
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => setExtraGoals(p => [...p, { kind: "sales_count", product_id: null, target_qty: 0, reward_kind: "fixed", reward_value: 0 }])}>
              <Plus className="h-4 w-4" /> Adicionar meta extra
            </Button>
            <Button onClick={saveExtraGoals} disabled={extraSaving} className="w-full gap-2">
              {extraSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar metas extra
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderBonusDialog = () => {
    if (!bonusStaff) return null;
    const value = goalValues.get(bonusStaff.id);
    if (!value) return null;

    return (
      <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              Bônus Super/Hiper Meta — {bonusStaff.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Super Meta Bonus */}
            <div className="space-y-3 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-blue-500" />
                <h4 className="font-semibold text-sm">Bônus Super Meta</h4>
                {value.super_meta_value ? (
                  <Badge variant="outline" className="text-[10px]">
                    Meta: {value.super_meta_value}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Sem super meta definida
                  </Badge>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrição do bônus</label>
                <Textarea
                  value={value.super_meta_bonus_text || ""}
                  onChange={(e) => updateValue(bonusStaff.id, "super_meta_bonus_text", e.target.value || null)}
                  placeholder="Ex: Day off, jantar no restaurante X, viagem..."
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valor em R$ (opcional)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      value={value.super_meta_bonus_value || ""}
                      onChange={(e) => updateValue(bonusStaff.id, "super_meta_bonus_value", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">URL da imagem (opcional)</label>
                  <Input
                    value={value.super_meta_bonus_image_url || ""}
                    onChange={(e) => updateValue(bonusStaff.id, "super_meta_bonus_image_url", e.target.value || null)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Hiper Meta Bonus */}
            <div className="space-y-3 p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-purple-500" />
                <h4 className="font-semibold text-sm">Bônus Hiper Meta</h4>
                {value.hiper_meta_value ? (
                  <Badge variant="outline" className="text-[10px]">
                    Meta: {value.hiper_meta_value}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Sem hiper meta definida
                  </Badge>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrição do bônus</label>
                <Textarea
                  value={value.hiper_meta_bonus_text || ""}
                  onChange={(e) => updateValue(bonusStaff.id, "hiper_meta_bonus_text", e.target.value || null)}
                  placeholder="Ex: Bônus extra + viagem, prêmio especial..."
                  className="resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valor em R$ (opcional)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      value={value.hiper_meta_bonus_value || ""}
                      onChange={(e) => updateValue(bonusStaff.id, "hiper_meta_bonus_value", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">URL da imagem (opcional)</label>
                  <Input
                    value={value.hiper_meta_bonus_image_url || ""}
                    onChange={(e) => updateValue(bonusStaff.id, "hiper_meta_bonus_image_url", e.target.value || null)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Os bônus serão salvos junto com as metas ao clicar em "Salvar Metas".
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Metas e Comissões
              </CardTitle>
              <CardDescription>
                Configure metas, super/hiper meta, salário fixo, faixas de comissão e bônus
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleReplicatePreviousMonth} disabled={replicating || saving}>
                {replicating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Replicar mês anterior
              </Button>
              <Button onClick={handleSave} disabled={saving || replicating}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Metas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
              {closerOteGoalType && (
                <span>Closer: <strong>{closerOteGoalType.name}</strong></span>
              )}
              {closerOteGoalType && sdrOteGoalType && <span>•</span>}
              {sdrOteGoalType && (
                <span>SDR: <strong>{sdrOteGoalType.name}</strong></span>
              )}
            </div>
          </div>

          {/* Unified Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Super Meta</TableHead>
                  <TableHead className="text-right">Hiper Meta</TableHead>
                  <TableHead className="text-right">Fixo (R$)</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closers.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="py-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Closers
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {closers.map(renderStaffRow)}

                {sdrs.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="py-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        SDRs
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {sdrs.map(renderStaffRow)}
              </TableBody>
            </Table>
          </div>

          {staffMembers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador comercial encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Tiers Dialog */}
      <Dialog open={tiersDialogOpen} onOpenChange={setTiersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Faixas de Comissão — {tiersStaff?.name}
            </DialogTitle>
          </DialogHeader>

          {tiersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure as faixas de atingimento e o valor de comissão para cada faixa.
              </p>

              <div className="space-y-3">
                {editingTiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        type="number"
                        value={tier.min_percent}
                        onChange={(e) =>
                          updateTier(index, "min_percent", parseFloat(e.target.value) || 0)
                        }
                        className="w-16 text-right text-sm"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                      <span className="text-muted-foreground text-xs mx-1">até</span>
                      <Input
                        type="number"
                        value={tier.max_percent}
                        onChange={(e) =>
                          updateTier(index, "max_percent", parseFloat(e.target.value) || 0)
                        }
                        className="w-16 text-right text-sm"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">R$</span>
                      <Input
                        type="number"
                        value={tier.commission_value}
                        onChange={(e) =>
                          updateTier(index, "commission_value", parseFloat(e.target.value) || 0)
                        }
                        className="w-24 text-right text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeTier(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5 w-full">
                <Plus className="h-4 w-4" />
                Adicionar Faixa
              </Button>

              {editingTiers.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Resumo:</p>
                  {editingTiers.map((tier, i) => (
                    <p key={i} className="text-xs text-foreground">
                      {tier.commission_value === 0 ? (
                        <span className="text-muted-foreground">
                          {tier.min_percent}% a {tier.max_percent}%: sem comissão
                        </span>
                      ) : (
                        <>
                          {tier.min_percent}% a {tier.max_percent}%:{" "}
                          <span className="font-medium text-primary">
                            {formatCurrency(tier.commission_value)}
                          </span>
                        </>
                      )}
                    </p>
                  ))}
                </div>
              )}

              <Button
                onClick={handleSaveTiers}
                disabled={tiersSaving}
                className="w-full"
              >
                {tiersSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Faixas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bonus Dialog */}
      {renderBonusDialog()}
      {renderExtraDialog()}
    </>
  );
};

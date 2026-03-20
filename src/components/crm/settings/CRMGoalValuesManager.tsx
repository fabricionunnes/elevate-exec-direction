import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Loader2, Save, Calendar, TrendingUp, Target, Users, Plus, Trash2, Settings2 } from "lucide-react";
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
}

interface CommissionTier {
  id?: string;
  goal_value_id?: string;
  min_percent: number;
  max_percent: number;
  commission_value: number;
  sort_order: number;
}

const CRM_ROLES = ["closer", "sdr", "social_setter", "bdr", "head_comercial"];

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
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [goalValues, setGoalValues] = useState<Map<string, GoalValue>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGoalType, setSelectedGoalType] = useState<string>("");

  // Commission tiers dialog
  const [tiersDialogOpen, setTiersDialogOpen] = useState(false);
  const [tiersStaff, setTiersStaff] = useState<StaffMember | null>(null);
  const [editingTiers, setEditingTiers] = useState<CommissionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tiersSaving, setTiersSaving] = useState(false);
  // Cache tiers count per goal_value_id for badge display
  const [tiersCountMap, setTiersCountMap] = useState<Map<string, number>>(new Map());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedGoalType) {
      loadGoalValues();
    }
  }, [selectedMonth, selectedYear, selectedGoalType]);

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

      const { data: staffWithAccess } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      const staffIdsWithCRMAccess = new Set((staffWithAccess || []).map((p) => p.staff_id));

      const { data: staffData, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name");

      if (staffError) throw staffError;

      const filteredStaff = (staffData || []).filter(
        (s) => s.role === "master" || staffIdsWithCRMAccess.has(s.id)
      );
      setStaffMembers(filteredStaff);

      if (typesData && typesData.length > 0) {
        setSelectedGoalType(typesData[0].id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadGoalValues = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_goal_values")
        .select("*")
        .eq("goal_type_id", selectedGoalType)
        .eq("month", selectedMonth)
        .eq("year", selectedYear);

      if (error) throw error;

      const valuesMap = new Map<string, GoalValue>();
      const goalValueIds: string[] = [];
      (data || []).forEach((v: GoalValue) => {
        valuesMap.set(v.staff_id, v);
        if (v.id) goalValueIds.push(v.id);
      });

      staffMembers.forEach((staff) => {
        if (!valuesMap.has(staff.id)) {
          valuesMap.set(staff.id, {
            staff_id: staff.id,
            goal_type_id: selectedGoalType,
            meta_value: 0,
            super_meta_value: null,
            hiper_meta_value: null,
            ote_base: 0,
            ote_variable: 0,
            ote_accelerator: null,
          });
        }
      });

      setGoalValues(valuesMap);

      // Load tiers count for all goal values
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

  const updateValue = (staffId: string, field: keyof GoalValue, value: number | null) => {
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
      const valuesToUpsert = Array.from(goalValues.values())
        .filter(v => v.meta_value > 0 || v.super_meta_value || v.hiper_meta_value || v.ote_base > 0)
        .map((v) => ({
          staff_id: v.staff_id,
          goal_type_id: selectedGoalType,
          month: selectedMonth,
          year: selectedYear,
          meta_value: v.meta_value,
          super_meta_value: v.super_meta_value,
          hiper_meta_value: v.hiper_meta_value,
          ote_base: v.ote_base,
          ote_variable: v.ote_variable,
          ote_accelerator: v.ote_accelerator,
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

  // ---- Commission Tiers Dialog ----

  const openTiersDialog = async (staff: StaffMember) => {
    setTiersStaff(staff);
    setTiersDialogOpen(true);
    setTiersLoading(true);

    const goalValue = goalValues.get(staff.id);

    if (!goalValue?.id) {
      // No saved goal value yet — show default tiers
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
      // First ensure goal value exists
      let goalValue = goalValues.get(tiersStaff.id);

      if (!goalValue?.id) {
        // Create the goal value record first
        const { data: created, error: createErr } = await supabase
          .from("crm_goal_values")
          .upsert({
            staff_id: tiersStaff.id,
            goal_type_id: selectedGoalType,
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

      // Delete existing tiers
      await supabase
        .from("crm_goal_commission_tiers")
        .delete()
        .eq("goal_value_id", goalValueId);

      // Insert new tiers
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

  const selectedGoalTypeData = goalTypes.find(g => g.id === selectedGoalType);

  const getInputPrefix = (unitType: string) => {
    if (unitType === "currency") return "R$";
    if (unitType === "percentage") return "%";
    return null;
  };

  const filteredStaff = staffMembers.filter(staff => {
    if (!selectedGoalTypeData?.category) return true;
    if (selectedGoalTypeData.category === "closer") {
      return ["closer", "head_comercial"].includes(staff.role);
    }
    if (selectedGoalTypeData.category === "sdr") {
      return ["sdr", "social_setter", "bdr"].includes(staff.role);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Definir Metas Mensais
              </CardTitle>
              <CardDescription>
                Atribua valores de metas e faixas de comissão para cada colaborador
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saving || !selectedGoalType}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Metas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedGoalType} onValueChange={setSelectedGoalType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de meta" />
                </SelectTrigger>
                <SelectContent>
                  {goalTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {/* Goal Values Table */}
          {selectedGoalType && selectedGoalTypeData && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    {selectedGoalTypeData.has_super_meta && (
                      <TableHead className="text-right">Super Meta</TableHead>
                    )}
                    {selectedGoalTypeData.has_hiper_meta && (
                      <TableHead className="text-right">Hiper Meta</TableHead>
                    )}
                    {selectedGoalTypeData.has_ote && (
                      <>
                        <TableHead className="text-right">Fixo (R$)</TableHead>
                        <TableHead className="text-center">Comissão</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((staff) => {
                    const value = goalValues.get(staff.id);
                    const prefix = getInputPrefix(selectedGoalTypeData.unit_type);
                    const tiersCount = value?.id ? (tiersCountMap.get(value.id) || 0) : 0;

                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">{staff.name}</TableCell>
                        <TableCell>{getRoleBadge(staff.role)}</TableCell>
                        <TableCell>
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
                        </TableCell>
                        {selectedGoalTypeData.has_super_meta && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {prefix && (
                                <span className="text-muted-foreground text-sm">{prefix}</span>
                              )}
                              <Input
                                type="number"
                                value={value?.super_meta_value || 0}
                                onChange={(e) =>
                                  updateValue(staff.id, "super_meta_value", parseFloat(e.target.value) || 0)
                                }
                                className="w-24 text-right"
                              />
                            </div>
                          </TableCell>
                        )}
                        {selectedGoalTypeData.has_hiper_meta && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {prefix && (
                                <span className="text-muted-foreground text-sm">{prefix}</span>
                              )}
                              <Input
                                type="number"
                                value={value?.hiper_meta_value || 0}
                                onChange={(e) =>
                                  updateValue(staff.id, "hiper_meta_value", parseFloat(e.target.value) || 0)
                                }
                                className="w-24 text-right"
                              />
                            </div>
                          </TableCell>
                        )}
                        {selectedGoalTypeData.has_ote && (
                          <>
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
                              <div className="flex items-center justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTiersDialog(staff)}
                                  className="gap-1.5"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                  Faixas
                                  {tiersCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                                      {tiersCount}
                                    </Badge>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador encontrado para esta categoria de meta</p>
            </div>
          )}

          {goalTypes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum tipo de meta cadastrado. Crie tipos de meta primeiro.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Tiers Dialog */}
      <Dialog open={tiersDialogOpen} onOpenChange={setTiersDialogOpen}>
        <DialogContent className="max-w-lg">
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
                Configure as faixas de atingimento e o valor de comissão para cada faixa. Você pode adicionar, remover ou alterar a qualquer momento.
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

              {/* Preview */}
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
    </>
  );
};

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
import { Loader2, Save, Calendar, TrendingUp, Target, Users } from "lucide-react";
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

export const CRMGoalValuesManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [goalValues, setGoalValues] = useState<Map<string, GoalValue>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGoalType, setSelectedGoalType] = useState<string>("");

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
      // Load goal types
      const { data: typesData, error: typesError } = await supabase
        .from("crm_goal_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (typesError) throw typesError;
      setGoalTypes(typesData || []);

      // Load staff with CRM access
      const { data: staffWithAccess } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      const staffIdsWithCRMAccess = new Set((staffWithAccess || []).map((p) => p.staff_id));

      // Load all active staff members
      const { data: staffData, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name");

      if (staffError) throw staffError;

      // Filter to only show staff with CRM access (master always has access, others need permission)
      const filteredStaff = (staffData || []).filter(
        (s) => s.role === "master" || staffIdsWithCRMAccess.has(s.id)
      );
      setStaffMembers(filteredStaff);

      // Auto-select first goal type
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
      (data || []).forEach((v: GoalValue) => {
        valuesMap.set(v.staff_id, v);
      });

      // Initialize empty values for staff without goals
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
        .filter(v => v.meta_value > 0 || v.super_meta_value || v.hiper_meta_value || v.ote_base > 0 || v.ote_variable > 0)
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

  const selectedGoalTypeData = goalTypes.find(g => g.id === selectedGoalType);

  const formatValue = (value: number, unitType: string) => {
    if (unitType === "currency") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(value);
    }
    if (unitType === "percentage") {
      return `${value}%`;
    }
    return value.toString();
  };

  const getInputPrefix = (unitType: string) => {
    if (unitType === "currency") return "R$";
    if (unitType === "percentage") return "%";
    return null;
  };

  // Filter staff by category
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Definir Metas Mensais
            </CardTitle>
            <CardDescription>
              Atribua valores de metas para cada colaborador por mês
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
                    <TableHead className="text-right">OTE Base</TableHead>
                    <TableHead className="text-right">OTE Variável</TableHead>
                    <TableHead className="text-right">Acelerador</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((staff) => {
                const value = goalValues.get(staff.id);
                const prefix = getInputPrefix(selectedGoalTypeData.unit_type);
                
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
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground text-sm">R$</span>
                            <Input
                              type="number"
                              value={value?.ote_variable || 0}
                              onChange={(e) =>
                                updateValue(staff.id, "ote_variable", parseFloat(e.target.value) || 0)
                              }
                              className="w-24 text-right"
                              placeholder="Variável"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.1"
                              value={value?.ote_accelerator || ""}
                              onChange={(e) =>
                                updateValue(staff.id, "ote_accelerator", e.target.value ? parseFloat(e.target.value) : null)
                              }
                              className="w-20 text-right"
                              placeholder="1.5x"
                            />
                            <span className="text-muted-foreground text-sm">x</span>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
  );
};

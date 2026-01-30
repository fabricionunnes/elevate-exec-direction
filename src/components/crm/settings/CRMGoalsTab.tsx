import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Save, Target, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface StaffGoal {
  id?: string;
  staff_id: string;
  month: number;
  year: number;
  meta_vendas: number;
  super_meta_vendas: number;
  hiper_meta_vendas: number;
  meta_agendamentos: number;
  super_meta_agendamentos: number;
  hiper_meta_agendamentos: number;
  meta_reunioes: number;
  super_meta_reunioes: number;
  hiper_meta_reunioes: number;
}

const CRM_ROLES = ["closer", "sdr", "social_setter", "bdr", "head_comercial"];
const SALES_ROLES = ["closer", "head_comercial"];
const PRE_SALES_ROLES = ["sdr", "social_setter", "bdr"];

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

export const CRMGoalsTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [goals, setGoals] = useState<Map<string, StaffGoal>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff members with CRM roles that have CRM access
      const { data: staffWithAccess, error: accessError } = await supabase
        .from("staff_menu_permissions")
        .select("staff_id")
        .eq("menu_key", "crm");

      if (accessError) throw accessError;

      const staffIdsWithAccess = (staffWithAccess || []).map((p) => p.staff_id);

      // Load staff members with CRM roles
      const { data: staffData, error: staffError } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, email")
        .eq("is_active", true)
        .in("role", CRM_ROLES)
        .order("name");

      if (staffError) throw staffError;

      // Filter only staff with CRM access (or master/admin roles which have automatic access)
      const filteredStaff = (staffData || []).filter(
        (s) => staffIdsWithAccess.includes(s.id) || s.role === "master" || s.role === "admin"
      );

      setStaffMembers(filteredStaff);

      // Load goals for selected month/year
      const { data: goalsData, error: goalsError } = await supabase
        .from("crm_staff_goals")
        .select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear);

      if (goalsError) throw goalsError;

      // Create a map of staff_id -> goal
      const goalsMap = new Map<string, StaffGoal>();
      (goalsData || []).forEach((goal: StaffGoal) => {
        goalsMap.set(goal.staff_id, goal);
      });

      // Initialize goals for staff members that don't have one yet
      (staffData || []).forEach((staff) => {
        if (!goalsMap.has(staff.id)) {
          goalsMap.set(staff.id, {
            staff_id: staff.id,
            month: selectedMonth,
            year: selectedYear,
            meta_vendas: 0,
            super_meta_vendas: 0,
            hiper_meta_vendas: 0,
            meta_agendamentos: 0,
            super_meta_agendamentos: 0,
            hiper_meta_agendamentos: 0,
            meta_reunioes: 0,
            super_meta_reunioes: 0,
            hiper_meta_reunioes: 0,
          });
        }
      });

      setGoals(goalsMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const updateGoal = (staffId: string, field: keyof StaffGoal, value: number) => {
    setGoals((prev) => {
      const newMap = new Map(prev);
      const goal = newMap.get(staffId);
      if (goal) {
        newMap.set(staffId, { ...goal, [field]: value });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goalsToUpsert = Array.from(goals.values()).map((goal) => ({
        staff_id: goal.staff_id,
        month: selectedMonth,
        year: selectedYear,
        meta_vendas: goal.meta_vendas,
        super_meta_vendas: goal.super_meta_vendas,
        hiper_meta_vendas: goal.hiper_meta_vendas,
        meta_agendamentos: goal.meta_agendamentos,
        super_meta_agendamentos: goal.super_meta_agendamentos,
        hiper_meta_agendamentos: goal.hiper_meta_agendamentos,
        meta_reunioes: goal.meta_reunioes,
        super_meta_reunioes: goal.super_meta_reunioes,
        hiper_meta_reunioes: goal.hiper_meta_reunioes,
      }));

      const { error } = await supabase
        .from("crm_staff_goals")
        .upsert(goalsToUpsert, {
          onConflict: "staff_id,month,year",
        });

      if (error) throw error;
      toast.success("Metas salvas com sucesso!");
      loadData();
    } catch (error: any) {
      console.error("Error saving goals:", error);
      toast.error(error.message || "Erro ao salvar metas");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const salesStaff = staffMembers.filter((s) => SALES_ROLES.includes(s.role));
  const preSalesStaff = staffMembers.filter((s) => PRE_SALES_ROLES.includes(s.role));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Metas
        </Button>
      </div>

      {/* Sales Goals (Closers) */}
      {salesStaff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Metas de Vendas (Closers)
            </CardTitle>
            <CardDescription>
              Defina as metas de vendas para cada closer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Super Meta</TableHead>
                  <TableHead className="text-right">Hiper Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesStaff.map((staff) => {
                  const goal = goals.get(staff.id);
                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>{getRoleBadge(staff.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            value={goal?.meta_vendas || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "meta_vendas", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-right"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            value={goal?.super_meta_vendas || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "super_meta_vendas", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-right"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            value={goal?.hiper_meta_vendas || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "hiper_meta_vendas", parseFloat(e.target.value) || 0)
                            }
                            className="w-28 text-right"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pre-Sales Goals (SDR / Social Setter / BDR) */}
      {preSalesStaff.length > 0 && (
        <>
          {/* Scheduling Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Metas de Agendamentos (SDR / Social Setter / BDR)
              </CardTitle>
              <CardDescription>
                Defina as metas de agendamentos para a equipe de pré-vendas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Super Meta</TableHead>
                    <TableHead className="text-right">Hiper Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preSalesStaff.map((staff) => {
                    const goal = goals.get(staff.id);
                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">{staff.name}</TableCell>
                        <TableCell>{getRoleBadge(staff.role)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.meta_agendamentos || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "meta_agendamentos", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.super_meta_agendamentos || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "super_meta_agendamentos", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.hiper_meta_agendamentos || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "hiper_meta_agendamentos", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Meeting Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Metas de Reuniões Realizadas (SDR / Social Setter / BDR)
              </CardTitle>
              <CardDescription>
                Defina as metas de reuniões que devem ser efetivamente realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Super Meta</TableHead>
                    <TableHead className="text-right">Hiper Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preSalesStaff.map((staff) => {
                    const goal = goals.get(staff.id);
                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">{staff.name}</TableCell>
                        <TableCell>{getRoleBadge(staff.role)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.meta_reunioes || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "meta_reunioes", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.super_meta_reunioes || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "super_meta_reunioes", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={goal?.hiper_meta_reunioes || 0}
                            onChange={(e) =>
                              updateGoal(staff.id, "hiper_meta_reunioes", parseInt(e.target.value) || 0)
                            }
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {staffMembers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum colaborador com cargo comercial encontrado.
            <br />
            Adicione colaboradores com cargos: Closer, SDR, Social Setter, BDR ou Head Comercial.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

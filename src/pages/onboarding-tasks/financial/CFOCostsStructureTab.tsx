import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Users, DollarSign, TrendingUp, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  payables: any[];
  categories: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function CFOCostsStructureTab({ invoices, payables, categories, filters, formatCurrency, formatCurrencyCents }: Props) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [empDialog, setEmpDialog] = useState<{ open: boolean; emp: any | null }>({ open: false, emp: null });
  const [empForm, setEmpForm] = useState({ name: "", role: "", department: "", salary: 0, benefits: 0 });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    supabase.from("financial_employees").select("*").eq("is_active", true).order("name")
      .then(({ data }) => setEmployees(data || []));
  }, []);

  // Costs breakdown
  const costs = useMemo(() => {
    const monthPayables = payables.filter(p => (p.due_date?.startsWith(monthStr) || p.reference_month === monthStr) && p.status === "paid");

    // Map category_id to category with cost_type
    const catMap = new Map(categories.map(c => [c.id, c]));

    let fixedCosts = 0;
    let variableCosts = 0;
    const byCategory: Record<string, { name: string; total: number; type: string }> = {};

    monthPayables.forEach((p: any) => {
      const amount = (p.paid_amount || p.amount || 0) * 100;
      const cat = catMap.get(p.category_id);
      const costType = cat?.cost_type || "variable";

      if (costType === "fixed") fixedCosts += amount;
      else variableCosts += amount;

      const catName = cat?.name || "Sem categoria";
      if (!byCategory[catName]) byCategory[catName] = { name: catName, total: 0, type: costType };
      byCategory[catName].total += amount;
    });

    // Payroll from employees
    const payroll = employees.reduce((s, e) => s + (e.salary_cents || 0) + (e.benefits_cents || 0), 0);
    fixedCosts += payroll;

    // Revenue
    const receitaMes = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);

    const totalCosts = fixedCosts + variableCosts;
    const folhaPercent = receitaMes > 0 ? (payroll / receitaMes) * 100 : 0;
    const receitaPorColab = employees.length > 0 ? receitaMes / employees.length : 0;
    const ebitda = receitaMes - totalCosts;
    const ebitdaPorColab = employees.length > 0 ? ebitda / employees.length : 0;
    const pontoEquilibrio = receitaMes > 0 && variableCosts < receitaMes 
      ? fixedCosts / (1 - variableCosts / receitaMes) 
      : 0;

    return {
      fixedCosts, variableCosts, totalCosts, payroll, receitaMes,
      folhaPercent, receitaPorColab, ebitdaPorColab, pontoEquilibrio, ebitda,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total)
    };
  }, [payables, invoices, categories, employees, monthStr]);

  const pieData = [
    { name: "Custos Fixos", value: costs.fixedCosts / 100, color: "hsl(221, 83%, 53%)" },
    { name: "Custos Variáveis", value: costs.variableCosts / 100, color: "hsl(38, 92%, 50%)" },
  ].filter(d => d.value > 0);

  const handleSaveEmployee = async () => {
    setSaving(true);
    try {
      const data = {
        name: empForm.name, role: empForm.role, department: empForm.department,
        salary_cents: Math.round(empForm.salary * 100), benefits_cents: Math.round(empForm.benefits * 100)
      };
      if (empDialog.emp) {
        await supabase.from("financial_employees").update(data as any).eq("id", empDialog.emp.id);
      } else {
        await supabase.from("financial_employees").insert(data as any);
      }
      const { data: updated } = await supabase.from("financial_employees").select("*").eq("is_active", true).order("name");
      setEmployees(updated || []);
      setEmpDialog({ open: false, emp: null });
      toast.success("Colaborador salvo");
    } catch (e) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Custos & Estrutura</h2>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Custos Fixos</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrencyCents(costs.fixedCosts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Custos Variáveis</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrencyCents(costs.variableCosts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">% Folha/Receita</p>
            <p className={`text-xl font-bold ${costs.folhaPercent > 50 ? "text-destructive" : "text-emerald-600"}`}>
              {costs.folhaPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Receita/Colaborador</p>
            <p className="text-xl font-bold">{formatCurrencyCents(costs.receitaPorColab)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Ponto de Equilíbrio</p>
            <p className="text-xl font-bold text-violet-600">{formatCurrencyCents(costs.pontoEquilibrio)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Composição dos Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {costs.byCategory.length > 0 ? (
              <div className="space-y-3">
                {costs.byCategory.slice(0, 8).map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{cat.type === "fixed" ? "Fixo" : "Var."}</Badge>
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <span className="text-sm font-medium">{formatCurrencyCents(cat.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employees */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Colaboradores ({employees.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => {
            setEmpForm({ name: "", role: "", department: "", salary: 0, benefits: 0 });
            setEmpDialog({ open: true, emp: null });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </CardHeader>
        <CardContent>
          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Cargo</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Depto</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Salário</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Benefícios</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp: any) => (
                    <tr key={emp.id} className="border-b last:border-0">
                      <td className="p-2 font-medium">{emp.name}</td>
                      <td className="p-2">{emp.role || "—"}</td>
                      <td className="p-2">{emp.department || "—"}</td>
                      <td className="p-2 text-right">{formatCurrencyCents(emp.salary_cents || 0)}</td>
                      <td className="p-2 text-right">{formatCurrencyCents(emp.benefits_cents || 0)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrencyCents((emp.salary_cents || 0) + (emp.benefits_cents || 0))}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setEmpForm({
                            name: emp.name, role: emp.role || "", department: emp.department || "",
                            salary: (emp.salary_cents || 0) / 100, benefits: (emp.benefits_cents || 0) / 100
                          });
                          setEmpDialog({ open: true, emp });
                        }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
              Nenhum colaborador cadastrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Dialog */}
      <Dialog open={empDialog.open} onOpenChange={(open) => setEmpDialog({ open, emp: empDialog.emp })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{empDialog.emp ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={empForm.name} onChange={(e) => setEmpForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo</Label>
                <Input value={empForm.role} onChange={(e) => setEmpForm(p => ({ ...p, role: e.target.value }))} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={empForm.department} onChange={(e) => setEmpForm(p => ({ ...p, department: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Salário (R$)</Label>
                <CurrencyInput value={empForm.salary} onChange={(v) => setEmpForm(p => ({ ...p, salary: v }))} />
              </div>
              <div>
                <Label>Benefícios (R$)</Label>
                <CurrencyInput value={empForm.benefits} onChange={(v) => setEmpForm(p => ({ ...p, benefits: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialog({ open: false, emp: null })}>Cancelar</Button>
            <Button onClick={handleSaveEmployee} disabled={saving || !empForm.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

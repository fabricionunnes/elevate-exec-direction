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

const summaryStyles = [
  { bg: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/10" },
  { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", text: "text-amber-400", glow: "shadow-amber-500/10" },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
  { bg: "from-cyan-500/20 via-cyan-500/5 to-transparent", border: "border-cyan-500/20", text: "text-cyan-400", glow: "shadow-cyan-500/10" },
  { bg: "from-violet-500/20 via-violet-500/5 to-transparent", border: "border-violet-500/20", text: "text-violet-400", glow: "shadow-violet-500/10" },
];

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
      // Prioritize payable-level cost_type, then fall back to category-level
      const costType = p.cost_type || cat?.cost_type || "variable";

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

  const summaryCards = [
    { label: "Custos Fixos", value: formatCurrencyCents(costs.fixedCosts) },
    { label: "Custos Variáveis", value: formatCurrencyCents(costs.variableCosts) },
    { label: "% Folha/Receita", value: `${costs.folhaPercent.toFixed(1)}%` },
    { label: "Receita/Colaborador", value: formatCurrencyCents(costs.receitaPorColab) },
    { label: "Ponto de Equilíbrio", value: formatCurrencyCents(costs.pontoEquilibrio) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Custos & Estrutura
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Composição e eficiência operacional</p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card, idx) => {
          const s = summaryStyles[idx];
          return (
            <Card key={idx} className={`relative overflow-hidden border ${s.border} bg-gradient-to-br ${s.bg} backdrop-blur-xl shadow-lg ${s.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.text}`}>{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              Composição dos Custos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card className="border-amber-500/10 bg-gradient-to-br from-amber-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              Top Custos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costs.byCategory.length > 0 ? (
              <div className="space-y-3">
                {costs.byCategory.slice(0, 8).map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${cat.type === "fixed" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                        {cat.type === "fixed" ? "Fixo" : "Var."}
                      </Badge>
                      <span className="text-sm">{cat.name}</span>
                    </div>
                    <span className="text-sm font-bold">{formatCurrencyCents(cat.total)}</span>
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
      <Card className="border-indigo-500/10 bg-gradient-to-br from-indigo-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-indigo-500/5">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <Users className="h-4 w-4 text-indigo-400" /> Colaboradores ({employees.length})
          </CardTitle>
          <Button size="sm" variant="outline" className="border-indigo-500/30 hover:bg-indigo-500/10" onClick={() => {
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
                  <tr className="border-b border-white/5">
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
                    <tr key={emp.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="p-2 font-medium">{emp.name}</td>
                      <td className="p-2 text-muted-foreground">{emp.role || "—"}</td>
                      <td className="p-2 text-muted-foreground">{emp.department || "—"}</td>
                      <td className="p-2 text-right">{formatCurrencyCents(emp.salary_cents || 0)}</td>
                      <td className="p-2 text-right">{formatCurrencyCents(emp.benefits_cents || 0)}</td>
                      <td className="p-2 text-right font-bold text-indigo-400">{formatCurrencyCents((emp.salary_cents || 0) + (emp.benefits_cents || 0))}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-indigo-500/10" onClick={() => {
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

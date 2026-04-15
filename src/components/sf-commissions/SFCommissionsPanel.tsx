import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Settings2, Trash2, TrendingUp, DollarSign, Target, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  companyId: string;
}

interface CommissionConfig {
  id: string;
  project_id: string;
  salesperson_id: string;
  role: "sdr" | "closer";
  base_salary: number;
  client_pays_amount: number;
  notes: string | null;
  is_active: boolean;
  tiers: CommissionTier[];
}

interface CommissionTier {
  id: string;
  config_id: string;
  min_percent: number;
  max_percent: number | null;
  commission_type: "fixed" | "percent";
  commission_value: number;
  label: string | null;
  sort_order: number;
}

interface Salesperson {
  id: string;
  name: string;
}

interface KpiData {
  salesperson_id: string;
  total_value: number;
  target_value: number;
  achievement_percent: number;
}

export function SFCommissionsPanel({ projectId, companyId }: Props) {
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CommissionConfig | null>(null);

  // Month navigation
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const monthYear = useMemo(() => {
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    return `${y}-${String(m).padStart(2, "0")}`;
  }, [selectedDate]);

  const monthLabel = useMemo(() => {
    return selectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [selectedDate]);

  const navigateMonth = (dir: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  // Form state
  const [form, setForm] = useState({
    salesperson_id: "",
    role: "closer" as "sdr" | "closer",
    base_salary: "",
    client_pays_amount: "",
    notes: "",
  });
  const [tiers, setTiers] = useState<Omit<CommissionTier, "id" | "config_id">[]>([]);

  const fetchAll = useCallback(async () => {
    if (!projectId || !companyId) return;

    // Fetch salespeople, configs, and KPI data in parallel
    const [spRes, configRes] = await Promise.all([
      supabase.from("onboarding_users").select("salesperson_id, name").eq("project_id", projectId).not("salesperson_id", "is", null).then((r) => r),
      supabase
        .from("sf_commission_configs")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true),
    ]);

    // Fallback: try kpi_salespeople directly
    let spList: Salesperson[] = [];
    if (spRes && spRes.data) {
      spList = (spRes.data as any[]).map((s: any) => ({ id: s.id, name: s.name }));
    } else {
      // Direct query for salespeople linked to company KPIs
      const { data: kpiSp } = await supabase
        .from("kpi_salespeople")
        .select("salesperson_id, kpi:company_kpis!inner(company_id)")
        .eq("kpi.company_id", companyId);
      
      if (kpiSp && kpiSp.length > 0) {
        const spIds = [...new Set(kpiSp.map((k: any) => k.salesperson_id))];
        // We need names - get from onboarding_users with salesperson_id
        const { data: usersData } = await supabase
          .from("onboarding_users")
          .select("salesperson_id, name")
          .eq("project_id", projectId)
          .in("salesperson_id", spIds);
        
        if (usersData) {
          spList = usersData.filter((u: any) => u.salesperson_id).map((u: any) => ({
            id: u.salesperson_id,
            name: u.name,
          }));
        }
      }
    }

    setSalespeople(spList);

    // Fetch configs with tiers
    const configsData = (configRes.data as any[]) || [];
    const configIds = configsData.map((c: any) => c.id);
    
    let allTiers: any[] = [];
    if (configIds.length > 0) {
      const { data: tiersData } = await supabase
        .from("sf_commission_tiers")
        .select("*")
        .in("config_id", configIds)
        .order("sort_order");
      allTiers = tiersData || [];
    }

    const mergedConfigs: CommissionConfig[] = configsData.map((c: any) => ({
      ...c,
      tiers: allTiers.filter((t: any) => t.config_id === c.id),
    }));
    setConfigs(mergedConfigs);

    // Fetch KPI data for the selected month
    await fetchKpiData(spList, companyId);

    setLoading(false);
  }, [projectId, companyId]);

  const fetchKpiData = useCallback(async (spList: Salesperson[], cId: string) => {
    if (!cId) return;

    const [year, month] = monthYear.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Get main goal KPIs for this company
    const { data: mainKpis } = await supabase
      .from("company_kpis")
      .select("id, target_value, periodicity, name")
      .eq("company_id", cId)
      .eq("is_main_goal", true)
      .eq("is_active", true);

    if (!mainKpis || mainKpis.length === 0) {
      setKpiData([]);
      return;
    }

    const kpiIds = mainKpis.map((k: any) => k.id);

    // Get monthly targets for overrides
    const { data: monthlyTargets } = await supabase
      .from("kpi_monthly_targets")
      .select("*")
      .in("kpi_id", kpiIds)
      .eq("company_id", cId)
      .eq("month_year", monthYear);

    // Get entries for the month
    const { data: entries } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("company_id", cId)
      .in("kpi_id", kpiIds)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate);

    // Calculate per salesperson
    const result: KpiData[] = [];
    for (const sp of spList) {
      let totalValue = 0;
      let totalTarget = 0;

      for (const kpi of mainKpis) {
        // Resolve target: monthly override > default
        const override = monthlyTargets?.find(
          (mt: any) => mt.kpi_id === kpi.id && mt.salesperson_id === sp.id
        );
        const target = override ? Number(override.target_value) : Number(kpi.target_value);
        totalTarget += target;

        // Sum entries for this salesperson + kpi
        const spEntries = entries?.filter(
          (e: any) => e.kpi_id === kpi.id && e.salesperson_id === sp.id
        ) || [];
        totalValue += spEntries.reduce((sum: number, e: any) => sum + Number(e.value), 0);
      }

      result.push({
        salesperson_id: sp.id,
        total_value: totalValue,
        target_value: totalTarget,
        achievement_percent: totalTarget > 0 ? (totalValue / totalTarget) * 100 : 0,
      });
    }

    setKpiData(result);
  }, [monthYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refetch KPI data when month changes
  useEffect(() => {
    if (salespeople.length > 0 && companyId) {
      fetchKpiData(salespeople, companyId);
    }
  }, [monthYear, salespeople, companyId, fetchKpiData]);

  const resetForm = () => {
    setForm({ salesperson_id: "", role: "closer", base_salary: "", client_pays_amount: "", notes: "" });
    setTiers([]);
    setEditingConfig(null);
  };

  const openNewConfig = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditConfig = (config: CommissionConfig) => {
    setEditingConfig(config);
    setForm({
      salesperson_id: config.salesperson_id,
      role: config.role,
      base_salary: String(config.base_salary),
      client_pays_amount: String(config.client_pays_amount),
      notes: config.notes || "",
    });
    setTiers(config.tiers.map((t) => ({
      min_percent: t.min_percent,
      max_percent: t.max_percent,
      commission_type: t.commission_type,
      commission_value: t.commission_value,
      label: t.label,
      sort_order: t.sort_order,
    })));
    setDialogOpen(true);
  };

  const addTier = () => {
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max_percent || 0) : 0;
    setTiers([...tiers, {
      min_percent: lastMax,
      max_percent: null,
      commission_type: "fixed",
      commission_value: 0,
      label: "",
      sort_order: tiers.length,
    }]);
  };

  const removeTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: string, value: any) => {
    setTiers(tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    if (!form.salesperson_id) { toast.error("Selecione um vendedor"); return; }
    if (tiers.length === 0) { toast.error("Adicione ao menos uma faixa de comissão"); return; }

    try {
      if (editingConfig) {
        // Update config
        const { error } = await supabase
          .from("sf_commission_configs")
          .update({
            role: form.role,
            base_salary: parseFloat(form.base_salary) || 0,
            client_pays_amount: parseFloat(form.client_pays_amount) || 0,
            notes: form.notes || null,
          })
          .eq("id", editingConfig.id);
        if (error) throw error;

        // Delete old tiers and insert new
        await supabase.from("sf_commission_tiers").delete().eq("config_id", editingConfig.id);
        const { error: tierError } = await supabase.from("sf_commission_tiers").insert(
          tiers.map((t, i) => ({ ...t, config_id: editingConfig.id, sort_order: i }))
        );
        if (tierError) throw tierError;

        toast.success("Configuração atualizada");
      } else {
        // Check if config already exists for this salesperson
        const existing = configs.find((c) => c.salesperson_id === form.salesperson_id);
        if (existing) { toast.error("Já existe uma configuração para este vendedor"); return; }

        // Insert config
        const { data: newConfig, error } = await supabase
          .from("sf_commission_configs")
          .insert({
            project_id: projectId,
            salesperson_id: form.salesperson_id,
            role: form.role,
            base_salary: parseFloat(form.base_salary) || 0,
            client_pays_amount: parseFloat(form.client_pays_amount) || 0,
            notes: form.notes || null,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Insert tiers
        const { error: tierError } = await supabase.from("sf_commission_tiers").insert(
          tiers.map((t, i) => ({ ...t, config_id: newConfig.id, sort_order: i }))
        );
        if (tierError) throw tierError;

        toast.success("Configuração criada");
      }

      setDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta configuração?")) return;
    await supabase.from("sf_commission_configs").update({ is_active: false }).eq("id", configId);
    toast.success("Configuração removida");
    fetchAll();
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getCommissionForAchievement = (config: CommissionConfig, percent: number): number => {
    const sortedTiers = [...config.tiers].sort((a, b) => a.sort_order - b.sort_order);
    for (const tier of sortedTiers) {
      const min = tier.min_percent;
      const max = tier.max_percent;
      if (percent >= min && (max === null || percent < max)) {
        if (tier.commission_type === "fixed") return tier.commission_value;
        // percent of what? of base_salary + client_pays
        return (tier.commission_value / 100) * config.base_salary;
      }
    }
    return 0;
  };

  // Available salespeople (not yet configured)
  const availableSalespeople = salespeople.filter(
    (sp) => !configs.some((c) => c.salesperson_id === sp.id) || editingConfig?.salesperson_id === sp.id
  );

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Comissões Sales Force
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure faixas de comissão por vendedor e acompanhe os valores automaticamente.
          </p>
        </div>
        <Button onClick={openNewConfig} size="sm" disabled={availableSalespeople.length === 0 && !editingConfig}>
          <Plus className="h-4 w-4 mr-1" />
          Configurar Vendedor
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[160px] text-center">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      {configs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{configs.length}</p>
              <p className="text-xs text-muted-foreground">Vendedores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold">
                {formatCurrency(configs.reduce((sum, c) => sum + c.client_pays_amount, 0))}
              </p>
              <p className="text-xs text-muted-foreground">Cliente paga (total)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold">
                {formatCurrency(configs.reduce((sum, c) => sum + c.base_salary, 0))}
              </p>
              <p className="text-xs text-muted-foreground">Salários base (total)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">
                {formatCurrency(
                  configs.reduce((sum, c) => {
                    const kpi = kpiData.find((k) => k.salesperson_id === c.salesperson_id);
                    const commission = kpi ? getCommissionForAchievement(c, kpi.achievement_percent) : 0;
                    return sum + c.base_salary + commission;
                  }, 0)
                )}
              </p>
              <p className="text-xs text-muted-foreground">Total a pagar (mês)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Salesperson cards */}
      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum vendedor configurado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Configurar Vendedor" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const sp = salespeople.find((s) => s.id === config.salesperson_id);
            const kpi = kpiData.find((k) => k.salesperson_id === config.salesperson_id);
            const achievement = kpi?.achievement_percent || 0;
            const commission = kpi ? getCommissionForAchievement(config, achievement) : 0;
            const totalPayable = config.base_salary + commission;

            return (
              <Card key={config.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {(sp?.name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-sm">{sp?.name || "Vendedor"}</CardTitle>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {config.role === "sdr" ? "SDR" : "Closer"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditConfig(config)}>
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(config.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* KPI Achievement */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" /> Meta atingida
                    </span>
                    <span className={`font-bold ${achievement >= 100 ? "text-green-500" : achievement >= 80 ? "text-yellow-500" : "text-red-500"}`}>
                      {achievement.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${achievement >= 100 ? "bg-green-500" : achievement >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(achievement, 100)}%` }}
                    />
                  </div>

                  {kpi && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Realizado: {formatCurrency(kpi.total_value)}</span>
                      <span>Meta: {formatCurrency(kpi.target_value)}</span>
                    </div>
                  )}

                  <Separator />

                  {/* Financial breakdown */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente paga à UNV</span>
                      <span className="font-medium text-green-600">{formatCurrency(config.client_pays_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Salário base</span>
                      <span className="font-medium">{formatCurrency(config.base_salary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comissão (faixa atual)</span>
                      <span className="font-medium text-primary">{formatCurrency(commission)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total a pagar ao vendedor</span>
                      <span className="text-orange-500">{formatCurrency(totalPayable)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Margem UNV</span>
                      <span className={`font-medium ${config.client_pays_amount - totalPayable >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatCurrency(config.client_pays_amount - totalPayable)}
                      </span>
                    </div>
                  </div>

                  {/* Tiers preview */}
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Faixas de comissão:</p>
                    <div className="space-y-1">
                      {config.tiers.sort((a, b) => a.sort_order - b.sort_order).map((tier, i) => {
                        const isActive = kpi && achievement >= tier.min_percent && (tier.max_percent === null || achievement < tier.max_percent);
                        return (
                          <div
                            key={tier.id}
                            className={`flex justify-between text-xs px-2 py-1 rounded ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
                          >
                            <span>
                              {tier.label || `Faixa ${i + 1}`}: {tier.min_percent}%
                              {tier.max_percent != null ? ` - ${tier.max_percent}%` : "+"}
                            </span>
                            <span>
                              {tier.commission_type === "fixed"
                                ? formatCurrency(tier.commission_value)
                                : `${tier.commission_value}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Editar Comissão" : "Configurar Comissão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Salesperson */}
            <div>
              <Label>Vendedor *</Label>
              <Select
                value={form.salesperson_id}
                onValueChange={(v) => setForm((f) => ({ ...f, salesperson_id: v }))}
                disabled={!!editingConfig}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(editingConfig ? salespeople : availableSalespeople).map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div>
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Financial */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Salário Base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.base_salary}
                  onChange={(e) => setForm((f) => ({ ...f, base_salary: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Cliente paga à UNV (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.client_pays_amount}
                  onChange={(e) => setForm((f) => ({ ...f, client_pays_amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas sobre esta comissão..."
              />
            </div>

            <Separator />

            {/* Commission Tiers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Faixas de Comissão</Label>
                <Button variant="outline" size="sm" onClick={addTier}>
                  <Plus className="h-3 w-3 mr-1" /> Faixa
                </Button>
              </div>

              {tiers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Adicione faixas de comissão baseadas no % de meta atingida
                </p>
              )}

              <div className="space-y-3">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Faixa {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTier(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">De (%)</Label>
                        <Input
                          type="number"
                          value={tier.min_percent}
                          onChange={(e) => updateTier(idx, "min_percent", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Até (%) <span className="text-muted-foreground">vazio = ∞</span></Label>
                        <Input
                          type="number"
                          value={tier.max_percent ?? ""}
                          onChange={(e) => updateTier(idx, "max_percent", e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-8 text-sm"
                          placeholder="∞"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={tier.commission_type}
                          onValueChange={(v) => updateTier(idx, "commission_type", v)}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                            <SelectItem value="percent">% do salário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={tier.commission_value}
                          onChange={(e) => updateTier(idx, "commission_value", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Rótulo (opcional)</Label>
                      <Input
                        value={tier.label || ""}
                        onChange={(e) => updateTier(idx, "label", e.target.value || null)}
                        className="h-8 text-sm"
                        placeholder="Ex: Meta batida, Super meta..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              {editingConfig ? "Salvar Alterações" : "Criar Configuração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

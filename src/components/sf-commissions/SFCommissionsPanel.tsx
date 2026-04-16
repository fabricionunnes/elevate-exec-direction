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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Settings2, Trash2, TrendingUp, DollarSign, Target, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  companyId: string;
  viewerRole?: string | null;
}

interface TierData {
  id: string;
  config_id: string;
  min_percent: number;
  max_percent: number | null;
  commission_type: "fixed" | "percent";
  commission_value: number;
  label: string | null;
  sort_order: number;
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
  vendorTiers: TierData[];
  clientTiers: TierData[];
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

type TierFormData = Omit<TierData, "id" | "config_id">;

export function SFCommissionsPanel({ projectId, companyId, viewerRole }: Props) {
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CommissionConfig | null>(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");

  const isAdminOrMaster = viewerRole === "admin" || viewerRole === "master" || viewerRole === "client";
  const canViewClientAmounts = isAdminOrMaster;
  const canViewBaseSalary = isAdminOrMaster;
  const canManageConfigs = isAdminOrMaster;

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
    notes: "",
  });
  const [vendorTiers, setVendorTiers] = useState<TierFormData[]>([]);
  const [clientTiers, setClientTiers] = useState<TierFormData[]>([]);
  const [dialogTab, setDialogTab] = useState<"vendor" | "client">("vendor");

  // ── Fetch ──────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!projectId || !companyId) { setLoading(false); return; }
    setLoading(true);

    const [salespeopleRes, configRes] = await Promise.all([
      (supabase.from("company_salespeople") as any)
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("sf_commission_configs")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true),
    ]);

    const spList: Salesperson[] = ((salespeopleRes?.data as any[]) || []).map((sp: any) => ({
      id: sp.id,
      name: sp.name,
    }));
    setSalespeople(spList);

    const configsData = (configRes.data as any[]) || [];
    const configIds = configsData.map((c: any) => c.id);

    let allVendorTiers: any[] = [];
    let allClientTiers: any[] = [];
    if (configIds.length > 0) {
      const [vt, ct] = await Promise.all([
        supabase.from("sf_commission_tiers").select("*").in("config_id", configIds).order("sort_order"),
        (supabase.from("sf_commission_client_tiers") as any).select("*").in("config_id", configIds).order("sort_order"),
      ]);
      allVendorTiers = vt.data || [];
      allClientTiers = ct.data || [];
    }

    const mergedConfigs: CommissionConfig[] = configsData.map((c: any) => ({
      ...c,
      vendorTiers: allVendorTiers.filter((t: any) => t.config_id === c.id),
      clientTiers: allClientTiers.filter((t: any) => t.config_id === c.id),
    }));
    setConfigs(mergedConfigs);

    await fetchKpiData(spList, companyId);
    setLoading(false);
  }, [projectId, companyId]);

  const fetchKpiData = useCallback(async (spList: Salesperson[], cId: string) => {
    if (!cId) return;
    const [year, month] = monthYear.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: mainKpis } = await supabase
      .from("company_kpis").select("id, target_value, periodicity, name")
      .eq("company_id", cId).eq("is_main_goal", true).eq("is_active", true);

    if (!mainKpis || mainKpis.length === 0) { setKpiData([]); return; }
    const kpiIds = mainKpis.map((k: any) => k.id);

    const [mtRes, eRes] = await Promise.all([
      supabase.from("kpi_monthly_targets").select("*").in("kpi_id", kpiIds).eq("company_id", cId).eq("month_year", monthYear),
      supabase.from("kpi_entries").select("*").eq("company_id", cId).in("kpi_id", kpiIds).gte("entry_date", startDate).lte("entry_date", endDate),
    ]);
    const monthlyTargets = mtRes.data;
    const entries = eRes.data;

    const result: KpiData[] = [];
    for (const sp of spList) {
      let totalValue = 0, totalTarget = 0;
      for (const kpi of mainKpis) {
        const override = monthlyTargets?.find((mt: any) => mt.kpi_id === kpi.id && mt.salesperson_id === sp.id);
        totalTarget += override ? Number(override.target_value) : Number(kpi.target_value);
        const spEntries = entries?.filter((e: any) => e.kpi_id === kpi.id && e.salesperson_id === sp.id) || [];
        totalValue += spEntries.reduce((sum: number, e: any) => sum + Number(e.value), 0);
      }
      result.push({ salesperson_id: sp.id, total_value: totalValue, target_value: totalTarget, achievement_percent: totalTarget > 0 ? (totalValue / totalTarget) * 100 : 0 });
    }
    setKpiData(result);
  }, [monthYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (salespeople.length > 0 && companyId) fetchKpiData(salespeople, companyId); }, [monthYear, salespeople, companyId, fetchKpiData]);

  // ── Form helpers ───────────────────────────────
  const resetForm = () => {
    setForm({ salesperson_id: "", role: "closer", base_salary: "", notes: "" });
    setVendorTiers([]);
    setClientTiers([]);
    setEditingConfig(null);
    setDialogTab("vendor");
  };

  const availableSalespeople = salespeople.filter(
    (sp) => !configs.some((c) => c.salesperson_id === sp.id) || editingConfig?.salesperson_id === sp.id
  );

  const openNewConfig = () => {
    if (!canManageConfigs) { toast.error("Consultores podem apenas visualizar"); return; }
    if (salespeople.length === 0) { toast.error("Cadastre os vendedores no menu KPIs primeiro"); return; }
    if (availableSalespeople.length === 0) {
      // If all salespeople already have configs, open edit for the first one
      if (configs.length === 1) {
        openEditConfig(configs[0]);
        return;
      }
      toast.info("Todos os vendedores já possuem configuração. Clique no ícone ⚙️ no card do vendedor para editar.");
      return;
    }
    resetForm();
    setDialogOpen(true);
  };

  const openEditConfig = (config: CommissionConfig) => {
    if (!canManageConfigs) { toast.error("Consultores podem apenas visualizar"); return; }
    setEditingConfig(config);
    setForm({ salesperson_id: config.salesperson_id, role: config.role, base_salary: String(config.base_salary), notes: config.notes || "" });
    setVendorTiers(config.vendorTiers.map(t => ({ min_percent: t.min_percent, max_percent: t.max_percent, commission_type: t.commission_type, commission_value: t.commission_value, label: t.label, sort_order: t.sort_order })));
    setClientTiers(config.clientTiers.map(t => ({ min_percent: t.min_percent, max_percent: t.max_percent, commission_type: t.commission_type, commission_value: t.commission_value, label: t.label, sort_order: t.sort_order })));
    setDialogTab("vendor");
    setDialogOpen(true);
  };

  const makeTier = (list: TierFormData[]): TierFormData => {
    const lastMax = list.length > 0 ? (list[list.length - 1].max_percent || 0) : 0;
    return { min_percent: lastMax, max_percent: null, commission_type: "fixed", commission_value: 0, label: "", sort_order: list.length };
  };

  // ── Save ───────────────────────────────────────
  const handleSave = async () => {
    if (!canManageConfigs) return;
    if (!form.salesperson_id) { toast.error("Selecione um vendedor"); return; }
    if (vendorTiers.length === 0) { toast.error("Adicione ao menos uma faixa de comissão do vendedor"); return; }
    if (canViewClientAmounts && clientTiers.length === 0) { toast.error("Adicione ao menos uma faixa de comissão do cliente"); return; }

    try {
      if (editingConfig) {
        await (supabase.from("sf_commission_configs") as any).update({ role: form.role, base_salary: parseFloat(form.base_salary) || 0, notes: form.notes || null }).eq("id", editingConfig.id);

        // Vendor tiers
        await (supabase.from("sf_commission_tiers") as any).delete().eq("config_id", editingConfig.id);
        await (supabase.from("sf_commission_tiers") as any).insert(vendorTiers.map((t, i) => ({ ...t, config_id: editingConfig.id, sort_order: i })));

        // Client tiers
        await (supabase.from("sf_commission_client_tiers") as any).delete().eq("config_id", editingConfig.id);
        if (clientTiers.length > 0) {
          await (supabase.from("sf_commission_client_tiers") as any).insert(clientTiers.map((t, i) => ({ ...t, config_id: editingConfig.id, sort_order: i })));
        }

        toast.success("Configuração atualizada");
      } else {
        const existing = configs.find((c) => c.salesperson_id === form.salesperson_id);
        if (existing) { toast.error("Já existe uma configuração para este vendedor"); return; }

        const { data: newConfig, error } = await (supabase.from("sf_commission_configs") as any)
          .insert({ project_id: projectId, salesperson_id: form.salesperson_id, role: form.role, base_salary: parseFloat(form.base_salary) || 0, notes: form.notes || null })
          .select("id").single();
        if (error) throw error;

        await (supabase.from("sf_commission_tiers") as any).insert(vendorTiers.map((t, i) => ({ ...t, config_id: newConfig.id, sort_order: i })));
        if (clientTiers.length > 0) {
          await (supabase.from("sf_commission_client_tiers") as any).insert(clientTiers.map((t, i) => ({ ...t, config_id: newConfig.id, sort_order: i })));
        }

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
    if (!canManageConfigs) return;
    if (!confirm("Tem certeza que deseja excluir esta configuração?")) return;
    await (supabase.from("sf_commission_configs") as any).update({ is_active: false }).eq("id", configId);
    toast.success("Configuração removida");
    fetchAll();
  };

  // ── Tier calculation ───────────────────────────
  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getTierValue = (tiers: TierData[], percent: number): number => {
    const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
    for (const tier of sorted) {
      if (percent >= tier.min_percent && (tier.max_percent === null || percent <= tier.max_percent)) {
        return tier.commission_type === "fixed" ? tier.commission_value : 0;
      }
    }
    return 0;
  };

  // ── Render ─────────────────────────────────────
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
        {canManageConfigs && (
          <Button onClick={openNewConfig} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Configurar Vendedor
          </Button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium capitalize min-w-[160px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {salespeople.length > 1 && (
          <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {salespeople.map(sp => (
                <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Filtered configs */}
      {(() => {
        const filteredConfigs = selectedSalesperson === "all" ? configs : configs.filter(c => c.salesperson_id === selectedSalesperson);
        return filteredConfigs.length > 0 && (
        <>
        {/* Result cards - UNV revenue & vendor payout */}
        <div className={`grid ${canViewClientAmounts ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-4`}>
          {canViewClientAmounts && (() => {
            const totalClientPays = configs.reduce((sum, c) => {
              const kpi = kpiData.find(k => k.salesperson_id === c.salesperson_id);
              return sum + (kpi?.total_value || 0);
            }, 0);
            const totalVendorPayout = configs.reduce((sum, c) => {
              const kpi = kpiData.find(k => k.salesperson_id === c.salesperson_id);
              return sum + c.base_salary + getTierValue(c.vendorTiers, kpi?.achievement_percent || 0);
            }, 0);
            const margin = totalClientPays - totalVendorPayout;
            return (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">UNV vai receber</p>
                      <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(totalClientPays)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Total pago aos vendedores</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(totalVendorPayout)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Margem UNV</span>
                      <span className={`font-medium ${margin >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(margin)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vendedores vão receber</p>
                  <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(configs.reduce((sum, c) => {
                  const kpi = kpiData.find(k => k.salesperson_id === c.salesperson_id);
                  return sum + getTierValue(c.vendorTiers, kpi?.achievement_percent || 0);
                }, 0))}
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                <span>{configs.length} vendedor{configs.length !== 1 ? "es" : ""} configurado{configs.length !== 1 ? "s" : ""}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {/* Salesperson cards */}
      {configs.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum vendedor configurado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManageConfigs ? 'Clique em "Configurar Vendedor" para começar.' : "Ainda não há configurações para visualizar."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const sp = salespeople.find(s => s.id === config.salesperson_id);
            const kpi = kpiData.find(k => k.salesperson_id === config.salesperson_id);
            const achievement = kpi?.achievement_percent || 0;
            const vendorCommission = getTierValue(config.vendorTiers, achievement);
            const clientPays = kpi?.total_value || 0; // Client pays actual revenue to UNV
            const totalPayable = config.base_salary + vendorCommission;

            return (
              <Card key={config.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{(sp?.name || "?")[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <CardTitle className="text-sm">{sp?.name || "Vendedor"}</CardTitle>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{config.role === "sdr" ? "SDR" : "Closer"}</Badge>
                      </div>
                    </div>
                    {canManageConfigs && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditConfig(config)}><Settings2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(config.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Achievement */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Meta atingida</span>
                    <span className={`font-bold ${achievement >= 100 ? "text-primary" : achievement >= 80 ? "text-foreground" : "text-destructive"}`}>{achievement.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${achievement >= 100 ? "bg-primary" : achievement >= 80 ? "bg-accent" : "bg-destructive"}`} style={{ width: `${Math.min(achievement, 100)}%` }} />
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
                    {canViewClientAmounts && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente paga à UNV</span>
                        <span className="font-medium text-primary">{formatCurrency(clientPays)}</span>
                      </div>
                    )}
                    {canViewBaseSalary && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salário base</span>
                        <span className="font-medium">{formatCurrency(config.base_salary)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comissão vendedor</span>
                      <span className="font-medium text-primary">{formatCurrency(vendorCommission)}</span>
                    </div>
                    {canViewBaseSalary && (
                      <>
                        <Separator />
                        <div className="flex justify-between font-bold">
                          <span>Total a pagar ao vendedor</span>
                          <span className="text-primary">{formatCurrency(totalPayable)}</span>
                        </div>
                      </>
                    )}
                    {canViewClientAmounts && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margem UNV</span>
                        <span className={`font-medium ${clientPays - totalPayable >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(clientPays - totalPayable)}</span>
                      </div>
                    )}
                  </div>

                  {/* Vendor tiers preview */}
                  <TiersPreview label="Faixas do vendedor" tiers={config.vendorTiers} achievement={achievement} kpi={kpi} formatCurrency={formatCurrency} />

                  {/* Client tiers preview (admin only) */}
                  {canViewClientAmounts && config.clientTiers.length > 0 && (
                    <TiersPreview label="Faixas do cliente → UNV" tiers={config.clientTiers} achievement={achievement} kpi={kpi} formatCurrency={formatCurrency} />
                  )}
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
            {/* Vendedor + Função */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vendedor *</Label>
                <Select value={form.salesperson_id} onValueChange={(v) => setForm(f => ({ ...f, salesperson_id: v }))} disabled={!!editingConfig}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(editingConfig ? salespeople : availableSalespeople).map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Função</Label>
                <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="sdr">SDR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Salário Base (R$)</Label>
              <Input type="number" step="0.01" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} placeholder="0,00" />
            </div>

            <div>
              <Label>Observações</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre esta comissão..." />
            </div>

            <Separator />

            {/* Tabs for vendor vs client tiers */}
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="vendor" className="flex-1 text-xs">Comissão Vendedor</TabsTrigger>
                {canViewClientAmounts && (
                  <TabsTrigger value="client" className="flex-1 text-xs">Comissão Cliente → UNV</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="vendor" className="mt-3">
                <TierEditor
                  tiers={vendorTiers}
                  setTiers={setVendorTiers}
                  makeTier={makeTier}
                  label="Faixas que definem quanto o vendedor ganha de comissão variável com base no % de meta atingida."
                />
              </TabsContent>

              {canViewClientAmounts && (
                <TabsContent value="client" className="mt-3">
                  <TierEditor
                    tiers={clientTiers}
                    setTiers={setClientTiers}
                    makeTier={makeTier}
                    label="Faixas que definem quanto o cliente paga à UNV com base no % de meta atingida."
                  />
                </TabsContent>
              )}
            </Tabs>

            <Button onClick={handleSave} className="w-full">
              {editingConfig ? "Salvar Alterações" : "Criar Configuração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ───────────────────────────────

function TiersPreview({ label, tiers, achievement, kpi, formatCurrency }: {
  label: string;
  tiers: TierData[];
  achievement: number;
  kpi: KpiData | undefined;
  formatCurrency: (v: number) => string;
}) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}:</p>
      <div className="space-y-1">
        {[...tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier, i) => {
          const isActive = kpi && achievement >= tier.min_percent && (tier.max_percent === null || achievement < tier.max_percent);
          return (
            <div key={tier.id || i} className={`flex justify-between text-xs px-2 py-1 rounded ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
              <span>{tier.label || `Faixa ${i + 1}`}: {tier.min_percent}%{tier.max_percent != null ? ` - ${tier.max_percent}%` : "+"}</span>
              <span>{tier.commission_type === "fixed" ? formatCurrency(tier.commission_value) : `${tier.commission_value}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TierFormData2 = Omit<TierData, "id" | "config_id">;

function TierEditor({ tiers, setTiers, makeTier, label }: {
  tiers: TierFormData2[];
  setTiers: React.Dispatch<React.SetStateAction<TierFormData2[]>>;
  makeTier: (list: TierFormData2[]) => TierFormData2;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Button variant="outline" size="sm" onClick={() => setTiers(prev => [...prev, makeTier(prev)])}>
          <Plus className="h-3 w-3 mr-1" /> Faixa
        </Button>
      </div>

      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">Clique em + Faixa para adicionar</p>
      )}

      <div className="space-y-3">
        {tiers.map((tier, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Faixa {idx + 1}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTiers(prev => prev.filter((_, i) => i !== idx))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">De (%)</Label>
                <Input type="number" value={tier.min_percent} onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, min_percent: parseFloat(e.target.value) || 0 } : t))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Até (%) <span className="text-muted-foreground">vazio = ∞</span></Label>
                <Input type="number" value={tier.max_percent ?? ""} onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, max_percent: e.target.value ? parseFloat(e.target.value) : null } : t))} className="h-8 text-sm" placeholder="∞" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tier.commission_type} onValueChange={v => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, commission_type: v as any } : t))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    <SelectItem value="percent">% do salário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input type="number" step="0.01" value={tier.commission_value} onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, commission_value: parseFloat(e.target.value) || 0 } : t))} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Rótulo (opcional)</Label>
              <Input value={tier.label || ""} onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, label: e.target.value || null } : t))} className="h-8 text-sm" placeholder="Ex: Meta batida, Super meta..." />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

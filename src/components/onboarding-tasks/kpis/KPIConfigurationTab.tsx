import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { KPIMonthlyTargetsDialog } from "./KPIMonthlyTargetsDialog";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  periodicity: "daily" | "weekly" | "monthly";
  target_value: number;
  is_individual: boolean;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  sector_id: string | null;
}

interface Sector {
  id: string;
  name: string;
  is_active: boolean;
}

interface KPIConfigurationTabProps {
  companyId: string;
  isAdmin: boolean;
  isClient?: boolean;
}

export const KPIConfigurationTab = ({ companyId, isAdmin, isClient = false }: KPIConfigurationTabProps) => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showMonthlyTargets, setShowMonthlyTargets] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    kpi_type: "numeric" as "numeric" | "monetary" | "percentage",
    periodicity: "daily" as "daily" | "weekly" | "monthly",
    target_value: 0,
    is_individual: true,
    is_required: true,
    sector_id: "",
  });

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      const [kpisRes, sectorsRes] = await Promise.all([
        supabase
          .from("company_kpis")
          .select("*")
          .eq("company_id", companyId)
          .order("sort_order"),
        supabase
          .from("company_sectors")
          .select("id, name, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (sectorsRes.error) throw sectorsRes.error;

      setKpis((kpisRes.data || []) as KPI[]);
      setSectors(sectorsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchKpis = async () => {
    try {
      const { data, error } = await supabase
        .from("company_kpis")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order");

      if (error) throw error;
      setKpis((data || []) as KPI[]);
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      toast.error("Erro ao carregar KPIs");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do KPI é obrigatório");
      return;
    }

    try {
      if (editingKpi) {
        const { error } = await supabase
          .from("company_kpis")
          .update({
            name: formData.name,
            kpi_type: formData.kpi_type,
            periodicity: formData.periodicity,
            target_value: formData.target_value,
            is_individual: formData.is_individual,
            is_required: formData.is_required,
            sector_id: formData.sector_id || null,
          })
          .eq("id", editingKpi.id);

        if (error) throw error;
        toast.success("KPI atualizado");
      } else {
        const maxOrder = Math.max(...kpis.map(k => k.sort_order), 0);
        const { error } = await supabase.from("company_kpis").insert({
          company_id: companyId,
          name: formData.name,
          kpi_type: formData.kpi_type,
          periodicity: formData.periodicity,
          target_value: formData.target_value,
          is_individual: formData.is_individual,
          is_required: formData.is_required,
          sector_id: formData.sector_id || null,
          sort_order: maxOrder + 1,
        });

        if (error) throw error;
        toast.success("KPI criado");
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast.error("Erro ao salvar KPI");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este KPI?")) return;

    try {
      const { error } = await supabase
        .from("company_kpis")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("KPI excluído");
      fetchKpis();
    } catch (error) {
      console.error("Error deleting KPI:", error);
      toast.error("Erro ao excluir KPI");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("company_kpis")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "KPI ativado" : "KPI desativado");
      fetchData();
    } catch (error) {
      console.error("Error toggling KPI:", error);
      toast.error("Erro ao atualizar KPI");
    }
  };

  const resetForm = () => {
    setEditingKpi(null);
    setFormData({
      name: "",
      kpi_type: "numeric",
      periodicity: "daily",
      target_value: 0,
      is_individual: true,
      is_required: true,
      sector_id: "",
    });
  };

  const openEditDialog = (kpi: KPI) => {
    setEditingKpi(kpi);
    setFormData({
      name: kpi.name,
      kpi_type: kpi.kpi_type,
      periodicity: kpi.periodicity,
      target_value: kpi.target_value,
      is_individual: kpi.is_individual,
      is_required: kpi.is_required,
      sector_id: kpi.sector_id || "",
    });
    setShowDialog(true);
  };

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return null;
    const sector = sectors.find(s => s.id === sectorId);
    return sector ? sector.name : null;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "numeric": return "Numérico";
      case "monetary": return "Monetário (R$)";
      case "percentage": return "Percentual (%)";
      default: return type;
    }
  };

  const getPeriodicityLabel = (periodicity: string) => {
    switch (periodicity) {
      case "daily": return "Diária";
      case "weekly": return "Semanal";
      case "monthly": return "Mensal";
      default: return periodicity;
    }
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (type === "percentage") {
      return `${value}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configuração de KPIs</h3>
          <p className="text-sm text-muted-foreground">
            Configure os indicadores que serão acompanhados para esta empresa
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowMonthlyTargets(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Metas Mensais
            </Button>
          )}
          {isAdmin && (
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo KPI
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingKpi ? "Editar KPI" : "Novo KPI"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do KPI</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Faturamento Diário"
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={formData.kpi_type}
                    onValueChange={(v) => setFormData({ ...formData, kpi_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numérico</SelectItem>
                      <SelectItem value="monetary">Monetário (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Periodicidade da Meta</Label>
                  <Select
                    value={formData.periodicity}
                    onValueChange={(v) => setFormData({ ...formData, periodicity: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Meta Alvo</Label>
                  <Input
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>KPI Individual (por vendedor)</Label>
                  <Switch
                    checked={formData.is_individual}
                    onCheckedChange={(v) => setFormData({ ...formData, is_individual: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Obrigatório no lançamento</Label>
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(v) => setFormData({ ...formData, is_required: v })}
                  />
                </div>

                {sectors.length > 0 && (
                  <div>
                    <Label>Setor (opcional)</Label>
                    <Select
                      value={formData.sector_id}
                      onValueChange={(v) => setFormData({ ...formData, sector_id: v === "all" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os setores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os setores</SelectItem>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vincule a um setor para que apenas vendedores desse setor lancem este KPI
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="flex-1">
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    {editingKpi ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <KPIMonthlyTargetsDialog
        open={showMonthlyTargets}
        onOpenChange={setShowMonthlyTargets}
        companyId={companyId}
        kpis={kpis}
        onSaved={() => fetchData()}
        onAddKPI={() => {
          setShowMonthlyTargets(false);
          resetForm();
          setShowDialog(true);
        }}
        isClient={isClient}
      />

      {kpis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum KPI configurado ainda.</p>
            <p className="text-sm">Crie KPIs para começar a acompanhar os indicadores da empresa.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Escopo</TableHead>
                {sectors.length > 0 && <TableHead>Setor</TableHead>}
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((kpi) => (
                <TableRow key={kpi.id} className={!kpi.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">
                    {kpi.name}
                    {kpi.is_required && (
                      <Badge variant="secondary" className="ml-2">Obrigatório</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getTypeLabel(kpi.kpi_type)}</TableCell>
                  <TableCell>{getPeriodicityLabel(kpi.periodicity)}</TableCell>
                  <TableCell>{formatValue(kpi.target_value, kpi.kpi_type)}</TableCell>
                  <TableCell>
                    <Badge variant={kpi.is_individual ? "default" : "outline"}>
                      {kpi.is_individual ? "Individual" : "Coletivo"}
                    </Badge>
                  </TableCell>
                  {sectors.length > 0 && (
                    <TableCell>
                      {getSectorName(kpi.sector_id) ? (
                        <Badge variant="outline" className="gap-1">
                          {getSectorName(kpi.sector_id)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Todos</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        checked={kpi.is_active}
                        onCheckedChange={(v) => handleToggleActive(kpi.id, v)}
                      />
                    ) : (
                      <Badge variant={kpi.is_active ? "default" : "secondary"}>
                        {kpi.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(kpi)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(kpi.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

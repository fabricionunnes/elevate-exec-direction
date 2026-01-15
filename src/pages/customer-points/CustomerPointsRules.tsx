import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Settings, Coins } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ContextType {
  companyId: string;
  pointsName: string;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  rule_type: "fixed" | "per_value" | "per_quantity" | "streak";
  points_value: number;
  multiplier: number;
  min_value: number | null;
  max_points_per_action: number | null;
  is_active: boolean;
  sort_order: number;
}

interface Config {
  id: string;
  points_name: string;
  is_active: boolean;
  levels_enabled: boolean;
  levels_config: any[];
  rewards_enabled: boolean;
  rewards_config: any[];
}

const ruleTypeLabels: Record<string, string> = {
  fixed: "Pontos Fixos",
  per_value: "Por Valor (R$)",
  per_quantity: "Por Quantidade",
  streak: "Por Frequência",
};

export default function CustomerPointsRules() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_type: "fixed" as Rule["rule_type"],
    points_value: 10,
    multiplier: 1,
    min_value: "",
    max_points_per_action: "",
  });

  const [configForm, setConfigForm] = useState({
    points_name: "Pontos",
    is_active: true,
  });

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch or create config
      let { data: configData } = await supabase
        .from("customer_points_config")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (!configData) {
        const { data: newConfig, error } = await supabase
          .from("customer_points_config")
          .insert({ company_id: companyId })
          .select()
          .single();
        if (error) throw error;
        configData = newConfig;
      }

      setConfig(configData as Config);
      setConfigForm({
        points_name: configData.points_name || "Pontos",
        is_active: configData.is_active ?? true,
      });

      // Fetch rules
      const { data: rulesData, error: rulesError } = await supabase
        .from("customer_points_rules")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order");

      if (rulesError) throw rulesError;
      setRules((rulesData || []) as Rule[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      rule_type: "fixed",
      points_value: 10,
      multiplier: 1,
      min_value: "",
      max_points_per_action: "",
    });
    setEditingRule(null);
  };

  const openEditDialog = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      points_value: rule.points_value,
      multiplier: rule.multiplier,
      min_value: rule.min_value?.toString() || "",
      max_points_per_action: rule.max_points_per_action?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da regra é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const ruleData = {
        company_id: companyId,
        name: formData.name.trim(),
        description: formData.description || null,
        rule_type: formData.rule_type,
        points_value: formData.points_value,
        multiplier: formData.multiplier,
        min_value: formData.min_value ? parseFloat(formData.min_value) : null,
        max_points_per_action: formData.max_points_per_action ? parseInt(formData.max_points_per_action) : null,
        sort_order: editingRule?.sort_order || rules.length,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("customer_points_rules")
          .update(ruleData)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Regra atualizada!");
      } else {
        const { error } = await supabase
          .from("customer_points_rules")
          .insert(ruleData);
        if (error) throw error;
        toast.success("Regra criada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving rule:", error);
      toast.error(error.message || "Erro ao salvar regra");
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleStatus = async (rule: Rule) => {
    try {
      const { error } = await supabase
        .from("customer_points_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);
      if (error) throw error;
      toast.success(rule.is_active ? "Regra desativada" : "Regra ativada");
      fetchData();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("customer_points_rules")
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
      toast.success("Regra excluída");
      fetchData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Erro ao excluir regra");
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_points_config")
        .update({
          points_name: configForm.points_name,
          is_active: configForm.is_active,
        })
        .eq("id", config?.id);
      if (error) throw error;
      toast.success("Configurações salvas!");
      setConfigDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const getRuleDescription = (rule: Rule) => {
    switch (rule.rule_type) {
      case "fixed":
        return `+${rule.points_value} pontos`;
      case "per_value":
        return `A cada R$${rule.multiplier} = +${rule.points_value} pontos`;
      case "per_quantity":
        return `Por unidade: +${rule.points_value} pontos`;
      case "streak":
        return `Frequência: +${rule.points_value} pontos`;
      default:
        return `+${rule.points_value} pontos`;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Regras de Pontuação</h1>
          <p className="text-muted-foreground">Configure como os clientes ganham {pointsName.toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurações Gerais</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="points_name">Nome dos pontos</Label>
                  <Input
                    id="points_name"
                    value={configForm.points_name}
                    onChange={(e) => setConfigForm({ ...configForm, points_name: e.target.value })}
                    placeholder="Pontos, Coins, Créditos..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Como os pontos serão chamados (ex: "Pontos", "Coins", "Créditos")
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Sistema ativo</Label>
                    <p className="text-xs text-muted-foreground">Permite registrar novos pontos</p>
                  </div>
                  <Switch
                    checked={configForm.is_active}
                    onCheckedChange={(checked) => setConfigForm({ ...configForm, is_active: checked })}
                  />
                </div>
                <Button onClick={saveConfig} disabled={saving} className="w-full">
                  {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="rule_name">Nome da regra *</Label>
                  <Input
                    id="rule_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Compra, Indicação, Check-in..."
                  />
                </div>
                <div>
                  <Label htmlFor="rule_type">Tipo de regra</Label>
                  <Select
                    value={formData.rule_type}
                    onValueChange={(v: Rule["rule_type"]) => setFormData({ ...formData, rule_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Pontos Fixos</SelectItem>
                      <SelectItem value="per_value">Por Valor (R$)</SelectItem>
                      <SelectItem value="per_quantity">Por Quantidade</SelectItem>
                      <SelectItem value="streak">Por Frequência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="points_value">Pontos</Label>
                    <Input
                      id="points_value"
                      type="number"
                      min={1}
                      value={formData.points_value}
                      onChange={(e) => setFormData({ ...formData, points_value: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  {formData.rule_type === "per_value" && (
                    <div>
                      <Label htmlFor="multiplier">A cada R$</Label>
                      <Input
                        id="multiplier"
                        type="number"
                        min={1}
                        value={formData.multiplier}
                        onChange={(e) => setFormData({ ...formData, multiplier: parseFloat(e.target.value) || 1 })}
                      />
                    </div>
                  )}
                </div>
                {formData.rule_type === "per_value" && (
                  <div>
                    <Label htmlFor="min_value">Valor mínimo (R$)</Label>
                    <Input
                      id="min_value"
                      type="number"
                      value={formData.min_value}
                      onChange={(e) => setFormData({ ...formData, min_value: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="max_points">Máximo de pontos por ação</Label>
                  <Input
                    id="max_points"
                    type="number"
                    value={formData.max_points_per_action}
                    onChange={(e) => setFormData({ ...formData, max_points_per_action: e.target.value })}
                    placeholder="Sem limite"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição da regra..."
                    rows={2}
                  />
                </div>
                <Button onClick={handleSaveRule} disabled={saving} className="w-full">
                  {saving ? "Salvando..." : editingRule ? "Salvar alterações" : "Criar regra"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Regras Configuradas
          </CardTitle>
          <CardDescription>
            Defina as ações que geram {pointsName.toLowerCase()} para seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma regra configurada ainda. Crie a primeira regra para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ruleTypeLabels[rule.rule_type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getRuleDescription(rule)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRuleStatus(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Registros existentes serão mantidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteRule(rule.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

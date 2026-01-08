import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Calendar, ChevronLeft, ChevronRight, Copy, Check, Plus, Trash2, Settings2 } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KPI {
  id: string;
  name: string;
  kpi_type: string;
  target_value: number;
}

interface TargetLevel {
  id: string;
  name: string;
  sort_order: number;
}

interface MonthlyTarget {
  id?: string;
  kpi_id: string;
  month_year: string;
  target_value: number;
  level_name: string;
  level_order: number;
}

interface KPIMonthlyTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  kpis: KPI[];
  onSaved?: () => void;
  onAddKPI?: () => void;
}

export const KPIMonthlyTargetsDialog = ({
  open,
  onOpenChange,
  companyId,
  kpis,
  onSaved,
  onAddKPI,
}: KPIMonthlyTargetsDialogProps) => {
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  // targets: { [kpi_id]: { [level_name]: value } }
  const [targets, setTargets] = useState<Record<string, Record<string, number>>>({});
  const [targetLevels, setTargetLevels] = useState<TargetLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedFromPrevious, setCopiedFromPrevious] = useState(false);
  const [showLevelConfig, setShowLevelConfig] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");

  const monthYear = format(selectedDate, "yyyy-MM");
  const monthLabel = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
  const previousMonthYear = format(subMonths(selectedDate, 1), "yyyy-MM");

  useEffect(() => {
    if (open) {
      fetchData();
      setCopiedFromPrevious(false);
    }
  }, [open, monthYear, companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch target levels and monthly targets in parallel
      const [levelsRes, targetsRes] = await Promise.all([
        supabase
          .from("kpi_target_levels")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("kpi_monthly_targets")
          .select("*")
          .eq("company_id", companyId)
          .eq("month_year", monthYear),
      ]);

      if (levelsRes.error) throw levelsRes.error;
      if (targetsRes.error) throw targetsRes.error;

      let levels = (levelsRes.data || []) as TargetLevel[];
      
      // If no levels exist, create default "Meta" level
      if (levels.length === 0) {
        const { data: newLevel, error: createError } = await supabase
          .from("kpi_target_levels")
          .insert({ company_id: companyId, name: "Meta", sort_order: 1 })
          .select()
          .single();
        
        if (!createError && newLevel) {
          levels = [newLevel as TargetLevel];
        }
      }

      setTargetLevels(levels);

      // Build targets map: { kpi_id: { level_name: value } }
      const targetsMap: Record<string, Record<string, number>> = {};
      (targetsRes.data || []).forEach((t: any) => {
        if (!targetsMap[t.kpi_id]) {
          targetsMap[t.kpi_id] = {};
        }
        targetsMap[t.kpi_id][t.level_name] = t.target_value;
      });

      setTargets(targetsMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFromPrevious = async () => {
    try {
      const { data, error } = await supabase
        .from("kpi_monthly_targets")
        .select("*")
        .eq("company_id", companyId)
        .eq("month_year", previousMonthYear);

      if (error) throw error;

      if (!data || data.length === 0) {
        // If no previous month data, copy from default KPI targets for first level only
        const firstLevel = targetLevels[0]?.name || "Meta";
        const defaultTargets: Record<string, Record<string, number>> = {};
        kpis.forEach((kpi) => {
          defaultTargets[kpi.id] = { [firstLevel]: kpi.target_value };
        });
        setTargets(defaultTargets);
        toast.info("Metas padrão aplicadas (mês anterior sem dados)");
      } else {
        // Copy all levels from previous month
        const copiedMap: Record<string, Record<string, number>> = {};
        data.forEach((t: any) => {
          if (!copiedMap[t.kpi_id]) {
            copiedMap[t.kpi_id] = {};
          }
          copiedMap[t.kpi_id][t.level_name] = t.target_value;
        });
        setTargets(copiedMap);
        toast.success("Metas copiadas do mês anterior");
      }
      setCopiedFromPrevious(true);
    } catch (error) {
      console.error("Error copying targets:", error);
      toast.error("Erro ao copiar metas");
    }
  };

  const handleAddLevel = async () => {
    if (!newLevelName.trim()) {
      toast.error("Digite um nome para a meta");
      return;
    }

    if (targetLevels.some((l) => l.name.toLowerCase() === newLevelName.trim().toLowerCase())) {
      toast.error("Já existe uma meta com este nome");
      return;
    }

    try {
      const nextOrder = targetLevels.length + 1;
      const { data, error } = await supabase
        .from("kpi_target_levels")
        .insert({
          company_id: companyId,
          name: newLevelName.trim(),
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setTargetLevels([...targetLevels, data as TargetLevel]);
      setNewLevelName("");
      toast.success(`Nível "${newLevelName}" adicionado`);
    } catch (error) {
      console.error("Error adding level:", error);
      toast.error("Erro ao adicionar nível de meta");
    }
  };

  const handleRemoveLevel = async (level: TargetLevel) => {
    if (targetLevels.length <= 1) {
      toast.error("É necessário ter pelo menos um nível de meta");
      return;
    }

    try {
      const { error } = await supabase
        .from("kpi_target_levels")
        .update({ is_active: false })
        .eq("id", level.id);

      if (error) throw error;

      setTargetLevels(targetLevels.filter((l) => l.id !== level.id));
      
      // Remove this level from all targets
      const newTargets = { ...targets };
      Object.keys(newTargets).forEach((kpiId) => {
        delete newTargets[kpiId][level.name];
      });
      setTargets(newTargets);
      
      toast.success(`Nível "${level.name}" removido`);
    } catch (error) {
      console.error("Error removing level:", error);
      toast.error("Erro ao remover nível de meta");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing targets for this month first
      await supabase
        .from("kpi_monthly_targets")
        .delete()
        .eq("company_id", companyId)
        .eq("month_year", monthYear);

      // Build upserts for all KPIs and levels
      const inserts: any[] = [];
      
      kpis.forEach((kpi) => {
        targetLevels.forEach((level, idx) => {
          const value = targets[kpi.id]?.[level.name];
          if (value !== undefined && value !== null) {
            inserts.push({
              kpi_id: kpi.id,
              company_id: companyId,
              month_year: monthYear,
              target_value: value,
              level_name: level.name,
              level_order: idx + 1,
            });
          }
        });
      });

      if (inserts.length === 0) {
        toast.warning("Nenhuma meta para salvar");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("kpi_monthly_targets")
        .insert(inserts);

      if (error) throw error;

      toast.success(`Metas de ${monthLabel} salvas com sucesso!`);
      onSaved?.();
      fetchData();
    } catch (error) {
      console.error("Error saving targets:", error);
      toast.error("Erro ao salvar metas");
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    setSelectedDate(subMonths(selectedDate, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(addMonths(selectedDate, 1));
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

  const updateTarget = (kpiId: string, levelName: string, value: number | undefined) => {
    setTargets((prev) => {
      const kpiTargets = prev[kpiId] || {};
      if (value === undefined) {
        const { [levelName]: _, ...rest } = kpiTargets;
        return { ...prev, [kpiId]: rest };
      }
      return {
        ...prev,
        [kpiId]: { ...kpiTargets, [levelName]: value },
      };
    });
  };

  const hasAnyTargetForKpi = (kpiId: string) => {
    return Object.values(targets[kpiId] || {}).some((v) => v !== undefined);
  };

  const activeKpis = kpis.filter((k: any) => k.is_active !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Metas Mensais por KPI
          </DialogTitle>
          <DialogDescription>
            Defina metas, super metas e hiper metas para cada KPI. Personalize os níveis de meta como preferir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium capitalize text-lg">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions row */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLevelConfig(!showLevelConfig)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Gerenciar Níveis de Meta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromPrevious}
              disabled={loading}
            >
              {copiedFromPrevious ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar do Mês Anterior
                </>
              )}
            </Button>
          </div>

          {/* Level configuration */}
          {showLevelConfig && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Níveis de Meta Configurados:</p>
              <div className="flex flex-wrap gap-2">
                {targetLevels.map((level) => (
                  <Badge key={level.id} variant="secondary" className="gap-1 pr-1">
                    {level.name}
                    {targetLevels.length > 1 && (
                      <button
                        onClick={() => handleRemoveLevel(level)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do novo nível (ex: Super Meta)"
                  value={newLevelName}
                  onChange={(e) => setNewLevelName(e.target.value)}
                  className="max-w-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleAddLevel()}
                />
                <Button size="sm" onClick={handleAddLevel}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : activeKpis.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-3">
              <p>Nenhum KPI ativo configurado.</p>
              {onAddKPI && (
                <Button variant="outline" onClick={onAddKPI}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro KPI
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">KPI</TableHead>
                    <TableHead>Padrão</TableHead>
                    {targetLevels.map((level) => (
                      <TableHead key={level.id} className="min-w-[120px]">
                        {level.name}
                      </TableHead>
                    ))}
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeKpis.map((kpi) => (
                    <TableRow key={kpi.id}>
                      <TableCell className="font-medium">{kpi.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatValue(kpi.target_value, kpi.kpi_type)}
                      </TableCell>
                      {targetLevels.map((level) => (
                        <TableCell key={level.id}>
                          <div className="flex items-center gap-1">
                            {kpi.kpi_type === "monetary" && (
                              <span className="text-muted-foreground text-xs">R$</span>
                            )}
                            <Input
                              type="number"
                              value={targets[kpi.id]?.[level.name] ?? ""}
                              onChange={(e) =>
                                updateTarget(
                                  kpi.id,
                                  level.name,
                                  e.target.value === "" ? undefined : parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 h-8 text-sm"
                              placeholder={kpi.target_value.toString()}
                            />
                            {kpi.kpi_type === "percentage" && (
                              <span className="text-muted-foreground text-xs">%</span>
                            )}
                          </div>
                        </TableCell>
                      ))}
                      <TableCell>
                        {hasAnyTargetForKpi(kpi.id) ? (
                          <Badge variant="default" className="text-xs">Definida</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Padrão</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t">
            <div>
              {onAddKPI && activeKpis.length > 0 && (
                <Button variant="ghost" onClick={onAddKPI}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo KPI
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || loading}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Metas do Mês"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

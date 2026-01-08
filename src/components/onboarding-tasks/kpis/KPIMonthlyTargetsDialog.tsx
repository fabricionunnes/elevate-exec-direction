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
import { Save, Calendar, ChevronLeft, ChevronRight, Copy, Check, Plus } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KPI {
  id: string;
  name: string;
  kpi_type: string;
  target_value: number;
}

interface MonthlyTarget {
  id?: string;
  kpi_id: string;
  month_year: string;
  target_value: number;
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
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [existingTargets, setExistingTargets] = useState<Record<string, MonthlyTarget>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedFromPrevious, setCopiedFromPrevious] = useState(false);

  const monthYear = format(selectedDate, "yyyy-MM");
  const monthLabel = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
  const previousMonthYear = format(subMonths(selectedDate, 1), "yyyy-MM");

  useEffect(() => {
    if (open) {
      fetchTargets();
      setCopiedFromPrevious(false);
    }
  }, [open, monthYear, companyId]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kpi_monthly_targets")
        .select("*")
        .eq("company_id", companyId)
        .eq("month_year", monthYear);

      if (error) throw error;

      const targetsMap: Record<string, MonthlyTarget> = {};
      const valuesMap: Record<string, number> = {};

      (data || []).forEach((t: any) => {
        targetsMap[t.kpi_id] = t;
        valuesMap[t.kpi_id] = t.target_value;
      });

      setExistingTargets(targetsMap);
      setTargets(valuesMap);
    } catch (error) {
      console.error("Error fetching targets:", error);
      toast.error("Erro ao carregar metas");
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
        // If no previous month data, copy from default KPI targets
        const defaultTargets: Record<string, number> = {};
        kpis.forEach((kpi) => {
          defaultTargets[kpi.id] = kpi.target_value;
        });
        setTargets(defaultTargets);
        toast.info("Metas padrão aplicadas (mês anterior sem dados)");
      } else {
        const copiedMap: Record<string, number> = {};
        data.forEach((t: any) => {
          copiedMap[t.kpi_id] = t.target_value;
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only save KPIs that have a value set
      const upserts = kpis
        .filter((kpi) => targets[kpi.id] !== undefined && targets[kpi.id] !== null)
        .map((kpi) => ({
          kpi_id: kpi.id,
          company_id: companyId,
          month_year: monthYear,
          target_value: targets[kpi.id] || 0,
        }));

      if (upserts.length === 0) {
        toast.warning("Nenhuma meta para salvar");
        setSaving(false);
        return;
      }

      // Upsert all targets for the month
      const { error } = await supabase
        .from("kpi_monthly_targets")
        .upsert(upserts, { onConflict: "kpi_id,month_year" });

      if (error) throw error;

      toast.success(`Metas de ${monthLabel} salvas com sucesso!`);
      onSaved?.();
      fetchTargets();
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

  const hasMonthlyTarget = (kpiId: string) => {
    return existingTargets[kpiId] !== undefined;
  };

  const activeKpis = kpis.filter((k: any) => k.is_active !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Metas Mensais por KPI
          </DialogTitle>
          <DialogDescription>
            Defina metas específicas para cada KPI em cada mês. Se não definir, será usado o valor padrão do KPI.
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

          {/* Copy from previous button */}
          <div className="flex justify-end">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Meta Padrão</TableHead>
                  <TableHead>Meta do Mês</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeKpis.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium">{kpi.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatValue(kpi.target_value, kpi.kpi_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {kpi.kpi_type === "monetary" && (
                          <span className="text-muted-foreground text-sm">R$</span>
                        )}
                        <Input
                          type="number"
                          value={targets[kpi.id] ?? ""}
                          onChange={(e) =>
                            setTargets({
                              ...targets,
                              [kpi.id]: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-32"
                          placeholder={kpi.target_value.toString()}
                        />
                        {kpi.kpi_type === "percentage" && (
                          <span className="text-muted-foreground text-sm">%</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasMonthlyTarget(kpi.id) ? (
                        <Badge variant="default" className="text-xs">Definida</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Padrão</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
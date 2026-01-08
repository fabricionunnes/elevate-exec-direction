import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Save, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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
}

export const KPIMonthlyTargetsDialog = ({
  open,
  onOpenChange,
  companyId,
  kpis,
  onSaved,
}: KPIMonthlyTargetsDialogProps) => {
  const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [existingTargets, setExistingTargets] = useState<Record<string, MonthlyTarget>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthYear = format(selectedDate, "yyyy-MM");
  const monthLabel = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (open) {
      fetchTargets();
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

      // For KPIs without monthly target, use the default target_value
      kpis.forEach((kpi) => {
        if (!(kpi.id in valuesMap)) {
          valuesMap[kpi.id] = kpi.target_value;
        }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = kpis.map((kpi) => ({
        kpi_id: kpi.id,
        company_id: companyId,
        month_year: monthYear,
        target_value: targets[kpi.id] || 0,
      }));

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

  const activeKpis = kpis.filter((k: any) => k.is_active !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Metas Mensais por KPI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium capitalize">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : activeKpis.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum KPI ativo configurado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Meta Padrão</TableHead>
                  <TableHead>Meta do Mês</TableHead>
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
                          <span className="text-muted-foreground">R$</span>
                        )}
                        <Input
                          type="number"
                          value={targets[kpi.id] || ""}
                          onChange={(e) =>
                            setTargets({
                              ...targets,
                              [kpi.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-32"
                          placeholder="0"
                        />
                        {kpi.kpi_type === "percentage" && (
                          <span className="text-muted-foreground">%</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Metas do Mês"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

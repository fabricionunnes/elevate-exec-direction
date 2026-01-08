import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { History, Plus, Trash2, Pencil } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= currentYear - 10; year--) {
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
};

interface SalesHistoryEntry {
  id: string;
  month_year: string;
  revenue: number;
  sales_count: number | null;
  notes: string | null;
  is_pre_unv: boolean;
}

interface SalesHistoryDialogProps {
  companyId: string;
  contractStartDate?: string | null;
  onDataChange?: () => void;
}

export const SalesHistoryDialog = ({ companyId, contractStartDate, onDataChange }: SalesHistoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SalesHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state - separate month and year
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [revenue, setRevenue] = useState("");
  const [salesCount, setSalesCount] = useState("");
  const [notes, setNotes] = useState("");
  const [isPreUnv, setIsPreUnv] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchEntries();
    }
  }, [open, companyId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_sales_history")
        .select("*")
        .eq("company_id", companyId)
        .order("month_year", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching sales history:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMonth("");
    setSelectedYear("");
    setRevenue("");
    setSalesCount("");
    setNotes("");
    setIsPreUnv(true);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!selectedMonth || !selectedYear || !revenue) {
      toast.error("Mês, Ano e Faturamento são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const monthDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      
      if (isNaN(monthDate.getTime())) {
        toast.error("Data inválida. Selecione um mês válido.");
        setSaving(false);
        return;
      }
      
      const payload = {
        company_id: companyId,
        month_year: format(monthDate, "yyyy-MM-dd"),
        revenue: parseFloat(revenue.replace(/\./g, "").replace(",", ".")),
        sales_count: salesCount ? parseInt(salesCount) : null,
        notes: notes || null,
        is_pre_unv: isPreUnv,
      };

      if (editingId) {
        const { error } = await supabase
          .from("company_sales_history")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Registro atualizado");
      } else {
        const { error } = await supabase
          .from("company_sales_history")
          .insert(payload);

        if (error) {
          if (error.code === "23505") {
            toast.error("Já existe um registro para este mês");
            return;
          }
          throw error;
        }
        toast.success("Registro adicionado");
      }

      resetForm();
      fetchEntries();
      onDataChange?.();
    } catch (error) {
      console.error("Error saving sales history:", error);
      toast.error("Erro ao salvar registro");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: SalesHistoryEntry) => {
    const date = new Date(entry.month_year);
    setSelectedMonth(String(date.getMonth() + 1).padStart(2, '0'));
    setSelectedYear(String(date.getFullYear()));
    setRevenue(entry.revenue.toString());
    setSalesCount(entry.sales_count?.toString() || "");
    setNotes(entry.notes || "");
    setIsPreUnv(entry.is_pre_unv);
    setEditingId(entry.id);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("company_sales_history")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Registro excluído");
      fetchEntries();
      onDataChange?.();
    } catch (error) {
      console.error("Error deleting sales history:", error);
      toast.error("Erro ao excluir registro");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History className="h-4 w-4" />
          Histórico de Vendas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Vendas (Meses Anteriores)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form */}
          <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label>Mês *</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano *</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="revenue">Faturamento (R$) *</Label>
                <Input
                  id="revenue"
                  type="number"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="salesCount">Qtd. Vendas</Label>
                <Input
                  id="salesCount"
                  type="number"
                  value={salesCount}
                  onChange={(e) => setSalesCount(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isPreUnv"
                    checked={isPreUnv}
                    onCheckedChange={setIsPreUnv}
                  />
                  <Label htmlFor="isPreUnv" className="text-sm">
                    {isPreUnv ? "Antes da UNV" : "Depois da UNV"}
                  </Label>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre este período..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                <Plus className="h-4 w-4" />
                {editingId ? "Atualizar" : "Adicionar"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum histórico cadastrado. Adicione dados de meses anteriores para comparação.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {format(new Date(entry.month_year), "MMMM yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{formatCurrency(entry.revenue)}</TableCell>
                    <TableCell>{entry.sales_count ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${
                        entry.is_pre_unv 
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" 
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {entry.is_pre_unv ? "Antes UNV" : "Depois UNV"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={entry.notes || ""}>
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

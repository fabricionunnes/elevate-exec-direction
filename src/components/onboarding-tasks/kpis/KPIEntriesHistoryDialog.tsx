import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { History, Trash2, DollarSign, Hash, Percent, Pencil } from "lucide-react";
import { formatDateLocal } from "@/lib/dateUtils";

interface KPI {
  id: string;
  name: string;
  kpi_type: string;
}

interface Salesperson {
  id: string;
  name: string;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
  observations: string | null;
  created_at: string;
}

interface KPIEntriesHistoryDialogProps {
  companyId: string;
  canDelete?: boolean; // Admin, CS, or consultant
  canEdit?: boolean; // Admin, CS, consultant, or client
  onEntryDeleted?: () => void;
  salespersonId?: string; // If provided, filter entries to only this salesperson
}

export const KPIEntriesHistoryDialog = ({ 
  companyId, 
  canDelete = false,
  canEdit = false,
  onEntryDeleted,
  salespersonId
}: KPIEntriesHistoryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [selectedKpi, setSelectedKpi] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editObservations, setEditObservations] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, companyId, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build entries query with optional salesperson filter
      let entriesQuery = supabase
        .from("kpi_entries")
        .select("*")
        .eq("company_id", companyId)
        .gte("entry_date", dateRange.start)
        .lte("entry_date", dateRange.end);
      
      // If salespersonId is provided, filter to only their entries
      if (salespersonId) {
        entriesQuery = entriesQuery.eq("salesperson_id", salespersonId);
      }
      
      entriesQuery = entriesQuery
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      // Build salespeople query - if filtering by salesperson, only fetch that one
      let salespeopleQuery = supabase
        .from("company_salespeople")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true);
      
      if (salespersonId) {
        salespeopleQuery = salespeopleQuery.eq("id", salespersonId);
      } else {
        salespeopleQuery = salespeopleQuery.order("name");
      }

      const [entriesRes, kpisRes, salespeopleRes] = await Promise.all([
        entriesQuery,
        supabase
          .from("company_kpis")
          .select("id, name, kpi_type")
          .eq("company_id", companyId)
          .eq("is_active", true),
        salespeopleQuery,
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (kpisRes.error) throw kpisRes.error;
      if (salespeopleRes.error) throw salespeopleRes.error;

      setEntries(entriesRes.data || []);
      setKpis(kpisRes.data || []);
      setSalespeople(salespeopleRes.data || []);
    } catch (error) {
      console.error("Error fetching entries history:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entryToDelete) return;

    try {
      const { error } = await supabase
        .from("kpi_entries")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) throw error;

      toast.success("Lançamento excluído com sucesso");
      setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
      onEntryDeleted?.();
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Erro ao excluir lançamento");
    }
  };

  const handleEdit = (entry: Entry) => {
    setEntryToEdit(entry);
    setEditValue(entry.value.toString());
    setEditObservations(entry.observations || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!entryToEdit) return;
    
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) {
      toast.error("Valor inválido");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("kpi_entries")
        .update({ 
          value: newValue,
          observations: editObservations || null
        })
        .eq("id", entryToEdit.id);

      if (error) throw error;

      toast.success("Lançamento atualizado com sucesso");
      setEntries(prev => prev.map(e => 
        e.id === entryToEdit.id 
          ? { ...e, value: newValue, observations: editObservations || null }
          : e
      ));
      setEditDialogOpen(false);
      setEntryToEdit(null);
      onEntryDeleted?.(); // Refresh parent data
    } catch (error) {
      console.error("Error updating entry:", error);
      toast.error("Erro ao atualizar lançamento");
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (value: number, kpiType: string) => {
    if (kpiType === "monetary") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    }
    if (kpiType === "percentage") {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString("pt-BR");
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-3 w-3" />;
      case "percentage": return <Percent className="h-3 w-3" />;
      default: return <Hash className="h-3 w-3" />;
    }
  };

  const getKpiById = (id: string) => kpis.find(k => k.id === id);
  const getSalespersonById = (id: string) => salespeople.find(s => s.id === id);

  const filteredEntries = entries.filter(entry => {
    if (selectedSalesperson !== "all" && entry.salesperson_id !== selectedSalesperson) return false;
    if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) return false;
    return true;
  });

  // Group by salesperson for summary
  const summaryBySalesperson = salespeople.map(sp => {
    const spEntries = filteredEntries.filter(e => e.salesperson_id === sp.id);
    const totalValue = spEntries.reduce((sum, e) => {
      const kpi = getKpiById(e.kpi_id);
      return kpi?.kpi_type === "monetary" ? sum + e.value : sum;
    }, 0);
    const totalEntries = spEntries.length;
    return { ...sp, totalValue, totalEntries };
  }).filter(sp => sp.totalEntries > 0).sort((a, b) => b.totalValue - a.totalValue);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Histórico de Lançamentos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Lançamentos de KPIs
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Data Inicial</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange({ ...dateRange, start: e.target.value });
                    }
                  }}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Final</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange({ ...dateRange, end: e.target.value });
                    }
                  }}
                  className="w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendedor</Label>
                <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {salespeople.map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">KPI</Label>
                <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {kpis.map(kpi => (
                      <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary by Salesperson */}
            {summaryBySalesperson.length > 0 && (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                {summaryBySalesperson.slice(0, 4).map(sp => (
                  <div key={sp.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium truncate">{sp.name}</p>
                    <p className="text-lg font-bold text-primary">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sp.totalValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">{sp.totalEntries} lançamentos</p>
                  </div>
                ))}
              </div>
            )}

            {/* Entries Table */}
            <ScrollArea className="h-[400px] border rounded-md">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  Carregando...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex justify-center items-center h-32 text-muted-foreground">
                  Nenhum lançamento encontrado para o período
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>KPI</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Observações</TableHead>
                      {(canEdit || canDelete) && <TableHead className="w-[100px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map(entry => {
                      const kpi = getKpiById(entry.kpi_id);
                      const salesperson = getSalespersonById(entry.salesperson_id);
                      
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {formatDateLocal(entry.entry_date, "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{salesperson?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {kpi && getKpiIcon(kpi.kpi_type)}
                              {kpi?.name || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {kpi ? formatValue(entry.value, kpi.kpi_type) : entry.value}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground">
                            {entry.observations || "-"}
                          </TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell>
                              <div className="flex gap-1">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEdit(entry)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setEntryToDelete(entry);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center">
              {filteredEntries.length} lançamento(s) no período selecionado
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento?
              {entryToDelete && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p><strong>Data:</strong> {formatDateLocal(entryToDelete.entry_date, "dd/MM/yyyy")}</p>
                  <p><strong>Vendedor:</strong> {getSalespersonById(entryToDelete.salesperson_id)?.name}</p>
                  <p><strong>Valor:</strong> {formatValue(entryToDelete.value, getKpiById(entryToDelete.kpi_id)?.kpi_type || "numeric")}</p>
                </div>
              )}
              <p className="mt-2 text-destructive font-medium">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Lançamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {entryToEdit && (
                  <div className="mt-2 p-3 bg-muted rounded-md mb-4">
                    <p><strong>Data:</strong> {formatDateLocal(entryToEdit.entry_date, "dd/MM/yyyy")}</p>
                    <p><strong>Vendedor:</strong> {getSalespersonById(entryToEdit.salesperson_id)?.name}</p>
                    <p><strong>KPI:</strong> {getKpiById(entryToEdit.kpi_id)?.name}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Valor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Digite o novo valor"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Observações</Label>
                    <Input
                      value={editObservations}
                      onChange={(e) => setEditObservations(e.target.value)}
                      placeholder="Observações (opcional)"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

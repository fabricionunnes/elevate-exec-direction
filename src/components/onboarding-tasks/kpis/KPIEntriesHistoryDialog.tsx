import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { History, Trash2, DollarSign, Hash, Percent, Pencil } from "lucide-react";
import { formatDateLocal } from "@/lib/dateUtils";

interface KPI { id: string; name: string; kpi_type: string; }
interface Salesperson { id: string; name: string; unit_id?: string | null; team_id?: string | null; sector_id?: string | null; }
interface NamedRef { id: string; name: string; unit_id?: string | null; }
interface Entry {
  id: string; kpi_id: string; salesperson_id: string;
  entry_date: string; value: number; observations: string | null; created_at: string;
}

interface KPIEntriesHistoryDialogProps {
  companyId: string;
  canDelete?: boolean;
  canEdit?: boolean;
  onEntryDeleted?: () => void;
  salespersonId?: string;
}

// Filtro de seleção múltipla com busca (array vazio = todos).
const MultiPick = ({ label, options, selected, onChange }: {
  label: string; options: NamedRef[]; selected: string[]; onChange: (v: string[]) => void;
}) => {
  const [query, setQuery] = useState("");
  const shown = options.filter(o => !query.trim() || o.name.toLowerCase().includes(query.toLowerCase()));
  const resumo = selected.length === 0 ? label
    : selected.length === 1 ? (options.find(o => o.id === selected[0])?.name || label)
    : `${selected.length} selecionados`;
  return (
    <Popover onOpenChange={(o) => { if (o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-9 justify-between font-normal px-3">
          <span className="truncate text-sm">{resumo}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="start">
        {options.length > 6 && (
          <Input placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs mb-1" />
        )}
        <button
          className={cn("w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted", selected.length === 0 && "font-semibold text-primary")}
          onClick={() => onChange([])}
        >
          {label}
        </button>
        <div className="max-h-[220px] overflow-y-auto mt-1 space-y-0.5">
          {shown.map(o => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                className={cn("w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded hover:bg-muted", on && "bg-primary/10 text-primary font-medium")}
                onClick={() => onChange(on ? selected.filter(x => x !== o.id) : [...selected, o.id])}
              >
                <span className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-border")}>
                  {on && <CheckIcon className="h-2.5 w-2.5 text-primary-foreground" />}
                </span>
                <span className="truncate">{o.name}</span>
              </button>
            );
          })}
          {shown.length === 0 && <p className="text-[11px] text-muted-foreground px-2 py-1">Nada encontrado.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const KPIEntriesHistoryDialog = ({
  companyId, canDelete = false, canEdit = false, onEntryDeleted, salespersonId,
}: KPIEntriesHistoryDialogProps) => {
  // ── State — mesma ordem do original + bulk selection ──────────────────────
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  // filtros com seleção múltipla (array vazio = todos)
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [units, setUnits] = useState<NamedRef[]>([]);
  const [sectors, setSectors] = useState<NamedRef[]>([]);
  const [teams, setTeams] = useState<NamedRef[]>([]);
  const [selectedKpi, setSelectedKpi] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editObservations, setEditObservations] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Effects — mesma ordem do original ─────────────────────────────────────
  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedIds([]);
    }
  }, [open, companyId, dateRange]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      let entriesQuery = supabase
        .from("kpi_entries").select("*")
        .eq("company_id", companyId)
        .gte("entry_date", dateRange.start)
        .lte("entry_date", dateRange.end);
      if (salespersonId) entriesQuery = entriesQuery.eq("salesperson_id", salespersonId);
      entriesQuery = entriesQuery
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      let salespeopleQuery = supabase
        .from("company_salespeople").select("id, name, unit_id, team_id, sector_id")
        .eq("company_id", companyId).eq("is_active", true);
      if (salespersonId) salespeopleQuery = salespeopleQuery.eq("id", salespersonId);
      else salespeopleQuery = salespeopleQuery.order("name");

      const [entriesRes, kpisRes, salespeopleRes, unitsRes, teamsRes, sectorsRes] = await Promise.all([
        entriesQuery,
        supabase.from("company_kpis").select("id, name, kpi_type")
          .eq("company_id", companyId).eq("is_active", true),
        salespeopleQuery,
        supabase.from("company_units").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_teams").select("id, name, unit_id").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_sectors").select("id, name, unit_id").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (kpisRes.error) throw kpisRes.error;
      if (salespeopleRes.error) throw salespeopleRes.error;
      setEntries(entriesRes.data || []);
      setKpis(kpisRes.data || []);
      setSalespeople(salespeopleRes.data || []);
      setUnits((unitsRes.data as NamedRef[]) || []);
      setTeams((teamsRes.data as NamedRef[]) || []);
      setSectors((sectorsRes.data as NamedRef[]) || []);
    } catch (error) {
      console.error("Error fetching entries history:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  // ── Single delete ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!entryToDelete) return;
    try {
      const { error } = await supabase.from("kpi_entries").delete().eq("id", entryToDelete.id);
      if (error) throw error;
      toast.success("Lançamento excluído");
      setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
      setSelectedIds(prev => prev.filter(id => id !== entryToDelete.id));
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
      onEntryDeleted?.();
    } catch (error) {
      toast.error("Erro ao excluir lançamento");
    }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase.from("kpi_entries").delete().in("id", selectedIds);
      if (error) throw error;
      toast.success(`${selectedIds.length} lançamento(s) excluído(s)`);
      setEntries(prev => prev.filter(e => !selectedIds.includes(e.id)));
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      onEntryDeleted?.();
    } catch (error) {
      toast.error("Erro ao excluir lançamentos");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (entry: Entry) => {
    setEntryToEdit(entry);
    setEditValue(entry.value.toString());
    setEditObservations(entry.observations || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!entryToEdit) return;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("kpi_entries")
        .update({ value: newValue, observations: editObservations || null })
        .eq("id", entryToEdit.id);
      if (error) throw error;
      toast.success("Lançamento atualizado");
      setEntries(prev => prev.map(e =>
        e.id === entryToEdit.id ? { ...e, value: newValue, observations: editObservations || null } : e
      ));
      setEditDialogOpen(false);
      setEntryToEdit(null);
      onEntryDeleted?.();
    } catch (error) {
      toast.error("Erro ao atualizar lançamento");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatValue = (value: number, kpiType: string) => {
    if (kpiType === "monetary")
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    if (kpiType === "percentage") return `${value.toFixed(1)}%`;
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

  // Cascata: escolher a unidade restringe setor, equipe e vendedores mostrados.
  const visibleSectors = selectedUnits.length === 0
    ? sectors : sectors.filter(s => s.unit_id && selectedUnits.includes(s.unit_id));
  const visibleTeams = selectedUnits.length === 0
    ? teams : teams.filter(t => t.unit_id && selectedUnits.includes(t.unit_id));
  const visibleSalespeople = salespeople.filter(sp => {
    if (selectedUnits.length > 0 && !(sp.unit_id && selectedUnits.includes(sp.unit_id))) return false;
    if (selectedSectors.length > 0 && !(sp.sector_id && selectedSectors.includes(sp.sector_id))) return false;
    if (selectedTeams.length > 0 && !(sp.team_id && selectedTeams.includes(sp.team_id))) return false;
    return true;
  });

  const filteredEntries = entries.filter(entry => {
    const sp = salespeople.find(s => s.id === entry.salesperson_id);
    if (selectedSalespeople.length > 0 && !selectedSalespeople.includes(entry.salesperson_id)) return false;
    if (selectedUnits.length > 0 && !(sp?.unit_id && selectedUnits.includes(sp.unit_id))) return false;
    if (selectedSectors.length > 0 && !(sp?.sector_id && selectedSectors.includes(sp.sector_id))) return false;
    if (selectedTeams.length > 0 && !(sp?.team_id && selectedTeams.includes(sp.team_id))) return false;
    if (selectedKpi !== "all" && entry.kpi_id !== selectedKpi) return false;
    return true;
  });

  const summaryBySalesperson = salespeople.map(sp => {
    const spEntries = filteredEntries.filter(e => e.salesperson_id === sp.id);
    const totalValue = spEntries.reduce((sum, e) => {
      const kpi = getKpiById(e.kpi_id);
      return kpi?.kpi_type === "monetary" ? sum + e.value : sum;
    }, 0);
    return { ...sp, totalValue, totalEntries: spEntries.length };
  }).filter(sp => sp.totalEntries > 0).sort((a, b) => b.totalValue - a.totalValue);

  // Selection helpers
  const filteredIds = filteredEntries.map(e => e.id);
  const selectedInView = selectedIds.filter(id => filteredIds.includes(id));
  const allSelected = filteredIds.length > 0 && selectedInView.length === filteredIds.length;
  const someSelected = selectedInView.length > 0 && selectedInView.length < filteredIds.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">De</Label>
                  <Input type="date" value={dateRange.start} className="h-9 w-full text-xs"
                    onChange={(e) => { if (e.target.value) setDateRange({ ...dateRange, start: e.target.value }); }} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Até</Label>
                  <Input type="date" value={dateRange.end} className="h-9 w-full text-xs"
                    onChange={(e) => { if (e.target.value) setDateRange({ ...dateRange, end: e.target.value }); }} />
                </div>
                {units.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unidade</Label>
                    <MultiPick label="Todas" options={units}
                      selected={selectedUnits}
                      onChange={(v) => {
                        // trocar a unidade zera os filtros que dependem dela
                        setSelectedUnits(v); setSelectedSectors([]); setSelectedTeams([]); setSelectedSalespeople([]); setSelectedIds([]);
                      }} />
                  </div>
                )}
                {visibleSectors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Setor</Label>
                    <MultiPick label="Todos" options={visibleSectors}
                      selected={selectedSectors}
                      onChange={(v) => { setSelectedSectors(v); setSelectedSalespeople([]); setSelectedIds([]); }} />
                  </div>
                )}
                {visibleTeams.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Equipe</Label>
                    <MultiPick label="Todas" options={visibleTeams}
                      selected={selectedTeams}
                      onChange={(v) => { setSelectedTeams(v); setSelectedSalespeople([]); setSelectedIds([]); }} />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vendedores</Label>
                  <MultiPick label="Todos" options={visibleSalespeople.map(s => ({ id: s.id, name: s.name }))}
                    selected={selectedSalespeople}
                    onChange={(v) => { setSelectedSalespeople(v); setSelectedIds([]); }} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">KPIs</Label>
                  <Select value={selectedKpi} onValueChange={(v) => { setSelectedKpi(v); setSelectedIds([]); }}>
                    <SelectTrigger className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {kpis.map(kpi => <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(selectedSalespeople.length > 0 || selectedUnits.length > 0 || selectedSectors.length > 0 || selectedTeams.length > 0 || selectedKpi !== "all") && (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground">
                    {filteredEntries.length} de {entries.length} lançamentos
                  </span>
                  <button
                    className="text-[11px] text-primary hover:underline ml-auto"
                    onClick={() => { setSelectedSalespeople([]); setSelectedUnits([]); setSelectedSectors([]); setSelectedTeams([]); setSelectedKpi("all"); setSelectedIds([]); }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            {summaryBySalesperson.length > 0 && (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
                {/* Total de tudo que está filtrado (não só dos 4 maiores) */}
                <div className="p-3 rounded-xl border-2 border-primary/40 bg-primary/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Total no filtro</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5 text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      summaryBySalesperson.reduce((s, sp) => s + sp.totalValue, 0),
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {summaryBySalesperson.length} vendedor{summaryBySalesperson.length > 1 ? "es" : ""} · {filteredEntries.length} lançamentos
                  </p>
                </div>
                {summaryBySalesperson.slice(0, 4).map(sp => (
                  <div key={sp.id} className="p-3 rounded-xl border border-border bg-card">
                    <p className="text-xs font-medium truncate text-muted-foreground" title={sp.name}>{sp.name}</p>
                    <p className="text-lg font-bold tabular-nums mt-0.5">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sp.totalValue)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{sp.totalEntries} lançamento{sp.totalEntries > 1 ? "s" : ""}</p>
                  </div>
                ))}
                {summaryBySalesperson.length > 4 && (
                  <p className="col-span-2 md:col-span-5 text-[11px] text-muted-foreground -mt-1">
                    Mostrando os 4 maiores de {summaryBySalesperson.length} vendedores — o card "Total no filtro" soma todos.
                  </p>
                )}
              </div>
            )}

            {/* Bulk action bar */}
            {canDelete && selectedInView.length > 0 && (
              <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                <span className="text-sm font-medium text-destructive">
                  {selectedInView.length} selecionado(s)
                </span>
                <Button variant="destructive" size="sm" className="gap-1.5"
                  onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar selecionados
                </Button>
              </div>
            )}

            {/* Table */}
            <ScrollArea className="h-[400px] border rounded-md">
              {loading ? (
                <div className="flex justify-center items-center h-32">Carregando...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex justify-center items-center h-32 text-muted-foreground">
                  Nenhum lançamento encontrado para o período
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canDelete && (
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
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
                      const isSelected = selectedIds.includes(entry.id);
                      return (
                        <TableRow key={entry.id} className={isSelected ? "bg-destructive/5" : undefined}>
                          {canDelete && (
                            <TableCell>
                              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(entry.id)} />
                            </TableCell>
                          )}
                          <TableCell className="py-2 font-medium whitespace-nowrap">
                            <span className="text-sm">{formatDateLocal(entry.entry_date, "dd/MM/yyyy")}</span>
                            {entry.created_at && (
                              <span
                                className="block text-[10px] font-normal text-muted-foreground"
                                title={`Lançado em ${new Date(entry.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                              >
                                reg. {new Date(entry.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })} {new Date(entry.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 max-w-[180px]">
                            <span className="block truncate text-sm" title={salesperson?.name || "-"}>{salesperson?.name || "-"}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="gap-1 font-normal">
                              {kpi && getKpiIcon(kpi.kpi_type)}
                              {kpi?.name || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-right font-bold tabular-nums">
                            {kpi ? formatValue(entry.value, kpi.kpi_type) : entry.value}
                          </TableCell>
                          <TableCell className="py-2 max-w-[150px] truncate text-muted-foreground text-xs">
                            {entry.observations || "-"}
                          </TableCell>
                          {(canEdit || canDelete) && (
                            <TableCell>
                              <div className="flex gap-1">
                                {canEdit && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entry)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => { setEntryToDelete(entry); setDeleteDialogOpen(true); }}>
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

      {/* Single Delete */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento?
              {entryToDelete && (
                <span className="block mt-2 p-3 bg-muted rounded-md text-sm">
                  <strong>Data:</strong> {formatDateLocal(entryToDelete.entry_date, "dd/MM/yyyy")} ·{" "}
                  <strong>Vendedor:</strong> {getSalespersonById(entryToDelete.salesperson_id)?.name} ·{" "}
                  <strong>Valor:</strong> {formatValue(entryToDelete.value, getKpiById(entryToDelete.kpi_id)?.kpi_type || "numeric")}
                </span>
              )}
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

      {/* Bulk Delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedInView.length} lançamento(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : `Excluir ${selectedInView.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Lançamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {entryToEdit && (
                  <div className="mt-2 p-3 bg-muted rounded-md mb-4 text-sm">
                    <p><strong>Data:</strong> {formatDateLocal(entryToEdit.entry_date, "dd/MM/yyyy")}</p>
                    <p><strong>Vendedor:</strong> {getSalespersonById(entryToEdit.salesperson_id)?.name}</p>
                    <p><strong>KPI:</strong> {getKpiById(entryToEdit.kpi_id)?.name}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Valor</Label>
                    <Input type="number" step="0.01" value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Digite o novo valor" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Observações</Label>
                    <Input value={editObservations} onChange={(e) => setEditObservations(e.target.value)}
                      placeholder="Observações (opcional)" className="mt-1" />
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

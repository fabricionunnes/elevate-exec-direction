import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  Upload,
  TrendingUp,
  Handshake,
} from "lucide-react";
import { toast } from "sonner";
import { CRMFiltersBar, CRMFilters } from "@/components/crm/CRMFiltersBar";
import { ClientKanbanStageColumn } from "./ClientKanbanStageColumn";
import { useDragScroll } from "@/hooks/useDragScroll";
import type { ClientCRMLead, ClientCRMStageData } from "./hooks/useClientCRMPipeline";

interface ClientCRMPipelinePageProps {
  projectId: string;
  pipelines: any[];
  stages: ClientCRMStageData[];
  leads: ClientCRMLead[];
  loading: boolean;
  selectedPipeline: string | null;
  selectedOrigin: string | null;
  tagOptions: { id: string; name: string; color: string }[];
  ownerOptions: { id: string; name: string }[];
  originOptions: { id: string; name: string }[];
  forecastData: any[];
  negotiationData: any[];
  onCreateLead: (lead: Partial<ClientCRMLead>) => Promise<void>;
  onMoveLeadToStage: (leadId: string, stageId: string, note?: string) => Promise<void>;
  onRefresh: () => void;
}

const defaultFilters: CRMFilters = {
  search: "",
  dateRange: undefined,
  fields: [],
  tags: [],
  owners: [],
  status: [],
  stages: [],
  origins: [],
  valueMin: null,
  valueMax: null,
  phoneFilter: "all",
};

export const ClientCRMPipelinePage = ({
  projectId,
  pipelines,
  stages,
  leads,
  loading,
  selectedPipeline,
  selectedOrigin,
  tagOptions,
  ownerOptions,
  originOptions,
  forecastData,
  negotiationData,
  onCreateLead,
  onMoveLeadToStage,
  onRefresh,
}: ClientCRMPipelinePageProps) => {
  const [filters, setFilters] = useState<CRMFilters>(defaultFilters);
  const [draggedLead, setDraggedLead] = useState<ClientCRMLead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const { ref: dragScrollRef, isDragging: isDraggingScroll, bind: dragScrollBind } = useDragScroll();

  // Add lead dialog
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [addLeadStageId, setAddLeadStageId] = useState<string | undefined>(undefined);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", company: "", notes: "", opportunity_value: "" });
  const [savingLead, setSavingLead] = useState(false);

  // Stage move dialog
  const [stageMoveDialog, setStageMoveDialog] = useState<{
    open: boolean;
    leadId: string;
    targetStageId: string;
    targetStageName: string;
  }>({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
  const [stageNote, setStageNote] = useState("");
  const [movingLead, setMovingLead] = useState(false);

  // Filter leads
  const filteredForecastTotal = useMemo(() => {
    const data = filters.owners.length > 0
      ? forecastData.filter((f: any) => filters.owners.includes(f.owner_id))
      : forecastData;
    return data.reduce((sum: number, f: any) => sum + (f.opportunity_value || 0), 0);
  }, [forecastData, filters.owners]);

  const filteredNegotiationTotal = useMemo(() => {
    const data = filters.owners.length > 0
      ? negotiationData.filter((l: any) => filters.owners.includes(l.owner_id))
      : negotiationData;
    return data.reduce((sum: number, l: any) => sum + (l.opportunity_value || 0), 0);
  }, [negotiationData, filters.owners]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch =
          lead.name.toLowerCase().includes(search) ||
          lead.company?.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.phone?.includes(search);
        if (!matchesSearch) return false;
      }
      if (filters.tags.length > 0) {
        const leadTagIds = lead.tags?.map(t => t.tag.id) || [];
        if (!filters.tags.some(tagId => leadTagIds.includes(tagId))) return false;
      }
      if (filters.owners.length > 0) {
        if (!lead.owner_id || !filters.owners.includes(lead.owner_id)) return false;
      }
      if (filters.stages.length > 0) {
        if (!filters.stages.includes(lead.stage_id)) return false;
      }
      if (filters.valueMin !== null && (lead.opportunity_value || 0) < filters.valueMin) return false;
      if (filters.valueMax !== null && (lead.opportunity_value || 0) > filters.valueMax) return false;
      if (filters.dateRange?.from) {
        const leadDate = new Date(lead.created_at);
        if (leadDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && leadDate > filters.dateRange.to) return false;
      }
      if (filters.phoneFilter === "with_phone") {
        if (!lead.phone) return false;
      } else if (filters.phoneFilter === "without_phone") {
        if (lead.phone) return false;
      }
      return true;
    });
  }, [leads, filters]);

  const getLeadsByStage = (stageId: string) => filteredLeads.filter(lead => lead.stage_id === stageId);

  const handleDragStart = (e: React.DragEvent, lead: ClientCRMLead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.stage_id === stageId) {
      setDraggedLead(null);
      return;
    }
    const targetStage = stages.find(s => s.id === stageId);
    setStageMoveDialog({
      open: true,
      leadId: draggedLead.id,
      targetStageId: stageId,
      targetStageName: targetStage?.name || "Nova Etapa",
    });
    setStageNote("");
    setDraggedLead(null);
  };

  const confirmStageMove = async () => {
    if (!stageMoveDialog.leadId || !stageMoveDialog.targetStageId) return;
    setMovingLead(true);
    try {
      await onMoveLeadToStage(stageMoveDialog.leadId, stageMoveDialog.targetStageId, stageNote);
      setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
    } catch (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead");
    } finally {
      setMovingLead(false);
    }
  };

  const handleCreateLead = async () => {
    if (!newLead.name.trim()) return;
    setSavingLead(true);
    try {
      await onCreateLead({
        name: newLead.name,
        phone: newLead.phone || null,
        email: newLead.email || null,
        company: newLead.company || null,
        notes: newLead.notes || null,
        opportunity_value: newLead.opportunity_value ? Number(newLead.opportunity_value) : 0,
        stage_id: addLeadStageId || undefined,
      } as any);
      setNewLead({ name: "", phone: "", email: "", company: "", notes: "", opportunity_value: "" });
      setAddLeadOpen(false);
    } catch (error) {
      toast.error("Erro ao criar lead");
    } finally {
      setSavingLead(false);
    }
  };

  const handleLeadSelect = (leadId: string, selected: boolean) => {
    setSelectedLeads(prev => selected ? [...prev, leadId] : prev.filter(id => id !== leadId));
  };

  const handleSelectAllInStage = (stageId: string) => {
    const stageLeadIds = getLeadsByStage(stageId).map(l => l.id);
    const allSelected = stageLeadIds.every(id => selectedLeads.includes(id));
    if (allSelected) {
      setSelectedLeads(prev => prev.filter(id => !stageLeadIds.includes(id)));
    } else {
      setSelectedLeads(prev => [...new Set([...prev, ...stageLeadIds])]);
    }
  };

  const isSelectionMode = selectedLeads.length > 0;
  const selectedOriginName = selectedOrigin
    ? originOptions.find(o => o.id === selectedOrigin)?.name
    : "Negócio";
  const stageOptions = stages.map(s => ({ id: s.id, name: s.name, color: s.color }));

  if (loading && !stages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Negócios da origem</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {selectedOriginName || "Funil"}
          </h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              setAddLeadStageId(undefined);
              setAddLeadOpen(true);
            }} className="gap-2 shrink-0" size="sm">
              <span className="hidden sm:inline">Negócio</span> <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0">
        <CRMFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          tagOptions={tagOptions}
          ownerOptions={ownerOptions}
          stageOptions={stageOptions}
          originOptions={originOptions}
          totalCount={filteredLeads.length}
          entityName={selectedOriginName || "Negócio"}
        />
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-3 sm:px-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 flex items-center gap-3 border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Forecast</p>
              <p className="text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredForecastTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground">{forecastData.length} negócio{forecastData.length !== 1 ? "s" : ""} aberto{forecastData.length !== 1 ? "s" : ""}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3 border-border/50">
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
              <Handshake className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Em Negociação</p>
              <p className="text-base font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(filteredNegotiationTotal)}
              </p>
              <p className="text-[10px] text-muted-foreground">{negotiationData.length} negócio{negotiationData.length !== 1 ? "s" : ""}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={dragScrollRef}
          className="h-full w-full overflow-x-auto overflow-y-hidden kanban-horizontal-scroll"
          style={{ cursor: isDraggingScroll ? 'grabbing' : 'grab' }}
          {...dragScrollBind}
        >
          <div className="h-full px-2 sm:px-4 pb-4">
            <div className="flex gap-2 sm:gap-3 h-full" style={{ minWidth: "max-content" }}>
              {stages.map(stage => (
                <ClientKanbanStageColumn
                  key={stage.id}
                  stage={stage}
                  leads={getLeadsByStage(stage.id)}
                  projectId={projectId}
                  selectedLeads={selectedLeads}
                  isSelectionMode={isSelectionMode}
                  draggedLeadId={draggedLead?.id || null}
                  onSelectLead={handleLeadSelect}
                  onSelectAllInStage={handleSelectAllInStage}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onRefresh={onRefresh}
                  onAddLead={(stageId) => {
                    setAddLeadStageId(stageId);
                    setAddLeadOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Lead Dialog */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Negócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newLead.name}
                onChange={e => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do lead"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={newLead.phone}
                  onChange={e => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={newLead.email}
                  onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@empresa.com"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Empresa</Label>
                <Input
                  value={newLead.company}
                  onChange={e => setNewLead(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Nome da empresa"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={newLead.opportunity_value}
                  onChange={e => setNewLead(prev => ({ ...prev, opportunity_value: e.target.value }))}
                  placeholder="R$ 0,00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={newLead.notes}
                onChange={e => setNewLead(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas sobre o lead..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateLead} disabled={savingLead || !newLead.name.trim()}>
              {savingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Negócio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Move Dialog */}
      <Dialog
        open={stageMoveDialog.open}
        onOpenChange={(open) => {
          if (!open && !movingLead) {
            setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para {stageMoveDialog.targetStageName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Adicione uma observação sobre a mudança de etapa..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStageMoveDialog({ open: false, leadId: "", targetStageId: "", targetStageName: "" })}
              disabled={movingLead}
            >
              Cancelar
            </Button>
            <Button onClick={confirmStageMove} disabled={movingLead}>
              {movingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

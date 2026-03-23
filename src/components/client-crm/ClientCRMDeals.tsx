import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ClientDeal, ClientStage, ClientContact, ClientPipeline, ClientActivity } from "./hooks/useClientCRM";
import { ClientCRMImportDialog } from "./ClientCRMImportDialog";

interface Props {
  deals: ClientDeal[];
  stages: ClientStage[];
  contacts: ClientContact[];
  pipelines: ClientPipeline[];
  activePipelineId: string | null;
  setActivePipelineId: (id: string | null) => void;
  activities: ClientActivity[];
  projectId: string;
  onCreateDeal: (deal: Partial<ClientDeal>) => Promise<void>;
  onUpdateDeal: (id: string, updates: Partial<ClientDeal>) => Promise<void>;
  onDeleteDeal: (id: string) => Promise<void>;
  onMoveDeal: (dealId: string, stageId: string) => Promise<void>;
  onCreateActivity: (activity: Partial<ClientActivity>) => Promise<void>;
  onCompleteActivity: (id: string) => Promise<void>;
  onRefresh: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const ClientCRMDeals = ({
  deals, stages, contacts, pipelines, activePipelineId, setActivePipelineId,
  activities, projectId, onCreateDeal, onUpdateDeal, onDeleteDeal, onMoveDeal,
  onCreateActivity, onCompleteActivity, onRefresh,
}: Props) => {
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<ClientDeal | null>(null);
  const [editingDeal, setEditingDeal] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: "", value: "", contact_id: "", notes: "", expected_close_date: "" });
  const [saving, setSaving] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<ClientDeal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [moveDialog, setMoveDialog] = useState<{ dealId: string; stageId: string; stageName: string } | null>(null);
  const [newActivity, setNewActivity] = useState({ title: "", type: "task", scheduled_at: "" });
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", value: "", contact_id: "", notes: "", expected_close_date: "" });

  const nonFinalStages = stages.filter(s => !s.is_final);
  const finalStages = stages.filter(s => s.is_final);

  const filteredDeals = useMemo(() => {
    if (!search) return deals;
    const s = search.toLowerCase();
    return deals.filter(d =>
      d.title.toLowerCase().includes(s) ||
      (d.contact as any)?.name?.toLowerCase().includes(s) ||
      d.notes?.toLowerCase().includes(s)
    );
  }, [deals, search]);

  const handleCreateDeal = async () => {
    if (!newDeal.title.trim()) return;
    setSaving(true);
    try {
      await onCreateDeal({
        title: newDeal.title,
        value: parseFloat(newDeal.value) || 0,
        contact_id: newDeal.contact_id || undefined,
        notes: newDeal.notes || undefined,
        expected_close_date: newDeal.expected_close_date || undefined,
      });
      setNewDeal({ title: "", value: "", contact_id: "", notes: "", expected_close_date: "" });
      setShowNewDeal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDeal = async () => {
    if (!selectedDeal || !editForm.title.trim()) return;
    setSaving(true);
    try {
      await onUpdateDeal(selectedDeal.id, {
        title: editForm.title,
        value: parseFloat(editForm.value) || 0,
        contact_id: editForm.contact_id || null,
        notes: editForm.notes || null,
        expected_close_date: editForm.expected_close_date || null,
      } as any);
      setEditingDeal(false);
      toast.success("Negócio atualizado");
      setSelectedDeal(null);
    } finally {
      setSaving(false);
    }
  };

  const openDealDetail = (deal: ClientDeal) => {
    setSelectedDeal(deal);
    setEditForm({
      title: deal.title,
      value: String(deal.value || 0),
      contact_id: deal.contact_id || "",
      notes: deal.notes || "",
      expected_close_date: deal.expected_close_date || "",
    });
    setEditingDeal(false);
    setShowNewActivity(false);
  };

  const handleDragStart = (e: React.DragEvent, deal: ClientDeal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedDeal || draggedDeal.stage_id === stageId) {
      setDraggedDeal(null);
      return;
    }
    const targetStage = stages.find(s => s.id === stageId);
    setMoveDialog({ dealId: draggedDeal.id, stageId, stageName: targetStage?.name || "" });
    setMoveNote("");
    setDraggedDeal(null);
  };

  const confirmMove = async () => {
    if (!moveDialog) return;
    setSaving(true);
    try {
      await onMoveDeal(moveDialog.dealId, moveDialog.stageId);
      toast.success(`Negócio movido para ${moveDialog.stageName}`);
      setMoveDialog(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDealActivity = async () => {
    if (!selectedDeal || !newActivity.title.trim()) return;
    setSaving(true);
    try {
      await onCreateActivity({
        deal_id: selectedDeal.id,
        contact_id: selectedDeal.contact_id || undefined,
        title: newActivity.title,
        type: newActivity.type,
        scheduled_at: newActivity.scheduled_at || undefined,
      });
      setNewActivity({ title: "", type: "task", scheduled_at: "" });
      setShowNewActivity(false);
    } finally {
      setSaving(false);
    }
  };

  const dealActivities = selectedDeal ? activities.filter(a => a.deal_id === selectedDeal.id) : [];
  const getStageTotal = (stageId: string) => filteredDeals.filter(d => d.stage_id === stageId).reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-lg">Pipeline</h3>
          {pipelines.length > 1 && (
            <Select value={activePipelineId || ""} onValueChange={setActivePipelineId}>
              <SelectTrigger className="h-8 w-[180px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 w-[180px]" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Novo Negócio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Negócio</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={newDeal.title} onChange={e => setNewDeal({ ...newDeal, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" value={newDeal.value} onChange={e => setNewDeal({ ...newDeal, value: e.target.value })} /></div>
                  <div><Label>Previsão</Label><Input type="date" value={newDeal.expected_close_date} onChange={e => setNewDeal({ ...newDeal, expected_close_date: e.target.value })} /></div>
                </div>
                <div><Label>Contato</Label>
                  <Select value={newDeal.contact_id} onValueChange={v => setNewDeal({ ...newDeal, contact_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
                    <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Observações</Label><Textarea value={newDeal.notes} onChange={e => setNewDeal({ ...newDeal, notes: e.target.value })} /></div>
                <Button onClick={handleCreateDeal} disabled={saving || !newDeal.title.trim()} className="w-full">
                  {saving ? "Salvando..." : "Criar Negócio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {nonFinalStages.map(stage => {
          const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id);
          const isOver = dragOverStage === stage.id;
          return (
            <div key={stage.id} className="min-w-[280px] max-w-[280px] flex-shrink-0"
              onDragOver={e => handleDragOver(e, stage.id)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, stage.id)}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium text-sm">{stage.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{stageDeals.length}</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground px-1 mb-2">{formatCurrency(getStageTotal(stage.id))}</div>
              <div className={`space-y-2 min-h-[100px] rounded-lg p-2 transition-colors ${isOver ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-muted/30"}`}>
                {stageDeals.map(deal => (
                  <Card key={deal.id} className="cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing"
                    draggable onDragStart={e => handleDragStart(e, deal)} onClick={() => openDealDetail(deal)}>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm mb-1 truncate">{deal.title}</p>
                      {deal.contact && <p className="text-xs text-muted-foreground truncate">{(deal.contact as any).name}</p>}
                      <p className="text-sm font-semibold text-primary mt-2">{formatCurrency(deal.value)}</p>
                      {deal.expected_close_date && <p className="text-[10px] text-muted-foreground mt-1">Prev: {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}</p>}
                    </CardContent>
                  </Card>
                ))}
                {stageDeals.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Arraste negócios aqui</p>}
              </div>
            </div>
          );
        })}
        {finalStages.map(stage => {
          const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id);
          return (
            <div key={stage.id} className="min-w-[200px] max-w-[200px] flex-shrink-0"
              onDragOver={e => handleDragOver(e, stage.id)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, stage.id)}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium text-sm">{stage.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{stageDeals.length}</Badge>
              </div>
              <div className={`rounded-lg p-3 text-center transition-colors ${dragOverStage === stage.id ? "bg-primary/10 border-2 border-dashed border-primary" : "bg-muted/30"}`}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageDeals.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stageDeals.reduce((s, d) => s + (d.value || 0), 0))}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Move Confirmation */}
      <Dialog open={!!moveDialog} onOpenChange={() => setMoveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover para {moveDialog?.stageName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Observação (opcional)</Label><Textarea value={moveNote} onChange={e => setMoveNote(e.target.value)} placeholder="Nota sobre essa movimentação..." /></div>
            <Button onClick={confirmMove} disabled={saving} className="w-full">{saving ? "Movendo..." : "Confirmar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deal Detail */}
      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {editingDeal ? <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /> : <>{selectedDeal.title}</>}
                  {!editingDeal && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingDeal(true)}><Pencil className="h-3.5 w-3.5" /></Button>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {editingDeal ? (
                  <div className="space-y-3 border rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Valor</Label><Input type="number" value={editForm.value} onChange={e => setEditForm({ ...editForm, value: e.target.value })} /></div>
                      <div><Label>Previsão</Label><Input type="date" value={editForm.expected_close_date} onChange={e => setEditForm({ ...editForm, expected_close_date: e.target.value })} /></div>
                    </div>
                    <div><Label>Contato</Label>
                      <Select value={editForm.contact_id} onValueChange={v => setEditForm({ ...editForm, contact_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Observações</Label><Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateDeal} disabled={saving} className="flex-1">{saving ? "Salvando..." : "Salvar"}</Button>
                      <Button variant="outline" onClick={() => setEditingDeal(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-lg">
                      <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold text-primary">{formatCurrency(selectedDeal.value)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Contato</p><p className="font-medium">{(selectedDeal.contact as any)?.name || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Etapa</p>
                        <Badge style={{ backgroundColor: (selectedDeal.stage as any)?.color }} className="text-white text-xs">{(selectedDeal.stage as any)?.name || "—"}</Badge>
                      </div>
                      <div><p className="text-xs text-muted-foreground">Previsão</p><p className="font-medium">{selectedDeal.expected_close_date ? new Date(selectedDeal.expected_close_date).toLocaleDateString("pt-BR") : "—"}</p></div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Mover para etapa</Label>
                      <Select value={selectedDeal.stage_id || ""} onValueChange={async stageId => { await onMoveDeal(selectedDeal.id, stageId); setSelectedDeal(null); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{stages.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name} {s.is_final && (s.final_type === "won" ? "✅" : "❌")}</div>
                          </SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </div>
                    {selectedDeal.notes && <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{selectedDeal.notes}</p></div>}
                  </>
                )}

                {/* Activities */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-sm">Atividades ({dealActivities.length})</p>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowNewActivity(!showNewActivity)}><Plus className="h-3.5 w-3.5" /> Atividade</Button>
                  </div>
                  {showNewActivity && (
                    <div className="space-y-2 p-3 border rounded-lg mb-3">
                      <Input placeholder="Título *" value={newActivity.title} onChange={e => setNewActivity({ ...newActivity, title: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={newActivity.type} onValueChange={v => setNewActivity({ ...newActivity, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="task">Tarefa</SelectItem><SelectItem value="call">Ligação</SelectItem>
                            <SelectItem value="meeting">Reunião</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="note">Nota</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="datetime-local" value={newActivity.scheduled_at} onChange={e => setNewActivity({ ...newActivity, scheduled_at: e.target.value })} />
                      </div>
                      <Button size="sm" onClick={handleCreateDealActivity} disabled={saving || !newActivity.title.trim()} className="w-full">Criar</Button>
                    </div>
                  )}
                  {dealActivities.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">Nenhuma atividade</p> : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {dealActivities.map(a => (
                        <div key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${a.status === "completed" ? "opacity-50" : ""}`}>
                          <button className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${a.status === "completed" ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground"}`}
                            onClick={() => a.status !== "completed" && onCompleteActivity(a.id)}>
                            {a.status === "completed" && "✓"}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${a.status === "completed" ? "line-through" : ""}`}>{a.title}</p>
                            <p className="text-[10px] text-muted-foreground">{a.type} {a.scheduled_at ? `• ${new Date(a.scheduled_at).toLocaleDateString("pt-BR")}` : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="destructive" size="sm" onClick={async () => { await onDeleteDeal(selectedDeal.id); setSelectedDeal(null); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

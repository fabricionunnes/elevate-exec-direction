import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, GripVertical, Trash2, Eye, X } from "lucide-react";
import type { ClientDeal, ClientStage, ClientContact } from "./hooks/useClientCRM";

interface Props {
  deals: ClientDeal[];
  stages: ClientStage[];
  contacts: ClientContact[];
  onCreateDeal: (deal: Partial<ClientDeal>) => Promise<void>;
  onUpdateDeal: (id: string, updates: Partial<ClientDeal>) => Promise<void>;
  onDeleteDeal: (id: string) => Promise<void>;
  onMoveDeal: (dealId: string, stageId: string) => Promise<void>;
}

export const ClientCRMDeals = ({ deals, stages, contacts, onCreateDeal, onUpdateDeal, onDeleteDeal, onMoveDeal }: Props) => {
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<ClientDeal | null>(null);
  const [newDeal, setNewDeal] = useState({ title: "", value: "", contact_id: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleCreateDeal = async () => {
    if (!newDeal.title.trim()) return;
    setSaving(true);
    try {
      await onCreateDeal({
        title: newDeal.title,
        value: parseFloat(newDeal.value) || 0,
        contact_id: newDeal.contact_id || undefined,
        notes: newDeal.notes || undefined,
      });
      setNewDeal({ title: "", value: "", contact_id: "", notes: "" });
      setShowNewDeal(false);
    } finally {
      setSaving(false);
    }
  };

  const nonFinalStages = stages.filter((s) => !s.is_final);
  const finalStages = stages.filter((s) => s.is_final);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Pipeline de Negócios</h3>
        <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Novo Negócio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Negócio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título do negócio *" value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} />
              <Input placeholder="Valor (R$)" type="number" value={newDeal.value} onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })} />
              <Select value={newDeal.contact_id} onValueChange={(v) => setNewDeal({ ...newDeal, contact_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular contato (opcional)" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea placeholder="Observações" value={newDeal.notes} onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })} />
              <Button onClick={handleCreateDeal} disabled={saving || !newDeal.title.trim()} className="w-full">
                {saving ? "Salvando..." : "Criar Negócio"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {nonFinalStages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          return (
            <div key={stage.id} className="min-w-[280px] max-w-[280px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium text-sm">{stage.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{stageDeals.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px] bg-muted/30 rounded-lg p-2">
                {stageDeals.map((deal) => (
                  <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDeal(deal)}>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm mb-1 truncate">{deal.title}</p>
                      {deal.contact && (
                        <p className="text-xs text-muted-foreground truncate">{deal.contact.name}</p>
                      )}
                      <p className="text-sm font-semibold text-primary mt-2">{formatCurrency(deal.value)}</p>
                    </CardContent>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum negócio</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Final stages summary */}
        {finalStages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          return (
            <div key={stage.id} className="min-w-[200px] max-w-[200px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-medium text-sm">{stage.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{stageDeals.length}</Badge>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageDeals.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(stageDeals.reduce((s, d) => s + (d.value || 0), 0))}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDeal?.title}</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Valor</label>
                  <p className="font-semibold">{formatCurrency(selectedDeal.value)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contato</label>
                  <p className="font-medium">{selectedDeal.contact?.name || "—"}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mover para etapa</label>
                <Select
                  value={selectedDeal.stage_id || ""}
                  onValueChange={async (stageId) => {
                    await onMoveDeal(selectedDeal.id, stageId);
                    setSelectedDeal(null);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDeal.notes && (
                <div>
                  <label className="text-xs text-muted-foreground">Observações</label>
                  <p className="text-sm">{selectedDeal.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="destructive" size="sm" onClick={async () => { await onDeleteDeal(selectedDeal.id); setSelectedDeal(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

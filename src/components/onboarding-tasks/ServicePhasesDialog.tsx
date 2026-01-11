import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

interface ServicePhase {
  id: string;
  service_id: string;
  name: string;
  sort_order: number;
  description: string | null;
  is_active: boolean;
}

interface ServicePhasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  serviceName: string;
}

export function ServicePhasesDialog({
  open,
  onOpenChange,
  serviceId,
  serviceName,
}: ServicePhasesDialogProps) {
  const [phases, setPhases] = useState<ServicePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ServicePhase | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchPhases();
    }
  }, [open, serviceId]);

  const fetchPhases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('onboarding_service_phases')
        .select('*')
        .eq('service_id', serviceId)
        .order('sort_order');

      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      console.error('Error fetching phases:', error);
      toast.error('Erro ao carregar fases');
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingPhase(null);
    setFormData({ name: '', description: '', is_active: true });
    setFormOpen(true);
  };

  const openEditForm = (phase: ServicePhase) => {
    setEditingPhase(phase);
    setFormData({
      name: phase.name,
      description: phase.description || '',
      is_active: phase.is_active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da fase é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingPhase) {
        const { error } = await supabase
          .from('onboarding_service_phases')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          })
          .eq('id', editingPhase.id);

        if (error) throw error;
        toast.success('Fase atualizada');
      } else {
        const maxOrder = phases.length > 0 
          ? Math.max(...phases.map(p => p.sort_order)) + 1 
          : 1;

        const { error } = await supabase
          .from('onboarding_service_phases')
          .insert({
            service_id: serviceId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            sort_order: maxOrder,
          });

        if (error) throw error;
        toast.success('Fase criada');
      }

      setFormOpen(false);
      fetchPhases();
    } catch (error: any) {
      console.error('Error saving phase:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma fase com este nome neste serviço');
      } else {
        toast.error('Erro ao salvar fase');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (phase: ServicePhase) => {
    if (!confirm(`Tem certeza que deseja excluir a fase "${phase.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('onboarding_service_phases')
        .delete()
        .eq('id', phase.id);

      if (error) throw error;
      toast.success('Fase excluída');
      fetchPhases();
    } catch (error) {
      console.error('Error deleting phase:', error);
      toast.error('Erro ao excluir fase');
    }
  };

  const movePhase = async (phaseId: string, direction: 'up' | 'down') => {
    const index = phases.findIndex(p => p.id === phaseId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;

    const newPhases = [...phases];
    const [movedPhase] = newPhases.splice(index, 1);
    newPhases.splice(newIndex, 0, movedPhase);

    // Update sort_order for all phases
    const updates = newPhases.map((phase, idx) => ({
      id: phase.id,
      sort_order: idx + 1,
    }));

    // Optimistic update
    setPhases(newPhases.map((p, idx) => ({ ...p, sort_order: idx + 1 })));

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('onboarding_service_phases')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error reordering phases:', error);
      toast.error('Erro ao reordenar fases');
      fetchPhases();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Fases do Serviço: {serviceName}</DialogTitle>
            <DialogDescription>
              Gerencie as fases de onboarding e defina a ordem de execução
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : phases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma fase cadastrada</p>
                <p className="text-sm">Clique em "Nova Fase" para adicionar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.map((phase, index) => (
                    <TableRow key={phase.id} className={!phase.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{phase.sort_order}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{phase.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm truncate max-w-[200px]">
                        {phase.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs ${phase.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {phase.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => movePhase(phase.id, 'up')}
                            disabled={index === 0}
                            className="h-7 w-7"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => movePhase(phase.id, 'down')}
                            disabled={index === phases.length - 1}
                            className="h-7 w-7"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditForm(phase)}
                            className="h-7 w-7"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(phase)}
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Fase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPhase ? 'Editar Fase' : 'Nova Fase'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phase-name">Nome *</Label>
              <Input
                id="phase-name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Diagnóstico, Implementação, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phase-description">Descrição</Label>
              <Textarea
                id="phase-description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição da fase..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Fase Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Fases inativas não aparecem nas opções de tarefas
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPhase ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, Filter as FunnelIcon, Sparkles, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FunnelAIGenerator } from "./FunnelAIGenerator";

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  status: string;
  created_at: string;
  stages_count?: number;
}

interface FunnelListViewProps {
  projectId: string;
  canEdit: boolean;
  onOpenFunnel: (id: string) => void;
}

export function FunnelListView({ projectId, canEdit, onOpenFunnel }: FunnelListViewProps) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", objective: "" });

  const fetchFunnels = async () => {
    const { data } = await supabase
      .from("sales_funnels")
      .select("*, sales_funnel_stages(id)")
      .eq("project_id", projectId)
      .eq("is_template", false)
      .order("created_at", { ascending: false });

    setFunnels(
      (data || []).map((f: any) => ({
        ...f,
        stages_count: f.sales_funnel_stages?.length || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchFunnels(); }, [projectId]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Nome é obrigatório"); return; }

    if (editingFunnel) {
      const { error } = await supabase.from("sales_funnels")
        .update({ name: formData.name, description: formData.description || null, objective: formData.objective || null })
        .eq("id", editingFunnel.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Funil atualizado");
    } else {
      const { error } = await supabase.from("sales_funnels")
        .insert({ project_id: projectId, name: formData.name, description: formData.description || null, objective: formData.objective || null });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Funil criado");
    }
    setShowCreateDialog(false);
    setEditingFunnel(null);
    setFormData({ name: "", description: "", objective: "" });
    fetchFunnels();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este funil?")) return;
    await supabase.from("sales_funnels").delete().eq("id", id);
    toast.success("Funil excluído");
    fetchFunnels();
  };

  const openEdit = (funnel: Funnel) => {
    setEditingFunnel(funnel);
    setFormData({ name: funnel.name, description: funnel.description || "", objective: funnel.objective || "" });
    setShowCreateDialog(true);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditingFunnel(null); setFormData({ name: "", description: "", objective: "" }); setShowCreateDialog(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Funil
          </Button>
          <Button onClick={() => setShowAIGenerator(true)} variant="outline" size="sm">
            <Sparkles className="h-4 w-4 mr-1" /> Gerar com IA
          </Button>
        </div>
      )}

      {funnels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FunnelIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhum funil criado ainda</p>
            <p className="text-sm">Crie um funil ou use a biblioteca de templates</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {funnels.map((funnel) => (
            <Card key={funnel.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onOpenFunnel(funnel.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{funnel.name}</CardTitle>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(funnel); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(funnel.id); }} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {funnel.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{funnel.description}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{funnel.stages_count} etapas</Badge>
                  <Badge variant={funnel.status === "active" ? "default" : "outline"}>
                    {funnel.status === "active" ? "Ativo" : "Rascunho"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFunnel ? "Editar Funil" : "Novo Funil de Vendas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Funil Principal" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do funil..." />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={formData.objective} onChange={(e) => setFormData({ ...formData, objective: e.target.value })} placeholder="Ex: Converter leads inbound" />
            </div>
            <Button onClick={handleSave} className="w-full">{editingFunnel ? "Salvar" : "Criar Funil"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <FunnelAIGenerator
        open={showAIGenerator}
        onOpenChange={setShowAIGenerator}
        projectId={projectId}
        onFunnelCreated={(id) => { fetchFunnels(); onOpenFunnel(id); }}
      />
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerPlanVersion } from "./types";

interface Props {
  projectId: string;
  versions: CareerPlanVersion[];
  activeVersion: CareerPlanVersion | null;
  canEdit: boolean;
  onRefresh: () => void;
  onSelectVersion: (v: CareerPlanVersion) => void;
}

export function CareerVersionsSection({ projectId, versions, activeVersion, canEdit, onRefresh, onSelectVersion }: Props) {
  const [newDialog, setNewDialog] = useState(false);
  const [newVersion, setNewVersion] = useState({ version_name: "", notes: "" });

  const handleCreate = async () => {
    const nextNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
    const { error } = await supabase.from("career_plan_versions").insert({
      project_id: projectId,
      version_number: nextNumber,
      version_name: newVersion.version_name || `Versão ${nextNumber}`,
      is_active: versions.length === 0,
      notes: newVersion.notes || null,
    } as any);
    if (error) { toast.error("Erro ao criar versão"); return; }
    toast.success("Versão criada!");
    setNewDialog(false);
    setNewVersion({ version_name: "", notes: "" });
    onRefresh();
  };

  const handleSetActive = async (id: string) => {
    // Deactivate all
    await supabase.from("career_plan_versions").update({ is_active: false } as any).eq("project_id", projectId);
    // Activate selected
    await supabase.from("career_plan_versions").update({ is_active: true } as any).eq("id", id);
    toast.success("Versão ativada!");
    onRefresh();
  };

  const handlePublish = async (id: string) => {
    await supabase.from("career_plan_versions").update({ is_published: true, published_at: new Date().toISOString() } as any).eq("id", id);
    toast.success("Versão publicada!");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Versões do Plano</h3>
        <Dialog open={newDialog} onOpenChange={setNewDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" disabled={!canEdit}><Plus className="h-4 w-4" />Nova Versão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Versão</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome da Versão</Label><Input value={newVersion.version_name} onChange={e => setNewVersion(p => ({ ...p, version_name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea value={newVersion.notes} onChange={e => setNewVersion(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleCreate}>Criar Versão</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {versions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma versão criada ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {versions.map(v => (
            <Card key={v.id} className={v.is_active ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">v{v.version_number} — {v.version_name || "Sem nome"}</p>
                      {v.is_active && <Badge>Ativa</Badge>}
                      {v.is_published && <Badge variant="secondary">Publicada</Badge>}
                      {v.generated_by_ai && <Badge variant="outline">IA</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Criada em {new Date(v.created_at).toLocaleDateString("pt-BR")}
                      {v.notes && ` • ${v.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onSelectVersion(v)} className="gap-1">
                      <Eye className="h-3 w-3" />Visualizar
                    </Button>
                    {!v.is_active && canEdit && (
                      <Button size="sm" variant="outline" onClick={() => handleSetActive(v.id)} className="gap-1">
                        <Check className="h-3 w-3" />Ativar
                      </Button>
                    )}
                    {!v.is_published && canEdit && (
                      <Button size="sm" onClick={() => handlePublish(v.id)}>Publicar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

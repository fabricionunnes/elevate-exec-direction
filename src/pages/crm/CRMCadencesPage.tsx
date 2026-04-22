import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Zap, MessageSquare, History, Settings as SettingsIcon } from "lucide-react";
import { CadenceEditorDialog } from "@/components/crm/cadences/CadenceEditorDialog";
import { CadenceEnrollmentsList } from "@/components/crm/cadences/CadenceEnrollmentsList";
import { CadenceMessagesLog } from "@/components/crm/cadences/CadenceMessagesLog";
import { CadenceGlobalSettingsDialog } from "@/components/crm/cadences/CadenceGlobalSettingsDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Cadence {
  id: string;
  name: string;
  description: string | null;
  scope: "pipeline" | "stage";
  pipeline_id: string | null;
  stage_id: string | null;
  is_active: boolean;
  stop_on_reply: boolean;
  stop_on_stage_change: boolean;
  pipeline?: { name: string } | null;
  stage?: { name: string } | null;
  step_count?: number;
}

export default function CRMCadencesPage() {
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cadence | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState("rules");

  const fetchCadences = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_cadences")
      .select("*, pipeline:crm_pipelines(name), stage:crm_stages(name)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cadências");
    } else {
      const ids = (data || []).map((c) => c.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: stepRows } = await supabase
          .from("crm_cadence_steps")
          .select("cadence_id")
          .in("cadence_id", ids);
        (stepRows || []).forEach((r: any) => {
          counts[r.cadence_id] = (counts[r.cadence_id] || 0) + 1;
        });
      }
      setCadences((data || []).map((c: any) => ({ ...c, step_count: counts[c.id] || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCadences(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("crm_cadences").update({ is_active: !current }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else {
      setCadences((p) => p.map((c) => (c.id === id ? { ...c, is_active: !current } : c)));
      toast.success(!current ? "Cadência ativada" : "Cadência pausada");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("crm_cadences").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else {
      setCadences((p) => p.filter((c) => c.id !== deleteId));
      toast.success("Cadência excluída");
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Central de Cadências
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mensagens automáticas para leads por funil ou etapa, com regras de horário e instância personalizáveis.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-4 w-4 mr-2" />
            Janela global
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova cadência
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rules" className="gap-2"><Zap className="h-4 w-4" />Cadências</TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-2"><MessageSquare className="h-4 w-4" />Em execução</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : cadences.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">Nenhuma cadência configurada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie cadências para enviar mensagens automáticas conforme leads avançam no funil.
                </p>
                <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Criar primeira cadência
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {cadences.map((c) => (
                <Card key={c.id} className={c.is_active ? "" : "opacity-60"}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h4 className="font-medium">{c.name}</h4>
                          <Badge variant={c.is_active ? "default" : "secondary"}>
                            {c.is_active ? "Ativa" : "Pausada"}
                          </Badge>
                          <Badge variant="outline">{c.step_count} mensagens</Badge>
                        </div>
                        {c.description && <p className="text-sm text-muted-foreground mb-2">{c.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <Badge variant="outline">
                            {c.scope === "pipeline" ? "Funil:" : "Etapa:"} {c.pipeline?.name || c.stage?.name}
                          </Badge>
                          {c.stop_on_reply && <span>• Para se responder</span>}
                          {c.stop_on_stage_change && <span>• Para se mudar etapa</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <CadenceEnrollmentsList />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <CadenceMessagesLog />
        </TabsContent>
      </Tabs>

      <CadenceEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={fetchCadences}
      />

      <CadenceGlobalSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Inscrições ativas serão removidas e o histórico de mensagens excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

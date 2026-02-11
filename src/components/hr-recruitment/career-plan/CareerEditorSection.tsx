import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Copy, GripVertical, ChevronDown, ChevronRight, DollarSign, Clock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerTrack, CareerRole, CareerPlanVersion } from "./types";
import { CRITERIA_TYPES } from "./types";

interface Props {
  activeVersion: CareerPlanVersion | null;
  tracks: CareerTrack[];
  canEdit: boolean;
  onRefresh: () => void;
}

export function CareerEditorSection({ activeVersion, tracks, canEdit, onRefresh }: Props) {
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [newTrackDialog, setNewTrackDialog] = useState(false);
  const [newRoleDialog, setNewRoleDialog] = useState<string | null>(null);
  const [editRoleDialog, setEditRoleDialog] = useState<CareerRole | null>(null);
  const [newTrack, setNewTrack] = useState({ name: "", description: "", track_type: "vertical", department: "" });
  const [newRole, setNewRole] = useState({ name: "", description: "", salary_min: "", salary_max: "", min_time_months: "", benefits: "" });

  if (!activeVersion) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Crie uma versão do plano de carreira primeiro.
        </CardContent>
      </Card>
    );
  }

  const handleAddTrack = async () => {
    const { error } = await supabase.from("career_tracks").insert({
      version_id: activeVersion.id,
      name: newTrack.name,
      description: newTrack.description || null,
      track_type: newTrack.track_type,
      department: newTrack.department || null,
      sort_order: tracks.length,
    } as any);
    if (error) { toast.error("Erro ao criar trilha"); return; }
    toast.success("Trilha criada!");
    setNewTrackDialog(false);
    setNewTrack({ name: "", description: "", track_type: "vertical", department: "" });
    onRefresh();
  };

  const handleDeleteTrack = async (id: string) => {
    const { error } = await supabase.from("career_tracks").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir trilha"); return; }
    toast.success("Trilha excluída");
    onRefresh();
  };

  const handleAddRole = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    const { error } = await supabase.from("career_roles").insert({
      track_id: trackId,
      name: newRole.name,
      description: newRole.description || null,
      level_order: (track?.roles?.length || 0),
      salary_min: newRole.salary_min ? Number(newRole.salary_min) : null,
      salary_max: newRole.salary_max ? Number(newRole.salary_max) : null,
      min_time_months: newRole.min_time_months ? Number(newRole.min_time_months) : null,
      benefits: newRole.benefits || null,
    } as any);
    if (error) { toast.error("Erro ao criar cargo"); return; }
    toast.success("Cargo criado!");
    setNewRoleDialog(null);
    setNewRole({ name: "", description: "", salary_min: "", salary_max: "", min_time_months: "", benefits: "" });
    onRefresh();
  };

  const handleDeleteRole = async (id: string) => {
    const { error } = await supabase.from("career_roles").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir cargo"); return; }
    toast.success("Cargo excluído");
    onRefresh();
  };

  const handleDuplicateRole = async (role: CareerRole) => {
    const { error } = await supabase.from("career_roles").insert({
      track_id: role.track_id,
      name: role.name + " (cópia)",
      description: role.description,
      level_order: role.level_order + 1,
      salary_base: role.salary_base,
      salary_min: role.salary_min,
      salary_max: role.salary_max,
      benefits: role.benefits,
      min_time_months: role.min_time_months,
      max_time_months: role.max_time_months,
    } as any);
    if (error) { toast.error("Erro ao duplicar"); return; }
    toast.success("Cargo duplicado!");
    onRefresh();
  };

  const handleAddCriterion = async (roleId: string) => {
    const { error } = await supabase.from("career_criteria").insert({
      role_id: roleId,
      name: "Novo Critério",
      weight: 1,
      min_score: 7,
      criteria_type: "performance",
    } as any);
    if (!error) onRefresh();
  };

  const handleAddGoal = async (roleId: string) => {
    const { error } = await supabase.from("career_goals").insert({
      role_id: roleId,
      title: "Nova Meta",
      goal_type: "quantitative",
    } as any);
    if (!error) onRefresh();
  };

  const handleDeleteCriterion = async (id: string) => {
    await supabase.from("career_criteria").delete().eq("id", id);
    onRefresh();
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from("career_goals").delete().eq("id", id);
    onRefresh();
  };

  const handleUpdateCriterion = async (id: string, field: string, value: any) => {
    await supabase.from("career_criteria").update({ [field]: value } as any).eq("id", id);
  };

  const handleUpdateGoal = async (id: string, field: string, value: any) => {
    await supabase.from("career_goals").update({ [field]: value } as any).eq("id", id);
  };

  const handleUpdateRole = async (id: string, field: string, value: any) => {
    await supabase.from("career_roles").update({ [field]: value } as any).eq("id", id);
  };

  const formatCurrency = (val: number | null) => val != null ? `R$ ${val.toLocaleString("pt-BR")}` : "-";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Estrutura do Plano — v{activeVersion.version_number}</h3>
        <Dialog open={newTrackDialog} onOpenChange={setNewTrackDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" disabled={!canEdit}><Plus className="h-4 w-4" />Nova Trilha</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Trilha de Carreira</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newTrack.name} onChange={e => setNewTrack(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newTrack.track_type} onValueChange={v => setNewTrack(p => ({ ...p, track_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Input value={newTrack.department} onChange={e => setNewTrack(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={newTrack.description} onChange={e => setNewTrack(p => ({ ...p, description: e.target.value }))} />
              </div>
              <Button onClick={handleAddTrack} disabled={!newTrack.name}>Criar Trilha</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tracks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma trilha de carreira criada ainda. Adicione uma trilha ou gere com IA.
          </CardContent>
        </Card>
      )}

      {tracks.map(track => (
        <Card key={track.id}>
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expandedTrack === track.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <CardTitle className="text-base">{track.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{track.description}</p>
                </div>
                <Badge variant={track.track_type === "vertical" ? "default" : "secondary"}>
                  {track.track_type === "vertical" ? "Vertical" : "Horizontal"}
                </Badge>
                {track.department && <Badge variant="outline">{track.department}</Badge>}
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteTrack(track.id)} disabled={!canEdit}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          {expandedTrack === track.id && (
            <CardContent className="space-y-3">
              {(track.roles || []).sort((a, b) => a.level_order - b.level_order).map((role, idx) => (
                <Card key={role.id} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{role.name}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(role.salary_min)} - {formatCurrency(role.salary_max)}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{role.min_time_months ? `${role.min_time_months} meses mín.` : "Sem prazo"}</span>
                            <span className="flex items-center gap-1"><Target className="h-3 w-3" />{role.criteria?.length || 0} critérios</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicateRole(role)} disabled={!canEdit}><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteRole(role.id)} disabled={!canEdit}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </div>

                    {expandedRole === role.id && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* Inline editing */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nome do Cargo</Label>
                            <Input defaultValue={role.name} onBlur={e => handleUpdateRole(role.id, "name", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Salário Mínimo</Label>
                            <Input type="number" defaultValue={role.salary_min || ""} onBlur={e => handleUpdateRole(role.id, "salary_min", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Salário Máximo</Label>
                            <Input type="number" defaultValue={role.salary_max || ""} onBlur={e => handleUpdateRole(role.id, "salary_max", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tempo Mínimo (meses)</Label>
                            <Input type="number" defaultValue={role.min_time_months || ""} onBlur={e => handleUpdateRole(role.id, "min_time_months", e.target.value ? Number(e.target.value) : null)} />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <Label className="text-xs">Benefícios</Label>
                            <Input defaultValue={role.benefits || ""} onBlur={e => handleUpdateRole(role.id, "benefits", e.target.value || null)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Descrição</Label>
                          <Textarea defaultValue={role.description || ""} onBlur={e => handleUpdateRole(role.id, "description", e.target.value || null)} rows={2} />
                        </div>

                        {/* Critérios */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Critérios de Evolução</Label>
                            <Button size="sm" variant="outline" onClick={() => handleAddCriterion(role.id)} disabled={!canEdit} className="gap-1"><Plus className="h-3 w-3" />Critério</Button>
                          </div>
                          {(role.criteria || []).map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-background p-2 rounded-md">
                              <Input defaultValue={c.name} className="flex-1 h-8 text-sm" onBlur={e => handleUpdateCriterion(c.id, "name", e.target.value)} />
                              <Select defaultValue={c.criteria_type} onValueChange={v => handleUpdateCriterion(c.id, "criteria_type", v)}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{CRITERIA_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                              </Select>
                              <Input type="number" defaultValue={c.weight} className="w-16 h-8 text-sm" onBlur={e => handleUpdateCriterion(c.id, "weight", Number(e.target.value))} placeholder="Peso" />
                              <Input type="number" defaultValue={c.min_score} className="w-20 h-8 text-sm" onBlur={e => handleUpdateCriterion(c.id, "min_score", Number(e.target.value))} placeholder="Nota mín." />
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteCriterion(c.id)} disabled={!canEdit}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          ))}
                        </div>

                        {/* Metas */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Metas do Cargo</Label>
                            <Button size="sm" variant="outline" onClick={() => handleAddGoal(role.id)} disabled={!canEdit} className="gap-1"><Plus className="h-3 w-3" />Meta</Button>
                          </div>
                          {(role.goals || []).map(g => (
                            <div key={g.id} className="flex items-center gap-2 bg-background p-2 rounded-md">
                              <Input defaultValue={g.title} className="flex-1 h-8 text-sm" onBlur={e => handleUpdateGoal(g.id, "title", e.target.value)} />
                              <Select defaultValue={g.goal_type} onValueChange={v => handleUpdateGoal(g.id, "goal_type", v)}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="quantitative">Quantitativa</SelectItem>
                                  <SelectItem value="qualitative">Qualitativa</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input defaultValue={g.target_value || ""} className="w-28 h-8 text-sm" onBlur={e => handleUpdateGoal(g.id, "target_value", e.target.value || null)} placeholder="Meta" />
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteGoal(g.id)} disabled={!canEdit}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Dialog open={newRoleDialog === track.id} onOpenChange={v => setNewRoleDialog(v ? track.id : null)}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 w-full" disabled={!canEdit}>
                    <Plus className="h-4 w-4" />Adicionar Cargo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo Cargo em {track.name}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Nome do Cargo</Label><Input value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Descrição</Label><Textarea value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Salário Mínimo</Label><Input type="number" value={newRole.salary_min} onChange={e => setNewRole(p => ({ ...p, salary_min: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Salário Máximo</Label><Input type="number" value={newRole.salary_max} onChange={e => setNewRole(p => ({ ...p, salary_max: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Tempo Mínimo (meses)</Label><Input type="number" value={newRole.min_time_months} onChange={e => setNewRole(p => ({ ...p, min_time_months: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Benefícios</Label><Input value={newRole.benefits} onChange={e => setNewRole(p => ({ ...p, benefits: e.target.value }))} /></div>
                    <Button onClick={() => handleAddRole(track.id)} disabled={!newRole.name}>Criar Cargo</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

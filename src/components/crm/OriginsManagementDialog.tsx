import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Folder,
  Target,
  Save,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OriginGroup {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface Origin {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  color: string | null;
  sort_order: number;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  pipeline_id: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
}

interface OriginsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export const OriginsManagementDialog = ({
  open,
  onOpenChange,
  onRefresh,
}: OriginsManagementDialogProps) => {
  const [groups, setGroups] = useState<OriginGroup[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedOrigins, setExpandedOrigins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<{
    type: "group" | "origin" | "stage";
    id: string | null;
    parentId?: string;
    pipelineId?: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");

  const colors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
    "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
    "#0ea5e9", "#3b82f6",
  ];

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, originsRes, pipelinesRes, stagesRes] = await Promise.all([
        supabase.from("crm_origin_groups").select("*").order("sort_order"),
        supabase.from("crm_origins").select("*").order("sort_order"),
        supabase.from("crm_pipelines").select("*").eq("is_active", true),
        supabase.from("crm_stages").select("*").order("sort_order"),
      ]);

      setGroups(groupsRes.data || []);
      setOrigins(originsRes.data || []);
      setPipelines(pipelinesRes.data || []);
      setStages(stagesRes.data || []);

      // Expand all groups
      if (groupsRes.data) {
        setExpandedGroups(new Set(groupsRes.data.map((g) => g.id)));
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleOrigin = (originId: string) => {
    setExpandedOrigins((prev) => {
      const next = new Set(prev);
      if (next.has(originId)) next.delete(originId);
      else next.add(originId);
      return next;
    });
  };

  const getGroupOrigins = (groupId: string) =>
    origins.filter((o) => o.group_id === groupId);

  const getOriginStages = (origin: Origin) => {
    if (!origin.pipeline_id) return [];
    return stages.filter((s) => s.pipeline_id === origin.pipeline_id);
  };

  // Add new group
  const handleAddGroup = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_origin_groups")
        .insert({
          name: "Novo Grupo",
          sort_order: groups.length,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setGroups([...groups, data]);
      setExpandedGroups((prev) => new Set([...prev, data.id]));
      setEditingItem({ type: "group", id: data.id });
      setEditName("Novo Grupo");
      toast.success("Grupo criado");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Erro ao criar grupo");
    }
  };

  // Add new origin (pipeline/funnel) to a group
  const handleAddOrigin = async (groupId: string) => {
    try {
      // First create a pipeline for this origin
      const { data: pipeline, error: pipelineError } = await supabase
        .from("crm_pipelines")
        .insert({
          name: "Novo Funil",
          is_active: true,
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // Create default stages for the pipeline
      const defaultStages = [
        { name: "Novo Lead", color: "#6366f1", sort_order: 0, is_final: false },
        { name: "Em Contato", color: "#f59e0b", sort_order: 1, is_final: false },
        { name: "Qualificado", color: "#22c55e", sort_order: 2, is_final: false },
        { name: "Proposta", color: "#3b82f6", sort_order: 3, is_final: false },
        { name: "Ganho", color: "#10b981", sort_order: 4, is_final: true, final_type: "won" },
        { name: "Perdido", color: "#ef4444", sort_order: 5, is_final: true, final_type: "lost" },
      ];

      const { error: stagesError } = await supabase
        .from("crm_stages")
        .insert(defaultStages.map((s) => ({ ...s, pipeline_id: pipeline.id })));

      if (stagesError) throw stagesError;

      // Create the origin linked to this pipeline
      const { data: origin, error: originError } = await supabase
        .from("crm_origins")
        .insert({
          name: "Novo Funil",
          group_id: groupId,
          pipeline_id: pipeline.id,
          sort_order: getGroupOrigins(groupId).length,
          is_active: true,
        })
        .select()
        .single();

      if (originError) throw originError;

      // Reload data
      loadData();
      setEditingItem({ type: "origin", id: origin.id, parentId: groupId });
      setEditName("Novo Funil");
      toast.success("Funil criado");
    } catch (error) {
      console.error("Error creating origin:", error);
      toast.error("Erro ao criar funil");
    }
  };

  // Add new stage to an origin's pipeline
  const handleAddStage = async (origin: Origin) => {
    if (!origin.pipeline_id) return;

    try {
      const existingStages = getOriginStages(origin);
      const { data, error } = await supabase
        .from("crm_stages")
        .insert({
          pipeline_id: origin.pipeline_id,
          name: "Nova Etapa",
          color: "#6366f1",
          sort_order: existingStages.length,
          is_final: false,
        })
        .select()
        .single();

      if (error) throw error;

      setStages([...stages, data]);
      setEditingItem({
        type: "stage",
        id: data.id,
        parentId: origin.id,
        pipelineId: origin.pipeline_id,
      });
      setEditName("Nova Etapa");
      setEditColor("#6366f1");
      toast.success("Etapa criada");
    } catch (error) {
      console.error("Error creating stage:", error);
      toast.error("Erro ao criar etapa");
    }
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.id) return;

    try {
      if (editingItem.type === "group") {
        const { error } = await supabase
          .from("crm_origin_groups")
          .update({ name: editName })
          .eq("id", editingItem.id);
        if (error) throw error;
        setGroups(groups.map((g) => (g.id === editingItem.id ? { ...g, name: editName } : g)));
      } else if (editingItem.type === "origin") {
        const { error } = await supabase
          .from("crm_origins")
          .update({ name: editName })
          .eq("id", editingItem.id);
        if (error) throw error;
        setOrigins(origins.map((o) => (o.id === editingItem.id ? { ...o, name: editName } : o)));

        // Also update the pipeline name
        const origin = origins.find((o) => o.id === editingItem.id);
        if (origin?.pipeline_id) {
          await supabase
            .from("crm_pipelines")
            .update({ name: editName })
            .eq("id", origin.pipeline_id);
        }
      } else if (editingItem.type === "stage") {
        const { error } = await supabase
          .from("crm_stages")
          .update({ name: editName, color: editColor })
          .eq("id", editingItem.id);
        if (error) throw error;
        setStages(
          stages.map((s) =>
            s.id === editingItem.id ? { ...s, name: editName, color: editColor } : s
          )
        );
      }

      toast.success("Salvo com sucesso");
      setEditingItem(null);
      onRefresh?.();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    }
  };

  // Delete item
  const handleDelete = async (type: "group" | "origin" | "stage", id: string) => {
    try {
      if (type === "group") {
        // Check if group has origins
        const groupOrigins = getGroupOrigins(id);
        if (groupOrigins.length > 0) {
          toast.error("Remova todos os funis antes de excluir o grupo");
          return;
        }
        const { error } = await supabase.from("crm_origin_groups").delete().eq("id", id);
        if (error) throw error;
        setGroups(groups.filter((g) => g.id !== id));
      } else if (type === "origin") {
        const origin = origins.find((o) => o.id === id);
        const { error } = await supabase.from("crm_origins").delete().eq("id", id);
        if (error) throw error;
        // Also delete the pipeline
        if (origin?.pipeline_id) {
          await supabase.from("crm_pipelines").delete().eq("id", origin.pipeline_id);
        }
        setOrigins(origins.filter((o) => o.id !== id));
      } else if (type === "stage") {
        const { error } = await supabase.from("crm_stages").delete().eq("id", id);
        if (error) throw error;
        setStages(stages.filter((s) => s.id !== id));
      }

      toast.success("Excluído com sucesso");
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    }
  };

  // Move origin to another group
  const handleMoveOrigin = async (originId: string, newGroupId: string) => {
    try {
      const { error } = await supabase
        .from("crm_origins")
        .update({ group_id: newGroupId })
        .eq("id", originId);

      if (error) throw error;

      setOrigins(origins.map((o) => 
        o.id === originId ? { ...o, group_id: newGroupId } : o
      ));

      toast.success("Funil movido com sucesso");
      onRefresh?.();
    } catch (error) {
      console.error("Error moving origin:", error);
      toast.error("Erro ao mover funil");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerenciar Origens e Funis</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => {
                const groupOrigins = getGroupOrigins(group.id);
                const isExpanded = expandedGroups.has(group.id);
                const isEditing = editingItem?.type === "group" && editingItem.id === group.id;

                return (
                  <div key={group.id} className="border border-border rounded-lg">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(group.id)}>
                      <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 rounded-t-lg">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Folder className="h-4 w-4 text-muted-foreground" />

                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                            />
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium flex-1 text-left">{group.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {groupOrigins.length} funil(is)
                            </span>
                          </>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem({ type: "group", id: group.id });
                                setEditName(group.name);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddOrigin(group.id);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Funil
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete("group", group.id);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border">
                          {groupOrigins.map((origin) => {
                            const originStages = getOriginStages(origin);
                            const isOriginExpanded = expandedOrigins.has(origin.id);
                            const isOriginEditing =
                              editingItem?.type === "origin" && editingItem.id === origin.id;

                            return (
                              <div key={origin.id} className="border-b border-border last:border-b-0">
                                <Collapsible
                                  open={isOriginExpanded}
                                  onOpenChange={() => toggleOrigin(origin.id)}
                                >
                                  <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/30">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                                    {isOriginExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                    <Target className="h-3.5 w-3.5 text-primary" />

                                    {isOriginEditing ? (
                                      <div
                                        className="flex items-center gap-2 flex-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Input
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          className="h-6 text-sm"
                                          autoFocus
                                        />
                                        <Button size="sm" className="h-6" onClick={handleSaveEdit}>
                                          <Save className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-sm flex-1 text-left">{origin.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {originStages.length} etapa(s)
                                        </span>
                                      </>
                                    )}

                                    <DropdownMenu>
                                      <DropdownMenuTrigger
                                        asChild
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <MoreHorizontal className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingItem({
                                              type: "origin",
                                              id: origin.id,
                                              parentId: group.id,
                                            });
                                            setEditName(origin.name);
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddStage(origin);
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Adicionar Etapa
                                        </DropdownMenuItem>
                                        
                                        {/* Move to another group */}
                                        {groups.length > 1 && (
                                          <div className="px-2 py-1.5">
                                            <Label className="text-xs text-muted-foreground mb-1 block">
                                              Mover para grupo:
                                            </Label>
                                            <Select
                                              value={origin.group_id || ""}
                                              onValueChange={(newGroupId) => {
                                                if (newGroupId !== origin.group_id) {
                                                  handleMoveOrigin(origin.id, newGroupId);
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Selecionar grupo" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {groups
                                                  .filter((g) => g.id !== origin.group_id)
                                                  .map((g) => (
                                                    <SelectItem key={g.id} value={g.id}>
                                                      {g.name}
                                                    </SelectItem>
                                                  ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}
                                        
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete("origin", origin.id);
                                          }}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="pl-12 pr-4 pb-2 space-y-1">
                                      {originStages.map((stage) => {
                                        const isStageEditing =
                                          editingItem?.type === "stage" &&
                                          editingItem.id === stage.id;

                                        return (
                                          <div
                                            key={stage.id}
                                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30"
                                          >
                                            <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                                            <span
                                              className="w-3 h-3 rounded-full"
                                              style={{ backgroundColor: stage.color }}
                                            />

                                            {isStageEditing ? (
                                              <div
                                                className="flex items-center gap-2 flex-1"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <Input
                                                  value={editName}
                                                  onChange={(e) => setEditName(e.target.value)}
                                                  className="h-6 text-xs flex-1"
                                                  autoFocus
                                                />
                                                <div className="flex gap-1">
                                                  {colors.slice(0, 6).map((c) => (
                                                    <button
                                                      key={c}
                                                      className={cn(
                                                        "w-4 h-4 rounded-full border",
                                                        editColor === c
                                                          ? "border-foreground"
                                                          : "border-transparent"
                                                      )}
                                                      style={{ backgroundColor: c }}
                                                      onClick={() => setEditColor(c)}
                                                    />
                                                  ))}
                                                </div>
                                                <Button
                                                  size="sm"
                                                  className="h-6"
                                                  onClick={handleSaveEdit}
                                                >
                                                  <Save className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <>
                                                <span className="text-xs flex-1">{stage.name}</span>
                                                {stage.is_final && (
                                                  <span
                                                    className={cn(
                                                      "text-[10px] px-1.5 py-0.5 rounded",
                                                      stage.final_type === "won"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                    )}
                                                  >
                                                    {stage.final_type === "won" ? "Ganho" : "Perdido"}
                                                  </span>
                                                )}
                                              </>
                                            )}

                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-5 w-5"
                                                >
                                                  <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    setEditingItem({
                                                      type: "stage",
                                                      id: stage.id,
                                                      parentId: origin.id,
                                                      pipelineId: origin.pipeline_id || undefined,
                                                    });
                                                    setEditName(stage.name);
                                                    setEditColor(stage.color);
                                                  }}
                                                >
                                                  <Pencil className="h-4 w-4 mr-2" />
                                                  Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() => handleDelete("stage", stage.id)}
                                                  className="text-red-600"
                                                >
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Excluir
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        );
                                      })}

                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs text-muted-foreground h-7"
                                        onClick={() => handleAddStage(origin)}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Adicionar etapa
                                      </Button>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            );
                          })}

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs text-muted-foreground h-8 rounded-none"
                            onClick={() => handleAddOrigin(group.id)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Adicionar funil
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}

              {/* Add Group Button */}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleAddGroup}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Grupo de Origem
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

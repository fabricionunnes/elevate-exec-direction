import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Save,
  Palette
} from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_STAGES } from "../types";

interface HRSettingsTabProps {
  projectId: string;
}

interface CustomStage {
  id: string;
  name: string;
  stage_key: string;
  sort_order: number;
  color: string;
  is_default: boolean;
}

export function HRSettingsTab({ projectId }: HRSettingsTabProps) {
  const [stages, setStages] = useState<CustomStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStages();
  }, [projectId]);

  const fetchStages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hiring_pipeline_stages")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");

    if (error) {
      console.error("Error fetching stages:", error);
    } else if (data && data.length > 0) {
      setStages(data);
    } else {
      // Initialize with default stages if none exist
      const defaultStages = PIPELINE_STAGES.map((s, i) => ({
        id: `temp-${i}`,
        project_id: projectId,
        name: s.name,
        stage_key: s.key,
        sort_order: i,
        color: s.color,
        is_default: false, // Allow deletion of all stages
      }));
      setStages(defaultStages as CustomStage[]);
    }
    setLoading(false);
  };

  const handleSaveStages = async () => {
    setSaving(true);
    try {
      // Delete existing stages
      await supabase
        .from("hiring_pipeline_stages")
        .delete()
        .eq("project_id", projectId);

      // Insert new stages
      const stagesToInsert = stages.map((s, i) => ({
        project_id: projectId,
        name: s.name,
        stage_key: s.stage_key,
        sort_order: i,
        color: s.color,
        is_default: false, // All stages can be deleted
      }));

      const { error } = await supabase
        .from("hiring_pipeline_stages")
        .insert(stagesToInsert);

      if (error) throw error;

      toast.success("Etapas salvas com sucesso!");
      fetchStages();
    } catch (error) {
      console.error("Error saving stages:", error);
      toast.error("Erro ao salvar etapas");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = () => {
    const newStage: CustomStage = {
      id: `new-${Date.now()}`,
      name: "Nova Etapa",
      stage_key: `custom_${Date.now()}`,
      sort_order: stages.length,
      color: "#6366f1",
      is_default: false,
    };
    setStages([...stages, newStage]);
  };

  const handleRemoveStage = (id: string) => {
    setStages(stages.filter((s) => s.id !== id));
  };

  const handleUpdateStage = (id: string, field: keyof CustomStage, value: string) => {
    setStages(stages.map((s) => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const colors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
    "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
    "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
    "#0ea5e9", "#3b82f6", "#6366f1",
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-12 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Etapas do Pipeline</CardTitle>
          <CardDescription>
            Configure as etapas do processo seletivo para este projeto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stages.map((stage, index) => (
            <div 
              key={stage.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
              
              <div 
                className="w-6 h-6 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />

              <Input
                value={stage.name}
                onChange={(e) => handleUpdateStage(stage.id, "name", e.target.value)}
                className="flex-1"
              />

              <div className="flex gap-1">
                {colors.slice(0, 8).map((color) => (
                  <button
                    key={color}
                    className={`w-5 h-5 rounded-full border-2 ${
                      stage.color === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleUpdateStage(stage.id, "color", color)}
                  />
                ))}
              </div>

              {stages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleRemoveStage(stage.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleAddStage}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Etapa
            </Button>
            <Button onClick={handleSaveStages} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Other Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>
            Outras configurações do módulo de RH
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Mais configurações serão adicionadas em breve, incluindo:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
              <li>Templates de email para candidatos</li>
              <li>Integração com WhatsApp</li>
              <li>Configuração de notificações</li>
              <li>Permissões por cargo</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

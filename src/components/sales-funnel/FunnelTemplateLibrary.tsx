import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Library, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  segment: string | null;
  stages_json: any[];
  connections_json: any[];
}

interface Props {
  projectId: string;
  canEdit: boolean;
  onFunnelCreated: (id: string) => void;
}

export function FunnelTemplateLibrary({ projectId, canEdit, onFunnelCreated }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("sales_funnel_templates").select("*").eq("is_active", true).order("category")
      .then(({ data }) => { setTemplates((data || []).map((d: any) => ({ ...d, stages_json: d.stages_json as any[] || [], connections_json: d.connections_json as any[] || [] }))); setLoading(false); });
  }, []);

  const handleImport = async (template: Template) => {
    if (!canEdit) return;
    setImporting(template.id);
    try {
      // Create funnel
      const { data: funnel, error: funnelErr } = await supabase.from("sales_funnels")
        .insert({ project_id: projectId, name: template.name, description: template.description })
        .select("id")
        .single();

      if (funnelErr || !funnel) throw funnelErr;

      // Create stages
      const stagesData = (template.stages_json as any[]).map((s: any, idx: number) => ({
        funnel_id: funnel.id,
        name: s.name,
        stage_type: s.type || "custom",
        position_x: s.x || 400,
        position_y: s.y || idx * 100 + 50,
        color: s.color || "#3b82f6",
        sort_order: idx,
      }));

      const { data: createdStages, error: stagesErr } = await supabase.from("sales_funnel_stages")
        .insert(stagesData)
        .select("id");

      if (stagesErr) throw stagesErr;

      // Create connections
      if (createdStages && template.connections_json) {
        const conns = (template.connections_json as any[]).map((c: any) => ({
          funnel_id: funnel.id,
          from_stage_id: createdStages[c.from]?.id,
          to_stage_id: createdStages[c.to]?.id,
        })).filter(c => c.from_stage_id && c.to_stage_id);

        if (conns.length > 0) {
          await supabase.from("sales_funnel_connections").insert(conns);
        }
      }

      toast.success(`Funil "${template.name}" importado com sucesso`);
      onFunnelCreated(funnel.id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar template");
    } finally {
      setImporting(null);
    }
  };

  const categoryLabels: Record<string, string> = {
    b2b: "B2B",
    inbound: "Inbound",
    outbound: "Outbound",
    high_ticket: "High Ticket",
    servicos: "Serviços",
    reativacao: "Reativação",
    geral: "Geral",
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Library className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Biblioteca de Funis</h3>
      </div>
      <p className="text-sm text-muted-foreground">Escolha um modelo pronto e importe para seu projeto. Você pode editá-lo depois.</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{categoryLabels[template.category] || template.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {template.description && (
                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
              )}
              {template.segment && (
                <p className="text-xs text-muted-foreground mb-2">Segmento: {template.segment}</p>
              )}
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <span>{(template.stages_json as any[]).length} etapas</span>
                <ArrowRight className="h-3 w-3" />
                <span>{(template.connections_json as any[]).length} conexões</span>
              </div>

              {/* Mini preview */}
              <div className="flex flex-wrap gap-1 mb-3">
                {(template.stages_json as any[]).slice(0, 5).map((s: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[9px]" style={{ borderColor: s.color }}>
                    {s.name}
                  </Badge>
                ))}
                {(template.stages_json as any[]).length > 5 && (
                  <Badge variant="outline" className="text-[9px]">+{(template.stages_json as any[]).length - 5}</Badge>
                )}
              </div>

              {canEdit && (
                <Button size="sm" className="w-full" disabled={importing === template.id} onClick={() => handleImport(template)}>
                  <Download className="h-4 w-4 mr-1" />
                  {importing === template.id ? "Importando..." : "Importar para meu projeto"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Plus, FileText } from "lucide-react";

interface Pipeline {
  id: string;
  name: string;
}

interface PipelineForm {
  id: string;
  pipeline_id: string;
  form_token: string;
  title: string | null;
  description: string | null;
  is_active: boolean;
  origin_name: string | null;
  pipeline_name?: string;
}

export const PipelineFormsManager = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [forms, setForms] = useState<PipelineForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pipelinesRes, formsRes] = await Promise.all([
      supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
      supabase.from("crm_pipeline_forms").select("*").order("created_at", { ascending: false }),
    ]);

    setPipelines(pipelinesRes.data || []);
    setForms(formsRes.data || []);
    setLoading(false);
  };

  const createForm = async (pipelineId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    const { error } = await supabase.from("crm_pipeline_forms").insert({
      pipeline_id: pipelineId,
      title: `Formulário - ${pipeline?.name || "Pipeline"}`,
      origin_name: `Formulário ${pipeline?.name || ""}`.trim(),
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Este pipeline já possui um formulário");
      } else {
        toast.error("Erro ao criar formulário");
      }
      return;
    }

    toast.success("Formulário criado!");
    loadData();
  };

  const toggleForm = async (formId: string, isActive: boolean) => {
    await supabase.from("crm_pipeline_forms").update({ is_active: isActive }).eq("id", formId);
    setForms((prev) => prev.map((f) => (f.id === formId ? { ...f, is_active: isActive } : f)));
  };

  const updateFormField = async (formId: string, field: string, value: string) => {
    await supabase.from("crm_pipeline_forms").update({ [field]: value }).eq("id", formId);
    toast.success("Salvo!");
    loadData();
  };

  const getFormUrl = (token: string) => {
    return `${window.location.origin}/#/form/${token}`;
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyUrl = (token: string, formId: string) => {
    navigator.clipboard.writeText(getFormUrl(token));
    setCopiedId(formId);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pipelinesWithoutForm = pipelines.filter(
    (p) => !forms.some((f) => f.pipeline_id === p.id)
  );

  const getPipelineName = (pipelineId: string) =>
    pipelines.find((p) => p.id === pipelineId)?.name || "Pipeline";

  if (loading) return <div className="animate-pulse space-y-3"><div className="h-20 bg-muted rounded" /><div className="h-20 bg-muted rounded" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Formulários por Pipeline
        </h3>
      </div>

      {pipelinesWithoutForm.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-3">Criar formulário para:</p>
            <div className="flex flex-wrap gap-2">
              {pipelinesWithoutForm.map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => createForm(p.id)} className="gap-1.5">
                  <Plus className="h-3 w-3" />
                  {p.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {forms.map((form) => (
        <Card key={form.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {getPipelineName(form.pipeline_id)}
                <Badge variant={form.is_active ? "default" : "secondary"} className="text-[10px]">
                  {form.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <Switch checked={form.is_active} onCheckedChange={(v) => toggleForm(form.id, v)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Título do formulário</Label>
                <Input
                  defaultValue={form.title || ""}
                  onBlur={(e) => updateFormField(form.id, "title", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome da origem (rastreio)</Label>
                <Input
                  defaultValue={form.origin_name || ""}
                  onBlur={(e) => updateFormField(form.id, "origin_name", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Link do formulário</Label>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate">
                  {getFormUrl(form.form_token)}
                </code>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => copyUrl(form.form_token, form.id)}>
                  {copiedId === form.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild>
                  <a href={getFormUrl(form.form_token)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">
                <strong>UTM Tracking:</strong> Adicione parâmetros UTM ao link para rastrear a origem dos leads.
                <br />
                Exemplo: <code className="text-[10px]">?utm_source=instagram&utm_medium=ads&utm_campaign=black-friday</code>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      {forms.length === 0 && pipelinesWithoutForm.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum pipeline ativo encontrado.</p>
      )}
    </div>
  );
};

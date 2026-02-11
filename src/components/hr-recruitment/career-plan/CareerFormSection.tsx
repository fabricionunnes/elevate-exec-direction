import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GROWTH_PREFERENCES, VALUES_MOST, RAISE_POLICIES, EVALUATION_FREQUENCIES, GOAL_TYPE_OPTIONS } from "./types";
import type { CareerPlanForm } from "./types";

interface Props {
  projectId: string;
  canEdit: boolean;
  forms: CareerPlanForm[];
  onRefresh: () => void;
  onGenerateAI: (formId: string) => void;
  generating: boolean;
}

export function CareerFormSection({ projectId, canEdit, forms, onRefresh, onGenerateAI, generating }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    respondent_name: "",
    respondent_role: "",
    company_segment: "",
    employee_count: "",
    current_role_structure: "",
    company_culture_type: "",
    has_career_plan: false,
    current_career_plan_details: "",
    growth_preference: "",
    values_most: "",
    salary_ranges: "",
    raise_policy: "",
    benefits_by_level: "",
    current_evaluation_criteria: "",
    evaluation_frequency: "",
    uses_goals: false,
    goal_types: [] as string[],
    additional_notes: "",
  });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("career_plan_forms").insert({
      project_id: projectId,
      ...formData,
      is_complete: true,
    } as any);

    if (error) {
      toast.error("Erro ao salvar formulário");
    } else {
      toast.success("Formulário salvo com sucesso!");
      setShowForm(false);
      onRefresh();
    }
    setSaving(false);
  };

  const toggleGoalType = (val: string) => {
    setFormData(prev => ({
      ...prev,
      goal_types: prev.goal_types.includes(val)
        ? prev.goal_types.filter(g => g !== val)
        : [...prev.goal_types, val],
    }));
  };

  return (
    <div className="space-y-6">
      {forms.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Formulários Respondidos</h3>
          {forms.map(form => (
            <Card key={form.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{form.respondent_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">
                      {form.respondent_role} • {new Date(form.submitted_at).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Segmento: {form.company_segment} • {form.employee_count} colaboradores
                    </p>
                  </div>
                  <Button
                    onClick={() => onGenerateAI(form.id)}
                    disabled={generating}
                    className="gap-2"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Gerar Plano com IA
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button onClick={() => setShowForm(true)} disabled={!canEdit} className="gap-2">
          <Send className="h-4 w-4" />
          Novo Formulário Estratégico
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Formulário Estratégico de Plano de Carreira</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informações Gerais */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Informações Gerais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Respondente</Label>
                  <Input value={formData.respondent_name} onChange={e => setFormData(p => ({ ...p, respondent_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo/Função</Label>
                  <Input value={formData.respondent_role} onChange={e => setFormData(p => ({ ...p, respondent_role: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Segmento da Empresa</Label>
                  <Input value={formData.company_segment} onChange={e => setFormData(p => ({ ...p, company_segment: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Número de Colaboradores</Label>
                  <Input value={formData.employee_count} onChange={e => setFormData(p => ({ ...p, employee_count: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estrutura Atual de Cargos</Label>
                <Textarea value={formData.current_role_structure} onChange={e => setFormData(p => ({ ...p, current_role_structure: e.target.value }))} placeholder="Descreva os cargos existentes na empresa..." />
              </div>
              <div className="space-y-2">
                <Label>Cultura da Empresa</Label>
                <Input value={formData.company_culture_type} onChange={e => setFormData(p => ({ ...p, company_culture_type: e.target.value }))} placeholder="Ex: técnica, comercial, operacional..." />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.has_career_plan} onCheckedChange={v => setFormData(p => ({ ...p, has_career_plan: v }))} />
                <Label>Já possui plano de carreira?</Label>
              </div>
              {formData.has_career_plan && (
                <div className="space-y-2">
                  <Label>Detalhes do Plano Atual</Label>
                  <Textarea value={formData.current_career_plan_details} onChange={e => setFormData(p => ({ ...p, current_career_plan_details: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Estratégia de Crescimento */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Estratégia de Crescimento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferência de Crescimento</Label>
                  <Select value={formData.growth_preference} onValueChange={v => setFormData(p => ({ ...p, growth_preference: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {GROWTH_PREFERENCES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>O que a empresa mais valoriza</Label>
                  <Select value={formData.values_most} onValueChange={v => setFormData(p => ({ ...p, values_most: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {VALUES_MOST.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Política de Remuneração */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Política de Remuneração</h4>
              <div className="space-y-2">
                <Label>Faixas Salariais por Nível</Label>
                <Textarea value={formData.salary_ranges} onChange={e => setFormData(p => ({ ...p, salary_ranges: e.target.value }))} placeholder="Descreva as faixas salariais atuais..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Política de Aumento</Label>
                  <Select value={formData.raise_policy} onValueChange={v => setFormData(p => ({ ...p, raise_policy: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {RAISE_POLICIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Benefícios por Nível</Label>
                <Textarea value={formData.benefits_by_level} onChange={e => setFormData(p => ({ ...p, benefits_by_level: e.target.value }))} placeholder="Descreva os benefícios oferecidos..." />
              </div>
            </div>

            {/* Avaliação e Performance */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Avaliação e Performance</h4>
              <div className="space-y-2">
                <Label>Critérios de Avaliação Atuais</Label>
                <Textarea value={formData.current_evaluation_criteria} onChange={e => setFormData(p => ({ ...p, current_evaluation_criteria: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Periodicidade de Avaliação</Label>
                <Select value={formData.evaluation_frequency} onValueChange={v => setFormData(p => ({ ...p, evaluation_frequency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {EVALUATION_FREQUENCIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.uses_goals} onCheckedChange={v => setFormData(p => ({ ...p, uses_goals: v }))} />
                <Label>Utiliza metas?</Label>
              </div>
              {formData.uses_goals && (
                <div className="space-y-2">
                  <Label>Tipos de Metas</Label>
                  <div className="flex flex-wrap gap-3">
                    {GOAL_TYPE_OPTIONS.map(o => (
                      <div key={o.value} className="flex items-center gap-2">
                        <Checkbox checked={formData.goal_types.includes(o.value)} onCheckedChange={() => toggleGoalType(o.value)} />
                        <span className="text-sm">{o.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Observações Adicionais</Label>
              <Textarea value={formData.additional_notes} onChange={e => setFormData(p => ({ ...p, additional_notes: e.target.value }))} />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Salvar Formulário
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

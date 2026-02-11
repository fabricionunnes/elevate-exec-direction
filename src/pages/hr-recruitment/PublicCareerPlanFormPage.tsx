import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, CheckCircle2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GROWTH_PREFERENCES, VALUES_MOST, RAISE_POLICIES, EVALUATION_FREQUENCIES, GOAL_TYPE_OPTIONS } from "@/components/hr-recruitment/career-plan/types";

export default function PublicCareerPlanFormPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    respondent_name: "",
    respondent_role: "",
    respondent_email: "",
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

  const toggleGoalType = (val: string) => {
    setFormData(prev => ({
      ...prev,
      goal_types: prev.goal_types.includes(val)
        ? prev.goal_types.filter(g => g !== val)
        : [...prev.goal_types, val],
    }));
  };

  const handleSave = async () => {
    if (!projectId) {
      toast.error("Link inválido: projeto não identificado");
      return;
    }
    if (!formData.respondent_name.trim()) {
      toast.error("Preencha seu nome");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("career_plan_forms").insert({
      project_id: projectId,
      ...formData,
      is_complete: true,
      submitted_at: new Date().toISOString(),
    } as any);

    if (error) {
      console.error(error);
      toast.error("Erro ao enviar formulário");
    } else {
      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    }
    setSaving(false);
  };

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Link inválido</p>
            <p className="text-sm text-muted-foreground mt-2">Este link não contém as informações necessárias.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Formulário Enviado!</h2>
            <p className="text-muted-foreground">Suas respostas foram registradas com sucesso. Nossa equipe irá gerar o plano de carreira personalizado com base nas suas informações.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Formulário Estratégico de Plano de Carreira</h1>
          <p className="text-muted-foreground">Responda as perguntas abaixo para que possamos construir um plano de carreira personalizado para sua empresa.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seu Nome *</Label>
                <Input value={formData.respondent_name} onChange={e => setFormData(p => ({ ...p, respondent_name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Seu Cargo/Função</Label>
                <Input value={formData.respondent_role} onChange={e => setFormData(p => ({ ...p, respondent_role: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={formData.respondent_email} onChange={e => setFormData(p => ({ ...p, respondent_email: e.target.value }))} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estratégia de Crescimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Política de Remuneração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Faixas Salariais por Nível</Label>
              <Textarea value={formData.salary_ranges} onChange={e => setFormData(p => ({ ...p, salary_ranges: e.target.value }))} placeholder="Descreva as faixas salariais atuais..." />
            </div>
            <div className="space-y-2">
              <Label>Política de Aumento</Label>
              <Select value={formData.raise_policy} onValueChange={v => setFormData(p => ({ ...p, raise_policy: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {RAISE_POLICIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Benefícios por Nível</Label>
              <Textarea value={formData.benefits_by_level} onChange={e => setFormData(p => ({ ...p, benefits_by_level: e.target.value }))} placeholder="Descreva os benefícios oferecidos..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avaliação e Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Observações Adicionais</Label>
              <Textarea value={formData.additional_notes} onChange={e => setFormData(p => ({ ...p, additional_notes: e.target.value }))} placeholder="Informações complementares que possam ajudar..." />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Formulário
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

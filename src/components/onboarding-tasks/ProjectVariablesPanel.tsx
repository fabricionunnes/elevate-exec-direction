import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, AlertTriangle, MessageSquare, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectVariablesPanelProps {
  projectId: string;
  productId: string;
  isAdmin: boolean;
}

interface ProjectData {
  churn_risk: string | null;
  project_complexity: string | null;
  client_dependency: string | null;
  current_blockers: string | null;
  last_executive_checkpoint: string | null;
  communication_channel: string | null;
  current_nps: number | null;
  client_feedback: string | null;
  product_variables: Record<string, any>;
}

// Product-specific field definitions
const productFieldDefinitions: Record<string, Array<{
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'currency';
  options?: string[];
}>> = {
  core: [
    { key: 'main_objective', label: 'Objetivo Principal', type: 'text' },
    { key: 'primary_bottleneck', label: 'Gargalo Primário Identificado', type: 'select', options: ['Vendas', 'Marketing', 'Operação', 'Gestão', 'Financeiro', 'Pessoas'] },
    { key: 'secondary_bottlenecks', label: 'Gargalos Secundários', type: 'multiselect', options: ['Vendas', 'Marketing', 'Operação', 'Gestão', 'Financeiro', 'Pessoas'] },
    { key: 'maturity_level', label: 'Nível de Maturidade', type: 'select', options: ['Inicial', 'Intermediário', 'Avançado'] },
    { key: 'plan_30_delivered', label: 'Plano 30 Dias Entregue?', type: 'boolean' },
    { key: 'plan_90_delivered', label: 'Plano 90 Dias Entregue?', type: 'boolean' },
    { key: 'recommended_ascension', label: 'Produto de Ascensão Recomendado', type: 'select', options: ['Control', 'Sales Ops', 'Sales Acceleration', 'Ads', 'Social', 'Finance', 'People'] },
    { key: 'diagnostic_accepted', label: 'Aceite do Diagnóstico', type: 'boolean' },
  ],
  control: [
    { key: 'kpis_defined', label: 'KPIs Definidos?', type: 'boolean' },
    { key: 'goals_by_role_defined', label: 'Metas por Função Definidas?', type: 'boolean' },
    { key: 'weekly_routine_implemented', label: 'Rotina Semanal Implantada?', type: 'boolean' },
    { key: 'dashboard_active', label: 'Painel de Indicadores Ativo?', type: 'boolean' },
    { key: 'team_adherence', label: 'Aderência do Time (%)', type: 'number' },
    { key: 'governance_stable', label: 'Governança Estável?', type: 'boolean' },
  ],
  'sales-ops': [
    { key: 'crm_used', label: 'CRM Utilizado', type: 'select', options: ['HubSpot', 'Pipedrive', 'RD Station', 'Salesforce', 'Zoho', 'Outro'] },
    { key: 'funnel_implemented', label: 'Funil Implantado?', type: 'boolean' },
    { key: 'slas_defined', label: 'SLAs Definidos?', type: 'boolean' },
    { key: 'playbook_created', label: 'Playbook Criado?', type: 'boolean' },
    { key: 'crm_adherence', label: 'CRM Aderido pelo Time (%)', type: 'number' },
    { key: 'data_quality', label: 'Qualidade dos Dados', type: 'select', options: ['Baixa', 'Média', 'Alta'] },
    { key: 'automations_active', label: 'Automações Ativas', type: 'number' },
    { key: 'training_completed', label: 'Treinamento Concluído?', type: 'boolean' },
  ],
  'sales-acceleration': [
    { key: 'monthly_goal', label: 'Meta Mensal Definida', type: 'currency' },
    { key: 'current_goal_percent', label: 'Meta Atual (%)', type: 'number' },
    { key: 'current_forecast', label: 'Forecast Atual', type: 'currency' },
    { key: 'general_conversion', label: 'Conversão Geral (%)', type: 'number' },
    { key: 'weekly_bottleneck', label: 'Gargalo da Semana', type: 'text' },
    { key: 'collection_routine_active', label: 'Rotina de Cobrança Ativa?', type: 'boolean' },
    { key: 'evolution_30_days', label: 'Evolução em 30 Dias', type: 'select', options: ['Cresceu', 'Estável', 'Caiu'] },
  ],
  'sales-force': [
    { key: 'monthly_lead_volume', label: 'Volume de Leads Mensal', type: 'number' },
    { key: 'qualified_leads_percent', label: 'Leads Qualificados (%)', type: 'number' },
    { key: 'meetings_scheduled', label: 'Reuniões Agendadas', type: 'number' },
    { key: 'meetings_held', label: 'Reuniões Realizadas', type: 'number' },
    { key: 'attendance_rate', label: 'Taxa de Comparecimento (%)', type: 'number' },
    { key: 'sales_closed', label: 'Vendas Fechadas', type: 'number' },
    { key: 'sla_met', label: 'SLA Cumprido?', type: 'boolean' },
  ],
  ads: [
    { key: 'monthly_budget', label: 'Orçamento Mensal', type: 'currency' },
    { key: 'current_cpa', label: 'CPA Atual', type: 'currency' },
    { key: 'current_cpl', label: 'CPL Atual', type: 'currency' },
    { key: 'lead_volume', label: 'Volume de Leads', type: 'number' },
    { key: 'roas', label: 'ROAS', type: 'number' },
    { key: 'active_campaigns', label: 'Campanhas Ativas', type: 'number' },
    { key: 'creatives_tested', label: 'Criativos Testados', type: 'number' },
  ],
  social: [
    { key: 'active_platforms', label: 'Plataformas Ativas', type: 'multiselect', options: ['Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'Facebook', 'Twitter'] },
    { key: 'posts_per_month', label: 'Posts/Mês', type: 'number' },
    { key: 'avg_engagement', label: 'Engajamento Médio (%)', type: 'number' },
    { key: 'leads_originated', label: 'Leads Originados', type: 'number' },
    { key: 'perceived_authority', label: 'Autoridade Percebida', type: 'select', options: ['Baixa', 'Média', 'Alta'] },
    { key: 'ads_integration', label: 'Integração com Ads', type: 'boolean' },
  ],
  finance: [
    { key: 'dre_updated', label: 'DRE Atualizada?', type: 'boolean' },
    { key: 'gross_margin', label: 'Margem Bruta (%)', type: 'number' },
    { key: 'net_margin', label: 'Margem Líquida (%)', type: 'number' },
    { key: 'positive_cash_flow', label: 'Fluxo de Caixa Positivo?', type: 'boolean' },
    { key: 'break_even_point', label: 'Ponto de Equilíbrio', type: 'currency' },
    { key: 'pending_financial_decisions', label: 'Decisões Financeiras Pendentes', type: 'text' },
  ],
  people: [
    { key: 'roles_mapped', label: 'Cargos Mapeados?', type: 'boolean' },
    { key: 'open_positions', label: 'Vagas Abertas', type: 'number' },
    { key: 'avg_hiring_time', label: 'Tempo Médio de Contratação (Dias)', type: 'number' },
    { key: 'turnover', label: 'Turnover (%)', type: 'number' },
    { key: 'onboarding_implemented', label: 'Onboarding Implantado?', type: 'boolean' },
    { key: 'team_avg_performance', label: 'Performance Média do Time', type: 'select', options: ['Baixa', 'Média', 'Alta'] },
  ],
  safe: [
    { key: 'contracts_reviewed', label: 'Contratos Revisados?', type: 'boolean' },
    { key: 'risk_map_created', label: 'Mapa de Risco Criado?', type: 'boolean' },
    { key: 'legal_risk_level', label: 'Nível de Risco Jurídico', type: 'select', options: ['Baixo', 'Médio', 'Alto'] },
    { key: 'open_demands', label: 'Demandas Abertas', type: 'number' },
    { key: 'compliance_active', label: 'Compliance Ativo?', type: 'boolean' },
  ],
  'ai-sales-system': [
    { key: 'token_plan', label: 'Plano de Tokens', type: 'select', options: ['Básico', 'Profissional', 'Enterprise'] },
    { key: 'tokens_consumed', label: 'Tokens Consumidos (%)', type: 'number' },
    { key: 'active_agents', label: 'Agentes Ativos', type: 'number' },
    { key: 'integrated_channel', label: 'Canal Integrado', type: 'select', options: ['WhatsApp', 'Instagram', 'Ambos'] },
    { key: 'conversations_per_month', label: 'Conversas/Mês', type: 'number' },
    { key: 'ai_appointments', label: 'Agendamentos por IA', type: 'number' },
    { key: 'ai_efficiency', label: 'Eficiência da IA', type: 'select', options: ['Baixa', 'Média', 'Alta'] },
  ],
  'execution-partnership': [
    { key: 'program_month', label: 'Mês do Programa', type: 'select', options: ['1', '2', '3'] },
    { key: 'management_model_revised', label: 'Modelo de Gestão Revisto?', type: 'boolean' },
    { key: 'routine_implemented', label: 'Rotina Implantada?', type: 'boolean' },
    { key: 'financial_result', label: 'Resultado Financeiro (%)', type: 'number' },
    { key: 'payback_achieved', label: 'Payback Atingido?', type: 'boolean' },
    { key: 'partnership_evaluation', label: 'Avaliação de Sociedade', type: 'select', options: ['Não Avaliado', 'Em Avaliação', 'Aprovado', 'Reprovado'] },
  ],
};

export const ProjectVariablesPanel = ({ projectId, productId, isAdmin }: ProjectVariablesPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ProjectData>({
    churn_risk: null,
    project_complexity: null,
    client_dependency: null,
    current_blockers: null,
    last_executive_checkpoint: null,
    communication_channel: null,
    current_nps: null,
    client_feedback: null,
    product_variables: {},
  });

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    const { data: project, error } = await supabase
      .from("onboarding_projects")
      .select("churn_risk, project_complexity, client_dependency, current_blockers, last_executive_checkpoint, communication_channel, current_nps, client_feedback, product_variables")
      .eq("id", projectId)
      .single();

    if (!error && project) {
      setData({
        churn_risk: project.churn_risk,
        project_complexity: project.project_complexity,
        client_dependency: project.client_dependency,
        current_blockers: project.current_blockers,
        last_executive_checkpoint: project.last_executive_checkpoint,
        communication_channel: project.communication_channel,
        current_nps: project.current_nps,
        client_feedback: project.client_feedback,
        product_variables: (project.product_variables as Record<string, any>) || {},
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("onboarding_projects")
      .update({
        churn_risk: data.churn_risk,
        project_complexity: data.project_complexity,
        client_dependency: data.client_dependency,
        current_blockers: data.current_blockers,
        last_executive_checkpoint: data.last_executive_checkpoint,
        communication_channel: data.communication_channel,
        current_nps: data.current_nps,
        client_feedback: data.client_feedback,
        product_variables: data.product_variables,
      })
      .eq("id", projectId);

    if (error) {
      toast.error("Erro ao salvar variáveis");
    } else {
      toast.success("Variáveis salvas com sucesso!");
    }
    setSaving(false);
  };

  const updateField = (field: keyof ProjectData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateProductVariable = (key: string, value: any) => {
    setData(prev => ({
      ...prev,
      product_variables: { ...prev.product_variables, [key]: value },
    }));
  };

  const toggleMultiSelect = (key: string, option: string) => {
    const current = data.product_variables[key] || [];
    const updated = current.includes(option)
      ? current.filter((o: string) => o !== option)
      : [...current, option];
    updateProductVariable(key, updated);
  };

  const productFields = productFieldDefinitions[productId] || [];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const renderField = (field: typeof productFields[0]) => {
    const value = data.product_variables[field.key];

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => updateProductVariable(field.key, e.target.value)}
            disabled={!isAdmin}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => updateProductVariable(field.key, e.target.value ? Number(e.target.value) : null)}
            disabled={!isAdmin}
          />
        );
      case 'currency':
        return (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">R$</span>
            <CurrencyInput
              value={value || undefined}
              onChange={(newValue) => updateProductVariable(field.key, newValue || null)}
              placeholder="0,00"
              disabled={!isAdmin}
              className="flex-1"
            />
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={value === true}
              onCheckedChange={(checked) => updateProductVariable(field.key, checked)}
              disabled={!isAdmin}
            />
            <span className="text-sm">{value ? 'Sim' : 'Não'}</span>
          </div>
        );
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(v) => updateProductVariable(field.key, v)}
            disabled={!isAdmin}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((opt) => (
              <div key={opt} className="flex items-center space-x-1">
                <Checkbox
                  checked={(value || []).includes(opt)}
                  onCheckedChange={() => toggleMultiSelect(field.key, opt)}
                  disabled={!isAdmin}
                />
                <span className="text-sm">{opt}</span>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Variáveis do Projeto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="risk" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="risk" className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Risco
            </TabsTrigger>
            <TabsTrigger value="communication" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Comunicação
            </TabsTrigger>
            <TabsTrigger value="product" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              Produto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Risco de Churn</Label>
                <Select
                  value={data.churn_risk || ''}
                  onValueChange={(v) => updateField('churn_risk', v)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Complexidade do Projeto</Label>
                <Select
                  value={data.project_complexity || ''}
                  onValueChange={(v) => updateField('project_complexity', v)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dependência do Cliente</Label>
                <Select
                  value={data.client_dependency || ''}
                  onValueChange={(v) => updateField('client_dependency', v)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bloqueios Atuais</Label>
              <Textarea
                value={data.current_blockers || ''}
                onChange={(e) => updateField('current_blockers', e.target.value)}
                placeholder="Descreva os bloqueios atuais..."
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label>Último Checkpoint Executivo</Label>
              <Input
                type="date"
                value={data.last_executive_checkpoint || ''}
                onChange={(e) => updateField('last_executive_checkpoint', e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Canal Oficial</Label>
                <Select
                  value={data.communication_channel || ''}
                  onValueChange={(v) => updateField('communication_channel', v)}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>NPS Atual (0-10)</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={data.current_nps ?? ''}
                  onChange={(e) => updateField('current_nps', e.target.value ? Number(e.target.value) : null)}
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Feedback do Cliente</Label>
              <Textarea
                value={data.client_feedback || ''}
                onChange={(e) => updateField('client_feedback', e.target.value)}
                placeholder="Feedback e observações do cliente..."
                disabled={!isAdmin}
              />
            </div>
          </TabsContent>

          <TabsContent value="product" className="space-y-4 mt-4">
            {productFields.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma variável específica definida para este produto.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {isAdmin && (
          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Variáveis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
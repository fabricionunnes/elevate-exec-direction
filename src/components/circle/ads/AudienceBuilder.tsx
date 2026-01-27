import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Users, 
  Trash2, 
  Target, 
  TrendingUp, 
  Star,
  Copy,
  Edit2,
  Filter
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  profileId?: string;
  onSelectAudience?: (audienceId: string) => void;
  selectedAudienceId?: string;
}

interface AudienceRule {
  field: string;
  operator: string;
  value: string | string[] | number;
}

const RULE_FIELDS = [
  { value: 'trust_score', label: 'Trust Score', type: 'number' },
  { value: 'company', label: 'Empresa', type: 'text' },
  { value: 'role', label: 'Cargo/Função', type: 'text' },
  { value: 'community', label: 'Comunidade', type: 'select' },
  { value: 'interest', label: 'Interesse/Tag', type: 'text' },
  { value: 'reputation_area', label: 'Área de Reputação', type: 'select' },
  { value: 'follower_of', label: 'Segue Perfil', type: 'text' },
  { value: 'engaged_last_days', label: 'Engajou nos últimos X dias', type: 'number' },
  { value: 'marketplace_viewed', label: 'Viu Anúncio Marketplace', type: 'boolean' },
  { value: 'academy_completed', label: 'Completou Trilha Academy', type: 'boolean' },
];

const RULE_OPERATORS = [
  { value: 'equals', label: 'É igual a' },
  { value: 'not_equals', label: 'Não é igual a' },
  { value: 'contains', label: 'Contém' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'in_list', label: 'Está na lista' },
];

const TEMPLATE_AUDIENCES = [
  { name: 'Engajados Recentes', description: 'Usuários que interagiram nos últimos 7 dias', rules: [{ field: 'engaged_last_days', operator: 'less_than', value: 7 }] },
  { name: 'Alta Reputação', description: 'Trust Score acima de 70', rules: [{ field: 'trust_score', operator: 'greater_than', value: 70 }] },
  { name: 'Compradores Potenciais', description: 'Viram anúncios no Marketplace', rules: [{ field: 'marketplace_viewed', operator: 'equals', value: true }] },
];

export function AudienceBuilder({ profileId, onSelectAudience, selectedAudienceId }: Props) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingAudience, setEditingAudience] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<AudienceRule[]>([]);
  const [ruleOperator, setRuleOperator] = useState<"AND" | "OR">("AND");
  const [timeWindowDays, setTimeWindowDays] = useState(30);

  const { data: audiences, isLoading } = useQuery({
    queryKey: ["circle-audiences", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("circle_audiences")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: async (audienceData: any) => {
      const { data, error } = await supabase
        .from("circle_audiences")
        .insert({
          profile_id: profileId,
          name: audienceData.name,
          description: audienceData.description,
          rules: audienceData.rules,
          rule_operator: audienceData.ruleOperator,
          time_window_days: audienceData.timeWindowDays,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-audiences"] });
      toast.success("Público criado com sucesso!");
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao criar público");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (audienceId: string) => {
      const { error } = await supabase
        .from("circle_audiences")
        .delete()
        .eq("id", audienceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-audiences"] });
      toast.success("Público removido");
    },
  });

  const resetForm = () => {
    setIsCreating(false);
    setEditingAudience(null);
    setName("");
    setDescription("");
    setRules([]);
    setRuleOperator("AND");
    setTimeWindowDays(30);
  };

  const addRule = () => {
    setRules([...rules, { field: "trust_score", operator: "greater_than", value: 50 }]);
  };

  const updateRule = (index: number, field: keyof AudienceRule, value: any) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof TEMPLATE_AUDIENCES[0]) => {
    setName(template.name);
    setDescription(template.description);
    setRules(template.rules as AudienceRule[]);
    setIsCreating(true);
  };

  const handleSubmit = () => {
    if (!name.trim() || rules.length === 0) {
      toast.error("Preencha o nome e adicione pelo menos uma regra");
      return;
    }

    createMutation.mutate({
      name,
      description,
      rules,
      ruleOperator,
      timeWindowDays,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Audience Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Crie públicos personalizados para suas campanhas
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Público
        </Button>
      </div>

      {/* Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATE_AUDIENCES.map((template, idx) => (
          <Card 
            key={idx} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => applyTemplate(template)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{template.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{template.description}</p>
              <Badge variant="outline" className="mt-2 text-xs">
                Template
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editingAudience ? "Editar Público" : "Criar Novo Público"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Público</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gestores Engajados"
                />
              </div>
              <div className="space-y-2">
                <Label>Janela de Tempo (dias)</Label>
                <Input
                  type="number"
                  value={timeWindowDays}
                  onChange={(e) => setTimeWindowDays(parseInt(e.target.value) || 30)}
                  min={1}
                  max={365}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o público-alvo..."
                rows={2}
              />
            </div>

            {/* Rule Operator */}
            <div className="flex items-center gap-4">
              <Label>Combinar regras com:</Label>
              <div className="flex gap-2">
                <Button
                  variant={ruleOperator === "AND" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRuleOperator("AND")}
                >
                  E (AND)
                </Button>
                <Button
                  variant={ruleOperator === "OR" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRuleOperator("OR")}
                >
                  OU (OR)
                </Button>
              </div>
            </div>

            {/* Rules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Regras de Segmentação
                </Label>
                <Button variant="outline" size="sm" onClick={addRule}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Regra
                </Button>
              </div>

              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma regra adicionada. Clique em "Adicionar Regra" para começar.
                </p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, index) => (
                    <div 
                      key={index} 
                      className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg"
                    >
                      {index > 0 && (
                        <Badge variant="secondary" className="mr-2">
                          {ruleOperator}
                        </Badge>
                      )}
                      
                      <Select
                        value={rule.field}
                        onValueChange={(v) => updateRule(index, "field", v)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_FIELDS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={rule.operator}
                        onValueChange={(v) => updateRule(index, "operator", v)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={String(rule.value)}
                        onChange={(e) => updateRule(index, "value", e.target.value)}
                        className="w-[120px]"
                        placeholder="Valor"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Público"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Audiences */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">
          Seus Públicos ({audiences?.length || 0})
        </h4>

        {audiences?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Nenhum público criado ainda. Use os templates ou crie um personalizado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {audiences?.map((audience: any) => (
              <Card 
                key={audience.id}
                className={`cursor-pointer transition-colors ${
                  selectedAudienceId === audience.id 
                    ? "border-primary bg-primary/5" 
                    : "hover:border-primary/30"
                }`}
                onClick={() => onSelectAudience?.(audience.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{audience.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {audience.rule_operator}
                        </Badge>
                        {audience.is_lookalike && (
                          <Badge className="text-xs bg-purple-500">
                            Lookalike
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {audience.description || "Sem descrição"}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          ~{audience.estimated_size || 0} usuários
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Engajamento: {(audience.engagement_score || 0).toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Valor: {(audience.value_score || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement duplicate
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(audience.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

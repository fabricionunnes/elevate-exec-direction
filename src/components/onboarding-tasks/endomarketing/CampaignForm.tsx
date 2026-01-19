import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, ArrowLeft, Plus, Trash2, Trophy, Users, Target, Gift } from "lucide-react";
import { format } from "date-fns";

interface KPI {
  id: string;
  name: string;
  kpi_type: string;
}

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
}

interface Prize {
  id?: string;
  position: number;
  name: string;
  prize_type: string;
  value: number | null;
  description: string | null;
}

interface CampaignFormProps {
  companyId: string;
  projectId: string;
  campaignId: string | null;
  onClose: () => void;
}

export const CampaignForm = ({ companyId, projectId, campaignId, onClose }: CampaignFormProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState("");
  const [kpiId, setKpiId] = useState("");
  const [calculationMethod, setCalculationMethod] = useState("sum");
  const [tiebreaker, setTiebreaker] = useState("sales_count");
  const [competitionType, setCompetitionType] = useState("individual");
  const [hasGoal, setHasGoal] = useState(false);
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [goalType, setGoalType] = useState("general");
  const [hasPrizes, setHasPrizes] = useState(false);
  const [prizeModel, setPrizeModel] = useState("first");
  const [allSalespeople, setAllSalespeople] = useState(true);
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([
    { position: 1, name: "", prize_type: "other", value: null, description: null }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [companyId, campaignId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch KPIs
      const { data: kpisData } = await supabase
        .from("company_kpis")
        .select("id, name, kpi_type")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      setKpis(kpisData || []);

      // Fetch salespeople
      const { data: salespeopleData } = await supabase
        .from("company_salespeople")
        .select("id, name, email")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      setSalespeople(salespeopleData || []);

      // If editing, fetch campaign data
      if (campaignId) {
        const { data: campaign } = await supabase
          .from("endomarketing_campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (campaign) {
          setName(campaign.name);
          setDescription(campaign.description || "");
          setStartDate(campaign.start_date.slice(0, 16));
          setEndDate(campaign.end_date.slice(0, 16));
          setKpiId(campaign.kpi_id);
          setCalculationMethod(campaign.calculation_method);
          setTiebreaker(campaign.tiebreaker || "sales_count");
          setCompetitionType(campaign.competition_type);
          setHasGoal(campaign.has_goal);
          setGoalValue(campaign.goal_value);
          setGoalType(campaign.goal_type || "general");
          setHasPrizes(campaign.has_prizes);
          setPrizeModel(campaign.prize_model || "first");
          setAllSalespeople(campaign.all_salespeople);

          // Fetch participants
          const { data: participants } = await supabase
            .from("endomarketing_participants")
            .select("salesperson_id")
            .eq("campaign_id", campaignId);

          setSelectedSalespeople((participants || []).map(p => p.salesperson_id));

          // Fetch prizes
          const { data: prizesData } = await supabase
            .from("endomarketing_prizes")
            .select("*")
            .eq("campaign_id", campaignId)
            .order("position");

          if (prizesData && prizesData.length > 0) {
            setPrizes(prizesData);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSalespersonToggle = (salespersonId: string) => {
    setSelectedSalespeople(prev =>
      prev.includes(salespersonId)
        ? prev.filter(id => id !== salespersonId)
        : [...prev, salespersonId]
    );
  };

  const addPrize = () => {
    setPrizes(prev => [
      ...prev,
      { position: prev.length + 1, name: "", prize_type: "other", value: null, description: null }
    ]);
  };

  const removePrize = (index: number) => {
    setPrizes(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i + 1 })));
  };

  const updatePrize = (index: number, field: keyof Prize, value: any) => {
    setPrizes(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }
    if (!kpiId) {
      toast.error("Selecione o KPI base");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Informe o período da campanha");
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      toast.error("Data de início deve ser anterior à data de fim");
      return;
    }
    if (!allSalespeople && selectedSalespeople.length === 0) {
      toast.error("Selecione ao menos um participante");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Try to get staff member first
      const { data: staffMember } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      // If not staff, try to get client user
      let createdById = staffMember?.id || null;
      if (!createdById) {
        const { data: clientUser } = await supabase
          .from("onboarding_users")
          .select("id")
          .eq("user_id", user?.id)
          .eq("project_id", projectId)
          .maybeSingle();
        
        createdById = clientUser?.id || null;
      }

      const campaignData = {
        company_id: companyId,
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        kpi_id: kpiId,
        calculation_method: calculationMethod,
        tiebreaker,
        competition_type: competitionType,
        has_goal: hasGoal,
        goal_value: hasGoal ? goalValue : null,
        goal_type: hasGoal ? goalType : null,
        has_prizes: hasPrizes,
        prize_model: hasPrizes ? prizeModel : null,
        all_salespeople: allSalespeople,
        created_by: createdById,
      };

      let savedCampaignId = campaignId;

      if (campaignId) {
        // Update existing campaign
        const { error } = await supabase
          .from("endomarketing_campaigns")
          .update(campaignData)
          .eq("id", campaignId);

        if (error) throw error;
      } else {
        // Create new campaign
        const { data, error } = await supabase
          .from("endomarketing_campaigns")
          .insert(campaignData)
          .select("id")
          .single();

        if (error) throw error;
        savedCampaignId = data.id;
      }

      // Handle participants
      if (!allSalespeople && savedCampaignId) {
        // Delete existing participants
        await supabase
          .from("endomarketing_participants")
          .delete()
          .eq("campaign_id", savedCampaignId);

        // Insert new participants
        if (selectedSalespeople.length > 0) {
          const participantsData = selectedSalespeople.map(spId => ({
            campaign_id: savedCampaignId,
            salesperson_id: spId,
          }));

          const { error: participantsError } = await supabase
            .from("endomarketing_participants")
            .insert(participantsData);

          if (participantsError) throw participantsError;
        }
      }

      // Handle prizes
      if (hasPrizes && savedCampaignId) {
        // Delete existing prizes
        await supabase
          .from("endomarketing_prizes")
          .delete()
          .eq("campaign_id", savedCampaignId);

        // Insert prizes
        const validPrizes = prizes.filter(p => p.name.trim());
        if (validPrizes.length > 0) {
          const prizesData = validPrizes.map(p => ({
            campaign_id: savedCampaignId,
            position: p.position,
            name: p.name.trim(),
            prize_type: p.prize_type,
            value: p.prize_type === "money" ? p.value : null,
            description: p.description?.trim() || null,
          }));

          const { error: prizesError } = await supabase
            .from("endomarketing_prizes")
            .insert(prizesData);

          if (prizesError) throw prizesError;
        }
      }

      toast.success(campaignId ? "Campanha atualizada!" : "Campanha criada!");
      onClose();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold">
            {campaignId ? "Editar Campanha" : "Nova Campanha"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure os detalhes da campanha de endomarketing
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Dados Básicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nome da campanha *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maratona de Vendas Janeiro"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição / Objetivo</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo e as regras da campanha..."
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Data e hora de início *</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Data e hora de fim *</Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={allSalespeople}
              onCheckedChange={setAllSalespeople}
            />
            <Label>Todos os vendedores ativos</Label>
          </div>

          {!allSalespeople && (
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              {salespeople.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum vendedor cadastrado</p>
              ) : (
                <div className="grid gap-2">
                  {salespeople.map(sp => (
                    <label
                      key={sp.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSalespeople.includes(sp.id)}
                        onCheckedChange={() => handleSalespersonToggle(sp.id)}
                      />
                      <div>
                        <p className="font-medium">{sp.name}</p>
                        {sp.email && <p className="text-xs text-muted-foreground">{sp.email}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Tipo de competição</Label>
            <Select value={competitionType} onValueChange={setCompetitionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="team">Por equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI / Metric */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            KPI / Métrica Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>KPI para ranking *</Label>
            <Select value={kpiId} onValueChange={setKpiId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o KPI" />
              </SelectTrigger>
              <SelectContent>
                {kpis.map(kpi => (
                  <SelectItem key={kpi.id} value={kpi.id}>
                    {kpi.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kpis.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Nenhum KPI cadastrado. Configure KPIs na aba de configuração.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Forma de cálculo</Label>
              <Select value={calculationMethod} onValueChange={setCalculationMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Soma no período</SelectItem>
                  <SelectItem value="avg">Média no período</SelectItem>
                  <SelectItem value="max">Maior valor em um dia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Critério de desempate</Label>
              <Select value={tiebreaker} onValueChange={setTiebreaker}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_count">Maior nº de vendas</SelectItem>
                  <SelectItem value="avg_ticket">Maior ticket médio</SelectItem>
                  <SelectItem value="first_to_goal">Primeiro a atingir meta</SelectItem>
                  <SelectItem value="manual">Manual pelo consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Meta (opcional)</CardTitle>
            <Switch checked={hasGoal} onCheckedChange={setHasGoal} />
          </div>
        </CardHeader>
        {hasGoal && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Valor da meta</Label>
                <Input
                  type="number"
                  value={goalValue || ""}
                  onChange={(e) => setGoalValue(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Ex: 100000"
                />
              </div>
              <div>
                <Label>Tipo de meta</Label>
                <Select value={goalType} onValueChange={setGoalType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Meta geral (soma do time)</SelectItem>
                    <SelectItem value="individual">Meta individual</SelectItem>
                    <SelectItem value="both">Ambas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Prizes */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Premiação
            </CardTitle>
            <Switch checked={hasPrizes} onCheckedChange={setHasPrizes} />
          </div>
        </CardHeader>
        {hasPrizes && (
          <CardContent className="space-y-4">
            <div>
              <Label>Modelo de premiação</Label>
              <Select value={prizeModel} onValueChange={setPrizeModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Apenas 1º lugar</SelectItem>
                  <SelectItem value="top3">Top 3</SelectItem>
                  <SelectItem value="topN">Top N (configurável)</SelectItem>
                  <SelectItem value="tiers">Por faixas</SelectItem>
                  <SelectItem value="goal_achieved">Quem bater meta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Prêmios</Label>
              {prizes.map((prize, index) => (
                <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                    {prize.position}º
                  </div>
                  <div className="flex-1 grid gap-3 md:grid-cols-3">
                    <div>
                      <Input
                        placeholder="Nome do prêmio"
                        value={prize.name}
                        onChange={(e) => updatePrize(index, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Select
                        value={prize.prize_type}
                        onValueChange={(v) => updatePrize(index, "prize_type", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="money">Dinheiro</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                          <SelectItem value="experience">Experiência</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {prize.prize_type === "money" && (
                      <div>
                        <Input
                          type="number"
                          placeholder="Valor (R$)"
                          value={prize.value || ""}
                          onChange={(e) => updatePrize(index, "value", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                    )}
                  </div>
                  {prizes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrize(index)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addPrize} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Adicionar prêmio
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="flex-1 gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : campaignId ? "Salvar alterações" : "Criar campanha"}
        </Button>
      </div>
    </form>
  );
};

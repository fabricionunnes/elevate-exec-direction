import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, ArrowLeft, Plus, Trash2, Gift, Target, Users, Palette } from "lucide-react";
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

interface BalloonPrize {
  id?: string;
  name: string;
  description: string;
  emoji: string;
  prize_type: string;
  value: number | null;
  weight: number;
  total_quantity: number | null;
  is_active: boolean;
  sort_order: number;
}

interface BalloonCampaignFormProps {
  companyId: string;
  projectId: string;
  campaignId: string | null;
  onClose: () => void;
}

const DEFAULT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const EMOJI_OPTIONS = ['🎁', '💰', '🏆', '⭐', '🎉', '🎊', '💎', '🥇', '🎯', '🍀', '🔥', '💪', '😅'];

export const BalloonCampaignForm = ({ companyId, projectId, campaignId, onClose }: BalloonCampaignFormProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [goalType, setGoalType] = useState("daily");
  const [goalSource, setGoalSource] = useState("kpi");
  const [kpiId, setKpiId] = useState("");
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [balloonsPerAchievement, setBalloonsPerAchievement] = useState(3);
  const [maxBalloonsPerPeriod, setMaxBalloonsPerPeriod] = useState<number | null>(null);
  const [prizeMode, setPrizeMode] = useState("weighted");
  const [balloonColors, setBalloonColors] = useState<string[]>(DEFAULT_COLORS);
  const [allSalespeople, setAllSalespeople] = useState(true);
  const [selectedSalespeople, setSelectedSalespeople] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<BalloonPrize[]>([
    { name: "Parabéns!", description: "Continue assim!", emoji: "🎉", prize_type: "message", value: null, weight: 5, total_quantity: null, is_active: true, sort_order: 0 },
    { name: "Brinde Surpresa", description: "Retire seu brinde com o gestor", emoji: "🎁", prize_type: "physical", value: null, weight: 3, total_quantity: null, is_active: true, sort_order: 1 },
    { name: "Bônus R$50", description: "Bônus de R$50 na folha", emoji: "💰", prize_type: "bonus", value: 50, weight: 1, total_quantity: null, is_active: true, sort_order: 2 },
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [companyId, campaignId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [kpisRes, spRes] = await Promise.all([
        supabase.from("company_kpis").select("id, name, kpi_type").eq("company_id", companyId).eq("is_active", true).order("name"),
        supabase.from("company_salespeople").select("id, name, email").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);

      setKpis(kpisRes.data || []);
      setSalespeople(spRes.data || []);

      if (campaignId) {
        const { data: campaign } = await supabase
          .from("endomarketing_balloon_campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (campaign) {
          setName(campaign.name);
          setDescription(campaign.description || "");
          setStartDate(campaign.start_date);
          setEndDate(campaign.end_date);
          setGoalType(campaign.goal_type);
          setGoalSource(campaign.goal_source);
          setKpiId(campaign.kpi_id || "");
          setGoalValue(campaign.goal_value as number | null);
          setBalloonsPerAchievement(campaign.balloons_per_achievement);
          setMaxBalloonsPerPeriod(campaign.max_balloons_per_period as number | null);
          setPrizeMode(campaign.prize_mode);
          setBalloonColors((campaign.balloon_colors as string[]) || DEFAULT_COLORS);
          setAllSalespeople(campaign.all_salespeople);

          const { data: participants } = await supabase
            .from("endomarketing_balloon_participants")
            .select("salesperson_id")
            .eq("campaign_id", campaignId);
          setSelectedSalespeople((participants || []).map(p => p.salesperson_id));

          const { data: prizesData } = await supabase
            .from("endomarketing_balloon_prizes")
            .select("*")
            .eq("campaign_id", campaignId)
            .order("sort_order");
          if (prizesData && prizesData.length > 0) {
            setPrizes(prizesData.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description || "",
              emoji: p.emoji || "🎁",
              prize_type: p.prize_type,
              value: p.value as number | null,
              weight: p.weight,
              total_quantity: p.total_quantity as number | null,
              is_active: p.is_active,
              sort_order: p.sort_order,
            })));
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

  const addPrize = () => {
    setPrizes(prev => [...prev, {
      name: "", description: "", emoji: "🎁", prize_type: "physical",
      value: null, weight: 1, total_quantity: null, is_active: true, sort_order: prev.length,
    }]);
  };

  const removePrize = (index: number) => {
    setPrizes(prev => prev.filter((_, i) => i !== index));
  };

  const updatePrize = (index: number, field: keyof BalloonPrize, value: any) => {
    setPrizes(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome da campanha");
    if (!startDate || !endDate) return toast.error("Informe o período");
    if (goalSource === "kpi" && !kpiId) return toast.error("Selecione o KPI");
    if (goalSource === "manual" && !goalValue) return toast.error("Informe o valor da meta");
    if (prizes.filter(p => p.name.trim()).length === 0) return toast.error("Adicione ao menos um prêmio");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staffMember } = await supabase
        .from("onboarding_staff").select("id").eq("user_id", user?.id).maybeSingle();

      const campaignData = {
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        goal_type: goalType,
        goal_source: goalSource,
        kpi_id: goalSource === "kpi" ? kpiId : null,
        goal_value: goalValue,
        balloons_per_achievement: balloonsPerAchievement,
        max_balloons_per_period: maxBalloonsPerPeriod,
        prize_mode: prizeMode,
        balloon_colors: balloonColors,
        all_salespeople: allSalespeople,
        created_by: staffMember?.id || null,
      };

      let savedId = campaignId;
      if (campaignId) {
        const { error } = await supabase.from("endomarketing_balloon_campaigns").update(campaignData).eq("id", campaignId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("endomarketing_balloon_campaigns").insert(campaignData).select("id").single();
        if (error) throw error;
        savedId = data.id;
      }

      // Participants
      if (!allSalespeople && savedId) {
        await supabase.from("endomarketing_balloon_participants").delete().eq("campaign_id", savedId);
        if (selectedSalespeople.length > 0) {
          await supabase.from("endomarketing_balloon_participants").insert(
            selectedSalespeople.map(spId => ({ campaign_id: savedId, salesperson_id: spId }))
          );
        }
      }

      // Prizes
      if (savedId) {
        await supabase.from("endomarketing_balloon_prizes").delete().eq("campaign_id", savedId);
        const validPrizes = prizes.filter(p => p.name.trim());
        if (validPrizes.length > 0) {
          await supabase.from("endomarketing_balloon_prizes").insert(
            validPrizes.map((p, i) => ({
              campaign_id: savedId,
              name: p.name.trim(),
              description: p.description?.trim() || null,
              emoji: p.emoji,
              prize_type: p.prize_type,
              value: p.prize_type === "bonus" ? p.value : null,
              weight: p.weight,
              total_quantity: prizeMode === "fixed_pool" ? p.total_quantity : null,
              quantity_remaining: prizeMode === "fixed_pool" ? p.total_quantity : null,
              is_active: p.is_active,
              sort_order: i,
            }))
          );
        }
      }

      toast.success(campaignId ? "Campanha atualizada!" : "Campanha de balões criada!");
      onClose();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card><CardContent className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground mt-4">Carregando...</p>
      </CardContent></Card>
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
            🎈 {campaignId ? "Editar Campanha de Balões" : "Nova Campanha de Balões"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure a dinâmica de estourar balões e ganhar prêmios
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">🎈 Dados Básicos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da campanha *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Balões de Março" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Bata a meta e estoure balões para ganhar prêmios!" rows={2} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Data de início *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Data de fim *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Config */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Meta / Objetivo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Período da meta *</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="custom">Personalizado (período da campanha)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fonte da meta *</Label>
              <Select value={goalSource} onValueChange={setGoalSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kpi">KPI cadastrado</SelectItem>
                  <SelectItem value="manual">Valor manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {goalSource === "kpi" && (
            <div>
              <Label>KPI base *</Label>
              <Select value={kpiId} onValueChange={setKpiId}>
                <SelectTrigger><SelectValue placeholder="Selecione o KPI" /></SelectTrigger>
                <SelectContent>
                  {kpis.map(kpi => (
                    <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Valor da meta {goalSource === "kpi" ? "(opcional, senão usa meta do KPI)" : "*"}</Label>
            <Input
              type="number"
              value={goalValue ?? ""}
              onChange={e => setGoalValue(e.target.value ? Number(e.target.value) : null)}
              placeholder="Ex: 5000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Balloon Mechanics */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2">🎈 Mecânica dos Balões</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Balões por conquista</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={balloonsPerAchievement}
                onChange={e => setBalloonsPerAchievement(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Quantos balões o vendedor pode estourar ao bater a meta</p>
            </div>
            <div>
              <Label>Máximo por período (opcional)</Label>
              <Input
                type="number"
                min={1}
                value={maxBalloonsPerPeriod ?? ""}
                onChange={e => setMaxBalloonsPerPeriod(e.target.value ? Number(e.target.value) : null)}
                placeholder="Ilimitado"
              />
              <p className="text-xs text-muted-foreground mt-1">Limite de balões que um vendedor pode estourar por período</p>
            </div>
          </div>

          <div>
            <Label>Modo de distribuição dos prêmios</Label>
            <Select value={prizeMode} onValueChange={setPrizeMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weighted">Por peso (probabilidade configurável)</SelectItem>
                <SelectItem value="equal">Distribuição igual (mesma chance para todos)</SelectItem>
                <SelectItem value="fixed_pool">Lista fixa limitada (estoque controlado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color customization */}
          <div>
            <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Cores dos balões</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {balloonColors.map((color, i) => (
                <div key={i} className="relative group">
                  <input
                    type="color"
                    value={color}
                    onChange={e => {
                      const newColors = [...balloonColors];
                      newColors[i] = e.target.value;
                      setBalloonColors(newColors);
                    }}
                    className="w-10 h-10 rounded-full cursor-pointer border-2 border-border"
                  />
                  {balloonColors.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setBalloonColors(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {balloonColors.length < 12 && (
                <button
                  type="button"
                  onClick={() => setBalloonColors(prev => [...prev, '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')])}
                  className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Participantes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={allSalespeople} onCheckedChange={setAllSalespeople} />
            <Label>Todos os vendedores ativos</Label>
          </div>
          {!allSalespeople && (
            <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
              {salespeople.map(sp => (
                <label key={sp.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={selectedSalespeople.includes(sp.id)}
                    onCheckedChange={() => setSelectedSalespeople(prev =>
                      prev.includes(sp.id) ? prev.filter(id => id !== sp.id) : [...prev, sp.id]
                    )}
                  />
                  <span className="font-medium">{sp.name}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prizes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> Prêmios dos Balões</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addPrize} className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prizes.map((prize, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select value={prize.emoji} onValueChange={v => updatePrize(index, "emoji", v)}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMOJI_OPTIONS.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-medium text-sm">Prêmio {index + 1}</span>
                </div>
                {prizes.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePrize(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Nome do prêmio *</Label>
                  <Input value={prize.name} onChange={e => updatePrize(index, "name", e.target.value)} placeholder="Ex: Brinde Surpresa" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={prize.prize_type} onValueChange={v => updatePrize(index, "prize_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Brinde físico</SelectItem>
                      <SelectItem value="bonus">Bônus em dinheiro</SelectItem>
                      <SelectItem value="message">Mensagem motivacional</SelectItem>
                      <SelectItem value="try_again">Tente novamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input value={prize.description} onChange={e => updatePrize(index, "description", e.target.value)} placeholder="Detalhes do prêmio..." />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {prize.prize_type === "bonus" && (
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" value={prize.value ?? ""} onChange={e => updatePrize(index, "value", e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
                {prizeMode === "weighted" && (
                  <div>
                    <Label>Peso (probabilidade)</Label>
                    <Input type="number" min={1} value={prize.weight} onChange={e => updatePrize(index, "weight", Number(e.target.value))} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(() => {
                        const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
                        return totalWeight > 0 ? `${((prize.weight / totalWeight) * 100).toFixed(1)}% de chance` : "";
                      })()}
                    </p>
                  </div>
                )}
                {prizeMode === "fixed_pool" && (
                  <div>
                    <Label>Estoque total</Label>
                    <Input type="number" min={1} value={prize.total_quantity ?? ""} onChange={e => updatePrize(index, "total_quantity", e.target.value ? Number(e.target.value) : null)} placeholder="Ilimitado" />
                  </div>
                )}
              </div>
            </div>
          ))}

          {prizeMode === "weighted" && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">📊 Distribuição de probabilidades:</p>
              <div className="flex gap-2 flex-wrap">
                {prizes.filter(p => p.name.trim()).map((prize, i) => {
                  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
                  const pct = totalWeight > 0 ? ((prize.weight / totalWeight) * 100).toFixed(1) : "0";
                  return (
                    <span key={i} className="text-xs bg-background px-2 py-1 rounded-full border">
                      {prize.emoji} {prize.name}: {pct}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : campaignId ? "Atualizar" : "Criar Campanha"}
        </Button>
      </div>
    </form>
  );
};

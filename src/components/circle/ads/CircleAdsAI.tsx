import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sparkles, 
  Wand2, 
  Target, 
  MessageSquare, 
  Users, 
  Calendar,
  Check,
  Edit2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  profileId?: string;
  onCampaignCreated?: () => void;
}

const OBJECTIVES = [
  { value: 'sell', label: 'Vender Produto/Serviço', icon: Target, description: 'Direcionar para compra ou contato comercial' },
  { value: 'whatsapp_leads', label: 'Gerar Leads WhatsApp', icon: MessageSquare, description: 'Coletar contatos via WhatsApp' },
  { value: 'community', label: 'Divulgar Comunidade', icon: Users, description: 'Aumentar membros de uma comunidade' },
  { value: 'event', label: 'Divulgar Evento', icon: Calendar, description: 'Promover evento ou webinar' },
  { value: 'brand_awareness', label: 'Reconhecimento de Marca', icon: Sparkles, description: 'Aumentar visibilidade da marca' },
];

interface AISuggestion {
  campaign: {
    name: string;
    objective: string;
    daily_budget: number;
  };
  ad_set: {
    name: string;
    targeting: any;
    placements: string[];
  };
  ad: {
    title: string;
    content: string;
    cta: string;
  };
  audience_suggestion: string;
  budget_reasoning: string;
  confidence: number;
}

export function CircleAdsAI({ profileId, onCampaignCreated }: Props) {
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState<string>("");
  const [context, setContext] = useState("");
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !objective) {
        throw new Error("Selecione um objetivo");
      }

      // Create AI request
      const { data: request, error: reqError } = await supabase
        .from("circle_ads_ai_requests")
        .insert({
          profile_id: profileId,
          objective,
          context_data: { user_context: context },
          status: "processing",
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // Call edge function for AI generation
      const { data, error } = await supabase.functions.invoke("circle-ads-ai", {
        body: {
          request_id: request.id,
          profile_id: profileId,
          objective,
          context,
        },
      });

      if (error) throw error;

      return data;
    },
    onSuccess: (data) => {
      setSuggestion(data.suggestion);
      toast.success("Campanha gerada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao gerar campanha");
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !suggestion) {
        throw new Error("Nenhuma sugestão para criar");
      }

      // Create campaign
      const { data: campaign, error: campError } = await supabase
        .from("circle_ads_campaigns")
        .insert([{
          profile_id: profileId,
          name: suggestion.campaign.name,
          objective: suggestion.campaign.objective as any,
          daily_budget: suggestion.campaign.daily_budget,
          status: "draft" as const,
        }])
        .select()
        .single();

      if (campError) throw campError;

      // Create ad set
      const { data: adSet, error: setError } = await supabase
        .from("circle_ads_ad_sets")
        .insert([{
          campaign_id: campaign.id,
          name: suggestion.ad_set.name,
          targeting: suggestion.ad_set.targeting,
          placements: suggestion.ad_set.placements as ("feed" | "stories" | "communities" | "marketplace")[],
          status: "active" as const,
        }])
        .select()
        .single();

      if (setError) throw setError;

      // Create ad
      const { error: adError } = await supabase
        .from("circle_ads_ads")
        .insert([{
          ad_set_id: adSet.id,
          name: suggestion.ad.title,
          title: suggestion.ad.title,
          content: suggestion.ad.content,
          cta_type: suggestion.ad.cta as any,
          ad_type: "sponsored_post" as const,
          status: "pending_review" as const,
        }]);

      if (adError) throw adError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-campaigns"] });
      toast.success("Campanha criada! Aguarde aprovação do anúncio.");
      setSuggestion(null);
      setObjective("");
      setContext("");
      onCampaignCreated?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar campanha");
    },
  });

  const selectedObjective = OBJECTIVES.find((o) => o.value === objective);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Circle Ads AI</CardTitle>
              <CardDescription>
                Crie campanhas completas automaticamente com inteligência artificial
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!suggestion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-500" />
              Gerar Nova Campanha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Objective Selection */}
            <div className="space-y-3">
              <Label>Qual é o objetivo da sua campanha?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {OBJECTIVES.map((obj) => {
                  const Icon = obj.icon;
                  return (
                    <div
                      key={obj.value}
                      onClick={() => setObjective(obj.value)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        objective === obj.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          objective === obj.value ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{obj.label}</p>
                          <p className="text-xs text-muted-foreground">{obj.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Context */}
            <div className="space-y-2">
              <Label>Contexto adicional (opcional)</Label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Descreva seu produto/serviço, público-alvo, diferenciais, orçamento ideal..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Quanto mais contexto você fornecer, melhor será a sugestão da IA
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!objective || generateMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando campanha...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Campanha com IA
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* AI Suggestion */}
          <Card className="border-green-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  Sugestão da IA
                </CardTitle>
                <Badge className="bg-green-500">
                  {(suggestion.confidence * 100).toFixed(0)}% confiança
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campaign */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Campanha</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <p className="font-medium">{suggestion.campaign.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Orçamento diário:</span>
                    <p className="font-medium">R$ {suggestion.campaign.daily_budget.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Ad Set */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Conjunto de Anúncios</h4>
                <div className="text-sm">
                  <span className="text-muted-foreground">Posicionamentos:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {suggestion.ad_set.placements.map((p: string) => (
                      <Badge key={p} variant="outline">{p}</Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {suggestion.audience_suggestion}
                </p>
              </div>

              {/* Ad */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Anúncio</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Título:</span>
                    <p className="font-medium">{suggestion.ad.title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Texto:</span>
                    <p>{suggestion.ad.content}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTA:</span>
                    <Badge>{suggestion.ad.cta}</Badge>
                  </div>
                </div>
              </div>

              {/* Budget Reasoning */}
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {suggestion.budget_reasoning}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSuggestion(null)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
                  onClick={() => createCampaignMutation.mutate()}
                  disabled={createCampaignMutation.isPending}
                >
                  {createCampaignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Criar Campanha
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

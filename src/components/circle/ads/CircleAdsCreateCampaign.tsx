import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { CircleAdsAdSetForm } from "./CircleAdsAdSetForm";
import { CircleAdsAdForm } from "./CircleAdsAdForm";

interface Props {
  profileId?: string;
  onClose: () => void;
}

const objectives = [
  { value: "reach", label: "Alcance", description: "Mostre seu anúncio para o máximo de pessoas" },
  { value: "engagement", label: "Engajamento", description: "Obtenha mais curtidas, comentários e compartilhamentos" },
  { value: "whatsapp_traffic", label: "Tráfego WhatsApp", description: "Direcione pessoas para seu WhatsApp" },
  { value: "community_promotion", label: "Divulgação de Comunidade", description: "Atraia membros para sua comunidade" },
  { value: "marketplace_promotion", label: "Divulgação de Marketplace", description: "Promova seu anúncio no marketplace" },
  { value: "event_promotion", label: "Divulgação de Evento", description: "Divulgue seu evento" },
];

export function CircleAdsCreateCampaign({ profileId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  
  // Campaign data
  const [campaignData, setCampaignData] = useState({
    name: "",
    objective: "reach",
    budget_type: "daily",
    budget_amount: 10,
    start_date: "",
    end_date: "",
  });

  // Ad Set data
  const [adSetData, setAdSetData] = useState({
    name: "Conjunto Principal",
    targeting: {},
    placements: ["feed"] as string[],
    frequency_cap_impressions: 3,
    frequency_cap_hours: 24,
  });

  // Ad data
  const [adData, setAdData] = useState({
    name: "Anúncio Principal",
    ad_type: "sponsored_post",
    title: "",
    content: "",
    media_urls: [] as string[],
    cta_type: "learn_more",
    cta_url: "",
    whatsapp_number: "",
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Perfil não encontrado");

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("circle_ads_campaigns")
        .insert([{
          profile_id: profileId,
          name: campaignData.name,
          objective: campaignData.objective as any,
          budget_type: campaignData.budget_type as any,
          budget_amount: campaignData.budget_amount,
          start_date: campaignData.start_date || null,
          end_date: campaignData.end_date || null,
          status: "draft" as any,
        }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create ad set
      const { data: adSet, error: adSetError } = await supabase
        .from("circle_ads_ad_sets")
        .insert([{
          campaign_id: campaign.id,
          name: adSetData.name,
          targeting: adSetData.targeting,
          placements: adSetData.placements as any,
          frequency_cap_impressions: adSetData.frequency_cap_impressions,
          frequency_cap_hours: adSetData.frequency_cap_hours,
          status: "draft" as any,
        }])
        .select()
        .single();

      if (adSetError) throw adSetError;

      // Create ad
      const { error: adError } = await supabase
        .from("circle_ads_ads")
        .insert([{
          ad_set_id: adSet.id,
          name: adData.name,
          ad_type: adData.ad_type as any,
          title: adData.title || null,
          content: adData.content,
          media_urls: adData.media_urls,
          cta_type: adData.cta_type as any,
          cta_url: adData.cta_url || null,
          whatsapp_number: adData.whatsapp_number || null,
          status: "draft" as any,
        }]);

      if (adError) throw adError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-campaigns"] });
      toast({ title: "Campanha criada com sucesso!" });
      onClose();
    },
    onError: (error) => {
      console.error("Error creating campaign:", error);
      toast({ title: "Erro ao criar campanha", variant: "destructive" });
    },
  });

  const handleNext = () => {
    if (step === 1) {
      if (!campaignData.name.trim()) {
        toast({ title: "Informe o nome da campanha", variant: "destructive" });
        return;
      }
      if (campaignData.budget_amount < 10) {
        toast({ title: "Orçamento mínimo é R$ 10,00", variant: "destructive" });
        return;
      }
    }
    if (step === 2) {
      if (!adSetData.placements.length) {
        toast({ title: "Selecione pelo menos um posicionamento", variant: "destructive" });
        return;
      }
    }
    if (step === 3) {
      if (!adData.content.trim()) {
        toast({ title: "Informe o conteúdo do anúncio", variant: "destructive" });
        return;
      }
      createCampaignMutation.mutate();
      return;
    }
    setStep(step + 1);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Nova Campanha"}
            {step === 2 && "Público e Posicionamento"}
            {step === 3 && "Criar Anúncio"}
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 3
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Campaign Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Campanha</Label>
              <Input
                id="name"
                value={campaignData.name}
                onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                placeholder="Ex: Promoção de Verão"
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivo da Campanha</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {objectives.map((obj) => (
                  <div
                    key={obj.value}
                    onClick={() => setCampaignData({ ...campaignData, objective: obj.value })}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      campaignData.objective === obj.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-medium text-sm">{obj.label}</p>
                    <p className="text-xs text-muted-foreground">{obj.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Orçamento</Label>
                <Select
                  value={campaignData.budget_type}
                  onValueChange={(v) => setCampaignData({ ...campaignData, budget_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Orçamento (R$)</Label>
                <CurrencyInput
                  value={campaignData.budget_amount}
                  onChange={(v) => setCampaignData({ ...campaignData, budget_amount: v })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={campaignData.start_date}
                  onChange={(e) => setCampaignData({ ...campaignData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data de Término</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={campaignData.end_date}
                  onChange={(e) => setCampaignData({ ...campaignData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Ad Set */}
        {step === 2 && (
          <CircleAdsAdSetForm
            data={adSetData}
            onChange={setAdSetData}
          />
        )}

        {/* Step 3: Ad */}
        {step === 3 && (
          <CircleAdsAdForm
            data={adData}
            onChange={setAdData}
            objective={campaignData.objective}
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step > 1 ? "Voltar" : "Cancelar"}
          </Button>

          <Button
            onClick={handleNext}
            disabled={createCampaignMutation.isPending}
          >
            {createCampaignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : step === 3 ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Criar Campanha
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

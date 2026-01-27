import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  Eye, 
  MousePointer,
  TrendingUp,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CircleAdsAdSetForm } from "./CircleAdsAdSetForm";
import { CircleAdsAdForm } from "./CircleAdsAdForm";

interface Props {
  campaignId: string;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  pending_review: { label: "Em Análise", variant: "outline" },
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  rejected: { label: "Reprovada", variant: "destructive" },
  completed: { label: "Encerrada", variant: "outline" },
};

export function CircleAdsCampaignDetails({ campaignId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddAdSet, setShowAddAdSet] = useState(false);
  const [showAddAd, setShowAddAd] = useState<string | null>(null);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["circle-ads-campaign-details", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_campaigns")
        .select(`
          *,
          ad_sets:circle_ads_ad_sets(
            *,
            ads:circle_ads_ads(*)
          )
        `)
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ["circle-ads-campaign-metrics", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_daily_metrics")
        .select(`
          *,
          ad:circle_ads_ads!inner(
            ad_set:circle_ads_ad_sets!inner(campaign_id)
          )
        `);
      
      if (error) throw error;
      
      const filtered = data?.filter((m: any) => m.ad?.ad_set?.campaign_id === campaignId) || [];
      
      return filtered.reduce(
        (acc: any, m: any) => ({
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          spent: acc.spent + parseFloat(m.spent || 0),
        }),
        { impressions: 0, clicks: 0, spent: 0 }
      );
    },
    enabled: !!campaignId,
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      // Update campaign
      const { error: campaignError } = await supabase
        .from("circle_ads_campaigns")
        .update({ status: "pending_review" })
        .eq("id", campaignId);
      if (campaignError) throw campaignError;

      // Update all ad sets
      const adSetIds = campaign?.ad_sets?.map((s: any) => s.id) || [];
      if (adSetIds.length > 0) {
        await supabase
          .from("circle_ads_ad_sets")
          .update({ status: "pending_review" })
          .in("id", adSetIds);

        // Update all ads
        const adIds = campaign?.ad_sets?.flatMap((s: any) => s.ads?.map((a: any) => a.id) || []) || [];
        if (adIds.length > 0) {
          await supabase
            .from("circle_ads_ads")
            .update({ status: "pending_review" })
            .in("id", adIds);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads"] });
      toast({ title: "Campanha enviada para análise!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar para análise", variant: "destructive" });
    },
  });

  const deleteAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      const { error } = await supabase
        .from("circle_ads_ads")
        .delete()
        .eq("id", adId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-campaign-details"] });
      toast({ title: "Anúncio excluído" });
    },
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const canSubmitForReview = campaign?.status === "draft" || campaign?.status === "rejected";
  const hasAds = campaign?.ad_sets?.some((s: any) => s.ads?.length > 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg">{campaign?.name}</DialogTitle>
            <Badge variant={statusConfig[campaign?.status as keyof typeof statusConfig]?.variant || "secondary"}>
              {statusConfig[campaign?.status as keyof typeof statusConfig]?.label || campaign?.status}
            </Badge>
          </div>
        </DialogHeader>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">{metrics?.impressions || 0}</p>
              <p className="text-xs text-muted-foreground">Impressões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <MousePointer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">{metrics?.clicks || 0}</p>
              <p className="text-xs text-muted-foreground">Cliques</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-bold">R$ {metrics?.spent?.toFixed(2) || "0.00"}</p>
              <p className="text-xs text-muted-foreground">Gasto</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Orçamento</p>
            <p className="font-medium">
              R$ {Number(campaign?.budget_amount || 0).toFixed(2)}
              <span className="text-xs text-muted-foreground ml-1">
                ({campaign?.budget_type === "daily" ? "diário" : "total"})
              </span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Início</p>
            <p className="font-medium">
              {campaign?.start_date 
                ? format(new Date(campaign.start_date), "dd/MM/yyyy", { locale: ptBR })
                : "Não definido"
              }
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Término</p>
            <p className="font-medium">
              {campaign?.end_date 
                ? format(new Date(campaign.end_date), "dd/MM/yyyy", { locale: ptBR })
                : "Indefinido"
              }
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Gasto Total</p>
            <p className="font-medium">R$ {Number(campaign?.spent_amount || 0).toFixed(2)}</p>
          </div>
        </div>

        {campaign?.rejection_reason && (
          <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            <strong>Motivo da reprovação:</strong> {campaign.rejection_reason}
          </div>
        )}

        {/* Ad Sets and Ads */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Conjuntos de Anúncios</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddAdSet(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Conjunto
            </Button>
          </div>

          {!campaign?.ad_sets?.length ? (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground">
                <p>Nenhum conjunto de anúncios. Crie um para começar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaign.ad_sets.map((adSet: any) => (
                <Card key={adSet.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{adSet.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {adSet.placements?.join(", ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {adSet.ads?.length > 0 ? (
                      <div className="space-y-2">
                        {adSet.ads.map((ad: any) => (
                          <div 
                            key={ad.id} 
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              {ad.media_urls?.[0] && (
                                <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                                  <img 
                                    src={ad.media_urls[0]} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{ad.name}</p>
                                <Badge 
                                  variant={statusConfig[ad.status as keyof typeof statusConfig]?.variant || "secondary"}
                                  className="text-xs"
                                >
                                  {statusConfig[ad.status as keyof typeof statusConfig]?.label || ad.status}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => deleteAdMutation.mutate(ad.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum anúncio neste conjunto</p>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="w-full mt-2"
                      onClick={() => setShowAddAd(adSet.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Anúncio
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {canSubmitForReview && hasAds && (
            <Button 
              onClick={() => submitForReviewMutation.mutate()}
              disabled={submitForReviewMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar para Análise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

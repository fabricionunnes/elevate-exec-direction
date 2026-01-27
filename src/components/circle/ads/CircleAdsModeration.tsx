import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Check, 
  X, 
  Eye, 
  AlertTriangle, 
  Clock, 
  Shield,
  MessageSquare
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export function CircleAdsModeration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch pending ads
  const { data: pendingAds, isLoading } = useQuery({
    queryKey: ["circle-ads-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_ads")
        .select(`
          *,
          ad_set:circle_ads_ad_sets!inner(
            *,
            campaign:circle_ads_campaigns!inner(
              *,
              profile:circle_profiles!circle_ads_campaigns_profile_id_fkey(id, display_name, avatar_url, trust_score)
            )
          )
        `)
        .eq("status", "pending_review")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch reports
  const { data: reports } = useQuery({
    queryKey: ["circle-ads-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_ads_reports")
        .select(`
          *,
          ad:circle_ads_ads(id, name, content),
          reporter:circle_profiles(id, display_name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (adId: string) => {
      const { error } = await supabase
        .from("circle_ads_ads")
        .update({
          status: "active",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", adId);
      if (error) throw error;

      // Also update the ad set and campaign to pending_review -> active
      const { data: ad } = await supabase
        .from("circle_ads_ads")
        .select("ad_set_id")
        .eq("id", adId)
        .single();

      if (ad?.ad_set_id) {
        await supabase
          .from("circle_ads_ad_sets")
          .update({ status: "active" })
          .eq("id", ad.ad_set_id);

        const { data: adSet } = await supabase
          .from("circle_ads_ad_sets")
          .select("campaign_id")
          .eq("id", ad.ad_set_id)
          .single();

        if (adSet?.campaign_id) {
          await supabase
            .from("circle_ads_campaigns")
            .update({ status: "active" })
            .eq("id", adSet.campaign_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-pending"] });
      toast({ title: "Anúncio aprovado!" });
      setSelectedAd(null);
    },
    onError: () => {
      toast({ title: "Erro ao aprovar anúncio", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ adId, reason }: { adId: string; reason: string }) => {
      const { error } = await supabase
        .from("circle_ads_ads")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", adId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-pending"] });
      toast({ title: "Anúncio rejeitado" });
      setSelectedAd(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "Erro ao rejeitar anúncio", variant: "destructive" });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("circle_ads_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-reports"] });
      toast({ title: "Denúncia resolvida" });
    },
  });

  const adTypeLabels: Record<string, string> = {
    sponsored_post: "Post Patrocinado",
    sponsored_story: "Story Patrocinado",
    marketplace_ad: "Anúncio de Marketplace",
    community_ad: "Anúncio de Comunidade",
    event_ad: "Anúncio de Evento",
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {(pendingAds?.length || 0) > 0 && (
              <Badge variant="secondary">{pendingAds?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Denúncias
            {(reports?.length || 0) > 0 && (
              <Badge variant="destructive">{reports?.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Ads */}
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !pendingAds?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Tudo em dia!</h3>
                <p className="text-muted-foreground text-sm">
                  Não há anúncios pendentes de aprovação
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingAds.map((ad) => (
                <Card key={ad.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Media Preview */}
                      {ad.media_urls?.[0] && (
                        <div className="w-full sm:w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          {ad.media_urls[0].includes(".mp4") ? (
                            <video src={ad.media_urls[0]} className="w-full h-full object-cover" />
                          ) : (
                            <img src={ad.media_urls[0]} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-semibold">{ad.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {adTypeLabels[ad.ad_type] || ad.ad_type}
                            </p>
                          </div>
                          <Badge variant="outline">
                            Trust: {ad.ad_set?.campaign?.profile?.trust_score || 0}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {ad.content}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <span>Anunciante: {ad.ad_set?.campaign?.profile?.display_name}</span>
                          <span>•</span>
                          <span>
                            Enviado: {format(new Date(ad.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedAd(ad)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(ad.id)}
                            disabled={approveMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setSelectedAd({ ...ad, showReject: true })}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="mt-4">
          {!reports?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sem denúncias</h3>
                <p className="text-muted-foreground text-sm">
                  Não há denúncias pendentes de análise
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span className="font-medium">{report.reason}</span>
                        </div>
                        {report.details && (
                          <p className="text-sm text-muted-foreground mb-2">{report.details}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Anúncio: {report.ad?.name} • 
                          Denunciado por: {report.reporter?.display_name} • 
                          {format(new Date(report.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveReportMutation.mutate(report.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Resolver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ad Details / Reject Dialog */}
      {selectedAd && (
        <Dialog open onOpenChange={() => setSelectedAd(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedAd.showReject ? "Rejeitar Anúncio" : "Detalhes do Anúncio"}
              </DialogTitle>
            </DialogHeader>

            {selectedAd.showReject ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe o motivo da rejeição para o anunciante:
                </p>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Conteúdo não está de acordo com as políticas..."
                  rows={4}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelectedAd(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => rejectMutation.mutate({ adId: selectedAd.id, reason: rejectionReason })}
                    disabled={!rejectionReason.trim() || rejectMutation.isPending}
                  >
                    Confirmar Rejeição
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedAd.media_urls?.[0] && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {selectedAd.media_urls[0].includes(".mp4") ? (
                      <video src={selectedAd.media_urls[0]} controls className="w-full h-full object-contain" />
                    ) : (
                      <img src={selectedAd.media_urls[0]} alt="" className="w-full h-full object-contain" />
                    )}
                  </div>
                )}
                
                {selectedAd.title && (
                  <h4 className="font-semibold text-lg">{selectedAd.title}</h4>
                )}
                
                <p className="text-sm">{selectedAd.content}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-medium">{adTypeLabels[selectedAd.ad_type] || selectedAd.ad_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CTA</p>
                    <p className="font-medium">{selectedAd.cta_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Anunciante</p>
                    <p className="font-medium">{selectedAd.ad_set?.campaign?.profile?.display_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trust Score</p>
                    <p className="font-medium">{selectedAd.ad_set?.campaign?.profile?.trust_score || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => setSelectedAd({ ...selectedAd, showReject: true })}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                  <Button onClick={() => approveMutation.mutate(selectedAd.id)}>
                    <Check className="h-4 w-4 mr-1" />
                    Aprovar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

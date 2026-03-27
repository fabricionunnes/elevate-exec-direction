import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ExternalLink, Play } from "lucide-react";
import { motion } from "framer-motion";
import type { MetricKey } from "./useMetricVisibility";

interface Props { projectId: string; dateStart: string; dateStop: string; visibleMetrics: Set<MetricKey>; }

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export const MetaAdsCreatives = ({ projectId, dateStart, dateStop, visibleMetrics }: Props) => {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("meta_ads_ads").select("*")
        .eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop)
        .order("spend", { ascending: false });
      setAds(data || []);
      setLoading(false);
    };
    fetch();
  }, [projectId, dateStart, dateStop]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (ads.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum anúncio encontrado</CardContent></Card>;

  const hasVideo = (ad: any) => !!ad.creative_video_url;
  const getMediaUrl = (ad: any) => ad.creative_image_url || ad.creative_thumbnail_url;

  const allMetrics: { key: MetricKey; label: string; getValue: (ad: any) => string; highlight?: boolean }[] = [
    { key: "spend", label: "Gasto", getValue: (ad) => formatCurrency(Number(ad.spend)), highlight: true },
    { key: "clicks", label: "Cliques", getValue: (ad) => formatNumber(Number(ad.clicks)) },
    { key: "ctr", label: "CTR", getValue: (ad) => `${Number(ad.ctr).toFixed(2)}%` },
    { key: "cpc", label: "CPC", getValue: (ad) => formatCurrency(Number(ad.cpc)) },
    { key: "impressions", label: "Impressões", getValue: (ad) => formatNumber(Number(ad.impressions)) },
    { key: "roas", label: "ROAS", getValue: (ad) => `${Number(ad.roas).toFixed(2)}x` },
    { key: "conversations", label: "Conversas", getValue: (ad) => formatNumber(Number(ad.messaging_conversations_started || 0)) },
    { key: "cost_per_conversation", label: "Custo/Conv.", getValue: (ad) => formatCurrency(Number(ad.cost_per_messaging_conversation || 0)) },
    { key: "frequency", label: "Frequência", getValue: (ad) => Number(ad.frequency || 0).toFixed(2) },
    { key: "leads", label: "Leads", getValue: (ad) => formatNumber(Number(ad.leads || 0)) },
  ];

  const metrics = allMetrics.filter(m => visibleMetrics.has(m.key));

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {ads.map((ad, i) => (
          <motion.div key={ad.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <Card
              className="overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
              onClick={() => setSelectedAd(ad)}
            >
              {(ad.creative_thumbnail_url || ad.creative_image_url) && (
                <div className="aspect-video bg-muted overflow-hidden relative">
                  <img src={ad.creative_thumbnail_url || ad.creative_image_url} alt={ad.ad_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {hasVideo(ad) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="bg-white/90 rounded-full p-3">
                        <Play className="h-6 w-6 text-primary fill-primary" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{ad.ad_name || "Sem nome"}</h4>
                    <p className="text-[10px] text-muted-foreground truncate">{ad.campaign_name} › {ad.adset_name}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${statusColors[ad.status] || ""}`}>
                    {ad.status}
                  </Badge>
                </div>

                {ad.creative_body && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{ad.creative_body}</p>
                )}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  {metrics.map(m => (
                    <Metric key={m.key} label={m.label} value={m.getValue(ad)} highlight={m.highlight} />
                  ))}
                </div>

                {ad.creative_link_url && (
                  <a href={ad.creative_link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3" />
                    Ver destino
                  </a>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selectedAd} onOpenChange={(open) => !open && setSelectedAd(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedAd && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedAd.ad_name || "Sem nome"}</DialogTitle>
                <p className="text-xs text-muted-foreground">{selectedAd.campaign_name} › {selectedAd.adset_name}</p>
              </DialogHeader>

              <div className="space-y-4">
                {hasVideo(selectedAd) && selectedAd.creative_video_url ? (
                  <div className="rounded-lg overflow-hidden bg-black">
                    <video src={selectedAd.creative_video_url} controls playsInline preload="auto" poster={selectedAd.creative_thumbnail_url || selectedAd.creative_image_url || undefined} className="w-full max-h-[60vh] mx-auto" />
                  </div>
                ) : getMediaUrl(selectedAd) ? (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img src={selectedAd.creative_image_url || selectedAd.creative_thumbnail_url} alt={selectedAd.ad_name} className="w-full object-contain max-h-[60vh]" loading="eager" />
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted flex items-center justify-center py-20">
                    <p className="text-sm text-muted-foreground">Criativo não disponível</p>
                  </div>
                )}

                {selectedAd.creative_body && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Texto do anúncio</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedAd.creative_body}</p>
                  </div>
                )}

                {selectedAd.creative_title && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Título</p>
                    <p className="text-sm font-semibold">{selectedAd.creative_title}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-3 border-t">
                  {metrics.map(m => (
                    <Metric key={m.key} label={m.label} value={m.getValue(selectedAd)} highlight={m.highlight} />
                  ))}
                </div>

                {selectedAd.creative_link_url && (
                  <a href={selectedAd.creative_link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    Ver página de destino
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Metric = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-xs font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
  </div>
);

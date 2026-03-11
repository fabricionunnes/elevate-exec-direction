import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface Props { projectId: string; dateStart: string; dateStop: string; }

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export const MetaAdsCreatives = ({ projectId, dateStart, dateStop }: Props) => {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {ads.map((ad, i) => (
        <motion.div key={ad.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
          <Card className="overflow-hidden hover:shadow-lg transition-all group">
            {/* Creative thumbnail */}
            {ad.creative_thumbnail_url && (
              <div className="aspect-video bg-muted overflow-hidden">
                <img src={ad.creative_thumbnail_url} alt={ad.ad_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm truncate">{ad.ad_name || "Sem nome"}</h4>
                  <p className="text-[10px] text-muted-foreground truncate">{ad.campaign_name} › {ad.adset_name}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${statusColors[ad.status] || ""}`}>
                  {ad.status}
                </Badge>
              </div>

              {/* Creative text */}
              {ad.creative_body && (
                <p className="text-xs text-muted-foreground line-clamp-2">{ad.creative_body}</p>
              )}

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <Metric label="Gasto" value={formatCurrency(Number(ad.spend))} highlight />
                <Metric label="Cliques" value={formatNumber(Number(ad.clicks))} />
                <Metric label="CTR" value={`${Number(ad.ctr).toFixed(2)}%`} />
                <Metric label="CPC" value={formatCurrency(Number(ad.cpc))} />
                <Metric label="Impressões" value={formatNumber(Number(ad.impressions))} />
                <Metric label="ROAS" value={`${Number(ad.roas).toFixed(2)}x`} />
              </div>

              {/* Link */}
              {ad.creative_link_url && (
                <a href={ad.creative_link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Ver destino
                </a>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

const Metric = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-xs font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
  </div>
);

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props { projectId: string; dateStart: string; dateStop: string; }

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export const MetaAdsAdsets = ({ projectId, dateStart, dateStop }: Props) => {
  const [adsets, setAdsets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("meta_ads_adsets").select("*")
        .eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop)
        .order("spend", { ascending: false });
      setAdsets(data || []);
      setLoading(false);
    };
    fetch();
  }, [projectId, dateStart, dateStop]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (adsets.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum conjunto de anúncios encontrado</CardContent></Card>;

  return (
    <div className="space-y-3 mt-4">
      {adsets.map((a, i) => (
        <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm truncate">{a.adset_name || "Sem nome"}</h4>
                  <p className="text-xs text-muted-foreground truncate">{a.campaign_name}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${statusColors[a.status] || ""}`}>
                  {a.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <Metric label="Investimento" value={formatCurrency(Number(a.spend))} />
                <Metric label="Impressões" value={formatNumber(Number(a.impressions))} />
                <Metric label="Alcance" value={formatNumber(Number(a.reach))} />
                <Metric label="Cliques" value={formatNumber(Number(a.clicks))} />
                <Metric label="CTR" value={`${Number(a.ctr).toFixed(2)}%`} />
                <Metric label="CPC" value={formatCurrency(Number(a.cpc))} />
                <Metric label="CPM" value={formatCurrency(Number(a.cpm))} />
                <Metric label="Frequência" value={Number(a.frequency).toFixed(2)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

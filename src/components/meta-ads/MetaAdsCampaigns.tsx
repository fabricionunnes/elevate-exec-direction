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
  DELETED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export const MetaAdsCampaigns = ({ projectId, dateStart, dateStop }: Props) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("meta_ads_campaigns").select("*")
        .eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop)
        .order("spend", { ascending: false });
      setCampaigns(data || []);
      setLoading(false);
    };
    fetch();
  }, [projectId, dateStart, dateStop]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (campaigns.length === 0) return <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma campanha encontrada</CardContent></Card>;

  return (
    <div className="space-y-3 mt-4">
      {campaigns.map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{c.campaign_name || "Sem nome"}</h4>
                  <Badge variant="secondary" className={`text-[10px] ${statusColors[c.status] || ""}`}>
                    {c.status}
                  </Badge>
                </div>
                {c.objective && <span className="text-xs text-muted-foreground">{c.objective}</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <Metric label="Investimento" value={formatCurrency(Number(c.spend))} />
                <Metric label="Impressões" value={formatNumber(Number(c.impressions))} />
                <Metric label="Alcance" value={formatNumber(Number(c.reach))} />
                <Metric label="Cliques" value={formatNumber(Number(c.clicks))} />
                <Metric label="CTR" value={`${Number(c.ctr).toFixed(2)}%`} />
                <Metric label="CPC" value={formatCurrency(Number(c.cpc))} />
                <Metric label="CPM" value={formatCurrency(Number(c.cpm))} />
                <Metric label="ROAS" value={`${Number(c.roas).toFixed(2)}x`} />
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

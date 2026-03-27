import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { MetricKey } from "./useMetricVisibility";

interface Props { projectId: string; dateStart: string; dateStop: string; visibleMetrics: Set<MetricKey>; }

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  DELETED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export const MetaAdsCampaigns = ({ projectId, dateStart, dateStop, visibleMetrics }: Props) => {
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

  const allMetrics: { key: MetricKey; label: string; getValue: (c: any) => string }[] = [
    { key: "spend", label: "Investimento", getValue: (c) => formatCurrency(Number(c.spend)) },
    { key: "impressions", label: "Impressões", getValue: (c) => formatNumber(Number(c.impressions)) },
    { key: "reach", label: "Alcance", getValue: (c) => formatNumber(Number(c.reach)) },
    { key: "clicks", label: "Cliques", getValue: (c) => formatNumber(Number(c.clicks)) },
    { key: "ctr", label: "CTR", getValue: (c) => `${Number(c.ctr).toFixed(2)}%` },
    { key: "cpc", label: "CPC", getValue: (c) => formatCurrency(Number(c.cpc)) },
    { key: "cpm", label: "CPM", getValue: (c) => formatCurrency(Number(c.cpm)) },
    { key: "roas", label: "ROAS", getValue: (c) => `${Number(c.roas).toFixed(2)}x` },
    { key: "conversations", label: "Conversas", getValue: (c) => formatNumber(Number(c.messaging_conversations_started || 0)) },
    { key: "cost_per_conversation", label: "Custo/Conversa", getValue: (c) => formatCurrency(Number(c.cost_per_messaging_conversation || 0)) },
    { key: "frequency", label: "Frequência", getValue: (c) => Number(c.frequency || 0).toFixed(2) },
    { key: "leads", label: "Leads", getValue: (c) => formatNumber(Number(c.leads || 0)) },
  ];

  const metrics = allMetrics.filter(m => visibleMetrics.has(m.key));

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
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {metrics.map(m => (
                  <Metric key={m.key} label={m.label} value={m.getValue(c)} />
                ))}
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

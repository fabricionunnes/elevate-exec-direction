import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import type { InstagramAccountMetrics } from "../types";

interface InstagramTrendsProps {
  accountId: string;
}

export const InstagramTrends = ({ accountId }: InstagramTrendsProps) => {
  const [metrics, setMetrics] = useState<InstagramAccountMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from("instagram_account_metrics")
        .select("*")
        .eq("account_id", accountId)
        .order("recorded_date", { ascending: true })
        .limit(90);
      setMetrics((data || []) as InstagramAccountMetrics[]);
      setLoading(false);
    };
    fetchMetrics();
  }, [accountId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Dados de tendência serão exibidos após algumas sincronizações.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.map((m) => ({
    date: new Date(m.recorded_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    seguidores: m.followers_count,
    alcance: m.total_reach,
    engajamento: m.total_engagement,
    curtidas: Number(m.avg_likes),
    comentarios: Number(m.avg_comments),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução de Seguidores</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alcance vs Engajamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="alcance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="engajamento" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Média de Curtidas e Comentários</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="curtidas" stroke="#ec4899" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comentarios" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

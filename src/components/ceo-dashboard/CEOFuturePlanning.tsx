import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, DollarSign, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Projections {
  currentMRR: number;
  projection3m: number;
  projection6m: number;
  projection12m: number;
  growthRate: number;
}

interface ScenarioData {
  month: string;
  conservative: number;
  realistic: number;
  aggressive: number;
}

export function CEOFuturePlanning() {
  const [projections, setProjections] = useState<Projections | null>(null);
  const [scenarioData, setScenarioData] = useState<ScenarioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjections = async () => {
      try {
        // Fetch current MRR (estimated)
        const { data: projects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .in("status", ["onboarding", "active"]);

        const currentMRR = (projects?.length || 0) * 5000; // Estimated average
        const growthRate = 0.08; // 8% monthly growth assumption

        const projection3m = currentMRR * Math.pow(1 + growthRate, 3);
        const projection6m = currentMRR * Math.pow(1 + growthRate, 6);
        const projection12m = currentMRR * Math.pow(1 + growthRate, 12);

        setProjections({
          currentMRR,
          projection3m,
          projection6m,
          projection12m,
          growthRate: growthRate * 100,
        });

        // Generate scenario data
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const data: ScenarioData[] = months.map((month, i) => ({
          month,
          conservative: Math.round(currentMRR * Math.pow(1.03, i + 1)),
          realistic: Math.round(currentMRR * Math.pow(1.08, i + 1)),
          aggressive: Math.round(currentMRR * Math.pow(1.15, i + 1)),
        }));

        setScenarioData(data);
      } catch (error) {
        console.error("Error fetching projections:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjections();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded" />
          </CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!projections) return null;

  return (
    <div className="space-y-6">
      {/* Revenue Projections */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR Atual</p>
                <p className="text-2xl font-bold">{formatCurrency(projections.currentMRR)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projeção 3 meses</p>
                <p className="text-2xl font-bold">{formatCurrency(projections.projection3m)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <BarChart3 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projeção 6 meses</p>
                <p className="text-2xl font-bold">{formatCurrency(projections.projection6m)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Target className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projeção 12 meses</p>
                <p className="text-2xl font-bold">{formatCurrency(projections.projection12m)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenario Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Cenários de Crescimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scenarioData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  className="text-xs"
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês: ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="conservative"
                  name="Conservador (3%/mês)"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="realistic"
                  name="Realista (8%/mês)"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="aggressive"
                  name="Agressivo (15%/mês)"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Metas Estratégicas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { title: "Atingir 100 clientes ativos", progress: 78, target: "Q2 2026" },
              { title: "MRR de R$ 500.000", progress: 45, target: "Q4 2026" },
              { title: "NPS acima de 70", progress: 65, target: "Contínuo" },
              { title: "Churn abaixo de 3%", progress: 82, target: "Contínuo" },
            ].map((goal, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{goal.title}</span>
                  <span className="text-sm text-muted-foreground">{goal.target}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{goal.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

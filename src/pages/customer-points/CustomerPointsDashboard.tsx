import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Trophy, Zap, TrendingUp, Crown, Medal, Award } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface ContextType {
  companyId: string;
  companyName: string;
  pointsName: string;
}

interface Client {
  id: string;
  name: string;
  cpf: string;
  total_points: number;
  last_activity_at: string | null;
}

interface Transaction {
  id: string;
  points: number;
  created_at: string;
  rule?: { name: string } | null;
}

export default function CustomerPointsDashboard() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [totalClients, setTotalClients] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [topClients, setTopClients] = useState<Client[]>([]);
  const [chartData, setChartData] = useState<{ date: string; points: number }[]>([]);
  const [ruleStats, setRuleStats] = useState<{ name: string; points: number }[]>([]);

  useEffect(() => {
    if (!companyId) return;
    fetchDashboardData();
  }, [companyId, period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const startDate = startOfDay(subDays(new Date(), parseInt(period)));

    try {
      // Total clients
      const { count: clientsCount } = await supabase
        .from("customer_points_clients")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "active");

      setTotalClients(clientsCount || 0);

      // Transactions in period
      const { data: transactions } = await supabase
        .from("customer_points_transactions")
        .select("id, points, created_at, rule:customer_points_rules(name)")
        .eq("company_id", companyId)
        .gte("created_at", startDate.toISOString());

      setTotalTransactions(transactions?.length || 0);
      setTotalPoints(transactions?.reduce((sum, t) => sum + t.points, 0) || 0);

      // Top clients
      const { data: clients } = await supabase
        .from("customer_points_clients")
        .select("id, name, cpf, total_points, last_activity_at")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("total_points", { ascending: false })
        .limit(10);

      setTopClients(clients || []);

      // Chart data - points per day
      if (transactions) {
        const dailyPoints: Record<string, number> = {};
        const days = parseInt(period);
        
        for (let i = days - 1; i >= 0; i--) {
          const date = format(subDays(new Date(), i), "yyyy-MM-dd");
          dailyPoints[date] = 0;
        }

        transactions.forEach((t) => {
          const date = format(new Date(t.created_at), "yyyy-MM-dd");
          if (dailyPoints[date] !== undefined) {
            dailyPoints[date] += t.points;
          }
        });

        setChartData(
          Object.entries(dailyPoints).map(([date, points]) => ({
            date: format(new Date(date), "dd/MM", { locale: ptBR }),
            points,
          }))
        );

        // Points per rule
        const rulePoints: Record<string, number> = {};
        transactions.forEach((t) => {
          const ruleName = t.rule?.name || "Sem regra";
          rulePoints[ruleName] = (rulePoints[ruleName] || 0) + t.points;
        });

        setRuleStats(
          Object.entries(rulePoints)
            .map(([name, points]) => ({ name, points }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.**$4");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da pontuação dos seus clientes</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{pointsName} Emitidos</p>
                <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ações</p>
                <p className="text-2xl font-bold">{totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top 1</p>
                <p className="text-lg font-bold truncate">
                  {topClients[0]?.name?.split(" ")[0] || "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Points Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução de {pointsName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Points by Rule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{pointsName} por Regra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ruleStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                  <Tooltip />
                  <Bar dataKey="points" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ranking de Clientes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/customer-points/${companyId}/clients`)}>
            Ver todos
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topClients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente cadastrado ainda
              </p>
            ) : (
              topClients.map((client, index) => (
                <div
                  key={client.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0">{getPositionIcon(index)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCPF(client.cpf)}</p>
                  </div>
                  <Badge variant="secondary" className="font-bold">
                    {client.total_points.toLocaleString()} {pointsName}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

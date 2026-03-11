import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ArrowLeft, Building2, BarChart3, Heart, Star, Brain, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2, Users, Target, Sparkles } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie } from "recharts";

interface CompanyData {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  consultant_id: string | null;
  cs_id: string | null;
  consultantName?: string;
}

interface SegmentData {
  segment: string;
  companies: CompanyData[];
  count: number;
  avgHealthScore: number;
  avgCsat: number;
  avgNps: number;
  avgGoalPercent: number;
  healthClass: string;
}

const CHART_COLORS = [
  "hsl(210, 80%, 50%)", "hsl(142, 70%, 40%)", "hsl(48, 90%, 50%)", 
  "hsl(0, 75%, 55%)", "hsl(280, 60%, 55%)", "hsl(30, 85%, 50%)",
  "hsl(180, 60%, 40%)", "hsl(330, 70%, 50%)", "hsl(60, 80%, 45%)",
  "hsl(200, 70%, 45%)", "hsl(120, 50%, 45%)", "hsl(350, 65%, 50%)",
];

function getHealthClass(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Boa";
  if (score >= 40) return "Atenção";
  return "Crítico";
}

function getHealthBadgeVariant(cls: string): "default" | "secondary" | "destructive" | "outline" {
  if (cls === "Excelente") return "default";
  if (cls === "Boa") return "secondary";
  if (cls === "Atenção") return "outline";
  return "destructive";
}

export default function SegmentsAnalysisPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});
  const [csatScores, setCsatScores] = useState<Record<string, number>>({});
  const [npsScores, setNpsScores] = useState<Record<string, number>>({});
  const [goalPercents, setGoalPercents] = useState<Record<string, number>>({});
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // Fetch companies
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name, segment, status, consultant_id, cs_id")
        .eq("is_simulator", false);

      // Fetch staff for names
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("is_active", true);

      const sMap: Record<string, string> = {};
      (staffData || []).forEach((s: any) => { sMap[s.id] = s.name; });
      setStaffMap(sMap);

      // Fetch projects to map company_id -> project_id
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("id, onboarding_company_id")
        .eq("status", "active");

      const companyToProject: Record<string, string> = {};
      (projects || []).forEach((p: any) => {
        if (p.onboarding_company_id) companyToProject[p.onboarding_company_id] = p.id;
      });

      // Fetch health scores
      const projectIds = (projects || []).map((p: any) => p.id);
      if (projectIds.length > 0) {
        const { data: healthData } = await supabase
          .from("client_health_scores")
          .select("project_id, total_score")
          .in("project_id", projectIds);

        const hMap: Record<string, number> = {};
        (healthData || []).forEach((h: any) => {
          // Map back to company_id
          const companyId = Object.keys(companyToProject).find(k => companyToProject[k] === h.project_id);
          if (companyId) hMap[companyId] = h.total_score;
        });
        setHealthScores(hMap);

        // CSAT
        const { data: csatData } = await supabase
          .from("csat_responses")
          .select("project_id, score")
          .in("project_id", projectIds);

        const csatAgg: Record<string, { sum: number; count: number }> = {};
        (csatData || []).forEach((c: any) => {
          const companyId = Object.keys(companyToProject).find(k => companyToProject[k] === c.project_id);
          if (companyId) {
            if (!csatAgg[companyId]) csatAgg[companyId] = { sum: 0, count: 0 };
            csatAgg[companyId].sum += c.score;
            csatAgg[companyId].count++;
          }
        });
        const cMap: Record<string, number> = {};
        Object.entries(csatAgg).forEach(([k, v]) => { cMap[k] = v.sum / v.count; });
        setCsatScores(cMap);

        // NPS
        const { data: npsData } = await supabase
          .from("onboarding_nps_responses")
          .select("project_id, score")
          .in("project_id", projectIds);

        const npsAgg: Record<string, { sum: number; count: number }> = {};
        (npsData || []).forEach((n: any) => {
          const companyId = Object.keys(companyToProject).find(k => companyToProject[k] === n.project_id);
          if (companyId) {
            if (!npsAgg[companyId]) npsAgg[companyId] = { sum: 0, count: 0 };
            npsAgg[companyId].sum += n.score;
            npsAgg[companyId].count++;
          }
        });
        const nMap: Record<string, number> = {};
        Object.entries(npsAgg).forEach(([k, v]) => { nMap[k] = v.sum / v.count; });
        setNpsScores(nMap);

        // KPI goal achievement
        const companyIds = (companiesData || []).map((c: any) => c.id);
        if (companyIds.length > 0) {
          const { data: kpis } = await supabase
            .from("company_kpis")
            .select("id, company_id, target_value, is_main_goal")
            .eq("is_active", true)
            .eq("is_main_goal", true)
            .in("company_id", companyIds);

          if (kpis && kpis.length > 0) {
            const kpiIds = kpis.map((k: any) => k.id);
            const { data: entries } = await supabase
              .from("kpi_entries")
              .select("kpi_id, value")
              .in("kpi_id", kpiIds);

            const kpiActual: Record<string, number> = {};
            (entries || []).forEach((e: any) => {
              kpiActual[e.kpi_id] = (kpiActual[e.kpi_id] || 0) + e.value;
            });

            const gMap: Record<string, number> = {};
            kpis.forEach((k: any) => {
              const actual = kpiActual[k.id] || 0;
              const pct = k.target_value > 0 ? (actual / k.target_value) * 100 : 0;
              // Use best KPI for company
              if (!gMap[k.company_id] || pct > gMap[k.company_id]) {
                gMap[k.company_id] = Math.min(pct, 200);
              }
            });
            setGoalPercents(gMap);
          }
        }
      }

      setCompanies(
        (companiesData || []).map((c: any) => ({
          ...c,
          consultantName: c.consultant_id ? sMap[c.consultant_id] : undefined,
        }))
      );
    } catch (err) {
      console.error("Error fetching segments data:", err);
      toast.error("Erro ao carregar dados de segmentos");
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterConsultant !== "all" && c.consultant_id !== filterConsultant) return false;
      return true;
    });
  }, [companies, filterStatus, filterConsultant]);

  const segments = useMemo((): SegmentData[] => {
    const map: Record<string, CompanyData[]> = {};
    filteredCompanies.forEach((c) => {
      const seg = c.segment || "Sem Segmento";
      if (!map[seg]) map[seg] = [];
      map[seg].push(c);
    });

    return Object.entries(map)
      .map(([segment, comps]) => {
        const healthArr = comps.map((c) => healthScores[c.id]).filter(Boolean);
        const csatArr = comps.map((c) => csatScores[c.id]).filter(Boolean);
        const npsArr = comps.map((c) => npsScores[c.id]).filter(Boolean);
        const goalArr = comps.map((c) => goalPercents[c.id]).filter(Boolean);

        const avgHealth = healthArr.length > 0 ? healthArr.reduce((a, b) => a + b, 0) / healthArr.length : 0;
        const avgCsat = csatArr.length > 0 ? csatArr.reduce((a, b) => a + b, 0) / csatArr.length : 0;
        const avgNps = npsArr.length > 0 ? npsArr.reduce((a, b) => a + b, 0) / npsArr.length : 0;
        const avgGoal = goalArr.length > 0 ? goalArr.reduce((a, b) => a + b, 0) / goalArr.length : 0;

        return {
          segment,
          companies: comps,
          count: comps.length,
          avgHealthScore: avgHealth,
          avgCsat,
          avgNps,
          avgGoalPercent: avgGoal,
          healthClass: getHealthClass(avgHealth),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredCompanies, healthScores, csatScores, npsScores, goalPercents]);

  const noSegmentCompanies = useMemo(
    () => filteredCompanies.filter((c) => !c.segment),
    [filteredCompanies]
  );

  const totalSegments = useMemo(
    () => segments.filter((s) => s.segment !== "Sem Segmento").length,
    [segments]
  );

  const topSegment = useMemo(
    () => segments.filter((s) => s.segment !== "Sem Segmento")[0]?.segment || "—",
    [segments]
  );

  const consultants = useMemo(() => {
    const ids = new Set(companies.map((c) => c.consultant_id).filter(Boolean));
    return Array.from(ids).map((id) => ({ id: id!, name: staffMap[id!] || id }));
  }, [companies, staffMap]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const segmentSummary = segments
        .filter((s) => s.segment !== "Sem Segmento")
        .map((s) => ({
          segmento: s.segment,
          empresas: s.count,
          saude_media: s.avgHealthScore.toFixed(1),
          csat_medio: s.avgCsat.toFixed(1),
          nps_medio: s.avgNps.toFixed(1),
          meta_media_pct: s.avgGoalPercent.toFixed(1),
          classificacao: s.healthClass,
        }));

      const { data, error } = await supabase.functions.invoke("analyze-segments", {
        body: {
          segments: segmentSummary,
          totalCompanies: filteredCompanies.length,
          noSegmentCount: noSegmentCompanies.length,
        },
      });

      if (error) throw error;
      setAiInsight(data.analysis || "Sem insights disponíveis.");
    } catch (err) {
      console.error("AI analysis error:", err);
      toast.error("Erro ao gerar análise com IA");
    } finally {
      setAiLoading(false);
    }
  };

  const distributionData = useMemo(
    () =>
      segments
        .filter((s) => s.segment !== "Sem Segmento")
        .slice(0, 12)
        .map((s, i) => ({
          name: s.segment.length > 18 ? s.segment.substring(0, 18) + "..." : s.segment,
          value: s.count,
          fill: CHART_COLORS[i % CHART_COLORS.length],
        })),
    [segments]
  );

  const performanceData = useMemo(
    () =>
      segments
        .filter((s) => s.segment !== "Sem Segmento" && s.avgGoalPercent > 0)
        .sort((a, b) => b.avgGoalPercent - a.avgGoalPercent)
        .slice(0, 10)
        .map((s) => ({
          name: s.segment.length > 15 ? s.segment.substring(0, 15) + "..." : s.segment,
          meta: Number(s.avgGoalPercent.toFixed(1)),
        })),
    [segments]
  );

  const satisfactionData = useMemo(
    () =>
      segments
        .filter((s) => s.segment !== "Sem Segmento" && (s.avgCsat > 0 || s.avgNps > 0))
        .sort((a, b) => b.avgCsat - a.avgCsat)
        .slice(0, 10)
        .map((s) => ({
          name: s.segment.length > 15 ? s.segment.substring(0, 15) + "..." : s.segment,
          csat: Number(s.avgCsat.toFixed(1)),
          nps: Number(s.avgNps.toFixed(1)),
        })),
    [segments]
  );

  const healthData = useMemo(
    () =>
      segments
        .filter((s) => s.segment !== "Sem Segmento" && s.avgHealthScore > 0)
        .sort((a, b) => b.avgHealthScore - a.avgHealthScore)
        .slice(0, 10)
        .map((s) => ({
          name: s.segment.length > 15 ? s.segment.substring(0, 15) + "..." : s.segment,
          score: Number(s.avgHealthScore.toFixed(1)),
        })),
    [segments]
  );

  const getBarColor = (value: number, max = 100) => {
    const pct = value;
    if (pct >= 80) return "hsl(142, 70%, 40%)";
    if (pct >= 60) return "hsl(48, 90%, 50%)";
    if (pct >= 40) return "hsl(30, 85%, 50%)";
    return "hsl(0, 75%, 55%)";
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Análise de Segmentos</h1>
          <p className="text-sm text-muted-foreground">Inteligência de mercado por nicho de atuação</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="churned">Churn</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterConsultant} onValueChange={setFilterConsultant}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Consultores</SelectItem>
            {consultants.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total de Empresas</span>
            </div>
            <p className="text-3xl font-bold mt-2">{filteredCompanies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Segmentos Identificados</span>
            </div>
            <p className="text-3xl font-bold mt-2">{totalSegments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Maior Segmento</span>
            </div>
            <p className="text-lg font-bold mt-2 truncate">{topSegment}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-muted-foreground">Sem Segmento</span>
            </div>
            <p className="text-3xl font-bold mt-2 text-destructive">{noSegmentCompanies.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="no-segment">Sem Segmento ({noSegmentCompanies.length})</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Saúde</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfação</TabsTrigger>
          <TabsTrigger value="ai">IA Estratégica</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribution chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição por Segmento</CardTitle>
              </CardHeader>
              <CardContent>
                {distributionData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={distributionData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {distributionData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                        <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Segments table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ranking de Segmentos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {segments.filter(s => s.segment !== "Sem Segmento").map((s, i) => (
                      <div key={s.segment} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                          <span className="text-sm font-medium">{s.segment}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{s.count} empresas</Badge>
                          <Badge variant={getHealthBadgeVariant(s.healthClass)}>{s.healthClass}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* No Segment */}
        <TabsContent value="no-segment">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Empresas sem Segmento
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Estas empresas precisam ter o campo "Segmento" preenchido nos detalhes.
              </p>
            </CardHeader>
            <CardContent>
              {noSegmentCompanies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Todas as empresas possuem segmento cadastrado! 🎉</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {noSegmentCompanies.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                            {c.consultantName && (
                              <span className="text-xs text-muted-foreground">
                                Consultor: {c.consultantName}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/onboarding-tasks/companies/${c.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir Empresa
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Atingimento de Metas por Segmento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Sem dados de metas disponíveis</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(250, performanceData.length * 40)}>
                  <BarChart data={performanceData} layout="vertical" margin={{ left: 10, right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                    <XAxis type="number" domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Meta Entregue"]} />
                    <Bar dataKey="meta" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {performanceData.map((entry, i) => (
                        <Cell key={i} fill={getBarColor(entry.meta)} />
                      ))}
                      <LabelList dataKey="meta" position="right" formatter={(v: number) => `${v.toFixed(0)}%`} style={{ fontSize: 12, fontWeight: 500 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Performance table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Segmento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Segmento</th>
                      <th className="text-center py-2 px-2">Empresas</th>
                      <th className="text-center py-2 px-2">Meta Média %</th>
                      <th className="text-center py-2 px-2">Saúde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.filter(s => s.segment !== "Sem Segmento").map((s) => (
                      <tr key={s.segment} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">{s.segment}</td>
                        <td className="text-center py-2 px-2">{s.count}</td>
                        <td className="text-center py-2 px-2">
                          {s.avgGoalPercent > 0 ? `${s.avgGoalPercent.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center py-2 px-2">
                          <Badge variant={getHealthBadgeVariant(s.healthClass)}>{s.healthClass}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Saúde por Segmento
              </CardTitle>
              <p className="text-sm text-muted-foreground">Score médio de saúde dos clientes agrupados por segmento</p>
            </CardHeader>
            <CardContent>
              {healthData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Sem dados de saúde disponíveis</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(250, healthData.length * 40)}>
                  <BarChart data={healthData} layout="vertical" margin={{ left: 10, right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(1), "Score de Saúde"]} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {healthData.map((entry, i) => (
                        <Cell key={i} fill={getBarColor(entry.score)} />
                      ))}
                      <LabelList dataKey="score" position="right" formatter={(v: number) => v.toFixed(0)} style={{ fontSize: 12, fontWeight: 500 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Health summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Excelente (≥80)", count: segments.filter(s => s.segment !== "Sem Segmento" && s.healthClass === "Excelente").length, color: "text-green-500" },
              { label: "Boa (60-79)", count: segments.filter(s => s.segment !== "Sem Segmento" && s.healthClass === "Boa").length, color: "text-blue-500" },
              { label: "Atenção (40-59)", count: segments.filter(s => s.segment !== "Sem Segmento" && s.healthClass === "Atenção").length, color: "text-yellow-500" },
              { label: "Crítico (<40)", count: segments.filter(s => s.segment !== "Sem Segmento" && s.healthClass === "Crítico").length, color: "text-red-500" },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="pt-6 text-center">
                  <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Satisfaction */}
        <TabsContent value="satisfaction" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  CSAT Médio por Segmento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {satisfactionData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados de CSAT</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(250, satisfactionData.length * 40)}>
                    <BarChart data={satisfactionData} layout="vertical" margin={{ left: 10, right: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                      <XAxis type="number" domain={[0, 5]} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="csat" name="CSAT" fill="hsl(210, 80%, 50%)" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        <LabelList dataKey="csat" position="right" style={{ fontSize: 12, fontWeight: 500 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  NPS Médio por Segmento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {satisfactionData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sem dados de NPS</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(250, satisfactionData.length * 40)}>
                    <BarChart data={satisfactionData} layout="vertical" margin={{ left: 10, right: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                      <XAxis type="number" domain={[0, 10]} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="nps" name="NPS" fill="hsl(142, 70%, 40%)" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        <LabelList dataKey="nps" position="right" style={{ fontSize: 12, fontWeight: 500 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                IA de Análise de Segmentos UNV
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Análise inteligente dos segmentos de mercado com insights estratégicos
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleAIAnalysis} disabled={aiLoading} className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4 mr-2" />
                {aiLoading ? "Analisando..." : "Gerar Análise Estratégica"}
              </Button>

              {aiInsight && (
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {aiInsight}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

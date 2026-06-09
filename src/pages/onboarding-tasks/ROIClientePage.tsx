import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Target,
  BarChart3,
  AlertTriangle,
  Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  status: string;
  contract_start_date: string | null;
  contract_value: number | null;
  consultant_id: string | null;
  cs_id: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface SalesHistoryEntry {
  company_id: string;
  month_year: string;
  revenue: number;
  sales_count?: number;
  is_pre_unv?: boolean;
}

interface KpiEntry {
  company_id: string;
  kpi_id: string;
  entry_date: string;
  value: number;
}

interface CompanyKpi {
  id: string;
  company_id: string;
  name: string;
  target_value: number | null;
  is_main_goal: boolean;
  kpi_type: string | null;
}

interface NpsResult {
  company_id: string;
  score: number;
  created_at: string;
}

interface ROIRow {
  company: Company;
  consultantName: string;
  mediaAntes: number | null;
  mediaDepois: number | null;
  roiPercent: number | null;
  currentRevenue: number | null;
  targetValue: number | null;
  targetPercent: number | null;
  npsScore: number | null;
  mesesAtivo: number;
  dataStatus: "suficiente" | "parcial" | "insuficiente";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function fmtPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function roiColor(roi: number | null): string {
  if (roi === null) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  if (roi > 20) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  if (roi >= 0) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
}

function rowBorderColor(roi: number | null, dataStatus: string): string {
  if (dataStatus === "insuficiente") return "border-l-4 border-l-gray-300";
  if (roi === null) return "border-l-4 border-l-yellow-400";
  if (roi > 20) return "border-l-4 border-l-green-500";
  if (roi >= 0) return "border-l-4 border-l-yellow-400";
  return "border-l-4 border-l-red-500";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "Ativo",
    onboarding: "Onboarding",
    churned: "Cancelado",
    paused: "Pausado",
  };
  return map[status] ?? status;
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    onboarding: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    churned: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    paused: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return variants[status] ?? "bg-gray-100 text-gray-600";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ROIClientePage() {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesHistoryEntry[]>([]);
  const [kpiEntries, setKpiEntries] = useState<KpiEntry[]>([]);
  const [companyKpis, setCompanyKpis] = useState<CompanyKpi[]>([]);
  const [npsData, setNpsData] = useState<NpsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"roi" | "name" | "meta">("roi");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Empresas ativas
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name, status, contract_start_date, contract_value, consultant_id, cs_id")
        .in("status", ["active", "onboarding"])
        .order("name");

      // Staff
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true);

      // Sales history — tenta company_sales_history primeiro
      let salesData: SalesHistoryEntry[] = [];
      try {
        const { data, error } = await supabase
          .from("company_sales_history" as any)
          .select("company_id, month_year, revenue, sales_count, is_pre_unv");
        if (!error && data) {
          salesData = data as SalesHistoryEntry[];
        } else {
          // fallback
          const { data: data2 } = await supabase
            .from("sales_history_entries" as any)
            .select("company_id, month_year, revenue, sales_count, is_pre_unv");
          if (data2) salesData = data2 as SalesHistoryEntry[];
        }
      } catch {}

      // KPI entries do mês atual
      const currentMonth = format(new Date(), "yyyy-MM");
      let kpiData: KpiEntry[] = [];
      try {
        const { data } = await supabase
          .from("kpi_entries")
          .select("company_id, kpi_id, entry_date, value")
          .gte("entry_date", `${currentMonth}-01`);
        if (data) kpiData = data as KpiEntry[];
      } catch {}

      // KPIs principais
      let kpisData: CompanyKpi[] = [];
      try {
        const { data } = await supabase
          .from("company_kpis")
          .select("id, company_id, name, target_value, is_main_goal, kpi_type")
          .eq("is_active" as any, true)
          .eq("is_main_goal", true);
        if (data) kpisData = data as CompanyKpi[];
      } catch {}

      // NPS — tenta nps_results, depois nps_responses
      let nps: NpsResult[] = [];
      try {
        const { data, error } = await supabase
          .from("nps_results" as any)
          .select("company_id, score, created_at")
          .order("created_at", { ascending: false });
        if (!error && data) {
          nps = data as NpsResult[];
        } else {
          const { data: data2 } = await supabase
            .from("nps_responses" as any)
            .select("company_id, score, created_at")
            .order("created_at", { ascending: false });
          if (data2) nps = data2 as NpsResult[];
        }
      } catch {}

      setCompanies(companiesData ?? []);
      setStaff(staffData ?? []);
      setSalesHistory(salesData);
      setKpiEntries(kpiData);
      setCompanyKpis(kpisData);
      setNpsData(nps);
    } catch (err) {
      console.error("Erro ao carregar dados de ROI:", err);
    } finally {
      setLoading(false);
    }
  }

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [staff]);

  // NPS mais recente por empresa
  const latestNps = useMemo(() => {
    const m: Record<string, number> = {};
    npsData.forEach((n) => {
      if (!(n.company_id in m)) m[n.company_id] = n.score;
    });
    return m;
  }, [npsData]);

  // KPI principal por empresa
  const mainKpiMap = useMemo(() => {
    const m: Record<string, CompanyKpi> = {};
    companyKpis.forEach((k) => {
      if (!m[k.company_id]) m[k.company_id] = k;
    });
    return m;
  }, [companyKpis]);

  // KPI entry recente por empresa (mês corrente)
  const kpiEntryMap = useMemo(() => {
    const m: Record<string, number> = {};
    kpiEntries.forEach((e) => {
      const kpi = mainKpiMap[e.company_id];
      if (kpi && e.kpi_id === kpi.id) {
        m[e.company_id] = e.value;
      }
    });
    return m;
  }, [kpiEntries, mainKpiMap]);

  const rows: ROIRow[] = useMemo(() => {
    return companies.map((company) => {
      const consultantName = staffMap[company.consultant_id ?? ""] ?? "-";

      // Histórico de vendas desta empresa
      const history = salesHistory.filter((h) => h.company_id === company.id);

      const startDate = company.contract_start_date
        ? company.contract_start_date.substring(0, 7) // "yyyy-MM"
        : null;

      const beforeHistory = history.filter((h) => {
        if (typeof h.is_pre_unv === "boolean") return h.is_pre_unv;
        return startDate ? h.month_year < startDate : false;
      });

      const afterHistory = history.filter((h) => {
        if (typeof h.is_pre_unv === "boolean") return !h.is_pre_unv;
        return startDate ? h.month_year >= startDate : false;
      });

      const mesesAtivo = afterHistory.length;

      const mediaAntes =
        beforeHistory.length > 0
          ? beforeHistory.reduce((s, h) => s + (h.revenue ?? 0), 0) / beforeHistory.length
          : null;

      const mediaDepois =
        afterHistory.length > 0
          ? afterHistory.reduce((s, h) => s + (h.revenue ?? 0), 0) / afterHistory.length
          : null;

      const roiPercent =
        mediaAntes !== null && mediaAntes > 0 && mediaDepois !== null
          ? ((mediaDepois - mediaAntes) / mediaAntes) * 100
          : null;

      // Faturamento atual: KPI entry ou último afterHistory
      const currentRevenue =
        kpiEntryMap[company.id] ??
        (afterHistory.length > 0
          ? afterHistory.sort((a, b) => b.month_year.localeCompare(a.month_year))[0].revenue
          : null);

      const mainKpi = mainKpiMap[company.id];
      const targetValue = mainKpi?.target_value ?? null;
      const targetPercent =
        targetValue && currentRevenue !== null && targetValue > 0
          ? (currentRevenue / targetValue) * 100
          : null;

      const npsScore = latestNps[company.id] ?? null;

      let dataStatus: ROIRow["dataStatus"] = "insuficiente";
      if (beforeHistory.length >= 1 && afterHistory.length >= 2) dataStatus = "suficiente";
      else if (afterHistory.length >= 1) dataStatus = "parcial";

      return {
        company,
        consultantName,
        mediaAntes,
        mediaDepois,
        roiPercent,
        currentRevenue,
        targetValue,
        targetPercent,
        npsScore,
        mesesAtivo,
        dataStatus,
      };
    });
  }, [companies, salesHistory, staffMap, kpiEntryMap, mainKpiMap, latestNps]);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filterConsultant !== "all") {
      r = r.filter(
        (row) => row.company.consultant_id === filterConsultant || row.company.cs_id === filterConsultant
      );
    }
    return [...r].sort((a, b) => {
      if (sortBy === "roi") {
        const av = a.roiPercent ?? -Infinity;
        const bv = b.roiPercent ?? -Infinity;
        return bv - av;
      }
      if (sortBy === "meta") {
        const av = a.targetPercent ?? -Infinity;
        const bv = b.targetPercent ?? -Infinity;
        return bv - av;
      }
      return a.company.name.localeCompare(b.company.name);
    });
  }, [rows, filterConsultant, sortBy]);

  // Cards de resumo
  const totalClientes = rows.length;
  const mediaROI = useMemo(() => {
    const com = rows.filter((r) => r.roiPercent !== null);
    if (!com.length) return null;
    return com.reduce((s, r) => s + r.roiPercent!, 0) / com.length;
  }, [rows]);
  const roiPositivos = rows.filter((r) => r.roiPercent !== null && r.roiPercent > 0).length;
  const emRisco = rows.filter(
    (r) => (r.roiPercent !== null && r.roiPercent < 0) || r.dataStatus === "insuficiente"
  ).length;

  const consultants = useMemo(() => {
    const ids = new Set<string>();
    companies.forEach((c) => {
      if (c.consultant_id) ids.add(c.consultant_id);
      if (c.cs_id) ids.add(c.cs_id);
    });
    return staff.filter((s) => ids.has(s.id));
  }, [companies, staff]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <NexusHeader />

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">ROI dos Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Comparativo de desempenho antes e depois do início do contrato com a UNV
            </p>
          </div>
        </div>

        {/* Cards de resumo */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Clientes ativos</p>
                    <p className="text-2xl font-bold">{totalClientes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROI médio</p>
                    <p className="text-2xl font-bold">
                      {mediaROI !== null ? fmtPercent(mediaROI) : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ROI positivo</p>
                    <p className="text-2xl font-bold">{roiPositivos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Em atenção</p>
                    <p className="text-2xl font-bold">{emRisco}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={filterConsultant} onValueChange={setFilterConsultant}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roi">Ordenar por ROI</SelectItem>
                <SelectItem value="meta">Ordenar por % meta</SelectItem>
                <SelectItem value="name">Ordenar por nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground ml-auto">
            {filteredRows.length} empresa{filteredRows.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma empresa encontrada com os filtros aplicados.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Header da tabela (desktop) */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Empresa</span>
              <span>Consultor</span>
              <span>Início</span>
              <span>Fat. Médio (antes→depois)</span>
              <span>ROI</span>
              <span>Meta do mês</span>
              <span>% Meta</span>
              <span>NPS</span>
            </div>

            {filteredRows.map((row) => (
              <div
                key={row.company.id}
                className={`bg-card rounded-lg shadow-sm ${rowBorderColor(row.roiPercent, row.dataStatus)} px-4 py-3 grid md:grid-cols-[2fr_1fr_1fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 items-center`}
              >
                {/* Empresa */}
                <div>
                  <p className="font-semibold text-sm">{row.company.name}</p>
                  <Badge className={`text-xs mt-1 ${statusBadge(row.company.status)}`} variant="outline">
                    {statusLabel(row.company.status)}
                  </Badge>
                </div>

                {/* Consultor */}
                <div className="text-sm text-muted-foreground">{row.consultantName}</div>

                {/* Início */}
                <div className="text-sm text-muted-foreground">
                  {row.company.contract_start_date
                    ? format(parseISO(row.company.contract_start_date), "MMM/yyyy", { locale: ptBR })
                    : "-"}
                </div>

                {/* Faturamento antes → depois */}
                <div className="text-sm">
                  {row.mediaAntes !== null || row.mediaDepois !== null ? (
                    <span>
                      <span className="text-muted-foreground">{fmtBRL(row.mediaAntes)}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-medium">{fmtBRL(row.mediaDepois)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">sem histórico</span>
                  )}
                </div>

                {/* ROI */}
                <div>
                  {row.dataStatus === "insuficiente" ? (
                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800">
                      <Minus className="h-3 w-3 mr-1" /> {row.mesesAtivo}m
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={`text-xs font-bold ${roiColor(row.roiPercent)}`}>
                      {row.roiPercent !== null ? (
                        <>
                          {row.roiPercent > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {fmtPercent(row.roiPercent)}
                        </>
                      ) : (
                        "-"
                      )}
                    </Badge>
                  )}
                </div>

                {/* Meta do mês */}
                <div className="text-sm">{fmtBRL(row.targetValue)}</div>

                {/* % Meta */}
                <div>
                  {row.targetPercent !== null ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        row.targetPercent >= 100
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : row.targetPercent >= 70
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      {row.targetPercent.toFixed(0)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>

                {/* NPS */}
                <div>
                  {row.npsScore !== null ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        row.npsScore >= 8
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : row.npsScore >= 6
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}
                    >
                      {row.npsScore.toFixed(1)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> ROI acima de 20%
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> ROI 0–20% ou dados parciais
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> ROI negativo
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> Histórico insuficiente (&lt;2 meses)
          </div>
        </div>
      </div>
    </div>
  );
}

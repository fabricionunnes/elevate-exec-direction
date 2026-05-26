import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  GraduationCap,
  DollarSign,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Matricula {
  id: string;
  data_venda: string | null;
  vendedor: string | null;
  cliente: string | null;
  forma_ingresso: string | null;
  modalidade: string | null;
  curso: string | null;
  valor_matricula: number | null;
  valor_total: number | null;
  row_index: number | null;
}

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  rows_imported: number | null;
  status: string;
  error_message: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CANCELLED_TYPES = ["CANCELADO", "TRANSFERIDO"];

const MODALIDADE_COLORS: Record<string, string> = {
  EAD: "#3b82f6",
  Presencial: "#22c55e",
  "Pós-Graduação": "#a855f7",
};

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const EXCLUDED_SELLERS = ["SECRETARIA", "ALUNO"];

const MONTHS: { label: string; value: string }[] = [
  { label: "Todos", value: "all" },
  { label: "Fev/25", value: "2025-02" },
  { label: "Mar/25", value: "2025-03" },
  { label: "Abr/25", value: "2025-04" },
  { label: "Mai/25", value: "2025-05" },
  { label: "Jun/25", value: "2025-06" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtBRLFull(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(isoDate: string) {
  try {
    return format(parseISO(isoDate + "-01"), "MMM/yy", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

function toMonthKey(date: string | null): string | null {
  if (!date) return null;
  return date.slice(0, 7); // YYYY-MM
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FacunicampsDashboardPage() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: mats, error: matErr }, { data: runs, error: runErr }] =
        await Promise.all([
          supabase
            .from("facunicamps_matriculas")
            .select("*")
            .order("data_venda", { ascending: true }),
          supabase
            .from("facunicamps_sync_runs")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(5),
        ]);

      if (matErr) throw matErr;
      if (runErr) throw runErr;

      setMatriculas((mats as Matricula[]) ?? []);
      setSyncRuns((runs as SyncRun[]) ?? []);
    } catch (err: unknown) {
      toast.error("Erro ao carregar dados: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Manual sync ─────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("facunicamps-sync", {
        body: {},
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Sync failed");
      toast.success(`Sincronização concluída: ${data.rows_imported} matrículas importadas`);
      await fetchData();
    } catch (err: unknown) {
      toast.error("Erro na sincronização: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
    }
  };

  // ── Filtered data ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (selectedMonth === "all") return matriculas;
    return matriculas.filter((m) => toMonthKey(m.data_venda) === selectedMonth);
  }, [matriculas, selectedMonth]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const active = filtered.filter(
      (m) => !CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())
    );
    const cancelled = filtered.filter((m) =>
      CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())
    );

    const totalMatriculas = active.length;
    const receitaTotal = active.reduce((s, m) => s + (m.valor_total ?? 0), 0);

    // Exclude ProUni 100% (valor_total = 0) for ticket médio
    const paidActive = active.filter((m) => (m.valor_total ?? 0) > 0);
    const ticketMedio = paidActive.length > 0 ? receitaTotal / paidActive.length : 0;

    return {
      totalMatriculas,
      receitaTotal,
      ticketMedio,
      cancelamentos: cancelled.length,
    };
  }, [filtered]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Matrículas por mês
  const matriculasPorMes = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matriculas) {
      const key = toMonthKey(m.data_venda);
      if (!key) continue;
      if (CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month: monthLabel(month), total }));
  }, [matriculas]);

  // Por Modalidade (pie)
  const porModalidade = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      if (CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())) continue;
      const key = m.modalidade ?? "Não informado";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Ranking vendedores (top 15, excluindo SECRETARIA e ALUNO)
  const rankingVendedores = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      if (CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())) continue;
      const v = (m.vendedor ?? "Não informado").trim().toUpperCase();
      if (EXCLUDED_SELLERS.includes(v)) continue;
      const original = (m.vendedor ?? "Não informado").trim();
      map.set(original, (map.get(original) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([vendedor, total]) => ({ vendedor, total }));
  }, [filtered]);

  // Top 10 cursos
  const topCursos = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      if (CANCELLED_TYPES.includes((m.forma_ingresso ?? "").toUpperCase())) continue;
      const key = (m.curso ?? "Não informado").trim() || "Não informado";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([curso, total]) => ({ curso, total }));
  }, [filtered]);

  // Forma de ingresso (top 8 + Outros)
  const formaIngresso = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      const key = (m.forma_ingresso ?? "Não informado").trim() || "Não informado";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const sorted = Array.from(map.entries()).sort(([, a], [, b]) => b - a);
    const top8 = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
    const result = top8.map(([name, value]) => ({ name, value }));
    if (rest > 0) result.push({ name: "Outros", value: rest });
    return result;
  }, [filtered]);

  // ── Last sync ────────────────────────────────────────────────────────────────

  const lastSync = syncRuns.find((r) => r.status === "success");

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Facunicamps</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lastSync
              ? `Última sincronização: ${format(parseISO(lastSync.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
              : "Nenhuma sincronização realizada"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar agora
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Matrículas</p>
                <p className="text-3xl font-bold mt-1">{kpis.totalMatriculas.toLocaleString("pt-BR")}</p>
              </div>
              <GraduationCap className="h-5 w-5 text-blue-500 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold mt-1">{fmtBRL(kpis.receitaTotal)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-green-500 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold mt-1">{fmtBRLFull(kpis.ticketMedio)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-purple-500 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cancelamentos</p>
                <p className="text-3xl font-bold mt-1">{kpis.cancelamentos.toLocaleString("pt-BR")}</p>
              </div>
              <XCircle className="h-5 w-5 text-red-500 mt-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 1: Matrículas por Mês + Por Modalidade ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matrículas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={matriculasPorMes} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString("pt-BR"), "Matrículas"]}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={porModalidade}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {porModalidade.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={MODALIDADE_COLORS[entry.name] ?? PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Matrículas"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Ranking Vendedores ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Vendedores (Top 15)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={rankingVendedores}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="vendedor"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Matrículas"]} />
              <Bar dataKey="total" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Row 3: Top 10 Cursos + Forma de Ingresso ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Cursos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={topCursos}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="curso"
                  width={130}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Matrículas"]} />
                <Bar dataKey="total" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forma de Ingresso</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={formaIngresso}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {formaIngresso.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Matrículas"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Sync History ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Sincronização</CardTitle>
        </CardHeader>
        <CardContent>
          {syncRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sincronização realizada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Linhas importadas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">
                      {format(parseISO(run.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.rows_imported != null ? run.rows_imported.toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "success"
                            ? "default"
                            : run.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {run.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

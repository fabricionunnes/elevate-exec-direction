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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  SlidersHorizontal,
  Settings,
  TrendingUp,
  TrendingDown,
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
  LineChart,
  Line,
  ReferenceLine,
  Cell,
  LabelList,
  Legend,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getYear, getMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
}

interface MetaRow {
  id: string;
  mes: string; // ISO date "YYYY-MM-DD"
  meta: number;
  super: number;
  hiper: number;
  atendimentos: number;
  meta_faturamento: number;
}

type ActiveView = "mes-atual" | "historico" | "comparar";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANCELLED_TYPES = ["CANCELADO", "TRANSFERIDO"];
const EXCLUDED_SELLERS = ["SECRETARIA", "ALUNO"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toMonthKey(date: string | null): string | null {
  if (!date) return null;
  return date.slice(0, 7);
}

function monthLabel(isoMonthKey: string) {
  try {
    return format(parseISO(isoMonthKey + "-01"), "MMM/yy", { locale: ptBR });
  } catch {
    return isoMonthKey;
  }
}

function truncateName(name: string, max = 12) {
  return name.length > max ? name.slice(0, max) + "..." : name;
}

function countWorkdaysRemaining(referenceDate: Date): number {
  const end = endOfMonth(referenceDate);
  const start = referenceDate > end ? end : referenceDate;
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

function countTotalWorkdaysInMonth(monthFirstDay: Date): number {
  const start = startOfMonth(monthFirstDay);
  const end = endOfMonth(monthFirstDay);
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

function countElapsedWorkdaysInMonth(monthFirstDay: Date, today: Date): number {
  const start = startOfMonth(monthFirstDay);
  const end = today < endOfMonth(monthFirstDay) ? today : endOfMonth(monthFirstDay);
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

function isCancelled(row: Matricula) {
  return CANCELLED_TYPES.includes((row.forma_ingresso ?? "").toUpperCase());
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? fmtBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  accentColor = "#16a34a",
}: {
  title: string;
  value: string;
  sub?: string;
  accentColor?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
      <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>}
      <div className="mt-3 h-1 rounded-full" style={{ background: accentColor }}></div>
    </div>
  );
}

// ─── Metas Config Modal ───────────────────────────────────────────────────────

function MetasConfigModal({
  open,
  onClose,
  metas,
  availableMonths,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  metas: MetaRow[];
  availableMonths: string[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<string, { meta: string; super: string; hiper: string; atendimentos: string; meta_faturamento: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: typeof rows = {};
    for (const m of availableMonths) {
      const existing = metas.find((r) => r.mes.slice(0, 7) === m);
      init[m] = {
        meta: existing ? String(existing.meta) : "",
        super: existing ? String(existing.super) : "",
        hiper: existing ? String(existing.hiper) : "",
        atendimentos: existing ? String(existing.atendimentos) : "",
        meta_faturamento: existing ? String(existing.meta_faturamento ?? 0) : "",
      };
    }
    setRows(init);
  }, [metas, availableMonths, open]);

  const update = (month: string, field: string, val: string) => {
    setRows((prev) => ({ ...prev, [month]: { ...prev[month], [field]: val } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = Object.entries(rows)
        .filter(([, v]) => v.meta !== "" || v.super !== "" || v.hiper !== "" || v.atendimentos !== "" || v.meta_faturamento !== "")
        .map(([month, v]) => ({
          mes: month + "-01",
          meta: parseInt(v.meta || "0") || 0,
          super: parseInt(v.super || "0") || 0,
          hiper: parseInt(v.hiper || "0") || 0,
          atendimentos: parseInt(v.atendimentos || "0") || 0,
          meta_faturamento: parseFloat(v.meta_faturamento || "0") || 0,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length === 0) {
        toast.info("Nenhuma meta para salvar");
        onClose();
        return;
      }

      const { error } = await supabase
        .from("facunicamps_metas")
        .upsert(upserts, { onConflict: "mes" });

      if (error) throw error;
      toast.success("Metas salvas com sucesso");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error("Erro ao salvar metas: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const sortedMonths = [...availableMonths].sort();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Configurar Metas por Mês</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Meta (qtde)</TableHead>
                <TableHead>Super</TableHead>
                <TableHead>Hiper</TableHead>
                <TableHead>Atendimentos</TableHead>
                <TableHead>Meta Fat. (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMonths.map((month) => (
                <TableRow key={month}>
                  <TableCell className="font-medium">{monthLabel(month)}</TableCell>
                  {(["meta", "super", "hiper", "atendimentos", "meta_faturamento"] as const).map((field) => (
                    <TableCell key={field}>
                      <Input
                        type="number"
                        className="w-24"
                        value={rows[month]?.[field] ?? ""}
                        onChange={(e) => update(month, field, e.target.value)}
                        placeholder="0"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Metas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ranking Chart ────────────────────────────────────────────────────────────

function RankingBarChart({
  title,
  data,
  nameKey,
  valueKey,
  color = "#16a34a",
}: {
  title: string;
  data: { name: string; value: number }[];
  nameKey?: string;
  valueKey?: string;
  color?: string;
}) {
  void nameKey;
  void valueKey;
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 10);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Sem dados</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = sorted.map((d) => ({ ...d, name: truncateName(d.name) }));
  const chartHeight = Math.max(200, chartData.length * 32);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
              <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar for Metas ───────────────────────────────────────────────────

function MetaProgressBar({
  label,
  current,
  target,
  color,
  dashed = false,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  dashed?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {current} / {target} <span style={{ color }} className="ml-1">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, opacity: dashed ? 0.6 : 1 }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FacunicampsIndicadoresPanel() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("mes-atual");
  const [showFilters, setShowFilters] = useState(false);
  const [showMetasConfig, setShowMetasConfig] = useState(false);

  // Selected month override (null = use latest from data)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Filters
  const [filterModalidade, setFilterModalidade] = useState("");
  const [filterVendedorAtivo, setFilterVendedorAtivo] = useState("");
  const [filterFormaIngresso, setFilterFormaIngresso] = useState("");
  const [filterVendedorDesligado, setFilterVendedorDesligado] = useState("");

  // Compare view
  const [comparePeriod1, setComparePeriod1] = useState("");
  const [comparePeriod2, setComparePeriod2] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: mats, error: matErr }, { data: metasData, error: metasErr }] =
        await Promise.all([
          supabase.from("facunicamps_matriculas").select("*").order("data_venda", { ascending: true }),
          supabase.from("facunicamps_metas").select("*").order("mes", { ascending: true }),
        ]);
      if (matErr) throw matErr;
      if (metasErr) throw metasErr;
      setMatriculas((mats as Matricula[]) ?? []);
      setMetas((metasData as MetaRow[]) ?? []);
    } catch (err: unknown) {
      toast.error("Erro ao carregar dados: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Sync ──────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("facunicamps-sync", { body: {} });
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

  // ── Derived lists for filters ──────────────────────────────────────────────

  const uniqueModalidades = useMemo(
    () => [...new Set(matriculas.map((m) => m.modalidade).filter(Boolean) as string[])].sort(),
    [matriculas]
  );
  const uniqueVendedores = useMemo(
    () => [...new Set(matriculas.map((m) => m.vendedor).filter(Boolean) as string[])].sort(),
    [matriculas]
  );
  const uniqueFormasIngresso = useMemo(
    () =>
      [
        ...new Set(
          matriculas
            .map((m) => m.forma_ingresso)
            .filter(Boolean)
            .filter((f) => !CANCELLED_TYPES.includes((f as string).toUpperCase())) as string[]
        ),
      ].sort(),
    [matriculas]
  );

  // ── Available months for metas config ──────────────────────────────────────

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const m of matriculas) {
      const k = toMonthKey(m.data_venda);
      if (k) set.add(k);
    }
    const now = format(new Date(), "yyyy-MM");
    set.add(now);
    return [...set].sort();
  }, [matriculas]);

  // ── Derive effective current month key (latest month with data or override) ──

  const currentMonthKey = useMemo(() => {
    if (selectedMonthKey) return selectedMonthKey;
    if (matriculas.length === 0) return format(new Date(), "yyyy-MM");
    const keys = matriculas
      .map((m) => toMonthKey(m.data_venda))
      .filter(Boolean) as string[];
    return keys.sort().reverse()[0] ?? format(new Date(), "yyyy-MM");
  }, [selectedMonthKey, matriculas]);

  // Months available in data for the month selector
  const dataMonthKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of matriculas) {
      const k = toMonthKey(m.data_venda);
      if (k) set.add(k);
    }
    return [...set].sort().reverse();
  }, [matriculas]);

  // ── Apply filters ──────────────────────────────────────────────────────────

  const filteredAll = useMemo(() => {
    let rows = matriculas;
    if (filterModalidade) rows = rows.filter((m) => m.modalidade === filterModalidade);
    if (filterVendedorAtivo) rows = rows.filter((m) => m.vendedor === filterVendedorAtivo);
    if (filterFormaIngresso) rows = rows.filter((m) => m.forma_ingresso === filterFormaIngresso);
    if (filterVendedorDesligado) rows = rows.filter((m) => m.vendedor !== filterVendedorDesligado);
    return rows;
  }, [matriculas, filterModalidade, filterVendedorAtivo, filterFormaIngresso, filterVendedorDesligado]);

  // Active sales only (no CANCELADO/TRANSFERIDO)
  const activeSales = useMemo(() => filteredAll.filter((m) => !isCancelled(m)), [filteredAll]);

  // ── Current month data ────────────────────────────────────────────────────

  const currentMonthSales = useMemo(
    () => activeSales.filter((m) => toMonthKey(m.data_venda) === currentMonthKey),
    [activeSales, currentMonthKey]
  );

  const currentMeta = useMemo(
    () => metas.find((m) => m.mes.slice(0, 7) === currentMonthKey),
    [metas, currentMonthKey]
  );

  // Use a reference date for the selected month (first day of that month)
  const referenceDate = useMemo(() => {
    try {
      return parseISO(currentMonthKey + "-01");
    } catch {
      return new Date();
    }
  }, [currentMonthKey]);

  // ── Current month KPIs ────────────────────────────────────────────────────

  const cmKpis = useMemo(() => {
    const count = currentMonthSales.length;
    const valorMatricula = currentMonthSales.reduce((s, m) => s + (m.valor_matricula ?? 0), 0);
    const valorTotal = currentMonthSales.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const paidMat = currentMonthSales.filter((m) => (m.valor_matricula ?? 0) > 0);
    const paidTotal = currentMonthSales.filter((m) => (m.valor_total ?? 0) > 0);
    const ticketMat = paidMat.length > 0 ? valorMatricula / paidMat.length : 0;
    const ticketTotal = paidTotal.length > 0 ? valorTotal / paidTotal.length : 0;
    const metaCount = currentMeta?.meta ?? 0;
    const remaining = metaCount > 0 ? Math.max(0, metaCount - count) : 0;
    const workdays = countWorkdaysRemaining(referenceDate);
    const diaria = workdays > 0 && remaining > 0 ? Math.ceil(remaining / workdays) : 0;
    return { count, valorMatricula, valorTotal, ticketMat, ticketTotal, metaCount, remaining, diaria };
  }, [currentMonthSales, currentMeta, referenceDate]);

  // ── Daily targets & averages ──────────────────────────────────────────────

  const dailyMetrics = useMemo(() => {
    const totalWorkdays = countTotalWorkdaysInMonth(referenceDate);
    const elapsedWorkdays = countElapsedWorkdaysInMonth(referenceDate, new Date());

    const metaDiariaVendas = currentMeta?.meta && totalWorkdays > 0
      ? currentMeta.meta / totalWorkdays
      : null;
    const metaDiariaFaturamento = currentMeta?.meta_faturamento && totalWorkdays > 0
      ? currentMeta.meta_faturamento / totalWorkdays
      : null;

    const mediaVendasDiarias = elapsedWorkdays > 0
      ? cmKpis.count / elapsedWorkdays
      : 0;
    const mediaFaturamentoDiario = elapsedWorkdays > 0
      ? cmKpis.valorTotal / elapsedWorkdays
      : 0;

    return { metaDiariaVendas, metaDiariaFaturamento, mediaVendasDiarias, mediaFaturamentoDiario, totalWorkdays, elapsedWorkdays };
  }, [currentMeta, referenceDate, cmKpis]);

  // ── Sales per day chart ───────────────────────────────────────────────────

  const salesPerDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of currentMonthSales) {
      if (!m.data_venda) continue;
      map.set(m.data_venda, (map.get(m.data_venda) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: format(parseISO(date), "dd/MM", { locale: ptBR }),
        count,
      }));
  }, [currentMonthSales]);

  // ── Vendedores ranking ────────────────────────────────────────────────────

  const buildVendedoresRanking = (rows: Matricula[]) => {
    const map = new Map<string, number>();
    for (const m of rows) {
      const v = (m.vendedor ?? "").toUpperCase();
      if (EXCLUDED_SELLERS.some((ex) => v.includes(ex))) continue;
      map.set(m.vendedor ?? "?", (map.get(m.vendedor ?? "?") ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const cmVendedoresRanking = useMemo(() => buildVendedoresRanking(currentMonthSales), [currentMonthSales]);

  // ── Cursos ranking ────────────────────────────────────────────────────────

  const buildCursosRanking = (rows: Matricula[]) => {
    const map = new Map<string, number>();
    for (const m of rows) {
      const c = m.curso ?? "?";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const cmCursosRanking = useMemo(() => buildCursosRanking(currentMonthSales), [currentMonthSales]);

  // ── Historical monthly aggregation ────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; valorTotal: number; valorMatricula: number }>();
    for (const m of activeSales) {
      const k = toMonthKey(m.data_venda);
      if (!k) continue;
      const cur = map.get(k) ?? { count: 0, valorTotal: 0, valorMatricula: 0 };
      cur.count++;
      cur.valorTotal += m.valor_total ?? 0;
      cur.valorMatricula += m.valor_matricula ?? 0;
      map.set(k, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        label: monthLabel(month),
        ...v,
      }));
  }, [activeSales]);

  // Historical KPIs
  const histKpis = useMemo(() => {
    const count = activeSales.length;
    const valorMatricula = activeSales.reduce((s, m) => s + (m.valor_matricula ?? 0), 0);
    const valorTotal = activeSales.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const totalMeta = metas.reduce((s, m) => s + m.meta, 0);
    return { count, valorMatricula, valorTotal, totalMeta };
  }, [activeSales, metas]);

  // Historical vendedores ranking
  const histVendedoresRanking = useMemo(() => buildVendedoresRanking(activeSales), [activeSales]);
  const histCursosRanking = useMemo(() => buildCursosRanking(activeSales), [activeSales]);

  // Vendas vs Meta historical chart
  const vendasVsMetaData = useMemo(() => {
    return monthlyData.map((md) => {
      const metaRow = metas.find((m) => m.mes.slice(0, 7) === md.month);
      return {
        label: md.label,
        vendas: md.count,
        meta: metaRow?.meta || null,
        super: metaRow?.super || null,
        hiper: metaRow?.hiper || null,
      };
    });
  }, [monthlyData, metas]);

  // Monthly data with % change for bar labels
  const monthlyDataWithPct = useMemo(() => {
    return monthlyData.map((md, idx) => {
      const prev = idx > 0 ? monthlyData[idx - 1].valorTotal : null;
      const pct = prev && prev > 0 ? ((md.valorTotal - prev) / prev) * 100 : null;
      return { ...md, pct };
    });
  }, [monthlyData]);

  // Funnel
  const totalAtendimentos = useMemo(() => metas.reduce((s, m) => s + m.atendimentos, 0), [metas]);
  const totalVendas = activeSales.length;
  const conversionRate = totalAtendimentos > 0 ? ((totalVendas / totalAtendimentos) * 100).toFixed(1) : null;

  // ── Curto / Médio / Longo prazo ───────────────────────────────────────────

  const prazoStats = useMemo(() => {
    const sortedMonths = [...new Set(activeSales.map(m => toMonthKey(m.data_venda)).filter(Boolean) as string[])].sort().reverse();
    const latestMonth = sortedMonths[0];
    if (!latestMonth) return null;

    const getStats = (monthKeys: string[], label: string) => {
      const rows = activeSales.filter(m => {
        const k = toMonthKey(m.data_venda);
        return k && monthKeys.includes(k);
      });
      const count = rows.length;
      const valorTotal = rows.reduce((s, m) => s + (m.valor_total ?? 0), 0);
      const paid = rows.filter(m => (m.valor_total ?? 0) > 0);
      const ticketMedio = paid.length > 0 ? valorTotal / paid.length : 0;
      // avg per month
      const avgVendasMes = monthKeys.length > 0 ? count / monthKeys.length : 0;
      const avgFatMes = monthKeys.length > 0 ? valorTotal / monthKeys.length : 0;
      return { label, count, valorTotal, ticketMedio, avgVendasMes, avgFatMes, months: monthKeys.length };
    };

    const curto = [latestMonth]; // último mês
    const medio = sortedMonths.slice(0, 3); // últimos 3 meses
    const longo = sortedMonths.slice(0, 12); // últimos 12 meses

    return {
      curto: getStats(curto, "Curto Prazo (1 mês)"),
      medio: getStats(medio, "Médio Prazo (3 meses)"),
      longo: getStats(longo, "Longo Prazo (12 meses)"),
    };
  }, [activeSales]);

  // ── Compare periods ────────────────────────────────────────────────────────

  const availableMonthsList = useMemo(
    () => [...new Set(activeSales.map((m) => toMonthKey(m.data_venda)).filter(Boolean) as string[])].sort(),
    [activeSales]
  );

  const getPeriodStats = (monthKey: string) => {
    const rows = activeSales.filter((m) => toMonthKey(m.data_venda) === monthKey);
    const count = rows.length;
    const valorTotal = rows.reduce((s, m) => s + (m.valor_total ?? 0), 0);
    const paid = rows.filter((m) => (m.valor_total ?? 0) > 0);
    const ticketMedio = paid.length > 0 ? valorTotal / paid.length : 0;
    const cursosMap = new Map<string, number>();
    const vendsMap = new Map<string, number>();
    for (const m of rows) {
      cursosMap.set(m.curso ?? "?", (cursosMap.get(m.curso ?? "?") ?? 0) + 1);
      const v = m.vendedor ?? "?";
      if (!EXCLUDED_SELLERS.some((ex) => v.toUpperCase().includes(ex))) {
        vendsMap.set(v, (vendsMap.get(v) ?? 0) + 1);
      }
    }
    const topCursos = [...cursosMap.entries()].sort(([, a], [, b]) => b - a).slice(0, 3);
    const topVendedores = [...vendsMap.entries()].sort(([, a], [, b]) => b - a).slice(0, 3);
    return { count, valorTotal, ticketMedio, topCursos, topVendedores };
  };

  const period1Stats = comparePeriod1 ? getPeriodStats(comparePeriod1) : null;
  const period2Stats = comparePeriod2 ? getPeriodStats(comparePeriod2) : null;

  // ── Current month table data ───────────────────────────────────────────────

  const tableData = useMemo(() => {
    return filteredAll
      .filter((m) => toMonthKey(m.data_venda) === currentMonthKey)
      .sort((a, b) => (b.data_venda ?? "").localeCompare(a.data_venda ?? ""))
      .slice(0, 50);
  }, [filteredAll, currentMonthKey]);

  // ── Render loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Derive KPI accent color based on meta progress ─────────────────────────

  const metaAccentColor = currentMeta
    ? cmKpis.count >= currentMeta.meta
      ? "#16a34a"
      : "#dc2626"
    : "#94a3b8";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 flex items-center justify-between gap-4" style={{ background: "#0D2B5E" }}>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-wider">FACUNICAMPS</span>
          {/* Month selector — shown only in mes-atual view */}
          {activeView === "mes-atual" && dataMonthKeys.length > 0 && (
            <Select
              value={currentMonthKey}
              onValueChange={(v) => setSelectedMonthKey(v)}
            >
              <SelectTrigger className="h-7 text-xs w-[110px] bg-white/10 border-white/20 text-white hover:bg-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dataMonthKeys.map((mk) => (
                  <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/10 rounded-full p-1">
          {(["mes-atual", "historico", "comparar"] as ActiveView[]).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                activeView === v ? "bg-white text-[#0D2B5E]" : "text-white/70 hover:text-white"
              }`}
            >
              {v === "mes-atual" ? "Mês Atual" : v === "historico" ? "Histórico" : "Comparar Períodos"}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`p-2 rounded-lg transition-colors ${showFilters ? "bg-white text-[#0D2B5E]" : "text-white/70 hover:text-white hover:bg-white/10"}`}
            title="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Sincronizar"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowMetasConfig(true)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Configurar Metas"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Modalidade</p>
              <Select value={filterModalidade || "all"} onValueChange={(v) => setFilterModalidade(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueModalidades.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Vendedor Ativo</p>
              <Select value={filterVendedorAtivo || "all"} onValueChange={(v) => setFilterVendedorAtivo(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueVendedores.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Forma de Ingresso</p>
              <Select value={filterFormaIngresso || "all"} onValueChange={(v) => setFilterFormaIngresso(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueFormasIngresso.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Excluir Vendedor</p>
              <Select value={filterVendedorDesligado || "all"} onValueChange={(v) => setFilterVendedorDesligado(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Nenhum</SelectItem>
                  {uniqueVendedores.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" variant="outline" onClick={() => setShowFilters(false)}>
              Aplicar / Fechar
            </Button>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {(filterModalidade || filterVendedorAtivo || filterFormaIngresso || filterVendedorDesligado) && (
        <div className="flex flex-wrap gap-2">
          {filterModalidade && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterModalidade("")}>
              Modalidade: {filterModalidade} ×
            </Badge>
          )}
          {filterVendedorAtivo && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterVendedorAtivo("")}>
              Vendedor: {filterVendedorAtivo} ×
            </Badge>
          )}
          {filterFormaIngresso && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterFormaIngresso("")}>
              Forma: {filterFormaIngresso} ×
            </Badge>
          )}
          {filterVendedorDesligado && (
            <Badge variant="destructive" className="cursor-pointer" onClick={() => setFilterVendedorDesligado("")}>
              Excluindo: {filterVendedorDesligado} ×
            </Badge>
          )}
        </div>
      )}

      {/* ── MÊS ATUAL VIEW ────────────────────────────────────────────────────── */}
      {activeView === "mes-atual" && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Valor Matrícula"
              value={fmtBRL(cmKpis.valorMatricula)}
              sub={`Ticket Médio: ${fmtBRL(cmKpis.ticketMat)}`}
              accentColor="#3b82f6"
            />
            <KpiCard
              title="Qtde. Vendas"
              value={String(cmKpis.count)}
              sub={currentMeta ? `Restante: ${cmKpis.remaining}` : "Restante: --"}
              accentColor={metaAccentColor}
            />
            <KpiCard
              title="Valor Total"
              value={fmtBRL(cmKpis.valorTotal)}
              sub={`Ticket Médio: ${fmtBRL(cmKpis.ticketTotal)}`}
              accentColor="#8b5cf6"
            />
            <KpiCard
              title="Meta Qtde. Vendas"
              value={currentMeta ? String(currentMeta.meta) : "--"}
              sub={currentMeta ? `Diária sugerida: ${cmKpis.diaria}` : "Diária: --"}
              accentColor={metaAccentColor}
            />
          </div>

          {/* Daily targets & averages */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Meta Diária — Vendas"
              value={dailyMetrics.metaDiariaVendas !== null ? dailyMetrics.metaDiariaVendas.toFixed(1) : "--"}
              sub={`${dailyMetrics.totalWorkdays} dias úteis no mês`}
              accentColor="#f97316"
            />
            <KpiCard
              title="Meta Diária — Faturamento"
              value={dailyMetrics.metaDiariaFaturamento !== null ? fmtBRL(dailyMetrics.metaDiariaFaturamento) : "--"}
              sub="Baseado na meta de faturamento"
              accentColor="#f97316"
            />
            <KpiCard
              title="Média Vendas Diárias (real)"
              value={dailyMetrics.mediaVendasDiarias.toFixed(1)}
              sub={`Últimos ${dailyMetrics.elapsedWorkdays} dias úteis`}
              accentColor={dailyMetrics.metaDiariaVendas !== null && dailyMetrics.mediaVendasDiarias >= dailyMetrics.metaDiariaVendas ? "#16a34a" : "#94a3b8"}
            />
            <KpiCard
              title="Média Faturamento Diário (real)"
              value={fmtBRL(dailyMetrics.mediaFaturamentoDiario)}
              sub={`Últimos ${dailyMetrics.elapsedWorkdays} dias úteis`}
              accentColor={dailyMetrics.metaDiariaFaturamento !== null && dailyMetrics.mediaFaturamentoDiario >= dailyMetrics.metaDiariaFaturamento ? "#16a34a" : "#94a3b8"}
            />
          </div>

          {/* Sales per day line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Vendas no período</CardTitle>
            </CardHeader>
            <CardContent>
              {salesPerDay.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem vendas no período selecionado</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={salesPerDay} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#16a34a" }}
                      name="Vendas"
                    >
                      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Vendas vs Metas — progress bars */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Vendas VS Metas</CardTitle>
            </CardHeader>
            <CardContent>
              {!currentMeta ? (
                <p className="text-muted-foreground text-sm">Configure as metas para visualizar</p>
              ) : (
                <div className="space-y-4">
                  <MetaProgressBar
                    label={`Meta (${currentMeta.meta})`}
                    current={cmKpis.count}
                    target={currentMeta.meta}
                    color="#16a34a"
                  />
                  {currentMeta.super > 0 && (
                    <MetaProgressBar
                      label={`Super (${currentMeta.super})`}
                      current={cmKpis.count}
                      target={currentMeta.super}
                      color="#f97316"
                      dashed
                    />
                  )}
                  {currentMeta.hiper > 0 && (
                    <MetaProgressBar
                      label={`Hiper (${currentMeta.hiper})`}
                      current={cmKpis.count}
                      target={currentMeta.hiper}
                      color="#9333ea"
                      dashed
                    />
                  )}
                  <div className="pt-2 border-t border-border">
                    <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
                        Qtde. atual: <span className="font-semibold text-foreground">{cmKpis.count}</span>
                      </span>
                      {cmKpis.diaria > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          Necessário/dia: <span className="font-semibold text-foreground">{cmKpis.diaria}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RankingBarChart title="Ranking Vendedores — Top 10 (mês)" data={cmVendedoresRanking} />
            <RankingBarChart title="Ranking Cursos — Top 10 (mês)" data={cmCursosRanking} />
          </div>

          {/* Data table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Matrículas no mês (últimas 50)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {tableData.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Sem registros no período selecionado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Vendedor(a)</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Modalidade</TableHead>
                      <TableHead className="text-xs">Curso</TableHead>
                      <TableHead className="text-xs">Forma</TableHead>
                      <TableHead className="text-xs text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, i) => (
                      <TableRow key={row.id ?? i} className={isCancelled(row) ? "opacity-50" : ""}>
                        <TableCell className="text-xs">
                          {row.data_venda ? format(parseISO(row.data_venda), "dd/MM/yyyy") : "--"}
                        </TableCell>
                        <TableCell className="text-xs">{row.vendedor ?? "--"}</TableCell>
                        <TableCell className="text-xs">{row.cliente ?? "--"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs">{row.modalidade ?? "--"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{row.curso ?? "--"}</TableCell>
                        <TableCell className="text-xs">
                          {isCancelled(row) ? (
                            <Badge variant="destructive" className="text-xs">{row.forma_ingresso}</Badge>
                          ) : (
                            row.forma_ingresso ?? "--"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">{fmtBRL(row.valor_total ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── HISTÓRICO VIEW ─────────────────────────────────────────────────────── */}
      {activeView === "historico" && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Valor Matrícula Total" value={fmtBRL(histKpis.valorMatricula)} accentColor="#3b82f6" />
            <KpiCard title="Qtde. Vendas Total" value={String(histKpis.count)} accentColor="#16a34a" />
            <KpiCard title="Valor Total Histórico" value={fmtBRL(histKpis.valorTotal)} accentColor="#8b5cf6" />
            <KpiCard title="Meta Total Configurada" value={histKpis.totalMeta > 0 ? String(histKpis.totalMeta) : "--"} accentColor="#f97316" />
          </div>

          {/* Valor Total Mensal BarChart with % change labels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Valor Total no período (mensal)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyDataWithPct.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyDataWithPct} margin={{ left: 8, right: 16, top: 32, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtBRL(v)} width={90} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const cur = payload[0].value as number;
                        const item = monthlyDataWithPct.find((d) => d.label === label);
                        const pct = item?.pct ?? null;
                        return (
                          <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-lg text-sm">
                            <p className="font-medium mb-1">{label}</p>
                            <p>{fmtBRL(cur)}</p>
                            {pct !== null && (
                              <p className={pct >= 0 ? "text-green-600" : "text-red-500"}>
                                {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="valorTotal" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Valor Total">
                      <LabelList
                        content={(props) => {
                          const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                          const item = monthlyDataWithPct[index];
                          if (!item) return null;
                          const pct = item.pct;
                          const pctLabel = pct !== null
                            ? (pct >= 0 ? `+${pct.toFixed(0)}% ▲` : `${pct.toFixed(0)}% ▼`)
                            : null;
                          const pctColor = pct !== null ? (pct >= 0 ? "#16a34a" : "#dc2626") : "hsl(var(--muted-foreground))";
                          return (
                            <g>
                              <text x={x + (width as number) / 2} y={(y as number) - 16} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))">
                                {fmtBRL(value)}
                              </text>
                              {pctLabel && (
                                <text x={x + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fontSize={9} fill={pctColor} fontWeight={600}>
                                  {pctLabel}
                                </text>
                              )}
                            </g>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Vendas vs Meta LineChart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Vendas vs Meta (histórico)</CardTitle>
            </CardHeader>
            <CardContent>
              {vendasVsMetaData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem dados</p>
              ) : (
                <>
                  <div className="flex gap-4 text-xs mb-3 flex-wrap text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-green-600" /> Vendas</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-red-500" /> Meta</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-orange-500" /> Super</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-purple-600" /> Hiper</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={vendasVsMetaData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="vendas" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Vendas">
                        <LabelList dataKey="vendas" position="top" style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
                      </Line>
                      <Line type="monotone" dataKey="meta" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name="Meta" connectNulls />
                      <Line type="monotone" dataKey="super" stroke="#f97316" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name="Super" connectNulls />
                      <Line type="monotone" dataKey="hiper" stroke="#9333ea" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name="Hiper" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>

          {/* Visão de Curto, Médio e Longo Prazo */}
          {prazoStats && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Visão de Curto, Médio e Longo Prazo</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([prazoStats.curto, prazoStats.medio, prazoStats.longo] as const).map((p) => (
                  <div key={p.label} className="rounded-xl border border-border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{p.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Vendas</p>
                        <p className="text-2xl font-bold text-foreground">{p.count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Total</p>
                        <p className="text-lg font-bold text-foreground">{fmtBRL(p.valorTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ticket Médio</p>
                        <p className="text-base font-semibold text-foreground">{fmtBRL(p.ticketMedio)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Média/mês</p>
                        <p className="text-base font-semibold text-foreground">{p.avgVendasMes.toFixed(0)} vendas</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Fat. médio/mês</p>
                        <p className="text-base font-semibold text-foreground">{fmtBRL(p.avgFatMes)}</p>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-gradient-to-r from-primary/60 to-primary/20" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RankingBarChart title="Ranking Vendedores — Top 10" data={histVendedoresRanking} />
            <RankingBarChart title="Ranking Cursos — Top 10" data={histCursosRanking} />
          </div>

          {/* Funil de Vendas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              {totalAtendimentos === 0 ? (
                <p className="text-muted-foreground text-sm">Configure Atendimentos nas Metas para visualizar o funil</p>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Atendimentos</span>
                      <span className="font-semibold text-foreground">{totalAtendimentos}</span>
                    </div>
                    <div className="h-8 bg-blue-500 rounded-md flex items-center px-3">
                      <span className="text-white text-xs font-medium">100%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Vendas</span>
                      <span className="font-semibold text-foreground">{totalVendas}</span>
                    </div>
                    <div
                      className="h-8 bg-green-600 rounded-md flex items-center px-3"
                      style={{ width: `${Math.min(100, (totalVendas / totalAtendimentos) * 100)}%` }}
                    >
                      <span className="text-white text-xs font-medium">{conversionRate}%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projeção Vendedores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Projeção Vendedores Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Total de vendedores únicos: <span className="font-semibold text-foreground">{histVendedoresRanking.length}</span>
              </p>
              <ResponsiveContainer width="100%" height={Math.max(200, Math.min(15, histVendedoresRanking.length) * 32)}>
                <BarChart
                  data={[...histVendedoresRanking].sort((a, b) => b.value - a.value).slice(0, 15).map((d) => ({ ...d, name: truncateName(d.name) }))}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="#1e3a5f" radius={[0, 4, 4, 0]} name="Vendas">
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── COMPARAR PERÍODOS VIEW ─────────────────────────────────────────────── */}
      {activeView === "comparar" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Período 1</p>
              <Select value={comparePeriod1 || "none"} onValueChange={(v) => setComparePeriod1(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar mês</SelectItem>
                  {availableMonthsList.map((m) => (
                    <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Período 2</p>
              <Select value={comparePeriod2 || "none"} onValueChange={(v) => setComparePeriod2(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar mês</SelectItem>
                  {availableMonthsList.map((m) => (
                    <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {period1Stats && period2Stats ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Period 1 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-foreground">{monthLabel(comparePeriod1)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CompareMetric label="Qtde. Vendas" value={period1Stats.count} other={period2Stats.count} />
                  <CompareMetric label="Valor Total" value={period1Stats.valorTotal} other={period2Stats.valorTotal} isCurrency />
                  <CompareMetric label="Ticket Médio" value={period1Stats.ticketMedio} other={period2Stats.ticketMedio} isCurrency />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top 3 Cursos</p>
                    {period1Stats.topCursos.map(([name, cnt]) => (
                      <div key={name} className="flex justify-between text-xs py-0.5">
                        <span className="truncate max-w-[140px] text-foreground">{name}</span>
                        <Badge variant="secondary" className="text-xs">{cnt}</Badge>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top 3 Vendedores</p>
                    {period1Stats.topVendedores.map(([name, cnt]) => (
                      <div key={name} className="flex justify-between text-xs py-0.5">
                        <span className="truncate max-w-[140px] text-foreground">{name}</span>
                        <Badge variant="secondary" className="text-xs">{cnt}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Period 2 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-foreground">{monthLabel(comparePeriod2)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CompareMetric label="Qtde. Vendas" value={period2Stats.count} other={period1Stats.count} />
                  <CompareMetric label="Valor Total" value={period2Stats.valorTotal} other={period1Stats.valorTotal} isCurrency />
                  <CompareMetric label="Ticket Médio" value={period2Stats.ticketMedio} other={period1Stats.ticketMedio} isCurrency />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top 3 Cursos</p>
                    {period2Stats.topCursos.map(([name, cnt]) => (
                      <div key={name} className="flex justify-between text-xs py-0.5">
                        <span className="truncate max-w-[140px] text-foreground">{name}</span>
                        <Badge variant="secondary" className="text-xs">{cnt}</Badge>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Top 3 Vendedores</p>
                    {period2Stats.topVendedores.map(([name, cnt]) => (
                      <div key={name} className="flex justify-between text-xs py-0.5">
                        <span className="truncate max-w-[140px] text-foreground">{name}</span>
                        <Badge variant="secondary" className="text-xs">{cnt}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Selecione dois períodos para comparar</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Metas Config Modal */}
      <MetasConfigModal
        open={showMetasConfig}
        onClose={() => setShowMetasConfig(false)}
        metas={metas}
        availableMonths={availableMonths}
        onSaved={fetchData}
      />
    </div>
  );
}

// ─── Compare Metric Helper ────────────────────────────────────────────────────

function CompareMetric({
  label,
  value,
  other,
  isCurrency = false,
}: {
  label: string;
  value: number;
  other: number;
  isCurrency?: boolean;
}) {
  const better = value > other;
  const equal = value === other;
  const diff = other > 0 ? ((value - other) / other) * 100 : 0;
  const display = isCurrency ? fmtBRL(value) : String(value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-foreground">{display}</span>
        {!equal && (
          <span className={`text-xs flex items-center ${better ? "text-green-600" : "text-red-500"}`}>
            {better ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(diff).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

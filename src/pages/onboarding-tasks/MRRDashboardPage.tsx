import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Loader2,
  Users,
  DollarSign,
  Activity,
  Minus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
  isBefore,
  isAfter,
  isSameMonth,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import { cn } from "@/lib/utils";

interface RecurringCharge {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  installments: number;
  recurrence: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: { id: string; name: string } | null;
}

const recurrenceToMonthlyFactor = (recurrence: string): number => {
  switch ((recurrence || "monthly").toLowerCase()) {
    case "yearly":
    case "annual":
      return 1 / 12;
    case "semiannual":
    case "semi_annual":
      return 1 / 6;
    case "quarterly":
      return 1 / 3;
    case "biweekly":
      return 2.1667;
    case "weekly":
      return 4.3333;
    case "daily":
      return 30;
    case "monthly":
    default:
      return 1;
  }
};

const monthlyCents = (c: RecurringCharge): number =>
  Math.round(c.amount_cents * recurrenceToMonthlyFactor(c.recurrence));

// Only contracts with installments >= 12 are considered true recurring MRR.
// Shorter parcelamentos (1, 3, 6) are treated as one-time / non-recurring sales.
const isMRREligible = (c: RecurringCharge): boolean => (c.installments || 0) >= 12;

const isActiveAt = (c: RecurringCharge, date: Date): boolean => {
  if (!isMRREligible(c)) return false;
  const created = new Date(c.created_at);
  if (isAfter(created, date)) return false;
  if (c.is_active) return true;
  // Was deactivated; consider it active until updated_at
  const updated = new Date(c.updated_at);
  return isAfter(updated, date);
};

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export default function MRRDashboardPage() {
  const navigate = useNavigate();
  const { loading: permLoading, isMaster } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    const fetchCharges = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("company_recurring_charges")
          .select(
            "id, company_id, description, amount_cents, installments, recurrence, is_active, created_at, updated_at, company:onboarding_companies(id, name)"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCharges((data || []) as unknown as RecurringCharge[]);
      } catch (err) {
        console.error("Error fetching recurring charges:", err);
      } finally {
        setLoading(false);
      }
    };
    if (isMaster) fetchCharges();
  }, [isMaster]);

  const periodStart = useMemo(() => startOfMonth(selectedMonth), [selectedMonth]);
  const periodEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);

  const computeMRRAt = (date: Date): number =>
    charges.filter((c) => isActiveAt(c, date)).reduce((sum, c) => sum + monthlyCents(c), 0);

  const mrrInitial = useMemo(() => computeMRRAt(periodStart), [charges, periodStart]);
  const mrrFinal = useMemo(() => computeMRRAt(periodEnd), [charges, periodEnd]);
  const mrrDelta = mrrFinal - mrrInitial;
  const mrrDeltaPct = mrrInitial > 0 ? (mrrDelta / mrrInitial) * 100 : 0;

  // Movements within selected month
  const newCharges = useMemo(
    () =>
      charges.filter((c) => {
        const d = new Date(c.created_at);
        return isWithinInterval(d, { start: periodStart, end: periodEnd });
      }),
    [charges, periodStart, periodEnd]
  );

  const churnedCharges = useMemo(
    () =>
      charges.filter((c) => {
        if (c.is_active) return false;
        const created = new Date(c.created_at);
        const updated = new Date(c.updated_at);
        // Was active before the period start, deactivated within period
        return (
          isBefore(created, periodStart) &&
          isWithinInterval(updated, { start: periodStart, end: periodEnd })
        );
      }),
    [charges, periodStart, periodEnd]
  );

  const newMRR = newCharges.reduce((s, c) => s + monthlyCents(c), 0);
  const churnMRR = churnedCharges.reduce((s, c) => s + monthlyCents(c), 0);

  // 12-month chart
  const chartData = useMemo(() => {
    const points = [];
    for (let i = 11; i >= 0; i--) {
      const d = endOfMonth(subMonths(selectedMonth, i));
      points.push({
        month: format(d, "MMM/yy", { locale: ptBR }),
        mrr: Math.round(computeMRRAt(d) / 100),
      });
    }
    return points;
  }, [charges, selectedMonth]);

  // Active customers + ranking
  const activeAtEnd = useMemo(
    () => charges.filter((c) => isActiveAt(c, periodEnd)),
    [charges, periodEnd]
  );

  const activeCustomers = useMemo(() => {
    const set = new Set(activeAtEnd.map((c) => c.company_id));
    return set.size;
  }, [activeAtEnd]);

  const ranking = useMemo(() => {
    const byCompany = new Map<string, { name: string; mrr: number }>();
    for (const c of activeAtEnd) {
      const id = c.company_id;
      const name = c.company?.name || "—";
      const cur = byCompany.get(id) || { name, mrr: 0 };
      cur.mrr += monthlyCents(c);
      byCompany.set(id, cur);
    }
    return Array.from(byCompany.values())
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [activeAtEnd]);

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <h1 className="text-2xl font-bold text-destructive">Acesso restrito</h1>
        <p className="text-muted-foreground">Esta página é exclusiva do master.</p>
        <Button onClick={() => navigate("/onboarding-tasks")}>Voltar</Button>
      </div>
    );
  }

  const arr = mrrFinal * 12;
  const ticketMedio = activeCustomers > 0 ? mrrFinal / activeCustomers : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">MRR — Receita Recorrente Mensal</h1>
            <p className="text-sm text-muted-foreground">
              Snapshot e decomposição de movimentos dos contratos recorrentes ativos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setSelectedMonth((m) => startOfMonth(subMonths(m, 1)))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <MonthYearPicker
            value={selectedMonth}
            onChange={({ start }) => setSelectedMonth(start)}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setSelectedMonth((m) => startOfMonth(addMonths(m, 1)))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isSameMonth(selectedMonth, new Date()) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-2 text-xs text-muted-foreground"
              onClick={() => setSelectedMonth(startOfMonth(new Date()))}
            >
              Atual
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Top cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  MRR Inicial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtBRL(mrrInitial)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(periodStart, "dd/MM/yyyy")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  MRR Final
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtBRL(mrrFinal)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(periodEnd, "dd/MM/yyyy")}
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border-2",
                mrrDelta > 0
                  ? "border-emerald-500/30"
                  : mrrDelta < 0
                  ? "border-red-500/30"
                  : ""
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Variação (Δ)
                  {mrrDelta > 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : mrrDelta < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    mrrDelta > 0 && "text-emerald-500",
                    mrrDelta < 0 && "text-red-500"
                  )}
                >
                  {mrrDelta >= 0 ? "+" : ""}
                  {fmtBRL(mrrDelta)}
                </div>
                <p
                  className={cn(
                    "text-xs mt-1",
                    mrrDelta > 0 && "text-emerald-500",
                    mrrDelta < 0 && "text-red-500"
                  )}
                >
                  {mrrDelta >= 0 ? "+" : ""}
                  {mrrDeltaPct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  ARR Projetado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmtBRL(arr)}</div>
                <p className="text-xs text-muted-foreground mt-1">MRR Final × 12</p>
              </CardContent>
            </Card>
          </div>

          {/* Movements + base */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> New MRR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-600">+{fmtBRL(newMRR)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newCharges.length} novo(s) contrato(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" /> Churn MRR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-600">-{fmtBRL(churnMRR)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {churnedCharges.length} cancelamento(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Clientes ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{activeCustomers}</div>
                <p className="text-xs text-muted-foreground mt-1">no fim do período</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Ticket médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{fmtBRL(ticketMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1">MRR / clientes</p>
              </CardContent>
            </Card>
          </div>

          {/* 12-month chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Evolução do MRR — últimos 12 meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis
                      className="text-xs"
                      tickFormatter={(v) =>
                        `R$ ${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <RTooltip
                      formatter={(v: number) =>
                        (v * 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Movements + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Movimentos do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newCharges.length === 0 && churnedCharges.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-6"
                        >
                          Nenhum movimento neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                    {newCharges.map((c) => (
                      <TableRow key={`new-${c.id}`}>
                        <TableCell className="font-medium">
                          {c.company?.name || "—"}
                          <p className="text-xs text-muted-foreground">{c.description}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Novo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">
                          +{fmtBRL(monthlyCents(c))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {churnedCharges.map((c) => (
                      <TableRow key={`churn-${c.id}`}>
                        <TableCell className="font-medium">
                          {c.company?.name || "—"}
                          <p className="text-xs text-muted-foreground">{c.description}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
                            Churn
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">
                          -{fmtBRL(monthlyCents(c))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 10 clientes por MRR</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-6"
                        >
                          Nenhum contrato ativo no período.
                        </TableCell>
                      </TableRow>
                    )}
                    {ranking.map((r, i) => (
                      <TableRow key={r.name + i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtBRL(r.mrr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

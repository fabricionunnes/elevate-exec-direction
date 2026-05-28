import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Search, AlertTriangle, CheckCircle2, Clock,
  XCircle, RefreshCw, ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
type MonthStatus = "paid" | "pending" | "overdue" | "missing";

interface CompanyRow {
  id: string;
  name: string;
  chargeCount: number;
  totalCents: number;
  status: MonthStatus;
  invoiceCount: number;
}

const STATUS_CONFIG: Record<MonthStatus, {
  label: string;
  rowBg: string;
  badgeBg: string;
  icon: React.ElementType;
  order: number;
}> = {
  missing: { label: "Sem parcela lançada", rowBg: "bg-destructive/5 hover:bg-destructive/8",  badgeBg: "bg-destructive/15 text-destructive border-destructive/30",       icon: XCircle,       order: 0 },
  overdue: { label: "Atrasado",            rowBg: "bg-orange-500/5 hover:bg-orange-500/8",   badgeBg: "bg-orange-500/15 text-orange-400 border-orange-500/30",           icon: AlertTriangle, order: 1 },
  pending: { label: "Pendente",            rowBg: "bg-yellow-500/5 hover:bg-yellow-500/8",   badgeBg: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",           icon: Clock,         order: 2 },
  paid:    { label: "Pago",               rowBg: "hover:bg-muted/20",                        badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",        icon: CheckCircle2,  order: 3 },
};

function statusPriority(a: MonthStatus, b: MonthStatus): MonthStatus {
  return STATUS_CONFIG[a].order <= STATUS_CONFIG[b].order ? a : b;
}

// ── Page ───────────────────────────────────────────────────────────────────────
const RecurringMonitorPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const selectedYM = format(selectedMonth, "yyyy-MM");
  const isCurrentMonth = selectedYM === format(new Date(), "yyyy-MM");

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!staff?.is_active || !["admin", "master"].includes(staff.role || "")) {
        toast.error("Acesso restrito a administradores.");
        navigate("/onboarding-tasks");
        return;
      }
      setUserRole(staff.role);
    })();
  }, [navigate]);

  // ── Load data for selected month ─────────────────────────────────────────────
  const loadData = async (month: Date) => {
    if (!userRole) return;
    setLoading(true);
    try {
      const rangeStart = format(startOfMonth(month), "yyyy-MM-dd");
      const rangeEnd   = format(endOfMonth(month), "yyyy-MM-dd");
      const ym = format(month, "yyyy-MM");

      // 1. All active recurring charges
      const { data: charges, error: chargesErr } = await supabase
        .from("company_recurring_charges")
        .select("id, company_id, description, amount_cents, recurrence")
        .eq("is_active", true);
      if (chargesErr) throw chargesErr;
      if (!charges?.length) { setRows([]); setLoading(false); return; }

      const companyIds = [...new Set(charges.map((c: any) => c.company_id as string))];

      // 2. Company names
      const { data: companies, error: companiesErr } = await supabase
        .from("onboarding_companies")
        .select("id, name")
        .in("id", companyIds)
        .order("name");
      if (companiesErr) throw companiesErr;

      // 3. Invoices for this month (non-cancelled)
      const { data: invoices, error: invErr } = await supabase
        .from("company_invoices")
        .select("id, company_id, due_date, status, amount_cents")
        .in("company_id", companyIds)
        .gte("due_date", rangeStart)
        .lte("due_date", rangeEnd)
        .neq("status", "cancelled");
      if (invErr) throw invErr;

      // 4. Build invoice map: companyId → best status
      const invoiceStatusMap = new Map<string, MonthStatus>();
      const invoiceCountMap = new Map<string, number>();
      for (const inv of (invoices || []) as any[]) {
        const cur: MonthStatus =
          inv.status === "paid" ? "paid" :
          inv.status === "overdue" ? "overdue" : "pending";
        const prev = invoiceStatusMap.get(inv.company_id);
        invoiceStatusMap.set(inv.company_id, prev ? statusPriority(prev, cur) : cur);
        invoiceCountMap.set(inv.company_id, (invoiceCountMap.get(inv.company_id) || 0) + 1);
      }

      // 5. Aggregate charges per company
      const chargesByCompany = new Map<string, { count: number; totalCents: number }>();
      for (const ch of charges as any[]) {
        const prev = chargesByCompany.get(ch.company_id) || { count: 0, totalCents: 0 };
        chargesByCompany.set(ch.company_id, {
          count: prev.count + 1,
          totalCents: prev.totalCents + (ch.amount_cents || 0),
        });
      }

      // 6. Build rows
      const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name as string]));
      const result: CompanyRow[] = companyIds
        .filter((id) => companyMap.has(id))
        .map((id) => ({
          id,
          name: companyMap.get(id)!,
          chargeCount: chargesByCompany.get(id)?.count || 0,
          totalCents: chargesByCompany.get(id)?.totalCents || 0,
          status: invoiceStatusMap.get(id) || "missing",
          invoiceCount: invoiceCountMap.get(id) || 0,
        }));

      // Sort: missing first, then overdue, pending, paid — alphabetically within each group
      result.sort((a, b) => {
        const od = STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order;
        return od !== 0 ? od : a.name.localeCompare(b.name);
      });

      setRows(result);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userRole) loadData(selectedMonth); }, [userRole, selectedMonth]);

  const handleMonthChange = (delta: 1 | -1) => {
    setSelectedMonth((m) => delta === 1 ? addMonths(m, 1) : subMonths(m, 1));
    setSearch("");
    setShowOnlyMissing(false);
  };

  // ── Filtered rows ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchMissing = !showOnlyMissing || r.status === "missing";
    return matchSearch && matchMissing;
  }), [rows, search, showOnlyMissing]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: rows.length,
    missing: rows.filter((r) => r.status === "missing").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
    pending: rows.filter((r) => r.status === "pending").length,
    paid:    rows.filter((r) => r.status === "paid").length,
  }), [rows]);

  if (!userRole) return null;

  const monthLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold leading-tight">Monitor de Parcelas</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Empresas com recorrência ativa — cobertura por mês
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(selectedMonth)} disabled={loading} className="shrink-0">
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Month Navigator ── */}
        <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="font-semibold capitalize text-base">{monthLabel}</div>
            {isCurrentMonth && (
              <div className="text-[11px] text-primary font-medium mt-0.5">Mês atual</div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange(1)}
            disabled={format(addMonths(selectedMonth, 1), "yyyy-MM") > format(addMonths(new Date(), 1), "yyyy-MM")}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sem parcela",  value: stats.missing, color: "text-destructive",   bg: "border-destructive/20" },
            { label: "Atrasado",     value: stats.overdue, color: "text-orange-400",    bg: "border-orange-500/20" },
            { label: "Pendente",     value: stats.pending, color: "text-yellow-400",    bg: "border-yellow-500/20" },
            { label: "Pago",         value: stats.paid,    color: "text-emerald-400",   bg: "border-emerald-500/20" },
          ].map((s) => (
            <div key={s.label} className={cn("bg-card rounded-lg border p-4", s.bg)}>
              <div className={cn("text-2xl font-bold", s.color)}>{loading ? "—" : s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            variant={showOnlyMissing ? "destructive" : "outline"}
            size="sm"
            onClick={() => setShowOnlyMissing(!showOnlyMissing)}
            className="gap-1.5 whitespace-nowrap"
          >
            <XCircle className="h-3.5 w-3.5" />
            Só sem parcela
            {stats.missing > 0 && (
              <Badge
                variant="secondary"
                className={cn("ml-1 h-4 px-1.5 text-[10px]", showOnlyMissing && "bg-white/20 text-white")}
              >
                {stats.missing}
              </Badge>
            )}
          </Button>
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {rows.length === 0
              ? "Nenhuma empresa com recorrência ativa encontrada."
              : "Nenhuma empresa encontrada para os filtros aplicados."}
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden divide-y">
            {filtered.map((row) => {
              const conf = STATUS_CONFIG[row.status];
              const Icon = conf.icon;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer group",
                    conf.rowBg
                  )}
                  onClick={() => navigate(`/onboarding-tasks/companies/${row.id}`)}
                >
                  {/* Status icon */}
                  <div className={cn("w-8 h-8 rounded flex items-center justify-center border shrink-0", conf.badgeBg)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm leading-tight truncate">{row.name}</span>
                      <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 border shrink-0", conf.badgeBg)}>
                        {conf.label}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {row.chargeCount} recorrência{row.chargeCount > 1 ? "s" : ""}
                      {" · "}
                      {(row.totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
                      {row.invoiceCount > 0 && (
                        <> · {row.invoiceCount} fatura{row.invoiceCount > 1 ? "s" : ""} no mês</>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer summary ── */}
        {!loading && rows.length > 0 && stats.missing > 0 && (
          <p className="text-xs text-muted-foreground text-center pb-2">
            <span className="text-destructive font-medium">{stats.missing}</span> empresa{stats.missing > 1 ? "s" : ""} sem parcela lançada em{" "}
            <span className="font-medium capitalize">{monthLabel}</span>
          </p>
        )}

      </div>
    </div>
  );
};

export default RecurringMonitorPage;

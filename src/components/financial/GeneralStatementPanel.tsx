import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { PeriodNavigator, getDateRangeForPeriod, type PeriodType } from "./PeriodNavigator";
import { ptBR } from "date-fns/locale";
import {
  Loader2, TrendingUp, TrendingDown, Search, FileSpreadsheet,
  ArrowLeft, ArrowRight,
} from "lucide-react";

interface StatementEntry {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  paid_amount: number | null;
  date: string; // paid_date or due_date
  status: string;
  category_name: string | null;
  category_color: string | null;
  cost_center: string | null;
  bank_name: string | null;
  entity_name: string; // supplier or company
  source: "receivable" | "payable";
}

interface FilterOption {
  id: string;
  name: string;
}

export function GeneralStatementPanel() {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [costCenterFilter, setCostCenterFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodType | "custom">("this_month");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [costCenters, setCostCenters] = useState<FilterOption[]>([]);
  const [banks, setBanks] = useState<FilterOption[]>([]);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    // Auto-set dates when period or offset changes
    if (periodFilter === "custom") return; // keep current custom dates
    if (periodFilter === "all") {
      setDateFrom("2020-01-01");
      setDateTo("2030-12-31");
      return;
    }
    const { start, end } = getDateRangeForPeriod(periodFilter as PeriodType, periodOffset);
    if (start && end) {
      setDateFrom(format(start, "yyyy-MM-dd"));
      setDateTo(format(end, "yyyy-MM-dd"));
    }
  }, [periodFilter, periodOffset]);

  useEffect(() => {
    loadData();
    setPage(0);
  }, [dateFrom, dateTo]);

  const loadFilters = async () => {
    const [catRes, ccRes, bankRes] = await Promise.all([
      supabase.from("financial_categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("staff_financial_cost_centers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("financial_bank_accounts").select("id, name").eq("is_active", true).order("name"),
    ]);
    setCategories(catRes.data || []);
    setCostCenters(ccRes.data || []);
    setBanks(bankRes.data || []);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load payables (expenses) - all statuses for the period
      const { data: payablesData } = await supabase
        .from("financial_payables")
        .select("id, description, amount, paid_amount, due_date, paid_date, status, supplier_name, category_id, cost_center, cost_center_id, bank_account_id, payment_method")
        .gte("due_date", dateFrom)
        .lte("due_date", dateTo)
        .order("due_date", { ascending: false });

      // Load receivables (income) - all statuses for the period
      const { data: receivablesData } = await supabase
        .from("financial_receivables")
        .select("id, description, amount, paid_amount, due_date, paid_date, status, company_id, category_id, bank_account_id, payment_method")
        .gte("due_date", dateFrom)
        .lte("due_date", dateTo)
        .order("due_date", { ascending: false });

      // Load category and bank mappings
      const { data: allCategories } = await supabase
        .from("financial_categories")
        .select("id, name, color");
      const { data: allBanks } = await supabase
        .from("financial_bank_accounts")
        .select("id, name");
      const { data: allCostCenters } = await supabase
        .from("staff_financial_cost_centers")
        .select("id, name");
      
      // Load company names for receivables
      const companyIds = [...new Set((receivablesData || []).filter(r => r.company_id).map(r => r.company_id))];
      let companiesMap: Record<string, string> = {};
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from("onboarding_companies")
          .select("id, name")
          .in("id", companyIds);
        (companiesData || []).forEach(c => { companiesMap[c.id] = c.name; });
      }

      const catMap: Record<string, { name: string; color: string }> = {};
      (allCategories || []).forEach(c => { catMap[c.id] = { name: c.name, color: c.color || "#6b7280" }; });

      const bankMap: Record<string, string> = {};
      (allBanks || []).forEach(b => { bankMap[b.id] = b.name; });

      const ccMap: Record<string, string> = {};
      (allCostCenters || []).forEach(cc => { ccMap[cc.id] = cc.name; });

      const allEntries: StatementEntry[] = [];

      // Process payables
      (payablesData || []).forEach(p => {
        const cat = p.category_id ? catMap[p.category_id] : null;
        allEntries.push({
          id: p.id,
          type: "expense",
          description: p.description,
          amount: Number(p.amount),
          paid_amount: p.paid_amount ? Number(p.paid_amount) : null,
          date: p.paid_date || p.due_date,
          status: p.status || "pending",
          category_name: cat?.name || null,
          category_color: cat?.color || null,
          cost_center: p.cost_center_id ? ccMap[p.cost_center_id] || p.cost_center : (p.cost_center || null),
          bank_name: p.bank_account_id ? bankMap[p.bank_account_id] || null : null,
          entity_name: p.supplier_name,
          source: "payable",
        });
      });

      // Process receivables
      (receivablesData || []).forEach(r => {
        const cat = r.category_id ? catMap[r.category_id] : null;
        allEntries.push({
          id: r.id,
          type: "income",
          description: r.description,
          amount: Number(r.amount),
          paid_amount: r.paid_amount ? Number(r.paid_amount) : null,
          date: r.paid_date || r.due_date,
          status: r.status || "pending",
          category_name: cat?.name || null,
          category_color: cat?.color || null,
          cost_center: null, // receivables don't have cost_center in this schema
          bank_name: r.bank_account_id ? bankMap[r.bank_account_id] || null : null,
          entity_name: r.company_id ? companiesMap[r.company_id] || "Cliente" : "Cliente",
          source: "receivable",
        });
      });

      // Sort by date descending
      allEntries.sort((a, b) => b.date.localeCompare(a.date));
      setEntries(allEntries);
    } catch (err) {
      console.error("Error loading general statement:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (searchTerm && !e.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !e.entity_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (categoryFilter !== "all" && e.category_name !== categoryFilter) return false;
      if (costCenterFilter !== "all" && e.cost_center !== costCenterFilter) return false;
      if (bankFilter !== "all" && e.bank_name !== bankFilter) return false;
      return true;
    });
  }, [entries, searchTerm, typeFilter, categoryFilter, costCenterFilter, bankFilter]);

  const totalIncome = filteredEntries.filter(e => e.type === "income").reduce((s, e) => s + (e.paid_amount || e.amount), 0);
  const totalExpense = filteredEntries.filter(e => e.type === "expense").reduce((s, e) => s + (e.paid_amount || e.amount), 0);
  const balance = totalIncome - totalExpense;

  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const paginatedEntries = filteredEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid": return "Pago";
      case "pending": return "Pendente";
      case "overdue": return "Atrasado";
      case "partial": return "Parcial";
      case "cancelled": return "Cancelado";
      default: return status;
    }
  };

  const uniqueCategories = [...new Set(entries.map(e => e.category_name).filter(Boolean))] as string[];
  const uniqueCostCenters = [...new Set(entries.map(e => e.cost_center).filter(Boolean))] as string[];
  const uniqueBanks = [...new Set(entries.map(e => e.bank_name).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Extrato Geral</h2>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              {periodFilter === "custom" ? (
                <Select value="custom" onValueChange={(v) => { setPeriodFilter(v as PeriodType | "custom"); setPeriodOffset(0); setPage(0); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="this_week">Esta semana</SelectItem>
                    <SelectItem value="this_month">Este mês</SelectItem>
                    <SelectItem value="this_year">Este ano</SelectItem>
                    <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
                    <SelectItem value="last_12_months">Últimos 12 meses</SelectItem>
                    <SelectItem value="all">Todo o período</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <PeriodNavigator
                  period={periodFilter as PeriodType}
                  offset={periodOffset}
                  onPeriodChange={(v) => { setPeriodFilter(v); setPage(0); }}
                  onOffsetChange={(o) => { setPeriodOffset(o); setPage(0); }}
                />
              )}
            </div>

            {periodFilter === "custom" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">De</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[140px]" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[140px]" />
                </div>
              </>
            )}

            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Descrição ou entidade..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {uniqueCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Centro de Custo</label>
              <Select value={costCenterFilter} onValueChange={(v) => { setCostCenterFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os centros</SelectItem>
                  {uniqueCostCenters.map(cc => (
                    <SelectItem key={cc} value={cc}>{cc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Banco</label>
              <Select value={bankFilter} onValueChange={(v) => { setBankFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bancos</SelectItem>
                  {uniqueBanks.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-lg font-bold ${balance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Lançamentos</p>
            <p className="text-lg font-bold">{filteredEntries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum lançamento encontrado para os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Mobile View */}
            <div className="sm:hidden space-y-0 divide-y">
              {paginatedEntries.map((e) => (
                <div key={`${e.source}-${e.id}`} className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {e.type === "income" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(e.date), "dd/MM/yyyy")} • {e.entity_name}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${e.type === "income" ? "text-emerald-600" : "text-destructive"}`}>
                      {e.type === "income" ? "+" : "-"}{formatCurrency(e.paid_amount || e.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-6 flex-wrap">
                    {e.category_name && (
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: e.category_color || undefined }}>
                        {e.category_name}
                      </Badge>
                    )}
                    {e.cost_center && (
                      <Badge variant="secondary" className="text-[10px]">{e.cost_center}</Badge>
                    )}
                    {e.bank_name && (
                      <span className="text-[10px] text-muted-foreground">{e.bank_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[60px]">Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[130px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((e) => (
                  <TableRow key={`${e.source}-${e.id}`}>
                    <TableCell className="text-sm">
                      {format(parseISO(e.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {e.type === "income" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{e.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.entity_name}</TableCell>
                    <TableCell>
                      {e.category_name ? (
                        <Badge variant="outline" className="text-[11px]" style={{ borderColor: e.category_color || undefined }}>
                          {e.category_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.cost_center || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.bank_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {getStatusLabel(e.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${e.type === "income" ? "text-emerald-600" : "text-destructive"}`}>
                      {e.type === "income" ? "+" : "-"}{formatCurrency(e.paid_amount || e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {filteredEntries.length} lançamento(s)
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">{page + 1}/{totalPages}</span>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, TrendingUp, TrendingDown, Search, ArrowLeft, ArrowRight,
  Building2, Calendar,
} from "lucide-react";

interface Transaction {
  id: string;
  bank_id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  created_at: string;
  reference_id: string | null;
  reference_type: string | null;
  client_name: string | null;
  interest_cents: number;
  fee_cents: number;
  discount_cents: number;
}

interface BankAccount {
  id: string;
  name: string;
  current_balance_cents: number;
}

export function BankStatementFullPanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBank, setSelectedBank] = useState<string>("all");
  // new Date("2026-09-01") interpreta como UTC (vira 31/08 21h local e o rótulo
  // do mês errava); campo vazio dava Invalid Date e derrubava a tela inteira.
  const dataSegura = (s: string) => {
    const d = s ? new Date(s + "T12:00:00") : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [page, setPage] = useState(0);
  const [periodo, setPeriodo] = useState("month");
  const PAGE_SIZE = 30;

  useEffect(() => { loadBankAccounts(); }, []);
  useEffect(() => { loadTransactions(); setPage(0); }, [selectedBank, dateFrom, dateTo]);

  const loadBankAccounts = async () => {
    const { data } = await supabase
      .from("financial_banks")
      .select("id, name, current_balance_cents")
      .eq("is_active", true)
      .order("name");
    setBankAccounts(data || []);
  };

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_date_from: `${dateFrom}T00:00:00+00:00`,
        p_date_to: `${dateTo}T23:59:59+00:00`,
      };
      if (selectedBank !== "all") {
        params.p_bank_id = selectedBank;
      }

      // o servidor devolve no máximo 1000 linhas por chamada: em trimestre/ano/total precisa paginar
      const todas: Transaction[] = [];
      for (let ini = 0; ini < 50000; ini += 1000) {
        const { data, error } = await (supabase.rpc("get_bank_statement_transactions", params as any) as any).range(ini, ini + 999);
        if (error) throw error;
        todas.push(...((data || []) as Transaction[]));
        if (!data || data.length < 1000) break;
      }
      setTransactions(todas);
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const bankMap = useMemo(() => {
    const map: Record<string, BankAccount> = {};
    bankAccounts.forEach(b => { map[b.id] = b; });
    return map;
  }, [bankAccounts]);

  // Busca (21/09/2026): antes só olhava a descrição, então "Eva" não achava o salário dela (o nome fica no
  // fornecedor, não na descrição). Agora procura em descrição + cliente/fornecedor + valor, ignorando acento.
  const semAcento = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const termo = semAcento(search.trim());
  const filteredTransactions = transactions.filter(t =>
    !termo || semAcento(`${t.description || ""} ${t.client_name || ""} ${(t.amount_cents / 100).toFixed(2).replace(".", ",")}`).includes(termo)
  );

  const paginatedTransactions = filteredTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);

  const totalCredits = filteredTransactions
    .filter(t => t.type === "credit")
    .reduce((s, t) => s + t.amount_cents, 0);
  const totalDebits = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((s, t) => s + t.amount_cents, 0);

  const dailySummary = useMemo(() => {
    const grouped: Record<string, { credits: number; debits: number; count: number }> = {};
    filteredTransactions.forEach(t => {
      const day = t.created_at.substring(0, 10);
      if (!grouped[day]) grouped[day] = { credits: 0, debits: 0, count: 0 };
      grouped[day].count++;
      if (t.type === "credit") grouped[day].credits += t.amount_cents;
      else grouped[day].debits += t.amount_cents;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({ date, ...data }));
  }, [filteredTransactions]);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  // PERÍODO (21/09/2026): além de mês, trimestre, semestre, ano, últimos 12 meses, tudo e personalizado.
  const intervalo = (tipo: string, ref: Date): [Date, Date] => {
    const y = ref.getFullYear(), m = ref.getMonth();
    if (tipo === "quarter") { const q = Math.floor(m / 3) * 3; return [new Date(y, q, 1), new Date(y, q + 3, 0)]; }
    if (tipo === "semester") { const sm = m < 6 ? 0 : 6; return [new Date(y, sm, 1), new Date(y, sm + 6, 0)]; }
    if (tipo === "year") return [new Date(y, 0, 1), new Date(y, 11, 31)];
    if (tipo === "last12") { const hoje = new Date(); return [new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1), endOfMonth(hoje)]; }
    if (tipo === "all") return [new Date(2020, 0, 1), new Date(new Date().getFullYear() + 1, 11, 31)];
    return [startOfMonth(ref), endOfMonth(ref)];
  };
  const aplicarPeriodo = (tipo: string, ref: Date = new Date()) => {
    setPeriodo(tipo);
    if (tipo === "custom") return;
    const [a, b] = intervalo(tipo, ref);
    setDateFrom(format(a, "yyyy-MM-dd")); setDateTo(format(b, "yyyy-MM-dd"));
  };
  const mover = (dir: number) => {
    const d = dataSegura(dateFrom);
    const passo = periodo === "quarter" ? 3 : periodo === "semester" ? 6 : periodo === "year" ? 12 : 1;
    aplicarPeriodo(["quarter", "semester", "year"].includes(periodo) ? periodo : "month", new Date(d.getFullYear(), d.getMonth() + dir * passo, 1));
  };
  const prevMonth = () => mover(-1);
  const nextMonth = () => mover(1);
  const podeNavegar = !["last12", "all", "custom"].includes(periodo);

  const monthLabel = (() => {
    const a = dataSegura(dateFrom);
    const mes = (d: Date) => format(d, "MMM/yy", { locale: ptBR });
    if (periodo === "quarter") return `${Math.floor(a.getMonth() / 3) + 1}º trimestre ${a.getFullYear()}`;
    if (periodo === "semester") return `${a.getMonth() < 6 ? 1 : 2}º semestre ${a.getFullYear()}`;
    if (periodo === "year") return `Ano ${a.getFullYear()}`;
    if (periodo === "last12") return `${mes(a)} a ${mes(dataSegura(dateTo))}`;
    if (periodo === "all") return "Todo o período";
    if (periodo === "custom") return "Personalizado";
    return format(a, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase());
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Extrato Bancário
        </h2>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Banco</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bancos</SelectItem>
                  {bankAccounts.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-1">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                <div className="flex items-center gap-1">
                  <Select value={periodo} onValueChange={(v) => aplicarPeriodo(v, periodo === "custom" || periodo === "all" || periodo === "last12" ? new Date() : dataSegura(dateFrom))}>
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mês</SelectItem>
                      <SelectItem value="quarter">Trimestre</SelectItem>
                      <SelectItem value="semester">Semestre</SelectItem>
                      <SelectItem value="year">Ano</SelectItem>
                      <SelectItem value="last12">Últimos 12 meses</SelectItem>
                      <SelectItem value="all">Todo o período</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={prevMonth} disabled={!podeNavegar}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[130px] text-center">{monthLabel}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={nextMonth} disabled={!podeNavegar}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">De</label>
                <Input type="date" value={dateFrom} onChange={e => { setPeriodo("custom"); setDateFrom(e.target.value); }} className="h-9 w-[140px]" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                <Input type="date" value={dateTo} onChange={e => { setPeriodo("custom"); setDateTo(e.target.value); }} className="h-9 w-[140px]" />
              </div>
            </div>

            <div className="flex-1 min-w-[180px] flex items-end">
              <div className="relative w-full">
                <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Fornecedor, cliente, descrição ou valor"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Entradas</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalCredits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Saídas</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalDebits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Saldo Período</p>
            <p className={`text-lg font-bold ${totalCredits - totalDebits >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(totalCredits - totalDebits)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Lançamentos</p>
            <p className="text-lg font-bold">{filteredTransactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {dailySummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Entradas por Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {dailySummary.map(day => (
                  <div key={day.date} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="font-medium min-w-[90px]">
                      {format(parseISO(day.date), "dd/MM/yyyy")}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatCurrency(day.credits)}
                      </span>
                      <span className="text-destructive flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {formatCurrency(day.debits)}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {day.count} mov.
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <p>Nenhum lançamento encontrado neste período{termo ? ` para "${search.trim()}"` : ""}.</p>
            {termo && periodo !== "all" && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => aplicarPeriodo("all")}>
                Procurar "{search.trim()}" em todo o período
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="sm:hidden space-y-0 divide-y">
              {paginatedTransactions.map((t) => (
                <div key={t.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.type === "credit" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">{t.description || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(t.created_at), "dd/MM/yyyy HH:mm")}
                          {bankMap[t.bank_id] && ` • ${bankMap[t.bank_id].name}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                      {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount_cents)}
                    </span>
                  </div>
                  {(t.client_name || t.interest_cents > 0 || t.fee_cents > 0 || t.discount_cents > 0) && (
                    <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground">
                      {t.client_name && <span>Cliente: {t.client_name}</span>}
                      {t.discount_cents > 0 && <span className="text-emerald-600">Desconto: -{formatCurrency(t.discount_cents)}</span>}
                      {t.interest_cents > 0 && <span>Juros: {formatCurrency(t.interest_cents)}</span>}
                      {t.fee_cents > 0 && <span>Taxa: {formatCurrency(t.fee_cents)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Cliente / Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right w-[140px]">Juros/Taxa/Desc.</TableHead>
                  <TableHead className="text-right w-[130px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">
                      {format(parseISO(t.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bankMap[t.bank_id]?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.client_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{t.description || "-"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      <div className="flex flex-col items-end gap-0.5">
                        {t.discount_cents > 0 && <span className="text-emerald-600">-{formatCurrency(t.discount_cents)}</span>}
                        {t.interest_cents > 0 && <span>+{formatCurrency(t.interest_cents)}</span>}
                        {t.fee_cents > 0 && <span>{formatCurrency(t.fee_cents)}</span>}
                        {t.discount_cents === 0 && t.interest_cents === 0 && t.fee_cents === 0 && <span>-</span>}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                      {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {filteredTransactions.length} lançamento(s)
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

import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Building2,
  Search,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

interface Transaction {
  id: string;
  bank_account_id: string;
  type: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  is_reconciled: boolean;
  balance_after: number | null;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_type: string;
  current_balance: number;
  initial_balance: number;
  agency: string | null;
  account_number: string | null;
}

interface Props {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (value: number) => string;
}

export function BankStatementDialog({ account, open, onOpenChange, formatCurrency }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (open && account) {
      loadTransactions();
      setPage(0);
    }
  }, [open, account, currentMonth]);

  const loadTransactions = async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const to = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("bank_account_id", account.id)
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error("Error loading statement:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t =>
    !search || (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const paginatedTransactions = filteredTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);

  const totalCredits = filteredTransactions
    .filter(t => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalDebits = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase());

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setPage(0);
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setPage(0);
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{account.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {account.bank_name}
                {account.agency && account.account_number && ` • Ag ${account.agency} / CC ${account.account_number}`}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 pb-4 sm:pb-6 gap-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Entradas</p>
              <p className="text-sm sm:text-lg font-bold text-emerald-600">{formatCurrency(totalCredits)}</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Saídas</p>
              <p className="text-sm sm:text-lg font-bold text-destructive">{formatCurrency(totalDebits)}</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Saldo Atual</p>
              <p className={`text-sm sm:text-lg font-bold ${Number(account.current_balance) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatCurrency(Number(account.current_balance))}
              </p>
            </div>
          </div>

          {/* Month nav + search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[130px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Transactions table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum lançamento encontrado neste período.
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0 max-h-[40vh]">
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {paginatedTransactions.map((t) => (
                    <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.type === "credit" ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{t.description || "Sem descrição"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(t.transaction_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium whitespace-nowrap ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                        {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right w-[130px]">Valor</TableHead>
                      <TableHead className="text-right w-[130px]">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">
                          {format(parseISO(t.transaction_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">{t.description || "-"}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                          {t.type === "credit" ? "+" : "-"}{formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {t.balance_after != null ? formatCurrency(t.balance_after) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

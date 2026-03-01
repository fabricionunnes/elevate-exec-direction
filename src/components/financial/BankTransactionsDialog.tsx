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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Landmark,
  Search,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

interface BankTransaction {
  id: string;
  bank_id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  company_name?: string | null;
}

interface FinancialBank {
  id: string;
  name: string;
  bank_code: string | null;
  agency: string | null;
  account_number: string | null;
  initial_balance_cents: number;
  current_balance_cents: number;
}

interface Props {
  bank: FinancialBank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrencyCents: (cents: number) => string;
}

export function BankTransactionsDialog({ bank, open, onOpenChange, formatCurrencyCents }: Props) {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (open && bank) {
      loadTransactions();
      setPage(0);
    }
  }, [open, bank, currentMonth]);

  const loadTransactions = async () => {
    if (!bank) return;
    setIsLoading(true);
    try {
      const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const to = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("financial_bank_transactions")
        .select("*, company_invoices:reference_id(company_id, onboarding_companies:company_id(name))")
        .eq("bank_id", bank.id)
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const mapped = ((data as any[]) || []).map((t: any) => ({
        ...t,
        company_name: t.company_invoices?.onboarding_companies?.name || null,
      }));
      setTransactions(mapped as BankTransaction[]);
    } catch (err) {
      console.error("Error loading bank transactions:", err);
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
    .reduce((s, t) => s + t.amount_cents, 0);
  const totalDebits = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((s, t) => s + t.amount_cents, 0);

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR }).replace(/^./, c => c.toUpperCase());

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setPage(0);
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setPage(0);
  };

  if (!bank) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{bank.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {bank.bank_code && `Banco ${bank.bank_code}`}
                {bank.agency && bank.account_number && ` • Ag ${bank.agency} / CC ${bank.account_number}`}
                {!bank.bank_code && !bank.agency && "Extrato de movimentações"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 pb-4 sm:pb-6 gap-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Entradas</p>
              <p className="text-sm sm:text-lg font-bold text-emerald-600">{formatCurrencyCents(totalCredits)}</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Saídas</p>
              <p className="text-sm sm:text-lg font-bold text-destructive">{formatCurrencyCents(totalDebits)}</p>
            </div>
            <div className="rounded-lg border p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Saldo Atual</p>
              <p className={`text-sm sm:text-lg font-bold ${bank.current_balance_cents >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatCurrencyCents(bank.current_balance_cents)}
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

          {/* Transactions */}
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
                          {t.company_name && (
                            <p className="text-xs font-medium text-primary truncate">{t.company_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium whitespace-nowrap ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                        {t.type === "credit" ? "+" : "-"}{formatCurrencyCents(t.amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente/Fornecedor</TableHead>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead className="text-right w-[130px]">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">
                          {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm">{t.description || "-"}</TableCell>
                        <TableCell className="text-sm font-medium">{t.company_name || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {t.reference_type === "invoice" ? "Fatura" : t.reference_type || "-"}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium ${t.type === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                          {t.type === "credit" ? "+" : "-"}{formatCurrencyCents(t.amount_cents)}
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

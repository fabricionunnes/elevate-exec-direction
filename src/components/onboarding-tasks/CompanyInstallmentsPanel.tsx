import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, Search, CreditCard, CalendarClock, AlertTriangle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Row {
  company_id: string;
  company_name: string;
  payment_method: string | null;
  contract_value: number | null;
  total_installments: number | null;
  paid_count: number;
  open_count: number;
  open_amount_cents: number;
  overdue_count: number;
  next_due: string | null;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Situação da empresa a partir do que é DE FATO cobrado (company_invoices):
// abertas > 0 = tem parcelas mensais a receber; 0 abertas com pagas = quitada;
// nenhuma fatura = cobrança fora do sistema (cartão direto etc.).
function classify(r: Row): "mensal" | "quitada" | "sem_cobranca" {
  if (r.open_count > 0) return "mensal";
  if (r.paid_count > 0) return "quitada";
  return "sem_cobranca";
}

export const CompanyInstallmentsPanel = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mensal" | "quitada" | "sem_cobranca">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)("get_company_installments_overview");
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const mensal = rows.filter((r) => classify(r) === "mensal");
    return {
      mensal: mensal.length,
      mensalValor: mensal.reduce((s, r) => s + Number(r.open_amount_cents || 0), 0),
      overdue: mensal.filter((r) => r.overdue_count > 0).length,
      quitada: rows.filter((r) => classify(r) === "quitada").length,
      semCobranca: rows.filter((r) => classify(r) === "sem_cobranca").length,
    };
  }, [rows]);

  const list = useMemo(() => {
    let l = rows;
    if (filter !== "all") l = l.filter((r) => classify(r) === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      l = l.filter((r) => r.company_name.toLowerCase().includes(q));
    }
    // vencidas primeiro, depois maior valor em aberto
    return [...l].sort((a, b) => (b.overdue_count - a.overdue_count) || (Number(b.open_amount_cents) - Number(a.open_amount_cents)));
  }, [rows, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando parcelas...
      </div>
    );
  }

  const chip = (key: typeof filter, label: string, value: string, cls: string) => (
    <button
      onClick={() => setFilter(filter === key ? "all" : key)}
      className={`rounded-lg border px-3 py-2 text-left transition-all ${cls} ${filter === key ? "ring-2 ring-primary" : ""}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chip("mensal", "Com parcelas mensais", `${totals.mensal} · ${brl(totals.mensalValor)} a receber`, "bg-blue-500/10 border-blue-500/30")}
        {chip("quitada", "Quitadas (cartão/à vista)", String(totals.quitada), "bg-emerald-500/10 border-emerald-500/30")}
        {chip("sem_cobranca", "Sem cobrança no sistema", String(totals.semCobranca), "bg-amber-500/10 border-amber-500/30")}
        {totals.overdue > 0 && (
          <div className="rounded-lg border px-3 py-2 bg-red-500/10 border-red-500/30">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Com parcela vencida</p>
            <p className="text-base font-bold text-red-600 tabular-nums">{totals.overdue}</p>
          </div>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-center">Parcelas pagas</TableHead>
                <TableHead className="text-center">Restam</TableHead>
                <TableHead className="text-right">Valor em aberto</TableHead>
                <TableHead className="text-right">Próx. vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell></TableRow>
              ) : (
                list.map((r) => {
                  const cat = classify(r);
                  const totalParcelas = r.total_installments || (r.paid_count + r.open_count) || null;
                  return (
                    <TableRow key={r.company_id}>
                      <TableCell className="font-medium max-w-[260px] truncate">{r.company_name}</TableCell>
                      <TableCell>
                        {cat === "mensal" ? (
                          r.overdue_count > 0 ? (
                            <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1" variant="outline">
                              <AlertTriangle className="h-3 w-3" /> Mensal · {r.overdue_count} vencida{r.overdue_count > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 gap-1" variant="outline">
                              <CalendarClock className="h-3 w-3" /> Mensal
                            </Badge>
                          )
                        ) : cat === "quitada" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1" variant="outline">
                            <CreditCard className="h-3 w-3" /> Quitada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            {r.payment_method === "card" ? "Cartão (fora do sistema)" : "Sem cobrança"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.paid_count > 0 || r.open_count > 0
                          ? `${r.paid_count}${totalParcelas ? ` de ${totalParcelas}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-semibold">
                        {r.open_count > 0 ? r.open_count : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {r.open_count > 0 ? brl(Number(r.open_amount_cents)) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.next_due ? format(parseISO(r.next_due), "dd/MM/yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Fonte: faturas de cobrança (company_invoices). "Sem cobrança" = nenhuma fatura no sistema — pagamento direto (cartão na operadora) ou cobrança ainda não configurada.
      </p>
    </div>
  );
};

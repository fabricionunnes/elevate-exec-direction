import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  QrCode,
  FileText,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Barcode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusFilter = "all" | "pending" | "paid" | "failed" | "cancelled" | "refunded";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  processing: { label: "Processando", variant: "secondary", icon: RefreshCw },
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle },
  refunded: { label: "Reembolsado", variant: "secondary", icon: AlertTriangle },
};

const methodIcons: Record<string, React.ElementType> = {
  credit_card: CreditCard,
  pix: QrCode,
  boleto: Barcode,
};

const methodLabels: Record<string, string> = {
  credit_card: "Cartão",
  pix: "PIX",
  boleto: "Boleto",
};

export function BillingPaymentsPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["pagarme-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagarme_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filtered = (orders ?? []).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.product_name?.toLowerCase().includes(q) ||
        o.customer_document?.includes(q)
      );
    }
    return true;
  });

  const summary = {
    total: orders?.length ?? 0,
    pending: orders?.filter((o) => o.status === "pending").length ?? 0,
    paid: orders?.filter((o) => o.status === "paid").length ?? 0,
    failed: orders?.filter((o) => ["failed", "cancelled"].includes(o.status)).length ?? 0,
  };

  const pendingAmount = (orders ?? [])
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const paidAmount = (orders ?? [])
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const formatCurrency = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cobranças & Pagamentos</h2>
        <p className="text-muted-foreground">Acompanhe boletos, PIX e cartões em tempo real</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total de cobranças</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes • {formatCurrency(pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.paid}</p>
                <p className="text-xs text-muted-foreground">Pagos • {formatCurrency(paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas / Cancelados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Histórico de Cobranças</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="failed">Falhos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
                <SelectItem value="refunded">Reembolsados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              {orders?.length === 0
                ? "Nenhuma cobrança registrada ainda"
                : "Nenhuma cobrança encontrada com os filtros aplicados"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => {
                    const sc = statusConfig[order.status] ?? {
                      label: order.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const StatusIcon = sc.icon;
                    const MethodIcon = methodIcons[order.payment_method] ?? FileText;

                    return (
                      <TableRow key={order.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[160px]">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{order.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[140px]">{order.product_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MethodIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{methodLabels[order.payment_method] ?? order.payment_method}</span>
                            {order.installments && order.installments > 1 && (
                              <span className="text-xs text-muted-foreground">({order.installments}x)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                          {formatCurrency(order.amount_cents)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {order.boleto_due_date
                            ? format(new Date(order.boleto_due_date), "dd/MM/yy", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sc.variant} className="gap-1 whitespace-nowrap">
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {order.boleto_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              asChild
                            >
                              <a href={order.boleto_url} target="_blank" rel="noopener noreferrer" title="Ver boleto">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

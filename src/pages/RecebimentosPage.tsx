import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, CreditCard, QrCode, FileText, Search, RefreshCw,
  ExternalLink, CheckCircle2, Clock, XCircle, AlertTriangle,
  Loader2, Barcode, Copy, Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "paid" | "failed" | "cancelled";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  processing: { label: "Processando", variant: "secondary", icon: RefreshCw },
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle },
  refunded: { label: "Reembolsado", variant: "secondary", icon: AlertTriangle },
};

const methodIcons: Record<string, React.ElementType> = {
  credit_card: CreditCard, pix: QrCode, boleto: Barcode,
};
const methodLabels: Record<string, string> = {
  credit_card: "Cartão", pix: "PIX", boleto: "Boleto",
};

export default function RecebimentosPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: links, isLoading: linksLoading, refetch, isRefetching } = useQuery({
    queryKey: ["payment-links-with-orders"],
    queryFn: async () => {
      // Fetch links
      const { data: linksData, error: linksErr } = await supabase
        .from("payment_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (linksErr) throw linksErr;

      // Fetch all orders (linked + avulsas)
      const { data: ordersData, error: ordersErr } = await supabase
        .from("pagarme_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (ordersErr) throw ordersErr;

      // Group orders by link
      const ordersByLink = new Map<string, typeof ordersData>();
      for (const order of ordersData ?? []) {
        const linkId = order.payment_link_id;
        if (!linkId) continue;
        if (!ordersByLink.has(linkId)) ordersByLink.set(linkId, []);
        ordersByLink.get(linkId)!.push(order);
      }

      const linkedRows = (linksData ?? []).map((link) => ({
        ...link,
        orders: ordersByLink.get(link.id) ?? [],
      }));

      const standaloneRows = (ordersData ?? [])
        .filter((order) => !order.payment_link_id)
        .map((order) => ({
          id: `order-${order.id}`,
          description: order.product_name || "Cobrança avulsa",
          amount_cents: order.amount_cents,
          payment_method: order.payment_method,
          installments: order.installments ?? 1,
          url: "",
          created_at: order.created_at,
          orders: [order],
        }));

      return [...linkedRows, ...standaloneRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const filtered = (links ?? []).filter((link) => {
    // Status filter: check if ANY order matches, or if no orders & filter is pending
    if (statusFilter !== "all") {
      if (statusFilter === "pending" && link.orders.length === 0) return true;
      const hasMatch = link.orders.some((o: any) => o.status === statusFilter);
      if (!hasMatch && link.orders.length > 0) return false;
      if (!hasMatch && link.orders.length === 0 && statusFilter !== "pending") return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return link.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const formatCurrency = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const copyLink = (url: string) => {
    if (!url) {
      toast.error("Essa cobrança não possui link compartilhável");
      return;
    }

    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getLinkStatus = (link: any) => {
    if (link.orders.length === 0) return { label: "Aguardando", variant: "outline" as const, icon: Clock };
    const hasPaid = link.orders.some((o: any) => o.status === "paid");
    if (hasPaid) return { label: "Pago", variant: "default" as const, icon: CheckCircle2 };
    const hasPending = link.orders.some((o: any) => o.status === "pending");
    if (hasPending) return { label: "Pendente", variant: "outline" as const, icon: Clock };
    const hasFailed = link.orders.some((o: any) => ["failed", "cancelled"].includes(o.status));
    if (hasFailed) return { label: "Falhou", variant: "destructive" as const, icon: XCircle };
    return { label: "Pendente", variant: "outline" as const, icon: Clock };
  };

  // Summary
  const totalLinks = links?.length ?? 0;
  const paidLinks = links?.filter((l) => l.orders.some((o: any) => o.status === "paid")).length ?? 0;
  const pendingLinks = links?.filter((l) => l.orders.length === 0 || l.orders.some((o: any) => o.status === "pending")).length ?? 0;
  const paidAmount = (links ?? []).reduce((sum, l) => {
    const paidOrder = l.orders.find((o: any) => o.status === "paid");
    return sum + (paidOrder ? paidOrder.amount_cents : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold">Recebimentos</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalLinks}</p>
                  <p className="text-xs text-muted-foreground">Cobranças registradas</p>
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
                  <p className="text-2xl font-bold">{pendingLinks}</p>
                  <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
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
                  <p className="text-2xl font-bold">{paidLinks}</p>
                  <p className="text-xs text-muted-foreground">Pagos • {formatCurrency(paidAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(paidAmount)}</p>
                  <p className="text-xs text-muted-foreground">Total recebido</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-lg">Links de Pagamento</CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
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
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {linksLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">
                {totalLinks === 0 ? "Nenhum link criado ainda" : "Nenhum resultado com os filtros aplicados"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((link) => {
                      const st = getLinkStatus(link);
                      const StatusIcon = st.icon;
                      const MethodIcon = methodIcons[link.payment_method] ?? FileText;
                      const paidOrder = link.orders.find((o: any) => o.status === "paid");
                      const latestOrder = link.orders[0];

                      return (
                        <TableRow key={link.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(link.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm truncate max-w-[200px]">{link.description}</p>
                            {link.installments > 1 && (
                              <p className="text-xs text-muted-foreground">{link.installments}x</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MethodIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{methodLabels[link.payment_method] ?? link.payment_method}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                            {formatCurrency(link.amount_cents)}
                          </TableCell>
                          <TableCell>
                            {latestOrder ? (
                              <div>
                                <p className="text-sm truncate max-w-[140px]">{latestOrder.customer_name}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{latestOrder.customer_email}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant} className="gap-1 whitespace-nowrap">
                              <StatusIcon className="h-3 w-3" />
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyLink(link.url)}
                                title={link.url ? "Copiar link" : "Sem link para copiar"}
                                disabled={!link.url}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {latestOrder?.boleto_url && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <a href={latestOrder.boleto_url} target="_blank" rel="noopener noreferrer" title="Ver boleto">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
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
      </main>
    </div>
  );
}

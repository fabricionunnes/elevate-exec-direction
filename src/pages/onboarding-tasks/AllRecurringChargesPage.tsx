import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  Download,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecurringCharge {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  recurrence: string;
  next_billing_date: string | null;
  is_active: boolean;
  created_at: string;
  asaas_subscription_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name?: string;
}

interface FinancialEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  category: string | null;
  reference_month: string;
  paid_amount: number | null;
  paid_at: string | null;
  created_at: string;
}

export default function AllRecurringChargesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("receivables");

  // Recurring charges state
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Financial entries state
  const [receivables, setReceivables] = useState<FinancialEntry[]>([]);
  const [payables, setPayables] = useState<FinancialEntry[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedRecurrence, setSelectedRecurrence] = useState("all");

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding/login"); return; }

      // Check staff role
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      const role = (staff as any)?.role;
      if (role === "admin" || role === "master") {
        setUserRole(role);
        // Set default tab based on role
        if (role === "master") {
          setActiveTab("receivables");
        } else {
          setActiveTab("receivables");
        }
        await loadData();
      } else {
        setUserRole(null);
        toast.error("Acesso negado. Este módulo é restrito a administradores.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [chargesRes, companiesRes, receivablesRes, payablesRes] = await Promise.all([
        supabase
          .from("company_recurring_charges")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("onboarding_companies")
          .select("id, name")
          .order("name"),
        supabase
          .from("financial_receivables")
          .select("*")
          .order("due_date", { ascending: false }),
        supabase
          .from("financial_payables")
          .select("*")
          .order("due_date", { ascending: false }),
      ]);

      if (chargesRes.error) throw chargesRes.error;
      if (companiesRes.error) throw companiesRes.error;

      const companiesMap = new Map(companiesRes.data?.map(c => [c.id, c.name]) || []);
      const enriched = (chargesRes.data || []).map((ch: any) => ({
        ...ch,
        company_name: companiesMap.get(ch.company_id) || "Empresa desconhecida",
      }));

      setCharges(enriched);
      setCompanies(companiesRes.data || []);
      setReceivables((receivablesRes.data as any) || []);
      setPayables((payablesRes.data as any) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    }
  };

  const isMaster = userRole === "master";
  const isAdmin = userRole === "admin" || isMaster;

  // Recurring charges filters
  const months = useMemo(() => {
    const set = new Set<string>();
    charges.forEach(ch => {
      if (ch.created_at) set.add(ch.created_at.substring(0, 7));
      if (ch.next_billing_date) set.add(ch.next_billing_date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [charges]);

  const filteredCharges = useMemo(() => {
    return charges.filter(ch => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match =
          ch.description?.toLowerCase().includes(s) ||
          ch.customer_name?.toLowerCase().includes(s) ||
          ch.customer_email?.toLowerCase().includes(s) ||
          ch.company_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (selectedCompany !== "all" && ch.company_id !== selectedCompany) return false;
      if (selectedStatus === "active" && !ch.is_active) return false;
      if (selectedStatus === "inactive" && ch.is_active) return false;
      if (selectedRecurrence !== "all" && ch.recurrence !== selectedRecurrence) return false;
      if (selectedMonth !== "all") {
        const createdMonth = ch.created_at?.substring(0, 7);
        const billingMonth = ch.next_billing_date?.substring(0, 7);
        if (createdMonth !== selectedMonth && billingMonth !== selectedMonth) return false;
      }
      return true;
    });
  }, [charges, searchTerm, selectedCompany, selectedStatus, selectedMonth, selectedRecurrence]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter(r => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!r.description?.toLowerCase().includes(s)) return false;
      }
      if (selectedStatus === "pending" && r.status !== "pending") return false;
      if (selectedStatus === "paid" && r.status !== "paid") return false;
      if (selectedStatus === "overdue" && r.status !== "overdue") return false;
      if (selectedMonth !== "all" && r.reference_month !== selectedMonth) return false;
      return true;
    });
  }, [receivables, searchTerm, selectedStatus, selectedMonth]);

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!p.description?.toLowerCase().includes(s)) return false;
      }
      if (selectedStatus === "pending" && p.status !== "pending") return false;
      if (selectedStatus === "paid" && p.status !== "paid") return false;
      if (selectedStatus === "overdue" && p.status !== "overdue") return false;
      if (selectedMonth !== "all" && p.reference_month !== selectedMonth) return false;
      return true;
    });
  }, [payables, searchTerm, selectedStatus, selectedMonth]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatCurrencyCents = (cents: number) => formatCurrency(cents / 100);

  const recurrenceLabel = (r: string) => {
    const map: Record<string, string> = {
      monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual", weekly: "Semanal",
    };
    return map[r] || r;
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado" };
    return map[s] || s;
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "paid") return "default";
    if (s === "overdue") return "destructive";
    if (s === "cancelled") return "secondary";
    return "outline";
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCompany("all");
    setSelectedStatus("all");
    setSelectedMonth("all");
    setSelectedRecurrence("all");
  };

  const exportCSV = () => {
    let rows: string[][] = [];
    if (activeTab === "receivables") {
      rows = [["Descrição", "Valor", "Vencimento", "Status", "Mês Ref", "Pago em"]];
      filteredReceivables.forEach(r => {
        rows.push([r.description, formatCurrency(r.amount), r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(r.status), r.reference_month, r.paid_at ? format(new Date(r.paid_at), "dd/MM/yyyy") : ""]);
      });
    } else if (activeTab === "payables") {
      rows = [["Descrição", "Valor", "Vencimento", "Status", "Mês Ref", "Pago em"]];
      filteredPayables.forEach(p => {
        rows.push([p.description, formatCurrency(p.amount), p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(p.status), p.reference_month, p.paid_at ? format(new Date(p.paid_at), "dd/MM/yyyy") : ""]);
      });
    } else {
      rows = [["Empresa", "Descrição", "Valor", "Recorrência", "Status", "Próximo Vencimento", "Criado em"]];
      filteredCharges.forEach(ch => {
        rows.push([ch.company_name || "", ch.description, formatCurrencyCents(ch.amount_cents), recurrenceLabel(ch.recurrence), ch.is_active ? "Ativa" : "Inativa", ch.next_billing_date ? format(new Date(ch.next_billing_date), "dd/MM/yyyy") : "", ch.created_at ? format(new Date(ch.created_at), "dd/MM/yyyy") : ""]);
      });
    }
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Financial months for filter
  const financialMonths = useMemo(() => {
    const set = new Set<string>();
    receivables.forEach(r => { if (r.reference_month) set.add(r.reference_month); });
    payables.forEach(p => { if (p.reference_month) set.add(p.reference_month); });
    charges.forEach(ch => {
      if (ch.created_at) set.add(ch.created_at.substring(0, 7));
      if (ch.next_billing_date) set.add(ch.next_billing_date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [receivables, payables, charges]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate("/onboarding-tasks/staff")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Nexus
          </Button>
        </div>
      </div>
    );
  }

  const totalActiveCharges = filteredCharges.filter(c => c.is_active).length;
  const totalMRR = filteredCharges
    .filter(c => c.is_active)
    .reduce((sum, c) => {
      const val = c.amount_cents || 0;
      if (c.recurrence === "monthly") return sum + val;
      if (c.recurrence === "quarterly") return sum + val / 3;
      if (c.recurrence === "semiannual") return sum + val / 6;
      if (c.recurrence === "annual") return sum + val / 12;
      return sum + val;
    }, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks/staff")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nexus
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Financeiro
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetFilters(); }}>
          <TabsList>
            {isAdmin && (
              <TabsTrigger value="receivables" className="gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                Contas a Receber
              </TabsTrigger>
            )}
            {isMaster && (
              <TabsTrigger value="payables" className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Contas a Pagar
              </TabsTrigger>
            )}
            <TabsTrigger value="recurring" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recorrências
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {activeTab === "recurring" && (
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {activeTab === "recurring" ? (
                      <>
                        <SelectItem value="active">Ativas</SelectItem>
                        <SelectItem value="inactive">Inativas</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>

                {activeTab === "recurring" && (
                  <Select value={selectedRecurrence} onValueChange={setSelectedRecurrence}>
                    <SelectTrigger>
                      <SelectValue placeholder="Recorrência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannual">Semestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {financialMonths.map(m => (
                      <SelectItem key={m} value={m}>
                        {format(new Date(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contas a Receber */}
          {isAdmin && (
            <TabsContent value="receivables" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total a Receber</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(filteredReceivables.filter(r => r.status !== "paid").reduce((s, r) => s + r.amount, 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">{filteredReceivables.filter(r => r.status !== "paid").length} pendentes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(filteredReceivables.filter(r => r.status === "paid").reduce((s, r) => s + (r.paid_amount || r.amount), 0))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(filteredReceivables.filter(r => r.status === "overdue").reduce((s, r) => s + r.amount, 0))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Mês Ref</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pago em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReceivables.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                          </TableRow>
                        ) : filteredReceivables.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium max-w-[250px] truncate">{r.description}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
                            <TableCell>{r.due_date ? format(new Date(r.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell>{r.reference_month}</TableCell>
                            <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.paid_at ? format(new Date(r.paid_at), "dd/MM/yyyy") : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Contas a Pagar - Master only */}
          {isMaster && (
            <TabsContent value="payables" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total a Pagar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(filteredPayables.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">{filteredPayables.filter(p => p.status !== "paid").length} pendentes</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(filteredPayables.filter(p => p.status === "paid").reduce((s, p) => s + (p.paid_amount || p.amount), 0))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(filteredPayables.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Mês Ref</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pago em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayables.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
                          </TableRow>
                        ) : filteredPayables.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium max-w-[250px] truncate">{p.description}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell>{p.reference_month}</TableCell>
                            <TableCell><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "dd/MM/yyyy") : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Recorrências */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Filtrado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredCharges.length}</div>
                  <p className="text-xs text-muted-foreground">{totalActiveCharges} ativas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">MRR Filtrado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{formatCurrencyCents(totalMRR)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Empresas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(filteredCharges.map(c => c.company_id)).size}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Recorrência</TableHead>
                        <TableHead>Próx. Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCharges.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma recorrência encontrada</TableCell>
                        </TableRow>
                      ) : filteredCharges.map(ch => (
                        <TableRow key={ch.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">{ch.company_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{ch.description}</TableCell>
                          <TableCell className="text-sm">
                            <div className="truncate max-w-[150px]">{ch.customer_name || "-"}</div>
                            {ch.customer_email && (
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">{ch.customer_email}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrencyCents(ch.amount_cents)}</TableCell>
                          <TableCell>{recurrenceLabel(ch.recurrence)}</TableCell>
                          <TableCell>{ch.next_billing_date ? format(new Date(ch.next_billing_date), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={ch.is_active ? "default" : "secondary"}>{ch.is_active ? "Ativa" : "Inativa"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ch.created_at ? format(new Date(ch.created_at), "dd/MM/yyyy") : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

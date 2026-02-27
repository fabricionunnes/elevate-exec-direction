import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ALLOWED_EMAIL = "fabricio@universidadevendas.com.br";

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

export default function AllRecurringChargesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

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
      if (user.email === ALLOWED_EMAIL) {
        setHasAccess(true);
        await loadData();
      } else {
        setHasAccess(false);
        toast.error("Acesso negado.");
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
      const [chargesRes, companiesRes] = await Promise.all([
        supabase
          .from("company_recurring_charges")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("onboarding_companies")
          .select("id, name")
          .order("name"),
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
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar recorrências");
    }
  };

  const months = useMemo(() => {
    const set = new Set<string>();
    charges.forEach(ch => {
      if (ch.created_at) set.add(ch.created_at.substring(0, 7));
      if (ch.next_billing_date) set.add(ch.next_billing_date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [charges]);

  const filtered = useMemo(() => {
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

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const recurrenceLabel = (r: string) => {
    const map: Record<string, string> = {
      monthly: "Mensal",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual",
      weekly: "Semanal",
    };
    return map[r] || r;
  };

  const totalActive = filtered.filter(c => c.is_active).length;
  const totalMRR = filtered
    .filter(c => c.is_active)
    .reduce((sum, c) => {
      const val = c.amount_cents || 0;
      if (c.recurrence === "monthly") return sum + val;
      if (c.recurrence === "quarterly") return sum + val / 3;
      if (c.recurrence === "semiannual") return sum + val / 6;
      if (c.recurrence === "annual") return sum + val / 12;
      return sum + val;
    }, 0);

  const exportCSV = () => {
    const rows = [["Empresa", "Descrição", "Valor", "Recorrência", "Status", "Próximo Vencimento", "Criado em"]];
    filtered.forEach(ch => {
      rows.push([
        ch.company_name || "",
        ch.description || "",
        formatCurrency(ch.amount_cents),
        recurrenceLabel(ch.recurrence),
        ch.is_active ? "Ativa" : "Inativa",
        ch.next_billing_date ? format(new Date(ch.next_billing_date), "dd/MM/yyyy") : "",
        ch.created_at ? format(new Date(ch.created_at), "dd/MM/yyyy") : "",
      ]);
    });
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recorrencias.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate("/onboarding-tasks/financeiro")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Financeiro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks/financeiro")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Financeiro
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Todas as Recorrências
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Filtrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filtered.length}</div>
              <p className="text-xs text-muted-foreground">{totalActive} ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">MRR Filtrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalMRR)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Empresas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(filtered.map(c => c.company_id)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
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

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>

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

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map(m => (
                    <SelectItem key={m} value={m}>
                      {format(new Date(m + "-01"), "MMMM yyyy", { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
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
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma recorrência encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(ch => (
                      <TableRow key={ch.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {ch.company_name}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{ch.description}</TableCell>
                        <TableCell className="text-sm">
                          <div className="truncate max-w-[150px]">{ch.customer_name || "-"}</div>
                          {ch.customer_email && (
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {ch.customer_email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(ch.amount_cents)}
                        </TableCell>
                        <TableCell>{recurrenceLabel(ch.recurrence)}</TableCell>
                        <TableCell>
                          {ch.next_billing_date
                            ? format(new Date(ch.next_billing_date), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ch.is_active ? "default" : "secondary"}>
                            {ch.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ch.created_at ? format(new Date(ch.created_at), "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

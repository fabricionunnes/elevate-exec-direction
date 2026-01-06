import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, differenceInDays, addMonths, parseISO, startOfMonth, endOfMonth, isBefore, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Search,
  Filter,
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  status: string;
  segment: string | null;
}

interface Renewal {
  id: string;
  company_id: string;
  previous_end_date: string | null;
  new_end_date: string;
  previous_value: number | null;
  new_value: number;
  previous_term_months: number | null;
  new_term_months: number | null;
  renewal_date: string;
  notes: string | null;
  created_by: string | null;
  staff_name?: string;
}

export default function OnboardingRenewalsPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [includePending, setIncludePending] = useState(true);
  
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyRenewals, setCompanyRenewals] = useState<Renewal[]>([]);
  
  const [renewForm, setRenewForm] = useState({
    newValue: "",
    termMonths: "12",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/onboarding-login");
      return;
    }

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staff) {
      navigate("/onboarding-login");
      return;
    }

    // Only admins can access this page
    if (staff.role !== "admin") {
      toast.error("Acesso restrito a administradores");
      navigate("/onboarding-tasks");
      return;
    }

    setStaffId(staff.id);
    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch companies with contract info
    const { data: companiesData, error: companiesError } = await supabase
      .from("onboarding_companies")
      .select("id, name, contract_value, contract_start_date, contract_end_date, status, segment")
      .order("contract_end_date", { ascending: true, nullsFirst: false });

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      toast.error("Erro ao carregar empresas");
    } else {
      setCompanies(companiesData || []);
    }

    // Fetch all renewals with staff names
    const { data: renewalsData, error: renewalsError } = await supabase
      .from("onboarding_contract_renewals")
      .select(`
        *,
        staff:created_by(name)
      `)
      .order("renewal_date", { ascending: false });

    if (renewalsError) {
      console.error("Error fetching renewals:", renewalsError);
    } else {
      const formattedRenewals = (renewalsData || []).map((r: any) => ({
        ...r,
        staff_name: r.staff?.name || "Sistema",
      }));
      setRenewals(formattedRenewals);
    }

    setLoading(false);
  };

  const getContractStatus = (endDate: string | null) => {
    if (!endDate) return { label: "Sem data", color: "secondary" as const, priority: 3 };
    
    const daysUntilEnd = differenceInDays(parseISO(endDate), new Date());
    
    if (daysUntilEnd < 0) {
      return { label: "Vencido", color: "destructive" as const, priority: 0 };
    } else if (daysUntilEnd <= 30) {
      return { label: "Vence em breve", color: "destructive" as const, priority: 1 };
    } else if (daysUntilEnd <= 60) {
      return { label: "Atenção", color: "outline" as const, priority: 2 };
    }
    return { label: "Ativo", color: "default" as const, priority: 4 };
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openRenewDialog = (company: Company) => {
    setSelectedCompany(company);
    setRenewForm({
      newValue: company.contract_value?.toString() || "",
      termMonths: "12",
      notes: "",
    });
    setRenewDialogOpen(true);
  };

  const openHistoryDialog = async (company: Company) => {
    setSelectedCompany(company);
    const companyHistory = renewals.filter(r => r.company_id === company.id);
    setCompanyRenewals(companyHistory);
    setHistoryDialogOpen(true);
  };

  const handleRenew = async () => {
    if (!selectedCompany || !staffId) return;
    
    const newValue = parseFloat(renewForm.newValue);
    if (isNaN(newValue) || newValue <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const termMonths = parseInt(renewForm.termMonths);
    if (isNaN(termMonths) || termMonths <= 0) {
      toast.error("Informe um prazo válido");
      return;
    }

    setSaving(true);

    try {
      // Calculate new end date
      const currentEndDate = selectedCompany.contract_end_date 
        ? parseISO(selectedCompany.contract_end_date)
        : new Date();
      const newEndDate = addMonths(currentEndDate > new Date() ? currentEndDate : new Date(), termMonths);

      // Insert renewal record
      const { error: renewalError } = await supabase
        .from("onboarding_contract_renewals")
        .insert({
          company_id: selectedCompany.id,
          previous_end_date: selectedCompany.contract_end_date,
          new_end_date: format(newEndDate, "yyyy-MM-dd"),
          previous_value: selectedCompany.contract_value,
          new_value: newValue,
          new_term_months: termMonths,
          notes: renewForm.notes || null,
          created_by: staffId,
        });

      if (renewalError) throw renewalError;

      // Update company contract info
      const { error: companyError } = await supabase
        .from("onboarding_companies")
        .update({
          contract_end_date: format(newEndDate, "yyyy-MM-dd"),
          contract_value: newValue,
        })
        .eq("id", selectedCompany.id);

      if (companyError) throw companyError;

      toast.success("Contrato renovado com sucesso!");
      setRenewDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error renewing contract:", error);
      toast.error("Erro ao renovar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContract = async (companyId: string, field: string, value: any) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ [field]: value })
        .eq("id", companyId);

      if (error) throw error;
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, [field]: value } : c
      ));
      toast.success("Contrato atualizado");
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    }
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Month filter logic
    let matchesMonth = true;
    if (company.contract_end_date) {
      const endDate = parseISO(company.contract_end_date);
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      
      // Check if contract ends in selected month
      const endsInSelectedMonth = isWithinInterval(endDate, { start: monthStart, end: monthEnd });
      
      // Check if it's a pending renewal from previous months (expired before selected month)
      const isPendingFromPast = includePending && isBefore(endDate, monthStart);
      
      matchesMonth = endsInSelectedMonth || isPendingFromPast;
    } else {
      // Companies without end date - show only if includePending is true
      matchesMonth = includePending;
    }
    
    if (!matchesMonth) return false;
    
    // Status filter
    if (filterStatus === "all") return matchesSearch;
    
    const status = getContractStatus(company.contract_end_date);
    if (filterStatus === "expired") return matchesSearch && status.label === "Vencido";
    if (filterStatus === "soon") return matchesSearch && (status.label === "Vence em breve" || status.label === "Atenção");
    if (filterStatus === "active") return matchesSearch && status.label === "Ativo";
    if (filterStatus === "no_date") return matchesSearch && status.label === "Sem data";
    
    return matchesSearch;
  }).sort((a, b) => {
    const statusA = getContractStatus(a.contract_end_date);
    const statusB = getContractStatus(b.contract_end_date);
    return statusA.priority - statusB.priority;
  });

  // Count pending from previous months
  const pendingFromPastCount = companies.filter(c => {
    if (!c.contract_end_date) return false;
    const endDate = parseISO(c.contract_end_date);
    return isBefore(endDate, startOfMonth(selectedMonth));
  }).length;

  // Stats based on filtered companies
  const stats = {
    total: filteredCompanies.length,
    expired: filteredCompanies.filter(c => getContractStatus(c.contract_end_date).label === "Vencido").length,
    soon: filteredCompanies.filter(c => ["Vence em breve", "Atenção"].includes(getContractStatus(c.contract_end_date).label)).length,
    active: filteredCompanies.filter(c => getContractStatus(c.contract_end_date).label === "Ativo").length,
    totalValue: filteredCompanies.reduce((sum, c) => sum + (c.contract_value || 0), 0),
    pendingFromPast: pendingFromPastCount,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gestão de Renovações</h1>
                <p className="text-muted-foreground">Controle de contratos e renovações</p>
              </div>
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold text-destructive">{stats.expired}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Vencendo</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.soon}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold text-green-500">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Month Picker */}
                <MonthYearPicker 
                  value={selectedMonth} 
                  onChange={(range) => setSelectedMonth(range.start)} 
                />
                
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="expired">Vencidos</SelectItem>
                      <SelectItem value="soon">Vencendo em breve</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="no_date">Sem data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Include pending toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includePending"
                  checked={includePending}
                  onChange={(e) => setIncludePending(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="includePending" className="text-sm text-muted-foreground cursor-pointer">
                  Incluir pendências de meses anteriores
                  {stats.pendingFromPast > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {stats.pendingFromPast} pendentes
                    </Badge>
                  )}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos ({filteredCompanies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Valor do Contrato</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Término</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => {
                    const status = getContractStatus(company.contract_end_date);
                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.segment || "-"}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Input
                              type="number"
                              value={company.contract_value || ""}
                              onChange={(e) => handleUpdateContract(
                                company.id,
                                "contract_value",
                                e.target.value ? parseFloat(e.target.value) : null
                              )}
                              className="w-32 h-8"
                              placeholder="Valor"
                            />
                          ) : (
                            formatCurrency(company.contract_value)
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Input
                              type="date"
                              value={company.contract_start_date || ""}
                              onChange={(e) => handleUpdateContract(
                                company.id,
                                "contract_start_date",
                                e.target.value || null
                              )}
                              className="w-36 h-8"
                            />
                          ) : (
                            company.contract_start_date
                              ? format(parseISO(company.contract_start_date), "dd/MM/yyyy")
                              : "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Input
                              type="date"
                              value={company.contract_end_date || ""}
                              onChange={(e) => handleUpdateContract(
                                company.id,
                                "contract_end_date",
                                e.target.value || null
                              )}
                              className="w-36 h-8"
                            />
                          ) : (
                            company.contract_end_date
                              ? format(parseISO(company.contract_end_date), "dd/MM/yyyy")
                              : "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openHistoryDialog(company)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openRenewDialog(company)}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Renovar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCompanies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Renew Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar Contrato</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Valor atual</p>
                <p className="font-medium">{formatCurrency(selectedCompany?.contract_value || null)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Término atual</p>
                <p className="font-medium">
                  {selectedCompany?.contract_end_date
                    ? format(parseISO(selectedCompany.contract_end_date), "dd/MM/yyyy")
                    : "Não definido"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Novo Valor do Contrato (R$)</Label>
              <Input
                type="number"
                value={renewForm.newValue}
                onChange={(e) => setRenewForm({ ...renewForm, newValue: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo da Renovação</Label>
              <Select
                value={renewForm.termMonths}
                onValueChange={(v) => setRenewForm({ ...renewForm, termMonths: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={renewForm.notes}
                onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                placeholder="Anotações sobre a renovação..."
              />
            </div>

            {selectedCompany && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nova data de término:</p>
                <p className="font-medium">
                  {format(
                    addMonths(
                      selectedCompany.contract_end_date && parseISO(selectedCompany.contract_end_date) > new Date()
                        ? parseISO(selectedCompany.contract_end_date)
                        : new Date(),
                      parseInt(renewForm.termMonths) || 12
                    ),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenew} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar Renovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Renovações</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {companyRenewals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma renovação registrada
              </div>
            ) : (
              <div className="space-y-4">
                {companyRenewals.map((renewal) => (
                  <Card key={renewal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            Renovação em {format(parseISO(renewal.renewal_date), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                          <p className="text-sm text-muted-foreground">por {renewal.staff_name}</p>
                        </div>
                        <Badge variant="secondary">
                          +{renewal.new_term_months || "?"} meses
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Valor anterior</p>
                          <p>{formatCurrency(renewal.previous_value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Novo valor</p>
                          <p className="font-medium">{formatCurrency(renewal.new_value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Término anterior</p>
                          <p>
                            {renewal.previous_end_date
                              ? format(parseISO(renewal.previous_end_date), "dd/MM/yyyy")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Novo término</p>
                          <p className="font-medium">
                            {format(parseISO(renewal.new_end_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      {renewal.notes && (
                        <div className="mt-3 p-2 bg-muted rounded text-sm">
                          {renewal.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

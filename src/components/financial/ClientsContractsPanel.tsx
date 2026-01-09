import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, FileText, Loader2, RefreshCw, Plus, TrendingUp, Building2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NexusCompany {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  payment_method: string | null;
  created_at: string;
  projects?: NexusProject[];
}

interface NexusProject {
  id: string;
  product_name: string;
  status: string;
  created_at: string;
}

interface FinancialContract {
  id: string;
  contract_name: string;
  company_id: string | null;
  project_id: string | null;
  contract_value: number;
  billing_cycle: string;
  start_date: string;
  end_date: string | null;
  status: string;
  payment_day: number | null;
  payment_method: string | null;
  company?: { name: string } | null;
}

export function ClientsContractsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("nexus");
  const [nexusCompanies, setNexusCompanies] = useState<NexusCompany[]>([]);
  const [financialContracts, setFinancialContracts] = useState<FinancialContract[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<NexusCompany | null>(null);
  
  // Form state for new contract
  const [contractForm, setContractForm] = useState({
    company_id: "",
    contract_name: "",
    contract_value: "",
    billing_cycle: "monthly",
    start_date: format(new Date(), "yyyy-MM-dd"),
    payment_day: "10"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load Nexus companies with projects
      const { data: companiesData, error: companiesError } = await supabase
        .from("onboarding_companies")
        .select(`
          id,
          name,
          segment,
          status,
          contract_value,
          contract_start_date,
          contract_end_date,
          payment_method,
          created_at
        `)
        .order("name");

      if (companiesError) throw companiesError;

      // Load projects for each company
      const { data: projectsData } = await supabase
        .from("onboarding_projects")
        .select("id, product_name, status, created_at, onboarding_company_id, company_id");

      // Group projects by company
      const companiesWithProjects = (companiesData || []).map(company => {
        const companyProjects = (projectsData || []).filter(
          p => p.onboarding_company_id === company.id || p.company_id === company.id
        );
        return { ...company, projects: companyProjects };
      });

      setNexusCompanies(companiesWithProjects);

      // Load financial contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from("financial_contracts")
        .select(`*, company:company_id(name)`)
        .order("created_at", { ascending: false });

      if (contractsError) throw contractsError;
      setFinancialContracts(contractsData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const syncNexusToFinancial = async () => {
    setIsSyncing(true);
    let created = 0;
    let updated = 0;

    try {
      // Get active companies with contract values
      const activeCompanies = nexusCompanies.filter(
        c => c.status === "active" && c.contract_value && c.contract_value > 0
      );

      for (const company of activeCompanies) {
        // Check if contract already exists
        const existingContract = financialContracts.find(
          fc => fc.company_id === company.id
        );

        if (existingContract) {
          // Update existing contract
          const { error } = await supabase
            .from("financial_contracts")
            .update({
              contract_value: company.contract_value,
              status: company.status === "active" ? "active" : "inactive",
              start_date: company.contract_start_date || existingContract.start_date,
              end_date: company.contract_end_date
            })
            .eq("id", existingContract.id);

          if (!error) updated++;
        } else {
          // Create new contract
          const { error } = await supabase
            .from("financial_contracts")
            .insert({
              company_id: company.id,
              contract_name: `Contrato ${company.name}`,
              contract_value: company.contract_value,
              billing_cycle: "monthly",
              start_date: company.contract_start_date || format(new Date(), "yyyy-MM-dd"),
              end_date: company.contract_end_date,
              status: "active",
              payment_day: 10,
              payment_method: company.payment_method || "boleto"
            });

          if (!error) created++;
        }
      }

      toast.success(`Sincronização concluída: ${created} criados, ${updated} atualizados`);
      loadData();
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Erro ao sincronizar dados");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateContract = async () => {
    try {
      const { error } = await supabase.from("financial_contracts").insert({
        company_id: contractForm.company_id || null,
        contract_name: contractForm.contract_name,
        contract_value: parseFloat(contractForm.contract_value),
        billing_cycle: contractForm.billing_cycle,
        start_date: contractForm.start_date,
        payment_day: parseInt(contractForm.payment_day),
        status: "active"
      });

      if (error) throw error;

      toast.success("Contrato criado com sucesso!");
      setIsCreateDialogOpen(false);
      setContractForm({
        company_id: "",
        contract_name: "",
        contract_value: "",
        billing_cycle: "monthly",
        start_date: format(new Date(), "yyyy-MM-dd"),
        payment_day: "10"
      });
      loadData();
    } catch (error) {
      console.error("Error creating contract:", error);
      toast.error("Erro ao criar contrato");
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Calculate totals
  const totalMRR = financialContracts
    .filter(c => c.status === "active")
    .reduce((sum, c) => {
      const value = Number(c.contract_value) || 0;
      if (c.billing_cycle === "monthly") return sum + value;
      if (c.billing_cycle === "quarterly") return sum + value / 3;
      if (c.billing_cycle === "semiannual") return sum + value / 6;
      if (c.billing_cycle === "annual") return sum + value / 12;
      return sum;
    }, 0);

  const totalNexusMRR = nexusCompanies
    .filter(c => c.status === "active")
    .reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0);

  const activeNexusCount = nexusCompanies.filter(c => c.status === "active").length;
  const activeContractsCount = financialContracts.filter(c => c.status === "active").length;

  // Filter companies/contracts
  const filteredNexusCompanies = nexusCompanies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredContracts = financialContracts.filter(c => {
    const matchesSearch = 
      c.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes & Contratos</h2>
          <p className="text-muted-foreground">Visualize clientes do Nexus e gerencie contratos financeiros</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncNexusToFinancial}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Sincronizar do Nexus
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Contrato Financeiro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Cliente (opcional)</Label>
                  <Select
                    value={contractForm.company_id}
                    onValueChange={(v) => setContractForm({ ...contractForm, company_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nexusCompanies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Contrato *</Label>
                  <Input
                    value={contractForm.contract_name}
                    onChange={(e) => setContractForm({ ...contractForm, contract_name: e.target.value })}
                    placeholder="Ex: Consultoria mensal - Empresa X"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={contractForm.contract_value}
                      onChange={(e) => setContractForm({ ...contractForm, contract_value: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciclo de Cobrança</Label>
                    <Select
                      value={contractForm.billing_cycle}
                      onValueChange={(v) => setContractForm({ ...contractForm, billing_cycle: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input
                      type="date"
                      value={contractForm.start_date}
                      onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia de Vencimento</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={contractForm.payment_day}
                      onChange={(e) => setContractForm({ ...contractForm, payment_day: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateContract}
                    disabled={!contractForm.contract_name || !contractForm.contract_value}
                  >
                    Criar Contrato
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Nexus Ativos</p>
                <p className="text-2xl font-bold">{activeNexusCount}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR (Nexus)</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalNexusMRR)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Financeiros</p>
                <p className="text-2xl font-bold">{activeContractsCount}</p>
              </div>
              <FileText className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR (Financeiro)</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalMRR)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Difference Alert */}
      {activeNexusCount !== activeContractsCount && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700">Diferença detectada</p>
                <p className="text-sm text-muted-foreground">
                  Existem {activeNexusCount} clientes ativos no Nexus, mas apenas {activeContractsCount} contratos financeiros. 
                  Clique em "Sincronizar do Nexus" para criar os contratos faltantes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar clientes ou contratos..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10" 
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Nexus Clients vs Financial Contracts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="nexus">
            <Building2 className="h-4 w-4 mr-2" />
            Clientes Nexus ({nexusCompanies.length})
          </TabsTrigger>
          <TabsTrigger value="contracts">
            <FileText className="h-4 w-4 mr-2" />
            Contratos Financeiros ({financialContracts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nexus" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Projetos</TableHead>
                    <TableHead>Valor Contrato</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNexusCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : filteredNexusCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.segment || "-"}</TableCell>
                      <TableCell>
                        {company.projects && company.projects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {company.projects.slice(0, 2).map(p => (
                              <Badge key={p.id} variant="outline" className="text-xs">
                                {p.product_name}
                              </Badge>
                            ))}
                            {company.projects.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{company.projects.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {company.contract_value ? formatCurrency(company.contract_value) : "-"}
                      </TableCell>
                      <TableCell>
                        {company.contract_start_date 
                          ? format(parseISO(company.contract_start_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === "active" ? "default" : "secondary"}>
                          {company.status === "active" ? "Ativo" : 
                           company.status === "churned" ? "Churned" : 
                           company.status === "inactive" ? "Inativo" : company.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  ) : filteredContracts.map((contract) => {
                    const monthlyValue = contract.billing_cycle === "monthly" ? contract.contract_value :
                      contract.billing_cycle === "quarterly" ? contract.contract_value / 3 :
                      contract.billing_cycle === "semiannual" ? contract.contract_value / 6 :
                      contract.billing_cycle === "annual" ? contract.contract_value / 12 : contract.contract_value;

                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.contract_name}</TableCell>
                        <TableCell>{contract.company?.name || "-"}</TableCell>
                        <TableCell>{formatCurrency(contract.contract_value)}</TableCell>
                        <TableCell>
                          {contract.billing_cycle === "monthly" ? "Mensal" :
                           contract.billing_cycle === "quarterly" ? "Trimestral" :
                           contract.billing_cycle === "semiannual" ? "Semestral" :
                           contract.billing_cycle === "annual" ? "Anual" : contract.billing_cycle}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-medium">
                          {formatCurrency(monthlyValue)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                            {contract.status === "active" ? "Ativo" : contract.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

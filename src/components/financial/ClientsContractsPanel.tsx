import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, FileText, Loader2, RefreshCw, Plus, TrendingUp, Edit, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FinancialContract {
  id: string;
  contract_name: string;
  contract_value: number;
  billing_cycle: string;
  start_date: string;
  end_date: string | null;
  status: string;
  payment_day: number | null;
  payment_method: string | null;
  notes: string | null;
}

export function ClientsContractsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [contracts, setContracts] = useState<FinancialContract[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<FinancialContract | null>(null);
  
  const [contractForm, setContractForm] = useState({
    contract_name: "",
    contract_value: "",
    billing_cycle: "monthly",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    payment_day: "10",
    payment_method: "boleto",
    notes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("financial_contracts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error loading contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setContractForm({
      contract_name: "",
      contract_value: "",
      billing_cycle: "monthly",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      payment_day: "10",
      payment_method: "boleto",
      notes: ""
    });
  };

  const handleCreateContract = async () => {
    try {
      const { error } = await supabase.from("financial_contracts").insert({
        contract_name: contractForm.contract_name,
        contract_value: parseFloat(contractForm.contract_value),
        billing_cycle: contractForm.billing_cycle,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || null,
        payment_day: parseInt(contractForm.payment_day),
        payment_method: contractForm.payment_method,
        notes: contractForm.notes || null,
        status: "active"
      });

      if (error) throw error;

      toast.success("Contrato criado com sucesso!");
      setIsCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error creating contract:", error);
      toast.error("Erro ao criar contrato");
    }
  };

  const handleEditContract = async () => {
    if (!editingContract) return;
    
    try {
      const { error } = await supabase
        .from("financial_contracts")
        .update({
          contract_name: contractForm.contract_name,
          contract_value: parseFloat(contractForm.contract_value),
          billing_cycle: contractForm.billing_cycle,
          start_date: contractForm.start_date,
          end_date: contractForm.end_date || null,
          payment_day: parseInt(contractForm.payment_day),
          payment_method: contractForm.payment_method,
          notes: contractForm.notes || null
        })
        .eq("id", editingContract.id);

      if (error) throw error;

      toast.success("Contrato atualizado!");
      setIsEditDialogOpen(false);
      setEditingContract(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      const { error } = await supabase
        .from("financial_contracts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Contrato excluído!");
      setDeleteConfirmId(null);
      loadData();
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Erro ao excluir contrato");
    }
  };

  const toggleContractStatus = async (contract: FinancialContract) => {
    try {
      const newStatus = contract.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("financial_contracts")
        .update({ status: newStatus })
        .eq("id", contract.id);

      if (error) throw error;

      toast.success(`Contrato ${newStatus === "active" ? "ativado" : "desativado"}!`);
      loadData();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openEditDialog = (contract: FinancialContract) => {
    setEditingContract(contract);
    setContractForm({
      contract_name: contract.contract_name,
      contract_value: contract.contract_value.toString(),
      billing_cycle: contract.billing_cycle || "monthly",
      start_date: contract.start_date,
      end_date: contract.end_date || "",
      payment_day: (contract.payment_day || 10).toString(),
      payment_method: contract.payment_method || "boleto",
      notes: contract.notes || ""
    });
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getBillingCycleLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      monthly: "Mensal",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual"
    };
    return labels[cycle] || cycle;
  };

  // Calculate MRR
  const totalMRR = contracts
    .filter(c => c.status === "active")
    .reduce((sum, c) => {
      const value = Number(c.contract_value) || 0;
      if (c.billing_cycle === "monthly") return sum + value;
      if (c.billing_cycle === "quarterly") return sum + value / 3;
      if (c.billing_cycle === "semiannual") return sum + value / 6;
      if (c.billing_cycle === "annual") return sum + value / 12;
      return sum;
    }, 0);

  const activeContractsCount = contracts.filter(c => c.status === "active").length;

  // Filter contracts
  const filteredContracts = contracts.filter(c => {
    const matchesSearch = c.contract_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const ContractFormFields = () => (
    <div className="space-y-4 py-4">
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
          <Label>Data de Término (opcional)</Label>
          <Input
            type="date"
            value={contractForm.end_date}
            onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label>Forma de Pagamento</Label>
          <Select
            value={contractForm.payment_method}
            onValueChange={(v) => setContractForm({ ...contractForm, payment_method: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={contractForm.notes}
          onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
          placeholder="Observações sobre o contrato..."
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contratos</h2>
          <p className="text-muted-foreground">Gerencie contratos e clientes (integração Conta Azul em breve)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Contrato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Contrato</DialogTitle>
              </DialogHeader>
              <ContractFormFields />
              <div className="flex justify-end gap-2">
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
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Ativos</p>
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
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalMRR)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ARR</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalMRR * 12)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar contratos..." 
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contratos ({filteredContracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum contrato encontrado</p>
              <p className="text-sm mt-1">Crie contratos manualmente ou aguarde a integração com Conta Azul</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.contract_name}</TableCell>
                    <TableCell className="font-semibold text-emerald-600">
                      {formatCurrency(contract.contract_value)}
                    </TableCell>
                    <TableCell>{getBillingCycleLabel(contract.billing_cycle)}</TableCell>
                    <TableCell>Dia {contract.payment_day || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(contract.start_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={contract.status === "active" ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleContractStatus(contract)}
                      >
                        {contract.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(contract)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(contract.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contrato</DialogTitle>
          </DialogHeader>
          <ContractFormFields />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditContract}
              disabled={!contractForm.contract_name || !contractForm.contract_value}
            >
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contrato será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDeleteContract(deleteConfirmId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

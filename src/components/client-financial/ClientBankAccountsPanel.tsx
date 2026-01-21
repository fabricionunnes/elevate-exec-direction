import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Building2, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankAccount {
  id: string;
  project_id: string;
  name: string;
  bank_name?: string;
  account_type: string;
  agency?: string;
  account_number?: string;
  initial_balance: number;
  current_balance: number;
  color: string;
  is_active: boolean;
  is_default: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  reference_type?: string;
  transaction_date: string;
  created_at: string;
}

interface Props {
  projectId: string;
  canEdit: boolean;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "cash", label: "Caixa" },
  { value: "digital", label: "Conta Digital" },
];

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const initialFormData = {
  name: "",
  bank_name: "",
  account_type: "checking",
  agency: "",
  account_number: "",
  initial_balance: 0,
  color: "#3b82f6",
  is_active: true,
  is_default: false,
  notes: "",
};

export function ClientBankAccountsPanel({ projectId, canEdit }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [activeTab, setActiveTab] = useState("accounts");

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [accountsRes, transactionsRes] = await Promise.all([
        supabase
          .from("client_financial_bank_accounts")
          .select("*")
          .eq("project_id", projectId)
          .order("is_default", { ascending: false })
          .order("name"),
        supabase
          .from("client_financial_bank_transactions")
          .select("*")
          .eq("project_id", projectId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      setAccounts(accountsRes.data || []);
      setTransactions(transactionsRes.data || []);
    } catch (error) {
      console.error("Error loading bank accounts:", error);
      toast.error("Erro ao carregar contas bancárias");
    } finally {
      setIsLoading(false);
    }
  };

  const openNew = () => {
    setSelectedAccount(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEdit = (account: BankAccount) => {
    setSelectedAccount(account);
    setFormData({
      name: account.name,
      bank_name: account.bank_name || "",
      account_type: account.account_type,
      agency: account.agency || "",
      account_number: account.account_number || "",
      initial_balance: account.initial_balance,
      color: account.color,
      is_active: account.is_active,
      is_default: account.is_default,
      notes: account.notes || "",
    });
    setDialogOpen(true);
  };

  const openDelete = (account: BankAccount) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  const openAdjust = (account: BankAccount) => {
    setSelectedAccount(account);
    setAdjustmentAmount(0);
    setAdjustmentDescription("");
    setAdjustDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da conta é obrigatório");
      return;
    }

    try {
      if (selectedAccount) {
        // Update existing
        const { error } = await supabase
          .from("client_financial_bank_accounts")
          .update({
            name: formData.name,
            bank_name: formData.bank_name || null,
            account_type: formData.account_type,
            agency: formData.agency || null,
            account_number: formData.account_number || null,
            color: formData.color,
            is_active: formData.is_active,
            is_default: formData.is_default,
            notes: formData.notes || null,
          })
          .eq("id", selectedAccount.id);

        if (error) throw error;

        // If setting as default, unset others
        if (formData.is_default) {
          await supabase
            .from("client_financial_bank_accounts")
            .update({ is_default: false })
            .eq("project_id", projectId)
            .neq("id", selectedAccount.id);
        }

        toast.success("Conta atualizada com sucesso!");
      } else {
        // Create new
        const { data: newAccount, error } = await supabase
          .from("client_financial_bank_accounts")
          .insert({
            project_id: projectId,
            name: formData.name,
            bank_name: formData.bank_name || null,
            account_type: formData.account_type,
            agency: formData.agency || null,
            account_number: formData.account_number || null,
            initial_balance: formData.initial_balance,
            current_balance: formData.initial_balance,
            color: formData.color,
            is_active: formData.is_active,
            is_default: formData.is_default,
            notes: formData.notes || null,
          })
          .select()
          .single();

        if (error) throw error;

        // If setting as default, unset others
        if (formData.is_default && newAccount) {
          await supabase
            .from("client_financial_bank_accounts")
            .update({ is_default: false })
            .eq("project_id", projectId)
            .neq("id", newAccount.id);
        }

        // Create initial balance transaction if balance > 0
        if (formData.initial_balance !== 0 && newAccount) {
          await supabase.from("client_financial_bank_transactions").insert({
            project_id: projectId,
            bank_account_id: newAccount.id,
            transaction_type: "adjustment",
            amount: formData.initial_balance,
            balance_before: 0,
            balance_after: formData.initial_balance,
            description: "Saldo inicial",
            reference_type: "manual",
            transaction_date: new Date().toISOString().split("T")[0],
          });
        }

        toast.success("Conta criada com sucesso!");
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving account:", error);
      toast.error(error.message || "Erro ao salvar conta");
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;

    try {
      const { error } = await supabase
        .from("client_financial_bank_accounts")
        .delete()
        .eq("id", selectedAccount.id);

      if (error) throw error;

      toast.success("Conta excluída com sucesso!");
      setDeleteDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Erro ao excluir conta");
    }
  };

  const handleAdjustment = async () => {
    if (!selectedAccount || adjustmentAmount === 0) {
      toast.error("Informe o valor do ajuste");
      return;
    }

    try {
      const newBalance = selectedAccount.current_balance + adjustmentAmount;

      // Update balance
      const { error: updateError } = await supabase
        .from("client_financial_bank_accounts")
        .update({ current_balance: newBalance })
        .eq("id", selectedAccount.id);

      if (updateError) throw updateError;

      // Create transaction
      const { error: txError } = await supabase
        .from("client_financial_bank_transactions")
        .insert({
          project_id: projectId,
          bank_account_id: selectedAccount.id,
          transaction_type: "adjustment",
          amount: adjustmentAmount,
          balance_before: selectedAccount.current_balance,
          balance_after: newBalance,
          description: adjustmentDescription || "Ajuste de saldo",
          reference_type: "manual",
          transaction_date: new Date().toISOString().split("T")[0],
        });

      if (txError) throw txError;

      toast.success("Ajuste realizado com sucesso!");
      setAdjustDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error adjusting balance:", error);
      toast.error(error.message || "Erro ao ajustar saldo");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getAccountTypeName = (type: string) => {
    return ACCOUNT_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "expense":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case "transfer_in":
        return <ArrowDownLeft className="h-4 w-4 text-blue-600" />;
      case "transfer_out":
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />;
      case "adjustment":
        return <RefreshCw className="h-4 w-4 text-amber-600" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.is_active ? a.current_balance : 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contas Bancárias</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas e acompanhe os saldos
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        )}
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className={`text-3xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <Building2 className="h-12 w-12 text-primary/30" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts" className="gap-2">
            <Wallet className="h-4 w-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <History className="h-4 w-4" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma conta cadastrada</p>
                {canEdit && (
                  <Button variant="outline" className="mt-4" onClick={openNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Conta
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <Card 
                  key={account.id} 
                  className={`relative overflow-hidden ${!account.is_active ? "opacity-60" : ""}`}
                >
                  <div 
                    className="absolute top-0 left-0 w-full h-1" 
                    style={{ backgroundColor: account.color }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {account.name}
                          {account.is_default && (
                            <Badge variant="secondary" className="text-xs">Padrão</Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {account.bank_name || getAccountTypeName(account.account_type)}
                        </p>
                      </div>
                      {!account.is_active && (
                        <Badge variant="outline" className="text-xs">Inativa</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo Atual</p>
                        <p className={`text-2xl font-bold ${account.current_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(account.current_balance)}
                        </p>
                      </div>

                      {(account.agency || account.account_number) && (
                        <div className="text-xs text-muted-foreground">
                          {account.agency && <span>Ag: {account.agency}</span>}
                          {account.agency && account.account_number && <span> • </span>}
                          {account.account_number && <span>CC: {account.account_number}</span>}
                        </div>
                      )}

                      {canEdit && (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openAdjust(account)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Ajustar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openEdit(account)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openDelete(account)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <History className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nenhuma movimentação</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => {
                      const account = accounts.find((a) => a.id === tx.bank_account_id);
                      return (
                        <TableRow key={tx.id}>
                          <TableCell>
                            {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: account?.color || "#ccc" }}
                              />
                              {account?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(tx.transaction_type)}
                              {tx.description || "-"}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(tx.balance_after)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount ? "Editar Conta" : "Nova Conta Bancária"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da Conta *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Conta Principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Banco</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Ex: Banco do Brasil"
                />
              </div>
              <div>
                <Label>Tipo de Conta</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(v) => setFormData({ ...formData, account_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agência</Label>
                <Input
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  placeholder="0000"
                />
              </div>
              <div>
                <Label>Conta</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="00000-0"
                />
              </div>
            </div>

            {!selectedAccount && (
              <div>
                <Label>Saldo Inicial</Label>
                <CurrencyInput
                  value={formData.initial_balance}
                  onChange={(v) => setFormData({ ...formData, initial_balance: v })}
                />
              </div>
            )}

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      formData.color === color ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre a conta..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Conta ativa</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                />
                <Label>Conta padrão</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {selectedAccount ? "Salvar" : "Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Saldo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Conta</p>
              <p className="font-medium">{selectedAccount?.name}</p>
              <p className="text-sm">
                Saldo atual: <span className="font-medium">{formatCurrency(selectedAccount?.current_balance || 0)}</span>
              </p>
            </div>

            <div>
              <Label>Valor do Ajuste</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Use valor positivo para adicionar ou negativo para subtrair
              </p>
              <Input
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
                placeholder="Motivo do ajuste"
              />
            </div>

            {adjustmentAmount !== 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Novo Saldo</p>
                <p className={`font-bold ${(selectedAccount?.current_balance || 0) + adjustmentAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency((selectedAccount?.current_balance || 0) + adjustmentAmount)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdjustment}>
              Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta "{selectedAccount?.name}"? 
              Esta ação não pode ser desfeita e todas as movimentações serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
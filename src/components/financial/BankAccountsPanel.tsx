import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  PiggyBank,
  CreditCard
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  agency: string | null;
  account_type: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  bank_account_id: string;
  type: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  is_reconciled: boolean;
  balance_after: number | null;
}

export function BankAccountsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    bank_name: "",
    account_number: "",
    agency: "",
    account_type: "checking",
    initial_balance: "",
    notes: ""
  });

  const [transactionData, setTransactionData] = useState({
    type: "credit",
    amount: "",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    description: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: accountsData, error } = await supabase
        .from("financial_bank_accounts")
        .select("*")
        .order("name");

      if (error) throw error;

      setAccounts(accountsData || []);

      // Load recent transactions for all accounts
      const { data: transactionsData } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(50);

      setTransactions(transactionsData || []);

    } catch (error) {
      console.error("Error loading bank accounts:", error);
      toast.error("Erro ao carregar contas bancárias");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      const initialBalance = parseFloat(formData.initial_balance) || 0;
      
      const { error } = await supabase.from("financial_bank_accounts").insert({
        name: formData.name,
        bank_name: formData.bank_name,
        account_number: formData.account_number || null,
        agency: formData.agency || null,
        account_type: formData.account_type,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        notes: formData.notes || null,
        is_active: true
      });

      if (error) throw error;

      toast.success("Conta bancária criada com sucesso!");
      setIsAddDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding bank account:", error);
      toast.error("Erro ao criar conta bancária");
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;

    try {
      const { error } = await supabase
        .from("financial_bank_accounts")
        .update({
          name: formData.name,
          bank_name: formData.bank_name,
          account_number: formData.account_number || null,
          agency: formData.agency || null,
          account_type: formData.account_type,
          notes: formData.notes || null
        })
        .eq("id", selectedAccount.id);

      if (error) throw error;

      toast.success("Conta atualizada com sucesso!");
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
      loadData();
    } catch (error) {
      console.error("Error updating bank account:", error);
      toast.error("Erro ao atualizar conta");
    }
  };

  const handleAddTransaction = async () => {
    if (!selectedAccount) return;

    try {
      const amount = parseFloat(transactionData.amount);
      const newBalance = transactionData.type === "credit"
        ? Number(selectedAccount.current_balance) + amount
        : Number(selectedAccount.current_balance) - amount;

      // Insert transaction
      const { error: transactionError } = await supabase
        .from("financial_transactions")
        .insert({
          bank_account_id: selectedAccount.id,
          type: transactionData.type,
          amount: amount,
          transaction_date: transactionData.transaction_date,
          description: transactionData.description || null,
          balance_after: newBalance,
          is_reconciled: false
        });

      if (transactionError) throw transactionError;

      // Update account balance
      const { error: balanceError } = await supabase
        .from("financial_bank_accounts")
        .update({ current_balance: newBalance })
        .eq("id", selectedAccount.id);

      if (balanceError) throw balanceError;

      toast.success("Lançamento registrado com sucesso!");
      setIsTransactionDialogOpen(false);
      setTransactionData({
        type: "credit",
        amount: "",
        transaction_date: format(new Date(), "yyyy-MM-dd"),
        description: ""
      });
      loadData();
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Erro ao registrar lançamento");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conta?")) return;

    try {
      const { error } = await supabase
        .from("financial_bank_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Conta excluída");
      loadData();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Erro ao excluir conta");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      bank_name: "",
      account_number: "",
      agency: "",
      account_type: "checking",
      initial_balance: "",
      notes: ""
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case "checking":
        return <Building2 className="h-5 w-5" />;
      case "savings":
        return <PiggyBank className="h-5 w-5" />;
      case "investment":
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case "checking":
        return "Conta Corrente";
      case "savings":
        return "Poupança";
      case "investment":
        return "Investimentos";
      default:
        return type;
    }
  };

  const totalBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bancos & Saldos</h2>
          <p className="text-muted-foreground">
            Gerencie suas contas bancárias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conta Bancária</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Conta *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Conta Principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Banco *</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="Ex: Itaú"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input
                      value={formData.agency}
                      onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                      placeholder="0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número da Conta</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="00000-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Conta</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(v) => setFormData({ ...formData, account_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Conta Corrente</SelectItem>
                        <SelectItem value="savings">Poupança</SelectItem>
                        <SelectItem value="investment">Investimentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.initial_balance}
                      onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddAccount}
                    disabled={!formData.name || !formData.bank_name}
                  >
                    Criar Conta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className={`text-3xl font-bold ${totalBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(totalBalance)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {accounts.filter(a => a.is_active).length} contas ativas
              </p>
            </div>
            <Building2 className="h-12 w-12 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      {/* Bank Account Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className={!account.is_active ? "opacity-50" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getAccountTypeIcon(account.account_type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{account.bank_name}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedAccount(account);
                        setTransactionData({
                          type: "credit",
                          amount: "",
                          transaction_date: format(new Date(), "yyyy-MM-dd"),
                          description: ""
                        });
                        setIsTransactionDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Lançamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedAccount(account);
                        setFormData({
                          name: account.name,
                          bank_name: account.bank_name,
                          account_number: account.account_number || "",
                          agency: account.agency || "",
                          account_type: account.account_type,
                          initial_balance: String(account.initial_balance),
                          notes: account.notes || ""
                        });
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDeleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className={`text-2xl font-bold ${Number(account.current_balance) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(Number(account.current_balance))}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{getAccountTypeLabel(account.account_type)}</span>
                  {account.agency && account.account_number && (
                    <span>Ag {account.agency} / CC {account.account_number}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {accounts.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma conta bancária cadastrada</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Lançamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((transaction) => {
                  const account = accounts.find(a => a.id === transaction.bank_account_id);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(parseISO(transaction.transaction_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell>{account?.name || "-"}</TableCell>
                      <TableCell className={`text-right font-medium ${transaction.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                        {transaction.type === "credit" ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta Bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Conta</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número da Conta</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateAccount}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lançamento - {selectedAccount?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={transactionData.type}
                  onValueChange={(v) => setTransactionData({ ...transactionData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Entrada
                      </div>
                    </SelectItem>
                    <SelectItem value="debit">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Saída
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={transactionData.amount}
                  onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={transactionData.transaction_date}
                onChange={(e) => setTransactionData({ ...transactionData, transaction_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={transactionData.description}
                onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                placeholder="Ex: Pagamento de fornecedor"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddTransaction}
                disabled={!transactionData.amount}
              >
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, History, TrendingUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { CurrencyInput } from "@/components/ui/currency-input";

interface Props {
  profileId?: string;
  wallet?: any;
}

export function CircleAdsWallet({ profileId, wallet }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState(50);
  const [showDeposit, setShowDeposit] = useState(false);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["circle-ads-transactions", wallet?.id],
    queryFn: async () => {
      if (!wallet?.id) return [];
      const { data, error } = await supabase
        .from("circle_ads_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!wallet?.id,
  });

  // Note: In production, this would integrate with a payment gateway
  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!wallet?.id || !profileId) throw new Error("Carteira não encontrada");

      // Create transaction
      const { error: txError } = await supabase
        .from("circle_ads_transactions")
        .insert({
          wallet_id: wallet.id,
          amount,
          type: "deposit",
          description: "Depósito de créditos",
        });
      if (txError) throw txError;

      // Update wallet balance
      const { error: walletError } = await supabase
        .from("circle_ads_wallets")
        .update({
          balance: (parseFloat(wallet.balance) || 0) + amount,
          total_deposited: (parseFloat(wallet.total_deposited) || 0) + amount,
        })
        .eq("id", wallet.id);
      if (walletError) throw walletError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-ads-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["circle-ads-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["circle-ads-can-advertise"] });
      toast({ title: "Créditos adicionados com sucesso!" });
      setShowDeposit(false);
    },
    onError: () => {
      toast({ title: "Erro ao adicionar créditos", variant: "destructive" });
    },
  });

  const transactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "spend":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "refund":
        return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const transactionLabel = (type: string) => {
    switch (type) {
      case "deposit":
        return "Depósito";
      case "spend":
        return "Gasto";
      case "refund":
        return "Reembolso";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Saldo Disponível</p>
                <p className="text-3xl font-bold mt-1">
                  R$ {Number(wallet?.balance || 0).toFixed(2)}
                </p>
              </div>
              <Wallet className="h-10 w-10 opacity-50" />
            </div>
            <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
              <DialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Créditos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Créditos</DialogTitle>
                  <DialogDescription>
                    Adicione saldo para veicular seus anúncios
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Valor do Depósito (R$)</Label>
                    <CurrencyInput
                      value={depositAmount}
                      onChange={setDepositAmount}
                    />
                  </div>
                  <div className="flex gap-2">
                    {[50, 100, 200, 500].map((v) => (
                      <Button
                        key={v}
                        variant={depositAmount === v ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDepositAmount(v)}
                      >
                        R$ {v}
                      </Button>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => depositMutation.mutate(depositAmount)}
                    disabled={depositMutation.isPending || depositAmount < 10}
                  >
                    {depositMutation.isPending ? "Processando..." : "Confirmar Depósito"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    * Integração com gateway de pagamento em desenvolvimento
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ArrowDownRight className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Depositado</p>
                <p className="text-2xl font-bold">
                  R$ {Number(wallet?.total_deposited || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gasto</p>
                <p className="text-2xl font-bold">
                  R$ {Number(wallet?.total_spent || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Transações</CardTitle>
          <CardDescription>Últimas movimentações da sua carteira</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : !transactions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma transação ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {transactionIcon(tx.type)}
                    <div>
                      <p className="font-medium text-sm">{tx.description || transactionLabel(tx.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.type === "spend" ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {tx.type === "spend" ? "-" : "+"}R$ {Math.abs(Number(tx.amount)).toFixed(2)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {transactionLabel(tx.type)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2, AlertTriangle, UserCheck, Search, Plus, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Rule {
  id: string;
  name: string;
  rule_type: string;
  points_value: number;
  multiplier: number;
  is_active: boolean;
}

interface Client {
  id: string;
  name: string;
  cpf: string;
  total_points: number;
}

interface TokenData {
  id: string;
  name: string;
  company_id: string;
  is_active: boolean;
}

export default function CustomerPointsSalespersonForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [step, setStep] = useState<"search" | "register" | "success" | "error">("search");
  const [errorMessage, setErrorMessage] = useState("");

  // Search state
  const [cpf, setCpf] = useState("");
  const [searchedClient, setSearchedClient] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [transactionValue, setTransactionValue] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);

  useEffect(() => {
    const loadTokenData = async () => {
      if (!token) {
        setErrorMessage("Link inválido");
        setStep("error");
        setLoading(false);
        return;
      }

      try {
        const { data: tokenInfo, error: tokenError } = await supabase
          .from("customer_points_salesperson_tokens")
          .select("*")
          .eq("access_token", token)
          .eq("is_active", true)
          .single();

        if (tokenError || !tokenInfo) {
          setErrorMessage("Link inválido ou desativado");
          setStep("error");
          setLoading(false);
          return;
        }

        setTokenData(tokenInfo);

        // Load active rules for this company
        const { data: rulesData } = await supabase
          .from("customer_points_rules")
          .select("*")
          .eq("company_id", tokenInfo.company_id)
          .eq("is_active", true)
          .order("sort_order");

        setRules(rulesData || []);
      } catch (error) {
        console.error("Error loading token:", error);
        setErrorMessage("Erro ao carregar dados");
        setStep("error");
      } finally {
        setLoading(false);
      }
    };

    loadTokenData();
  }, [token]);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const validateCPF = (cpfValue: string) => {
    const digits = cpfValue.replace(/\D/g, "");
    if (digits.length !== 11) return false;
    if (/^(\d)\1+$/.test(digits)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[10])) return false;

    return true;
  };

  const handleSearch = async () => {
    if (!tokenData) return;

    if (!validateCPF(cpf)) {
      toast.error("CPF inválido");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    setSubmitting(true);

    try {
      const { data: existingClient, error } = await supabase
        .from("customer_points_clients")
        .select("id, name, cpf, total_points")
        .eq("company_id", tokenData.company_id)
        .eq("cpf", cleanCPF)
        .maybeSingle();

      if (error) {
        console.error("Error searching client:", error);
        toast.error("Erro ao buscar cliente");
        setSubmitting(false);
        return;
      }

      if (existingClient) {
        setSearchedClient(existingClient);
        setIsNewClient(false);
      } else {
        setSearchedClient(null);
        setIsNewClient(true);
      }

      setStep("register");
    } catch (error) {
      console.error("Error searching client:", error);
      toast.error("Erro ao buscar cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const calculatePoints = (rule: Rule, value?: number) => {
    if (rule.rule_type === "fixed") {
      return rule.points_value;
    } else if (rule.rule_type === "per_value" && value) {
      return Math.floor(value / rule.multiplier) * rule.points_value;
    } else if (rule.rule_type === "per_quantity" && value) {
      return value * rule.points_value;
    }
    return rule.points_value;
  };

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  const handleSubmit = async () => {
    if (!tokenData || !selectedRule) {
      toast.error("Selecione uma regra de pontuação");
      return;
    }

    if (isNewClient && !clientName.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    setSubmitting(true);

    try {
      let clientId = searchedClient?.id;
      let currentPoints = searchedClient?.total_points || 0;

      // Create new client if needed
      if (isNewClient) {
        const { data: newClient, error: clientError } = await supabase
          .from("customer_points_clients")
          .insert({
            company_id: tokenData.company_id,
            name: clientName.trim(),
            cpf: cleanCPF,
            phone: clientPhone || null,
            email: clientEmail || null,
          })
          .select()
          .single();

        if (clientError) {
          if (clientError.code === "23505") {
            toast.error("CPF já cadastrado");
          } else {
            toast.error("Erro ao cadastrar cliente");
            console.error(clientError);
          }
          setSubmitting(false);
          return;
        }

        clientId = newClient.id;
        currentPoints = 0;
      }

      // Calculate points
      const value = transactionValue ? parseFloat(transactionValue) : undefined;
      const points = calculatePoints(selectedRule, value);

      // Create transaction
      const { error: transactionError } = await supabase
        .from("customer_points_transactions")
        .insert({
          company_id: tokenData.company_id,
          client_id: clientId!,
          cpf: cleanCPF,
          rule_id: selectedRule.id,
          points: points,
          source: "salesperson",
          value: value || null,
          form_responses: {
            salesperson_token: tokenData.name,
            transaction_value: transactionValue || null,
          },
        });

      if (transactionError) {
        console.error("Transaction error:", transactionError);
        toast.error("Erro ao registrar pontos");
        setSubmitting(false);
        return;
      }

      // Update client total points
      const newTotal = currentPoints + points;
      await supabase
        .from("customer_points_clients")
        .update({
          total_points: newTotal,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", clientId!);

      setPointsEarned(points);
      setNewTotalPoints(newTotal);
      setStep("success");
    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao processar");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCpf("");
    setSearchedClient(null);
    setIsNewClient(false);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSelectedRuleId("");
    setTransactionValue("");
    setStep("search");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold text-destructive mb-2">Ops!</h2>
                <p className="text-muted-foreground">{errorMessage}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "search" && tokenData && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Registrar Pontos</CardTitle>
                <CardDescription>
                  Vendedor: {tokenData.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF do Cliente</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={14}
                    className="text-center text-lg"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={submitting || cpf.replace(/\D/g, "").length !== 11}
                  className="w-full gap-2"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Buscar Cliente
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "register" && tokenData && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  {isNewClient ? (
                    <>
                      <Plus className="h-5 w-5" />
                      Novo Cliente
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5 text-green-500" />
                      {searchedClient?.name}
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {isNewClient
                    ? "Cliente não encontrado. Preencha os dados para cadastrar."
                    : `Saldo atual: ${searchedClient?.total_points || 0} pontos`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isNewClient && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo *</Label>
                      <Input
                        id="name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Tipo de pontuação *</Label>
                  <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rules.map((rule) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {rule.name} (+{rule.points_value} pts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRule && selectedRule.rule_type === "per_value" && (
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor da compra (R$)</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={transactionValue}
                      onChange={(e) => setTransactionValue(e.target.value)}
                      placeholder="0,00"
                    />
                    {transactionValue && (
                      <p className="text-sm text-muted-foreground">
                        = {calculatePoints(selectedRule, parseFloat(transactionValue))} pontos
                      </p>
                    )}
                  </div>
                )}

                {selectedRule && selectedRule.rule_type === "per_quantity" && (
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={transactionValue}
                      onChange={(e) => setTransactionValue(e.target.value)}
                      placeholder="0"
                    />
                    {transactionValue && (
                      <p className="text-sm text-muted-foreground">
                        = {calculatePoints(selectedRule, parseInt(transactionValue))} pontos
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetForm} className="flex-1">
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedRuleId}
                    className="flex-1"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar Pontos"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
                </motion.div>
                <h2 className="text-2xl font-bold">Pontos Registrados!</h2>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-3xl font-bold text-primary">+{pointsEarned}</p>
                  <p className="text-sm text-muted-foreground">pontos adicionados</p>
                </div>
                <p className="text-muted-foreground">
                  Novo saldo: <strong>{newTotalPoints} pontos</strong>
                </p>
                <Button onClick={resetForm} className="w-full" size="lg">
                  Registrar Outro
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

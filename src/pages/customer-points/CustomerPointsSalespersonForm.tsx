import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2, AlertTriangle, UserCheck, UserPlus, Coins, User } from "lucide-react";
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

interface Salesperson {
  id: string;
  name: string;
}

export default function CustomerPointsSalespersonForm() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [companyValid, setCompanyValid] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [step, setStep] = useState<"identify" | "form" | "success" | "error">("identify");
  const [errorMessage, setErrorMessage] = useState("");

  // Salesperson identification
  const [selectedSalespersonId, setSelectedSalespersonId] = useState("");
  const [salespersonName, setSalespersonName] = useState("");
  const [useExistingSalesperson, setUseExistingSalesperson] = useState(true);
  const [confirmedSalespersonName, setConfirmedSalespersonName] = useState("");

  // Client state
  const [cpf, setCpf] = useState("");
  const [searchedClient, setSearchedClient] = useState<Client | null>(null);
  const [clientSearched, setClientSearched] = useState(false);

  // New client form state (only used when client not found)
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Points form state
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [transactionValue, setTransactionValue] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);

  useEffect(() => {
    const loadCompanyData = async () => {
      if (!companyId) {
        setErrorMessage("Link inválido");
        setStep("error");
        setLoading(false);
        return;
      }

      try {
        // Verify company has points config
        const { data: config, error: configError } = await supabase
          .from("customer_points_config")
          .select("id, is_active")
          .eq("company_id", companyId)
          .maybeSingle();

        if (configError || !config || !config.is_active) {
          setErrorMessage("Programa de pontos não encontrado ou desativado");
          setStep("error");
          setLoading(false);
          return;
        }

        setCompanyValid(true);

        // Load active rules for this company
        const { data: rulesData } = await supabase
          .from("customer_points_rules")
          .select("*")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("sort_order");

        setRules(rulesData || []);

        // Load registered salespeople
        const { data: salespeopleData } = await supabase
          .from("company_salespeople")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");

        setSalespeople(salespeopleData || []);
      } catch (error) {
        console.error("Error loading company:", error);
        setErrorMessage("Erro ao carregar dados");
        setStep("error");
      } finally {
        setLoading(false);
      }
    };

    loadCompanyData();
  }, [companyId]);

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

  // Auto-search when CPF is complete
  const searchClient = useCallback(async (cleanCPF: string) => {
    if (!companyId || cleanCPF.length !== 11) return;

    setSearching(true);
    try {
      const { data: existingClient, error } = await supabase
        .from("customer_points_clients")
        .select("id, name, cpf, total_points")
        .eq("company_id", companyId)
        .eq("cpf", cleanCPF)
        .maybeSingle();

      if (error) {
        console.error("Error searching client:", error);
        return;
      }

      setSearchedClient(existingClient);
      setClientSearched(true);
    } catch (error) {
      console.error("Error searching client:", error);
    } finally {
      setSearching(false);
    }
  }, [companyId]);

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    setCpf(formatted);
    
    const cleanCPF = formatted.replace(/\D/g, "");
    
    // Reset search state when CPF changes
    if (cleanCPF.length < 11) {
      setSearchedClient(null);
      setClientSearched(false);
      setClientName("");
      setClientPhone("");
      setClientEmail("");
    }
    
    // Auto-search when CPF is complete
    if (cleanCPF.length === 11 && validateCPF(formatted)) {
      searchClient(cleanCPF);
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
  const isNewClient = clientSearched && !searchedClient;

  const handleIdentify = () => {
    let name = "";
    if (useExistingSalesperson && selectedSalespersonId) {
      const sp = salespeople.find(s => s.id === selectedSalespersonId);
      name = sp?.name || "";
    } else if (!useExistingSalesperson && salespersonName.trim()) {
      name = salespersonName.trim();
    }

    if (!name) {
      toast.error("Informe seu nome para continuar");
      return;
    }

    setConfirmedSalespersonName(name);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!companyId || !selectedRule) {
      toast.error("Selecione uma regra de pontuação");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    
    if (!validateCPF(cpf)) {
      toast.error("CPF inválido");
      return;
    }

    if (isNewClient && !clientName.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    setSubmitting(true);

    try {
      let clientId = searchedClient?.id;
      let currentPoints = searchedClient?.total_points || 0;

      // Create new client if needed
      if (isNewClient) {
        const { data: newClient, error: clientError } = await supabase
          .from("customer_points_clients")
          .insert({
            company_id: companyId,
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
          company_id: companyId,
          client_id: clientId!,
          cpf: cleanCPF,
          rule_id: selectedRule.id,
          points: points,
          source: "salesperson",
          value: value || null,
          form_responses: {
            salesperson_name: confirmedSalespersonName,
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
    setClientSearched(false);
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setSelectedRuleId("");
    setTransactionValue("");
    setStep("form");
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

        {step === "identify" && companyValid && (
          <motion.div
            key="identify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Identificação</CardTitle>
                <CardDescription>
                  Informe seu nome para registrar pontos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {salespeople.length > 0 && (
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={useExistingSalesperson ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseExistingSalesperson(true)}
                      className="flex-1"
                    >
                      Selecionar da lista
                    </Button>
                    <Button
                      variant={!useExistingSalesperson ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseExistingSalesperson(false)}
                      className="flex-1"
                    >
                      Digitar nome
                    </Button>
                  </div>
                )}

                {useExistingSalesperson && salespeople.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Seu nome</Label>
                    <Select value={selectedSalespersonId} onValueChange={setSelectedSalespersonId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu nome..." />
                      </SelectTrigger>
                      <SelectContent>
                        {salespeople.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="salesperson-name">Seu nome</Label>
                    <Input
                      id="salesperson-name"
                      value={salespersonName}
                      onChange={(e) => setSalespersonName(e.target.value)}
                      placeholder="Digite seu nome"
                    />
                  </div>
                )}

                <Button 
                  onClick={handleIdentify} 
                  className="w-full" 
                  size="lg"
                  disabled={
                    (useExistingSalesperson && salespeople.length > 0 && !selectedSalespersonId) ||
                    (!useExistingSalesperson && !salespersonName.trim()) ||
                    (salespeople.length === 0 && !salespersonName.trim())
                  }
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "form" && companyValid && (
          <motion.div
            key="form"
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
                  Vendedor: {confirmedSalespersonName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* CPF Input */}
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF do Cliente</Label>
                  <div className="relative">
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => handleCPFChange(e.target.value)}
                      maxLength={14}
                      className="text-center text-lg pr-10"
                    />
                    {searching && (
                      <Loader2 className="h-5 w-5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Client Info Display */}
                {clientSearched && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-lg border p-4"
                  >
                    {searchedClient ? (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{searchedClient.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Saldo: <span className="font-medium text-primary">{searchedClient.total_points} pontos</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold">Novo Cliente</p>
                            <p className="text-sm text-muted-foreground">Preencha os dados abaixo</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="name">Nome completo *</Label>
                            <Input
                              id="name"
                              value={clientName}
                              onChange={(e) => setClientName(e.target.value)}
                              placeholder="Nome do cliente"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                              id="phone"
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                              id="email"
                              type="email"
                              value={clientEmail}
                              onChange={(e) => setClientEmail(e.target.value)}
                              placeholder="email@exemplo.com"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Points Selection - Only show after client is found/created */}
                {clientSearched && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4 pt-2"
                  >
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

                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || !selectedRuleId || (isNewClient && !clientName.trim())}
                      className="w-full"
                      size="lg"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        "Registrar Pontos"
                      )}
                    </Button>
                  </motion.div>
                )}
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
                <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Pontos Registrados!</h2>
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-4xl font-bold text-primary">+{pointsEarned}</p>
                  <p className="text-sm text-muted-foreground">pontos adicionados</p>
                </div>
                <p className="text-muted-foreground">
                  Novo saldo: <span className="font-semibold text-foreground">{newTotalPoints} pontos</span>
                </p>
                <Button onClick={resetForm} className="w-full" size="lg">
                  Registrar outro cliente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

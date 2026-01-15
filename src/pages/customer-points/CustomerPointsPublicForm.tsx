import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Gift, Star, Loader2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  rule_id: string | null;
  form_fields: FormField[];
  limit_per_cpf_per_day: number | null;
  limit_per_cpf_total: number | null;
  min_hours_between: number | null;
  is_active: boolean;
}

interface Rule {
  id: string;
  name: string;
  rule_type: string;
  points_value: number | null;
  multiplier: number | null;
}

interface ClientData {
  id: string;
  name: string;
  total_points: number;
}

export default function CustomerPointsPublicForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const [step, setStep] = useState<"cpf" | "form" | "success" | "error">("cpf");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [cpf, setCpf] = useState("");
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);

  useEffect(() => {
    const loadCampaign = async () => {
      if (!token) {
        setErrorMessage("Link inválido ou expirado");
        setStep("error");
        setLoading(false);
        return;
      }

      try {
        const { data: campaignData, error: campaignError } = await supabase
          .from("customer_points_qr_campaigns")
          .select("*")
          .eq("access_token", token)
          .single();

        if (campaignError || !campaignData) {
          setErrorMessage("Campanha não encontrada");
          setStep("error");
          setLoading(false);
          return;
        }

        if (!campaignData.is_active) {
          setErrorMessage("Esta campanha não está mais ativa");
          setStep("error");
          setLoading(false);
          return;
        }

        // Check date limits
        const now = new Date();
        if (campaignData.starts_at && new Date(campaignData.starts_at) > now) {
          setErrorMessage("Esta campanha ainda não começou");
          setStep("error");
          setLoading(false);
          return;
        }
        if (campaignData.ends_at && new Date(campaignData.ends_at) < now) {
          setErrorMessage("Esta campanha já encerrou");
          setStep("error");
          setLoading(false);
          return;
        }

        setCampaign({
          ...campaignData,
          form_fields: (campaignData.form_fields as unknown as FormField[]) || []
        });

        // Load rule if exists
        if (campaignData.rule_id) {
          const { data: ruleData } = await supabase
            .from("customer_points_rules")
            .select("*")
            .eq("id", campaignData.rule_id)
            .single();
          
          if (ruleData) {
            setRule(ruleData);
          }
        }
      } catch (error) {
        console.error("Error loading campaign:", error);
        setErrorMessage("Erro ao carregar campanha");
        setStep("error");
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
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
    
    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(digits)) return false;
    
    // Validate check digits
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

  const handleCPFSubmit = async () => {
    if (!campaign) return;
    
    if (!validateCPF(cpf)) {
      toast.error("CPF inválido");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    setSubmitting(true);

    try {
      // Check for existing client
      const { data: existingClient } = await supabase
        .from("customer_points_clients")
        .select("id, name, total_points")
        .eq("company_id", campaign.company_id)
        .eq("cpf", cleanCPF)
        .single();

      // Check anti-fraud limits
      if (existingClient) {
        // Check total limit
        if (campaign.limit_per_cpf_total) {
          const { count } = await supabase
            .from("customer_points_transactions")
            .select("*", { count: "exact", head: true })
            .eq("qr_campaign_id", campaign.id)
            .eq("cpf", cleanCPF);
          
          if ((count || 0) >= campaign.limit_per_cpf_total) {
            toast.error("Você já atingiu o limite de participações nesta campanha");
            setSubmitting(false);
            return;
          }
        }

        // Check daily limit
        if (campaign.limit_per_cpf_per_day) {
          const today = new Date().toISOString().split("T")[0];
          const { count } = await supabase
            .from("customer_points_transactions")
            .select("*", { count: "exact", head: true })
            .eq("qr_campaign_id", campaign.id)
            .eq("cpf", cleanCPF)
            .gte("created_at", `${today}T00:00:00`)
            .lte("created_at", `${today}T23:59:59`);
          
          if ((count || 0) >= campaign.limit_per_cpf_per_day) {
            toast.error("Você já participou hoje. Volte amanhã!");
            setSubmitting(false);
            return;
          }
        }

        // Check minimum hours between
        if (campaign.min_hours_between) {
          const { data: lastTransaction } = await supabase
            .from("customer_points_transactions")
            .select("created_at")
            .eq("qr_campaign_id", campaign.id)
            .eq("cpf", cleanCPF)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          if (lastTransaction) {
            const lastTime = new Date(lastTransaction.created_at).getTime();
            const now = Date.now();
            const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
            
            if (hoursDiff < campaign.min_hours_between) {
              const remainingHours = Math.ceil(campaign.min_hours_between - hoursDiff);
              toast.error(`Aguarde mais ${remainingHours}h para participar novamente`);
              setSubmitting(false);
              return;
            }
          }
        }

        setClientData(existingClient);
        setIsNewClient(false);
      } else {
        setClientData(null);
        setIsNewClient(true);
      }

      setStep("form");
    } catch (error) {
      console.error("Error checking CPF:", error);
      toast.error("Erro ao verificar CPF");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async () => {
    if (!campaign) {
      toast.error("Campanha não encontrada");
      return;
    }
    
    if (!rule) {
      toast.error("Esta campanha não possui uma regra de pontuação configurada. Entre em contato com o estabelecimento.");
      return;
    }

    const cleanCPF = cpf.replace(/\D/g, "");
    
    // Validate required fields
    if (isNewClient && !formResponses.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    for (const field of campaign.form_fields) {
      if (field.required && !formResponses[field.id]?.trim()) {
        toast.error(`${field.label} é obrigatório`);
        return;
      }
    }

    setSubmitting(true);

    try {
      let clientId = clientData?.id;
      let currentPoints = clientData?.total_points || 0;

      // Create new client if needed
      if (isNewClient) {
        const { data: newClient, error: clientError } = await supabase
          .from("customer_points_clients")
          .insert({
            company_id: campaign.company_id,
            name: formResponses.name,
            cpf: cleanCPF,
            phone: formResponses.phone || null,
            email: formResponses.email || null,
          })
          .select()
          .single();

        if (clientError) {
          if (clientError.code === "23505") {
            toast.error("CPF já cadastrado");
          } else {
            toast.error("Erro ao criar cliente");
          }
          setSubmitting(false);
          return;
        }

        clientId = newClient.id;
        currentPoints = 0;
      }

      // Calculate points
      const points = rule.points_value || 0;

      // Create transaction
      const { error: transactionError } = await supabase
        .from("customer_points_transactions")
        .insert({
          company_id: campaign.company_id,
          client_id: clientId!,
          cpf: cleanCPF,
          rule_id: rule.id,
          points: points,
          source: "qr_code",
          qr_campaign_id: campaign.id,
          form_responses: formResponses,
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
          last_activity_at: new Date().toISOString()
        })
        .eq("id", clientId!);

      // Update campaign scan count
      await supabase
        .from("customer_points_qr_campaigns")
        .update({ 
          total_scans: (campaign as any).total_scans ? (campaign as any).total_scans + 1 : 1 
        })
        .eq("id", campaign.id);

      setPointsEarned(points);
      setNewTotalPoints(newTotal);
      setStep("success");
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao processar participação");
    } finally {
      setSubmitting(false);
    }
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

        {step === "cpf" && campaign && (
          <motion.div
            key="cpf"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>{campaign.name}</CardTitle>
                {campaign.description && (
                  <CardDescription>{campaign.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">Informe seu CPF</Label>
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
                  onClick={handleCPFSubmit}
                  disabled={submitting || cpf.replace(/\D/g, "").length !== 11}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "form" && campaign && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader className="text-center">
                <CardTitle>
                  {isNewClient ? "Cadastro" : `Olá, ${clientData?.name}!`}
                </CardTitle>
                <CardDescription>
                  {isNewClient
                    ? "Complete seu cadastro para participar"
                    : "Confirme sua participação"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isNewClient && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo *</Label>
                      <Input
                        id="name"
                        value={formResponses.name || ""}
                        onChange={(e) => setFormResponses(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formResponses.phone || ""}
                        onChange={(e) => setFormResponses(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formResponses.email || ""}
                        onChange={(e) => setFormResponses(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="seu@email.com"
                      />
                    </div>
                  </>
                )}

                {campaign.form_fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>
                      {field.label} {field.required && "*"}
                    </Label>
                    <Input
                      id={field.id}
                      type={field.type}
                      value={formResponses[field.id] || ""}
                      onChange={(e) => setFormResponses(prev => ({ ...prev, [field.id]: e.target.value }))}
                    />
                  </div>
                ))}

                {rule && (
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <Star className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Você ganhará</p>
                    <p className="text-2xl font-bold text-primary">
                      +{rule.points_value || 0} pontos
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleFormSubmit}
                  disabled={submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Confirmar Participação"
                  )}
                </Button>
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
              <CardContent className="pt-8 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
                </motion.div>
                
                <div>
                  <h2 className="text-2xl font-bold text-green-600 mb-2">Parabéns!</h2>
                  <p className="text-muted-foreground">Sua participação foi registrada</p>
                </div>

                <div className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl p-6">
                  <p className="text-sm text-muted-foreground mb-1">Você ganhou</p>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-4xl font-bold text-primary"
                  >
                    +{pointsEarned}
                  </motion.p>
                  <p className="text-sm text-muted-foreground mt-1">pontos</p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Seu saldo total</p>
                  <p className="text-2xl font-semibold">{newTotalPoints} pontos</p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500" />
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, User, MapPin, Building2, Landmark, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

const StaffRegistrationPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    rg: "",
    birth_date: "",
    cep: "",
    street: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    bank_account_type: "",
    pix_key: "",
    cnpj: "",
    company_name: "",
    trade_name: "",
    municipal_registration: "",
  });

  useEffect(() => {
    if (token) loadRegistration();
  }, [token]);

  const loadRegistration = async () => {
    try {
      const { data, error } = await supabase
        .from("staff_registrations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Link inválido ou expirado");
        setLoading(false);
        return;
      }

      if (data.status === "submitted" || data.submitted_at) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setRegistrationId(data.id);
      // Pre-fill with existing data
      setForm((prev) => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        cpf: data.cpf || prev.cpf,
        rg: data.rg || prev.rg,
        birth_date: data.birth_date || prev.birth_date,
        cep: data.cep || prev.cep,
        street: data.street || prev.street,
        address_number: data.address_number || prev.address_number,
        complement: data.complement || prev.complement,
        neighborhood: data.neighborhood || prev.neighborhood,
        city: data.city || prev.city,
        state: data.state || prev.state,
        bank_name: data.bank_name || prev.bank_name,
        bank_agency: data.bank_agency || prev.bank_agency,
        bank_account: data.bank_account || prev.bank_account,
        bank_account_type: data.bank_account_type || prev.bank_account_type,
        pix_key: data.pix_key || prev.pix_key,
        cnpj: data.cnpj || prev.cnpj,
        company_name: data.company_name || prev.company_name,
        trade_name: data.trade_name || prev.trade_name,
        municipal_registration: data.municipal_registration || prev.municipal_registration,
      }));
    } catch (error) {
      console.error("Error loading registration:", error);
      toast.error("Erro ao carregar formulário");
    } finally {
      setLoading(false);
    }
  };

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {}
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "cep") fetchCep(value);
  };

  const handleSubmit = async () => {
    if (!registrationId) return;
    if (!form.full_name || !form.email || !form.cpf) {
      toast.error("Preencha pelo menos Nome, Email e CPF");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("staff_registrations")
        .update({
          ...form,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (error) throw error;
      setSubmitted(true);
      toast.success("Cadastro enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar cadastro");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro Enviado!</h2>
            <p className="text-muted-foreground">
              Seus dados foram recebidos com sucesso. A equipe irá revisar suas informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!registrationId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <h2 className="text-2xl font-bold">Link Inválido</h2>
            <p className="text-muted-foreground">Este link de cadastro não é válido ou já foi utilizado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { icon: User, label: "Dados Pessoais" },
    { icon: MapPin, label: "Endereço" },
    { icon: Landmark, label: "Dados Bancários" },
    { icon: Building2, label: "Dados PJ" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Cadastro de Colaborador</h1>
          <p className="text-muted-foreground">Preencha suas informações para completar o cadastro</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  step === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step 0: Personal Data */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Dados Pessoais</CardTitle>
              <CardDescription>Informações básicas do colaborador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <PhoneInput value={form.phone} onChange={(v) => handleChange("phone", v)} />
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input value={form.cpf} onChange={(e) => handleChange("cpf", e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={(e) => handleChange("rg", e.target.value)} placeholder="RG" />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.birth_date} onChange={(e) => handleChange("birth_date", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Address */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Endereço</CardTitle>
              <CardDescription>Endereço residencial completo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} placeholder="00000-000" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={(e) => handleChange("street", e.target.value)} placeholder="Rua / Avenida" />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.address_number} onChange={(e) => handleChange("address_number", e.target.value)} placeholder="Nº" />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={(e) => handleChange("complement", e.target.value)} placeholder="Apto, Bloco..." />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={(e) => handleChange("neighborhood", e.target.value)} placeholder="Bairro" />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input value={form.state} onChange={(e) => handleChange("state", e.target.value)} placeholder="UF" maxLength={2} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Bank Data */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Dados Bancários</CardTitle>
              <CardDescription>Informações para pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => handleChange("bank_name", e.target.value)} placeholder="Ex: Nubank, Itaú..." />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={form.bank_agency} onChange={(e) => handleChange("bank_agency", e.target.value)} placeholder="0001" />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={form.bank_account} onChange={(e) => handleChange("bank_account", e.target.value)} placeholder="00000-0" />
                </div>
                <div>
                  <Label>Tipo de Conta</Label>
                  <Select value={form.bank_account_type} onValueChange={(v) => handleChange("bank_account_type", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="pagamento">Conta de Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => handleChange("pix_key", e.target.value)} placeholder="CPF, Email, Telefone ou Chave aleatória" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: PJ Data */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Dados PJ</CardTitle>
              <CardDescription>Preencha caso possua empresa (Pessoa Jurídica)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label>Razão Social</Label>
                  <Input value={form.company_name} onChange={(e) => handleChange("company_name", e.target.value)} placeholder="Razão Social" />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.trade_name} onChange={(e) => handleChange("trade_name", e.target.value)} placeholder="Nome Fantasia" />
                </div>
                <div>
                  <Label>Inscrição Municipal <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input value={form.municipal_registration} onChange={(e) => handleChange("municipal_registration", e.target.value)} placeholder="Inscrição Municipal (se houver)" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Próximo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar Cadastro
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffRegistrationPage;

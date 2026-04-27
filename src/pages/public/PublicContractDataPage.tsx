import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressFields, AddressData } from "@/components/ui/address-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle, FileSignature } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ContractData {
  company: string;
  trade_name: string;
  document: string;
  email: string;
  phone: string;
  legal_representative_name: string;
  cpf: string;
  rg: string;
  marital_status: string;
  address: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

const MARITAL_STATUS_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
  "União Estável",
];

function formatCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpfMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const PublicContractDataPage = () => {
  const { token } = useParams<{ token: string }>();
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState<string>("");
  const [data, setData] = useState<ContractData>({
    company: "",
    trade_name: "",
    document: "",
    email: "",
    phone: "",
    legal_representative_name: "",
    cpf: "",
    rg: "",
    marital_status: "",
    address: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    city: "",
    state: "",
    zipcode: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) loadLead();
  }, [token]);

  const loadLead = async () => {
    setLoading(true);
    try {
      const { data: lead, error: err } = await supabase
        .from("crm_leads")
        .select("id, name, company, trade_name, document, email, phone, legal_representative_name, cpf, rg, marital_status, address, address_number, address_complement, address_neighborhood, city, state, zipcode")
        .eq("contract_form_token", token!)
        .maybeSingle();

      if (err) throw err;
      if (!lead) {
        setError("Formulário não encontrado ou link inválido.");
        return;
      }

      setLeadId(lead.id);
      setLeadName(lead.name);
      setData({
        company: lead.company || "",
        trade_name: lead.trade_name || "",
        document: lead.document || "",
        email: lead.email || "",
        phone: lead.phone || "",
        legal_representative_name: (lead as any).legal_representative_name || "",
        cpf: (lead as any).cpf || "",
        rg: (lead as any).rg || "",
        marital_status: (lead as any).marital_status || "",
        address: lead.address || "",
        address_number: (lead as any).address_number || "",
        address_complement: (lead as any).address_complement || "",
        address_neighborhood: (lead as any).address_neighborhood || "",
        city: lead.city || "",
        state: lead.state || "",
        zipcode: lead.zipcode || "",
      });
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar formulário.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ContractData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (addressData: AddressData) => {
    setData(prev => ({
      ...prev,
      address: addressData.address,
      address_number: addressData.address_number,
      address_complement: addressData.address_complement,
      address_neighborhood: addressData.address_neighborhood,
      zipcode: addressData.address_zipcode,
      city: addressData.address_city,
      state: addressData.address_state,
    }));
  };

  const handleSubmit = async () => {
    if (!leadId) return;

    // Validate all required fields
    const requiredFields: { key: keyof ContractData; label: string }[] = [
      { key: "company", label: "Razão Social" },
      { key: "trade_name", label: "Nome Fantasia" },
      { key: "document", label: "CNPJ" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "zipcode", label: "CEP" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "UF" },
      { key: "address", label: "Endereço" },
      { key: "address_number", label: "Número" },
      { key: "address_neighborhood", label: "Bairro" },
      { key: "legal_representative_name", label: "Nome do Representante Legal" },
      { key: "marital_status", label: "Estado Civil" },
      { key: "rg", label: "RG" },
      { key: "cpf", label: "CPF" },
    ];

    const missing = requiredFields.filter(f => !data[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missing.map(f => f.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from("crm_leads")
        .update({
          company: data.company || null,
          trade_name: data.trade_name || null,
          document: data.document || null,
          email: data.email || null,
          phone: data.phone || null,
          legal_representative_name: data.legal_representative_name || null,
          cpf: data.cpf || null,
          rg: data.rg || null,
          marital_status: data.marital_status || null,
          address: data.address || null,
          address_number: data.address_number || null,
          address_complement: data.address_complement || null,
          address_neighborhood: data.address_neighborhood || null,
          city: data.city || null,
          state: data.state || null,
          zipcode: data.zipcode || null,
        } as any)
        .eq("contract_form_token", token!);

      if (err) throw err;

      // Propagate data to CRM "Empresa" tab custom fields
      try {
        const companyFieldsMap: Record<string, string> = {
          "7b67f652-0241-4ce4-a0a1-55f662156798": data.company,        // company_name
          "b3466b71-9393-421f-9de6-5f3e78a64d75": data.document,       // cnpj
          "2625e412-c60b-44b2-9b95-9ffb4206ba3b": data.phone,          // company_phone
          "80a12445-cd5e-41ad-a3ec-41990b2dd2ff": data.email,           // company_email
          "dd91421b-6808-421b-b7b4-da7e81d87702": data.city,            // city
          "e26503ad-13b4-41fd-9e7b-bc5b8efee7af": data.state,           // state
          "244d8391-d3ca-4b59-b343-68809511076a": data.zipcode,          // cep
        };

        const upsertRows = Object.entries(companyFieldsMap)
          .filter(([_, value]) => value?.trim())
          .map(([fieldId, value]) => ({
            lead_id: leadId,
            field_id: fieldId,
            value: value.trim(),
          }));

        if (upsertRows.length > 0) {
          await supabase
            .from("crm_custom_field_values")
            .upsert(upsertRows, { onConflict: "lead_id,field_id" });
        }
      } catch (fieldErr) {
        console.error("Error updating company fields:", fieldErr);
      }

      // Propagate data to linked company (if exists)
      try {
        const { data: project } = await supabase
          .from("onboarding_projects")
          .select("onboarding_company_id")
          .eq("crm_lead_id", leadId)
          .maybeSingle();

        if (project?.onboarding_company_id) {
          const fullAddress = [data.address, data.address_number, data.address_complement]
            .filter(Boolean)
            .join(", ");

          await supabase
            .from("onboarding_companies")
            .update({
              cnpj: data.document || null,
              name: data.company || undefined,
              address: fullAddress || null,
              address_number: data.address_number || null,
              address_complement: data.address_complement || null,
              address_neighborhood: data.address_neighborhood || null,
              address_zipcode: data.zipcode || null,
              address_city: data.city || null,
              address_state: data.state || null,
              phone: data.phone || null,
              email: data.email || null,
              owner_name: data.legal_representative_name || null,
              owner_cpf: data.cpf || null,
              owner_rg: data.rg || null,
              owner_marital_status: data.marital_status || null,
            } as any)
            .eq("id", project.onboarding_company_id);
        }
      } catch (companyErr) {
        console.error("Error updating company data:", companyErr);
      }

      // Notify lead owner, head comercial and master (in-app + WhatsApp)
      try {
        await supabase.functions.invoke("notify-contract-form-submitted", {
          body: { leadId },
        });
      } catch (notifyErr) {
        console.error("Error sending contract form notifications:", notifyErr);
      }

      setSubmitted(true);
      toast.success("Dados enviados com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <FileSignature className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-gray-900">Dados enviados!</h2>
            <p className="text-gray-600">
              Seus dados contratuais foram recebidos com sucesso. Nossa equipe entrará em contato em breve.
            </p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Editar dados
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <FileSignature className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Dados Contratuais</h1>
          <p className="text-gray-500 text-sm">
            Preencha os dados abaixo para formalização do contrato.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Dados da Empresa</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razão Social <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    placeholder="Razão Social"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.trade_name}
                    onChange={(e) => handleChange("trade_name", e.target.value)}
                    placeholder="Nome Fantasia"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ <span className="text-destructive">*</span></Label>
                  <Input
                    value={formatCnpjMask(data.document)}
                    onChange={(e) => handleChange("document", e.target.value.replace(/\D/g, "").slice(0, 14))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={data.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone <span className="text-destructive">*</span></Label>
                  <PhoneInput
                    value={data.phone}
                    onChange={(v) => handleChange("phone", v)}
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Endereço Completo</h3>
              <AddressFields
                value={{
                  address: data.address,
                  address_number: data.address_number,
                  address_complement: data.address_complement,
                  address_neighborhood: data.address_neighborhood,
                  address_zipcode: data.zipcode,
                  address_city: data.city,
                  address_state: data.state,
                }}
                onChange={handleAddressChange}
              />
            </div>

            {/* Representante Legal */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Representante Legal</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Representante Legal <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.legal_representative_name}
                    onChange={(e) => handleChange("legal_representative_name", e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado Civil <span className="text-destructive">*</span></Label>
                  <Select
                    value={data.marital_status || "none"}
                    onValueChange={(v) => handleChange("marital_status", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecionar</SelectItem>
                      {MARITAL_STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>RG <span className="text-destructive">*</span></Label>
                  <Input
                    value={data.rg}
                    onChange={(e) => handleChange("rg", e.target.value)}
                    placeholder="Número do RG"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF <span className="text-destructive">*</span></Label>
                  <Input
                    value={formatCpfMask(data.cpf)}
                    onChange={(e) => handleChange("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Dados"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicContractDataPage;

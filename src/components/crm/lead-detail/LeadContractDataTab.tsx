import { useState, useEffect, useCallback, useRef } from "react";
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
import { Loader2, FileSignature, Link2, Copy, ExternalLink } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface LeadContractDataTabProps {
  leadId: string;
  onUpdate: () => void;
}

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

/**
 * Aplica máscara de CNPJ: 99.999.999/9999-99
 */
function formatCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Aplica máscara de CPF: 999.999.999-99
 */
function formatCpfMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export const LeadContractDataTab = ({ leadId, onUpdate }: LeadContractDataTabProps) => {
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
  const [saving, setSaving] = useState(false);
  const [formToken, setFormToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [leadId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: lead, error } = await supabase
        .from("crm_leads")
        .select("company, trade_name, document, email, phone, legal_representative_name, cpf, rg, marital_status, address, address_number, address_complement, address_neighborhood, city, state, zipcode, contract_form_token")
        .eq("id", leadId)
        .single();

      if (error) throw error;
      if (lead) {
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
        setFormToken((lead as any).contract_form_token || null);
      }
    } catch (error) {
      console.error("Error loading contract data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateFormLink = async () => {
    setGeneratingLink(true);
    try {
      let token = formToken;
      if (!token) {
        // Generate a random token
        token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { error } = await supabase
          .from("crm_leads")
          .update({ contract_form_token: token } as any)
          .eq("id", leadId);
        if (error) throw error;
        setFormToken(token);
      }
      const url = `${getPublicBaseUrl()}/#/dados-contratuais/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const saveField = useCallback(async (updates: Partial<ContractData>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update(updates as any)
        .eq("id", leadId);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [leadId, onUpdate]);

  const debouncedSave = useCallback((updates: Partial<ContractData>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveField(updates);
    }, 800);
  }, [saveField]);

  const handleChange = (field: keyof ContractData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    debouncedSave({ [field]: value || null });
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
    debouncedSave({
      address: addressData.address || null,
      address_number: addressData.address_number || null,
      address_complement: addressData.address_complement || null,
      address_neighborhood: addressData.address_neighborhood || null,
      zipcode: addressData.address_zipcode || null,
      city: addressData.address_city || null,
      state: addressData.address_state || null,
    } as any);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-auto max-h-full">
      <div className="flex items-center gap-2 mb-2">
        <FileSignature className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-base">Dados Contratuais</h3>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />}
      </div>

      {/* Dados da Empresa */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dados da Empresa</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input
              value={data.company}
              onChange={(e) => handleChange("company", e.target.value)}
              placeholder="Razão Social da empresa"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome Fantasia</Label>
            <Input
              value={data.trade_name}
              onChange={(e) => handleChange("trade_name", e.target.value)}
              placeholder="Nome Fantasia"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={formatCnpjMask(data.document)}
              onChange={(e) => handleChange("document", e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <PhoneInput
              value={data.phone}
              onChange={(v) => handleChange("phone", v)}
            />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Endereço Completo</h4>
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
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Representante Legal</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Representante Legal</Label>
            <Input
              value={data.legal_representative_name}
              onChange={(e) => handleChange("legal_representative_name", e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label>Estado Civil</Label>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>RG</Label>
            <Input
              value={data.rg}
              onChange={(e) => handleChange("rg", e.target.value)}
              placeholder="Número do RG"
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={formatCpfMask(data.cpf)}
              onChange={(e) => handleChange("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  product_id: string | null;
  opportunity_value: number | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  address?: string | null;
  zipcode?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  trade_name?: string | null;
  legal_representative_name?: string | null;
  cpf?: string | null;
}

interface ConvertLeadToCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSuccess?: () => void;
}

interface ServiceProduct {
  id: string;
  name: string;
  slug: string;
}

export function ConvertLeadToCompanyDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: ConvertLeadToCompanyDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  useEffect(() => {
    if (open) {
      fetchServices();
      setCompanyName(lead.company || lead.name);
      setEmail(lead.email || "");
      setPhone(lead.phone || "");
      setDocument(lead.document || "");
      if (lead.product_id) {
        setSelectedProduct(lead.product_id);
      }
    }
  }, [open, lead]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("onboarding_services")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");
    if (data) setServices(data);
  };

  const handleConvert = async () => {
    if (!companyName.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    if (!selectedProduct) {
      toast.error("Selecione um produto");
      return;
    }

    setLoading(true);
    try {
      const service = services.find((s) => s.id === selectedProduct);
      if (!service) throw new Error("Produto não encontrado");

      let companyId: string;
      let existingCompany = null;

      if (document && document.trim()) {
        const { data: companyByDoc } = await supabase
          .from("onboarding_companies")
          .select("id")
          .eq("cnpj", document.trim())
          .maybeSingle();
        existingCompany = companyByDoc;
      }

      const companyPayload = {
        name: companyName,
        phone: phone || null,
        email: email || null,
        cnpj: document || null,
        segment: lead.segment,
        contract_value: lead.opportunity_value || null,
        status: "pending",
        address: lead.address,
        address_number: lead.address_number,
        address_complement: lead.address_complement,
        address_neighborhood: lead.address_neighborhood,
        address_city: lead.city,
        address_state: lead.state,
        address_zipcode: lead.zipcode,
      };

      if (existingCompany) {
        companyId = existingCompany.id;
        const { error: updateCompanyError } = await supabase
          .from("onboarding_companies")
          .update(companyPayload)
          .eq("id", companyId);

        if (updateCompanyError) throw new Error("Erro ao atualizar empresa");
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from("onboarding_companies")
          .insert(companyPayload)
          .select("id")
          .single();

        if (companyError || !newCompany) throw new Error("Erro ao criar empresa");
        companyId = newCompany.id;
      }

      const { data: existingProject } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("onboarding_company_id", companyId)
        .eq("product_id", service.slug || service.id)
        .maybeSingle();

      if (!existingProject) {
        const { error: projectError } = await supabase
          .from("onboarding_projects")
          .insert({
            product_id: service.slug || service.id,
            product_name: service.name,
            onboarding_company_id: companyId,
            status: "pending",
            crm_lead_id: lead.id,
          } as any);

        if (projectError) throw new Error("Erro ao criar projeto");
      }

      await supabase.from("crm_lead_history").insert({
        lead_id: lead.id,
        action: "converted_to_company",
        notes: `Empresa "${companyName}" criada com projeto "${service.name}". Projeto iniciado como pendente para lançamento manual das parcelas no financeiro.`,
        new_value: companyId,
      });

      toast.success("Empresa criada com sucesso!");
      onOpenChange(false);
      onSuccess?.();
      navigate(`/onboarding-tasks/companies/${companyId}?tab=financial`);
    } catch (error: any) {
      console.error("Error converting lead:", error);
      toast.error(error.message || "Erro ao converter lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Converter Lead em Empresa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados da Empresa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da Empresa *</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ/CPF</Label>
                <Input value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Produto/Serviço *</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p>
              A empresa será criada com projeto <strong>pendente</strong> e você será levado direto ao <strong>Financeiro da Empresa</strong> para cadastrar as parcelas manualmente.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleConvert} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Empresa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


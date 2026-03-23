import { useState, useEffect } from "react";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { Loader2, Building2, CreditCard } from "lucide-react";

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

type PaymentProvider = "asaas" | "pagarme" | "mercadopago" | "dompagamentos";

const providers: { id: PaymentProvider; label: string }[] = [
  { id: "asaas", label: "Asaas" },
  { id: "pagarme", label: "Pagar.me" },
  { id: "mercadopago", label: "Mercado Pago" },
  { id: "dompagamentos", label: "Dom Pagamentos" },
];

const edgeFunctionMap: Record<PaymentProvider, string> = {
  asaas: "asaas-checkout",
  pagarme: "pagarme-checkout",
  mercadopago: "mercadopago-checkout",
  dompagamentos: "dompagamentos-checkout",
};

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
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [provider, setProvider] = useState<PaymentProvider>("asaas");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      fetchServices();
      // Pre-fill from lead
      setCompanyName(lead.company || lead.name);
      setEmail(lead.email || "");
      setPhone(lead.phone || "");
      setDocument(lead.document || "");
      setAmount(lead.opportunity_value || 0);
      setDescription(`Serviço - ${lead.company || lead.name}`);
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
    if (!email) {
      toast.error("Email é obrigatório para gerar a cobrança");
      return;
    }
    if (amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setLoading(true);
    try {
      const service = services.find((s) => s.id === selectedProduct);
      if (!service) throw new Error("Produto não encontrado");

      // 1. Create or find company
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

      if (existingCompany) {
        companyId = existingCompany.id;
        await supabase
          .from("onboarding_companies")
          .update({
            name: companyName,
            phone,
            email,
            cnpj: document || null,
            segment: lead.segment,
            contract_value: amount,
            status: "pending",
            address: lead.address,
            address_number: lead.address_number,
            address_complement: lead.address_complement,
            address_neighborhood: lead.address_neighborhood,
            address_city: lead.city,
            address_state: lead.state,
            address_zipcode: lead.zipcode,
          })
          .eq("id", companyId);
      } else {
        const { data: newCompany, error: companyError } = await supabase
          .from("onboarding_companies")
          .insert({
            name: companyName,
            phone,
            email,
            cnpj: document || null,
            segment: lead.segment,
            contract_value: amount,
            status: "pending",
            address: lead.address,
            address_number: lead.address_number,
            address_complement: lead.address_complement,
            address_neighborhood: lead.address_neighborhood,
            address_city: lead.city,
            address_state: lead.state,
            address_zipcode: lead.zipcode,
          })
          .select("id")
          .single();

        if (companyError || !newCompany) throw new Error("Erro ao criar empresa");
        companyId = newCompany.id;
      }

      // 2. Create project with status 'pending'
      const { data: existingProject } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("onboarding_company_id", companyId)
        .eq("product_id", service.slug || service.id)
        .maybeSingle();

      let projectId: string;

      if (existingProject) {
        projectId = existingProject.id;
      } else {
        const { data: project, error: projectError } = await supabase
          .from("onboarding_projects")
          .insert({
            product_id: service.slug || service.id,
            product_name: service.name,
            onboarding_company_id: companyId,
            status: "pending",
            crm_lead_id: lead.id,
          } as any)
          .select("id")
          .single();

        if (projectError || !project) throw new Error("Erro ao criar projeto");
        projectId = project.id;
      }

      // 3. Generate payment charge
      const amountCents = Math.round(amount * 100);
      const edgeFunction = edgeFunctionMap[provider];

      const { data: chargeData, error: chargeError } = await supabase.functions.invoke(edgeFunction, {
        body: {
          customer_name: companyName,
          customer_email: email,
          customer_phone: phone,
          customer_document: document,
          product_name: description,
          amount_cents: amountCents,
          payment_method: paymentMethod,
          installments: 1,
          company_id: companyId,
        },
      });

      if (chargeError) throw chargeError;
      if (chargeData?.error) throw new Error(chargeData.error);

      // 4. Create invoice + payment_link
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const paymentLinkUrl = chargeData?.pix_qr_code || chargeData?.boleto_url || chargeData?.checkout_url || chargeData?.invoice_url || "";

      const { data: invoiceData } = await supabase
        .from("company_invoices")
        .insert({
          company_id: companyId,
          description,
          amount_cents: amountCents,
          due_date: dueDateStr,
          installment_number: 1,
          total_installments: 1,
          status: chargeData?.paid ? "paid" : "pending",
        } as any)
        .select("id")
        .single();

      if (invoiceData) {
        const baseUrl = "https://elevate-exec-direction.lovable.app";
        const { data: linkData } = await supabase
          .from("payment_links")
          .insert({
            description: `[${providers.find((p) => p.id === provider)?.label}] ${description}`,
            amount_cents: amountCents,
            payment_method: paymentMethod,
            installments: 1,
            url: paymentLinkUrl || "pending",
            company_id: companyId,
            provider,
          } as any)
          .select("id")
          .single();

        if (linkData) {
          const fullUrl = paymentLinkUrl || `${baseUrl}/#/checkout?link_id=${linkData.id}&amount=${amountCents}&product=${encodeURIComponent(description)}`;
          if (!paymentLinkUrl) {
            await supabase.from("payment_links").update({ url: fullUrl } as any).eq("id", linkData.id);
          }
          await supabase
            .from("company_invoices")
            .update({ payment_link_id: linkData.id, payment_link_url: fullUrl } as any)
            .eq("id", (invoiceData as any).id);
        }
      }

      // 5. Register in lead history
      await supabase.from("crm_lead_history").insert({
        lead_id: lead.id,
        action: "converted_to_company",
        notes: `Empresa "${companyName}" criada com projeto "${service.name}" (pendente de pagamento). Cobrança de R$ ${amount.toFixed(2)} gerada via ${provider}.`,
        new_value: companyId,
      });

      // 6. If payment already confirmed, activate project
      if (chargeData?.paid || chargeData?.status === "paid") {
        await supabase
          .from("onboarding_projects")
          .update({ status: "active" })
          .eq("id", projectId);
        await supabase
          .from("onboarding_companies")
          .update({ status: "active", contract_start_date: new Date().toISOString().split("T")[0] })
          .eq("id", companyId);
        toast.success("🎉 Empresa criada, pagamento confirmado e projeto ativado!");
      } else {
        toast.success("Empresa e projeto criados! O projeto será ativado após a confirmação do pagamento.");
      }

      onOpenChange(false);
      onSuccess?.();
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
          {/* Company Info */}
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
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Product */}
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

          {/* Payment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Cobrança
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor *</Label>
                <CurrencyInput value={amount} onChange={setAmount} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provedor</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as PaymentProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p>
              O projeto será criado com status <strong>pendente</strong> e ativado
              automaticamente assim que o pagamento for confirmado.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleConvert} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Empresa e Cobrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

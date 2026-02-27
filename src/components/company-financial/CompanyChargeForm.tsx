import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, CreditCard, QrCode, FileText } from "lucide-react";

interface Props {
  companyId: string;
  companyName: string;
  contractValue?: number;
  customerEmail?: string;
  customerPhone?: string;
}

export function CompanyChargeForm({ companyId, companyName, contractValue, customerEmail, customerPhone }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: `Serviço - ${companyName}`,
    amount: contractValue || 0,
    paymentMethod: "pix" as string,
    installments: 1,
    customerName: companyName,
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    customerDocument: "",
  });
  const [result, setResult] = useState<any>(null);

  const handleCharge = async () => {
    if (!form.amount || form.amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!form.customerEmail) {
      toast.error("Email do cliente é obrigatório");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: {
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          customer_phone: form.customerPhone,
          customer_document: form.customerDocument,
          product_name: form.description,
          amount_cents: Math.round(form.amount * 100),
          payment_method: form.paymentMethod,
          installments: form.installments,
          company_id: companyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update the order with company_id
      if (data?.order_id) {
        await supabase
          .from("pagarme_orders")
          .update({ company_id: companyId } as any)
          .eq("pagarme_order_id", data.order_id);
      }

      setResult(data);
      toast.success("Cobrança gerada com sucesso!");
    } catch (err: any) {
      console.error("Charge error:", err);
      toast.error(err.message || "Erro ao gerar cobrança");
    } finally {
      setLoading(false);
    }
  };

  const minInstallmentValue = 5000; // R$ 50.00 in cents
  const maxInstallments = Math.min(12, Math.max(1, Math.floor((form.amount * 100) / minInstallmentValue)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Gerar Cobrança Avulsa
        </CardTitle>
        <CardDescription>Cobre via PIX, cartão de crédito ou boleto usando Asaas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Consultoria - Janeiro/2026"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <CurrencyInput
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Cliente</Label>
            <Input
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Email do Cliente *</Label>
            <Input
              type="email"
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              placeholder="cliente@empresa.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input
              value={form.customerDocument}
              onChange={(e) => setForm({ ...form, customerDocument: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v, installments: 1 })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.paymentMethod === "credit_card" && (
          <div className="space-y-2 max-w-xs">
            <Label>Parcelas</Label>
            <Select
              value={String(form.installments)}
              onValueChange={(v) => setForm({ ...form, installments: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.max(1, maxInstallments) }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x de R$ {((form.amount / n)).toFixed(2).replace(".", ",")}
                    {n === 1 ? " (à vista)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleCharge} disabled={loading} className="w-full">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Gerar Cobrança
        </Button>

        {/* Result display */}
        {result && (
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                {result.payment_method === "pix" && <QrCode className="h-5 w-5 text-green-500" />}
                {result.payment_method === "boleto" && <FileText className="h-5 w-5 text-orange-500" />}
                {result.payment_method === "credit_card" && <CreditCard className="h-5 w-5 text-blue-500" />}
                <span className="font-semibold">
                  {result.paid ? "✅ Pagamento Aprovado" : result.status === "pending" ? "⏳ Aguardando Pagamento" : `Status: ${result.status}`}
                </span>
              </div>

              {result.pix_qr_code && (
                <div className="space-y-2">
                  <Label>PIX Copia e Cola:</Label>
                  <div className="flex gap-2">
                    <Input value={result.pix_qr_code} readOnly className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result.pix_qr_code);
                        toast.success("Código PIX copiado!");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  {result.pix_qr_code_url && (
                    <img src={result.pix_qr_code_url} alt="QR Code PIX" className="w-48 h-48 mx-auto" />
                  )}
                </div>
              )}

              {result.boleto_url && (
                <Button type="button" variant="outline" asChild>
                  <a href={result.boleto_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    Abrir Boleto
                  </a>
                </Button>
              )}

              <p className="text-xs text-muted-foreground">Pedido: {result.order_id}</p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

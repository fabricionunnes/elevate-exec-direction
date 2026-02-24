import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, QrCode, FileText, Loader2, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PaymentMethod = "credit_card" | "pix" | "boleto";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  amountCents: number;
  priceLabel: string;
  paymentLinkId?: string;
}

interface CheckoutResult {
  success: boolean;
  payment_method: PaymentMethod;
  status: string;
  order_id: string;
  paid?: boolean;
  pix_qr_code?: string;
  pix_qr_code_url?: string;
  pix_expires_at?: string;
  boleto_url?: string;
  boleto_barcode?: string;
}

const paymentMethods = [
  { id: "credit_card" as const, label: "Cartão de Crédito", icon: CreditCard },
  { id: "pix" as const, label: "PIX", icon: QrCode },
  { id: "boleto" as const, label: "Boleto", icon: FileText },
];

export function CheckoutModal({
  open,
  onOpenChange,
  productId,
  productName,
  amountCents,
  priceLabel,
  paymentLinkId,
}: CheckoutModalProps) {
  const [step, setStep] = useState<"form" | "result">("form");
  const [method, setMethod] = useState<PaymentMethod>("credit_card");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [installments, setInstallments] = useState(1);

  const resetForm = () => {
    setStep("form");
    setResult(null);
    setName("");
    setEmail("");
    setPhone("");
    setDocument("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardHolder("");
    setInstallments(1);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const formatDocument = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) {
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10)
      return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  };

  const formatCardNumber = (v: string) => {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.replace(/(\d{2})(\d)/, "$1/$2");
  };

  const handleSubmit = async () => {
    if (!name || !email || !document) {
      toast.error("Preencha nome, email e CPF/CNPJ");
      return;
    }

    setLoading(true);
    try {
      // For credit card, we'd need card tokenization via Pagar.me JS SDK
      // For now, we send card data to the edge function which handles it
      const payload: Record<string, unknown> = {
        customer_name: name,
        customer_email: email,
        customer_phone: phone.replace(/\D/g, ""),
        customer_document: document.replace(/\D/g, ""),
        product_id: productId,
        product_name: productName,
        amount_cents: amountCents,
        payment_method: method,
        installments,
        payment_link_id: paymentLinkId || null,
      };

      if (method === "credit_card") {
        // Note: In production, use Pagar.me's JS SDK to tokenize the card
        // For now we pass card details to the edge function
        payload.card_number = cardNumber.replace(/\s/g, "");
        payload.card_expiry = cardExpiry;
        payload.card_cvv = cardCvv;
        payload.card_holder = cardHolder;
      }

      const { data, error } = await supabase.functions.invoke("pagarme-checkout", {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data as CheckoutResult);
      setStep("result");

      if (data.paid) {
        toast.success("Pagamento aprovado!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const maxInstallments = Math.min(12, Math.floor(amountCents / 100 / 50)); // min R$50 per installment

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Comprar {productName}</DialogTitle>
          <DialogDescription>
            Valor: <span className="font-semibold text-foreground">{priceLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5">
            {/* Payment Method Selector */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Forma de Pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setMethod(pm.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-sm",
                      method === pm.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground"
                    )}
                  >
                    <pm.icon className="h-5 w-5" />
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="checkout-name">Nome Completo *</Label>
                <Input id="checkout-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <Label htmlFor="checkout-email">Email *</Label>
                <Input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="checkout-doc">CPF/CNPJ *</Label>
                  <Input id="checkout-doc" value={document} onChange={(e) => setDocument(formatDocument(e.target.value))} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                </div>
                <div>
                  <Label htmlFor="checkout-phone">Telefone</Label>
                  <Input id="checkout-phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>

            {/* Card fields */}
            {method === "credit_card" && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <Label htmlFor="card-number">Número do Cartão</Label>
                  <Input id="card-number" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" />
                </div>
                <div>
                  <Label htmlFor="card-holder">Nome no Cartão</Label>
                  <Input id="card-holder" value={cardHolder} onChange={(e) => setCardHolder(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARTÃO" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="card-expiry">Validade</Label>
                    <Input id="card-expiry" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" />
                  </div>
                  <div>
                    <Label htmlFor="card-cvv">CVV</Label>
                    <Input id="card-cvv" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="000" />
                  </div>
                </div>
                {maxInstallments > 1 && (
                  <div>
                    <Label htmlFor="installments">Parcelas</Label>
                    <select
                      id="installments"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                    >
                      {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x de R$ {((amountCents / 100) / n).toFixed(2).replace(".", ",")}
                          {n === 1 ? " (à vista)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {method === "pix" && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm text-muted-foreground">
                <QrCode className="h-5 w-5 mb-2 text-primary" />
                Após confirmar, você receberá o QR Code para pagamento instantâneo via PIX.
              </div>
            )}

            {method === "boleto" && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-sm text-muted-foreground">
                <FileText className="h-5 w-5 mb-2 text-primary" />
                O boleto será gerado com vencimento em 3 dias úteis.
              </div>
            )}

            <Button
              variant="premium"
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>Confirmar Pagamento</>
              )}
            </Button>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            {result.paid && (
              <div className="text-center py-6">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Pagamento Aprovado!</h3>
                <p className="text-muted-foreground mt-1">
                  Seu acesso ao {productName} será liberado em breve.
                </p>
              </div>
            )}

            {result.payment_method === "pix" && result.pix_qr_code && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Pague via PIX</h3>
                {result.pix_qr_code_url && (
                  <img
                    src={result.pix_qr_code_url}
                    alt="QR Code PIX"
                    className="mx-auto w-48 h-48 rounded-lg border"
                  />
                )}
                <div className="relative">
                  <Input
                    readOnly
                    value={result.pix_qr_code}
                    className="pr-10 text-xs"
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => {
                      navigator.clipboard.writeText(result.pix_qr_code!);
                      toast.success("Código copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code ou copie o código acima para pagar.
                </p>
              </div>
            )}

            {result.payment_method === "boleto" && result.boleto_url && (
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold">Boleto Gerado</h3>
                <a
                  href={result.boleto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Abrir Boleto
                  </Button>
                </a>
                {result.boleto_barcode && (
                  <div className="relative">
                    <Input readOnly value={result.boleto_barcode} className="pr-10 text-xs" />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        navigator.clipboard.writeText(result.boleto_barcode!);
                        toast.success("Código de barras copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

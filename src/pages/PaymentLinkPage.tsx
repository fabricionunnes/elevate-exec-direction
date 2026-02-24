import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, QrCode, FileText, Loader2, Check, Copy, Link2, ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/ui/currency-input";

type PaymentMethod = "credit_card" | "pix" | "boleto";

const paymentMethods = [
  { id: "credit_card" as const, label: "Cartão de Crédito", icon: CreditCard },
  { id: "pix" as const, label: "PIX", icon: QrCode },
  { id: "boleto" as const, label: "Boleto", icon: FileText },
];

interface GeneratedLink {
  method: PaymentMethod;
  amount: number;
  installments: number;
  description: string;
  url: string;
  isRecurring: boolean;
}

export default function PaymentLinkPage() {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);

  const maxInstallments = method === "credit_card" 
    ? Math.max(1, Math.min(12, Math.floor(amount / 50)))
    : 1;

  const handleGenerate = async () => {
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descrição para o pagamento");
      return;
    }

    const amountCents = Math.round(amount * 100);

    // Build the checkout URL with params
    const params = new URLSearchParams({
      product: description.trim(),
      amount: amountCents.toString(),
      method,
      installments: installments.toString(),
    });

    if (isRecurring) {
      params.set("recurring", "true");
    }

    // Use published URL so links work publicly without Lovable auth
    const publishedUrl = "https://elevate-exec-direction.lovable.app";
    const link = `${publishedUrl}/#/checkout?${params.toString()}`;

    const newLink: GeneratedLink = {
      method,
      amount,
      installments,
      description: description.trim(),
      url: link,
      isRecurring,
    };

    setGeneratedLinks((prev) => [newLink, ...prev]);
    toast.success("Link de pagamento gerado!");
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const methodLabel = (m: PaymentMethod) =>
    m === "credit_card" ? "Cartão" : m === "pix" ? "PIX" : "Boleto";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerador de Links de Pagamento</h1>
            <p className="text-muted-foreground text-sm">Crie links para cobrar seus clientes via PIX, Boleto ou Cartão</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo Link</CardTitle>
            <CardDescription>Configure o valor e a forma de pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Description */}
            <div>
              <Label htmlFor="pay-desc">Descrição do Pagamento *</Label>
              <Input
                id="pay-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Serviço - Nome do cliente"
                maxLength={200}
              />
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="pay-amount">Valor (R$) *</Label>
              <CurrencyInput
                id="pay-amount"
                value={amount}
                onChange={setAmount}
                placeholder="0,00"
              />
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Forma de Pagamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => {
                      setMethod(pm.id);
                      if (pm.id !== "credit_card") setInstallments(1);
                    }}
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

            {/* Installments (credit card only) */}
            {method === "credit_card" && !isRecurring && maxInstallments > 1 && (
              <div>
                <Label htmlFor="pay-installments">Parcelas</Label>
                <select
                  id="pay-installments"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de R$ {(amount / n).toFixed(2).replace(".", ",")}
                      {n === 1 ? " (à vista)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recurrence toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <Checkbox
                id="pay-recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(checked === true);
                  if (checked) setInstallments(1);
                }}
              />
              <div className="flex-1">
                <Label htmlFor="pay-recurring" className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Cobrança Recorrente (mensal)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O cliente será cobrado automaticamente todo mês, sem comprometer o limite do cartão.
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
              ) : (
                <><Link2 className="mr-2 h-4 w-4" /> Gerar Link de Pagamento</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Links */}
        {generatedLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Links Gerados</CardTitle>
              <CardDescription>{generatedLinks.length} link(s) criado(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {generatedLinks.map((link, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {link.description}
                      {link.isRecurring && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          <RefreshCw className="h-3 w-3" /> Recorrente
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      R$ {link.amount.toFixed(2).replace(".", ",")} • {methodLabel(link.method)}
                      {link.installments > 1 ? ` • ${link.installments}x` : ""}
                      {link.isRecurring ? " • Mensal" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{link.url}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(link.url)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

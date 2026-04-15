import { useState } from "react";
import { ServiceData } from "@/pages/ServiceSalesPage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Check, Copy, QrCode, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  service: ServiceData;
  formatPrice: (price: number) => string;
}

interface PurchaseResult {
  invoice_url?: string;
  pix_qr_code?: string;
  pix_qr_code_url?: string;
}

export function ServiceSalesPurchaseSection({ service, formatPrice }: Props) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerDocument, setBuyerDocument] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerEmail.trim()) {
      toast.error("Preencha nome e email");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-service-purchase", {
        body: {
          service_catalog_id: service.id,
          buyer_name: buyerName.trim(),
          buyer_email: buyerEmail.trim(),
          buyer_phone: buyerPhone.trim() || undefined,
          buyer_document: buyerDocument.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        invoice_url: data.invoice_url,
        pix_qr_code: data.pix_qr_code,
        pix_qr_code_url: data.pix_qr_code_url,
      });
      toast.success("Cobrança gerada com sucesso!");
    } catch (err: any) {
      console.error("Purchase error:", err);
      toast.error(err.message || "Erro ao processar a compra");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyPix = () => {
    if (result?.pix_qr_code) {
      navigator.clipboard.writeText(result.pix_qr_code);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <section id="comprar" className="py-20 px-4 bg-[hsl(214,65%,18%)]">
      <div className="max-w-lg mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          {result ? "Pagamento Gerado!" : "Contrate Agora"}
        </h2>

        {!result ? (
          <>
            <p className="text-white/50 text-center mb-8">
              Preencha seus dados para gerar a cobrança
            </p>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-6">
              <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-white/10">
                <span className="font-semibold text-white">{service.name}</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[hsl(355,85%,50%)]">
                    {formatPrice(service.price)}
                  </span>
                  {service.billing_type === "monthly" && (
                    <span className="text-white/40 text-sm">/mês</span>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-white/70 text-sm">Nome completo *</Label>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Email *</Label>
                  <Input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Telefone (WhatsApp)</Label>
                  <Input
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">CPF ou CNPJ</Label>
                  <Input
                    value={buyerDocument}
                    onChange={(e) => setBuyerDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={processing}
                  className="w-full bg-[hsl(355,85%,50%)] hover:bg-[hsl(355,85%,45%)] text-white py-6 text-lg font-bold rounded-xl"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Gerar Cobrança
                    </>
                  )}
                </Button>
              </form>
            </div>

            <p className="text-center text-white/30 text-xs">
              Pagamento processado de forma segura. Ao contratar, você concorda com nossos termos de uso.
            </p>
          </>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <Check className="h-6 w-6" />
              <span className="font-semibold text-lg">Cobrança gerada com sucesso!</span>
            </div>

            <p className="text-white/60 text-center text-sm">
              O acesso ao módulo "{service.name}" será liberado automaticamente após a confirmação do pagamento.
            </p>

            {result.pix_qr_code_url && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-medium text-white flex items-center gap-1">
                  <QrCode className="h-4 w-4" /> PIX QR Code
                </p>
                <img
                  src={result.pix_qr_code_url}
                  alt="PIX QR Code"
                  className="w-48 h-48 rounded-lg"
                />
                {result.pix_qr_code && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPix}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar código PIX
                  </Button>
                )}
              </div>
            )}

            {result.invoice_url && (
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => window.open(result.invoice_url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Boleto para Pagamento
              </Button>
            )}

            <p className="text-xs text-white/30 text-center">
              O PIX é processado instantaneamente. O boleto pode levar até 3 dias úteis para compensar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

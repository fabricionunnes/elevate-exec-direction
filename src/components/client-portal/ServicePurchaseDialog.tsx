import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  ShoppingCart,
  Check,
  ExternalLink,
  Copy,
  QrCode,
} from "lucide-react";

interface ServiceCatalogItem {
  id: string;
  menu_key: string;
  name: string;
  description: string | null;
  price: number;
  billing_type: "monthly" | "one_time";
}

interface ServicePurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceCatalogItem;
  projectId: string;
  currentUserId: string;
  onPurchaseComplete: () => void;
}

interface PurchaseResult {
  invoice_url?: string;
  pix_qr_code?: string;
  pix_qr_code_url?: string;
}

export function ServicePurchaseDialog({
  open,
  onOpenChange,
  service,
  projectId,
  currentUserId,
  onPurchaseComplete,
}: ServicePurchaseDialogProps) {
  const [step, setStep] = useState<"confirm" | "processing" | "result">("confirm");
  const [result, setResult] = useState<PurchaseResult | null>(null);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const handlePurchase = async () => {
    setStep("processing");
    try {
      const { data, error } = await supabase.functions.invoke("asaas-service-purchase", {
        body: {
          project_id: projectId,
          service_catalog_id: service.id,
          menu_key: service.menu_key,
          billing_type: service.billing_type,
          amount_cents: Math.round(service.price * 100),
          service_name: service.name,
          purchased_by: currentUserId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({
        invoice_url: data.invoice_url,
        pix_qr_code: data.pix_qr_code,
        pix_qr_code_url: data.pix_qr_code_url,
      });
      setStep("result");
      toast.success(`Serviço "${service.name}" contratado com sucesso!`);
    } catch (err: any) {
      console.error("Purchase error:", err);
      toast.error(err.message || "Erro ao processar a compra");
      setStep("confirm");
    }
  };

  const handleCopyPix = () => {
    if (result?.pix_qr_code) {
      navigator.clipboard.writeText(result.pix_qr_code);
      toast.success("Código PIX copiado!");
    }
  };

  const handleClose = () => {
    if (step === "result") {
      onPurchaseComplete();
    }
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep("confirm");
      setResult(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Confirmar Compra
              </DialogTitle>
              <DialogDescription>
                Revise os detalhes antes de confirmar a contratação.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold">{service.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {service.billing_type === "monthly" ? "Mensal" : "Único"}
                  </Badge>
                </div>
                {service.description && (
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                )}
                <div className="pt-2 border-t">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(service.price)}
                    </span>
                    {service.billing_type === "monthly" && (
                      <span className="text-sm text-muted-foreground">/mês</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium">Como funciona:</p>
                {service.billing_type === "monthly" ? (
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Será gerado um boleto mensal para pagamento</li>
                    <li>O módulo será liberado imediatamente</li>
                    <li>Se houver atraso, o módulo será bloqueado temporariamente</li>
                    <li>Pagando em dia, o acesso é mantido normalmente</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Será gerado um boleto único para pagamento</li>
                    <li>O módulo será liberado imediatamente</li>
                    <li>Acesso por tempo indeterminado após pagamento</li>
                  </ul>
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handlePurchase}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Confirmar Compra
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando sua compra...</p>
            <p className="text-xs text-muted-foreground">Gerando cobrança no sistema</p>
          </div>
        )}

        {step === "result" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Compra Realizada!
              </DialogTitle>
              <DialogDescription>
                O módulo "{service.name}" já está liberado para uso.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {result.pix_qr_code_url && (
                <div className="flex flex-col items-center gap-3 p-4 rounded-lg border">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <QrCode className="h-4 w-4" /> PIX QR Code
                  </p>
                  <img
                    src={result.pix_qr_code_url}
                    alt="PIX QR Code"
                    className="w-48 h-48"
                  />
                  {result.pix_qr_code && (
                    <Button variant="outline" size="sm" onClick={handleCopyPix}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar código PIX
                    </Button>
                  )}
                </div>
              )}

              {result.invoice_url && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(result.invoice_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Boleto para Pagamento
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                O link de pagamento também aparecerá no menu Financeiro.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Entendi
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

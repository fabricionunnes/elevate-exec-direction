import { useSearchParams } from "react-router-dom";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [linkData, setLinkData] = useState<{
    product: string;
    amountCents: number;
    linkId?: string;
    paymentMethod?: string;
    installments?: number;
  } | null>(null);

  const linkId = searchParams.get("link_id");
  const directAmount = Number(searchParams.get("amount")) || 0;
  const directProduct = searchParams.get("product") || "Pagamento";
  const directMethodParam = searchParams.get("method");
  const directInstallments = Number(searchParams.get("installments")) || 1;

  useEffect(() => {
    const resolveLinkData = async () => {
      if (linkId) {
        setLoading(true);

        const { data, error } = await supabase
          .from("payment_links")
          .select("id, description, amount_cents, payment_method, installments")
          .eq("id", linkId)
          .maybeSingle();

        if (!error && data) {
          setLinkData({
            product: (data as any).description || "Pagamento",
            amountCents: (data as any).amount_cents,
            linkId: (data as any).id,
            paymentMethod: (data as any).payment_method,
            installments: (data as any).installments,
          });
          setLoading(false);
          return;
        }

        if (directAmount > 0) {
          setLinkData({
            product: directProduct,
            amountCents: directAmount,
            linkId,
            paymentMethod: directMethodParam || undefined,
            installments: directInstallments,
          });
        } else {
          setLinkData(null);
        }

        setLoading(false);
        return;
      }

      if (directAmount > 0) {
        setLinkData({
          product: directProduct,
          amountCents: directAmount,
          paymentMethod: directMethodParam || undefined,
          installments: directInstallments,
        });
      } else {
        setLinkData(null);
      }
    };

    resolveLinkData();
  }, [linkId, directAmount, directProduct, directMethodParam, directInstallments]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!linkData || !linkData.amountCents) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Link de pagamento inválido.</p>
      </div>
    );
  }

  const priceLabel = `R$ ${(linkData.amountCents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <CheckoutModal
        open={open}
        onOpenChange={setOpen}
        productId="payment-link"
        productName={linkData.product}
        amountCents={linkData.amountCents}
        priceLabel={priceLabel}
        paymentLinkId={linkData.linkId}
      />
      {!open && (
        <p className="text-muted-foreground">Pagamento fechado. Você pode fechar esta janela.</p>
      )}
    </div>
  );
}

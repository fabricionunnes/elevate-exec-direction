import { useSearchParams } from "react-router-dom";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { useState, useEffect } from "react";

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(true);

  const product = searchParams.get("product") || "Pagamento";
  const amountCents = Number(searchParams.get("amount")) || 0;
  const priceLabel = `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")}`;

  if (!amountCents) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Link de pagamento inválido.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <CheckoutModal
        open={open}
        onOpenChange={setOpen}
        productId="payment-link"
        productName={product}
        amountCents={amountCents}
        priceLabel={priceLabel}
      />
      {!open && (
        <p className="text-muted-foreground">Pagamento fechado. Você pode fechar esta janela.</p>
      )}
    </div>
  );
}

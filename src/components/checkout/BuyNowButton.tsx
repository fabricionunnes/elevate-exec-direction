import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import { ArrowRight } from "lucide-react";

interface BuyNowButtonProps {
  productId: string;
  productName: string;
  amountCents: number;
  priceLabel: string;
  label?: string;
  variant?: "hero" | "premium" | "premium-outline";
  size?: "default" | "sm" | "lg" | "xl";
  className?: string;
}

export function BuyNowButton({
  productId,
  productName,
  amountCents,
  priceLabel,
  label = "Comprar Agora",
  variant = "hero",
  size = "xl",
  className,
}: BuyNowButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
        <ArrowRight className="ml-2" />
      </Button>
      <CheckoutModal
        open={open}
        onOpenChange={setOpen}
        productId={productId}
        productName={productName}
        amountCents={amountCents}
        priceLabel={priceLabel}
      />
    </>
  );
}

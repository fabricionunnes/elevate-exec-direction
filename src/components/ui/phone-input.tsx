import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Aplica máscara de telefone brasileiro: (99) 99999-9999
 */
export function formatPhoneMask(value: string): string {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, "");

  // Número já com DDI (+55), como os que vêm da Prospecção B2B — número
  // local do Brasil nunca passa de 11 dígitos, então 12+ começando com 55
  // só pode ser DDI, nunca um DDD real "55" (Santa Maria/RS). Sem isso a
  // máscara lia o "55" do DDI como DDD e cortava os 2 últimos dígitos.
  if (digits.length >= 12 && digits.startsWith("55")) {
    const resto = digits.slice(2, 13);
    const ddd = resto.slice(0, 2);
    const numero = resto.slice(2);
    if (numero.length <= 4) return `+55 (${ddd}) ${numero}`;
    if (numero.length <= 9) return `+55 (${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
    return `+55 (${ddd}) ${numero.slice(0, 5)}-${numero.slice(5, 9)}`;
  }

  const local = digits.slice(0, 11);
  if (local.length === 0) return "";
  if (local.length <= 2) return `(${local}`;
  if (local.length <= 7) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
}

/**
 * Remove a máscara e retorna apenas os dígitos
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, "");
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    // Formata o valor para exibição
    const displayValue = formatPhoneMask(value || "");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Armazena apenas os dígitos
      const digitsOnly = unformatPhone(newValue);
      onChange(digitsOnly);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder="(11) 99999-9999"
        className={cn(className)}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };

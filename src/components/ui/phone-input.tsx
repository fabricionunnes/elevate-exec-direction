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
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
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

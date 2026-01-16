import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: number | undefined;
  onChange: (value: number) => void;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseCurrency = (value: string): number => {
  // Remove all non-numeric characters except last comma/period for decimals
  const cleanValue = value.replace(/[^\d]/g, "");
  if (!cleanValue) return 0;
  
  // Convert to number (last 2 digits are decimals)
  const numericValue = parseInt(cleanValue, 10) / 100;
  return numericValue;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setDisplayValue(formatCurrency(value));
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const numericValue = parseCurrency(rawValue);
      
      // Limit to reasonable values (up to 999 billion)
      if (numericValue <= 999999999999.99) {
        setDisplayValue(formatCurrency(numericValue));
        onChange(numericValue);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all on focus for easy editing
      e.target.select();
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };

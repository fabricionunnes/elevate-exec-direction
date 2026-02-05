import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CardColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  { color: null, label: "Sem cor" },
  { color: "#ef4444", label: "Vermelho" },
  { color: "#f97316", label: "Laranja" },
  { color: "#eab308", label: "Amarelo" },
  { color: "#22c55e", label: "Verde" },
  { color: "#06b6d4", label: "Ciano" },
  { color: "#3b82f6", label: "Azul" },
  { color: "#8b5cf6", label: "Violeta" },
  { color: "#ec4899", label: "Rosa" },
  { color: "#6b7280", label: "Cinza" },
];

export const CardColorPicker = ({
  value,
  onChange,
  disabled,
}: CardColorPickerProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((preset, idx) => (
        <button
          key={idx}
          type="button"
          className={cn(
            "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
            value === preset.color
              ? "border-primary ring-2 ring-primary/30"
              : "border-transparent hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            backgroundColor: preset.color || "transparent",
            border: preset.color === null ? "2px dashed hsl(var(--muted-foreground))" : undefined,
          }}
          onClick={() => !disabled && onChange(preset.color)}
          title={preset.label}
          disabled={disabled}
        >
          {value === preset.color && (
            <Check
              className={cn(
                "h-4 w-4",
                preset.color ? "text-white" : "text-muted-foreground"
              )}
            />
          )}
        </button>
      ))}
    </div>
  );
};

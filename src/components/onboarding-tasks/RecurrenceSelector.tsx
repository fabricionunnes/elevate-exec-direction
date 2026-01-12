import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Única (sem recorrência)" },
  { value: "daily_weekdays", label: "Diária (Seg - Sex)" },
  { value: "daily_all_days", label: "Diária (Todos os dias)" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
];

interface RecurrenceSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export const RecurrenceSelector = ({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: RecurrenceSelectorProps) => {
  const handleChange = (selectedValue: string) => {
    onChange(selectedValue === "none" ? null : selectedValue);
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Recorrência
        </Label>
      )}
      <Select
        value={value || "none"}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione a recorrência..." />
        </SelectTrigger>
        <SelectContent>
          {RECURRENCE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && value !== "none" && (
        <p className="text-xs text-muted-foreground">
          Ao concluir esta tarefa, uma nova será criada automaticamente para a próxima data.
        </p>
      )}
    </div>
  );
};

export const getRecurrenceLabel = (recurrence: string | null): string => {
  if (!recurrence) return "";
  const option = RECURRENCE_OPTIONS.find((opt) => opt.value === recurrence);
  return option?.label || recurrence;
};

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  allLabel?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder = "Filtrar",
  className,
  allLabel = "Todos",
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  const isAll = selected.length === 0;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const displayLabel = React.useMemo(() => {
    if (isAll) return allLabel;
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? selected[0];
    }
    return `${selected.length} selecionados`;
  }, [isAll, selected, options, allLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="p-2 space-y-1">
          {/* "All" option */}
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
              isAll && "bg-accent text-accent-foreground"
            )}
            onClick={() => clearAll()}
          >
            <div className={cn(
              "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
              isAll ? "bg-primary text-primary-foreground" : "opacity-50"
            )}>
              {isAll && <Check className="h-3 w-3" />}
            </div>
            {allLabel}
          </button>

          <div className="h-px bg-border my-1" />

          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  isSelected && "bg-accent/50"
                )}
                onClick={() => toggle(option.value)}
              >
                <div className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                  isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                )}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                {option.label}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar filtros
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

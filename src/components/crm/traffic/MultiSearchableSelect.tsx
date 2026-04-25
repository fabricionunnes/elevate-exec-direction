import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MultiOption {
  value: string;
  label: string;
}

interface Props {
  values: string[];
  onChange: (vals: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
  allLabel?: string;
  emptyText?: string;
  className?: string;
}

export const MultiSearchableSelect = ({
  values, onChange, options, placeholder = "Selecionar…",
  allLabel = "Todos", emptyText = "Nenhum resultado", className,
}: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };

  const allSelected = values.length === 0;
  const label =
    allSelected
      ? allLabel
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label || placeholder
        : `${values.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("h-9 w-full justify-between text-xs font-normal", className)}
        >
          <span className="truncate">{label}</span>
          <span className="flex items-center gap-1">
            {!allSelected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="p-0.5 rounded hover:bg-muted"
                aria-label="Limpar seleção"
              >
                <X className="h-3 w-3 opacity-60" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para buscar…" className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <div className="flex items-center justify-between px-2 py-1.5 border-b">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => onChange(options.map((o) => o.value))}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Marcar tudo
                </button>
              </div>
              {options.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.value}`}
                    onSelect={() => toggle(o.value)}
                    className="gap-2"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

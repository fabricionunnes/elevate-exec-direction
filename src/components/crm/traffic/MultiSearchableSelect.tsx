import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface MultiOption {
  value: string;
  label: string;
}

interface Props {
  values: string[];
  onChange: (v: string[]) => void;
  options: MultiOption[];
  placeholder?: string;
  emptyText?: string;
  allLabel?: string;
  className?: string;
}

/**
 * Multi-select com busca. Quando `values` está vazio = "todos".
 */
export const MultiSearchableSelect = ({
  values, onChange, options,
  placeholder = "Selecionar…",
  emptyText = "Nenhum resultado",
  allLabel = "Todos",
  className,
}: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const label = (() => {
    if (values.length === 0) return allLabel;
    if (values.length === 1) {
      return options.find((o) => o.value === values[0])?.label || placeholder;
    }
    return `${values.length} selecionados`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("h-9 w-full justify-between text-xs font-normal", className)}
        >
          <span className="truncate flex items-center gap-1.5">
            {values.length > 1 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{values.length}</Badge>
            )}
            <span className="truncate">{label}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {values.length > 0 && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={clearAll}
              />
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para buscar…" className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange([]);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", values.length === 0 ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{allLabel}</span>
              </CommandItem>
              {options.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
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

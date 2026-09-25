// Filtro de várias opções com busca por digitação (25/09/2026).
// Mesma ideia do SearchableSelect, mas aceita marcar mais de um item.
import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface Opcao {
  value: string;
  label: string;
}

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  options: Opcao[];
  /** texto quando nada está marcado, que também é o "todos" */
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSearchableSelect({
  values,
  onChange,
  options,
  placeholder = "Todos",
  emptyMessage = "Nenhum resultado.",
  className,
  disabled = false,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const marcados = new Set(values);
  const alternar = (v: string) => {
    const novo = new Set(marcados);
    if (novo.has(v)) novo.delete(v); else novo.add(v);
    onChange([...novo]);
  };

  const rotulo = () => {
    if (!values.length) return placeholder;
    if (values.length === 1) return options.find((o) => o.value === values[0])?.label || "1 escolhido";
    return `${values.length} escolhidos`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !values.length && "text-muted-foreground", className)}
        >
          <span className="truncate flex items-center gap-2">
            {rotulo()}
            {values.length > 1 && <Badge variant="secondary" className="text-[10px]">{values.length}</Badge>}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {!!values.length && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__todos__" onSelect={() => { onChange([]); }}>
                <Check className={cn("mr-2 h-4 w-4", !values.length ? "opacity-100" : "opacity-0")} />
                {placeholder}
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => alternar(o.value)}>
                  <Check className={cn("mr-2 h-4 w-4", marcados.has(o.value) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

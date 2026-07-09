import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  verbas: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** Seletor de verba com busca por digitação; aceita texto livre para verbas novas. */
export function CfinVerbaCombobox({ verbas, value, onChange, placeholder = "Digite para buscar…" }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return verbas.slice(0, 80);
    return verbas.filter(v => v.toUpperCase().includes(q)).slice(0, 80);
  }, [verbas, busca]);

  const textoNovo = busca.trim() && !verbas.some(v => v.toUpperCase() === busca.trim().toUpperCase());

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite para buscar…" value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhuma verba encontrada.</CommandEmpty>
            {textoNovo && (
              <CommandGroup>
                <CommandItem value={`__nova__${busca}`} onSelect={() => { onChange(busca.trim().toUpperCase()); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Usar nova verba: <b className="ml-1">{busca.trim().toUpperCase()}</b>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtradas.map(v => (
                <CommandItem key={v} value={v} onSelect={() => { onChange(v); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === v ? "opacity-100" : "opacity-0")} />
                  {v}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

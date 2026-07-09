import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Opcao { id: number; label: string }

interface Props {
  opcoes: Opcao[];
  value: number | null;
  onChange: (id: number) => void;
  placeholder?: string;
}

/** Seletor de funcionário com busca por digitação (nome ou código). */
export function CfinFuncCombobox({ opcoes, value, onChange, placeholder = "Digite o nome…" }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter(o => o.label.toLowerCase().includes(q));
  }, [opcoes, busca]);

  const sel = opcoes.find(o => o.id === value);

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !sel && "text-muted-foreground")}>{sel ? sel.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou código…" value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-64">
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              {filtradas.map(o => (
                <CommandItem key={o.id} value={o.label} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

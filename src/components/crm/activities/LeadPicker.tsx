import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedLead {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
}

interface LeadPickerProps {
  value: PickedLead | null;
  onChange: (lead: PickedLead) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Escolher um lead digitando nome, empresa ou telefone. A busca vai ao banco (a base
 * passa de 100 mil leads, não dá pra carregar tudo); sem texto, mostra os mais recentes.
 */
export function LeadPicker({ value, onChange, disabled = false, className }: LeadPickerProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PickedLead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const q = term.trim().replace(/[%,()]/g, " ").trim();
      let query = supabase.from("crm_leads").select("id, name, company, phone").order("created_at", { ascending: false }).limit(20);
      if (q) {
        const like = `%${q}%`;
        const digits = q.replace(/\D/g, "");
        query = query.or(
          [`name.ilike.${like}`, `company.ilike.${like}`, `email.ilike.${like}`, digits.length >= 4 ? `phone.ilike.%${digits}%` : null]
            .filter(Boolean).join(","),
        );
      }
      const { data, error } = await query;
      if (!vivo) return;
      if (error) console.error("LeadPicker:", error);
      setResults((data || []) as PickedLead[]);
      setLoading(false);
    }, term ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [open, term]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value ? `${value.name}${value.company ? ` (${value.company})` : ""}` : "Escolha o lead..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome, empresa ou telefone..." value={term} onValueChange={setTerm} />
          <CommandList>
            {loading ? (
              <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                <CommandGroup>
                  {results.map((l) => (
                    <CommandItem key={l.id} value={l.id} onSelect={() => { onChange(l); setOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", value?.id === l.id ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{l.name}</span>
                        {(l.company || l.phone) && (
                          <span className="block truncate text-xs text-muted-foreground">{[l.company, l.phone].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronsUpDown, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientCustomer } from "./types";

interface Props {
  projectId: string;
  value?: string;
  customerName?: string;
  onChange: (customerId: string | null, customerName: string) => void;
  allowManualInput?: boolean;
  placeholder?: string;
}

export function CustomerSelect({
  projectId,
  value,
  customerName,
  onChange,
  allowManualInput = true,
  placeholder = "Selecione um cliente...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<ClientCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualName, setManualName] = useState(customerName || "");
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [projectId]);

  useEffect(() => {
    setManualName(customerName || "");
  }, [customerName]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("client_customers")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCustomers((data as ClientCustomer[]) || []);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === value);

  const handleSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      onChange(customer.id, customer.name);
      setShowManualInput(false);
      setManualName("");
    }
    setOpen(false);
  };

  const handleManualChange = (name: string) => {
    setManualName(name);
    onChange(null, name);
  };

  const toggleManualInput = () => {
    setShowManualInput(!showManualInput);
    if (!showManualInput) {
      onChange(null, manualName);
    }
    setOpen(false);
  };

  if (showManualInput && allowManualInput) {
    return (
      <div className="flex gap-2">
        <Input
          value={manualName}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder="Digite o nome do cliente"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            setShowManualInput(false);
            if (value) {
              const customer = customers.find((c) => c.id === value);
              if (customer) {
                onChange(customer.id, customer.name);
              }
            }
          }}
          title="Selecionar cliente cadastrado"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {loading ? (
              "Carregando..."
            ) : selectedCustomer ? (
              <span className="truncate">{selectedCustomer.name}</span>
            ) : customerName ? (
              <span className="truncate">{customerName}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.name}
                    onSelect={() => handleSelect(customer.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{customer.name}</p>
                      {customer.document && (
                        <p className="text-xs text-muted-foreground">
                          {customer.document_type?.toUpperCase()}: {customer.document}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {allowManualInput && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleManualInput}
          title="Digitar nome manualmente"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

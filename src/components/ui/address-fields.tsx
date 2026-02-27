import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const UF_LIST = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export interface AddressData {
  address: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_zipcode: string;
  address_city: string;
  address_state: string;
}

interface Props {
  value: AddressData;
  onChange: (data: AddressData) => void;
}

export function AddressFields({ value, onChange }: Props) {
  const [loadingCep, setLoadingCep] = useState(false);

  const handleCepChange = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    
    // Format CEP with mask
    let maskedCep = cleanCep;
    if (cleanCep.length > 5) {
      maskedCep = cleanCep.slice(0, 5) + "-" + cleanCep.slice(5, 8);
    }
    
    onChange({ ...value, address_zipcode: maskedCep });

    if (cleanCep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast.error("CEP não encontrado");
          return;
        }
        onChange({
          ...value,
          address_zipcode: maskedCep,
          address: data.logradouro || "",
          address_neighborhood: data.bairro || "",
          address_city: data.localidade || "",
          address_state: data.uf || "",
        });
      } catch {
        toast.error("Erro ao buscar CEP");
      } finally {
        setLoadingCep(false);
      }
    }
  }, [value, onChange]);

  const update = (field: keyof AddressData, v: string) => {
    onChange({ ...value, [field]: v });
  };

  return (
    <div className="space-y-4">
      {/* CEP */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>CEP</Label>
          <div className="relative">
            <Input
              value={value.address_zipcode}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
            {loadingCep && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={value.address_city}
            onChange={(e) => update("address_city", e.target.value)}
            placeholder="Cidade"
          />
        </div>
        <div className="space-y-2">
          <Label>UF</Label>
          <Select value={value.address_state} onValueChange={(v) => update("address_state", v)}>
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UF_LIST.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Endereço + Número */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 space-y-2">
          <Label>Endereço</Label>
          <Input
            value={value.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Rua, Avenida..."
          />
        </div>
        <div className="space-y-2">
          <Label>Número</Label>
          <Input
            value={value.address_number}
            onChange={(e) => update("address_number", e.target.value)}
            placeholder="Nº"
          />
        </div>
      </div>

      {/* Complemento + Bairro */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Complemento</Label>
          <Input
            value={value.address_complement}
            onChange={(e) => update("address_complement", e.target.value)}
            placeholder="Sala, Andar..."
          />
        </div>
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input
            value={value.address_neighborhood}
            onChange={(e) => update("address_neighborhood", e.target.value)}
            placeholder="Bairro"
          />
        </div>
      </div>
    </div>
  );
}

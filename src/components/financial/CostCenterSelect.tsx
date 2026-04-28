import { useState } from "react";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CostCenter {
  id: string;
  name: string;
}

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
  costCenters: CostCenter[];
  onCreated: (created: CostCenter) => void;
  placeholder?: string;
}

/**
 * Select de Centro de Custo com botão "+ Novo" embutido para
 * cadastro rápido sem sair do diálogo. O tenant_id é preenchido
 * automaticamente via trigger no banco (multi-tenant).
 */
export function CostCenterSelect({ value, onChange, costCenters, onCreated, placeholder = "Selecione" }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("staff_financial_cost_centers")
        .insert({ name: name.trim() } as any)
        .select("id, name")
        .single();
      if (error) throw error;
      toast.success("Centro de custo criado");
      onCreated(data as CostCenter);
      onChange((data as any).id);
      setName("");
      setOpen(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao criar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Select value={value || "none"} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {costCenters.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          title="Novo centro de custo"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Centro de Custo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marketing, Operacional..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

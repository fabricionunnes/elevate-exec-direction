import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface StaffFull {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  cep?: string | null;
  street?: string | null;
  address_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_type?: string | null;
  pix_key?: string | null;
  cnpj?: string | null;
  company_name?: string | null;
  trade_name?: string | null;
  municipal_registration?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  onSaved?: () => void;
}

const FIELDS: (keyof StaffFull)[] = [
  "name", "email", "phone", "cpf", "rg", "birth_date",
  "cep", "street", "address_number", "complement", "neighborhood", "city", "state",
  "bank_name", "bank_agency", "bank_account", "bank_account_type", "pix_key",
  "cnpj", "company_name", "trade_name", "municipal_registration",
];

export function StaffDetailsDialog({ open, onOpenChange, staffId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<StaffFull | null>(null);

  useEffect(() => {
    if (!open || !staffId) {
      setData(null);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: row, error } = await supabase
          .from("onboarding_staff")
          .select("*")
          .eq("id", staffId)
          .single();
        if (error) throw error;
        setData(row as any);
      } catch (e: any) {
        toast.error(e.message || "Erro ao carregar dados do membro");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, staffId]);

  const update = (key: keyof StaffFull, value: string) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!data || !staffId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const f of FIELDS) {
        const v = (data as any)[f];
        payload[f] = v === "" ? null : v ?? null;
      }
      const { error } = await supabase
        .from("onboarding_staff")
        .update(payload)
        .eq("id", staffId);
      if (error) throw error;
      toast.success("Dados atualizados com sucesso");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Membro</DialogTitle>
          <DialogDescription>
            Visualize e edite todos os dados cadastrais.
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="personal">Pessoais</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
              <TabsTrigger value="bank">Bancário</TabsTrigger>
              <TabsTrigger value="pj">PJ</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome Completo" value={data.name} onChange={(v) => update("name", v)} />
                <Field label="Email" value={data.email} onChange={(v) => update("email", v)} />
                <Field label="Telefone" value={data.phone || ""} onChange={(v) => update("phone", v)} />
                <Field label="CPF" value={data.cpf || ""} onChange={(v) => update("cpf", v)} />
                <Field label="RG" value={data.rg || ""} onChange={(v) => update("rg", v)} />
                <Field
                  label="Data de Nascimento"
                  type="date"
                  value={data.birth_date || ""}
                  onChange={(v) => update("birth_date", v)}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CEP" value={data.cep || ""} onChange={(v) => update("cep", v)} />
                <Field label="Rua" value={data.street || ""} onChange={(v) => update("street", v)} />
                <Field label="Número" value={data.address_number || ""} onChange={(v) => update("address_number", v)} />
                <Field label="Complemento" value={data.complement || ""} onChange={(v) => update("complement", v)} />
                <Field label="Bairro" value={data.neighborhood || ""} onChange={(v) => update("neighborhood", v)} />
                <Field label="Cidade" value={data.city || ""} onChange={(v) => update("city", v)} />
                <Field label="Estado" value={data.state || ""} onChange={(v) => update("state", v)} />
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Banco" value={data.bank_name || ""} onChange={(v) => update("bank_name", v)} />
                <Field label="Agência" value={data.bank_agency || ""} onChange={(v) => update("bank_agency", v)} />
                <Field label="Conta" value={data.bank_account || ""} onChange={(v) => update("bank_account", v)} />
                <div>
                  <Label className="text-xs">Tipo de Conta</Label>
                  <Select
                    value={data.bank_account_type || ""}
                    onValueChange={(v) => update("bank_account_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="pagamento">Conta de Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Chave PIX" value={data.pix_key || ""} onChange={(v) => update("pix_key", v)} />
              </div>
            </TabsContent>

            <TabsContent value="pj" className="space-y-3 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CNPJ" value={data.cnpj || ""} onChange={(v) => update("cnpj", v)} />
                <Field label="Razão Social" value={data.company_name || ""} onChange={(v) => update("company_name", v)} />
                <Field label="Nome Fantasia" value={data.trade_name || ""} onChange={(v) => update("trade_name", v)} />
                <Field label="Inscrição Municipal" value={data.municipal_registration || ""} onChange={(v) => update("municipal_registration", v)} />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !data}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

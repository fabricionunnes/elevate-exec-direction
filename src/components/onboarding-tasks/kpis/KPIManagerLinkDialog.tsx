import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Link2, Plus, Power, Building2 } from "lucide-react";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface ManagerLink {
  id: string;
  code: string;
  label: string | null;
  unit_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
}

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const KPIManagerLinkDialog = ({ companyId }: { companyId: string }) => {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ManagerLink[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState<string>("all");

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const load = async () => {
    setLoading(true);
    try {
      const [linksRes, unitsRes] = await Promise.all([
        (supabase as any)
          .from("kpi_manager_links")
          .select("id, code, label, unit_id, is_active, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase.from("company_units").select("id, name").eq("company_id", companyId).eq("is_active", true).order("name"),
      ]);
      if (linksRes.error) throw linksRes.error;
      setLinks((linksRes.data || []) as ManagerLink[]);
      setUnits((unitsRes.data || []) as Unit[]);
    } catch (err) {
      console.error("[KPIManagerLink] load error:", err);
      toast.error("Erro ao carregar os links");
    } finally {
      setLoading(false);
    }
  };

  const buildUrl = (code: string) => `${getPublicBaseUrl()}/?public=kpi-gestor&code=${code}`;

  const copy = (code: string) => {
    navigator.clipboard.writeText(buildUrl(code));
    toast.success("Link copiado");
  };

  const create = async () => {
    setCreating(true);
    try {
      const { error } = await (supabase as any).from("kpi_manager_links").insert({
        company_id: companyId,
        code: genCode(),
        label: newLabel.trim() || null,
        unit_id: newUnit === "all" ? null : newUnit,
      });
      if (error) throw error;
      setNewLabel("");
      setNewUnit("all");
      toast.success("Link gerado");
      load();
    } catch (err: any) {
      console.error("[KPIManagerLink] create error:", err);
      toast.error(err?.message || "Erro ao gerar o link");
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (l: ManagerLink) => {
    try {
      const { error } = await (supabase as any)
        .from("kpi_manager_links")
        .update({ is_active: !l.is_active, updated_at: new Date().toISOString() })
        .eq("id", l.id);
      if (error) throw error;
      toast.success(l.is_active ? "Link desativado" : "Link reativado");
      load();
    } catch (err) {
      console.error("[KPIManagerLink] toggle error:", err);
      toast.error("Erro ao alterar o link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4 mr-2" />
          Link do Gestor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link gerencial de KPIs</DialogTitle>
          <DialogDescription>
            Link público para o gestor lançar e editar os KPIs de qualquer vendedor, com filtro por unidade, setor,
            equipe e vendedor. Quem tem o link não precisa de login — compartilhe só com quem pode alterar números.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do link (opcional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex: Gerente Chapada" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Restringir à unidade</Label>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={create} disabled={creating}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Gerando..." : "Gerar link"}
            </Button>
          </div>

          <div className="border rounded-lg divide-y max-h-[320px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : links.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum link gerado ainda</div>
            ) : (
              links.map((l) => (
                <div key={l.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{l.label || "Link gerencial"}</span>
                      {l.unit_id && (
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <Building2 className="h-3 w-3" />
                          {units.find((u) => u.id === l.unit_id)?.name || "Unidade"}
                        </Badge>
                      )}
                      {!l.is_active && <Badge variant="destructive" className="text-[11px]">Desativado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{buildUrl(l.code)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => copy(l.code)} title="Copiar link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggle(l)} title={l.is_active ? "Desativar" : "Reativar"}>
                      <Power className={`h-4 w-4 ${l.is_active ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KPIManagerLinkDialog;

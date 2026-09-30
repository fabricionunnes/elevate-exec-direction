// "Outros custos" da seção Investimento e CAC (aba Vendas): lançamentos mensais à mão
// (ferramenta, agência, salário de SDR) em crm_marketing_costs. Todo staff lê; só
// master/admin (crm_is_settings_admin) grava. Valor em centavos no banco.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Custo { id: string; month: string; label: string; amount_cents: number }

const mesKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseValor = (s: string) => Math.round(Number(String(s).replace(/\./g, "").replace(",", ".")) * 100);

export function CRMMarketingCostsDialog({ open, onOpenChange, mesInicial, podeEditar, onChanged }: {
  open: boolean; onOpenChange: (v: boolean) => void; mesInicial: Date; podeEditar: boolean; onChanged: () => void;
}) {
  const [mes, setMes] = useState(mesKey(mesInicial));
  const [itens, setItens] = useState<Custo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novo, setNovo] = useState({ label: "", valor: "" });
  const [edicao, setEdicao] = useState<Record<string, { label: string; valor: string }>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  const meses = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1);
      return { value: mesKey(d), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
    });
  }, []);

  useEffect(() => { if (open) setMes(mesKey(mesInicial)); }, [open, mesInicial]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await (supabase as any).from("crm_marketing_costs").select("id, month, label, amount_cents").eq("month", mes).order("label");
    if (error) toast.error("Erro ao carregar custos: " + error.message);
    setItens((data || []) as Custo[]);
    setEdicao({});
    setCarregando(false);
  }, [mes]);
  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const adicionar = async () => {
    const cents = parseValor(novo.valor);
    if (!novo.label.trim() || !Number.isFinite(cents) || cents < 0) { toast.error("Informe descrição e valor"); return; }
    setSalvando("novo");
    const { error } = await (supabase as any).from("crm_marketing_costs").insert({ month: mes, label: novo.label.trim(), amount_cents: cents });
    setSalvando(null);
    if (error) { toast.error("Erro ao lançar: " + error.message); return; }
    setNovo({ label: "", valor: "" });
    toast.success("Custo lançado");
    await carregar(); onChanged();
  };

  const salvar = async (c: Custo) => {
    const e = edicao[c.id]; if (!e) return;
    const cents = parseValor(e.valor);
    if (!e.label.trim() || !Number.isFinite(cents) || cents < 0) { toast.error("Informe descrição e valor"); return; }
    setSalvando(c.id);
    const { error } = await (supabase as any).from("crm_marketing_costs").update({ label: e.label.trim(), amount_cents: cents }).eq("id", c.id);
    setSalvando(null);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Custo atualizado");
    await carregar(); onChanged();
  };

  const excluir = async (c: Custo) => {
    if (!window.confirm(`Excluir "${c.label}" (${brl(c.amount_cents)})?`)) return;
    setSalvando(c.id);
    const { error } = await (supabase as any).from("crm_marketing_costs").delete().eq("id", c.id);
    setSalvando(null);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Custo excluído");
    await carregar(); onChanged();
  };

  const total = itens.reduce((a, c) => a + c.amount_cents, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Outros custos do comercial</DialogTitle>
          <DialogDescription>Lançamentos mensais fora do tráfego e do discador (ferramenta, agência, salário de SDR). Entram no investimento total, rateados pelos dias do período.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <SearchableSelect value={mes} onChange={setMes} options={meses} />
          {carregando ? (
            <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
          ) : (
            <div className="space-y-2">
              {itens.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum custo lançado neste mês.</p>}
              {itens.map((c) => {
                const e = edicao[c.id];
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <Input className="h-9 flex-1" value={e ? e.label : c.label} disabled={!podeEditar}
                      onChange={(ev) => setEdicao((s) => ({ ...s, [c.id]: { label: ev.target.value, valor: s[c.id]?.valor ?? String(c.amount_cents / 100).replace(".", ",") } }))} />
                    <Input className="h-9 w-[130px] text-right" value={e ? e.valor : String(c.amount_cents / 100).replace(".", ",")} disabled={!podeEditar} inputMode="decimal"
                      onChange={(ev) => setEdicao((s) => ({ ...s, [c.id]: { label: s[c.id]?.label ?? c.label, valor: ev.target.value } }))} />
                    {podeEditar && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!e || salvando === c.id} onClick={() => salvar(c)} title="Salvar"><Save className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={salvando === c.id} onClick={() => excluir(c)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                );
              })}
              {podeEditar && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input className="h-9 flex-1" placeholder="Descrição (ex.: salário SDR)" value={novo.label} onChange={(ev) => setNovo((s) => ({ ...s, label: ev.target.value }))} />
                  <Input className="h-9 w-[130px] text-right" placeholder="0,00" inputMode="decimal" value={novo.valor} onChange={(ev) => setNovo((s) => ({ ...s, valor: ev.target.value }))} />
                  <Button size="sm" className="h-9 gap-1" disabled={salvando === "novo"} onClick={adicionar}><Plus className="h-3.5 w-3.5" /> Lançar</Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-right pt-1">Total do mês: <span className="font-medium text-foreground">{brl(total)}</span></p>
              {!podeEditar && <p className="text-xs text-muted-foreground">Só master/admin lançam custos.</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

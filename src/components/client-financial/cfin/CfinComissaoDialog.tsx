import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, parseValor, MESES } from "./helpers";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  folhaId: number;
  mes: number;
  ano: number;
  taxaFuncionario?: number | null;
  itensCount: number;
  onDone: () => void;
}

// A comissão da vendedora é dividida em duas verbas no holerite:
//   Comissão (base)        -> entra como "HORA EXTRA 100 %" ou "BONIFICAÇÃO VENDAS"
//   Descanso Remunerado    -> = comissão × fração do mês (DSR)
export function CfinComissaoDialog({ open, onOpenChange, projectId, folhaId, mes, ano, taxaFuncionario, itensCount, onDone }: Props) {
  const taxaPadrao = taxaFuncionario ? String(taxaFuncionario * 100).replace(".", ",") : "0,5";
  const [modo, setModo] = useState<"valor" | "venda">(taxaFuncionario ? "venda" : "valor");
  const [comissaoStr, setComissaoStr] = useState("");
  const [vendaStr, setVendaStr] = useState("");
  const [taxaStr, setTaxaStr] = useState(taxaPadrao);
  const [fracaoStr, setFracaoStr] = useState("");
  const [labelBase, setLabelBase] = useState("HORA EXTRA 100 %");
  const [fracaoBanco, setFracaoBanco] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setComissaoStr(""); setVendaStr(""); setTaxaStr(taxaPadrao);
    setModo(taxaFuncionario ? "venda" : "valor");
    supabase.from("cfin_dsr_fracoes").select("fracao").eq("project_id", projectId).eq("ano", ano).eq("mes", mes).maybeSingle()
      .then(({ data }) => {
        const f = data?.fracao != null ? Number(data.fracao) : null;
        setFracaoBanco(f);
        setFracaoStr(f != null ? String(f).replace(".", ",") : "");
      });
  }, [open, projectId, ano, mes]);

  const comissao = modo === "valor"
    ? parseValor(comissaoStr)
    : Math.round(parseValor(vendaStr) * (parseValor(taxaStr) / 100) * 100) / 100;
  const fracao = parseValor(fracaoStr);
  const dsr = Math.round(comissao * fracao * 100) / 100;
  const total = comissao + dsr;
  const valido = comissao > 0 && fracao > 0;

  const lancar = async () => {
    if (!valido) return;
    setSalvando(true);
    const rows = [
      { folha_id: folhaId, ordem: itensCount + 1, verba: labelBase, ref: modo === "venda" ? `${taxaStr}%` : null, credito: comissao, debito: null },
      { folha_id: folhaId, ordem: itensCount + 2, verba: "DESC. REMUN.", ref: String(fracao).replace(".", ","), credito: dsr, debito: null },
    ];
    const { error } = await supabase.from("cfin_folha_itens").insert(rows);
    setSalvando(false);
    if (error) { toast.error(`Erro ao lançar: ${error.message}`); return; }
    toast.success("Comissão lançada (Hora Extra + Descanso Remunerado)");
    onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Calcular comissão — {MESES[mes]}/{ano}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Como informar a comissão</Label>
            <Select value={modo} onValueChange={v => setModo(v as "valor" | "venda")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor da comissão direto</SelectItem>
                <SelectItem value="venda">Calcular pela venda × taxa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modo === "valor" ? (
            <div className="space-y-1">
              <Label>Valor da comissão (R$)</Label>
              <Input value={comissaoStr} onChange={e => setComissaoStr(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Venda total (R$)</Label>
                <Input value={vendaStr} onChange={e => setVendaStr(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label>Taxa (%)</Label>
                <Input value={taxaStr} onChange={e => setTaxaStr(e.target.value)} placeholder="0,5" inputMode="decimal" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Fração do mês (Descanso Remunerado)</Label>
            <Input value={fracaoStr} onChange={e => setFracaoStr(e.target.value)} placeholder="ex: 0,1923" inputMode="decimal" />
            <p className="text-xs text-muted-foreground">
              {fracaoBanco != null
                ? `Preenchido com a fração do mês cadastrada (${String(fracaoBanco).replace(".", ",")}). Pode ajustar.`
                : "Sem fração cadastrada para este mês — informe a fração ou cadastre em Cadastros › Frações DSR."}
            </p>
          </div>

          <div className="space-y-1">
            <Label>Verba da comissão (base)</Label>
            <Select value={labelBase} onValueChange={setLabelBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HORA EXTRA 100 %">HORA EXTRA 100 %</SelectItem>
                <SelectItem value="BONIFICAÇÃO VENDAS">BONIFICAÇÃO VENDAS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>{labelBase}</span><b className="text-emerald-600">{fmtMoney(comissao || 0)}</b></div>
            <div className="flex justify-between"><span>DESC. REMUN. ({fracaoStr || "—"})</span><b className="text-emerald-600">{fmtMoney(dsr || 0)}</b></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span>Total a receber</span><b>{fmtMoney(total || 0)}</b></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={salvando || !valido} onClick={lancar}>Lançar 2 verbas na folha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

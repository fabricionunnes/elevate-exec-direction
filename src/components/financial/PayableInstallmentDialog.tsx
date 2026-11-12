import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

// Parcelar várias contas a pagar (Fabrício, 12/11/2026: "selecionar várias dívidas e parcelar elas, adicionar
// juros se preciso"). As contas escolhidas saem da lista e viram as parcelas novas; o banco guarda as originais
// e dá pra desfazer enquanto nenhuma parcela tiver pagamento (RPC financial_parcelar_contas).

interface ContaParaParcelar {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_amount: number | null;
  supplier_name?: string;
  category_id?: string | null;
  cost_center_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contas: ContaParaParcelar[];
  categories: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  onSuccess: () => void;
}

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const maisComum = (valores: (string | null | undefined)[]) => {
  const conta = new Map<string, number>();
  for (const v of valores) if (v) conta.set(v, (conta.get(v) || 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
};
const somaMeses = (iso: string, meses: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, ultimoDia));
  return dt;
};

export function PayableInstallmentDialog({ open, onOpenChange, contas, categories, costCenters, onSuccess }: Props) {
  const [fornecedor, setFornecedor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [parcelas, setParcelas] = useState("6");
  const [primeira, setPrimeira] = useState("");
  const [entrada, setEntrada] = useState(0);
  const [entradaData, setEntradaData] = useState("");
  const [juros, setJuros] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState("acrescimo");
  const [ajusteValor, setAjusteValor] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const saldoDe = (c: ContaParaParcelar) => Number(c.amount) - (Number(c.paid_amount) || 0);
  const saldo = useMemo(() => contas.reduce((s, c) => s + saldoDe(c), 0), [contas]);
  const temPaga = contas.some((c) => c.status === "paid");

  useEffect(() => {
    if (!open) return;
    const fornecedores = [...new Set(contas.map((c) => (c.supplier_name || "").trim()).filter(Boolean))];
    setFornecedor(fornecedores.length === 1 ? fornecedores[0] : "");
    setDescricao(fornecedores.length === 1 ? `Parcelamento ${fornecedores[0]}` : `Parcelamento de ${contas.length} contas`);
    setParcelas("6");
    const hoje = new Date();
    setPrimeira(format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, Math.min(hoje.getDate(), 28)), "yyyy-MM-dd"));
    setEntrada(0);
    setEntradaData(format(hoje, "yyyy-MM-dd"));
    setJuros("");
    setAjusteTipo("acrescimo");
    setAjusteValor(0);
    setCategoriaId(maisComum(contas.map((c) => c.category_id)));
    setCentroId(maisComum(contas.map((c) => c.cost_center_id)));
  }, [open, contas]);

  const n = Math.max(1, Math.min(120, parseInt(parcelas || "1", 10) || 1));
  const taxa = Math.max(0, Number(String(juros).replace(",", ".")) || 0) / 100;
  const ajuste = (ajusteTipo === "desconto" ? -1 : 1) * (Number(ajusteValor) || 0);
  const base = saldo + ajuste - (Number(entrada) || 0);
  const valorParcela = base > 0 ? (taxa > 0 ? (base * taxa) / (1 - Math.pow(1 + taxa, -n)) : base / n) : 0;
  const totalParcelas = Math.round(valorParcela * 100) / 100 * n;
  const totalNovo = (Number(entrada) || 0) + (taxa > 0 ? totalParcelas : Math.max(base, 0));
  const jurosTotal = taxa > 0 ? totalParcelas - base : 0;

  const previa = useMemo(() => {
    if (!primeira || base <= 0) return [] as { rotulo: string; data: Date; valor: number }[];
    const linhas: { rotulo: string; data: Date; valor: number }[] = [];
    if ((Number(entrada) || 0) > 0 && entradaData) linhas.push({ rotulo: "Entrada", data: new Date(entradaData + "T12:00:00"), valor: Number(entrada) });
    for (let k = 1; k <= n; k++) linhas.push({ rotulo: `${k}/${n}`, data: somaMeses(primeira, k - 1), valor: valorParcela });
    return linhas;
  }, [primeira, base, entrada, entradaData, n, valorParcela]);

  const confirmar = async () => {
    if (salvando) return;
    if (temPaga) { toast.error("Tire da seleção as contas que já estão pagas"); return; }
    if (!fornecedor.trim() || !descricao.trim()) { toast.error("Preencha fornecedor e descrição"); return; }
    if (!primeira) { toast.error("Informe o vencimento da primeira parcela"); return; }
    if (base <= 0) { toast.error("O valor a parcelar ficou zerado ou negativo"); return; }
    setSalvando(true);
    try {
      const { data, error } = await (supabase as any).rpc("financial_parcelar_contas", {
        p_ids: contas.map((c) => c.id),
        p_params: {
          supplier_name: fornecedor.trim(),
          description: descricao.trim(),
          parcelas: n,
          primeira_data: primeira,
          entrada: Number(entrada) || 0,
          entrada_data: entradaData || null,
          juros_mes: taxa * 100,
          ajuste,
          category_id: categoriaId && categoriaId !== "none" ? categoriaId : null,
          cost_center_id: centroId && centroId !== "none" ? centroId : null,
        },
      });
      if (error) throw error;
      toast.success(`Parcelamento criado: ${data?.parcelas || n}x de ${brl(Number(data?.valor_parcela) || valorParcela)}`);
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Não consegui parcelar: " + (e?.message || "erro"));
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parcelar contas</DialogTitle>
          <DialogDescription>
            As contas escolhidas saem da lista e viram as parcelas abaixo. Dá pra desfazer enquanto nenhuma parcela tiver pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border">
            <div className="max-h-40 overflow-y-auto divide-y">
              {contas.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {c.supplier_name ? `${c.supplier_name} · ` : ""}{c.description}
                    {c.status === "paid" && <span className="ml-2 text-destructive">(já paga)</span>}
                    {(Number(c.paid_amount) || 0) > 0 && c.status !== "paid" && <span className="ml-2 text-muted-foreground">(já pago {brl(Number(c.paid_amount))})</span>}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{brl(saldoDe(c))}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-2 text-sm font-semibold">
              <span>Saldo de {contas.length} conta(s)</span>
              <span className="tabular-nums">{brl(saldo)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Fornecedor *</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Pra quem são as parcelas" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div>
              <Label>Número de parcelas</Label>
              <Input type="number" min={1} max={120} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </div>
            <div>
              <Label>Vencimento da 1ª parcela</Label>
              <Input type="date" value={primeira} onChange={(e) => setPrimeira(e.target.value)} />
            </div>
            <div>
              <Label>Entrada (opcional)</Label>
              <CurrencyInput value={entrada} onChange={setEntrada} />
            </div>
            <div>
              <Label>Vencimento da entrada</Label>
              <Input type="date" value={entradaData} onChange={(e) => setEntradaData(e.target.value)} disabled={!(Number(entrada) > 0)} />
            </div>
            <div>
              <Label>Juros (% ao mês)</Label>
              <Input inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} placeholder="0 = sem juros" />
            </div>
            <div>
              <Label>Acréscimo ou desconto</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  value={ajusteTipo}
                  onValueChange={setAjusteTipo}
                  className="w-[130px] shrink-0"
                  options={[{ value: "acrescimo", label: "Acréscimo" }, { value: "desconto", label: "Desconto" }]}
                />
                <CurrencyInput value={ajusteValor} onChange={setAjusteValor} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <SearchableSelect
                value={categoriaId}
                onValueChange={setCategoriaId}
                allowNone
                noneLabel="Sem categoria"
                placeholder="Escolha a categoria"
                emptyMessage="Nenhuma categoria com esse nome."
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div>
              <Label>Centro de custo</Label>
              <SearchableSelect
                value={centroId}
                onValueChange={setCentroId}
                allowNone
                noneLabel="Sem centro de custo"
                placeholder="Escolha o centro de custo"
                emptyMessage="Nenhum centro de custo com esse nome."
                options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div><p className="text-xs text-muted-foreground">Valor a parcelar</p><p className="font-semibold tabular-nums">{brl(Math.max(base, 0))}</p></div>
              <div><p className="text-xs text-muted-foreground">Parcela</p><p className="font-semibold tabular-nums">{n}x de {brl(valorParcela)}</p></div>
              <div><p className="text-xs text-muted-foreground">Juros no total</p><p className="font-semibold tabular-nums">{brl(jurosTotal)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total a pagar</p><p className="font-semibold tabular-nums">{brl(totalNovo)}</p></div>
            </div>
            {previa.length > 0 && (
              <div className="max-h-36 overflow-y-auto divide-y rounded border bg-background text-sm">
                {previa.map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1">
                    <span>{l.rotulo}</span>
                    <span className="text-muted-foreground">{format(l.data, "dd/MM/yyyy")}</span>
                    <span className="font-medium tabular-nums">{brl(l.valor)}</span>
                  </div>
                ))}
              </div>
            )}
            {base <= 0 && <p className="text-xs text-destructive">O valor a parcelar ficou zerado ou negativo. Revise a entrada e o desconto.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando || temPaga || base <= 0}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar {n} parcela(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

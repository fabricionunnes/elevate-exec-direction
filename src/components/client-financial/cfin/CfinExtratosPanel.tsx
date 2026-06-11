import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate, hojeISO, parseValor } from "./helpers";

interface Conta { id: number; codigo: string; banco: string | null; numero: string | null; titular: string | null; saldo?: number }
interface Lanc {
  id: number; conta_id: number; data: string | null; loja_codigo: string | null;
  plano_codigo: string | null; descricao: string; detalhado: string | null;
  valor_real: number | null; num_cheque: string | null;
  debito: number | null; credito: number | null; saldo_inicial: number | null;
  conciliado: boolean;
}
interface Plano { codigo: string; nome: string; natureza: string | null; grupo_dre: string | null }
interface Loja { codigo: string; nome: string }

const PAGE = 50;
const formVazio = { data: hojeISO(), loja_codigo: "", plano_codigo: "", descricao: "", detalhado: "", num_cheque: "", tipo: "debito", valor: "" };

export function CfinExtratosPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaId, setContaId] = useState<number | null>(null);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<(typeof formVazio & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("cfin_v_saldo_contas").select("*").eq("project_id", projectId).eq("ativo", true)
      .order("qtd_lancamentos", { ascending: false })
      .then(({ data }) => {
        const cs = (data as Conta[]) ?? [];
        setContas(cs);
        if (cs.length && contaId == null) setContaId(cs[0].id);
      });
    supabase.from("cfin_plano_contas").select("codigo,nome,natureza,grupo_dre").eq("project_id", projectId).eq("ativo", true).order("codigo")
      .then(({ data }) => setPlanos((data as Plano[]) ?? []));
    supabase.from("cfin_lojas").select("codigo,nome").eq("project_id", projectId).eq("ativo", true)
      .then(({ data }) => setLojas((data as Loja[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const carregar = useCallback(async () => {
    if (contaId == null) return;
    let q = supabase.from("cfin_lancamentos").select("*", { count: "exact" })
      .eq("conta_id", contaId)
      .order("data", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (busca) q = q.ilike("descricao", `%${busca}%`);
    const { data, count } = await q;
    setLancs((data as Lanc[]) ?? []);
    setTotal(count ?? 0);
  }, [contaId, page, busca]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form || contaId == null) return;
    setBusy(true);
    const v = parseValor(form.valor);
    const row = {
      project_id: projectId, conta_id: contaId,
      data: form.data || null, loja_codigo: form.loja_codigo || null,
      plano_codigo: form.plano_codigo || null,
      descricao: form.descricao || "(sem descrição)", detalhado: form.detalhado || null,
      num_cheque: form.num_cheque || null,
      debito: form.tipo === "debito" ? v : null,
      credito: form.tipo === "credito" ? v : null,
      origem: "nexus",
    };
    const r = form.id
      ? await supabase.from("cfin_lancamentos").update({ ...row, atualizado_em: new Date().toISOString() }).eq("id", form.id)
      : await supabase.from("cfin_lancamentos").insert(row);
    setBusy(false);
    if (r.error) { toast.error("Erro ao salvar lançamento"); return; }
    toast.success("Lançamento salvo");
    setForm(null); carregar();
  };

  const excluir = async (id: number) => {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("cfin_lancamentos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    carregar();
  };

  const conciliar = async (l: Lanc) => {
    if (!canEdit) return;
    await supabase.from("cfin_lancamentos").update({ conciliado: !l.conciliado }).eq("id", l.id);
    setLancs(ls => ls.map(x => x.id === l.id ? { ...x, conciliado: !l.conciliado } : x));
  };

  const conta = contas.find(c => c.id === contaId);

  return (
    <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Conta bancária</Label>
            <Select value={contaId != null ? String(contaId) : undefined} onValueChange={v => { setContaId(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.codigo} — {c.banco} {c.numero} ({c.titular})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input className="w-[220px]" placeholder="Descrição…" value={busca} onChange={e => { setBusca(e.target.value); setPage(0); }} />
          </div>
          <div className="flex-1" />
          {canEdit && (
            <Button size="sm" onClick={() => setForm({ ...formVazio })}>
              <Plus className="h-4 w-4 mr-1" /> Novo lançamento
            </Button>
          )}
        </div>

        {conta && (
          <Card>
            <CardContent className="py-3 flex flex-wrap items-center gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Saldo da conta {conta.codigo}</div>
                <div className={`text-xl font-bold ${(conta.saldo ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(conta.saldo)}</div>
              </div>
              <div className="text-xs text-muted-foreground">{total.toLocaleString("pt-BR")} lançamentos no filtro</div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Loja</TableHead><TableHead>Plano</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead>Pg</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(l.data)}</TableCell>
                  <TableCell>{l.loja_codigo ?? ""}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.plano_codigo ?? ""}</TableCell>
                  <TableCell>
                    {l.descricao}
                    {l.detalhado && <div className="text-xs text-muted-foreground">{l.detalhado}</div>}
                    {l.debito == null && l.credito == null && l.valor_real != null && (
                      <div className="text-xs text-muted-foreground">valor informativo: {fmtMoney(l.valor_real)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-red-600 whitespace-nowrap">{l.debito != null ? fmtMoney(l.debito) : ""}</TableCell>
                  <TableCell className="text-right text-emerald-600 whitespace-nowrap">{l.credito != null ? fmtMoney(l.credito) : ""}</TableCell>
                  <TableCell>
                    <Badge variant={l.conciliado ? "default" : "outline"} className="cursor-pointer" onClick={() => conciliar(l)}>
                      {l.conciliado ? "pg" : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({
                          id: l.id, data: l.data ?? "", loja_codigo: l.loja_codigo ?? "", plano_codigo: l.plano_codigo ?? "",
                          descricao: l.descricao, detalhado: l.detalhado ?? "", num_cheque: l.num_cheque ?? "",
                          tipo: l.credito != null ? "credito" : "debito",
                          valor: String(l.credito ?? l.debito ?? l.valor_real ?? ""),
                        })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluir(l.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{total === 0 ? 0 : page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} de {total.toLocaleString("pt-BR")}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>

      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar lançamento" : "Novo lançamento"} — {conta?.codigo}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Loja</Label>
                <Select value={form.loja_codigo || "none"} onValueChange={v => setForm({ ...form, loja_codigo: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {lojas.map(l => <SelectItem key={l.codigo} value={l.codigo}>{l.codigo} — {l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Plano de contas</Label>
                <Select value={form.plano_codigo || "none"} onValueChange={v => setForm({ ...form, plano_codigo: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">—</SelectItem>
                    {planos.map(p => <SelectItem key={p.codigo} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label>Detalhado</Label><Input value={form.detalhado} onChange={e => setForm({ ...form, detalhado: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">Débito (saída)</SelectItem>
                    <SelectItem value="credito">Crédito (entrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={busy || !form?.valor} onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

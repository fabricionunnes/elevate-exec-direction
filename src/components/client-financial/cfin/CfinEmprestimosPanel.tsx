import { useCallback, useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate, parseValor } from "./helpers";

interface Emp {
  id: number; credor: string; dia_vencimento: number | null; valor_original: number | null;
  taxa: string | null; valor_parcela: number | null; prazo_meses: number | null;
  saldo_devedor: number | null; observacao: string | null; ativo: boolean;
}
interface Parcela { id: number; emprestimo_id: number; competencia: string; valor: number; pago: boolean }

const vazio = { credor: "", dia_vencimento: "", valor_original: "", taxa: "", valor_parcela: "", prazo_meses: "", saldo_devedor: "", observacao: "" };

export function CfinEmprestimosPanel({ projectId, canEdit, canDelete = canEdit }: { projectId: string; canEdit: boolean; canDelete?: boolean }) {
  const [rows, setRows] = useState<Emp[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [aberto, setAberto] = useState<number | null>(null);
  const [form, setForm] = useState<(typeof vazio & { id?: number }) | null>(null);
  const [novaParcela, setNovaParcela] = useState<{ emprestimo_id: number; competencia: string; valor: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("cfin_emprestimos").select("*")
      .eq("project_id", projectId).order("saldo_devedor", { ascending: false });
    const es = (data as Emp[]) ?? [];
    setRows(es);
    if (es.length) {
      const { data: p } = await supabase.from("cfin_emprestimo_parcelas").select("*")
        .in("emprestimo_id", es.map(e => e.id)).order("competencia");
      setParcelas((p as Parcela[]) ?? []);
    } else setParcelas([]);
  }, [projectId]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    setBusy(true);
    const n = (s: string) => (s ? parseValor(s) : null);
    const row = {
      project_id: projectId, credor: form.credor,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      valor_original: n(form.valor_original), taxa: form.taxa || null,
      valor_parcela: n(form.valor_parcela),
      prazo_meses: form.prazo_meses ? parseInt(form.prazo_meses) : null,
      saldo_devedor: n(form.saldo_devedor), observacao: form.observacao || null,
    };
    const { error } = form.id
      ? await supabase.from("cfin_emprestimos").update(row).eq("id", form.id)
      : await supabase.from("cfin_emprestimos").insert(row);
    setBusy(false);
    if (error) { toast.error("Erro ao salvar contrato"); return; }
    toast.success("Contrato salvo");
    setForm(null); carregar();
  };

  const excluir = async (e: Emp) => {
    if (!confirm(`Excluir o contrato "${e.credor}" e todas as parcelas?`)) return;
    const { error } = await supabase.from("cfin_emprestimos").delete().eq("id", e.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    carregar();
  };

  const quitar = async (e: Emp) => {
    await supabase.from("cfin_emprestimos").update({ ativo: !e.ativo }).eq("id", e.id);
    carregar();
  };

  const togglePago = async (p: Parcela) => {
    if (!canEdit) return;
    await supabase.from("cfin_emprestimo_parcelas").update({ pago: !p.pago }).eq("id", p.id);
    setParcelas(ps => ps.map(x => x.id === p.id ? { ...x, pago: !p.pago } : x));
  };

  const delParcela = async (id: number) => {
    if (!confirm("Excluir esta parcela?")) return;
    await supabase.from("cfin_emprestimo_parcelas").delete().eq("id", id);
    carregar();
  };

  const addParcela = async () => {
    if (!novaParcela) return;
    setBusy(true);
    const { error } = await supabase.from("cfin_emprestimo_parcelas").insert({
      emprestimo_id: novaParcela.emprestimo_id,
      competencia: novaParcela.competencia,
      valor: parseValor(novaParcela.valor),
    });
    setBusy(false);
    if (error) { toast.error("Erro ao adicionar parcela"); return; }
    setNovaParcela(null); carregar();
  };

  const totalDevedor = rows.filter(r => r.ativo).reduce((s, r) => s + (r.saldo_devedor ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Card className="flex-1 min-w-[240px]">
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Saldo devedor total (contratos ativos)</div>
            <div className="text-xl font-bold text-red-600">{fmtMoney(totalDevedor)}</div>
          </CardContent>
        </Card>
        {canEdit && <Button onClick={() => setForm({ ...vazio })}><Plus className="h-4 w-4 mr-1" /> Novo contrato</Button>}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credor / contrato</TableHead>
              <TableHead className="text-right">Dia venc.</TableHead>
              <TableHead className="text-right">Valor original</TableHead>
              <TableHead>Taxa</TableHead>
              <TableHead className="text-right">Parcela</TableHead>
              <TableHead className="text-right">Saldo devedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(e => {
              const ps = parcelas.filter(p => p.emprestimo_id === e.id);
              return (
                <Fragment key={e.id}>
                  <TableRow>
                    <TableCell className="font-medium">{e.credor}{e.observacao && <div className="text-xs text-muted-foreground">{e.observacao}</div>}</TableCell>
                    <TableCell className="text-right">{e.dia_vencimento ?? ""}</TableCell>
                    <TableCell className="text-right">{e.valor_original != null ? fmtMoney(e.valor_original) : ""}</TableCell>
                    <TableCell className="text-xs">{e.taxa ?? ""}</TableCell>
                    <TableCell className="text-right">{e.valor_parcela != null ? fmtMoney(e.valor_parcela) : ""}</TableCell>
                    <TableCell className="text-right text-red-600">{e.saldo_devedor != null ? fmtMoney(e.saldo_devedor) : ""}</TableCell>
                    <TableCell><Badge variant={e.ativo ? "outline" : "default"}>{e.ativo ? "ativo" : "quitado"}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                        {aberto === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {ps.length} parc.
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({
                            id: e.id, credor: e.credor, dia_vencimento: String(e.dia_vencimento ?? ""),
                            valor_original: String(e.valor_original ?? ""), taxa: e.taxa ?? "",
                            valor_parcela: String(e.valor_parcela ?? ""), prazo_meses: String(e.prazo_meses ?? ""),
                            saldo_devedor: String(e.saldo_devedor ?? ""), observacao: e.observacao ?? "",
                          })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => quitar(e)}>{e.ativo ? "quitar" : "reativar"}</Button>
                          {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluir(e)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  {aberto === e.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="max-w-lg space-y-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => setNovaParcela({ emprestimo_id: e.id, competencia: new Date().toISOString().slice(0, 10), valor: String(e.valor_parcela ?? "") })}>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar parcela
                            </Button>
                          )}
                          <Table>
                            <TableHeader>
                              <TableRow><TableHead>Competência</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Pago</TableHead><TableHead></TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                              {ps.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell>{fmtDate(p.competencia)}</TableCell>
                                  <TableCell className="text-right">{fmtMoney(p.valor)}</TableCell>
                                  <TableCell>
                                    <Badge variant={p.pago ? "default" : "outline"} className="cursor-pointer" onClick={() => togglePago(p)}>
                                      {p.pago ? "pago" : "pendente"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{canDelete && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => delParcela(p.id)}><Trash2 className="h-3 w-3" /></Button>}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar contrato" : "Novo contrato de empréstimo"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2"><Label>Credor / contrato</Label><Input value={form.credor} onChange={e => setForm({ ...form, credor: e.target.value })} /></div>
              <div className="space-y-1"><Label>Dia vencimento</Label><Input value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} /></div>
              <div className="space-y-1"><Label>Taxa</Label><Input value={form.taxa} onChange={e => setForm({ ...form, taxa: e.target.value })} placeholder="ex: 1,88% a.m." /></div>
              <div className="space-y-1"><Label>Valor original (R$)</Label><Input value={form.valor_original} onChange={e => setForm({ ...form, valor_original: e.target.value })} /></div>
              <div className="space-y-1"><Label>Valor parcela (R$)</Label><Input value={form.valor_parcela} onChange={e => setForm({ ...form, valor_parcela: e.target.value })} /></div>
              <div className="space-y-1"><Label>Prazo (meses)</Label><Input value={form.prazo_meses} onChange={e => setForm({ ...form, prazo_meses: e.target.value })} /></div>
              <div className="space-y-1"><Label>Saldo devedor (R$)</Label><Input value={form.saldo_devedor} onChange={e => setForm({ ...form, saldo_devedor: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Observação</Label><Input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={busy || !form?.credor} onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!novaParcela} onOpenChange={o => !o && setNovaParcela(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar parcela</DialogTitle></DialogHeader>
          {novaParcela && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Competência</Label><Input type="date" value={novaParcela.competencia} onChange={e => setNovaParcela({ ...novaParcela, competencia: e.target.value })} /></div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input value={novaParcela.valor} onChange={e => setNovaParcela({ ...novaParcela, valor: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaParcela(null)}>Cancelar</Button>
            <Button disabled={busy || !novaParcela?.valor} onClick={addParcela}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

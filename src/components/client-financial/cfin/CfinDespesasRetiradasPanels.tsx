import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate, hojeISO, parseValor } from "./helpers";

interface Loja { codigo: string; nome: string }
interface Plano { codigo: string; nome: string }

function useLojasPlanos(projectId: string) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  useEffect(() => {
    supabase.from("cfin_lojas").select("codigo,nome").eq("project_id", projectId).eq("ativo", true)
      .then(({ data }) => setLojas((data as Loja[]) ?? []));
    supabase.from("cfin_plano_contas").select("codigo,nome").eq("project_id", projectId).eq("ativo", true).order("codigo")
      .then(({ data }) => setPlanos((data as Plano[]) ?? []));
  }, [projectId]);
  return { lojas, planos };
}

// ---------------- DESPESAS FIXAS ----------------
interface Despesa {
  id: number; data: string | null; loja_codigo: string | null; plano_codigo: string | null;
  conta_ref: string | null; descricao: string; detalhado: string | null;
  valor: number; num_cheque: string | null; pago: boolean;
}
const despesaVazia = { data: hojeISO(), loja_codigo: "", plano_codigo: "", conta_ref: "", descricao: "", detalhado: "", valor: "" };

export function CfinDespesasFixasPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { lojas, planos } = useLojasPlanos(projectId);
  const [rows, setRows] = useState<Despesa[]>([]);
  const [form, setForm] = useState<(typeof despesaVazia & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("cfin_despesas_fixas").select("*")
      .eq("project_id", projectId).order("data", { ascending: true, nullsFirst: false }).limit(1000);
    setRows((data as Despesa[]) ?? []);
  }, [projectId]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    setBusy(true);
    const row = {
      project_id: projectId, data: form.data || null, loja_codigo: form.loja_codigo || null,
      plano_codigo: form.plano_codigo || null, conta_ref: form.conta_ref || null,
      descricao: form.descricao || "(sem descrição)", detalhado: form.detalhado || null,
      valor: parseValor(form.valor),
    };
    const { error } = form.id
      ? await supabase.from("cfin_despesas_fixas").update(row).eq("id", form.id)
      : await supabase.from("cfin_despesas_fixas").insert(row);
    setBusy(false);
    if (error) { toast.error("Erro ao salvar despesa"); return; }
    toast.success("Despesa salva");
    setForm(null); carregar();
  };

  const excluir = async (id: number) => {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("cfin_despesas_fixas").delete().eq("id", id);
    carregar();
  };

  const togglePago = async (d: Despesa) => {
    if (!canEdit) return;
    await supabase.from("cfin_despesas_fixas").update({ pago: !d.pago }).eq("id", d.id);
    setRows(rs => rs.map(x => x.id === d.id ? { ...x, pago: !d.pago } : x));
  };

  const total = rows.reduce((s, r) => s + (r.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Total listado: <b className="text-foreground">{fmtMoney(total)}</b></span>
        <div className="flex-1" />
        {canEdit && <Button size="sm" onClick={() => setForm({ ...despesaVazia })}><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Loja</TableHead><TableHead>Plano</TableHead>
              <TableHead>Descrição</TableHead><TableHead>Conta</TableHead>
              <TableHead className="text-right">Valor</TableHead><TableHead>Pago</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(d => (
              <TableRow key={d.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(d.data)}</TableCell>
                <TableCell>{d.loja_codigo ?? ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.plano_codigo ?? ""}</TableCell>
                <TableCell>{d.descricao}{d.detalhado && <div className="text-xs text-muted-foreground">{d.detalhado}</div>}</TableCell>
                <TableCell className="text-xs">{d.conta_ref ?? ""}</TableCell>
                <TableCell className="text-right text-red-600">{fmtMoney(d.valor)}</TableCell>
                <TableCell>
                  <Badge variant={d.pago ? "default" : "outline"} className={canEdit ? "cursor-pointer" : ""} onClick={() => togglePago(d)}>
                    {d.pago ? "pago" : "pendente"}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({
                        id: d.id, data: d.data ?? "", loja_codigo: d.loja_codigo ?? "", plano_codigo: d.plano_codigo ?? "",
                        conta_ref: d.conta_ref ?? "", descricao: d.descricao, detalhado: d.detalhado ?? "", valor: String(d.valor),
                      })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluir(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar despesa" : "Nova despesa fixa"}</DialogTitle></DialogHeader>
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
              <div className="space-y-1"><Label>Conta (ref.)</Label><Input value={form.conta_ref} onChange={e => setForm({ ...form, conta_ref: e.target.value })} placeholder="BRAD-27470" /></div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
              <div className="space-y-1 col-span-2"><Label>Detalhado</Label><Input value={form.detalhado} onChange={e => setForm({ ...form, detalhado: e.target.value })} /></div>
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

// ---------------- RETIRADAS ----------------
interface Retirada {
  id: number; data: string | null; loja_codigo: string | null; plano_codigo: string | null;
  conta_ref: string | null; descricao: string; detalhado: string | null; valor: number;
}
const retiradaVazia = { data: hojeISO(), loja_codigo: "", descricao: "RETIRADA EM DINHEIRO", valor: "" };
const PAGE = 50;

export function CfinRetiradasPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { lojas } = useLojasPlanos(projectId);
  const [rows, setRows] = useState<Retirada[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [form, setForm] = useState<(typeof retiradaVazia & { id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    let q = supabase.from("cfin_retiradas").select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("data", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (de) q = q.gte("data", de);
    if (ate) q = q.lte("data", ate);
    const { data, count } = await q;
    setRows((data as Retirada[]) ?? []); setTotal(count ?? 0);
  }, [projectId, page, de, ate]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    setBusy(true);
    const row = {
      project_id: projectId, data: form.data || null, loja_codigo: form.loja_codigo || null,
      descricao: form.descricao || "RETIRADA EM DINHEIRO", valor: parseValor(form.valor),
    };
    const { error } = form.id
      ? await supabase.from("cfin_retiradas").update(row).eq("id", form.id)
      : await supabase.from("cfin_retiradas").insert(row);
    setBusy(false);
    if (error) { toast.error("Erro ao salvar retirada"); return; }
    toast.success("Retirada salva");
    setForm(null); carregar();
  };

  const excluir = async (id: number) => {
    if (!confirm("Excluir esta retirada?")) return;
    await supabase.from("cfin_retiradas").delete().eq("id", id);
    carregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={de} onChange={e => { setDe(e.target.value); setPage(0); }} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={e => { setAte(e.target.value); setPage(0); }} /></div>
        <div className="flex-1" />
        {canEdit && <Button size="sm" onClick={() => setForm({ ...retiradaVazia })}><Plus className="h-4 w-4 mr-1" /> Nova retirada</Button>}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Data</TableHead><TableHead>Loja</TableHead><TableHead>Descrição</TableHead><TableHead>Conta (ref.)</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.data)}</TableCell>
                <TableCell>{r.loja_codigo ?? ""}</TableCell>
                <TableCell>{r.descricao}</TableCell>
                <TableCell className="text-xs">{r.conta_ref ?? ""}</TableCell>
                <TableCell className="text-right">{fmtMoney(r.valor)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({
                        id: r.id, data: r.data ?? "", loja_codigo: r.loja_codigo ?? "", descricao: r.descricao, valor: String(r.valor),
                      })}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluir(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form?.id ? "Editar retirada" : "Nova retirada"}</DialogTitle></DialogHeader>
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
              <div className="space-y-1 col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
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

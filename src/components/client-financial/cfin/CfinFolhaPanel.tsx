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
import { Plus, Printer, Trash2, ArrowLeft, Pencil, Calculator, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate, MESES, parseValor, calcInss, type InssFaixa } from "./helpers";
import { CfinVerbaCombobox } from "./CfinVerbaCombobox";
import { CfinComissaoDialog } from "./CfinComissaoDialog";

interface Func {
  id: number; codigo: string | null; nome: string; nome_completo: string | null;
  funcao: string | null; loja_codigo: string | null; ativo: boolean;
  salario_fixo: number | null; vt_percentual: number | null; taxa_comissao: number | null;
}
interface FolhaRow {
  id: number; funcionario_id: number; tipo: string; loja_codigo: string | null;
  empresa: string | null; funcao: string | null; mes: number; ano: number;
  dt_inicio: string | null; dt_fim: string | null;
  cfin_funcionarios: Func | null;
}
interface Item { id: number; ordem: number | null; verba: string; ref: string | null; credito: number | null; debito: number | null }
interface Totais { folha_id: number; liquido: number }

export function CfinFolhaPanel({ projectId, canEdit, canDelete = canEdit }: { projectId: string; canEdit: boolean; canDelete?: boolean }) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<FolhaRow[]>([]);
  const [totais, setTotais] = useState<Map<number, number>>(new Map());
  const [funcs, setFuncs] = useState<Func[]>([]);
  const [verbas, setVerbas] = useState<string[]>([]);
  const [aberta, setAberta] = useState<FolhaRow | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [novaFolha, setNovaFolha] = useState(false);
  const [novoFunc, setNovoFunc] = useState("");
  const [novoTipo, setNovoTipo] = useState("mensal");
  const [novoItem, setNovoItem] = useState<{ id?: number; verba: string; ref: string; tipo: string; valor: string } | null>(null);
  const [editFolha, setEditFolha] = useState<{ loja_codigo: string; funcao: string; empresa: string; dt_inicio: string; dt_fim: string } | null>(null);
  const [comissaoOpen, setComissaoOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [inssFaixas, setInssFaixas] = useState<Map<number, InssFaixa[]>>(new Map());

  useEffect(() => {
    supabase.from("cfin_funcionarios").select("*").eq("project_id", projectId).order("nome")
      .then(({ data }) => setFuncs((data as Func[]) ?? []));
    supabase.from("cfin_verbas").select("nome").eq("project_id", projectId).eq("ativo", true).order("nome")
      .then(({ data }) => setVerbas((data ?? []).map((v: { nome: string }) => v.nome)));
    supabase.from("cfin_empresas").select("logo_url").eq("project_id", projectId)
      .not("logo_url", "is", null).limit(1)
      .then(({ data }) => setLogoUrl(data?.[0]?.logo_url ?? null));
    supabase.from("cfin_inss_faixas").select("ano,faixa_ate,aliquota").eq("project_id", projectId)
      .then(({ data }) => {
        const m = new Map<number, InssFaixa[]>();
        (data ?? []).forEach((f: { ano: number; faixa_ate: number; aliquota: number }) => {
          if (!m.has(f.ano)) m.set(f.ano, []);
          m.get(f.ano)!.push({ faixa_ate: f.faixa_ate, aliquota: f.aliquota });
        });
        setInssFaixas(m);
      });
  }, [projectId]);

  // Preenche a folha aberta com as verbas-base do cadastro do funcionário (sem duplicar)
  const preencherAutomatico = async () => {
    if (!aberta) return;
    const fu = funcs.find(x => x.id === aberta.funcionario_id) ?? (aberta.cfin_funcionarios as Func | null);
    if (!fu) return;
    if (!fu.salario_fixo) { toast.error("Cadastre o salário fixo da funcionária em Cadastros › Funcionários."); return; }
    const jaTem = new Set(itens.map(i => i.verba.toUpperCase().trim()));
    const novos = verbasBase(fu, aberta.ano, aberta.id, itens.length)
      .filter(v => !jaTem.has(v.verba.toUpperCase().trim()));
    if (!novos.length) { toast.info("As verbas-base já estão na folha."); return; }
    setBusy(true);
    const { error } = await supabase.from("cfin_folha_itens").insert(novos);
    setBusy(false);
    if (error) { toast.error("Erro ao preencher folha"); return; }
    toast.success(`${novos.length} verba(s) preenchida(s) do cadastro`);
    abrirFolha(aberta); carregar();
  };

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("cfin_folhas")
      .select("*, cfin_funcionarios(*)")
      .eq("project_id", projectId).eq("ano", ano).eq("mes", mes)
      .order("loja_codigo").order("id");
    const fs = (data as unknown as FolhaRow[]) ?? [];
    setRows(fs);
    if (fs.length) {
      const { data: t } = await supabase.from("cfin_v_folha_totais").select("folha_id,liquido")
        .in("folha_id", fs.map(f => f.id));
      setTotais(new Map(((t as Totais[]) ?? []).map(x => [x.folha_id, x.liquido])));
    } else setTotais(new Map());
  }, [projectId, ano, mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrirFolha = async (f: FolhaRow) => {
    setAberta(f);
    const { data } = await supabase.from("cfin_folha_itens").select("*").eq("folha_id", f.id).order("ordem");
    setItens((data as Item[]) ?? []);
  };

  const criarFolha = async () => {
    if (!novoFunc) return;
    setBusy(true);
    const fu = funcs.find(x => x.id === Number(novoFunc));
    const { data, error } = await supabase.from("cfin_folhas").insert({
      project_id: projectId, funcionario_id: Number(novoFunc), tipo: novoTipo,
      loja_codigo: fu?.loja_codigo ?? null, funcao: fu?.funcao ?? null,
      mes: novoTipo === "decimo" ? 13 : mes, ano,
      dt_inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
      aba_origem: "nexus",
    }).select("*, cfin_funcionarios(*)").single();
    if (error) { setBusy(false); toast.error("Já existe folha deste funcionário nesta competência."); return; }
    const novaFolhaRow = data as unknown as FolhaRow;
    // folha mensal: já preenche salário, VT e INSS do cadastro
    if (novoTipo === "mensal" && fu?.salario_fixo) {
      const base = verbasBase(fu, ano, novaFolhaRow.id);
      if (base.length) await supabase.from("cfin_folha_itens").insert(base);
    }
    setBusy(false);
    setNovaFolha(false); setNovoFunc("");
    carregar();
    abrirFolha(novaFolhaRow);
  };

  // Verbas-base a partir do cadastro do funcionário (salário, VT, INSS)
  const verbasBase = (fu: Func, anoFolha: number, folhaId: number, ordemInicial = 0) => {
    const sal = fu.salario_fixo ?? 0;
    const out: { folha_id: number; ordem: number; verba: string; ref: string | null; credito: number | null; debito: number | null }[] = [];
    let ordem = ordemInicial;
    if (!sal) return out;
    out.push({ folha_id: folhaId, ordem: ++ordem, verba: "SALARIO CONTRATUAL", ref: null, credito: sal, debito: null });
    if (fu.vt_percentual && fu.vt_percentual > 0) {
      const vt = Math.round(sal * (fu.vt_percentual / 100) * 100) / 100;
      out.push({ folha_id: folhaId, ordem: ++ordem, verba: "VALE TRANSPORTE", ref: `${String(fu.vt_percentual).replace(".", ",")}%`, credito: null, debito: vt });
    }
    const faixas = inssFaixas.get(anoFolha) ?? [];
    if (faixas.length) {
      const inss = calcInss(sal, faixas);
      if (inss > 0) out.push({ folha_id: folhaId, ordem: ++ordem, verba: "DESCONTO INSS", ref: null, credito: null, debito: inss });
    }
    return out;
  };

  const addItem = async () => {
    if (!novoItem || !aberta) return;
    setBusy(true);
    const v = parseValor(novoItem.valor);
    const row = {
      verba: novoItem.verba, ref: novoItem.ref || null,
      credito: novoItem.tipo === "credito" ? v : null,
      debito: novoItem.tipo === "debito" ? v : null,
    };
    const { error } = novoItem.id
      ? await supabase.from("cfin_folha_itens").update(row).eq("id", novoItem.id)
      : await supabase.from("cfin_folha_itens").insert({ ...row, folha_id: aberta.id, ordem: itens.length + 1 });
    setBusy(false);
    if (error) { toast.error("Erro ao salvar verba"); return; }
    setNovoItem(null); abrirFolha(aberta); carregar();
  };

  const salvarFolha = async () => {
    if (!editFolha || !aberta) return;
    setBusy(true);
    const row = {
      loja_codigo: editFolha.loja_codigo || null, funcao: editFolha.funcao || null,
      empresa: editFolha.empresa || null,
      dt_inicio: editFolha.dt_inicio || null, dt_fim: editFolha.dt_fim || null,
    };
    const { error } = await supabase.from("cfin_folhas").update(row).eq("id", aberta.id);
    setBusy(false);
    if (error) { toast.error("Erro ao salvar folha"); return; }
    toast.success("Folha atualizada");
    setAberta({ ...aberta, ...row });
    setEditFolha(null); carregar();
  };

  const delItem = async (id: number) => {
    if (!aberta) return;
    await supabase.from("cfin_folha_itens").delete().eq("id", id);
    abrirFolha(aberta); carregar();
  };

  const excluirFolha = async () => {
    if (!aberta || !confirm("Excluir esta folha e todos os itens?")) return;
    await supabase.from("cfin_folhas").delete().eq("id", aberta.id);
    setAberta(null); carregar();
  };

  const imprimir = () => {
    if (!aberta) return;
    const f = aberta.cfin_funcionarios;
    const nome = f?.nome_completo ?? f?.nome ?? "";
    const nomeFmt = f?.codigo && !nome.startsWith(f.codigo) ? `${f.codigo} ${nome}` : nome;
    const cred = itens.reduce((s, i) => s + (i.credito ?? 0), 0);
    const deb = itens.reduce((s, i) => s + (i.debito ?? 0), 0);
    const fm = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
    const periodo = aberta.tipo === "decimo" ? `13º SALARIO ${aberta.ano}` : `${fmtDate(aberta.dt_inicio)} a ${fmtDate(aberta.dt_fim)}`;
    const logoImg = logoUrl
      ? `<div class="logo"><img src="${window.location.origin}${logoUrl}" alt="Logomarca" /></div>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Holerite</title>
<style>body{font-family:'Courier New',monospace;font-size:13px;max-width:620px;margin:20px auto;padding:0 16px}
.logo{text-align:center;margin-bottom:10px}
.logo img{max-height:72px;max-width:200px}
.t{text-align:center;font-weight:700;border-bottom:1px dashed #888;padding-bottom:6px;margin-bottom:8px}
.r{display:flex;justify-content:space-between;padding:2px 0}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{text-align:left;border-bottom:1px dashed #888;font-size:12px;padding:3px 4px}
td{padding:3px 4px}.n{text-align:right}.tot{border-top:1px dashed #888;font-weight:700}
.ass{margin-top:30px;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:12px}</style></head><body>
${logoImg}
<div class="t">COMPROVANTE DE PAGAMENTO DE SALARIO</div>
<div class="r"><span>EMPRESA: ${aberta.empresa ?? "LOJA MIX BRASIL"}</span><span>LOJA: ${aberta.loja_codigo ?? "—"}</span></div>
<div class="r"><span>FUNCIONARIO: ${nomeFmt}</span></div>
<div class="r"><span>FUNCAO: ${aberta.funcao ?? "—"}</span><span>${periodo}</span></div>
<table><thead><tr><th>DESCRICAO</th><th>REF</th><th class="n">CREDITO</th><th class="n">DEBITO</th></tr></thead><tbody>
${itens.map(i => `<tr><td>${i.verba}</td><td>${i.ref ?? ""}</td><td class="n">${fm(i.credito)}</td><td class="n">${fm(i.debito)}</td></tr>`).join("")}
<tr class="tot"><td>Sub Total</td><td></td><td class="n">${fm(cred)}</td><td class="n">${fm(deb)}</td></tr>
<tr class="tot"><td>Total a Receber</td><td></td><td class="n" colspan="2">${fmtMoney(cred - deb)}</td></tr>
</tbody></table>
<div class="ass">______/______/______&nbsp;&nbsp;&nbsp;Assinatura do funcionário</div>
<script>window.onload = function(){ window.print() }</script></body></html>`;
    const w = window.open("", "_blank", "width=700,height=800");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const totalLiquido = rows.reduce((s, r) => s + (totais.get(r.id) ?? 0), 0);
  const cred = itens.reduce((s, i) => s + (i.credito ?? 0), 0);
  const deb = itens.reduce((s, i) => s + (i.debito ?? 0), 0);

  if (aberta) {
    const f = aberta.cfin_funcionarios;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAberta(null)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
          <h3 className="font-semibold">
            {aberta.tipo === "decimo" ? "13º" : MESES[aberta.mes]} / {aberta.ano} — {f?.codigo ? `${f.codigo} — ` : ""}{f?.nome}
          </h3>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={imprimir}><Printer className="h-4 w-4 mr-1" /> Imprimir holerite</Button>
          {canEdit && <Button variant="outline" size="sm" onClick={() => setEditFolha({
            loja_codigo: aberta.loja_codigo ?? "", funcao: aberta.funcao ?? "", empresa: aberta.empresa ?? "",
            dt_inicio: aberta.dt_inicio ?? "", dt_fim: aberta.dt_fim ?? "",
          })}><Pencil className="h-4 w-4 mr-1" /> Editar dados</Button>}
          {canEdit && itens.length === 0 && <Button size="sm" onClick={preencherAutomatico}><Wand2 className="h-4 w-4 mr-1" /> Preencher automático</Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={() => setComissaoOpen(true)}><Calculator className="h-4 w-4 mr-1" /> Calcular comissão</Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={() => setNovoItem({ verba: "", ref: "", tipo: "credito", valor: "" })}><Plus className="h-4 w-4 mr-1" /> Verba</Button>}
          {canDelete && <Button variant="destructive" size="sm" onClick={excluirFolha}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>}
        </div>

        <CfinComissaoDialog open={comissaoOpen} onOpenChange={setComissaoOpen}
          projectId={projectId} folhaId={aberta.id} mes={aberta.mes} ano={aberta.ano}
          taxaFuncionario={(funcs.find(x => x.id === aberta.funcionario_id) ?? aberta.cfin_funcionarios)?.taxa_comissao ?? null}
          itensCount={itens.length} onDone={() => abrirFolha(aberta)} />
        {/* nota: comissão = base (Hora Extra/Bonificação) + Descanso Remunerado (base × fração do mês) */}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Verba</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead className="text-right">Débito</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {itens.map(i => (
                <TableRow key={i.id}>
                  <TableCell>{i.verba}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.ref ?? ""}</TableCell>
                  <TableCell className="text-right text-emerald-600">{i.credito != null ? fmtMoney(i.credito) : ""}</TableCell>
                  <TableCell className="text-right text-red-600">{i.debito != null ? fmtMoney(i.debito) : ""}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNovoItem({
                          id: i.id, verba: i.verba, ref: i.ref ?? "",
                          tipo: i.debito != null ? "debito" : "credito",
                          valor: String(i.debito ?? i.credito ?? ""),
                        })}><Pencil className="h-3.5 w-3.5" /></Button>
                        {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => delItem(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total a receber</TableCell><TableCell></TableCell>
                <TableCell colSpan={2} className="text-right">{fmtMoney(cred - deb)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!editFolha} onOpenChange={o => !o && setEditFolha(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar dados da folha</DialogTitle></DialogHeader>
            {editFolha && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2"><Label>Empresa (impresso no holerite)</Label><Input value={editFolha.empresa} onChange={e => setEditFolha({ ...editFolha, empresa: e.target.value })} /></div>
                <div className="space-y-1"><Label>Loja</Label><Input value={editFolha.loja_codigo} onChange={e => setEditFolha({ ...editFolha, loja_codigo: e.target.value })} /></div>
                <div className="space-y-1"><Label>Função</Label><Input value={editFolha.funcao} onChange={e => setEditFolha({ ...editFolha, funcao: e.target.value })} /></div>
                <div className="space-y-1"><Label>Período início</Label><Input type="date" value={editFolha.dt_inicio} onChange={e => setEditFolha({ ...editFolha, dt_inicio: e.target.value })} /></div>
                <div className="space-y-1"><Label>Período fim</Label><Input type="date" value={editFolha.dt_fim} onChange={e => setEditFolha({ ...editFolha, dt_fim: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditFolha(null)}>Cancelar</Button>
              <Button disabled={busy} onClick={salvarFolha}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!novoItem} onOpenChange={o => !o && setNovoItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{novoItem?.id ? "Editar verba" : "Adicionar verba"}</DialogTitle></DialogHeader>
            {novoItem && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Verba</Label>
                  <CfinVerbaCombobox verbas={verbas} value={novoItem.verba} onChange={v => setNovoItem({ ...novoItem, verba: v })} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={novoItem.tipo} onValueChange={v => setNovoItem({ ...novoItem, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito (provento)</SelectItem>
                      <SelectItem value="debito">Débito (desconto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Valor (R$)</Label><Input value={novoItem.valor} onChange={e => setNovoItem({ ...novoItem, valor: e.target.value })} placeholder="0,00" /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Referência</Label><Input value={novoItem.ref} onChange={e => setNovoItem({ ...novoItem, ref: e.target.value })} placeholder="opcional" /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setNovoItem(null)}>Cancelar</Button>
              <Button disabled={busy || !novoItem?.verba || !novoItem?.valor} onClick={addItem}>{novoItem?.id ? "Salvar" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Mês</Label>
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => i > 0 ? <SelectItem key={i} value={String(i)}>{m}</SelectItem> : null)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ano</Label>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-full sm:w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: now.getFullYear() - 2021 }, (_, i) => now.getFullYear() - i).map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        {canEdit && <Button size="sm" onClick={() => setNovaFolha(true)}><Plus className="h-4 w-4 mr-1" /> Nova folha</Button>}
      </div>

      <Card>
        <CardContent className="py-3 flex flex-wrap gap-6">
          <div>
            <div className="text-xs text-muted-foreground">Folhas em {MESES[mes]} / {ano}</div>
            <div className="text-xl font-bold">{rows.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total líquido</div>
            <div className="text-xl font-bold">{fmtMoney(totalLiquido)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Funcionário</TableHead><TableHead>Função</TableHead><TableHead>Loja</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Líquido</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => abrirFolha(r)}>
                <TableCell className="font-medium">{r.cfin_funcionarios?.codigo ? `${r.cfin_funcionarios.codigo} — ` : ""}{r.cfin_funcionarios?.nome}</TableCell>
                <TableCell>{r.funcao ?? ""}</TableCell>
                <TableCell>{r.loja_codigo ?? ""}</TableCell>
                <TableCell><Badge variant="outline">{r.tipo === "decimo" ? "13º" : r.tipo}</Badge></TableCell>
                <TableCell className="text-right">{fmtMoney(totais.get(r.id) ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!rows.length && <p className="text-sm text-muted-foreground">Nenhuma folha nesta competência.</p>}

      <Dialog open={novaFolha} onOpenChange={setNovaFolha}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova folha — {MESES[mes]} / {ano}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Funcionário</Label>
              <Select value={novoFunc || undefined} onValueChange={setNovoFunc}>
                <SelectTrigger><SelectValue placeholder="selecione…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {funcs.filter(f => f.ativo).map(f => <SelectItem key={f.id} value={String(f.id)}>{f.codigo ? `${f.codigo} — ` : ""}{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="decimo">13º salário</SelectItem>
                  <SelectItem value="estagio">Estágio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaFolha(false)}>Cancelar</Button>
            <Button disabled={busy || !novoFunc} onClick={criarFolha}>Criar e abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

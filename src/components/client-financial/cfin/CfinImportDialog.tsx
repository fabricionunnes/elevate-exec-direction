import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "./helpers";

interface Linha { data: string | null; descricao: string; debito: number | null; credito: number | null }
interface Conta { id: number; codigo: string; banco: string | null }
interface Loja { codigo: string; nome: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipo: "extrato" | "despesas" | "retiradas";
  projectId: string;
  contas?: Conta[];
  contaIdInicial?: number | null;
  lojas?: Loja[];
  onDone: () => void;
}

const TITULOS = { extrato: "Importar extrato (PDF ou foto)", despesas: "Importar despesas (PDF ou foto)", retiradas: "Importar retiradas (PDF ou foto)" };
const MAX_MB = 8;

export function CfinImportDialog({ open, onOpenChange, tipo, projectId, contas = [], contaIdInicial, lojas = [], onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [contaId, setContaId] = useState<number | null>(contaIdInicial ?? null);
  const [lojaCodigo, setLojaCodigo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const reset = () => { setArquivo(null); setLinhas([]); setMarcadas(new Set()); setAnalisando(false); setSalvando(false); };

  const analisar = async (f: File) => {
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB}MB — envie uma foto menor ou divida o PDF.`); return; }
    setArquivo(f); setAnalisando(true); setLinhas([]);
    try {
      const buf = await f.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const base64 = btoa(bin);
      const media = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const { data, error } = await supabase.functions.invoke("cfin-importar", {
        body: { tipo, media_type: media, file_base64: base64 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const ls: Linha[] = (data?.linhas ?? []).filter((l: Linha) => l.descricao && (l.debito != null || l.credito != null));
      if (!ls.length) { toast.warning("Nenhum lançamento identificado no documento."); }
      setLinhas(ls);
      setMarcadas(new Set(ls.map((_, i) => i)));
    } catch (e) {
      toast.error(`Falha na leitura: ${e instanceof Error ? e.message : String(e)}`);
    }
    setAnalisando(false);
  };

  const lancar = async () => {
    const sel = linhas.filter((_, i) => marcadas.has(i));
    if (!sel.length) return;
    if (tipo === "extrato" && contaId == null) { toast.error("Escolha a conta."); return; }
    setSalvando(true);
    let error: { message: string } | null = null;
    if (tipo === "extrato") {
      const rows = sel.map(l => ({
        project_id: projectId, conta_id: contaId, data: l.data, descricao: l.descricao,
        debito: l.debito, credito: l.credito, origem: "importação IA",
      }));
      ({ error } = await supabase.from("cfin_lancamentos").insert(rows));
    } else {
      const tabela = tipo === "despesas" ? "cfin_despesas_fixas" : "cfin_retiradas";
      const rows = sel.map(l => ({
        project_id: projectId, data: l.data, descricao: l.descricao,
        valor: l.debito ?? l.credito ?? 0, loja_codigo: lojaCodigo || null,
      }));
      ({ error } = await supabase.from(tabela).insert(rows));
    }
    setSalvando(false);
    if (error) { toast.error(`Erro ao lançar: ${error.message}`); return; }
    toast.success(`${sel.length} lançamento(s) importado(s)`);
    reset(); onOpenChange(false); onDone();
  };

  const totalSel = linhas.filter((_, i) => marcadas.has(i))
    .reduce((s, l) => s + (l.debito ?? 0) + (l.credito ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {TITULOS[tipo]}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {tipo === "extrato" && (
              <div className="space-y-1 w-full sm:w-auto sm:min-w-[260px]">
                <Label>Lançar na conta</Label>
                <Select value={contaId != null ? String(contaId) : undefined} onValueChange={v => setContaId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Escolha a conta…" /></SelectTrigger>
                  <SelectContent>
                    {contas.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.codigo} — {c.banco}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipo !== "extrato" && lojas.length > 0 && (
              <div className="space-y-1 w-full sm:w-auto sm:min-w-[200px]">
                <Label>Loja (opcional)</Label>
                <Select value={lojaCodigo || "none"} onValueChange={v => setLojaCodigo(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {lojas.map(l => <SelectItem key={l.codigo} value={l.codigo}>{l.codigo} — {l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex-1" />
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) analisar(f); e.target.value = ""; }} />
            <Button onClick={() => fileRef.current?.click()} disabled={analisando}>
              {analisando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              {analisando ? "Lendo documento…" : arquivo ? "Trocar arquivo" : "Escolher PDF ou foto"}
            </Button>
          </div>

          {arquivo && !analisando && linhas.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                <b className="text-foreground">{arquivo.name}</b> — {linhas.length} lançamentos identificados.
                Desmarque o que não quiser importar e confira os valores antes de lançar.
              </div>
              <div className="rounded-md border overflow-x-auto max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox checked={marcadas.size === linhas.length}
                          onCheckedChange={c => setMarcadas(c ? new Set(linhas.map((_, i) => i)) : new Set())} />
                      </TableHead>
                      <TableHead>Data</TableHead><TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={i} className={marcadas.has(i) ? "" : "opacity-40"}>
                        <TableCell>
                          <Checkbox checked={marcadas.has(i)} onCheckedChange={c => {
                            const m = new Set(marcadas); c ? m.add(i) : m.delete(i); setMarcadas(m);
                          }} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(l.data)}</TableCell>
                        <TableCell>{l.descricao}</TableCell>
                        <TableCell className="text-right text-red-600">{l.debito != null ? fmtMoney(l.debito) : ""}</TableCell>
                        <TableCell className="text-right text-emerald-600">{l.credito != null ? fmtMoney(l.credito) : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm text-muted-foreground">{marcadas.size} selecionados — soma {fmtMoney(totalSel)}</div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button disabled={salvando || !marcadas.size || (tipo === "extrato" && contaId == null)} onClick={lancar}>
            {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Lançar {marcadas.size > 0 ? `${marcadas.size} itens` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = Record<string, unknown> & { id: number };
interface Campo { campo: string; label: string; num?: boolean }

const ABAS: { key: string; label: string; campos: Campo[]; busca?: string }[] = [
  {
    key: "cfin_funcionarios", label: "Funcionários", busca: "nome",
    campos: [
      { campo: "codigo", label: "Código" }, { campo: "nome", label: "Nome" },
      { campo: "nome_completo", label: "Nome completo" }, { campo: "funcao", label: "Função" },
      { campo: "loja_codigo", label: "Loja" }, { campo: "tipo", label: "Tipo (CLT/ESTAGIARIA)" },
    ],
  },
  {
    key: "cfin_contas_bancarias", label: "Contas bancárias",
    campos: [
      { campo: "codigo", label: "Código" }, { campo: "banco", label: "Banco" },
      { campo: "numero", label: "Número" }, { campo: "titular", label: "Titular" },
      { campo: "tipo", label: "PJ/PF" },
    ],
  },
  {
    key: "cfin_plano_contas", label: "Plano de contas", busca: "nome",
    campos: [
      { campo: "codigo", label: "Código" }, { campo: "nome", label: "Nome" },
      { campo: "natureza", label: "Natureza (CREDITO/DEBITO)" }, { campo: "grupo_dre", label: "Grupo DRE" },
      { campo: "fixa_variavel", label: "Fixa/Variável" },
    ],
  },
  {
    key: "cfin_lojas", label: "Lojas",
    campos: [{ campo: "codigo", label: "Código" }, { campo: "nome", label: "Nome" }],
  },
  {
    key: "cfin_verbas", label: "Verbas (folha)", busca: "nome",
    campos: [{ campo: "nome", label: "Nome" }, { campo: "tipo", label: "Tipo (CREDITO/DEBITO)" }],
  },
  {
    key: "cfin_maquinetas", label: "Maquinetas",
    campos: [
      { campo: "adquirente", label: "Adquirente" }, { campo: "loja_codigo", label: "Loja" },
      { campo: "empresa", label: "Empresa" }, { campo: "estabelecimento", label: "Estabelecimento" },
      { campo: "cnpj", label: "CNPJ" }, { campo: "taxa_debito", label: "Taxa débito", num: true },
      { campo: "taxa_credito_avista", label: "Taxa crédito à vista", num: true }, { campo: "terminal", label: "Terminal" },
    ],
  },
  {
    key: "cfin_empresas", label: "Empresas",
    campos: [
      { campo: "nome", label: "Nome" }, { campo: "cnpj", label: "CNPJ" },
      { campo: "logo_url", label: "Logo (URL p/ holerite)" },
    ],
  },
];

export function CfinCadastrosPanel({ projectId, canEdit, canDelete = canEdit }: { projectId: string; canEdit: boolean; canDelete?: boolean }) {
  const [aba, setAba] = useState(ABAS[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<({ [k: string]: string | number | undefined; id?: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from(aba.key).select("*")
      .eq("project_id", projectId).order(aba.campos[0].campo).limit(1000);
    setRows((data as Row[]) ?? []);
  }, [aba, projectId]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    setBusy(true);
    const row: Record<string, unknown> = { project_id: projectId };
    for (const c of aba.campos) {
      const v = form[c.campo];
      row[c.campo] = v === "" || v == null ? null : (c.num ? parseFloat(String(v).replace(",", ".")) : v);
    }
    const { error } = form.id
      ? await supabase.from(aba.key).update(row).eq("id", form.id)
      : await supabase.from(aba.key).insert(row);
    setBusy(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Salvo");
    setForm(null); carregar();
  };

  const excluir = async (r: Row) => {
    if (!confirm("Excluir este registro? (lançamentos/folhas vinculados a ele não são apagados)")) return;
    const { error } = await supabase.from(aba.key).delete().eq("id", r.id);
    if (error) { toast.error("Não foi possível excluir — registro em uso. Você pode inativá-lo."); return; }
    carregar();
  };

  const toggleAtivo = async (r: Row) => {
    if (!canEdit || !("ativo" in r)) return;
    await supabase.from(aba.key).update({ ativo: !r.ativo }).eq("id", r.id);
    carregar();
  };

  const filtrados = busca && aba.busca
    ? rows.filter(r => String(r[aba.busca!] ?? "").toLowerCase().includes(busca.toLowerCase()))
    : rows;

  return (
    <div className="space-y-4">
      <Tabs value={aba.key} onValueChange={k => { setAba(ABAS.find(a => a.key === k)!); setBusca(""); }}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto p-1 min-w-max">
            {ABAS.map(a => <TabsTrigger key={a.key} value={a.key} className="text-xs px-3 py-1.5">{a.label}</TabsTrigger>)}
          </TabsList>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        {aba.busca && <Input className="w-full sm:w-[240px]" placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />}
        <span className="text-xs text-muted-foreground">{filtrados.length} registros</span>
        <div className="flex-1" />
        {canEdit && (
          <Button size="sm" onClick={() => setForm(Object.fromEntries(aba.campos.map(c => [c.campo, ""])))}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {aba.campos.map(c => <TableHead key={c.campo}>{c.label}</TableHead>)}
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map(r => (
              <TableRow key={r.id}>
                {aba.campos.map(c => (
                  <TableCell key={c.campo} className={c.num ? "text-right" : ""}>{String(r[c.campo] ?? "")}</TableCell>
                ))}
                <TableCell>
                  {"ativo" in r
                    ? <Badge variant={r.ativo ? "default" : "outline"} className={canEdit ? "cursor-pointer" : ""} onClick={() => toggleAtivo(r)}>{r.ativo ? "ativo" : "inativo"}</Badge>
                    : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({
                        id: r.id, ...Object.fromEntries(aba.campos.map(c => [c.campo, String(r[c.campo] ?? "")])),
                      })}><Pencil className="h-3.5 w-3.5" /></Button>
                      {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluir(r)}><Trash2 className="h-3.5 w-3.5" /></Button>}
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
          <DialogHeader><DialogTitle>{form?.id ? "Editar" : "Novo"} — {aba.label}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aba.campos.map(c => (
                <div key={c.campo} className={`space-y-1 ${c.campo.includes("nome") || c.campo === "logo_url" ? "col-span-2" : ""}`}>
                  <Label>{c.label}</Label>
                  <Input value={String(form[c.campo] ?? "")} onChange={e => setForm({ ...form, [c.campo]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={busy} onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

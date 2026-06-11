import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtMoney, hojeISO } from "./helpers";

interface DreRow { grupo_dre: string | null; plano_codigo: string; plano_nome: string; natureza: string | null; total: number }
interface Loja { codigo: string; nome: string }

export function CfinDrePanel({ projectId }: { projectId: string }) {
  const ano = new Date().getFullYear();
  const [de, setDe] = useState(`${ano}-01-01`);
  const [ate, setAte] = useState(hojeISO());
  const [loja, setLoja] = useState("");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [rows, setRows] = useState<DreRow[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.from("cfin_lojas").select("codigo,nome").eq("project_id", projectId).eq("ativo", true)
      .then(({ data }) => setLojas((data as Loja[]) ?? []));
  }, [projectId]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("cfin_dre_periodo", {
      p_project: projectId, p_inicio: de, p_fim: ate, p_loja: loja || null,
    });
    if (error) toast.error("Erro ao calcular DRE");
    setRows((data as DreRow[]) ?? []);
    setCarregando(false);
  }, [projectId, de, ate, loja]);
  useEffect(() => { carregar(); }, [carregar]);

  const grupos = new Map<string, DreRow[]>();
  for (const r of rows) {
    const g = r.grupo_dre ?? "Sem grupo DRE";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(r);
  }
  const receitas = rows.filter(r => r.natureza === "CREDITO").reduce((s, r) => s + r.total, 0);
  const despesas = rows.filter(r => r.natureza !== "CREDITO").reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={de} onChange={e => setDe(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={e => setAte(e.target.value)} /></div>
        <div className="space-y-1">
          <Label className="text-xs">Loja</Label>
          <Select value={loja || "todas"} onValueChange={v => setLoja(v === "todas" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {lojas.map(l => <SelectItem key={l.codigo} value={l.codigo}>{l.codigo} — {l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Entradas classificadas</div><div className="text-lg font-bold text-emerald-600">{fmtMoney(receitas)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Saídas classificadas</div><div className="text-lg font-bold text-red-600">{fmtMoney(despesas)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Resultado</div><div className={`text-lg font-bold ${receitas - despesas < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(receitas - despesas)}</div></CardContent></Card>
      </div>

      {carregando && <p className="text-sm text-muted-foreground">Calculando…</p>}
      {[...grupos.entries()].map(([grupo, items]) => (
        <Card key={grupo}>
          <CardContent className="pt-4">
            <div className="font-semibold mb-2">{grupo} <span className="text-muted-foreground text-sm">({fmtMoney(items.reduce((s, i) => s + i.total, 0))})</span></div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Código</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Total no período</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {items.map(i => (
                  <TableRow key={i.plano_codigo}>
                    <TableCell>{i.plano_codigo}</TableCell>
                    <TableCell>{i.plano_nome}</TableCell>
                    <TableCell className={`text-right ${i.natureza === "CREDITO" ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(i.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {!carregando && !rows.length && <p className="text-sm text-muted-foreground">Nenhum lançamento classificado com plano de contas no período.</p>}
      <p className="text-xs text-muted-foreground">Baseado nos lançamentos com plano de contas preenchido (inclui lançamentos informativos migrados do diário geral da planilha).</p>
    </div>
  );
}

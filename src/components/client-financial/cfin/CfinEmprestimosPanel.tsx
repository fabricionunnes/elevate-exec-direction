import { useCallback, useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fmtMoney, fmtDate } from "./helpers";

interface Emp {
  id: number; credor: string; dia_vencimento: number | null; valor_original: number | null;
  taxa: string | null; valor_parcela: number | null; saldo_devedor: number | null;
  observacao: string | null; ativo: boolean;
}
interface Parcela { id: number; emprestimo_id: number; competencia: string; valor: number; pago: boolean }

export function CfinEmprestimosPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Emp[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("cfin_emprestimos").select("*")
      .eq("project_id", projectId).order("saldo_devedor", { ascending: false });
    const es = (data as Emp[]) ?? [];
    setRows(es);
    if (es.length) {
      const { data: p } = await supabase.from("cfin_emprestimo_parcelas").select("*")
        .in("emprestimo_id", es.map(e => e.id)).order("competencia");
      setParcelas((p as Parcela[]) ?? []);
    }
  }, [projectId]);
  useEffect(() => { carregar(); }, [carregar]);

  const togglePago = async (p: Parcela) => {
    if (!canEdit) return;
    await supabase.from("cfin_emprestimo_parcelas").update({ pago: !p.pago }).eq("id", p.id);
    setParcelas(ps => ps.map(x => x.id === p.id ? { ...x, pago: !p.pago } : x));
  };

  const totalDevedor = rows.filter(r => r.ativo).reduce((s, r) => s + (r.saldo_devedor ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3">
          <div className="text-xs text-muted-foreground">Saldo devedor total (contratos ativos)</div>
          <div className="text-xl font-bold text-red-600">{fmtMoney(totalDevedor)}</div>
        </CardContent>
      </Card>

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
                    <TableCell>
                      {ps.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                          {aberto === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {ps.length} parc.
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {aberto === e.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="max-w-md">
                          <Table>
                            <TableHeader>
                              <TableRow><TableHead>Competência</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Pago</TableHead></TableRow>
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
    </div>
  );
}

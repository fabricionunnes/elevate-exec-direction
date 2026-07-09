import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, fmtDate } from "./helpers";

interface SaldoConta {
  id: number; codigo: string; banco: string | null; numero: string | null; titular: string | null;
  tipo: string | null; ativo: boolean; saldo: number; qtd_lancamentos: number; ultimo_lancamento: string | null;
}

export function CfinVisaoGeralPanel({ projectId }: { projectId: string }) {
  const [contas, setContas] = useState<SaldoConta[]>([]);
  const [totEmprestimos, setTotEmprestimos] = useState<number | null>(null);
  const [funcAtivos, setFuncAtivos] = useState<number | null>(null);
  const [folhasMes, setFolhasMes] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("cfin_v_saldo_contas").select("*").eq("project_id", projectId).order("saldo", { ascending: false })
      .then(({ data }) => setContas((data as SaldoConta[]) ?? []));
    supabase.from("cfin_emprestimos").select("saldo_devedor").eq("project_id", projectId).eq("ativo", true)
      .then(({ data }) => setTotEmprestimos((data ?? []).reduce((s, e) => s + (e.saldo_devedor ?? 0), 0)));
    supabase.from("cfin_funcionarios").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("ativo", true)
      .then(({ count }) => setFuncAtivos(count));
    const now = new Date();
    supabase.from("cfin_folhas").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).eq("ano", now.getFullYear()).eq("mes", now.getMonth() + 1)
      .then(({ count }) => setFolhasMes(count));
  }, [projectId]);

  const ativas = contas.filter(c => c.qtd_lancamentos > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Empréstimos — saldo devedor</div>
            <div className="text-xl font-bold text-red-600">{totEmprestimos == null ? "…" : fmtMoney(totEmprestimos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Funcionários ativos</div>
            <div className="text-xl font-bold">{funcAtivos ?? "…"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground">Folhas geradas no mês atual</div>
            <div className="text-xl font-bold">{folhasMes ?? "…"}</div>
          </CardContent>
        </Card>
      </div>

      <h3 className="font-semibold">Contas com movimento</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead><TableHead>Banco</TableHead><TableHead>Titular</TableHead>
              <TableHead>Tipo</TableHead><TableHead className="text-right">Lançamentos</TableHead>
              <TableHead>Último mov.</TableHead><TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ativas.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.codigo}</TableCell>
                <TableCell>{c.banco}</TableCell>
                <TableCell>{c.titular}</TableCell>
                <TableCell>{c.tipo}</TableCell>
                <TableCell className="text-right">{c.qtd_lancamentos.toLocaleString("pt-BR")}</TableCell>
                <TableCell>{fmtDate(c.ultimo_lancamento)}</TableCell>
                <TableCell className={`text-right font-medium ${c.saldo < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(c.saldo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Saldo calculado pelos débitos/créditos migrados da planilha; lançamentos com data futura e informativos não afetam o saldo.</p>
    </div>
  );
}

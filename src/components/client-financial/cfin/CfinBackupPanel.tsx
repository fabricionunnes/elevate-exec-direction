import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const TABELAS = [
  "cfin_empresas", "cfin_lojas", "cfin_contas_bancarias", "cfin_plano_contas",
  "cfin_funcionarios", "cfin_verbas", "cfin_maquinetas", "cfin_emprestimos",
  "cfin_despesas_fixas", "cfin_retiradas", "cfin_lancamentos", "cfin_folhas",
];
const LOTE = 5000;

export function CfinBackupPanel({ projectId }: { projectId: string }) {
  const [progresso, setProgresso] = useState("");
  const [busy, setBusy] = useState(false);

  const exportar = async () => {
    setBusy(true);
    try {
      const wb = XLSX.utils.book_new();
      const folhaIds: number[] = [];
      const empIds: number[] = [];
      for (const tabela of TABELAS) {
        setProgresso(`Baixando ${tabela}…`);
        const todas: Record<string, unknown>[] = [];
        for (let off = 0; ; off += LOTE) {
          const { data, error } = await supabase.from(tabela).select("*")
            .eq("project_id", projectId).order("id").range(off, off + LOTE - 1);
          if (error) throw new Error(`${tabela}: ${error.message}`);
          todas.push(...(data ?? []));
          setProgresso(`Baixando ${tabela}… ${todas.length.toLocaleString("pt-BR")}`);
          if (!data || data.length < LOTE) break;
        }
        if (tabela === "cfin_folhas") folhaIds.push(...todas.map(t => t.id as number));
        if (tabela === "cfin_emprestimos") empIds.push(...todas.map(t => t.id as number));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(todas), tabela.replace("cfin_", "").slice(0, 31));
      }
      // tabelas filhas (sem project_id direto)
      for (const [tabela, col, ids] of [["cfin_folha_itens", "folha_id", folhaIds], ["cfin_emprestimo_parcelas", "emprestimo_id", empIds]] as const) {
        const todas: Record<string, unknown>[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          setProgresso(`Baixando ${tabela}… ${todas.length.toLocaleString("pt-BR")}`);
          for (let off = 0; ; off += LOTE) {
            const { data, error } = await supabase.from(tabela).select("*")
              .in(col, ids.slice(i, i + 200)).order("id").range(off, off + LOTE - 1);
            if (error) throw new Error(`${tabela}: ${error.message}`);
            todas.push(...(data ?? []));
            if (!data || data.length < LOTE) break;
          }
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(todas), tabela.replace("cfin_", "").slice(0, 31));
      }
      setProgresso("Gerando arquivo…");
      const nome = `backup-financeiro-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, nome);
      setProgresso(`Backup gerado: ${nome}`);
    } catch (e) {
      setProgresso(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-base">Backup completo em Excel</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          Gera um arquivo <b>.xlsx</b> com <b>todos os dados financeiros e de folha</b> — uma aba por tabela:
          lançamentos bancários, folhas de pagamento, funcionários, plano de contas, empréstimos, retiradas,
          despesas, maquinetas e cadastros.
        </p>
        <p className="text-sm text-muted-foreground">
          Guarde como cópia de segurança. Se um dia quiser parar de usar o sistema, este arquivo
          contém tudo o que foi inserido, em formato aberto (Excel).
        </p>
        <Button onClick={exportar} disabled={busy}>
          <Download className="h-4 w-4 mr-1" /> {busy ? "Exportando…" : "Gerar backup agora"}
        </Button>
        {progresso && <p className={`text-sm ${progresso.startsWith("Erro") ? "text-red-600" : "text-emerald-600"}`}>{progresso}</p>}
        {busy && <p className="text-xs text-muted-foreground">São mais de 90 mil registros — pode levar um ou dois minutos.</p>}
      </CardContent>
    </Card>
  );
}

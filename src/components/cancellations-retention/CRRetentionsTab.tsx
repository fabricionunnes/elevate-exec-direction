import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";

interface Props {
  retentionAttempts: any[];
}

const STRATEGY_LABELS: Record<string, string> = {
  desconto: "Desconto",
  upgrade: "Upgrade de plano",
  reuniao: "Reunião de alinhamento",
  troca_consultor: "Troca de consultor",
  plano_acao: "Plano de ação personalizado",
  pausa: "Pausa temporária",
  outro: "Outro",
};

export function CRRetentionsTab({ retentionAttempts }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return retentionAttempts.filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.company_name?.toLowerCase().includes(q) || r.project_name?.toLowerCase().includes(q);
    }).sort((a: any, b: any) => (b.attempt_date || "").localeCompare(a.attempt_date || ""));
  }, [retentionAttempts, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Estratégia</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma tentativa de retenção registrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.company_name || r.project_name || "—"}</TableCell>
                    <TableCell>{r.staff_name || "—"}</TableCell>
                    <TableCell>{r.attempt_date ? format(parseISO(r.attempt_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STRATEGY_LABELS[r.strategy] || r.strategy || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.result === "retained" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-600">Retido</Badge>
                      ) : r.result === "cancelled" ? (
                        <Badge variant="destructive">Cancelamento mantido</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

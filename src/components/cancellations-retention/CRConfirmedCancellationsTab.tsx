import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format, parseISO, differenceInMonths } from "date-fns";
import { Search } from "lucide-react";

interface Props {
  projects: any[];
  companies: any[];
}

const REASON_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  falta_resultado: "Falta de resultado",
  mudanca_estrategia: "Mudança de estratégia",
  encerramento_empresa: "Encerramento da empresa",
  insatisfacao_servico: "Insatisfação com serviço",
  outro: "Outro",
};

export function CRConfirmedCancellationsTab({ projects, companies }: Props) {
  const [search, setSearch] = useState("");

  const cancelled = useMemo(() => {
    return projects.filter(p => p.status === "closed" && p.churn_date).map(p => {
      const company = companies.find(c => c.id === p.onboarding_company_id);
      const contractStart = company?.contract_start_date;
      const clientTime = contractStart && p.churn_date
        ? differenceInMonths(parseISO(p.churn_date), parseISO(contractStart))
        : null;

      return {
        ...p,
        company_name: company?.name || p.product_name,
        consultant_name: p.consultant_name || company?.consultant?.name || "—",
        contract_value: company?.contract_value || null,
        segment: company?.segment || null,
        client_months: clientTime,
      };
    }).filter(p => {
      if (!search) return true;
      return p.company_name?.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => (b.churn_date || "").localeCompare(a.churn_date || ""));
  }, [projects, companies, search]);

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

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
                <TableHead>Consultor</TableHead>
                <TableHead>Data Cancelamento</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Tempo de Cliente</TableHead>
                <TableHead>Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cancelled.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cancelamento confirmado
                  </TableCell>
                </TableRow>
              ) : (
                cancelled.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.company_name}</TableCell>
                    <TableCell>{p.consultant_name}</TableCell>
                    <TableCell>{p.churn_date ? format(parseISO(p.churn_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {REASON_LABELS[p.churn_reason] || p.churn_reason || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.client_months !== null ? `${p.client_months} meses` : "—"}</TableCell>
                    <TableCell>{formatCurrency(p.contract_value)}</TableCell>
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

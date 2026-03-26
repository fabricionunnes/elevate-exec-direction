import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format, parseISO } from "date-fns";
import { Search, ExternalLink } from "lucide-react";

interface Props {
  projects: any[];
  staff: any[];
  filters: { period: string; consultant: string; reason: string };
  onFilterChange: (key: string, val: string) => void;
}

const REASONS = [
  "financeiro", "falta_resultado", "mudanca_estrategia", "encerramento_empresa",
  "insatisfacao_servico", "outro",
];

const REASON_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  falta_resultado: "Falta de resultado",
  mudanca_estrategia: "Mudança de estratégia",
  encerramento_empresa: "Encerramento da empresa",
  insatisfacao_servico: "Insatisfação com serviço",
  outro: "Outro",
};

export function CRCancellationRequestsTab({ projects, staff, filters, onFilterChange }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const requests = useMemo(() => {
    return projects.filter(p =>
      p.status === "cancellation_signaled" || p.status === "notice_period"
    ).filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.company_name?.toLowerCase().includes(q) && !p.product_name?.toLowerCase().includes(q)) return false;
      }
      if (filters.consultant && filters.consultant !== "all") {
        if (p.consultant_id !== filters.consultant && p.cs_id !== filters.consultant) return false;
      }
      if (filters.reason && filters.reason !== "all") {
        if (p.cancellation_signal_reason !== filters.reason) return false;
      }
      return true;
    });
  }, [projects, search, filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filters.consultant} onValueChange={v => onFilterChange("consultant", v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.reason} onValueChange={v => onFilterChange("reason", v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Motivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {REASONS.map(r => <SelectItem key={r} value={r}>{REASON_LABELS[r] || r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Data da Solicitação</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status Retenção</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                requests.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.company_name || p.product_name}</TableCell>
                    <TableCell>{p.consultant_name || p.cs_name || "—"}</TableCell>
                    <TableCell>
                      {p.cancellation_signal_date ? format(parseISO(p.cancellation_signal_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {REASON_LABELS[p.cancellation_signal_reason] || p.cancellation_signal_reason || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.retention_status === "retido" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-600">Retido</Badge>
                      ) : p.retention_status === "encerrado" ? (
                        <Badge variant="destructive">Encerrado</Badge>
                      ) : p.retention_status ? (
                        <Badge className="bg-amber-500/20 text-amber-600">{p.retention_status}</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/onboarding-tasks/${p.id}`)}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </TableCell>
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

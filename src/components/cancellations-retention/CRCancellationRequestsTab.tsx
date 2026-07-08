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
import { Search, ExternalLink, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [savingNexus, setSavingNexus] = useState<string | null>(null);

  // Anti-churn: em vez de perder o cliente, oferece downgrade pro plano Nexus Only
  // (só sistema, R$497). Muda o plano e mantém os dados; a cobrança é ajustada à
  // mão no Asaas (não automatizo billing sem piloto).
  const offerNexusOnly = async (p: any) => {
    const cid = p.onboarding_company_id || p.company_id;
    if (!cid) { toast.error("Empresa não vinculada ao projeto."); return; }
    if (!confirm(`Mudar ${p.company_name || "este cliente"} para o plano NEXUS ONLY (R$ 497/mês, só sistema)?\n\nO cliente mantém dashboards, KPIs, evolução, leads e histórico; some o que depende de consultor. IMPORTANTE: ajuste a cobrança pra R$ 497 no Asaas manualmente.`)) return;
    setSavingNexus(p.id);
    try {
      const { error } = await supabase
        .from("onboarding_companies").update({ plan_tier: "nexus_only" }).eq("id", cid);
      if (error) throw error;
      toast.success("Cliente migrado pra Nexus Only. Ajuste a cobrança pra R$ 497 no Asaas.");
    } catch (e: any) {
      toast.error("Erro ao migrar: " + (e?.message || e));
    } finally {
      setSavingNexus(null);
    }
  };

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
        <SearchableSelect
          value={filters.consultant}
          onValueChange={v => onFilterChange("consultant", v)}
          options={[
            { value: "all", label: "Todos" },
            ...staff.map(s => ({ value: s.id, label: s.name })),
          ]}
          placeholder="Consultor"
          className="w-[180px]"
        />
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                          disabled={savingNexus === p.id}
                          onClick={() => offerNexusOnly(p)}
                          title="Reter como Nexus Only (R$ 497/mês, só sistema)"
                        >
                          <LifeBuoy className="h-3 w-3 mr-1" /> Nexus Only
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/onboarding-tasks/${p.id}`)}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Ver
                        </Button>
                      </div>
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

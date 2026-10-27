import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Briefcase, Loader2, Users, Wallet, Target, AlertTriangle } from "lucide-react";

interface LinhaCarteira {
  consultant_id: string;
  consultant_name: string;
  company_id: string;
  company_name: string;
  project_id: string;
  product_name: string | null;
  monthly_cents: number;
  origem: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_months: number | null;
  commission_max_cents: number;
  project_status: string;
  contrato_vencido: boolean;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brlExato = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rotuloStatus: Record<string, string> = {
  active: "Ativo",
  cancellation_signaled: "Sinalizou cancelamento",
  notice_period: "Em aviso",
};

export default function CarteiraConsultorPage() {
  const navigate = useNavigate();
  const { currentStaff, isMaster, loading: carregandoPerm } = useStaffPermissions();
  const [linhas, setLinhas] = useState<LinhaCarteira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [consultorFiltro, setConsultorFiltro] = useState("none");
  const [consultores, setConsultores] = useState<{ value: string; label: string }[]>([]);

  const podeFiltrar = isMaster || currentStaff?.role === "admin";

  useEffect(() => {
    if (carregandoPerm) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const alvo = consultorFiltro && consultorFiltro !== "none" ? consultorFiltro : null;
      const { data, error } = await supabase.rpc("carteira_consultores", {
        p_consultant_id: alvo,
      });
      if (cancelado) return;
      if (error) {
        console.error("carteira_consultores", error);
        setLinhas([]);
      } else {
        setLinhas((data || []) as LinhaCarteira[]);
      }
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [consultorFiltro, carregandoPerm]);

  useEffect(() => {
    if (carregandoPerm || !podeFiltrar) return;
    (async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("is_active", true)
        .eq("role", "consultant")
        .order("name");
      setConsultores((data || []).map((s: any) => ({ value: s.id, label: s.name })));
    })();
  }, [carregandoPerm, podeFiltrar]);

  // Com filtro ligado a lista ja vem de um consultor so; sem filtro, o master ve
  // todos e a gente agrupa pra ele comparar as carteiras lado a lado.
  const porConsultor = useMemo(() => {
    const mapa = new Map<string, { nome: string; linhas: LinhaCarteira[] }>();
    linhas.forEach((l) => {
      const atual = mapa.get(l.consultant_id) || { nome: l.consultant_name, linhas: [] };
      atual.linhas.push(l);
      mapa.set(l.consultant_id, atual);
    });
    return Array.from(mapa, ([id, v]) => ({
      id,
      nome: v.nome,
      linhas: v.linhas.sort((a, b) => b.monthly_cents - a.monthly_cents),
      total: v.linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0),
      comissao: v.linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0),
    })).sort((a, b) => b.total - a.total);
  }, [linhas]);

  const totalGeral = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0),
    [linhas],
  );
  const comissaoGeral = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0),
    [linhas],
  );
  const vencidos = useMemo(() => linhas.filter((l) => l.contrato_vencido).length, [linhas]);

  if (carregandoPerm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Carteira do consultor</h1>
            <p className="text-sm text-muted-foreground">
              Quanto cada empresa representa por mês. Contrato anual entra já dividido pelos meses.
            </p>
          </div>
        </div>
        {podeFiltrar && consultores.length > 0 && (
          <div className="w-full sm:w-72">
            <SearchableSelect
              value={consultorFiltro}
              onValueChange={setConsultorFiltro}
              options={consultores}
              placeholder="Todos os consultores"
              allowNone
              noneLabel="Todos os consultores"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" /> Carteira por mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{brl(totalGeral)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4" /> Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{linhas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" /> Comissão possível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{brl(comissaoGeral)}</p>
            <p className="text-xs text-muted-foreground">quando o cliente bate a meta</p>
          </CardContent>
        </Card>
      </div>

      {vencidos > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {vencidos === 1
            ? "1 contrato está com a data de término vencida."
            : `${vencidos} contratos estão com a data de término vencida.`}
        </div>
      )}

      {carregando ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : linhas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma empresa na carteira.
          </CardContent>
        </Card>
      ) : (
        porConsultor.map((grupo) => (
          <Card key={grupo.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> {grupo.nome}
                </CardTitle>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{grupo.linhas.length} contratos</span>
                  <span className="font-semibold">{brlExato(grupo.total)} por mês</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="hidden sm:table-cell">Produto</TableHead>
                      <TableHead className="text-right">Por mês</TableHead>
                      <TableHead className="hidden lg:table-cell">Como foi calculado</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupo.linhas.map((l) => (
                      <TableRow key={l.project_id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{l.company_name}</span>
                            <div className="flex flex-wrap items-center gap-1">
                              {l.project_status !== "active" && (
                                <Badge variant="outline" className="text-[10px]">
                                  {rotuloStatus[l.project_status] || l.project_status}
                                </Badge>
                              )}
                              {l.contrato_vencido && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Contrato vencido
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {l.product_name}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {l.product_name || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {brlExato(Number(l.monthly_cents || 0))}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {l.origem}
                          {l.contract_months && l.contract_months > 1 && l.contract_value
                            ? ` (${Number(l.contract_value).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                                maximumFractionDigits: 0,
                              })} em ${l.contract_months} meses)`
                            : ""}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground tabular-nums">
                          {Number(l.commission_max_cents) > 0
                            ? brlExato(Number(l.commission_max_cents))
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

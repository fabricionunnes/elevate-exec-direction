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
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Users,
  Wallet,
  Target,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
} from "lucide-react";

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
  dias_para_vencer: number | null;
}

interface LinhaHistorico {
  mes: string;
  faturado_cents: number;
  recebido_cents: number;
  comissao_cents: number;
  clientes: number;
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

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => {
  const [ano, mes] = m.split("-");
  return `${MESES_CURTOS[Number(mes) - 1]}/${ano.slice(2)}`;
};

const CORES = ["#0D2B5E", "#CC1B1B", "#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#be185d"];

export default function CarteiraConsultorPage() {
  const navigate = useNavigate();
  const { currentStaff, isMaster, loading: carregandoPerm } = useStaffPermissions();
  const [linhas, setLinhas] = useState<LinhaCarteira[]>([]);
  const [historico, setHistorico] = useState<LinhaHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [consultorFiltro, setConsultorFiltro] = useState("none");
  const [consultores, setConsultores] = useState<{ value: string; label: string }[]>([]);

  const podeFiltrar = isMaster || currentStaff?.role === "admin";

  useEffect(() => {
    if (carregandoPerm || !podeFiltrar) return;
    (async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id, name")
        .eq("is_active", true)
        .in("role", ["consultant", "master", "admin"])
        .order("name");
      setConsultores((data || []).map((s: any) => ({ value: s.id, label: s.name })));
    })();
  }, [carregandoPerm, podeFiltrar]);

  useEffect(() => {
    if (carregandoPerm) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const alvo = consultorFiltro && consultorFiltro !== "none" ? consultorFiltro : null;
      const [carteira, hist] = await Promise.all([
        supabase.rpc("carteira_consultores", { p_consultant_id: alvo }),
        supabase.rpc("carteira_consultores_historico", { p_consultant_id: alvo, p_meses: 12 }),
      ]);
      if (cancelado) return;
      if (carteira.error) console.error("carteira_consultores", carteira.error);
      if (hist.error) console.error("carteira_consultores_historico", hist.error);
      setLinhas((carteira.data || []) as LinhaCarteira[]);
      setHistorico((hist.data || []) as LinhaHistorico[]);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [consultorFiltro, carregandoPerm]);

  const totalGeral = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0),
    [linhas],
  );
  const comissaoPossivel = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.commission_max_cents || 0), 0),
    [linhas],
  );
  const ticketMedio = linhas.length ? Math.round(totalGeral / linhas.length) : 0;
  const vencidos = useMemo(() => linhas.filter((l) => l.contrato_vencido), [linhas]);
  const vencendo = useMemo(
    () =>
      linhas.filter(
        (l) => !l.contrato_vencido && l.dias_para_vencer !== null && l.dias_para_vencer <= 60,
      ),
    [linhas],
  );
  const emRisco = useMemo(
    () => linhas.filter((l) => l.project_status !== "active"),
    [linhas],
  );

  const serie = useMemo(
    () =>
      historico.map((h) => ({
        mes: rotuloMes(h.mes),
        Faturado: Number(h.faturado_cents || 0) / 100,
        Recebido: Number(h.recebido_cents || 0) / 100,
        Comissão: Number(h.comissao_cents || 0) / 100,
        Clientes: h.clientes,
      })),
    [historico],
  );

  const comissaoGanha12m = useMemo(
    () => historico.reduce((s, h) => s + Number(h.comissao_cents || 0), 0),
    [historico],
  );

  const variacao = useMemo(() => {
    const comDados = historico.filter((h) => Number(h.faturado_cents) > 0);
    if (comDados.length < 2) return null;
    const atual = Number(comDados[comDados.length - 1].faturado_cents);
    const anterior = Number(comDados[comDados.length - 2].faturado_cents);
    if (!anterior) return null;
    return ((atual - anterior) / anterior) * 100;
  }, [historico]);

  const porProduto = useMemo(() => {
    const mapa = new Map<string, number>();
    linhas.forEach((l) => {
      const k = l.product_name || "Sem produto";
      mapa.set(k, (mapa.get(k) || 0) + Number(l.monthly_cents || 0));
    });
    return Array.from(mapa, ([name, value]) => ({ name, value: value / 100 })).sort(
      (a, b) => b.value - a.value,
    );
  }, [linhas]);

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
      linhas: v.linhas.sort((a, b) => Number(b.monthly_cents) - Number(a.monthly_cents)),
      total: v.linhas.reduce((s, l) => s + Number(l.monthly_cents || 0), 0),
    })).sort((a, b) => b.total - a.total);
  }, [linhas]);

  if (carregandoPerm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-5 px-4 py-6">
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

      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Carteira por mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{brl(totalGeral)}</p>
                {variacao !== null && (
                  <p
                    className={`flex items-center gap-1 text-xs ${
                      variacao > 0 ? "text-emerald-600" : variacao < 0 ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    {variacao > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : variacao < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {Math.abs(variacao).toFixed(0)}% no faturado vs mês anterior
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /> Contratos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{linhas.length}</p>
                <p className="text-xs text-muted-foreground">
                  {new Set(linhas.map((l) => l.company_id)).size} empresas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" /> Ticket médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{brl(ticketMedio)}</p>
                <p className="text-xs text-muted-foreground">por contrato</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Comissão possível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{brl(comissaoPossivel)}</p>
                <p className="text-xs text-muted-foreground">
                  {brl(comissaoGanha12m)} ganhos em 12 meses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" /> Renovação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{vencendo.length + vencidos.length}</p>
                <p className="text-xs text-muted-foreground">
                  {vencidos.length} vencidos, {vencendo.length} em 60 dias
                </p>
              </CardContent>
            </Card>
          </div>

          {(vencidos.length > 0 || emRisco.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {vencidos.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {vencidos.length === 1 ? "1 contrato vencido" : `${vencidos.length} contratos vencidos`}
                  </div>
                  <p className="mt-1 text-xs">
                    {vencidos.slice(0, 4).map((l) => l.company_name).join(", ")}
                    {vencidos.length > 4 ? ` e mais ${vencidos.length - 4}` : ""}
                  </p>
                </div>
              )}
              {emRisco.length > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {emRisco.length === 1 ? "1 cliente saindo" : `${emRisco.length} clientes saindo`}
                  </div>
                  <p className="mt-1 text-xs">
                    {brl(emRisco.reduce((s, l) => s + Number(l.monthly_cents || 0), 0))} por mês em risco:{" "}
                    {emRisco.slice(0, 3).map((l) => l.company_name).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Últimos 12 meses</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Faturado e recebido das empresas da carteira, com a comissão por meta batida
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                      />
                      <RTooltip
                        formatter={(v: any, nome: any) =>
                          nome === "Clientes"
                            ? [v, nome]
                            : [Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), nome]
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Faturado" fill="#0D2B5E" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Recebido" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="Comissão" stroke="#CC1B1B" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por produto</CardTitle>
                <p className="text-xs text-muted-foreground">Divisão da carteira mensal</p>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={porProduto} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                        {porProduto.map((_, i) => (
                          <Cell key={i} fill={CORES[i % CORES.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(v: any) =>
                          Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {porProduto.slice(0, 5).map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: CORES[i % CORES.length] }}
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico mês a mês</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Faturado</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Inadimplência</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico
                      .filter((h) => Number(h.faturado_cents) > 0)
                      .slice()
                      .reverse()
                      .map((h) => {
                        const fat = Number(h.faturado_cents || 0);
                        const rec = Number(h.recebido_cents || 0);
                        const inad = fat > 0 ? ((fat - rec) / fat) * 100 : 0;
                        return (
                          <TableRow key={h.mes}>
                            <TableCell className="font-medium">{rotuloMes(h.mes)}</TableCell>
                            <TableCell className="text-right tabular-nums">{brlExato(fat)}</TableCell>
                            <TableCell className="text-right tabular-nums">{brlExato(rec)}</TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${inad > 15 ? "text-red-600" : "text-muted-foreground"}`}
                            >
                              {inad.toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(h.comissao_cents) > 0 ? brlExato(Number(h.comissao_cents)) : "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{h.clientes}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {linhas.length === 0 ? (
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
                                    <Badge variant="destructive" className="text-[10px]">
                                      {rotuloStatus[l.project_status] || l.project_status}
                                    </Badge>
                                  )}
                                  {l.contrato_vencido && (
                                    <Badge variant="outline" className="border-amber-400 text-[10px] text-amber-700">
                                      Contrato vencido
                                    </Badge>
                                  )}
                                  {!l.contrato_vencido &&
                                    l.dias_para_vencer !== null &&
                                    l.dias_para_vencer <= 60 && (
                                      <Badge variant="outline" className="text-[10px]">
                                        Vence em {l.dias_para_vencer} dias
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
        </>
      )}
    </div>
  );
}

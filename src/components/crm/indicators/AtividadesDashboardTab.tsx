// Dashboard de Atividades (benchmark Datacrazy, 30/09/2026): o que o time concluiu, o que
// está atrasado e quem está segurando. Também os blocos "Leads sem atividade" e "Leads
// atrasados" que viviam no dashboard antigo (CRMDashboardPage, apagado).
// Dados: crm_atividades_dashboard(p_from, p_to, p_dono). Portado do UNV Sales.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { Loader2, RefreshCw, Download, ListChecks, AlertTriangle, Clock, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { duracao } from "@/lib/exportXlsx";
import { toast } from "sonner";
import {
  C, SERIES, tipStyle, n, pct, diaCurto, moeda, dataHora,
  Kpi, Grafico, ExportarDialog, PeriodoFiltro, intervalo, useStaffOptions, type Periodo,
} from "./dashboardShared";

const TIPO: Record<string, string> = { call: "Ligação", meeting: "Reunião", email: "E-mail", whatsapp: "WhatsApp", proposal: "Proposta", followup: "Follow-up", follow_up: "Follow-up", note: "Nota", task: "Tarefa", visit: "Visita", other: "Outro" };

interface Props {
  /** Fora da gestão, o painel fica travado no próprio responsável. */
  lockedStaffId?: string | null;
}

export function AtividadesDashboardTab({ lockedStaffId }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>({ key: "30" });
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [dono, setDono] = useState<string>(lockedStaffId || "all");
  const [novaAtividadeLead, setNovaAtividadeLead] = useState<string | null>(null);
  const staff = useStaffOptions();

  const carregar = useCallback(async () => {
    if (periodo.key === "custom" && (!periodo.from || !periodo.to)) return;
    setCarregando(true);
    const { from, to } = intervalo(periodo);
    const { data, error } = await (supabase as any).rpc("crm_atividades_dashboard", {
      p_from: from.toISOString(), p_to: to.toISOString(), p_dono: dono === "all" ? null : dono,
    });
    if (error) toast.error("Erro ao carregar o painel: " + error.message);
    setDados(data || null);
    setCarregando(false);
  }, [periodo, dono]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = dados?.kpis || {};
  const { texto } = intervalo(periodo);
  const porDia = useMemo(() => (dados?.por_dia || []).map((d: any) => ({ dia: diaCurto(d.dia), concluidas: n(d.concluidas), agendadas: n(d.agendadas) })), [dados]);
  const porTipo = useMemo(() => (dados?.por_tipo || []).map((t: any) => ({ nome: TIPO[t.tipo] || t.tipo, total: n(t.total), concluidas: n(t.concluidas), abertas: n(t.abertas), atrasadas: n(t.atrasadas) })), [dados]);
  const porDono = useMemo(() => (dados?.por_dono || []).map((d: any) => ({ ...d, total: n(d.total), concluidas: n(d.concluidas), abertas: n(d.abertas), atrasadas: n(d.atrasadas), no_prazo: n(d.no_prazo), leads_tocados: n(d.leads_tocados) })), [dados]);
  const atrasadas: any[] = dados?.atrasadas || [];
  const leadsSem: any[] = dados?.leads_sem_atividade || [];
  const leadsAtr: any[] = dados?.leads_atrasados || [];

  const blocosExport = useMemo(() => [
    { chave: "kpis", rotulo: "Resumo", linhas: dados ? [{ Periodo: texto, Total: n(k.total), Concluidas: n(k.concluidas), Abertas: n(k.abertas), Atrasadas: n(k.atrasadas), "Concluidas no prazo": n(k.no_prazo), "Tempo medio ate concluir": duracao(k.conclusao_media_s), "Leads tocados": n(k.leads_tocados), "Leads sem atividade (base viva)": n(dados.leads_sem_atividade_total), "Leads atrasados (base viva)": n(dados.leads_atrasados_total) }] : [] },
    { chave: "por_dia", rotulo: "Dia a dia", linhas: (dados?.por_dia || []).map((d: any) => ({ Dia: d.dia, Concluidas: n(d.concluidas), Agendadas: n(d.agendadas) })) },
    { chave: "por_tipo", rotulo: "Por tipo", linhas: porTipo.map((t: any) => ({ Tipo: t.nome, Total: t.total, Concluidas: t.concluidas, Abertas: t.abertas, Atrasadas: t.atrasadas })) },
    { chave: "por_dono", rotulo: "Por responsavel", linhas: porDono.map((d: any) => ({ Responsavel: d.nome, Total: d.total, Concluidas: d.concluidas, Abertas: d.abertas, Atrasadas: d.atrasadas, "No prazo": d.no_prazo, "Leads tocados": d.leads_tocados, "Tempo medio ate concluir": duracao(d.conclusao_media_s) })) },
    { chave: "atrasadas", rotulo: "Atividades atrasadas", linhas: atrasadas.map((a: any) => ({ Atividade: a.titulo, Tipo: TIPO[a.tipo] || a.tipo, Lead: a.lead || "", Responsavel: a.dono || "", "Vencia em": new Date(a.quando).toLocaleString("pt-BR"), "Dias de atraso": n(a.dias_atraso) })) },
    { chave: "leads_sem", rotulo: "Leads sem atividade", linhas: leadsSem.map((l: any) => ({ Lead: l.nome, Empresa: l.empresa || "", Funil: l.funil, Etapa: l.etapa, Dono: l.dono || "", Valor: n(l.valor), "Dias desde a criacao": n(l.dias) })) },
    { chave: "leads_atr", rotulo: "Leads atrasados", linhas: leadsAtr.map((l: any) => ({ Lead: l.nome, Empresa: l.empresa || "", Funil: l.funil, Etapa: l.etapa, Dono: l.dono || "", Valor: n(l.valor), "Ultima atividade": l.last_activity_at ? new Date(l.last_activity_at).toLocaleString("pt-BR") : "", "Proxima atividade": l.next_activity_at ? new Date(l.next_activity_at).toLocaleString("pt-BR") : "", "Dias parado": n(l.dias) })) },
  ], [dados, k, texto, porTipo, porDono, atrasadas, leadsSem, leadsAtr]);

  const TabelaLeads = ({ itens, colunaTempo }: { itens: any[]; colunaTempo: string }) => (
    <div className="overflow-x-auto max-h-[380px]">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
          <th className="text-left font-medium py-1.5">Lead</th><th className="text-left font-medium">Funil / etapa</th><th className="text-left font-medium">Dono</th>
          <th className="text-right font-medium">Valor</th><th className="text-right font-medium">{colunaTempo}</th><th></th>
        </tr></thead>
        <tbody>
          {itens.map((l: any) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="py-1.5">
                <Link to={`/crm/leads/${l.id}`} className="hover:underline font-medium">{l.nome || "Lead"}</Link>
                {l.empresa && <span className="text-xs text-muted-foreground ml-1.5">{l.empresa}</span>}
              </td>
              <td className="text-xs">{l.funil} <span className="text-muted-foreground">/ {l.etapa}</span></td>
              <td className="text-xs">{l.dono || "-"}</td>
              <td className="text-right tabular-nums text-xs">{n(l.valor) ? moeda(l.valor) : "-"}</td>
              <td className="text-right tabular-nums" style={{ color: n(l.dias) > 14 ? C.vermelho : n(l.dias) > 7 ? C.amarelo : undefined }}>{n(l.dias)}d</td>
              <td className="text-right">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setNovaAtividadeLead(l.id)}><Plus className="h-3 w-3" /> Atividade</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center gap-2">
        <ListChecks className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Atividades</h2>
        <span className="text-xs text-muted-foreground">{texto}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          {!lockedStaffId && <div className="w-[190px]"><SearchableSelect value={dono} onChange={setDono} options={[{ value: "all", label: "Todos os responsáveis" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></div>}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={carregar} disabled={carregando}><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)} disabled={!dados}><Download className="h-3.5 w-3.5" /> Exportar</Button>
        </div>
      </div>
      <ExportarDialog open={exportOpen} onOpenChange={setExportOpen} blocos={blocosExport} nomeArquivo={`atividades-${periodo.key}`} />
      {novaAtividadeLead && (
        <AddActivityDialog open onOpenChange={(v) => { if (!v) setNovaAtividadeLead(null); }} leadId={novaAtividadeLead}
          onSuccess={() => { setNovaAtividadeLead(null); carregar(); }} />
      )}

      {carregando && !dados ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando o painel...</div>
      ) : (
        <>
          {!n(k.total) ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade no período.</CardContent></Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <Kpi label="Atividades" valor={n(k.total).toLocaleString("pt-BR")} sub={`${n(k.leads_tocados)} leads tocados`} cor={C.cinza} />
                <Kpi label="Concluídas" valor={n(k.concluidas).toLocaleString("pt-BR")} sub={pct(n(k.concluidas), n(k.total))} cor={C.verde} destaque />
                <Kpi label="No prazo" valor={n(k.no_prazo).toLocaleString("pt-BR")} sub={`${pct(n(k.no_prazo), n(k.concluidas))} das concluídas`} cor={C.azul} />
                <Kpi label="Em aberto" valor={n(k.abertas).toLocaleString("pt-BR")} cor={C.violeta} />
                <Kpi label="Atrasadas" valor={n(k.atrasadas).toLocaleString("pt-BR")} sub={`${pct(n(k.atrasadas), n(k.abertas))} das abertas`} cor={C.vermelho} destaque />
                <Kpi label="Tempo até concluir" valor={duracao(k.conclusao_media_s)} sub="da criação à conclusão" cor={C.amarelo} />
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Grafico titulo="Dia a dia" subtitulo="Concluídas e agendadas por dia" altura={260}>
                    <BarChart data={porDia} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                      <RTooltip contentStyle={tipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="agendadas" name="Agendadas" fill={C.azul} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="concluidas" name="Concluídas" fill={C.verde} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </Grafico>
                </div>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">Por tipo</p>
                    <p className="text-xs text-muted-foreground mb-2">O que o time mais faz</p>
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={porTipo} dataKey="total" nameKey="nome" innerRadius={45} outerRadius={78} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
                              {porTipo.map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                            </Pie>
                            <RTooltip contentStyle={tipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1">
                        {porTipo.slice(0, 8).map((t: any, i: number) => (
                          <div key={t.nome} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                            <span className="truncate flex-1">{t.nome}</span>
                            <span className="text-muted-foreground tabular-nums">{t.total}</span>
                            {t.atrasadas > 0 && <span className="tabular-nums text-[10px]" style={{ color: C.vermelho }}>{t.atrasadas} atras.</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-3">Produtividade por responsável</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground"><tr className="border-b">
                        <th className="text-left font-medium py-1.5">Responsável</th><th className="text-right font-medium">Atividades</th><th className="text-right font-medium">Concluídas</th>
                        <th className="text-right font-medium">No prazo</th><th className="text-right font-medium">Abertas</th><th className="text-right font-medium">Atrasadas</th>
                        <th className="text-right font-medium">Leads tocados</th><th className="text-right font-medium">Tempo até concluir</th>
                      </tr></thead>
                      <tbody>
                        {porDono.map((d: any) => (
                          <tr key={d.id || "none"} className="border-b last:border-0">
                            <td className="py-1.5">{d.nome}</td>
                            <td className="text-right tabular-nums">{d.total}</td>
                            <td className="text-right tabular-nums" style={{ color: C.verde }}>{d.concluidas} <span className="text-[10px] text-muted-foreground">{pct(d.concluidas, d.total)}</span></td>
                            <td className="text-right tabular-nums">{pct(d.no_prazo, d.concluidas)}</td>
                            <td className="text-right tabular-nums">{d.abertas}</td>
                            <td className="text-right tabular-nums" style={{ color: d.atrasadas ? C.vermelho : undefined }}>{d.atrasadas}</td>
                            <td className="text-right tabular-nums">{d.leads_tocados}</td>
                            <td className="text-right tabular-nums">{duracao(d.conclusao_media_s)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {atrasadas.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium flex items-center gap-1.5 mb-3"><AlertTriangle className="h-4 w-4 text-destructive" /> Atividades atrasadas ({atrasadas.length}{atrasadas.length === 100 ? "+" : ""})</p>
                    <div className="overflow-x-auto max-h-[420px]">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
                          <th className="text-left font-medium py-1.5">Atividade</th><th className="text-left font-medium">Tipo</th><th className="text-left font-medium">Lead</th>
                          <th className="text-left font-medium">Responsável</th><th className="text-left font-medium">Vencia em</th><th className="text-right font-medium">Atraso</th>
                        </tr></thead>
                        <tbody>
                          {atrasadas.map((a: any) => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-1.5 max-w-[360px] truncate">{a.titulo}</td>
                              <td><Badge variant="outline" className="text-[10px]">{TIPO[a.tipo] || a.tipo}</Badge></td>
                              <td className="text-xs">{a.lead_id ? <Link to={`/crm/leads/${a.lead_id}`} className="hover:underline">{a.lead || "Lead"}</Link> : <span className="text-muted-foreground">-</span>}</td>
                              <td className="text-xs">{a.dono || "-"}</td>
                              <td className="text-xs whitespace-nowrap">{dataHora(a.quando)}</td>
                              <td className="text-right tabular-nums" style={{ color: C.vermelho }}>{n(a.dias_atraso)}d</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Base viva: lead aberto, com dono, em funil ativo, criado nos últimos 120 dias */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-amber-500/20">
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5 mb-1"><Clock className="h-4 w-4 text-amber-500" /> Leads sem atividade
                  <Badge className="ml-auto bg-amber-500 hover:bg-amber-500 text-[10px]">{n(dados?.leads_sem_atividade_total).toLocaleString("pt-BR")}</Badge>
                </p>
                <p className="text-xs text-muted-foreground mb-3">Abertos, com dono, criados nos últimos 120 dias e nunca tocados. Os 50 de maior valor.</p>
                {leadsSem.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Todos os leads vivos têm atividade.</p> : <TabelaLeads itens={leadsSem} colunaTempo="Criado há" />}
              </CardContent>
            </Card>
            <Card className="border-rose-500/20">
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5 mb-1"><AlertTriangle className="h-4 w-4 text-rose-500" /> Leads atrasados
                  <Badge className="ml-auto bg-rose-500 hover:bg-rose-500 text-[10px]">{n(dados?.leads_atrasados_total).toLocaleString("pt-BR")}</Badge>
                </p>
                <p className="text-xs text-muted-foreground mb-3">Próxima atividade vencida, ou mais de 7 dias sem contato. Os 50 de maior valor.</p>
                {leadsAtr.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lead atrasado.</p> : <TabelaLeads itens={leadsAtr} colunaTempo="Parado há" />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

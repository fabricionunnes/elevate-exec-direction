// Dashboard de Atendimento (benchmark Datacrazy, 30/09/2026): quanto entrou, quem atendeu,
// quanto demorou. Tudo vem de crm_atendimento_dashboard(p_from, p_to, p_atendente, p_setor).
// WhatsApp (Evolution e API oficial) e Instagram juntos. Portado do UNV Sales.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { Loader2, RefreshCw, Download, MessageSquare, Clock, Users, Flame, ExternalLink } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { duracao } from "@/lib/exportXlsx";
import { toast } from "sonner";
import {
  C, SERIES, tipStyle, n, pct, diaCurto, DOW, dataHora,
  Kpi, Grafico, ExportarDialog, PeriodoFiltro, intervalo, useStaffOptions, RodapeEscopo, type Periodo,
} from "./dashboardShared";

interface Props {
  /** Fora da gestão, o painel fica travado no próprio atendente. */
  lockedStaffId?: string | null;
}

export function AtendimentoDashboardTab({ lockedStaffId }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>({ key: "30" });
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [atendente, setAtendente] = useState<string>(lockedStaffId || "all");
  const [setor, setSetor] = useState<string>("all");
  const [setores, setSetores] = useState<{ id: string; name: string }[]>([]);
  const [filtroPlataforma, setFiltroPlataforma] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const staff = useStaffOptions();

  useEffect(() => {
    supabase.from("crm_service_sectors").select("id, name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setSetores((data || []) as { id: string; name: string }[]));
  }, []);

  const carregar = useCallback(async () => {
    if (periodo.key === "custom" && (!periodo.from || !periodo.to)) return;
    setCarregando(true);
    const { from, to } = intervalo(periodo);
    const { data, error } = await (supabase as any).rpc("crm_atendimento_dashboard", {
      p_from: from.toISOString(), p_to: to.toISOString(),
      p_atendente: atendente === "all" ? null : atendente,
      p_setor: setor === "all" ? null : setor,
    });
    if (error) toast.error("Erro ao carregar o painel: " + error.message);
    setDados(data || null);
    setCarregando(false);
  }, [periodo, atendente, setor]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = dados?.kpis || {};
  const { texto } = intervalo(periodo);
  const lista: any[] = useMemo(() => (dados?.lista || []).filter((c: any) =>
    (filtroPlataforma === "all" || c.plataforma === filtroPlataforma) &&
    (filtroStatus === "all" || (filtroStatus === "aguardando" ? c.aguardando : filtroStatus === "sem_resposta" ? (c.recebeu && c.inicio_s == null) : filtroStatus === "closed" ? c.status === "closed" : true))
  ), [dados, filtroPlataforma, filtroStatus]);
  const porDia = useMemo(() => (dados?.por_dia || []).map((d: any) => ({ dia: diaCurto(d.dia), iniciadas: n(d.iniciadas), finalizadas: n(d.finalizadas), whatsapp: n(d.whatsapp), instagram: n(d.instagram), sem_resposta: n(d.sem_resposta) })), [dados]);
  const porAtendente = useMemo(() => (dados?.por_atendente || []).map((a: any) => ({ ...a, total: n(a.total), finalizadas: n(a.finalizadas), abertas: n(a.abertas), aguardando: n(a.aguardando), sem_resposta: n(a.sem_resposta) })), [dados]);
  const porSetor = useMemo(() => (dados?.por_setor || []).map((a: any) => ({ ...a, total: n(a.total), finalizadas: n(a.finalizadas) })), [dados]);
  const porCanal = useMemo(() => (dados?.por_canal || []).map((a: any) => ({ ...a, total: n(a.total) })), [dados]);
  const mapa = useMemo(() => {
    const m = new Map<string, number>();
    let max = 0;
    for (const x of dados?.mapa_calor || []) { const v = n(x.n); m.set(`${x.dow}-${x.hora}`, v); if (v > max) max = v; }
    return { m, max };
  }, [dados]);
  const temSetores = setores.length > 0;

  const blocosExport = useMemo(() => [
    { chave: "kpis", rotulo: "Resumo", linhas: dados ? [{
      Periodo: texto, Iniciadas: n(k.iniciadas), "Recebidas (cliente escreveu)": n(k.recebidas), Finalizadas: n(k.finalizadas), Abertas: n(k.abertas), "Aguardando resposta": n(k.aguardando),
      "Sem nenhuma resposta": n(k.sem_resposta), "1a resposta (media)": duracao(k.inicio_medio_s), "1a resposta (mediana)": duracao(k.inicio_mediana_s),
      "1a resposta humana (media)": duracao(k.resposta_media_s), "Respondidas em 5 min": n(k.respondidas_5min),
    }] : [] },
    { chave: "por_dia", rotulo: "Dia a dia", linhas: (dados?.por_dia || []).map((d: any) => ({ Dia: d.dia, Iniciadas: n(d.iniciadas), Finalizadas: n(d.finalizadas), WhatsApp: n(d.whatsapp), Instagram: n(d.instagram), "Sem resposta": n(d.sem_resposta) })) },
    { chave: "por_atendente", rotulo: "Por atendente", linhas: porAtendente.map((a: any) => ({ Atendente: a.nome, Conversas: a.total, Finalizadas: a.finalizadas, Abertas: a.abertas, "Aguardando resposta": a.aguardando, "Sem resposta": a.sem_resposta, "1a resposta (media)": duracao(a.resposta_media_s), "1a resposta humana (media)": duracao(a.humana_media_s) })) },
    { chave: "por_setor", rotulo: "Por setor", linhas: porSetor.map((a: any) => ({ Setor: a.nome, Conversas: a.total, Finalizadas: a.finalizadas, Abertas: n(a.abertas), "1a resposta (media)": duracao(a.resposta_media_s) })) },
    { chave: "por_canal", rotulo: "Por canal", linhas: porCanal.map((a: any) => ({ Canal: a.nome, Plataforma: a.plataforma, Conversas: a.total, Finalizadas: n(a.finalizadas), "Sem resposta": n(a.sem_resposta) })) },
    { chave: "mapa", rotulo: "Mapa de calor", linhas: (dados?.mapa_calor || []).map((x: any) => ({ "Dia da semana": DOW[n(x.dow)], Hora: `${String(x.hora).padStart(2, "0")}h`, "Mensagens recebidas": n(x.n) })) },
    { chave: "lista", rotulo: "Conversas", linhas: (dados?.lista || []).map((c: any) => ({ Contato: c.contato, Plataforma: c.plataforma, Canal: c.canal, Atendente: c.atendente || "", Setor: c.setor || "", Status: c.status === "closed" ? "Finalizada" : c.aguardando ? "Aguardando resposta" : "Em aberto", "Aberta em": new Date(c.created_at).toLocaleString("pt-BR"), "Ultima mensagem": c.last_message_at ? new Date(c.last_message_at).toLocaleString("pt-BR") : "", "Tempo ate a 1a resposta": c.recebeu ? (c.inicio_s == null ? "sem resposta" : duracao(c.inicio_s)) : "cliente nao escreveu", "Tempo ate a 1a resposta humana": duracao(c.resposta_s) })) },
  ], [dados, k, texto, porAtendente, porSetor, porCanal]);

  const opcoesStaff = [{ value: "all", label: "Todos os atendentes" }, ...staff.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Atendimento</h2>
        <span className="text-xs text-muted-foreground">{texto}, WhatsApp e Instagram</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} />
          {!lockedStaffId && dados?.escopo?.mostrando !== "proprio" && <div className="w-[190px]"><SearchableSelect value={atendente} onChange={setAtendente} options={opcoesStaff} /></div>}
          {temSetores && <div className="w-[170px]"><SearchableSelect value={setor} onChange={setSetor} options={[{ value: "all", label: "Todos os setores" }, ...setores.map((s) => ({ value: s.id, label: s.name }))]} /></div>}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={carregar} disabled={carregando}><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)} disabled={!dados}><Download className="h-3.5 w-3.5" /> Exportar</Button>
        </div>
      </div>
      <ExportarDialog open={exportOpen} onOpenChange={setExportOpen} blocos={blocosExport} nomeArquivo={`atendimento-${periodo.key}`} />

      {carregando && !dados ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando o painel...</div>
      ) : !n(k.iniciadas) ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma conversa iniciada no período.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Kpi label="Conversas iniciadas" valor={n(k.iniciadas).toLocaleString("pt-BR")} sub="inclui disparos" cor={C.azul} destaque />
            <Kpi label="Cliente escreveu" valor={n(k.recebidas).toLocaleString("pt-BR")} sub={`${pct(n(k.recebidas), n(k.iniciadas))} das iniciadas`} cor={C.azul} />
            <Kpi label="Finalizadas" valor={n(k.finalizadas).toLocaleString("pt-BR")} sub={pct(n(k.finalizadas), n(k.iniciadas))} cor={C.verde} />
            <Kpi label="Em aberto" valor={n(k.abertas).toLocaleString("pt-BR")} cor={C.violeta} />
            <Kpi label="Aguardando resposta" valor={n(k.aguardando).toLocaleString("pt-BR")} sub="cliente falou por último" cor={C.amarelo} destaque />
            <Kpi label="Sem nenhuma resposta" valor={n(k.sem_resposta).toLocaleString("pt-BR")} sub="cliente escreveu, ninguém respondeu" cor={C.vermelho} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="1ª resposta (média)" valor={duracao(k.inicio_medio_s)} sub={`mediana ${duracao(k.inicio_mediana_s)}, pessoa ou IA`} cor={C.azul} destaque />
            <Kpi label="1ª resposta humana (média)" valor={duracao(k.resposta_media_s)} sub="só mensagens de atendente" cor={C.verde} />
            <Kpi label="Respondidas em até 5 min" valor={n(k.respondidas_5min).toLocaleString("pt-BR")} sub={`${pct(n(k.respondidas_5min), n(k.recebidas))} das que o cliente escreveu`} cor={C.verde} />
            <Kpi label="Atendentes ativos" valor={String(porAtendente.filter((a: any) => a.id).length)} cor={C.violeta} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Grafico titulo="Dia a dia" subtitulo="Conversas iniciadas, finalizadas e sem resposta" altura={260}>
                <AreaChart data={porDia} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    {[["iniciadas", C.azul], ["finalizadas", C.verde], ["sem_resposta", C.vermelho]].map(([k2, cor]) => (
                      <linearGradient key={k2} id={`ga-${k2}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cor} stopOpacity={0.5} /><stop offset="100%" stopColor={cor} stopOpacity={0.04} /></linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                  <RTooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="iniciadas" name="Iniciadas" stroke={C.azul} strokeWidth={2} fill="url(#ga-iniciadas)" />
                  <Area type="monotone" dataKey="finalizadas" name="Finalizadas" stroke={C.verde} strokeWidth={2} fill="url(#ga-finalizadas)" />
                  <Area type="monotone" dataKey="sem_resposta" name="Sem resposta" stroke={C.vermelho} strokeWidth={2} fill="url(#ga-sem_resposta)" />
                </AreaChart>
              </Grafico>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5"><Flame className="h-4 w-4 text-orange-500" /> Mapa de calor</p>
                <p className="text-xs text-muted-foreground mb-2">Quando o cliente mais escreve (dia x hora, Brasília)</p>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, 1fr)" }}>
                  <div />
                  {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-[8px] text-muted-foreground text-center">{h % 3 === 0 ? h : ""}</div>)}
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <Fragment key={d}>
                      <div className="text-[10px] text-muted-foreground leading-[14px]">{DOW[d]}</div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const v = mapa.m.get(`${d}-${h}`) || 0;
                        const a = mapa.max ? v / mapa.max : 0;
                        return <div key={`${d}-${h}`} title={`${DOW[d]} ${h}h: ${v}`} className="h-[14px] rounded-[2px]" style={{ background: v ? `rgba(235, 104, 52, ${0.15 + a * 0.85})` : "hsl(var(--muted))" }} />;
                      })}
                    </Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={`grid gap-3 ${temSetores ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            <Grafico titulo="Por atendente" subtitulo="Conversas e quantas foram finalizadas">
              <BarChart data={porAtendente.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tipStyle} />
                <Bar dataKey="total" name="Conversas" fill={C.azul} radius={[0, 4, 4, 0]} barSize={12} fillOpacity={0.6} />
                <Bar dataKey="finalizadas" name="Finalizadas" fill={C.verde} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </Grafico>
            {temSetores && (
              <Grafico titulo="Por setor" subtitulo="Onde as conversas caem">
                <BarChart data={porSetor.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 30, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={tipStyle} />
                  <Bar dataKey="total" name="Conversas" fill={C.violeta} radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </Grafico>
            )}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Por canal</p>
                <p className="text-xs text-muted-foreground mb-2">Cada número ou conta conectada</p>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={porCanal} dataKey="total" nameKey="nome" innerRadius={40} outerRadius={70} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
                          {porCanal.map((_: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={tipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1">
                    {porCanal.slice(0, 8).map((c: any, i: number) => (
                      <div key={c.nome + c.plataforma} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                        <span className="truncate flex-1">{c.nome}</span>
                        <span className="text-muted-foreground tabular-nums">{c.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium flex items-center gap-1.5 mb-3"><Clock className="h-4 w-4" /> Tempo de resposta por atendente</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr className="border-b">
                    <th className="text-left font-medium py-1.5">Atendente</th><th className="text-right font-medium">Conversas</th><th className="text-right font-medium">Finalizadas</th>
                    <th className="text-right font-medium">Abertas</th><th className="text-right font-medium">Aguardando</th><th className="text-right font-medium">Sem resposta</th>
                    <th className="text-right font-medium">1ª resposta (média)</th><th className="text-right font-medium">1ª humana (média)</th>
                  </tr></thead>
                  <tbody>
                    {porAtendente.map((a: any) => (
                      <tr key={a.id || "none"} className="border-b last:border-0">
                        <td className="py-1.5">{a.nome}</td>
                        <td className="text-right tabular-nums">{a.total}</td>
                        <td className="text-right tabular-nums" style={{ color: C.verde }}>{a.finalizadas}</td>
                        <td className="text-right tabular-nums">{a.abertas}</td>
                        <td className="text-right tabular-nums" style={{ color: a.aguardando ? C.amarelo : undefined }}>{a.aguardando}</td>
                        <td className="text-right tabular-nums" style={{ color: a.sem_resposta ? C.vermelho : undefined }}>{a.sem_resposta}</td>
                        <td className="text-right tabular-nums">{duracao(a.resposta_media_s)}</td>
                        <td className="text-right tabular-nums">{duracao(a.humana_media_s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Users className="h-4 w-4" /> Conversas do período</p>
                <span className="text-xs text-muted-foreground">{lista.length} de {(dados?.lista || []).length} (as 300 mais recentes)</span>
                <div className="ml-auto flex gap-2">
                  <div className="w-[170px]"><SearchableSelect value={filtroStatus} onChange={setFiltroStatus} options={[{ value: "all", label: "Todos os status" }, { value: "aguardando", label: "Aguardando resposta" }, { value: "sem_resposta", label: "Sem nenhuma resposta" }, { value: "closed", label: "Finalizadas" }]} /></div>
                  <div className="w-[160px]"><SearchableSelect value={filtroPlataforma} onChange={setFiltroPlataforma} options={[{ value: "all", label: "Todas as plataformas" }, { value: "whatsapp", label: "WhatsApp" }, { value: "instagram", label: "Instagram" }]} /></div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground sticky top-0 bg-card"><tr className="border-b">
                    <th className="text-left font-medium py-1.5">Contato</th><th className="text-left font-medium">Canal</th><th className="text-left font-medium">Atendente</th>
                    {temSetores && <th className="text-left font-medium">Setor</th>}
                    <th className="text-left font-medium">Status</th><th className="text-left font-medium">Aberta em</th><th className="text-left font-medium">Última msg</th>
                    <th className="text-right font-medium">Espera até a 1ª resposta</th><th className="text-right font-medium">Humana</th><th></th>
                  </tr></thead>
                  <tbody>
                    {lista.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5">{c.lead_id ? <Link to={`/crm/leads/${c.lead_id}`} className="hover:underline">{c.contato || "Contato"}</Link> : (c.contato || "Contato")}</td>
                        <td className="text-xs text-muted-foreground">{c.canal}</td>
                        <td>{c.atendente || <span className="text-muted-foreground">-</span>}</td>
                        {temSetores && <td className="text-xs">{c.setor || "-"}</td>}
                        <td>{c.status === "closed" ? <Badge variant="secondary">Finalizada</Badge> : c.aguardando ? <Badge className="bg-amber-500 hover:bg-amber-500">Aguardando</Badge> : <Badge variant="outline">Em aberto</Badge>}</td>
                        <td className="text-xs whitespace-nowrap">{dataHora(c.created_at)}</td>
                        <td className="text-xs whitespace-nowrap">{dataHora(c.last_message_at)}</td>
                        <td className="text-right tabular-nums" style={{ color: !c.recebeu ? undefined : c.inicio_s == null ? C.vermelho : c.inicio_s > 3600 ? C.amarelo : undefined }}>
                          {!c.recebeu ? <span className="text-muted-foreground text-xs">cliente não escreveu</span> : c.inicio_s == null ? "sem resposta" : duracao(c.inicio_s)}
                        </td>
                        <td className="text-right tabular-nums text-xs">{c.recebeu ? duracao(c.resposta_s) : "-"}</td>
                        <td className="text-right">
                          <Link to={`/crm/inbox?conversation=${c.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap" title="Abrir no Atendimento">
                            <ExternalLink className="h-3 w-3" /> Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <RodapeEscopo escopo={dados?.escopo} />
        </>
      )}
    </div>
  );
}

// Percurso do contrato: o que um contrato precisa pra fechar (dias, reuniões, toques, mensagens...),
// fechou x perdeu, pontos de virada, onde o lead empaca, esforço, alertas pra agir e por vendedor.
// Tudo vem da RPC crm_percurso (migration 20261016160000). Reentradas e troca de funil só contam
// a partir de 16/10/2026 (os registros não existiam antes).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, RefreshCw, AlertTriangle, Route } from "lucide-react";

type Tipico = {
  contratos: number; dias_mediana: number | null; dias_media: number | null; etapas: number | null; reunioes: number | null;
  reunioes_ok: number | null; toques: number | null; ligacoes: number | null; msgs_env: number | null; msgs_rec: number | null;
  propostas: number | null; disparos: number | null; reentradas: number | null; funis: number | null;
  dias_ate_reuniao: number | null; dias_reuniao_contrato: number | null; sem_reuniao: number; com_disparo: number;
  com_reentrada: number; mais_de_um_funil: number;
};
type Comp = { ft: "won" | "lost"; n: number; dias: number; reunioes: number; toques: number; ligacoes: number; msgs_env: number; msgs_rec: number; propostas: number; disparos: number; reentradas: number; respondeu: number; com_reuniao: number };
type Virada = { marco: string; com: number; com_ganho: number; sem: number; sem_ganho: number };
type Etapa = { etapa: string; passagens: number | null; dias_medio: number | null; dias_mediana: number | null; parados_agora: number | null; dias_parado: number | null };
type Esforco = { toques_periodo: number; reunioes_periodo: number; contratos: number; receita: number | null };
type Alerta = { tipo: string; id: string; name: string; etapa: string; vendedor: string | null; dias: number; motivo: string };
type Vend = { vendedor: string | null; contratos: number; perdidos: number; dias_mediana: number | null; reunioes: number; toques: number; msgs_env: number; propostas: number };
type Dados = { tipico: Tipico | null; comparativo: Comp[]; viradas: Virada[]; etapas: Etapa[]; esforco: Esforco; alertas: Alerta[]; vendedores: Vend[] };

const PERIODOS = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "180d", label: "Últimos 180 dias" },
  { value: "365d", label: "Últimos 12 meses" },
];
const ALERTA_LABEL: Record<string, string> = {
  sem_reuniao: "Sem reunião além do típico",
  proposta_parada: "Proposta parada",
  respondeu_sem_retorno: "Respondeu e ficou parado",
};

const n1 = (v: number | string | null | undefined, d = 1) => v == null ? "-" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const n0 = (v: number | string | null | undefined) => n1(v, 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const brl = (v: number | null | undefined) => v == null ? "-" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Tile({ label, valor, sub, destaque }: { label: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/50" : ""}>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{valor}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function PercursoTab() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("180d");
  const [pipeline, setPipeline] = useState("none");
  const [staff, setStaff] = useState("none");
  const [pipelines, setPipelines] = useState<{ value: string; label: string }[]>([]);
  const [staffs, setStaffs] = useState<{ value: string; label: string }[]>([]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alertaTipo, setAlertaTipo] = useState("todos");

  useEffect(() => {
    (supabase as any).from("crm_pipelines").select("id, name").neq("is_active", false).order("name")
      .then(({ data }: any) => setPipelines((data || []).map((p: any) => ({ value: p.id, label: p.name }))));
    (supabase as any).from("onboarding_staff").select("id, name").eq("is_active", true).order("name")
      .then(({ data }: any) => setStaffs((data || []).map((s: any) => ({ value: s.id, label: s.name }))));
  }, []);

  const carregar = async () => {
    setCarregando(true); setErro(null);
    const dias = Number(periodo.replace("d", ""));
    const de = new Date(Date.now() - dias * 86400000).toISOString();
    const { data, error } = await (supabase as any).rpc("crm_percurso", {
      p_from: de, p_to: new Date(Date.now() + 60000).toISOString(),
      p_pipeline: pipeline === "none" ? null : pipeline, p_staff: staff === "none" ? null : staff,
    });
    if (error) setErro(error.message); else setDados(data as Dados);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, [periodo, pipeline, staff]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = dados?.tipico;
  const won = dados?.comparativo.find((c) => c.ft === "won");
  const lost = dados?.comparativo.find((c) => c.ft === "lost");
  const alertas = useMemo(() => (dados?.alertas || []).filter((a) => alertaTipo === "todos" || a.tipo === alertaTipo), [dados, alertaTipo]);
  // Paginação do "Pra agir agora" (Fabrício, 20/10/2026: "quero que apareça de 15 em 15")
  const POR_PAGINA = 15;
  const [paginaAlertas, setPaginaAlertas] = useState(0);
  useEffect(() => { setPaginaAlertas(0); }, [alertaTipo, dados]);
  const totalPaginas = Math.max(1, Math.ceil(alertas.length / POR_PAGINA));
  const alertasPagina = useMemo(() => alertas.slice(paginaAlertas * POR_PAGINA, paginaAlertas * POR_PAGINA + POR_PAGINA), [alertas, paginaAlertas]);
  const etapas = useMemo(() => (dados?.etapas || []).filter((e) => (e.passagens || 0) >= 3 || (e.parados_agora || 0) >= 3)
    .sort((a, b) => (Number(b.dias_mediana ?? b.dias_parado ?? 0)) - (Number(a.dias_mediana ?? a.dias_parado ?? 0))).slice(0, 14), [dados]);
  const maiorVirada = useMemo(() => {
    const vs = (dados?.viradas || []).filter((v) => v.com >= 5 && v.sem >= 5);
    return vs.sort((a, b) => (pct(b.com_ganho, b.com) - pct(b.sem_ganho, b.sem)) - (pct(a.com_ganho, a.com) - pct(a.sem_ganho, a.sem)))[0] || null;
  }, [dados]);

  const linhaComp = (label: string, f: (c: Comp) => string) => (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-2 text-muted-foreground">{label}</td>
      <td className="px-2 text-right font-semibold tabular-nums text-emerald-600">{won ? f(won) : "-"}</td>
      <td className="px-2 text-right tabular-nums text-red-600">{lost ? f(lost) : "-"}</td>
    </tr>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <div className="mb-1 text-xs text-muted-foreground">Período (fechamento)</div>
          <SearchableSelect value={periodo} onValueChange={setPeriodo} options={PERIODOS} placeholder="Período" />
        </div>
        <div className="w-56">
          <div className="mb-1 text-xs text-muted-foreground">Funil</div>
          <SearchableSelect value={pipeline} onValueChange={setPipeline} options={pipelines} allowNone noneLabel="Todos os funis" placeholder="Funil" emptyMessage="Nenhum funil" />
        </div>
        <div className="w-56">
          <div className="mb-1 text-xs text-muted-foreground">Vendedor</div>
          <SearchableSelect value={staff} onValueChange={setStaff} options={staffs} allowNone noneLabel="Todos" placeholder="Vendedor" emptyMessage="Ninguém com esse nome" />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Atualizar
        </Button>
      </div>

      {erro && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">Não consegui carregar: {erro}</div>}
      {carregando && !dados && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {dados && t && (
        <>
          {/* 1. O contrato típico */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><Route className="h-4 w-4 text-primary" />O contrato típico <span className="text-xs font-normal text-muted-foreground">mediana e média dos {n0(t.contratos)} contratos do período</span></h3>
            {t.contratos === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato fechado nesse filtro.</p> : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
                <Tile label="Dias até fechar" valor={`${n0(t.dias_mediana)} dias`} sub={`média ${n0(t.dias_media)}`} destaque />
                <Tile label="Reuniões" valor={n1(t.reunioes)} sub={`${n0(t.sem_reuniao)} de ${n0(t.contratos)} fecharam sem reunião`} />
                <Tile label="Toques" valor={n1(t.toques)} sub={`ligações, WhatsApp e follow-ups · ${n1(t.ligacoes)} ligações`} />
                <Tile label="Mensagens" valor={`${n0(t.msgs_env)} / ${n0(t.msgs_rec)}`} sub="enviadas / recebidas no WhatsApp" />
                <Tile label="Propostas" valor={n1(t.propostas)} sub={`etapas percorridas: ${n1(t.etapas)}`} />
                <Tile label="Até a 1ª reunião" valor={`${n0(t.dias_ate_reuniao)} dias`} sub={`da reunião ao contrato: ${n0(t.dias_reuniao_contrato)} dias`} />
                <Tile label="Disparos recebidos" valor={n1(t.disparos)} sub={`${n0(t.com_disparo)} contratos receberam algum`} />
                <Tile label="Vezes que entrou" valor={n1(t.reentradas != null ? 1 + Number(t.reentradas) : null)} sub={`${n0(t.com_reentrada)} entraram mais de uma vez · conta desde 16/10`} />
                <Tile label="Funis percorridos" valor={n1(t.funis)} sub={`${n0(t.mais_de_um_funil)} passaram por mais de um · conta desde 16/10`} />
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 2. Fechou x perdeu */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-1 font-semibold">Fechou x perdeu</h3>
                <p className="mb-2 text-xs text-muted-foreground">Média por lead. Onde o caminho de quem fecha se separa de quem se perde.</p>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-1 text-left">&nbsp;</th><th className="px-2 text-right">Fechou ({n0(won?.n || 0)})</th><th className="px-2 text-right">Perdeu ({n0(lost?.n || 0)})</th></tr></thead>
                  <tbody>
                    {linhaComp("Reuniões", (c) => n1(c.reunioes))}
                    {linhaComp("Teve ao menos 1 reunião", (c) => `${pct(c.com_reuniao, c.n)}%`)}
                    {linhaComp("Toques", (c) => n1(c.toques))}
                    {linhaComp("Ligações", (c) => n1(c.ligacoes))}
                    {linhaComp("Mensagens enviadas", (c) => n0(c.msgs_env))}
                    {linhaComp("Mensagens recebidas", (c) => n0(c.msgs_rec))}
                    {linhaComp("Respondeu no WhatsApp", (c) => `${pct(c.respondeu, c.n)}%`)}
                    {linhaComp("Propostas", (c) => n1(c.propostas, 2))}
                    {linhaComp("Disparos recebidos", (c) => n1(c.disparos))}
                    {linhaComp("Dias até o desfecho", (c) => n0(c.dias))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* 3. Pontos de virada */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-1 font-semibold">Pontos de virada</h3>
                <p className="mb-2 text-xs text-muted-foreground">De quem fechou ou perdeu no período: % que fechou com o marco e sem ele.</p>
                {maiorVirada && (
                  <div className="mb-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm">
                    O que mais muda o jogo: <b>{maiorVirada.marco}</b>. Com: {pct(maiorVirada.com_ganho, maiorVirada.com)}% fecham. Sem: {pct(maiorVirada.sem_ganho, maiorVirada.sem)}%.
                  </div>
                )}
                <div className="space-y-2">
                  {dados.viradas.map((v) => {
                    const a = pct(v.com_ganho, v.com), b = pct(v.sem_ganho, v.sem);
                    return (
                      <div key={v.marco}>
                        <div className="flex items-center justify-between text-sm"><span>{v.marco}</span>
                          <span className="tabular-nums text-xs"><b className="text-emerald-600">{a}%</b> com ({n0(v.com)}) · <b className="text-muted-foreground">{b}%</b> sem ({n0(v.sem)})</span></div>
                        <div className="flex gap-1">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${a}%` }} /></div>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-slate-400" style={{ width: `${b}%` }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 6. Alertas */}
          <Card className={dados.alertas.length ? "border-amber-500/50" : ""}>
            <CardContent className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Pra agir agora <span className="text-xs font-normal text-muted-foreground">leads abertos fora do percurso típico</span></h3>
                <div className="w-64">
                  <SearchableSelect value={alertaTipo} onValueChange={setAlertaTipo}
                    options={[{ value: "todos", label: `Todos (${dados.alertas.length})` }, ...Object.entries(ALERTA_LABEL).map(([v, l]) => ({ value: v, label: `${l} (${dados.alertas.filter((a) => a.tipo === v).length})` }))]} placeholder="Tipo" />
                </div>
              </div>
              {alertas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lead fora do percurso nesse filtro.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1.5 pr-2">Lead</th><th className="px-2">Etapa</th><th className="px-2">Vendedor</th><th className="px-2">Alerta</th></tr></thead>
                    <tbody>
                      {alertasPagina.map((a) => (
                        <tr key={`${a.tipo}-${a.id}`} className="border-b last:border-0">
                          <td className="py-1.5 pr-2"><button type="button" className="font-medium text-primary hover:underline" onClick={() => navigate(`/crm/leads/${a.id}`)}>{a.name || "(sem nome)"}</button></td>
                          <td className="px-2 text-xs">{a.etapa}</td>
                          <td className="px-2 text-xs">{a.vendedor || <span className="text-muted-foreground">sem dono</span>}</td>
                          <td className="px-2 text-xs"><Badge variant="outline" className="mr-1 text-[10px]">{ALERTA_LABEL[a.tipo] || a.tipo}</Badge>{a.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {alertas.length > POR_PAGINA && (
                    <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                      <span>{paginaAlertas * POR_PAGINA + 1}–{Math.min(alertas.length, (paginaAlertas + 1) * POR_PAGINA)} de {alertas.length}</span>
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={paginaAlertas === 0} onClick={() => setPaginaAlertas((p) => Math.max(0, p - 1))}>Anterior</Button>
                      <span>Pág. {paginaAlertas + 1}/{totalPaginas}</span>
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={paginaAlertas >= totalPaginas - 1} onClick={() => setPaginaAlertas((p) => Math.min(totalPaginas - 1, p + 1))}>Próximo</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 4. Onde empaca */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-1 font-semibold">Onde o lead empaca</h3>
                <p className="mb-2 text-xs text-muted-foreground">Dias que o lead fica em cada etapa (mediana das passagens no período) e quantos estão parados nela agora.</p>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Etapa</th><th className="px-2 text-right">Dias na etapa</th><th className="px-2 text-right">Passagens</th><th className="px-2 text-right">Parados agora</th></tr></thead>
                  <tbody>
                    {etapas.map((e) => (
                      <tr key={e.etapa} className="border-b last:border-0">
                        <td className="py-1.5">{e.etapa}</td>
                        <td className="px-2 text-right tabular-nums">{e.dias_mediana != null ? `${n0(e.dias_mediana)}` : "-"}</td>
                        <td className="px-2 text-right tabular-nums">{n0(e.passagens || 0)}</td>
                        <td className="px-2 text-right tabular-nums">{e.parados_agora ? `${n0(e.parados_agora)} · ${n0(e.dias_parado)} dias` : "-"}</td>
                      </tr>
                    ))}
                    {!etapas.length && <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">Sem passagens suficientes.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* 5. Esforço e 7. Por vendedor */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 font-semibold">Esforço por contrato</h3>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Tile label="Toques no período" valor={n0(dados.esforco.toques_periodo)} sub="em todos os leads" />
                    <Tile label="Toques por contrato" valor={dados.esforco.contratos ? n0(dados.esforco.toques_periodo / dados.esforco.contratos) : "-"} destaque />
                    <Tile label="Reuniões por contrato" valor={dados.esforco.contratos ? n1(dados.esforco.reunioes_periodo / dados.esforco.contratos) : "-"} sub={`${n0(dados.esforco.reunioes_periodo)} reuniões no período`} />
                    <Tile label="Receita por toque" valor={dados.esforco.toques_periodo ? brl((dados.esforco.receita || 0) / dados.esforco.toques_periodo) : "-"} sub={`receita ${brl(dados.esforco.receita)}`} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 font-semibold">Por vendedor</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Vendedor</th><th className="px-2 text-right">Contratos</th><th className="px-2 text-right">Conv.</th><th className="px-2 text-right">Dias</th><th className="px-2 text-right">Reuniões</th><th className="px-2 text-right">Toques</th><th className="px-2 text-right">Msgs</th></tr></thead>
                    <tbody>
                      {dados.vendedores.map((v) => (
                        <tr key={v.vendedor || "-"} className="border-b last:border-0">
                          <td className="py-1.5">{v.vendedor || "Sem dono"}</td>
                          <td className="px-2 text-right tabular-nums">{n0(v.contratos)}</td>
                          <td className="px-2 text-right tabular-nums">{pct(v.contratos, v.contratos + v.perdidos)}%</td>
                          <td className="px-2 text-right tabular-nums">{n0(v.dias_mediana)}</td>
                          <td className="px-2 text-right tabular-nums">{n1(v.reunioes)}</td>
                          <td className="px-2 text-right tabular-nums">{n1(v.toques)}</td>
                          <td className="px-2 text-right tabular-nums">{n0(v.msgs_env)}</td>
                        </tr>
                      ))}
                      {!dados.vendedores.length && <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">Nenhum contrato no período.</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Contrato = lead em etapa de ganho, pelo dia do fechamento. Toques = ligações, WhatsApp e follow-ups registrados como atividade. "Vezes que entrou" e "funis percorridos" só contam a partir de 16/10/2026.
          </p>
        </>
      )}
    </div>
  );
}

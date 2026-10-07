// Gestão à vista do dono: Painel de Controle › Ao vivo. Uma tela só, sem rolagem, feita pra
// ficar aberta numa TV ou em tela cheia. Pedido do Fabrício (07/10/2026): conversas, leads
// entrando, lead em call, no-show, agendamentos, resultado do dia/semana/mês, meta x realizado,
// financeiro do dia/semana/mês, metas do dia (comercial, financeiro, produto), gráficos (funil,
// vendas por dia, tendência e projeção), produtos, ranking, tudo em tempo real.
// Como atualiza: assina o realtime do banco nas tabelas que mexem nesses números e, a cada
// evento, recarrega a RPC painel_ao_vivo (com atraso de 1,2 s pra agrupar rajadas). Fora
// isso, pulso a cada 30 s e relógio a cada segundo. Só o master enxerga (a RPC recusa o resto).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import "@/components/painel-controle/painel.css";
import "@/components/painel-controle/aovivo.css";

type Per = { leads: number; agendadas: number; realizadas: number; no_show: number; vendas_n: number; vendas_v: number; recebido: number; pago: number };
type Dados = {
  gerado_em: string;
  periodos: { hoje: Per; semana: Per; mes: Per };
  meta_mes: number | null; du_total: number; du_passados: number;
  conversas: { msgs_in_hoje: number; msgs_out_hoje: number; conversas_ativas_hoje: number; aguardando: number; aguardando_24h: number };
  caixa: number; inadimplencia: { n: number; valor: number };
  em_call: { lead: string; agente: string | null; desde: string; status: string }[];
  agenda_hoje: { hora: string; lead: string; closer: string | null; etapa: string | null }[];
  ranking_closers: { nome: string; vendas: number; receita: number; meta: number | null; realizadas: number; no_show: number; vendas_hoje: number; pipeline_n: number; pipeline_v: number }[];
  ranking_sdr: { nome: string; agendadas: number; agendadas_hoje: number; agendadas_semana: number; realizadas: number; no_show: number; leads_mes: number }[];
  meta_dia?: {
    comercial: { meta_mes: number | null; vendido_mes: number; vendido_hoje: number; vendas_hoje: number; du_restantes: number; meta_dia: number | null };
    financeiro: { vencendo_hoje_n: number; vencendo_hoje_v: number; vencendo_hoje_pago_v: number; recebido_hoje: number; recebido_hoje_n: number; a_pagar_hoje_v: number; pago_hoje: number };
    produto: { tarefas_vencem_hoje: number; tarefas_vencem_hoje_feitas: number; tarefas_atrasadas: number; tarefas_feitas_hoje: number; reunioes_cs_hoje: number; reunioes_cs_feitas: number; checkup_pendentes: number; checkup_total: number };
  };
  serie_dias?: { dia: string; vendas: number; receita: number; leads: number }[];
  funil_mes?: { leads: number; contatados: number; agendadas: number; realizadas: number; vendas: number };
  tendencia?: { meses: { mes: string; receita: number; vendas: number; meta: number | null }[]; projecao_mes: number | null; leads_30d: number; leads_30d_ant: number; reunioes_30d: number; reunioes_30d_ant: number };
  feed: { ts: string; tipo: string; texto: string }[];
  feed_contagem?: { tarefas_concluidas: number; atividades_concluidas: number; reunioes_consultoria: number; mudancas_etapa: number };
  produto?: { checkup_pendentes: number; agentes_ativos: number; respostas_ia_hoje: number; respostas_ia_mes: number; custo_ia_hoje_usd: number; custo_ia_mes_usd: number; teto_dia_usd: number | null; ia_ok: boolean | null };
};
type Produto = { produto: string; clientes: number | null; mrr: number | null; receita: number | null; churn_n: number | null; margem_direta: number | null };

const TABELAS = ["crm_leads", "crm_whatsapp_messages", "crm_whatsapp_conversations", "crm_meeting_events", "crm_lead_history", "company_invoices", "financial_payables", "crm_calls", "crm_activities", "onboarding_tasks", "onboarding_meeting_notes"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const n = (v: number | null | undefined) => Number(v || 0);
const brl = (v: number | null | undefined, compact = true) => {
  const x = n(v);
  if (compact && Math.abs(x) >= 1000) return `R$ ${(x / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const varPct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

export default function PainelAoVivoPage() {
  const navigate = useNavigate();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [pulso, setPulso] = useState(false);
  const [cheia, setCheia] = useState(!!document.fullscreenElement);
  // Olhinho do financeiro: esconde os valores (TV na parede, visita na sala). Lembra a escolha no aparelho.
  const [finOculto, setFinOculto] = useState<boolean>(() => { try { return localStorage.getItem("pc_av_fin_oculto") === "1"; } catch { return false; } });
  const alternarFin = () => setFinOculto((v) => { try { localStorage.setItem("pc_av_fin_oculto", v ? "0" : "1"); } catch { /* sem storage */ } return !v; });
  const oculto = (txt: string) => (finOculto ? "•••••" : txt);
  const timer = useRef<number | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("painel_ao_vivo" as any);
    if (error) { setErro(error.message.includes("master") ? "Só o usuário master vê esta tela." : error.message); return; }
    setErro(null); setD(data as Dados);
    setPulso(true); window.setTimeout(() => setPulso(false), 600);
  }, []);
  // bloco de produtos é pesado: só na abertura e no pulso de 30 s
  const carregarProdutos = useCallback(async () => {
    const { data } = await supabase.rpc("painel_bloco" as any, { p_month: new Date().toISOString().slice(0, 7) + "-01", p_nome: "produtos" });
    const ps = (data as any)?.produtos as Produto[] | undefined;
    if (ps) setProdutos([...ps].sort((a, b) => n(b.mrr) - n(a.mrr)));
  }, []);
  // recarrega agrupando rajadas de eventos
  const agendar = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; carregar(); }, 1200);
  }, [carregar]);

  useEffect(() => {
    carregar(); carregarProdutos();
    const ch = supabase.channel("painel-ao-vivo");
    TABELAS.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, agendar));
    ch.subscribe();
    const pulsoId = window.setInterval(() => { carregar(); carregarProdutos(); }, 30000);
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    const fs = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => { supabase.removeChannel(ch); window.clearInterval(pulsoId); window.clearInterval(relogio); document.removeEventListener("fullscreenchange", fs); if (timer.current) window.clearTimeout(timer.current); };
  }, [carregar, agendar, carregarProdutos]);

  const telaCheia = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* navegador sem suporte */ }
  };
  const sair = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ok */ } navigate("/painel-de-controle"); };

  const h = d?.periodos.hoje, s = d?.periodos.semana, m = d?.periodos.mes;
  const meta = n(d?.meta_mes);
  const vendido = n(m?.vendas_v);
  const pMeta = meta > 0 ? Math.min(100, pct(vendido, meta)) : 0;
  const pTempo = d ? pct(d.du_passados, d.du_total) : 0;
  const ritmo = d && d.du_passados > 0 ? (vendido / d.du_passados) * d.du_total : 0;
  const md = d?.meta_dia;
  const funil = d?.funil_mes;
  const funilItens = funil ? [
    ["Leads", funil.leads], ["Contatados", funil.contatados], ["Agendadas", funil.agendadas], ["Realizadas", funil.realizadas], ["Vendas", funil.vendas],
  ] as [string, number][] : [];
  const funilMax = funilItens.length ? Math.max(...funilItens.map((x) => x[1]), 1) : 1;
  const serie = (d?.serie_dias || []).map((x) => ({ ...x, d: x.dia.slice(8, 10) }));
  const tend = (d?.tendencia?.meses || []).map((x) => ({ ...x, m: MESES[Number(x.mes.slice(5, 7)) - 1] }));
  const projecao = n(d?.tendencia?.projecao_mes);
  const vLeads = d?.tendencia ? varPct(d.tendencia.leads_30d, d.tendencia.leads_30d_ant) : null;
  const vReun = d?.tendencia ? varPct(d.tendencia.reunioes_30d, d.tendencia.reunioes_30d_ant) : null;

  return (
    <div className="pc av">
      <header className="av-top">
        <div className="av-brand"><span className="lg">UNV</span><span className="wm">NEXUS <small>GESTÃO À VISTA</small></span></div>
        <div className="av-clock">
          <b>{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b>
          <small>{agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</small>
        </div>
        <div className="av-meta">
          <div className="lbl">META DO MÊS · VENDAS</div>
          <div className="bar"><i style={{ width: `${pMeta}%` }} /><em style={{ left: `${pTempo}%` }} title="onde o mês está" /></div>
          <div className="nums"><b>{brl(vendido)}</b> de {brl(meta)} · <b className={pMeta >= pTempo ? "ok" : "bad"}>{pMeta}%</b> da meta com {pTempo}% do mês · no ritmo fecha em {brl(ritmo)}</div>
        </div>
        <div className="av-ctl">
          <span className={`av-live ${pulso ? "on" : ""}`}><i />{d ? `ao vivo · ${hora(d.gerado_em)}` : "conectando"}</span>
          <button type="button" className="back" onClick={telaCheia}>{cheia ? "Sair da tela cheia" : "Tela cheia"}</button>
          <button type="button" className="back" onClick={sair}>Fechar</button>
        </div>
      </header>

      {erro && <div className="av-err">{erro}</div>}

      {md && (
        <section className="av-metas">
          <MetaDia titulo="META DO DIA · COMERCIAL" cor="acc" p={md.comercial.meta_dia ? Math.min(100, pct(md.comercial.vendido_hoje, md.comercial.meta_dia)) : 0}
            big={brl(md.comercial.vendido_hoje)} de={md.comercial.meta_dia != null ? `de ${brl(md.comercial.meta_dia)} hoje` : "sem meta cadastrada"}
            sub={`${md.comercial.vendas_hoje} ${md.comercial.vendas_hoje === 1 ? "venda" : "vendas"} hoje · falta ${brl(Math.max(n(md.comercial.meta_mes) - md.comercial.vendido_mes, 0))} no mês em ${md.comercial.du_restantes} ${md.comercial.du_restantes === 1 ? "dia útil" : "dias úteis"}`} />
          <MetaDia titulo="META DO DIA · FINANCEIRO" cor="bar"
            p={md.financeiro.vencendo_hoje_v > 0 ? Math.min(100, pct(md.financeiro.vencendo_hoje_pago_v, md.financeiro.vencendo_hoje_v)) : md.financeiro.recebido_hoje > 0 ? 100 : 0}
            big={oculto(brl(md.financeiro.recebido_hoje))}
            de={finOculto ? "" : md.financeiro.vencendo_hoje_v > 0 ? `recebido · ${brl(md.financeiro.vencendo_hoje_v)} vencem hoje (${md.financeiro.vencendo_hoje_n})` : "recebido · nada vence hoje"}
            sub={finOculto ? "valores ocultos" : `${md.financeiro.recebido_hoje_n} ${md.financeiro.recebido_hoje_n === 1 ? "fatura paga" : "faturas pagas"} · a pagar hoje ${brl(md.financeiro.a_pagar_hoje_v)} · pago ${brl(md.financeiro.pago_hoje)}`} />
          <MetaDia titulo="META DO DIA · PRODUTO E ENTREGA" cor="good"
            p={md.produto.tarefas_vencem_hoje > 0 ? Math.min(100, pct(md.produto.tarefas_vencem_hoje_feitas, md.produto.tarefas_vencem_hoje)) : 100}
            big={`${md.produto.tarefas_vencem_hoje_feitas}/${md.produto.tarefas_vencem_hoje}`} de="tarefas do dia concluídas"
            sub={`${md.produto.tarefas_feitas_hoje} concluídas hoje · ${md.produto.reunioes_cs_feitas}/${md.produto.reunioes_cs_hoje} reuniões de consultoria · ${md.produto.tarefas_atrasadas} atrasadas · checkup ${md.produto.checkup_total - md.produto.checkup_pendentes}/${md.produto.checkup_total}`} />
        </section>
      )}

      <section className="av-grid av-grid-3">
        {/* linha 1 */}
        <div className="av-card">
          <div className="av-h">RESULTADO · DIA, SEMANA E MÊS</div>
          <table className="av-tab">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Leads novos" v={[h?.leads, s?.leads, m?.leads]} />
              <Linha l="Reuniões agendadas" v={[h?.agendadas, s?.agendadas, m?.agendadas]} />
              <Linha l="Reuniões realizadas" v={[h?.realizadas, s?.realizadas, m?.realizadas]} />
              <Linha l="No-show" v={[h?.no_show, s?.no_show, m?.no_show]} bad />
              <Linha l="Vendas" v={[h?.vendas_n, s?.vendas_n, m?.vendas_n]} forte />
              <Linha l="Receita vendida" v={[h?.vendas_v, s?.vendas_v, m?.vendas_v]} dinheiro forte />
            </tbody>
          </table>
        </div>
        <div className="av-card">
          <div className="av-h">CONVERSAS · HOJE</div>
          <div className="av-kpis">
            <Kpi l="Recebidas" v={d?.conversas.msgs_in_hoje} />
            <Kpi l="Enviadas" v={d?.conversas.msgs_out_hoje} />
            <Kpi l="Conversas ativas" v={d?.conversas.conversas_ativas_hoje} />
            <Kpi l="Aguardando resposta" v={d?.conversas.aguardando} tom={n(d?.conversas.aguardando) > 20 ? "bad" : "ok"} />
          </div>
          <div className="av-h" style={{ marginTop: 8 }}>AGORA</div>
          <div className="av-list">
            {d?.em_call.length ? d.em_call.map((c, i) => (
              <div className="av-row live" key={i}><span className="dotp" />Em call: <b>{c.lead}</b>{c.agente ? ` com ${c.agente}` : ""} <small>desde {hora(c.desde)}</small></div>
            )) : <div className="av-row mute">Ninguém em call agora</div>}
            {d?.agenda_hoje.length ? d.agenda_hoje.slice(0, 4).map((a, i) => (
              <div className="av-row" key={i}><b>{hora(a.hora)}</b> {a.lead}{a.closer ? ` · ${a.closer}` : ""} <small>{a.etapa}</small></div>
            )) : <div className="av-row mute">Sem reunião marcada pra hoje</div>}
          </div>
        </div>
        <div className={`av-card ${finOculto ? "av-oculto" : ""}`}>
          <div className="av-h av-h-fin">
            <span>FINANCEIRO · DIA, SEMANA E MÊS</span>
            <button type="button" className="av-olho" onClick={alternarFin} title={finOculto ? "Mostrar os valores" : "Ocultar os valores"} aria-label={finOculto ? "Mostrar os valores do financeiro" : "Ocultar os valores do financeiro"}>
              {finOculto ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <table className="av-tab">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Recebido" v={[h?.recebido, s?.recebido, m?.recebido]} dinheiro forte oculto={finOculto} />
              <Linha l="Pago" v={[h?.pago, s?.pago, m?.pago]} dinheiro oculto={finOculto} />
              <Linha l="Resultado (caixa)" v={[n(h?.recebido) - n(h?.pago), n(s?.recebido) - n(s?.pago), n(m?.recebido) - n(m?.pago)]} dinheiro sinal oculto={finOculto} />
            </tbody>
          </table>
          <div className="av-kpis" style={{ marginTop: 8 }}>
            <Kpi l="Saldo nos bancos" v={oculto(brl(d?.caixa))} tom={finOculto ? undefined : n(d?.caixa) >= 0 ? "ok" : "bad"} texto />
            <Kpi l={`Inadimplência · ${d?.inadimplencia.n ?? 0} faturas`} v={oculto(brl(d?.inadimplencia.valor))} tom={finOculto ? undefined : "bad"} texto />
          </div>
        </div>

        {/* linha 2: gráficos */}
        <div className="av-card">
          <div className="av-h">FUNIL DO MÊS</div>
          <div className="av-funil">
            {funilItens.map(([rot, val], i) => {
              const ant = i > 0 ? funilItens[i - 1][1] : 0;
              return (
                <div className="fl" key={rot}>
                  <span className="r">{rot}</span>
                  <div className="t"><i style={{ width: `${Math.max(4, (val / funilMax) * 100)}%` }} /></div>
                  <b>{val}</b>
                  <small>{i > 0 ? (ant > 0 ? `${pct(val, ant)}%` : "-") : ""}</small>
                </div>
              );
            })}
            {!funilItens.length && <div className="av-row mute">Carregando...</div>}
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">VENDAS POR DIA · MÊS <small className="av-h-sub">barra = receita · linha = leads</small></div>
          <div className="av-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#2C2C2C" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} labelFormatter={(l) => `dia ${l}`} formatter={(v: any, k: any) => [k === "receita" ? brl(Number(v), false) : v, k === "receita" ? "Receita" : k === "leads" ? "Leads" : "Vendas"]} />
                <Bar dataKey="receita" fill="#3F5F9E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">TENDÊNCIA · 6 MESES E PROJEÇÃO</div>
          <div className="av-chart av-chart-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#2C2C2C" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} formatter={(v: any, k: any) => [brl(Number(v), false), k === "receita" ? "Vendido" : "Meta"]} />
                <Line type="monotone" dataKey="meta" stroke="#8E8B84" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="receita" stroke="#CC1B1B" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="av-kpis av-kpis-3">
            <Kpi l="Projeção do mês" v={brl(projecao)} tom={projecao >= meta && meta > 0 ? "ok" : "bad"} texto />
            <Kpi l="Leads · 30 d vs 30 d antes" v={vLeads == null ? "-" : `${vLeads > 0 ? "+" : ""}${vLeads}%`} tom={vLeads == null ? undefined : vLeads >= 0 ? "ok" : "bad"} texto />
            <Kpi l="Reuniões · 30 d vs 30 d antes" v={vReun == null ? "-" : `${vReun > 0 ? "+" : ""}${vReun}%`} tom={vReun == null ? undefined : vReun >= 0 ? "ok" : "bad"} texto />
          </div>
        </div>

        {/* linha 3 */}
        <div className="av-card av-feed">
          <div className="av-h av-h-fin">
            <span>ACONTECENDO · ÚLTIMOS 15 DE HOJE</span>
            {d?.feed_contagem && (
              <span className="av-cont">
                <b>{d.feed_contagem.tarefas_concluidas}</b> tarefas · <b>{d.feed_contagem.reunioes_consultoria}</b> reuniões · <b>{d.feed_contagem.mudancas_etapa}</b> etapas · <b>{d.feed_contagem.atividades_concluidas}</b> atividades
              </span>
            )}
          </div>
          <div className="av-list av-list-feed">
            {d?.feed.slice(0, 15).map((f, i) => (
              <div className={`av-row ${f.tipo}`} key={i}><b>{hora(f.ts)}</b> {f.texto}</div>
            ))}
            {d && !d.feed.length && <div className="av-row mute">Nada ainda hoje</div>}
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">PRODUTOS · MÊS</div>
          <table className="av-tab av-tab-sm">
            <thead><tr><th></th><th>Clientes</th><th>MRR</th><th>Recebido</th><th>Churn</th></tr></thead>
            <tbody>
              {(produtos || []).filter((x) => n(x.clientes) > 0 || n(x.mrr) > 0 || n(x.receita) > 0).slice(0, 7).map((x, i) => (
                <tr key={i}>
                  <th>{x.produto}</th>
                  <td>{x.clientes ?? "-"}</td>
                  <td>{brl(x.mrr)}</td>
                  <td>{brl(x.receita)}</td>
                  <td className={n(x.churn_n) > 0 ? "bad" : ""}>{x.churn_n ?? 0}</td>
                </tr>
              ))}
              {produtos && !produtos.length && <tr><td colSpan={5} className="mute">Sem produto com movimento no mês</td></tr>}
            </tbody>
          </table>
          <div className="av-h" style={{ marginTop: 8 }}>NEXUS · SAÚDE DO PRODUTO</div>
          <div className="av-kpis av-kpis-4">
            <Kpi l="IA" v={d?.produto ? (d.produto.ia_ok === false ? "FORA" : "no ar") : "-"} tom={d?.produto?.ia_ok === false ? "bad" : "ok"} texto />
            <Kpi l="Agentes ativos" v={d?.produto?.agentes_ativos} />
            <Kpi l="Respostas da IA hoje" v={d?.produto?.respostas_ia_hoje} />
            <Kpi l={`Custo IA hoje · teto US$ ${d?.produto?.teto_dia_usd ?? "-"}`} v={`US$ ${n(d?.produto?.custo_ia_hoje_usd).toFixed(2)}`} tom={n(d?.produto?.custo_ia_hoje_usd) > n(d?.produto?.teto_dia_usd || 1e9) ? "bad" : undefined} texto />
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">CLOSERS · MÊS</div>
          <table className="av-tab av-tab-sm">
            <thead><tr><th></th><th>Vendas</th><th>Receita</th><th>Meta</th><th>Reuniões</th><th>No-show</th><th>Em aberto</th></tr></thead>
            <tbody>
              {d?.ranking_closers.map((r, i) => {
                const p = r.meta ? pct(r.receita, r.meta) : null;
                return (
                  <tr key={i}>
                    <th>{r.nome}</th>
                    <td>{r.vendas}{r.vendas_hoje > 0 && <small className="ok"> +{r.vendas_hoje} hoje</small>}</td>
                    <td>{brl(r.receita)}</td>
                    <td className={p == null ? "" : p >= pTempo ? "ok" : "bad"}>{p == null ? "-" : `${p}%`}</td>
                    <td>{r.realizadas}</td>
                    <td className={r.no_show > 0 ? "bad" : ""}>{r.no_show}</td>
                    <td>{r.pipeline_n} · {brl(r.pipeline_v)}</td>
                  </tr>
                );
              })}
              {d && !d.ranking_closers.length && <tr><td colSpan={7} className="mute">Nenhuma venda no mês</td></tr>}
            </tbody>
          </table>
          <div className="av-h" style={{ marginTop: 8 }}>PRÉ-VENDAS · MÊS</div>
          <table className="av-tab av-tab-sm">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th><th>Realizadas</th><th>No-show</th><th>Presença</th></tr></thead>
            <tbody>
              {d?.ranking_sdr.map((r, i) => {
                const pres = r.realizadas + r.no_show > 0 ? pct(r.realizadas, r.realizadas + r.no_show) : null;
                return (
                  <tr key={i}>
                    <th>{r.nome}</th>
                    <td>{r.agendadas_hoje}</td>
                    <td>{r.agendadas_semana}</td>
                    <td>{r.agendadas}</td>
                    <td>{r.realizadas}</td>
                    <td className={r.no_show > 0 ? "bad" : ""}>{r.no_show}</td>
                    <td className={pres == null ? "" : pres >= 60 ? "ok" : "bad"}>{pres == null ? "-" : `${pres}%`}</td>
                  </tr>
                );
              })}
              {d && !d.ranking_sdr.length && <tr><td colSpan={7} className="mute">Nenhum agendamento no mês</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetaDia({ titulo, cor, p, big, de, sub }: { titulo: string; cor: "acc" | "bar" | "good"; p: number; big: string; de: string; sub: string }) {
  return (
    <div className={`av-meta-dia ${cor}`}>
      <div className="av-h">{titulo}</div>
      <div className="big"><b>{big}</b><span>{de}</span></div>
      <div className="bar"><i style={{ width: `${p}%` }} /></div>
      <div className="sub">{p}% · {sub}</div>
    </div>
  );
}
function Linha({ l, v, dinheiro, forte, bad, sinal, oculto }: { l: string; v: (number | null | undefined)[]; dinheiro?: boolean; forte?: boolean; bad?: boolean; sinal?: boolean; oculto?: boolean }) {
  return (
    <tr className={forte ? "forte" : ""}>
      <th>{l}</th>
      {v.map((x, i) => {
        const val = n(x);
        if (oculto) return <td key={i} className="mask">•••••</td>;
        const cls = sinal ? (val < 0 ? "bad" : "ok") : bad && val > 0 ? "bad" : "";
        return <td key={i} className={cls}>{dinheiro ? brl(val) : val.toLocaleString("pt-BR")}</td>;
      })}
    </tr>
  );
}
function Kpi({ l, v, tom, texto }: { l: string; v: number | string | null | undefined; tom?: "ok" | "bad"; texto?: boolean }) {
  return <div className="av-kpi"><small>{l}</small><b className={tom || ""}>{texto ? v : n(v as number).toLocaleString("pt-BR")}</b></div>;
}

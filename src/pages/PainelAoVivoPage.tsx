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
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FunilMes } from "@/components/painel-controle/funil/FunilMes";
import { Detalhe } from "@/components/painel-controle/Detalhe";
import type { Filtro } from "@/components/painel-controle/tipos";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  ranking_closers: { staff_id: string | null; nome: string; vendas: number; receita: number; meta: number | null; realizadas: number; no_show: number; vendas_hoje: number; pipeline_n: number; pipeline_v: number }[];
  ranking_sdr: { staff_id: string | null; nome: string; agendadas: number; agendadas_hoje: number; agendadas_semana: number; realizadas: number; no_show: number; leads_mes: number }[];
  ranking_agentes?: { agent_id: string; nome: string; ativo: boolean; respostas_hoje: number; respostas_mes: number; conversas_mes: number; agendadas_hoje: number; agendadas_semana: number; agendadas_mes: number }[];
  meta_dia?: {
    comercial: { meta_mes: number | null; vendido_mes: number; vendido_hoje: number; vendas_hoje: number; du_restantes: number; meta_dia: number | null };
    financeiro: { vencendo_hoje_n: number; vencendo_hoje_v: number; vencendo_hoje_pago_v: number; a_receber_hoje_n?: number; a_receber_hoje_v?: number; recebido_hoje: number; recebido_hoje_n: number; a_pagar_hoje_v: number; pago_hoje: number };
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
  // Pop-up de detalhe: reaproveita a tela de detalhe do Painel (painel_controle_detalhe) num diálogo.
  // Cada card clicável chama abrir(bloco, filtro, título). "hoje"/"semana" viram filtro de/ate.
  type Pop = { bloco: string; filtro?: Filtro; titulo?: string; sub?: string; per?: "hoje" | "semana" | "mes"; base?: string; extra?: Filtro };
  const [pop, setPop] = useState<Pop[]>([]);
  const mesAtual = new Date().toISOString().slice(0, 7) + "-01";
  const ymd = (dt: Date) => new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const periodo = (k: "hoje" | "semana" | "mes"): Filtro => {
    const hj = new Date(); const de = new Date(hj);
    if (k === "semana") de.setDate(hj.getDate() - ((hj.getDay() + 6) % 7));
    return k === "mes" ? {} : { de: ymd(de), ate: ymd(hj) };
  };
  const rotPer = (k: "hoje" | "semana" | "mes") => (k === "hoje" ? "hoje" : k === "semana" ? "esta semana" : "no mês");
  const abrir = (bloco: string, filtro?: Filtro, titulo?: string, sub?: string) => setPop([{ bloco, filtro, titulo, sub }]);
  // abre com período alternável (Hoje / Semana / Mês no topo do pop-up): quando "hoje" vem vazio, um clique mostra o mês
  const abrirPer = (bloco: string, k: "hoje" | "semana" | "mes", base: string, extra: Filtro = {}, sub?: string) =>
    setPop([{ bloco, filtro: { ...periodo(k), ...extra }, titulo: `${base} ${rotPer(k)}`, sub, per: k, base, extra }]);
  const trocarPer = (k: "hoje" | "semana" | "mes") => setPop((pz) => {
    const a = pz[pz.length - 1]; if (!a?.base) return pz;
    return [...pz.slice(0, -1), { ...a, filtro: { ...periodo(k), ...(a.extra || {}) }, titulo: `${a.base} ${rotPer(k)}`, per: k }];
  });
  const empilhar = (bloco: string, filtro?: Filtro, titulo?: string, sub?: string) => setPop((pz) => [...pz, { bloco, filtro, titulo, sub }]);
  // feed paginado: cabe o que a altura do card permitir (TV grande mostra mais, notebook menos)
  const [pagFeed, setPagFeed] = useState(0);
  const feedCaixa = useRef<HTMLDivElement>(null);
  const [POR_PAG, setPorPag] = useState(10);
  useEffect(() => {
    const el = feedCaixa.current; if (!el) return;
    const medir = () => {
      const linha = el.querySelector<HTMLElement>(".av-row");
      const hLinha = (linha?.offsetHeight || 24) + 3; // + gap
      const hPager = 30;
      setPorPag(Math.max(4, Math.floor((el.clientHeight - hPager) / hLinha)));
    };
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, [d?.feed.length]);

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
        <div className="av-meta clk" onClick={() => abrirPer("vendas", "mes", "Vendas")} role="button" title="Ver as vendas do mês">
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
          <MetaDia onClick={() => abrirPer("vendas", "hoje", "Vendas")} titulo="META DO DIA · COMERCIAL" cor="acc" p={md.comercial.meta_dia ? Math.min(100, pct(md.comercial.vendido_hoje, md.comercial.meta_dia)) : 0}
            big={brl(md.comercial.vendido_hoje)} de={md.comercial.meta_dia != null ? `de ${brl(md.comercial.meta_dia)} hoje` : "sem meta cadastrada"}
            itens={[["Vendas hoje", String(md.comercial.vendas_hoje), () => abrirPer("vendas", "hoje", "Vendas")], ["Falta no mês", brl(Math.max(n(md.comercial.meta_mes) - md.comercial.vendido_mes, 0)), () => abrirPer("vendas", "mes", "Vendas")], ["Dias úteis", String(md.comercial.du_restantes)]]} />
          <MetaDia onClick={() => abrirPer("faturas_pagas", "hoje", "Recebido", {}, "Pagamentos de clientes confirmados no período (faturas pagas).")} titulo="META DO DIA · FINANCEIRO" cor="bar"
            p={md.financeiro.vencendo_hoje_v > 0 ? Math.min(100, pct(md.financeiro.vencendo_hoje_pago_v, md.financeiro.vencendo_hoje_v)) : md.financeiro.recebido_hoje > 0 ? 100 : 0}
            big={brl(md.financeiro.recebido_hoje)}
            de={`recebido hoje · ${md.financeiro.recebido_hoje_n} ${md.financeiro.recebido_hoje_n === 1 ? "fatura" : "faturas"}`}
            itens={[[`A receber hoje · ${md.financeiro.a_receber_hoje_n ?? 0}`, brl(md.financeiro.a_receber_hoje_v), () => abrirPer("faturas_a_receber", "hoje", "A receber com vencimento", {}, "Faturas de clientes em aberto cujo vencimento cai no período.")], ["A pagar hoje", brl(md.financeiro.a_pagar_hoje_v), () => abrirPer("contas_a_pagar", "hoje", "A pagar com vencimento", {}, "Contas em aberto cujo vencimento cai no período.")], ["Pago hoje", brl(md.financeiro.pago_hoje), () => abrirPer("contas_pagas", "hoje", "Pago", {}, "Contas a pagar quitadas no período.")]]} />
          <MetaDia onClick={() => abrir("tarefas_atrasadas", {}, "Tarefas atrasadas (entrega)")} titulo="META DO DIA · PRODUTO E ENTREGA" cor="good"
            p={md.produto.tarefas_vencem_hoje > 0 ? Math.min(100, pct(md.produto.tarefas_vencem_hoje_feitas, md.produto.tarefas_vencem_hoje)) : 100}
            big={`${md.produto.tarefas_vencem_hoje_feitas}/${md.produto.tarefas_vencem_hoje}`} de="tarefas do dia concluídas"
            itens={[["Reuniões", `${md.produto.reunioes_cs_feitas}/${md.produto.reunioes_cs_hoje}`], ["Atrasadas", String(md.produto.tarefas_atrasadas), () => abrir("tarefas_atrasadas", {}, "Tarefas atrasadas (entrega)")], ["Checkup", `${md.produto.checkup_total - md.produto.checkup_pendentes}/${md.produto.checkup_total}`, () => abrir("checkup", {}, "Checkup de hoje")]]} />
        </section>
      )}

      <section className="av-grid av-grid-4">
        {/* coluna 1 inteira: funil 3D */}
        <div className="av-card av-funil-card">
          <div className="av-h">FUNIL DO MÊS <small className="av-h-sub">arraste pra girar</small></div>
          <Funil3DCompacto itens={funilItens} onEtapa={(nome) => {
            if (nome === "Leads") abrir("leads", {}, "Leads do mês");
            else if (nome === "Contatados") abrir("leads", { contatado: true }, "Leads contatados no mês", "Leads criados no mês que receberam pelo menos uma mensagem nossa no WhatsApp.");
            else if (nome === "Agendadas") abrir("reunioes", { tipo: "scheduled" }, "Reuniões agendadas no mês");
            else if (nome === "Realizadas") abrir("reunioes", { tipo: "realizadas" }, "Reuniões realizadas no mês");
            else abrir("vendas", {}, "Vendas do mês");
          }} />
        </div>
        {/* linha 1 */}
        <div className="av-card">
          <div className="av-h">RESULTADO · DIA, SEMANA E MÊS</div>
          <table className="av-tab">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Leads novos" v={[h?.leads, s?.leads, m?.leads]} onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("leads", k, "Leads novos"); }} />
              <Linha l="Reuniões agendadas" v={[h?.agendadas, s?.agendadas, m?.agendadas]} onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("reunioes", k, "Reuniões agendadas", { tipo: "scheduled" }); }} />
              <Linha l="Reuniões realizadas" v={[h?.realizadas, s?.realizadas, m?.realizadas]} onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("reunioes", k, "Reuniões realizadas", { tipo: "realizadas" }); }} />
              <Linha l="No-show" v={[h?.no_show, s?.no_show, m?.no_show]} bad onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("reunioes", k, "No-show", { tipo: "no_show" }); }} />
              <Linha l="Vendas" v={[h?.vendas_n, s?.vendas_n, m?.vendas_n]} forte onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("vendas", k, "Vendas"); }} />
              <Linha l="Receita vendida" v={[h?.vendas_v, s?.vendas_v, m?.vendas_v]} dinheiro forte onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("vendas", k, "Vendas"); }} />
            </tbody>
          </table>
        </div>
        <div className="av-card">
          <div className="av-h">CONVERSAS · HOJE</div>
          <div className="av-kpis">
            <Kpi l="Recebidas" v={d?.conversas.msgs_in_hoje} onClick={() => abrirPer("conversas", "hoje", "Conversas com movimento")} />
            <Kpi l="Enviadas" v={d?.conversas.msgs_out_hoje} onClick={() => abrirPer("conversas", "hoje", "Conversas com movimento")} />
            <Kpi l="Conversas ativas" v={d?.conversas.conversas_ativas_hoje} onClick={() => abrirPer("conversas", "hoje", "Conversas ativas")} />
            <Kpi l="Aguardando resposta" v={d?.conversas.aguardando} tom={n(d?.conversas.aguardando) > 20 ? "bad" : "ok"} onClick={() => abrir("conversas_esperando", {}, "Conversas aguardando resposta")} />
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
              <Linha l="Recebido" v={[h?.recebido, s?.recebido, m?.recebido]} dinheiro forte oculto={finOculto} onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("faturas_pagas", k, "Recebido", {}, "Pagamentos de clientes confirmados no período (faturas pagas)."); }} />
              <Linha l="Pago" v={[h?.pago, s?.pago, m?.pago]} dinheiro oculto={finOculto} onClick={(i) => { const k = (["hoje", "semana", "mes"] as const)[i]; abrirPer("contas_pagas", k, "Pago", {}, "Contas a pagar quitadas no período."); }} />
              <Linha l="Resultado (caixa)" v={[n(h?.recebido) - n(h?.pago), n(s?.recebido) - n(s?.pago), n(m?.recebido) - n(m?.pago)]} dinheiro sinal oculto={finOculto} />
            </tbody>
          </table>
          <div className="av-kpis" style={{ marginTop: 8 }}>
            <Kpi l="Saldo nos bancos" v={oculto(brl(d?.caixa))} tom={finOculto ? undefined : n(d?.caixa) >= 0 ? "ok" : "bad"} texto onClick={() => abrir("bancos", {}, "Saldo por conta")} />
            <Kpi l={`Inadimplência · ${d?.inadimplencia.n ?? 0} faturas`} v={oculto(brl(d?.inadimplencia.valor))} tom={finOculto ? undefined : "bad"} texto onClick={() => abrir("faturas_vencidas", {}, "Faturas vencidas")} />
          </div>
        </div>

        {/* linha 2: gráficos */}
        <div className="av-card">
          <div className="av-h">VENDAS POR DIA · MÊS <small className="av-h-sub">barra = receita · linha = leads</small></div>
          <div className="av-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="avBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67E8F9" /><stop offset="100%" stopColor="#2563EB" /></linearGradient>
                  <filter id="avGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <YAxis yAxisId="l" orientation="right" hide />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} labelFormatter={(l) => `dia ${l}`} formatter={(v: any, k: any) => [k === "receita" ? brl(Number(v), false) : v, k === "receita" ? "Receita" : k === "leads" ? "Leads" : "Vendas"]} />
                <Bar yAxisId="r" dataKey="receita" fill="url(#avBar)" shape={<Barra3D />} />
                <Line yAxisId="l" type="monotone" dataKey="leads" stroke="#FB923C" strokeWidth={2.5} dot={{ r: 2.5, fill: "#FB923C", strokeWidth: 0 }} filter="url(#avGlow)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">TENDÊNCIA · 6 MESES E PROJEÇÃO</div>
          <div className="av-chart av-chart-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tend} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="avArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F472B6" stopOpacity={0.55} /><stop offset="100%" stopColor="#F472B6" stopOpacity={0.02} /></linearGradient>
                  <filter id="avGlow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} formatter={(v: any, k: any) => [brl(Number(v), false), k === "receita" ? "Vendido" : "Meta"]} />
                <Area type="monotone" dataKey="receita" stroke="none" fill="url(#avArea)" />
                <Line type="monotone" dataKey="meta" stroke="#FACC15" strokeDasharray="5 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="receita" stroke="#F472B6" strokeWidth={3} dot={{ r: 4, fill: "#F472B6", strokeWidth: 0 }} filter="url(#avGlow2)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="av-kpis av-kpis-3">
            <Kpi l="Projeção do mês" v={brl(projecao)} tom={projecao >= meta && meta > 0 ? "ok" : "bad"} texto onClick={() => abrir("vendas", {}, "Vendas do mês")} />
            <Kpi l="Leads · 30 d vs 30 d antes" v={vLeads == null ? "-" : `${vLeads > 0 ? "+" : ""}${vLeads}%`} tom={vLeads == null ? undefined : vLeads >= 0 ? "ok" : "bad"} texto onClick={() => abrir("leads", { de: ymd(new Date(Date.now() - 29 * 86400000)), ate: ymd(new Date()) }, "Leads dos últimos 30 dias")} />
            <Kpi l="Reuniões · 30 d vs 30 d antes" v={vReun == null ? "-" : `${vReun > 0 ? "+" : ""}${vReun}%`} tom={vReun == null ? undefined : vReun >= 0 ? "ok" : "bad"} texto onClick={() => abrir("reunioes", { de: ymd(new Date(Date.now() - 29 * 86400000)), ate: ymd(new Date()), tipo: "scheduled" }, "Reuniões agendadas nos últimos 30 dias")} />
          </div>
        </div>

        <div className="av-card av-produtos-card">
          <div className="av-h">PRODUTOS · MÊS</div>
          <div className="av-list">
            {(produtos || []).filter((x) => n(x.clientes) > 0 || n(x.mrr) > 0 || n(x.receita) > 0).slice(0, 6).map((x, i) => (
              <div className="av-pessoa clk" key={i} role="button" title="Ver registros" onClick={() => (n(x.clientes) > 0 ? abrir("produto_clientes", { produto: x.produto }, `Clientes · ${x.produto}`) : abrir("produto_receita", { produto: x.produto }, `Faturas pagas no mês · ${x.produto}`))}>
                <div className="l1"><b>{x.produto}</b><span className="v">{brl(x.mrr)}<small> MRR</small></span></div>
                <div className="l2">
                  <span>clientes <b>{x.clientes ?? "-"}</b></span>
                  <span>recebido <b>{brl(x.receita)}</b></span>
                  <span>churn <b className={n(x.churn_n) > 0 ? "bad" : ""}>{x.churn_n ?? 0}</b></span>
                </div>
              </div>
            ))}
            {produtos && !produtos.length && <div className="av-row mute">Sem produto com movimento no mês</div>}
          </div>
          <div className="av-h" style={{ marginTop: 8 }}>NEXUS · SAÚDE DO PRODUTO</div>
          <div className="av-kpis av-kpis-4">
            <Kpi l="IA" v={d?.produto ? (d.produto.ia_ok === false ? "FORA" : "no ar") : "-"} tom={d?.produto?.ia_ok === false ? "bad" : "ok"} texto />
            <Kpi l="Agentes ativos" v={d?.produto?.agentes_ativos} onClick={() => abrirPer("agente_runs", "mes", "Respostas da IA", { outcome: "sent" })} />
            <Kpi l="Respostas da IA hoje" v={d?.produto?.respostas_ia_hoje} onClick={() => abrirPer("agente_runs", "hoje", "Respostas da IA", { outcome: "sent" })} />
            <Kpi l={`Custo IA hoje · teto US$ ${d?.produto?.teto_dia_usd ?? "-"}`} v={`US$ ${n(d?.produto?.custo_ia_hoje_usd).toFixed(2)}`} tom={n(d?.produto?.custo_ia_hoje_usd) > n(d?.produto?.teto_dia_usd || 1e9) ? "bad" : undefined} texto />
          </div>
        </div>
        {/* linha 3 */}
        <div className="av-card av-feed">
          <div className="av-h av-h-fin">
            <span>ACONTECENDO · HOJE</span>
            {d?.feed_contagem && (
              <span className="av-cont">
                <b>{d.feed_contagem.tarefas_concluidas}</b> tarefas · <b>{d.feed_contagem.reunioes_consultoria}</b> reuniões · <b>{d.feed_contagem.mudancas_etapa}</b> etapas · <b>{d.feed_contagem.atividades_concluidas}</b> atividades
              </span>
            )}
          </div>
          <div className="av-list av-list-feed" ref={feedCaixa}>
            {(() => {
              const total = d?.feed.length ?? 0;
              const paginas = Math.max(1, Math.ceil(total / POR_PAG));
              const pg = Math.min(pagFeed, paginas - 1);
              return (
                <>
                  {d?.feed.slice(pg * POR_PAG, pg * POR_PAG + POR_PAG).map((f, i) => (
                    <div className={`av-row ${f.tipo}`} key={pg * POR_PAG + i}><b>{hora(f.ts)}</b> {f.texto}</div>
                  ))}
                  {d && !total && <div className="av-row mute">Nada ainda hoje</div>}
                  {total > POR_PAG && (
                    <div className="av-pag">
                      <button type="button" className="back" onClick={() => setPagFeed(Math.max(0, pg - 1))} disabled={pg === 0} aria-label="Mais recentes">‹</button>
                      <span>{pg * POR_PAG + 1}–{Math.min(total, pg * POR_PAG + POR_PAG)} de {total} · página {pg + 1} de {paginas}</span>
                      <button type="button" className="back" onClick={() => setPagFeed(Math.min(paginas - 1, pg + 1))} disabled={pg >= paginas - 1} aria-label="Mais antigos">›</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <div className="av-card av-closers-card">
          <div className="av-closers-grid">
          <div className="av-col">
          <div className="av-h">CLOSERS · MÊS</div>
          <div className="av-list">
            {d?.ranking_closers.map((r, i) => {
              const p = r.meta ? pct(r.receita, r.meta) : null;
              return (
                <div className="av-pessoa clk" key={i} role="button" title="Ver vendas" onClick={() => abrir("vendas", r.staff_id ? { closer_id: r.staff_id } : {}, `Vendas do mês · ${r.nome}`)}>
                  <div className="l1"><b>{r.nome}</b><span className="v">{brl(r.receita)}<small> · {r.vendas} {r.vendas === 1 ? "venda" : "vendas"}{r.vendas_hoje > 0 ? ` (+${r.vendas_hoje} hoje)` : ""}</small></span></div>
                  <div className="l2">
                    <span>meta <b className={p == null ? "" : p >= pTempo ? "ok" : "bad"}>{p == null ? "sem meta" : `${p}%`}</b></span>
                    <span>reuniões <b>{r.realizadas}</b></span>
                    <span>no-show <b className={r.no_show > 0 ? "bad" : ""}>{r.no_show}</b></span>
                    <span>em aberto <b>{r.pipeline_n}</b> · {brl(r.pipeline_v)}</span>
                  </div>
                </div>
              );
            })}
            {d && !d.ranking_closers.length && <div className="av-row mute">Nenhuma venda no mês</div>}
          </div>
          </div>
          <div className="av-col">
          <div className="av-h">PRÉ-VENDAS · MÊS</div>
          <div className="av-list">
            {d?.ranking_sdr.slice(0, 4).map((r, i) => {
              const pres = r.realizadas + r.no_show > 0 ? pct(r.realizadas, r.realizadas + r.no_show) : null;
              return (
                <div className="av-pessoa clk" key={i} role="button" title="Ver reuniões" onClick={() => abrir("reunioes", r.staff_id ? { sdr_id: r.staff_id } : {}, `Reuniões do mês · ${r.nome}`)}>
                  <div className="l1"><b>{r.nome}</b><span className="v">{r.agendadas} <small>{r.agendadas === 1 ? "agendada" : "agendadas"} no mês</small></span></div>
                  <div className="l2">
                    <span>hoje <b>{r.agendadas_hoje}</b></span>
                    <span>semana <b>{r.agendadas_semana}</b></span>
                    <span>realizadas <b>{r.realizadas}</b></span>
                    <span>no-show <b className={r.no_show > 0 ? "bad" : ""}>{r.no_show}</b></span>
                    <span>presença <b className={pres == null ? "" : pres >= 60 ? "ok" : "bad"}>{pres == null ? "-" : `${pres}%`}</b></span>
                  </div>
                </div>
              );
            })}
            {d && !d.ranking_sdr.length && <div className="av-row mute">Nenhum agendamento no mês</div>}
          </div>
          </div>
          <div className="av-col av-col-agentes">
          <div className="av-h">AGENTES DE IA · MÊS</div>
          <div className="av-list av-list-agentes">
            {(d?.ranking_agentes || []).slice(0, 5).map((r, i) => (
              <div className="av-pessoa ia clk" key={i} role="button" title="Ver execuções" onClick={() => abrir("agente_runs", { agent_id: r.agent_id, outcome: "sent" }, `Respostas do mês · ${r.nome}`)}>
                <div className="l1"><b>{r.nome}</b><span className="v">{r.agendadas_mes} <small>{r.agendadas_mes === 1 ? "reunião agendada" : "reuniões agendadas"} no mês</small></span></div>
                <div className="l2">
                  <span>hoje <b>{r.agendadas_hoje}</b></span>
                  <span>semana <b>{r.agendadas_semana}</b></span>
                  <span>respostas <b>{r.respostas_mes}</b> <small>({r.respostas_hoje} hoje)</small></span>
                  <span>conversas <b>{r.conversas_mes}</b></span>
                </div>
              </div>
            ))}
            {d && d.ranking_agentes && !d.ranking_agentes.length && <div className="av-row mute">Nenhum agente respondeu no mês</div>}
          </div>
          </div>
          </div>
        </div>
      </section>

      <Dialog open={pop.length > 0} onOpenChange={(o) => { if (!o) setPop([]); }}>
        <DialogContent className="av-pop-content">
          <div className="pc av-pop">
            {pop.length > 0 && (() => {
              const atual = pop[pop.length - 1];
              return (
                <>
                  <div className="av-pop-top">
                    {pop.length > 1 && <button type="button" className="back" onClick={() => setPop((pz) => pz.slice(0, -1))}>Voltar</button>}
                    <DialogTitle className="av-pop-titulo">{atual.titulo ?? atual.bloco}</DialogTitle>
                    {atual.per && (
                      <div className="av-pop-per">
                        {(["hoje", "semana", "mes"] as const).map((k) => (
                          <button type="button" key={k} className={`back ${atual.per === k ? "acc" : ""}`} onClick={() => trocarPer(k)}>{k === "hoje" ? "Hoje" : k === "semana" ? "Semana" : "Mês"}</button>
                        ))}
                      </div>
                    )}
                    <button type="button" className="back" onClick={() => setPop([])}>Fechar</button>
                  </div>
                  <div className="wrap av-pop-wrap">
                    <Detalhe key={`${atual.bloco}:${JSON.stringify(atual.filtro ?? {})}`} mes={mesAtual} bloco={atual.bloco} filtro={atual.filtro} titulo={atual.titulo} sub={atual.sub} det={empilhar} />
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Barra com cara de bloco: face da frente com o degradê, topo e lateral mais escuros (profundidade 7px).
function Barra3D(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const dp = Math.min(7, Math.max(3, width * 0.22));
  const w = Math.max(2, width - dp);
  return (
    <g>
      <polygon points={`${x},${y} ${x + dp},${y - dp} ${x + w + dp},${y - dp} ${x + w},${y}`} fill="#A5F3FC" opacity={0.95} />
      <polygon points={`${x + w},${y} ${x + w + dp},${y - dp} ${x + w + dp},${y + height - dp} ${x + w},${y + height}`} fill="#1E3A8A" opacity={0.95} />
      <rect x={x} y={y} width={w} height={height} fill={fill} rx={1} />
    </g>
  );
}
// O funil 3D do Painel (three.js) encaixado no card: mede a caixa e escala a cena pra caber sem rolagem.
function Funil3DCompacto({ itens, onEtapa }: { itens: [string, number][]; onEtapa?: (nome: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const medir = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const etapas = itens.map(([nome, v], i) => ({
    k: nome, nome, v, conv: i > 0 ? (itens[i - 1][1] > 0 ? `${pct(v, itens[i - 1][1])}% da anterior` : "-") : "no mês", onClick: () => onEtapa?.(nome),
  }));
  // o funil usa a altura inteira do card (a cena 3D se ajusta ao palco)
  const altura = Math.max(260, dim.h - 8);
  return (
    <div className="av-funil3d" ref={caixa}>
      {dim.w > 0 && <FunilMes etapas={etapas} selo="" onSelo={() => {}} altura={altura} fracao={0.64} />}
    </div>
  );
}
function MetaDia({ titulo, cor, p, big, de, itens, onClick }: { titulo: string; cor: "acc" | "bar" | "good"; p: number; big: string; de: string; itens: [string, string, (() => void)?][]; onClick?: () => void }) {
  return (
    <div className={`av-meta-dia ${cor}`}>
      <div className="cab"><span className="av-h">{titulo}</span><b className="pct">{p}%</b></div>
      <div className="corpo">
        <div className={`big ${onClick ? "clk" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}><b>{big}</b><span>{de}</span></div>
        <div className="mini">
          {itens.map(([l, v, fn]) => <div key={l} className={fn ? "clk" : ""} onClick={fn} role={fn ? "button" : undefined} title={fn ? "Ver registros" : undefined}><small>{l}</small><b>{v}</b></div>)}
        </div>
      </div>
      <div className="bar"><i style={{ width: `${Math.min(100, p)}%` }} /></div>
    </div>
  );
}
function Linha({ l, v, dinheiro, forte, bad, sinal, oculto, onClick }: { l: string; v: (number | null | undefined)[]; dinheiro?: boolean; forte?: boolean; bad?: boolean; sinal?: boolean; oculto?: boolean; onClick?: (col: number) => void }) {
  return (
    <tr className={forte ? "forte" : ""}>
      <th>{l}</th>
      {v.map((x, i) => {
        const val = n(x);
        if (oculto) return <td key={i} className="mask">•••••</td>;
        const cls = sinal ? (val < 0 ? "bad" : "ok") : bad && val > 0 ? "bad" : "";
        return <td key={i} className={`${cls} ${onClick ? "clk" : ""}`} onClick={onClick ? () => onClick(i) : undefined} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}>{dinheiro ? brl(val) : val.toLocaleString("pt-BR")}</td>;
      })}
    </tr>
  );
}
function Kpi({ l, v, tom, texto, onClick }: { l: string; v: number | string | null | undefined; tom?: "ok" | "bad"; texto?: boolean; onClick?: () => void }) {
  return <div className={`av-kpi ${onClick ? "clk" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} title={onClick ? "Ver registros" : undefined}><small>{l}</small><b className={tom || ""}>{texto ? v : n(v as number).toLocaleString("pt-BR")}</b></div>;
}

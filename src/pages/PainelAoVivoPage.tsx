// Gestão à vista do dono: Painel de Controle › Ao vivo. Uma tela só, sem rolagem, feita pra
// ficar aberta numa TV ou em tela cheia. Pedido do Fabrício (07/10/2026): conversas, leads
// entrando, lead em call, no-show, agendamentos, resultado do dia/semana/mês, meta x realizado,
// financeiro do dia/semana/mês, tudo em tempo real.
// Como atualiza: assina o realtime do banco nas tabelas que mexem nesses números e, a cada
// evento, recarrega a RPC painel_ao_vivo (com atraso de 1,2 s pra agrupar rajadas). Fora
// isso, pulso a cada 30 s e relógio a cada segundo. Só o master enxerga (a RPC recusa o resto).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ranking_closers: { nome: string; vendas: number; receita: number }[];
  ranking_sdr: { nome: string; agendamentos: number; realizadas: number }[];
  feed: { ts: string; tipo: string; texto: string }[];
};

const TABELAS = ["crm_leads", "crm_whatsapp_messages", "crm_whatsapp_conversations", "crm_meeting_events", "crm_lead_history", "company_invoices", "financial_payables", "crm_calls"];

const brl = (v: number | null | undefined, compact = true) => {
  const n = Number(v || 0);
  if (compact && Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function PainelAoVivoPage() {
  const navigate = useNavigate();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [pulso, setPulso] = useState(false);
  const [cheia, setCheia] = useState(!!document.fullscreenElement);
  const timer = useRef<number | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("painel_ao_vivo" as any);
    if (error) { setErro(error.message.includes("master") ? "Só o usuário master vê esta tela." : error.message); return; }
    setErro(null); setD(data as Dados);
    setPulso(true); window.setTimeout(() => setPulso(false), 600);
  }, []);

  // recarrega agrupando rajadas de eventos
  const agendar = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; carregar(); }, 1200);
  }, [carregar]);

  useEffect(() => {
    carregar();
    const ch = supabase.channel("painel-ao-vivo");
    TABELAS.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, agendar));
    ch.subscribe();
    const pulsoId = window.setInterval(carregar, 30000);
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    const fs = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => { supabase.removeChannel(ch); window.clearInterval(pulsoId); window.clearInterval(relogio); document.removeEventListener("fullscreenchange", fs); if (timer.current) window.clearTimeout(timer.current); };
  }, [carregar, agendar]);

  const telaCheia = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* navegador sem suporte */ }
  };
  const sair = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ok */ } navigate("/painel-de-controle"); };

  const h = d?.periodos.hoje, s = d?.periodos.semana, m = d?.periodos.mes;
  const meta = Number(d?.meta_mes || 0);
  const vendido = Number(m?.vendas_v || 0);
  const pMeta = meta > 0 ? Math.min(100, pct(vendido, meta)) : 0;
  const pTempo = d ? pct(d.du_passados, d.du_total) : 0;
  const ritmo = d && d.du_passados > 0 ? (vendido / d.du_passados) * d.du_total : 0;

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

      <section className="av-grid">
        {/* coluna 1: comercial dia/semana/mês */}
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

        {/* coluna 2: conversas + agora */}
        <div className="av-card">
          <div className="av-h">CONVERSAS · HOJE</div>
          <div className="av-kpis">
            <Kpi l="Recebidas" v={d?.conversas.msgs_in_hoje} />
            <Kpi l="Enviadas" v={d?.conversas.msgs_out_hoje} />
            <Kpi l="Conversas ativas" v={d?.conversas.conversas_ativas_hoje} />
            <Kpi l="Aguardando resposta" v={d?.conversas.aguardando} tom={Number(d?.conversas.aguardando || 0) > 20 ? "bad" : "ok"} />
          </div>
          <div className="av-h" style={{ marginTop: 10 }}>AGORA</div>
          <div className="av-list">
            {d?.em_call.length ? d.em_call.map((c, i) => (
              <div className="av-row live" key={i}><span className="dotp" />Em call: <b>{c.lead}</b>{c.agente ? ` com ${c.agente}` : ""} <small>desde {hora(c.desde)}</small></div>
            )) : <div className="av-row mute">Ninguém em call agora</div>}
            {d?.agenda_hoje.length ? d.agenda_hoje.map((a, i) => (
              <div className="av-row" key={i}><b>{hora(a.hora)}</b> {a.lead}{a.closer ? ` · ${a.closer}` : ""} <small>{a.etapa}</small></div>
            )) : <div className="av-row mute">Sem reunião marcada pra hoje</div>}
          </div>
        </div>

        {/* coluna 3: financeiro */}
        <div className="av-card">
          <div className="av-h">FINANCEIRO · DIA, SEMANA E MÊS</div>
          <table className="av-tab">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Recebido" v={[h?.recebido, s?.recebido, m?.recebido]} dinheiro forte />
              <Linha l="Pago" v={[h?.pago, s?.pago, m?.pago]} dinheiro />
              <Linha l="Resultado (caixa)" v={[n(h?.recebido) - n(h?.pago), n(s?.recebido) - n(s?.pago), n(m?.recebido) - n(m?.pago)]} dinheiro sinal />
            </tbody>
          </table>
          <div className="av-kpis" style={{ marginTop: 10 }}>
            <Kpi l="Saldo nos bancos" v={brl(d?.caixa)} tom={Number(d?.caixa || 0) >= 0 ? "ok" : "bad"} texto />
            <Kpi l={`Inadimplência · ${d?.inadimplencia.n ?? 0} faturas`} v={brl(d?.inadimplencia.valor)} tom="bad" texto />
          </div>
        </div>

        {/* linha 2: feed + ranking */}
        <div className="av-card av-feed">
          <div className="av-h">ACONTECENDO</div>
          <div className="av-list">
            {d?.feed.slice(0, 14).map((f, i) => (
              <div className={`av-row ${f.tipo}`} key={i}><b>{hora(f.ts)}</b> {f.texto}</div>
            ))}
            {d && !d.feed.length && <div className="av-row mute">Nada ainda hoje</div>}
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">CLOSERS · MÊS</div>
          <div className="av-list">
            {d?.ranking_closers.map((r, i) => <div className="av-row" key={i}><b>{r.nome}</b> <span className="r">{r.vendas} {r.vendas === 1 ? "venda" : "vendas"} · {brl(r.receita)}</span></div>)}
            {d && !d.ranking_closers.length && <div className="av-row mute">Nenhuma venda no mês</div>}
          </div>
          <div className="av-h" style={{ marginTop: 10 }}>PRÉ-VENDAS · MÊS</div>
          <div className="av-list">
            {d?.ranking_sdr.map((r, i) => <div className="av-row" key={i}><b>{r.nome}</b> <span className="r">{r.agendamentos} agendadas · {r.realizadas} realizadas</span></div>)}
            {d && !d.ranking_sdr.length && <div className="av-row mute">Nenhum agendamento no mês</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

const n = (v: number | null | undefined) => Number(v || 0);
function Linha({ l, v, dinheiro, forte, bad, sinal }: { l: string; v: (number | null | undefined)[]; dinheiro?: boolean; forte?: boolean; bad?: boolean; sinal?: boolean }) {
  return (
    <tr className={forte ? "forte" : ""}>
      <th>{l}</th>
      {v.map((x, i) => {
        const val = n(x);
        const cls = sinal ? (val < 0 ? "bad" : "ok") : bad && val > 0 ? "bad" : "";
        return <td key={i} className={cls}>{dinheiro ? brl(val) : val.toLocaleString("pt-BR")}</td>;
      })}
    </tr>
  );
}
function Kpi({ l, v, tom, texto }: { l: string; v: number | string | null | undefined; tom?: "ok" | "bad"; texto?: boolean }) {
  return <div className="av-kpi"><small>{l}</small><b className={tom || ""}>{texto ? v : n(v as number).toLocaleString("pt-BR")}</b></div>;
}

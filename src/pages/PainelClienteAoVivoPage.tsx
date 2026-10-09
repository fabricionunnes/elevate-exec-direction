// Gestão à vista do cliente: a mesma tela de TV do Painel de Controle do Nexus, com os dados
// do cliente. Link público, só leitura: /#/painel/<token>/ao-vivo. Atualiza quando o dado
// atualiza (recarrega a cada 5 minutos); o relógio anda a cada segundo.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Barra3D, Funil3DCompacto, Kpi, Linha, MetaDia } from "@/components/painel-controle/aovivo-ui";
import "@/components/painel-controle/painel.css";
import "@/components/painel-controle/aovivo.css";
import "@/components/painel-cliente/painel-cliente.css";
import { calcMes, comMeta, diasUteis, ehNova, isoMes, lerSoNovas, ym, ymd, type Bruto, type MesBruto } from "@/components/painel-cliente/modelo";
import { DetalheCliente, type CtxC } from "@/components/painel-cliente/telas";
import { MarcaCliente, useDadosCliente } from "./PainelClientePage";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const n = (v: number | null | undefined) => Number(v || 0);
const brl = (v: number | null | undefined, compact = true) => {
  const x = n(v);
  if (compact && Math.abs(x) >= 1000) return `R$ ${(x / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

type Per = { marcadas: number; realizadas: number; no_show: number; sem_desfecho: number; vendas_n: number; vendas_v: number; recebido: number };
type Call = { quando: string; sdr: string; closer: string; comp: "sim" | "nao" | "pend"; tipo: string };

/** tudo o que a TV mostra, calculado a partir dos dados crus do cliente */
function montar(b: Bruto, agora: Date, soNovas: boolean) {
  const hoje = ymd(agora);
  const seg = new Date(agora); seg.setDate(agora.getDate() - ((agora.getDay() + 6) % 7));
  const iniSemana = ymd(seg);
  const chaveAtual = hoje.slice(0, 7);
  const m: MesBruto = b.meses.find((x) => ym(isoMes(b, x)) === chaveAtual) ?? b.meses[b.meses.length - 1];
  const iso = isoMes(b, m), chave = ym(iso);
  const k = comMeta(calcMes(b, m), soNovas);
  const sis = b.sistema ?? {};
  // vendas que contam pra meta escolhida (sem renovações e ascensões quando a meta é só de novas)
  const vdMeta = soNovas && k.meta ? m.vd.filter(ehNova) : m.vd;
  // agenda com horário (sistema interno) quando existe pro mês; senão, as reuniões da planilha
  const agSis = sis.agenda?.linhas?.filter((l) => l[0].slice(0, 7) === chave) ?? [];
  const calls: Call[] = agSis.length
    ? agSis.map((l) => ({ quando: l[0], sdr: l[1] || "Não informado", closer: l[2], comp: (l[3] as Call["comp"]) || "pend", tipo: l[6] }))
    : m.ag.map((a) => ({ quando: `${a[7]}T00:00`, sdr: a[1] || "Não informado", closer: a[2], comp: a[3] === 1 ? "sim" : a[3] === 0 ? "nao" : "pend", tipo: "" }));
  const agoraIso = `${hoje}T${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const passadas = calls.filter((c) => c.quando <= agoraIso);
  const caixaDia = sis.caixa_dia ?? {};
  const per = (de: string, ate: string): Per => {
    const cs = passadas.filter((c) => c.quando.slice(0, 10) >= de && c.quando.slice(0, 10) <= ate);
    const vs = vdMeta.filter((v) => v[7] >= de && v[7] <= ate);
    const rec = Object.entries(caixaDia).filter(([d]) => d >= de && d <= ate).reduce((s, [, v]) => s + v, 0);
    return {
      marcadas: cs.length, realizadas: cs.filter((c) => c.comp === "sim").length, no_show: cs.filter((c) => c.comp === "nao").length, sem_desfecho: cs.filter((c) => c.comp === "pend").length,
      vendas_n: vs.length, vendas_v: vs.reduce((s, v) => s + v[0], 0), recebido: rec,
    };
  };
  const ini = `${chave}-01`;
  const mesP = per(ini, hoje);
  mesP.recebido = k.recebido ?? mesP.recebido;
  const du = diasUteis(iso, agora);
  const meta = k.meta?.total ?? null;
  const vendido = k.receita ?? 0;
  const hojeP = per(hoje, hoje);
  const restantesComHoje = du.util[agora.getDate() - 1] ? du.restantes + 1 : du.restantes;
  const metaDia = meta != null && restantesComHoje > 0 ? Math.max(meta - (vendido - hojeP.vendas_v), 0) / restantesComHoje : null;
  // séries
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const serie = Array.from({ length: Math.min(fim, agora.getDate()) }, (_, i) => {
    const d = `${chave}-${String(i + 1).padStart(2, "0")}`;
    return { d: String(i + 1).padStart(2, "0"), receita: vdMeta.filter((v) => v[7] === d).reduce((s, v) => s + v[0], 0), reunioes: passadas.filter((c) => c.quando.slice(0, 10) === d && c.comp === "sim").length };
  });
  const tend = b.meses.slice(-6).map((x) => { const c = comMeta(calcMes(b, x), soNovas); return { m: MESES[x.n - 1], receita: c.receita ?? 0, meta: c.meta?.total ?? null }; });
  const projecao = du.passados ? (vendido / du.passados) * du.total : null;
  // agenda: o que falta hoje e as próximas
  const proximas = calls.filter((c) => c.quando > agoraIso).sort((a, b2) => (a.quando < b2.quando ? -1 : 1));
  const deHoje = calls.filter((c) => c.quando.slice(0, 10) === hoje).sort((a, b2) => (a.quando < b2.quando ? -1 : 1));
  // rankings do mês
  const closers: Record<string, { nome: string; vendas: number; receita: number; calls: number; hoje: number }> = {};
  m.vd.forEach((v) => { const x = (closers[v[2] || "Não informado"] ??= { nome: v[2] || "Não informado", vendas: 0, receita: 0, calls: 0, hoje: 0 }); x.vendas++; x.receita += v[0]; if (v[7] === hoje) x.hoje++; });
  passadas.filter((c) => c.comp === "sim" && c.closer).forEach((c) => { (closers[c.closer] ??= { nome: c.closer, vendas: 0, receita: 0, calls: 0, hoje: 0 }).calls++; });
  const sdrs: Record<string, { nome: string; marcadas: number; hoje: number; semana: number; realizadas: number; no_show: number; pend: number }> = {};
  calls.forEach((c) => {
    const x = (sdrs[c.sdr] ??= { nome: c.sdr, marcadas: 0, hoje: 0, semana: 0, realizadas: 0, no_show: 0, pend: 0 });
    x.marcadas++;
    if (c.quando.slice(0, 10) === hoje) x.hoje++;
    if (c.quando.slice(0, 10) >= iniSemana && c.quando.slice(0, 10) <= hoje) x.semana++;
    if (c.quando <= agoraIso) { if (c.comp === "sim") x.realizadas++; else if (c.comp === "nao") x.no_show++; else x.pend++; }
  });
  // acontecendo: vendas e desfechos de reunião, mais recentes primeiro (sem nome de aluno)
  const feed = [
    ...m.vd.map((v) => ({ ts: `${v[7]}T23:59`, tipo: "venda", texto: `Venda de ${brl(v[0])} · closer ${v[2] || "não informado"}${v[5] && v[5] !== "Não informado" ? ` · ${v[5]}` : ""}` })),
    ...passadas.map((c) => ({ ts: c.quando, tipo: c.comp === "nao" ? "no_show" : "realized", texto: `Reunião de ${c.sdr}${c.closer ? ` com ${c.closer}` : ""}: ${c.comp === "sim" ? "compareceu" : c.comp === "nao" ? "no-show" : "sem desfecho"}` })),
  ].sort((a, b2) => (a.ts < b2.ts ? 1 : -1));
  return {
    m, iso, chave, k, hoje, iniSemana, horaDado: sis.agenda?.lido_em ?? null,
    periodos: { hoje: hojeP, semana: per(iniSemana, hoje), mes: mesP },
    meta, vendido, du, metaDia, soNovas: soNovas && !!k.meta, serie, tend, projecao, proximas, deHoje,
    funil: [["Marcadas", k.agendadas + k.sem_desfecho], ["Realizadas", k.realizadas], ["Vendas", k.vendas]] as [string, number][],
    closers: Object.values(closers).sort((a, b2) => b2.receita - a.receita || b2.calls - a.calls),
    sdrs: Object.values(sdrs).sort((a, b2) => b2.marcadas - a.marcadas),
    feed, produtos: Object.entries(k.caixa?.por ?? {}).sort((a, b2) => b2[1] - a[1]),
  };
}

export default function PainelClienteAoVivoPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { b, atualizado, erro } = useDadosCliente(token);
  const [agora, setAgora] = useState(new Date());
  const [cheia, setCheia] = useState(!!document.fullscreenElement);
  const [finOculto, setFinOculto] = useState<boolean>(() => { try { return localStorage.getItem("pcc_av_fin_oculto") === "1"; } catch { return false; } });
  const alternarFin = () => setFinOculto((v) => { try { localStorage.setItem("pcc_av_fin_oculto", v ? "0" : "1"); } catch { /* sem storage */ } return !v; });
  const oculto = (txt: string) => (finOculto ? "•••••" : txt);
  const [pop, setPop] = useState<{ bloco: string; filtro?: Record<string, string>; titulo: string } | null>(null);
  const [pagFeed, setPagFeed] = useState(0);

  useEffect(() => {
    document.title = "Gestão à vista · MD1";
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    const fs = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => { window.clearInterval(relogio); document.removeEventListener("fullscreenchange", fs); };
  }, []);
  // os números só mudam quando o dado muda: recalcula por minuto, não por segundo
  const minuto = Math.floor(agora.getTime() / 60000);
  const d = useMemo(() => (b ? montar(b, new Date(minuto * 60000), lerSoNovas()) : null), [b, minuto]); // eslint-disable-line react-hooks/exhaustive-deps

  const telaCheia = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* sem suporte */ } };
  const sair = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ok */ } navigate(`/painel/${token}`); };

  const h = d?.periodos.hoje, s = d?.periodos.semana, mm = d?.periodos.mes;
  const meta = n(d?.meta);
  const pMeta = meta > 0 ? Math.min(100, pct(n(d?.vendido), meta)) : 0;
  const pTempo = d ? pct(d.du.passados, d.du.total) : 0;
  const ctx: CtxC | null = b && d ? { b, m: d.m, mes: d.iso, setMes: () => {}, go: () => {}, det: () => {}, f: {}, setF: () => {} } : null;
  const POR_PAG = 9;
  const paginas = Math.max(1, Math.ceil((d?.feed.length ?? 0) / POR_PAG));
  const pg = Math.min(pagFeed, paginas - 1);
  const horaTxt = (q: string) => q.slice(11, 16);

  return (
    <div className="pc av">
      <header className="av-top">
        <div className="av-brand"><MarcaCliente onClick={sair} sub="GESTÃO À VISTA" /></div>
        <div className="av-clock">
          <b>{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b>
          <small>{agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</small>
        </div>
        <div className="av-meta clk" onClick={() => setPop({ bloco: "vendas", titulo: "Vendas do mês" })} role="button" title="Ver as vendas do mês">
          <div className="lbl">META DO MÊS · {d?.soNovas ? "SÓ VENDAS NOVAS" : "VENDAS"}</div>
          <div className="bar"><i style={{ width: `${pMeta}%` }} /><em style={{ left: `${pTempo}%` }} title="onde o mês está" /></div>
          <div className="nums">{meta > 0
            ? <><b>{brl(d?.vendido)}</b> de {brl(meta)} · <b className={pMeta >= pTempo ? "ok" : "bad"}>{pMeta}%</b> da meta com {pTempo}% do mês · no ritmo fecha em {brl(d?.projecao)}</>
            : <><b>{brl(d?.vendido)}</b> vendidos · sem meta cadastrada no mês</>}</div>
        </div>
        <div className="av-ctl">
          <span className="av-live"><i />{atualizado ? `dados de ${new Date(atualizado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "carregando"}</span>
          <button type="button" className="back" onClick={telaCheia}>{cheia ? "Sair da tela cheia" : "Tela cheia"}</button>
          <button type="button" className="back" onClick={sair}>Fechar</button>
        </div>
      </header>

      {erro && <div className="av-err">{erro}</div>}

      {d && (
        <section className="av-metas">
          <MetaDia onClick={() => setPop({ bloco: "vendas", titulo: "Vendas do mês" })} titulo="META DO DIA · VENDAS" cor="acc" p={d.metaDia ? Math.min(100, pct(n(h?.vendas_v), d.metaDia)) : 0}
            big={brl(h?.vendas_v)} de={d.metaDia != null ? `de ${brl(d.metaDia)} hoje` : "sem meta cadastrada"}
            itens={[["Vendas hoje", String(h?.vendas_n ?? 0)], ["Falta no mês", brl(Math.max(meta - n(d.vendido), 0))], ["Dias úteis", String(d.du.restantes)]]} />
          <MetaDia onClick={() => setPop({ bloco: "reunioes", titulo: "Reuniões do mês" })} titulo="META DO DIA · AGENDA" cor="good"
            p={d.deHoje.length ? Math.min(100, pct(n(h?.realizadas), d.deHoje.length)) : 0}
            big={`${h?.realizadas ?? 0}/${d.deHoje.length}`} de="reuniões de hoje realizadas"
            itens={[["No-show hoje", String(h?.no_show ?? 0)], ["Sem desfecho", String(h?.sem_desfecho ?? 0), () => setPop({ bloco: "reunioes", filtro: { tipo: "sem_desfecho" }, titulo: "Reuniões sem desfecho" })], ["Ainda hoje", String(d.deHoje.length - n(h?.marcadas))]]} />
          <MetaDia titulo="META DO DIA · CAIXA" cor="bar" p={mm?.recebido && meta ? Math.min(100, pct(mm.recebido, meta)) : 0}
            big={oculto(brl(h?.recebido))} de="recebido hoje"
            itens={[["Semana", oculto(brl(s?.recebido))], ["Mês", oculto(brl(mm?.recebido))]]} />
        </section>
      )}

      <section className="av-grid av-grid-4">
        <div className="av-card av-funil-card">
          <div className="av-h">FUNIL DO MÊS <small className="av-h-sub">arraste pra girar</small></div>
          {d && <Funil3DCompacto itens={d.funil} onEtapa={(nome) => {
            if (nome === "Realizadas") setPop({ bloco: "reunioes", filtro: { tipo: "realizadas" }, titulo: "Reuniões realizadas no mês" });
            else if (nome === "Vendas") setPop({ bloco: "vendas", titulo: "Vendas do mês" });
            else setPop({ bloco: "reunioes", titulo: "Reuniões do mês" });
          }} />}
        </div>
        <div className="av-card">
          <div className="av-h">RESULTADO · DIA, SEMANA E MÊS</div>
          <table className="av-tab av-tab-sm">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Realizadas" v={[h?.realizadas, s?.realizadas, mm?.realizadas]} onClick={() => setPop({ bloco: "reunioes", filtro: { tipo: "realizadas" }, titulo: "Reuniões realizadas" })} />
              <Linha l="No-show" v={[h?.no_show, s?.no_show, mm?.no_show]} bad onClick={() => setPop({ bloco: "reunioes", filtro: { tipo: "no_show" }, titulo: "No-show" })} />
              <Linha l="Sem desfecho" v={[h?.sem_desfecho, s?.sem_desfecho, mm?.sem_desfecho]} bad onClick={() => setPop({ bloco: "reunioes", filtro: { tipo: "sem_desfecho" }, titulo: "Reuniões sem desfecho" })} />
              <Linha l="Vendas" v={[h?.vendas_n, s?.vendas_n, mm?.vendas_n]} forte onClick={() => setPop({ bloco: "vendas", titulo: "Vendas" })} />
              <Linha l="Receita vendida" v={[h?.vendas_v, s?.vendas_v, mm?.vendas_v]} dinheiro forte onClick={() => setPop({ bloco: "vendas", titulo: "Vendas" })} />
            </tbody>
          </table>
        </div>
        <div className="av-card">
          <div className="av-h">AGENDA · HOJE E PRÓXIMAS</div>
          <div className="av-list">
            {d?.deHoje.length ? d.deHoje.map((c, i) => (
              <div className={`av-row ${c.comp === "pend" && c.quando > `${d.hoje}T${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}` ? "live" : c.comp === "nao" ? "no_show" : ""}`} key={`h${i}`}>
                <b>{horaTxt(c.quando)}</b> {c.sdr}{c.closer ? ` → ${c.closer}` : ""} <small>{c.comp === "sim" ? "compareceu" : c.comp === "nao" ? "no-show" : c.quando.slice(11, 16) <= agora.toTimeString().slice(0, 5) ? "sem desfecho" : "a fazer"}</small>
              </div>
            )) : <div className="av-row mute">Sem reunião marcada pra hoje</div>}
            <div className="av-h" style={{ marginTop: 8 }}>PRÓXIMAS</div>
            {d?.proximas.filter((c) => c.quando.slice(0, 10) > d.hoje).slice(0, 5).map((c, i) => (
              <div className="av-row" key={`p${i}`}><b>{c.quando.slice(8, 10)}/{c.quando.slice(5, 7)} {horaTxt(c.quando)}</b> {c.sdr}{c.closer ? ` → ${c.closer}` : ""} <small>{c.tipo}</small></div>
            ))}
            {d && !d.proximas.some((c) => c.quando.slice(0, 10) > d.hoje) && <div className="av-row mute">Nenhuma reunião marcada pros próximos dias</div>}
          </div>
        </div>
        <div className={`av-card ${finOculto ? "av-oculto" : ""}`}>
          <div className="av-h av-h-fin">
            <span>CAIXA · DIA, SEMANA E MÊS</span>
            <button type="button" className="av-olho" onClick={alternarFin} title={finOculto ? "Mostrar os valores" : "Ocultar os valores"} aria-label={finOculto ? "Mostrar os valores do caixa" : "Ocultar os valores do caixa"}>
              {finOculto ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <table className="av-tab av-tab-sm">
            <thead><tr><th></th><th>Hoje</th><th>Semana</th><th>Mês</th></tr></thead>
            <tbody>
              <Linha l="Recebido" v={[h?.recebido, s?.recebido, mm?.recebido]} dinheiro forte oculto={finOculto} />
              <Linha l="Vendido" v={[h?.vendas_v, s?.vendas_v, mm?.vendas_v]} dinheiro oculto={finOculto} />
            </tbody>
          </table>
          <div className="av-kpis" style={{ marginTop: 8 }}>
            <Kpi l="Reembolsos no mês" v={oculto(brl(d?.k.reembolso))} tom={finOculto ? undefined : n(d?.k.reembolso) > 0 ? "bad" : "ok"} texto />
            <Kpi l="Lucro do mês" v="sem fonte" texto />
          </div>
        </div>

        <div className="av-card">
          <div className="av-h">VENDAS POR DIA · MÊS <small className="av-h-sub">barra = receita · linha = reuniões realizadas</small></div>
          <div className="av-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d?.serie ?? []} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="avcBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67E8F9" /><stop offset="100%" stopColor="#2563EB" /></linearGradient>
                  <filter id="avcGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <YAxis yAxisId="l" orientation="right" hide allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} labelFormatter={(l) => `dia ${l}`} formatter={(v: any, k: any) => [k === "receita" ? brl(Number(v), false) : v, k === "receita" ? "Receita" : "Reuniões realizadas"]} />
                <Bar yAxisId="r" dataKey="receita" fill="url(#avcBar)" shape={<Barra3D />} />
                <Line yAxisId="l" type="monotone" dataKey="reunioes" stroke="#FB923C" strokeWidth={2.5} dot={{ r: 2.5, fill: "#FB923C", strokeWidth: 0 }} filter="url(#avcGlow)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="av-card">
          <div className="av-h">TENDÊNCIA · 6 MESES E PROJEÇÃO</div>
          <div className="av-chart av-chart-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d?.tend ?? []} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="avcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F472B6" stopOpacity={0.55} /><stop offset="100%" stopColor="#F472B6" stopOpacity={0.02} /></linearGradient>
                  <filter id="avcGlow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <CartesianGrid stroke="#262626" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} formatter={(v: any, k: any) => [v == null ? "-" : brl(Number(v), false), k === "receita" ? "Vendido" : "Meta"]} />
                <Area type="monotone" dataKey="receita" stroke="none" fill="url(#avcArea)" />
                <Line type="monotone" dataKey="meta" stroke="#FACC15" strokeDasharray="5 4" dot={{ r: 3, fill: "#FACC15", strokeWidth: 0 }} strokeWidth={2} />
                <Line type="monotone" dataKey="receita" stroke="#F472B6" strokeWidth={3} dot={{ r: 4, fill: "#F472B6", strokeWidth: 0 }} filter="url(#avcGlow2)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="av-kpis av-kpis-3">
            <Kpi l="Projeção do mês" v={brl(d?.projecao)} tom={n(d?.projecao) >= meta && meta > 0 ? "ok" : "bad"} texto />
            <Kpi l="Presença no mês" v={d && d.k.presenca != null ? `${Math.round(d.k.presenca * 100)}%` : "-"} tom={d && d.k.presenca != null && d.k.presenca >= 0.6 ? "ok" : "bad"} texto onClick={() => setPop({ bloco: "reunioes", filtro: { tipo: "no_show" }, titulo: "No-show do mês" })} />
            <Kpi l="Calls sem decisão" v={d?.k.pendentes} tom={n(d?.k.pendentes) > 0 ? "bad" : "ok"} onClick={() => setPop({ bloco: "reunioes", filtro: { tipo: "pendente" }, titulo: "Calls sem decisão" })} />
          </div>
        </div>
        <div className="av-card av-produtos-card">
          <div className="av-h">PRODUTOS · CAIXA DO MÊS</div>
          <div className="av-list">
            {(d?.produtos ?? []).slice(0, 7).map(([p, v], i) => (
              <div className="av-pessoa" key={i}>
                <div className="l1"><b>{p}</b><span className="v">{oculto(brl(v))}</span></div>
                <div className="l2"><span>do recebido <b>{d?.k.recebido ? `${Math.round((v / d.k.recebido) * 100)}%` : "-"}</b></span></div>
              </div>
            ))}
            {d && !d.produtos.length && <div className="av-row mute">Sem leitura do caixa neste mês</div>}
          </div>
        </div>

        <div className="av-card av-feed">
          <div className="av-h av-h-fin"><span>ACONTECENDO · MÊS</span><span className="av-cont"><b>{d?.k.vendas ?? 0}</b> vendas · <b>{d?.periodos.mes.realizadas ?? 0}</b> reuniões realizadas</span></div>
          <div className="av-list av-list-feed">
            {d?.feed.slice(pg * POR_PAG, pg * POR_PAG + POR_PAG).map((f, i) => (
              <div className={`av-row ${f.tipo}`} key={pg * POR_PAG + i}><b>{f.ts.slice(8, 10)}/{f.ts.slice(5, 7)}{f.tipo === "venda" ? "" : ` ${f.ts.slice(11, 16)}`}</b> {f.texto}</div>
            ))}
            {d && !d.feed.length && <div className="av-row mute">Nada ainda no mês</div>}
            {(d?.feed.length ?? 0) > POR_PAG && (
              <div className="av-pag">
                <button type="button" className="back" onClick={() => setPagFeed(Math.max(0, pg - 1))} disabled={pg === 0} aria-label="Mais recentes">‹</button>
                <span>página {pg + 1} de {paginas}</span>
                <button type="button" className="back" onClick={() => setPagFeed(Math.min(paginas - 1, pg + 1))} disabled={pg >= paginas - 1} aria-label="Mais antigos">›</button>
              </div>
            )}
          </div>
        </div>
        <div className="av-card av-closers-card">
          <div className="av-closers-grid">
            <div className="av-col">
              <div className="av-h">CLOSERS · MÊS</div>
              <div className="av-list">
                {d?.closers.map((r, i) => (
                  <div className="av-pessoa clk" key={i} role="button" title="Ver vendas" onClick={() => setPop({ bloco: "vendas", filtro: { closer: r.nome }, titulo: `Vendas do mês · ${r.nome}` })}>
                    <div className="l1"><b>{r.nome}</b><span className="v">{brl(r.receita)}<small> · {r.vendas} {r.vendas === 1 ? "venda" : "vendas"}{r.hoje > 0 ? ` (+${r.hoje} hoje)` : ""}</small></span></div>
                    <div className="l2">
                      <span>calls <b>{r.calls}</b></span>
                      <span>conversão <b>{r.calls ? `${pct(r.vendas, r.calls)}%` : "-"}</b></span>
                      <span>meta nível 1 <b className={r.receita >= 141000 ? "ok" : "bad"}>{pct(r.receita, 141000)}%</b></span>
                    </div>
                  </div>
                ))}
                {d && !d.closers.length && <div className="av-row mute">Nenhuma venda no mês</div>}
              </div>
            </div>
            <div className="av-col">
              <div className="av-h">PRÉ-VENDAS · MÊS</div>
              <div className="av-list">
                {d?.sdrs.slice(0, 4).map((r, i) => {
                  const pres = r.realizadas + r.no_show > 0 ? pct(r.realizadas, r.realizadas + r.no_show) : null;
                  return (
                    <div className="av-pessoa clk" key={i} role="button" title="Ver reuniões" onClick={() => setPop({ bloco: "reunioes", filtro: { sdr: r.nome }, titulo: `Reuniões do mês · ${r.nome}` })}>
                      <div className="l1"><b>{r.nome}</b><span className="v">{r.marcadas} <small>{r.marcadas === 1 ? "reunião" : "reuniões"} no mês</small></span></div>
                      <div className="l2">
                        <span>hoje <b>{r.hoje}</b></span>
                        <span>semana <b>{r.semana}</b></span>
                        <span>realizadas <b>{r.realizadas}</b></span>
                        <span>no-show <b className={r.no_show > 0 ? "bad" : ""}>{r.no_show}</b></span>
                        <span>presença <b className={pres == null ? "" : pres >= 60 ? "ok" : "bad"}>{pres == null ? "-" : `${pres}%`}</b></span>
                      </div>
                    </div>
                  );
                })}
                {d && !d.sdrs.length && <div className="av-row mute">Nenhum agendamento no mês</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={!!pop} onOpenChange={(o) => { if (!o) setPop(null); }}>
        <DialogContent className="av-pop-content">
          <div className="pc av-pop">
            {pop && ctx && (
              <>
                <div className="av-pop-top">
                  <DialogTitle className="av-pop-titulo">{pop.titulo}</DialogTitle>
                  <button type="button" className="back" onClick={() => setPop(null)}>Fechar</button>
                </div>
                <div className="wrap av-pop-wrap"><DetalheCliente c={ctx} bloco={pop.bloco} filtro={pop.filtro} /></div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

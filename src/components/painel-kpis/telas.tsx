// Telas do Painel de Controle de KPIs do cliente. Mesmas peças e mesmo tema do Painel de
// Controle do Nexus (ui.tsx, painel.css), com os blocos que existem numa operação que lança
// Faturamento e Vendas por vendedora: meta do mês, ritmo, ranking, unidade, time e dia a dia.
import type { ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Barras, BarrasItens, Combo, Lk, Nd, Panel, Rank, St, Tabela, Tile } from "@/components/painel-controle/ui";
import { brl, brlFull, dataHoraBR, fp, kfmt, mesLabel, num, pct, plural } from "@/components/painel-controle/fmt";
import type { MesSerie } from "@/components/painel-controle/tipos";
import {
  SEM, agrupar, alertas, calcMes, diasPessoa, linhasDia, primeiroNome, serieMeses, seriePessoa, serieRitmo,
  type Bruto, type Calc, type Filtro, type Pessoa,
} from "./modelo";

export type NavK = { view: string; id?: string; dia?: string; titulo?: string };
export type CtxK = {
  b: Bruto; mes: string; setMes: (iso: string) => void;
  f: Filtro; setF: (f: Filtro) => void;
  go: (n: NavK) => void;
  k: Calc;
};

const comoSerie = (s: { mes: string }[]) => s as unknown as MesSerie[];
const dd = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diaIso = (mes: string, d: number) => `${mes.slice(0, 8)}${String(d).padStart(2, "0")}`;
const varPct = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : (a - b) / b);
const Var = ({ v }: { v: number | null }) => (v == null ? <Nd /> : <span className={v >= 0 ? "pos" : "neg"}>{v >= 0 ? "+" : ""}{Math.round(v * 100)}%</span>);
const nomeUnidade = (b: Bruto, id: string | null) => (id ? b.unidades.find((u) => u.id === id)?.nome ?? "-" : "Sem unidade");
const nomeTime = (b: Bruto, id: string | null) => (id ? b.times.find((t) => t.id === id)?.nome ?? "-" : "Sem time");
/** "3D CURE" vira "3D Cure"; nome já escrito com caixa mista fica como está */
export const nomeEmpresa = (n: string) => (n && n === n.toUpperCase() ? n.split(/\s+/).map((w) => (/\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ") : n);
const nivel = (r: number | null) => (r == null ? "n" : r >= 1 ? "g" : r >= 0.85 ? "a" : "r");

/** filtros de unidade e time (o time é a lista do cadastro, opcionalmente presa à unidade) */
export function filtrosKpis(c: CtxK): ReactNode {
  const times = c.b.times.filter((t) => !c.f.unidade || !t.unidade || t.unidade === c.f.unidade)
    .filter((t) => c.b.pessoas.some((p) => p.time === t.id));
  return (
    <>
      {c.b.unidades.length > 1 && <Combo k="unidade" label="Unidade" value={c.f.unidade ?? ""} todos="Todas" opts={c.b.unidades.map((u) => ({ value: u.id, label: u.nome }))} onChange={(v) => c.setF({ ...c.f, unidade: v || undefined, time: undefined })} />}
      {times.length > 1 && <Combo k="time" label="Time" value={c.f.time ?? ""} todos="Todos" opts={times.map((t) => ({ value: t.id, label: t.nome }))} onChange={(v) => c.setF({ ...c.f, time: v || undefined })} />}
    </>
  );
}

/* ======================= visão geral ======================= */
export function VisaoKpis({ c }: { c: CtxK }) {
  const { b, k, mes } = c;
  const s = serieRitmo(k.metaF, k.dias.map((d) => d.fat), mes);
  const al = alertas(b, k);
  const serie = serieMeses(b, c.f);
  const ticketAnt = k.ant.vendas ? k.ant.fat / k.ant.vendas : null;
  const compara = k.emAndamento ? `no mesmo período de ${mesLabel(k.ant.iso).split(" ")[0].toLowerCase()} (até dia ${k.ant.corte})` : `em ${mesLabel(k.ant.iso).toLowerCase()}`;
  const unidades = agrupar(b, k, "unidade");
  const times = agrupar(b, k, "time");
  const maxDia = Math.max(...k.dias.map((d) => d.fat), 0);
  return (
    <>
      <div className="grid k5">
        <Tile main label={`Faturamento de ${mesLabel(mes).split(" ")[0].toLowerCase()}`} valor={brl(k.fat)}
          sub={k.metaF ? `${fp(k.pctF)} da meta de ${brl(k.metaF)} · ${plural(k.vendas, "venda", "vendas")}` : plural(k.vendas, "venda", "vendas")}
          onClick={() => c.go({ view: "meta" })} />
        <Tile label="Vendas" valor={num(k.vendas, 0)} sub={k.metaV ? `${fp(k.pctV)} da meta de ${num(k.metaV, 0)}` : "sem meta de vendas"} onClick={() => c.go({ view: "meta" })} />
        <Tile label="Ticket médio" valor={brl(k.ticket)} sub={<>{ticketAnt ? <><Var v={varPct(k.ticket, ticketAnt)} /> vs {brl(ticketAnt)} {compara}</> : "sem venda no mês anterior"}</>} onClick={() => c.go({ view: "time" })} />
        <Tile label={k.emAndamento ? "Projeção do mês" : "Atingimento"} valor={k.emAndamento ? brl(s?.projecao) : fp(k.pctF)}
          cls={k.emAndamento && s?.projecao != null && k.metaF && s.projecao < k.metaF ? "neg" : ""}
          sub={k.emAndamento ? (s?.projecao != null && k.metaF ? <><St ok={s.projecao >= k.metaF} warn={s.projecao >= 0.9 * k.metaF} tg="bate a meta" tw="perto da meta" tb="não bate a meta" /> {fp(pct(s.projecao, k.metaF))} no ritmo atual</> : "sem dia útil passado ainda") : `${brl(k.fat)} de ${brl(k.metaF)}`}
          onClick={() => c.go({ view: "meta" })} />
        <Tile label="vs mês anterior" valor={varPct(k.fat, k.ant.fat) == null ? "-" : `${(varPct(k.fat, k.ant.fat) ?? 0) >= 0 ? "+" : ""}${Math.round((varPct(k.fat, k.ant.fat) ?? 0) * 100)}%`}
          cls={(varPct(k.fat, k.ant.fat) ?? 0) < 0 ? "neg" : "pos"} sub={`${brl(k.ant.fat)} e ${plural(k.ant.vendas, "venda", "vendas")} ${compara}`} onClick={() => c.go({ view: "time" })} />
      </div>

      {s && <BlocoRitmo titulo="Meta do mês · realizado x meta acumulado" s={s} fmt={brl} onClick={() => c.go({ view: "meta" })} />}

      <div className="grid r2">
        <Panel titulo="Ranking do time" sub={k.metaF ? "% da meta de faturamento · clique na vendedora" : "faturamento do mês · clique na vendedora"}>
          {k.ranking.length === 0 && <div className="empty">Sem vendedora com meta ou venda neste recorte.</div>}
          {k.ranking.map((p, i) => (
            <Rank key={p.id} nome={`${i + 1}. ${primeiroNome(p.nome)}`} p={p.pctF ?? (k.fat ? p.fat / k.fat : 0)} bad={k.emAndamento ? (p.ritmo ?? 1) < 0.7 : (p.pctF ?? 1) < 0.7}
              det={<><b>{brl(p.fat)}</b>{p.metaF ? <> de {brl(p.metaF)} · <b>{fp(p.pctF)}</b></> : null} · <b>{p.vendas}</b> {p.vendas === 1 ? "venda" : "vendas"}{p.metaV ? ` de ${num(p.metaV, 0)}` : ""} · ticket {brl(p.ticket)}{k.emAndamento && p.ritmo != null ? <> · <St ok={p.ritmo >= 1} warn={p.ritmo >= 0.85} tg="no ritmo" tw="pouco abaixo" tb={`${Math.round(p.ritmo * 100)}% do ritmo`} /></> : null}</>}
              onClick={() => c.go({ view: "pessoa", id: p.id })} />
          ))}
          {k.paradas.length > 0 && <div className="note">Ativas no cadastro, sem meta e sem venda no mês: {k.paradas.map((p) => primeiroNome(p.nome)).join(", ")}.</div>}
          {k.foraRanking.length > 0 && <div className="note">Fora do ranking (revenda e outros): {k.foraRanking.map((p) => `${primeiroNome(p.nome)} ${brl(p.fat)}`).join(" · ")}. Somam no total.</div>}
        </Panel>
        <Panel cls="alertas" titulo="Exige atenção" sub={`${al.length} ${al.length === 1 ? "item" : "itens"}`}>
          <div className="alertas-lista">
            {al.length === 0 && <div className="empty">Nada fora do padrão neste mês.</div>}
            {al.map((a, i) => (
              <button type="button" key={i} className={`ai ${a.gravidade}`} onClick={() => c.go({ view: a.abre.view, id: a.abre.id })}>
                <div><b>{a.titulo}</b><em>{a.detalhe}</em></div>
                <span className="chip">Ver</span>
              </button>
            ))}
          </div>
          <div className="note">Ritmo = faturado contra o esperado pelos dias úteis que já passaram. Clique pra abrir.</div>
        </Panel>
      </div>

      <div className="grid g2">
        <Panel titulo="Faturamento dia a dia" sub={`${mesLabel(mes)} · clique num dia pra ver quem vendeu`}>
          <BarrasItens denso itens={k.dias.map((d) => ({ k: String(d.d), rot: String(d.d), v: d.d <= (k.du.corte || k.du.fim) ? d.fat : null, tip: `${String(d.d).padStart(2, "0")}/${mes.slice(5, 7)}: ${brl(d.fat)} · ${plural(d.vendas, "venda", "vendas")}` }))}
            fmt={kfmt} onItem={(x) => c.go({ view: "dia", dia: diaIso(mes, Number(x)) })} />
          <div className="note">Melhor dia: {maxDia ? (() => { const d = k.dias.find((x) => x.fat === maxDia)!; return `${String(d.d).padStart(2, "0")}/${mes.slice(5, 7)} com ${brl(d.fat)} e ${plural(d.vendas, "venda", "vendas")}`; })() : "sem venda ainda"}.</div>
        </Panel>
        <Panel titulo="Por unidade e por time" sub="clique pra filtrar o painel inteiro">
          <Tabela cols={[{ h: "Unidade", tl: true }, "Faturamento", "% meta", "Vendas", "Ticket"]}
            rows={unidades.map((u) => [<Lk onClick={() => u.id !== SEM && c.setF({ unidade: u.id })}>{u.nome}</Lk>, brl(u.fat), u.metaF ? fp(u.fat / u.metaF) : <Nd />, num(u.vendas, 0), brl(u.vendas ? u.fat / u.vendas : null)])} />
          <div style={{ height: 10 }} />
          <Tabela cols={[{ h: "Time", tl: true }, "Faturamento", "% meta", "Vendas", "Pessoas"]}
            rows={times.map((t) => [<Lk onClick={() => t.id !== SEM && c.setF({ ...c.f, time: t.id })}>{t.nome}</Lk>, brl(t.fat), t.metaF ? fp(t.fat / t.metaF) : <Nd />, num(t.vendas, 0), t.pessoas])} />
        </Panel>
      </div>

      <div className="grid r3">
        <Panel titulo="Faturamento · mês a mês" sub="clique num mês pra trocar o painel inteiro">
          <div className="fin">
            <Barras serie={comoSerie(serie)} mes={mes} fn={(x) => (x as unknown as { fat: number | null }).fat} fmt={kfmt}
              sub={(x) => { const m = x as unknown as { vendas: number | null; meta: number | null; fat: number | null }; return m.meta && m.fat != null ? fp(m.fat / m.meta) : m.vendas ? `${m.vendas} v.` : ""; }} onMes={c.setMes} />
            <Tabela cols={[{ h: "Mês", tl: true }, "Faturamento", "Meta", "%", "Vendas"]} hl={0}
              rows={[...serie].reverse().slice(0, 6).map((m) => [<Lk onClick={() => c.setMes(m.mes)}>{mesLabel(m.mes)}</Lk>, brl(m.fat), brl(m.meta), m.meta && m.fat != null ? fp(m.fat / m.meta) : <Nd />, num(m.vendas, 0)])} />
          </div>
        </Panel>
        <Panel titulo="Meta do mês" sub={k.metaF ? mesLabel(mes) : "sem meta cadastrada"} onClick={() => c.go({ view: "meta" })} more="Abrir ritmo da meta">
          {k.metaF && s ? (
            <Tabela cols={[{ h: "Linha", tl: true }, "Valor"]} rows={[
              ["Meta do time", brl(k.metaF)],
              ["Faturado", brl(s.vendido)],
              ["Esperado até hoje", k.emAndamento ? brl(s.esperado) : <Nd />],
              ["Ritmo", k.emAndamento ? <span className={s.dif >= 0 ? "pos" : "neg"}>{s.dif >= 0 ? "+" : ""}{brl(s.dif)}</span> : <Nd />],
              ["Falta", brl(s.falta)],
              ["Falta por dia útil", k.emAndamento ? brl(s.porDiaRestante) : <Nd />],
              ["Dias úteis", `${s.du.passados} de ${s.du.total}`],
            ]} />
          ) : <div className="empty">Sem meta cadastrada pra este mês.</div>}
        </Panel>
      </div>
      <div className="foot">Números lançados automaticamente pelo sistema da {nomeEmpresa(b.empresa)} no Nexus da UNV. Clique em qualquer número pra abrir o detalhe. <Lk onClick={() => c.go({ view: "fontes" })}>De onde vem cada número</Lk></div>
    </>
  );
}

/* ======================= bloco de ritmo (time ou vendedora) ======================= */
type Ritmo = NonNullable<ReturnType<typeof serieRitmo>>;
export function BlocoRitmo({ titulo, s, fmt, onClick, extra }: { titulo: string; s: Ritmo; fmt: (v: number | null) => string; onClick?: () => void; extra?: ReactNode }) {
  const emAndamento = s.du.corte > 0 && s.du.corte <= s.du.fim && s.du.restantes > 0;
  let acum = s.vendido;
  const dados = s.dias.map((x) => {
    if (s.ritmoDia != null && x.d > s.du.corte && x.util) acum += s.ritmoDia;
    const proj = emAndamento && s.ritmoDia != null && s.du.corte > 0 && x.d >= s.du.corte ? Math.round(acum) : null;
    return { d: String(x.d).padStart(2, "0"), meta: Math.round(x.meta), real: x.real == null ? null : Math.round(x.real), proj };
  });
  const nv = s.dif >= 0 ? "g" : s.dif >= -0.1 * s.meta ? "a" : "r";
  const pProj = pct(s.projecao, s.meta);
  return (
    <div className="p">
      <div className="h"><b>{titulo}</b>{extra}</div>
      <div className="meta-g">
        <div className="kg mk">
          <Tile label="Meta" valor={fmt(s.meta)} sub={`${s.du.total} dias úteis no mês`} onClick={onClick} />
          <Tile label="Realizado" valor={fmt(s.vendido)} sub={`${fp(s.pctMeta)} da meta`} onClick={onClick} />
          <Tile label="Esperado até hoje" valor={emAndamento ? fmt(s.esperado) : "-"} sub={emAndamento ? <St ok={nv === "g"} warn={nv === "a"} tg="no ritmo" tw="pouco abaixo" tb="abaixo do ritmo" /> : "mês fechado"} onClick={onClick} />
          <Tile label="Falta por dia útil" valor={emAndamento ? fmt(s.porDiaRestante) : "-"} sub={emAndamento ? `${fmt(s.falta)} em ${s.du.restantes} dias úteis` : s.falta ? `ficou faltando ${fmt(s.falta)}` : "meta batida"} onClick={onClick} />
          <Tile label="Projeção do mês" valor={emAndamento ? fmt(s.projecao) : fmt(s.vendido)} cls={pProj != null && pProj < 1 ? "neg" : ""}
            sub={s.projecao == null ? "sem dia útil passado ainda" : <><St ok={(pProj ?? 0) >= 1} warn={(pProj ?? 0) >= 0.9} tg="bate a meta" tw="perto da meta" tb="não bate a meta" /> {fp(pProj)} da meta</>} onClick={onClick} />
          <Tile label="Ritmo por dia útil" valor={fmt(s.ritmoDia)} cls={emAndamento && s.ritmoDia != null && s.porDiaRestante != null && s.ritmoDia < s.porDiaRestante ? "neg" : ""}
            sub={emAndamento && s.porDiaRestante != null ? `precisa de ${fmt(s.porDiaRestante)} daqui pra frente` : undefined} onClick={onClick} />
        </div>
        <div style={{ minHeight: 230 }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dados} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <defs><linearGradient id="pkMetaArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3F5F9E" stopOpacity={0.55} /><stop offset="100%" stopColor="#3F5F9E" stopOpacity={0.04} /></linearGradient></defs>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (fmt === brl ? kfmt(v) : String(v))} />
              <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} labelFormatter={(l) => `Dia ${l}`}
                formatter={(v: unknown, n: unknown) => [v == null ? "-" : fmt(Number(v)), n === "real" ? "Realizado acumulado" : n === "proj" ? "Projeção no ritmo atual" : "Meta acumulada"]} />
              <Line type="stepAfter" dataKey="meta" stroke="#8E8B84" strokeDasharray="6 5" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="real" stroke="#7FA2E8" strokeWidth={2.5} fill="url(#pkMetaArea)" connectNulls={false} />
              <Line type="monotone" dataKey="proj" stroke="#F2B544" strokeDasharray="2 4" strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="note" style={{ border: 0, marginTop: 4, paddingTop: 0 }}>Linha azul: realizado. Tracejada cinza: meta acumulada por dia útil.{emAndamento ? ` Pontilhada amarela: projeção se o ritmo de hoje continuar${s.projecao != null ? `, fechando em ${fmt(s.projecao)}` : ""}.` : ""}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================= ritmo da meta ======================= */
export function MetaKpis({ c }: { c: CtxK }) {
  const { k, mes } = c;
  const sf = serieRitmo(k.metaF, k.dias.map((d) => d.fat), mes);
  const sv = serieRitmo(k.metaV, k.dias.map((d) => d.vendas), mes);
  const nInt = (v: number | null) => num(v == null ? null : Math.round(v), 0);
  let af = 0, av = 0;
  const linhas = k.dias.filter((d) => d.d <= (k.du.corte || k.du.fim)).map((d) => {
    af += d.fat; av += d.vendas;
    const m = sf?.dias[d.d - 1]?.meta ?? null;
    return { ...d, af, av, m, util: k.du.util[d.d - 1] };
  });
  return (
    <>
      {sf ? <BlocoRitmo titulo="Faturamento · realizado x meta acumulado" s={sf} fmt={brl} /> : <div className="p"><div className="empty">Sem meta de faturamento cadastrada pra {mesLabel(mes).toLowerCase()}.</div></div>}
      {sv && <BlocoRitmo titulo="Vendas · realizado x meta acumulado" s={sv} fmt={nInt} />}
      <Panel titulo="Dia a dia" sub="clique num dia pra ver quem vendeu">
        <Tabela cols={[{ h: "Dia", tl: true }, "Faturamento", "Vendas", "Ticket", "Acumulado", "Meta acumulada", "Diferença"]}
          onRow={(i) => c.go({ view: "dia", dia: diaIso(mes, [...linhas].reverse()[i].d) })}
          rows={[...linhas].reverse().map((d) => [
            <>{String(d.d).padStart(2, "0")}/{mes.slice(5, 7)}{!d.util && <span className="tag" style={{ marginLeft: 6 }}>não útil</span>}</>,
            brl(d.fat), num(d.vendas, 0), brl(d.vendas ? d.fat / d.vendas : null), brl(d.af), brl(d.m), d.m == null ? <Nd /> : <span className={d.af - d.m >= 0 ? "pos" : "neg"}>{d.af - d.m >= 0 ? "+" : ""}{brl(d.af - d.m)}</span>,
          ])} />
      </Panel>
    </>
  );
}

/* ======================= time: tabela completa ======================= */
export function TimeKpis({ c }: { c: CtxK }) {
  const { b, k } = c;
  const lista = [...k.ranking, ...k.pessoas.filter((p) => !p.ranking)];
  return (
    <>
      <div className="grid k5">
        <Tile main label="Faturamento do time" valor={brl(k.fat)} sub={k.metaF ? `${fp(k.pctF)} da meta de ${brl(k.metaF)}` : undefined} onClick={() => c.go({ view: "meta" })} />
        <Tile label="Vendas" valor={num(k.vendas, 0)} sub={k.metaV ? `${fp(k.pctV)} da meta de ${num(k.metaV, 0)}` : undefined} onClick={() => c.go({ view: "meta" })} />
        <Tile label="Ticket médio" valor={brl(k.ticket)} sub={k.ant.vendas ? <><Var v={varPct(k.ticket, k.ant.fat / k.ant.vendas)} /> vs mês anterior</> : undefined} />
        <Tile label="Vendedoras no ranking" valor={String(k.ranking.length)} sub={`${k.ranking.filter((p) => (p.pctF ?? 0) >= 1).length} já bateram a meta`} />
        <Tile label="No ritmo" valor={k.emAndamento ? String(k.ranking.filter((p) => (p.ritmo ?? 0) >= 1).length) : "-"} sub={k.emAndamento ? `de ${k.ranking.filter((p) => p.ritmo != null).length} com meta` : "mês fechado"} />
      </div>
      <div className="p wide">
        <div className="h"><b>Vendedoras</b><span>clique na linha pra abrir a vendedora</span></div>
        <Tabela cols={[{ h: "Vendedora", tl: true }, { h: "Unidade", tl: true }, { h: "Time", tl: true }, "Faturamento", "Meta", "%", "Ritmo", "Vendas", "Meta v.", "Ticket", "Projeção", "vs mês ant.", "Última venda"]}
          onRow={(i) => c.go({ view: "pessoa", id: lista[i].id })}
          rows={lista.map((p) => [
            <>{p.nome}{!p.ranking && <span className="tag" style={{ marginLeft: 6 }}>fora do ranking</span>}</>,
            nomeUnidade(b, p.unidade), nomeTime(b, p.time), brl(p.fat), brl(p.metaF), fp(p.pctF),
            k.emAndamento && p.ritmo != null ? <span className={`st ${nivel(p.ritmo)}`}>{Math.round(p.ritmo * 100)}%</span> : <Nd />,
            num(p.vendas, 0), num(p.metaV, 0), brl(p.ticket), k.emAndamento ? brl(p.projecao) : <Nd />, <Var v={varPct(p.fat, p.antF)} />,
            p.ultimaVenda ? dd(p.ultimaVenda) : <Nd />,
          ])} />
        {k.semVendedora && (k.semVendedora.fat > 0 || k.semVendedora.vendas > 0) && <div className="note">Sem vendedora: {brl(k.semVendedora.fat)} e {plural(k.semVendedora.vendas, "venda", "vendas")} (entram no total).</div>}
      </div>
    </>
  );
}

/* ======================= uma vendedora ======================= */
export function PessoaKpis({ c, id }: { c: CtxK; id: string }) {
  const { b, k, mes } = c;
  const p: Pessoa | undefined = calcMes(b, mes).pessoas.find((x) => x.id === id);
  if (!p) return <div className="p"><div className="empty">Vendedora sem dados neste mês.</div></div>;
  const dp = diasPessoa(b, mes, id);
  const s = serieRitmo(p.metaF, dp.fat, mes);
  const serie = seriePessoa(b, id);
  const pos = k.ranking.findIndex((x) => x.id === id);
  const fatTime = k.fat || 0;
  return (
    <>
      <div className="grid k5">
        <Tile main label="Faturamento" valor={brl(p.fat)} sub={p.metaF ? `${fp(p.pctF)} da meta de ${brl(p.metaF)}` : "sem meta cadastrada"} />
        <Tile label="Vendas" valor={num(p.vendas, 0)} sub={p.metaV ? `${fp(p.pctV)} da meta de ${num(p.metaV, 0)}` : undefined} />
        <Tile label="Ticket médio" valor={brl(p.ticket)} sub={p.antV ? <><Var v={varPct(p.ticket, p.antF / p.antV)} /> vs {brl(p.antF / p.antV)} no mês anterior</> : undefined} />
        <Tile label="Posição no ranking" valor={pos >= 0 ? `${pos + 1}º` : "-"} sub={pos >= 0 ? `de ${k.ranking.length} · ${fp(pct(p.fat, fatTime))} do faturamento do time` : "fora do ranking"} onClick={() => c.go({ view: "time" })} />
        <Tile label="vs mês anterior" valor={varPct(p.fat, p.antF) == null ? "-" : `${(varPct(p.fat, p.antF) ?? 0) >= 0 ? "+" : ""}${Math.round((varPct(p.fat, p.antF) ?? 0) * 100)}%`}
          cls={(varPct(p.fat, p.antF) ?? 0) < 0 ? "neg" : "pos"} sub={`${brl(p.antF)} e ${plural(p.antV, "venda", "vendas")} no mesmo período`} />
      </div>
      {s && <BlocoRitmo titulo={`Meta de ${primeiroNome(p.nome)} · realizado x meta acumulado`} s={s} fmt={brl} />}
      <div className="grid g2">
        <Panel titulo="Dia a dia" sub={`${mesLabel(mes)} · ${nomeUnidade(b, p.unidade)} · ${nomeTime(b, p.time)}`}>
          <BarrasItens denso itens={dp.fat.map((v, i) => ({ k: String(i + 1), rot: String(i + 1), v: i < (k.du.corte || k.du.fim) ? v : null, tip: `${String(i + 1).padStart(2, "0")}/${mes.slice(5, 7)}: ${brl(v)} · ${plural(dp.vendas[i], "venda", "vendas")}` }))}
            fmt={kfmt} onItem={(x) => c.go({ view: "dia", dia: diaIso(mes, Number(x)) })} />
          <div className="note">{p.ultimaVenda ? `Última venda lançada em ${dd(p.ultimaVenda)}` : "Nenhuma venda lançada no mês"}{p.diasSemVenda ? `, há ${p.diasSemVenda} ${p.diasSemVenda === 1 ? "dia útil" : "dias úteis"}` : ""}.</div>
        </Panel>
        <Panel titulo="Mês a mês" sub="clique num mês pra trocar o painel">
          <Barras serie={comoSerie(serie)} mes={mes} fn={(x) => (x as unknown as { fat: number | null }).fat} fmt={kfmt}
            sub={(x) => { const m = x as unknown as { meta: number | null; fat: number | null }; return m.meta && m.fat != null ? fp(m.fat / m.meta) : ""; }} onMes={c.setMes} />
        </Panel>
      </div>
    </>
  );
}

/* ======================= um dia ======================= */
export function DiaKpis({ c, dia }: { c: CtxK; dia: string }) {
  const linhas = linhasDia(c.b, dia, c.f);
  const fat = linhas.reduce((s, l) => s + l.fat, 0), vendas = linhas.reduce((s, l) => s + l.vendas, 0);
  return (
    <>
      <div className="grid k5">
        <Tile main label={`Faturamento em ${dd(dia)}`} valor={brl(fat)} sub={plural(vendas, "venda", "vendas")} />
        <Tile label="Ticket do dia" valor={brl(vendas ? fat / vendas : null)} />
        <Tile label="Vendedoras que venderam" valor={String(linhas.filter((l) => l.id && (l.fat || l.vendas)).length)} />
        <Tile label="Meta do dia" valor={c.k.metaF && c.k.du.total ? brl(c.k.metaF / c.k.du.total) : "-"} sub="meta do mês dividida pelos dias úteis" />
        <Tile label="Resultado do dia" valor={c.k.metaF && c.k.du.total ? fp(fat / (c.k.metaF / c.k.du.total)) : "-"} sub="do que a meta pede por dia" />
      </div>
      <Panel titulo="Quem vendeu" sub="clique na vendedora pra abrir">
        <Tabela cols={[{ h: "Vendedora", tl: true }, "Faturamento", "Vendas", "Ticket", "% do dia"]}
          onRow={(i) => linhas[i].id && c.go({ view: "pessoa", id: linhas[i].id as string })}
          rows={linhas.map((l) => [l.nome, brlFull(l.fat), num(l.vendas, 0), brl(l.vendas ? l.fat / l.vendas : null), fp(pct(l.fat, fat))])}
          vazio="Nenhuma venda lançada neste dia." />
      </Panel>
    </>
  );
}

/* ======================= de onde vem cada número ======================= */
export function FontesKpis({ c }: { c: CtxK }) {
  const { b } = c;
  return (
    <div className="grid g2">
      <Panel titulo="De onde vem cada número">
        <Tabela cols={[{ h: "Número", tl: true }, { h: "Fonte", tl: true }]} rows={[
          ["Faturamento e vendas", "Sistema interno da empresa, enviado ao Nexus da UNV a cada venda e conferido a cada 2 minutos. Uma linha por vendedora por dia."],
          ["Metas", "Metas do mês cadastradas por vendedora no Nexus. A meta do time é a soma das metas individuais do recorte."],
          ["Ritmo e projeção", "Calculados aqui: meta dividida pelos dias úteis do mês (sem sábado, domingo e feriado nacional), contra o faturado até hoje."],
          ["Comparação com o mês anterior", "Mesmo período: do dia 1 até o mesmo dia do mês anterior, enquanto o mês está em andamento."],
          ["Ranking", "Só vendedoras do time comercial. Revenda e quem está marcado fora do ranking somam no total, mas não aparecem na disputa."],
          ["Canais (site, marketplaces)", "Não entram neste painel: aqui é só o time comercial."],
        ]} />
      </Panel>
      <Panel titulo="Situação da integração">
        <Tabela cols={[{ h: "Item", tl: true }, "Situação"]} rows={[
          ["Último número recebido", b.atualizado_em ? dataHoraBR(b.atualizado_em) : <Nd />],
          ["Vendedoras no cadastro", String(b.pessoas.filter((p) => p.ativo).length)],
          ["Unidades", b.unidades.map((u) => u.nome).join(", ") || <Nd />],
          ["Histórico disponível", `${serieMeses(b).filter((m) => m.fat != null).length} meses`],
        ]} />
        <div className="note">O painel recarrega sozinho a cada 2 minutos. Link só de leitura.</div>
      </Panel>
    </div>
  );
}

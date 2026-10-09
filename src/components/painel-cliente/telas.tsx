// Telas do Painel de Controle do cliente. Mesmas peças e mesmo tema do Painel de
// Controle do Nexus (ui.tsx, painel.css, funil 3D), com os blocos que existem na
// operação do cliente: vendas pela regra do contrato, agenda do comercial, caixa
// das plataformas de pagamento e meta do mês.
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Barras, BarrasItens, Combo, Lk, Nd, Panel, Rank, St, Tabela, Tile } from "@/components/painel-controle/ui";
import { brl, brlFull, dataBR, fp, kfmt, mesLabel, num, pct, plural } from "@/components/painel-controle/fmt";
import { esc } from "@/components/painel-controle/util";
import { FunilMes } from "@/components/painel-controle/funil/FunilMes";
import type { EtapaFunil } from "@/components/painel-controle/funil/geo";
import type { MesSerie } from "@/components/painel-controle/tipos";
import { alertas, calcMes, comMeta, linhasReunioes, linhasVendas, serieMeses, serieMeta, ym, type Bruto, type Filtro, type MesBruto } from "./modelo";

export type NavC = { view: string; f?: Filtro; det?: string; filtro?: Record<string, string>; titulo?: string };
export type CtxC = {
  b: Bruto; m: MesBruto; mes: string; setMes: (iso: string) => void;
  go: (n: NavC) => void; det: (bloco: string, filtro?: Record<string, string>, titulo?: string) => void;
  f: Filtro; setF: (f: Filtro) => void;
  /** meta só de vendas novas (sem renovações e ascensões) */
  soNovas: boolean; setSoNovas: (v: boolean) => void;
};

/** a barra mês a mês do Nexus espera MesSerie: preenche só o que o cliente tem */
const comoSerie = (b: Bruto): MesSerie[] => serieMeses(b).map((s) => ({
  mes: s.mes, recebido: s.recebido, recebido_n: 0, pago: null, lucro: null, vendas: s.vendas, receita: s.receita, leads: null, leads_inflow: null,
  agendadas: s.agendadas, realizadas: s.realizadas, no_show: s.agendadas - s.realizadas, spend: null, leads_meta: null, custo_ia: null, churn: 0, novos: 0, agente_msgs: null,
}));

/* ======================= visão geral ======================= */
export function VisaoCliente({ c }: { c: CtxC }) {
  const { b, m, mes } = c;
  const k = calcMes(b, m);
  const km = comMeta(k, c.soNovas);
  const s = serieMeta(km);
  const al = alertas(b, m, c.soNovas);
  const serie = comoSerie(b);
  const prev = b.meses[b.meses.indexOf(m) - 1];
  const kp = prev ? calcMes(b, prev) : null;
  // mês em andamento não se compara com mês fechado
  const emAndamento = mes.slice(0, 7) === new Date().toISOString().slice(0, 7);
  const dv = !emAndamento && kp && kp.recebido && k.recebido != null ? (k.recebido - kp.recebido) / kp.recebido : null;
  // MQL é só do funil de aplicação e as reuniões são de todos os funis: o MQL vai no selo, não vira etapa
  const etapas: EtapaFunil[] = [
    { k: "marcadas", nome: "Reuniões marcadas", v: k.agendadas + k.sem_desfecho, conv: k.sem_desfecho ? `${k.sem_desfecho} ainda sem desfecho` : "todas com desfecho marcado", onClick: () => c.det("reunioes", {}, "Reuniões do mês") },
    { k: "realizadas", nome: "Compareceram", v: k.realizadas, conv: k.presenca == null ? "sem reunião com desfecho" : `${fp(k.presenca)} de presença · ${k.no_show} no-show`, onClick: () => c.det("reunioes", { tipo: "realizadas" }, "Reuniões realizadas") },
    { k: "vendas", nome: "Vendas", v: k.vendas, conv: k.conv == null ? "sem reunião realizada" : `${fp(k.conv)} das realizadas`, onClick: () => c.det("vendas", {}, "Vendas do mês") },
  ];
  return (
    <>
      <div className="grid k5">
        <Tile main label={c.soNovas && km.meta ? "Vendas novas no mês" : "Vendido no mês"} valor={brl(km.receita)} sub={km.meta ? `${fp(s?.pctMeta)} da meta de ${brl(km.meta.total)} · ${plural(km.vendas, "venda", "vendas")}` : plural(k.vendas, "venda", "vendas")} onClick={() => c.go({ view: k.meta ? "meta" : "comercial" })} />
        <Tile label="Caixa recebido" valor={brl(k.recebido)} sub={k.recebido == null ? "sem leitura do financeiro neste mês" : <>Eduzz e Asaas{dv != null && <> · {dv >= 0 ? "+" : ""}{Math.round(dv * 100)}% vs mês anterior</>}</>} onClick={() => c.go({ view: "financeiro" })} />
        <Tile label="Ticket médio" valor={brl(k.ticket)} sub={`${plural(k.vendas, "venda", "vendas")} pela regra do contrato`} onClick={() => c.det("vendas", {}, "Vendas do mês")} />
        <Tile label="Presença nas reuniões" valor={fp(k.presenca)} cls={k.presenca != null && k.presenca < 0.5 ? "neg" : ""} sub={`${k.realizadas} de ${k.agendadas} com desfecho · ${k.no_show} no-show`} onClick={() => c.det("reunioes", { tipo: "no_show" }, "No-show")} />
        <Tile label="Lucro do mês" valor="-" sub="sem fonte: faltam os custos do mês" onClick={() => c.go({ view: "financeiro" })} />
      </div>

      {s && k.meta && <BlocoMeta c={c} />}

      <div className="grid r2">
        <Panel titulo="Funil único · mês" sub="marketing e comercial no mesmo número. Arraste pra girar, clique numa etapa pra ver os registros.">
          <FunilMes etapas={etapas} selo={k.mqls ? `${num(k.mqls, 0)} MQL no funil de aplicação${k.leads ? ` · ${num(k.leads, 0)} leads` : ""}` : "Sem investimento de mídia conectado"} onSelo={() => c.go({ view: "marketing" })} />
          <div className="ft">
            <div onClick={() => c.det("vendas", {}, "Vendas do mês")}><small>Receita vendida</small><b>{brl(k.receita)}</b></div>
            <div onClick={() => c.det("vendas", {}, "Vendas do mês")}><small>Ticket médio</small><b>{brl(k.ticket)}</b></div>
            <div onClick={() => c.go({ view: "marketing" })}><small>CAC</small><b className="nd">-</b></div>
            <div onClick={() => c.det("reunioes", { tipo: "pendente" }, "Calls sem decisão")}><small>Calls sem decisão</small><b className={k.pendentes ? "neg" : ""}>{num(k.pendentes, 0)}</b></div>
            <div onClick={() => c.det("reunioes", { tipo: "no_show" }, "No-show")}><small>No-show</small><b>{fp(k.presenca == null ? null : 1 - k.presenca)}</b></div>
          </div>
        </Panel>
        <Panel cls="alertas" titulo="Exige sua decisão" sub={`${al.length} ${al.length === 1 ? "item" : "itens"}`}>
          <div className="alertas-lista">
            {al.length === 0 && <div className="empty">Nada fora do padrão neste mês.</div>}
            {al.map((a, i) => (
              <button type="button" key={i} className={`ai ${a.gravidade}`} onClick={() => (a.abre.det ? c.det(a.abre.det, a.abre.filtro, a.titulo) : c.go({ view: a.abre.view ?? "comercial" }))}>
                <div><b>{a.titulo}</b><em>{a.detalhe}</em></div>
                <span className="chip">Atuar</span>
              </button>
            ))}
          </div>
          <div className="note">Calculado a partir da planilha do comercial e do sistema interno. Clique pra ver os registros.</div>
        </Panel>
      </div>

      <div className="grid r4">
        <Panel titulo="Comercial" onClick={() => c.go({ view: "comercial" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Vendas mês</small><b>{num(k.vendas, 0)}</b></div>
            <div><small>Receita vendida</small><b>{brl(k.receita)}</b></div>
            <div><small>Call → venda</small><b>{fp(k.conv)}</b></div>
          </div>
          <div className="lbl" style={{ marginBottom: 7 }}>Quem agenda · presença</div>
          {k.por_sdr.filter((x) => x.agendadas >= 3).map((x) => (
            <Rank key={x.nome} nome={x.nome} p={x.agendadas ? x.realizadas / x.agendadas : 0} bad={x.agendadas > 0 && x.realizadas / x.agendadas < 0.5}
              det={<><b>{x.agendadas}</b> com desfecho · <b>{x.realizadas}</b> realizadas · <b>{x.no_show}</b> no-show{x.sem_desfecho ? <> · <b>{x.sem_desfecho}</b> sem desfecho</> : null}</>}
              onClick={() => c.go({ view: "comercial", f: { sdr: x.nome } })} />
          ))}
          {!k.por_sdr.length && <div className="empty">Sem reuniões no mês.</div>}
          <div className="lbl" style={{ margin: "12px 0 7px" }}>Closer · call para venda</div>
          {k.por_closer.map((x) => (
            <Rank key={x.nome} nome={x.nome} p={x.realizadas ? Math.min(x.vendas / x.realizadas, 1) : 0} bad={x.realizadas > 3 && x.vendas / x.realizadas < 0.15}
              det={<><b>{x.realizadas}</b> calls · <b>{x.vendas}</b> vendas · <b>{brl(x.receita)}</b></>} onClick={() => c.go({ view: "comercial", f: { closer: x.nome } })} />
          ))}
        </Panel>
        <Panel titulo="Marketing" onClick={() => c.go({ view: "marketing" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Leads</small><b className={k.leads ? "" : "nd"}>{num(k.leads, 0)}</b></div>
            <div><small>MQL</small><b className={k.mqls ? "" : "nd"}>{num(k.mqls, 0)}</b></div>
            <div><small>CPL</small><b className="nd">-</b></div>
          </div>
          <Tabela cols={[{ h: "Origem da venda", tl: true }, "Vendas", "Valor"]} rows={k.por_funil.filter((x) => x.vendas).slice(0, 6).map((x) => [x.nome, x.vendas, brl(x.receita)])} vazio="Sem vendas no mês." />
        </Panel>
        <Panel titulo="Financeiro" onClick={() => c.go({ view: "financeiro" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Recebido</small><b className={k.recebido == null ? "nd" : ""}>{brl(k.recebido)}</b></div>
            <div><small>Reembolsos</small><b className={k.reembolso ? "neg" : ""}>{brl(k.reembolso)}</b></div>
            <div><small>Lucro</small><b className="nd">-</b></div>
          </div>
          <Tabela cols={[{ h: "Produto", tl: true }, "Recebido"]} rows={Object.entries(k.caixa?.por ?? {}).sort((a, b2) => b2[1] - a[1]).slice(0, 6).map(([p, v]) => [p, brl(v)])} vazio="Sem leitura do financeiro neste mês." />
        </Panel>
        <Panel titulo="Qualidade do dado" onClick={() => c.go({ view: "fontes" })} more="Abrir detalhes">
          <Tabela cols={[{ h: "Indicador", tl: true }, "Valor"]} rows={[
            ["Vendas sem contrato", num(k.qualidade?.sem_contrato ?? null, 0)],
            ["Vendas sem origem", num(k.qualidade?.sem_origem ?? null, 0)],
            ["Vendas sem vendedor", num(k.qualidade?.sem_vendedor ?? null, 0)],
            ["Reuniões sem desfecho", num(k.sem_desfecho, 0)],
            ["Calls sem decisão", num(k.pendentes, 0)],
            ["Fora da regra (R$)", k.fora ? brl(k.fora.valor) : <Nd />],
          ]} />
        </Panel>
      </div>

      <div className="grid r3">
        <Panel titulo="Vendido · mês a mês" sub="valor vendido por mês. Clique num mês pra trocar o painel inteiro.">
          <div className="fin">
            <Barras serie={serie} mes={mes} fn={(x) => x.receita} fmt={kfmt} sub={(x) => (x.vendas ? `${x.vendas} v.` : "")} onMes={c.setMes} />
            <div>
              <Tabela cols={[{ h: "Linha", tl: true }, "Valor", "Obs."]} hl={2} rows={[
                ["Vendido", brl(k.receita), plural(k.vendas, "venda", "vendas")],
                ["Caixa recebido", brl(k.recebido), k.recebido != null && k.receita ? `${fp(pct(k.recebido, k.receita))} do vendido` : <Nd />],
                ["(–) Reembolsos", brl(k.reembolso), k.recebido ? fp(pct(k.reembolso, k.recebido)) : <Nd />],
                ["(–) Mídia, time, entrega, estrutura", <Nd />, "sem fonte"],
                ["= Lucro líquido", <Nd />, "faltam os custos"],
              ]} />
              <button type="button" className="back" style={{ marginTop: 12 }} onClick={() => c.go({ view: "financeiro" })}>Abrir detalhes do financeiro</button>
            </div>
          </div>
        </Panel>
        <Panel titulo="Meta do mês" sub={k.meta ? mesLabel(mes) : "sem meta cadastrada"} onClick={() => c.go({ view: "meta" })} more="Abrir ritmo da meta">
          {k.meta && s ? (
            <Tabela cols={[{ h: "Linha", tl: true }, "Valor"]} rows={[
              ["Meta", brl(k.meta.total)],
              ["Vendido", brl(s.vendido)],
              ["Esperado até hoje", brl(s.esperado)],
              ["Ritmo", <span className={s.dif >= 0 ? "" : "neg"}>{s.dif >= 0 ? "+" : ""}{brl(s.dif)}</span>],
              ["Falta por dia útil", brl(s.porDiaRestante)],
              ["Projeção no ritmo", brl(s.projecao)],
            ]} />
          ) : <div className="empty">Sem meta cadastrada pra este mês.</div>}
        </Panel>
      </div>
      <div className="foot">Dados da planilha do comercial e do sistema interno. Onde aparece "-" ou "sem fonte", a informação ainda não foi conectada. Clique em qualquer número pra ver os registros. <Lk onClick={() => c.go({ view: "fontes" })}>De onde vem cada número</Lk></div>
    </>
  );
}

/* ======================= meta do mês: realizado x meta acumulado ======================= */
/** escolha da meta: com ou sem renovações e ascensões */
export function SeletorMeta({ c }: { c: CtxC }) {
  const meta = calcMes(c.b, c.m).meta;
  if (!meta || meta.novas == null) return null;
  return (
    <span className="seg" role="group" aria-label="Qual meta usar">
      <button type="button" className={!c.soNovas ? "on" : ""} aria-pressed={!c.soNovas} onClick={() => c.setSoNovas(false)}>Novas + renovações e ascensões · {brl(meta.total)}</button>
      <button type="button" className={c.soNovas ? "on" : ""} aria-pressed={c.soNovas} onClick={() => c.setSoNovas(true)}>Só vendas novas · {brl(meta.novas)}</button>
    </span>
  );
}

export function BlocoMeta({ c }: { c: CtxC }) {
  const k = comMeta(calcMes(c.b, c.m), c.soNovas), s = serieMeta(k);
  if (!s || !k.meta) return null;
  const dd = c.mes.slice(5, 7);
  // projeção: o ritmo médio por dia útil até hoje, repetido nos dias úteis que faltam (linha pontilhada a partir de hoje)
  const ritmoDia = s.du.passados ? s.vendido / s.du.passados : null;
  let acum = s.vendido;
  const dados = s.dias.map((x) => {
    if (ritmoDia != null && x.d > s.du.corte && x.util) acum += ritmoDia;
    const proj = ritmoDia != null && s.du.corte > 0 && x.d >= s.du.corte ? Math.round(acum) : null;
    return { d: `${String(x.d).padStart(2, "0")}/${dd}`, meta: Math.round(x.meta), real: x.real == null ? null : Math.round(x.real), proj };
  });
  const nivel = s.dif >= 0 ? "g" : s.dif >= -0.1 * k.meta.total ? "a" : "r";
  const pProj = pct(s.projecao, k.meta.total);
  const precisaDia = s.porDiaRestante;
  return (
    <div className="p">
      <div className="h"><b>Meta do mês · realizado x meta acumulado</b><SeletorMeta c={c} /></div>
      <div className="meta-g">
        <div className="kg mk">
          <Tile label={`Meta de ${mesLabel(c.mes).split(" ")[0]}`} valor={brl(k.meta.total)} sub={c.soNovas ? "só vendas novas" : k.meta.novas != null ? `${brl(k.meta.novas)} novas · ${brl(k.meta.renov)} renovações e ascensões` : undefined} onClick={() => c.go({ view: "meta" })} />
          <Tile label="Realizado" valor={brl(s.vendido)} sub={`${fp(s.pctMeta)} da meta`} onClick={() => c.det("vendas", {}, "Vendas do mês")} />
          <Tile label="Esperado até hoje" valor={brl(s.esperado)} sub={<St ok={nivel === "g"} warn={nivel === "a"} tg="no ritmo" tw="pouco abaixo" tb="abaixo do ritmo" />} onClick={() => c.go({ view: "meta" })} />
          <Tile label="Falta por dia útil" valor={brl(s.porDiaRestante)} sub={`${brl(s.falta)} em ${s.du.restantes} dias úteis`} onClick={() => c.go({ view: "meta" })} />
          <Tile label="Projeção do mês" valor={brl(s.projecao)} cls={pProj != null && pProj < 1 ? "neg" : ""}
            sub={s.projecao == null ? "sem dia útil passado ainda" : <><St ok={(pProj ?? 0) >= 1} warn={(pProj ?? 0) >= 0.9} tg="bate a meta" tw="perto da meta" tb="não bate a meta" /> {fp(pProj)} da meta no ritmo atual</>}
            onClick={() => c.go({ view: "meta" })} />
          <Tile label="Ritmo por dia útil" valor={brl(ritmoDia)} cls={ritmoDia != null && precisaDia != null && ritmoDia < precisaDia ? "neg" : ""}
            sub={precisaDia != null ? `precisa de ${brl(precisaDia)} por dia útil daqui pra frente` : undefined} onClick={() => c.go({ view: "meta" })} />
        </div>
        <div style={{ minHeight: 230 }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dados} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <defs><linearGradient id="pcMetaArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E9DFC9" stopOpacity={0.35} /><stop offset="100%" stopColor="#E9DFC9" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid stroke="#262626" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: "#8E8B84", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => kfmt(v)} />
              <Tooltip contentStyle={{ background: "#181818", border: "1px solid #2C2C2C", fontSize: 12 }} formatter={(v: any, n: any) => [v == null ? "-" : brl(Number(v)), n === "real" ? "Realizado acumulado" : n === "proj" ? "Projeção no ritmo atual" : "Meta acumulada"]} />
              <Line type="stepAfter" dataKey="meta" stroke="#8E8B84" strokeDasharray="6 5" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="real" stroke="#E9DFC9" strokeWidth={2.5} fill="url(#pcMetaArea)" connectNulls={false} />
              <Line type="monotone" dataKey="proj" stroke="#F2B544" strokeDasharray="2 4" strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="note" style={{ border: 0, marginTop: 4, paddingTop: 0 }}>Linha cheia: realizado. Tracejada cinza: meta acumulada. Pontilhada amarela: projeção se o ritmo de hoje continuar{s.projecao != null ? `, fechando em ${brl(s.projecao)}` : ""}.</div>
          {(k.tipo || k.fora) && (
            <div className="note">
              {k.tipo && <>Vendas novas {brl(k.tipo.novas)} · renovações e ascensões {brl(k.tipo.renov)}. </>}
              {k.fora && k.fora.valor > 0 && <>Fora da regra: {brl(k.fora.valor)} ({k.fora.semContrato} sem contrato, {k.fora.dataFutura} com data no futuro). Registrado no sistema: {brl(k.registrado?.valor)}.</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================= ritmo da meta ======================= */
export function MetaCliente({ c }: { c: CtxC }) {
  const k = comMeta(calcMes(c.b, c.m), c.soNovas), s = serieMeta(k);
  if (!k.meta || !s) return <div className="empty">Sem meta cadastrada pra {mesLabel(c.mes)}.</div>;
  return (
    <>
      <div className="kg">
        <Tile label="Meta do mês" valor={brl(k.meta.total)} />
        <Tile label="Vendido" valor={brl(s.vendido)} sub={`${fp(s.pctMeta)} da meta com ${fp(s.pctTempo)} do mês`} onClick={() => c.det("vendas", {}, "Vendas do mês")} />
        <Tile label="Ritmo" valor={`${s.dif >= 0 ? "+" : ""}${brl(s.dif)}`} cls={s.dif < 0 ? "neg" : ""} sub={s.dif >= 0 ? "acima do esperado até hoje" : "abaixo do esperado até hoje"} />
        <Tile label="Projeção no ritmo" valor={brl(s.projecao)} sub={s.projecao != null ? `${fp(pct(s.projecao, k.meta.total))} da meta` : undefined} />
        <Tile label="Falta" valor={brl(s.falta)} sub={`${s.du.restantes} dias úteis · ${brl(s.porDiaRestante)} por dia`} />
        {k.tipo && <Tile label="Vendas novas" valor={brl(k.tipo.novas)} sub={k.meta.novas ? `${fp(pct(k.tipo.novas, k.meta.novas))} de ${brl(k.meta.novas)}` : undefined} />}
        {k.tipo && <Tile label="Renovações e ascensões" valor={brl(k.tipo.renov)} sub={k.meta.renov ? `${fp(pct(k.tipo.renov, k.meta.renov))} de ${brl(k.meta.renov)}` : undefined} />}
        {k.fora && <Tile label="Fora da regra" valor={brl(k.fora.valor)} cls={k.fora.valor ? "neg" : ""} sub={`${k.fora.semContrato} sem contrato (${brl(k.fora.semContratoValor)}) · ${k.fora.dataFutura} com data futura (${brl(k.fora.dataFuturaValor)})`} />}
      </div>
      <BlocoMeta c={c} />
      <div className="grid g2">
        <Panel titulo="Por closer" sub="vendido no mês">
          <Tabela cols={[{ h: "Closer", tl: true }, "Vendas", "Vendido", "% da meta"]} rows={k.por_closer.filter((x) => x.vendas).map((x) => [<Lk onClick={() => c.det("vendas", { closer: x.nome }, `Vendas · ${x.nome}`)}>{x.nome}</Lk>, x.vendas, brl(x.receita), fp(pct(x.receita, k.meta?.total))])} vazio="Nenhuma venda no mês." />
        </Panel>
        <Panel titulo="Dia a dia" sub="realizado acumulado contra a meta acumulada">
          <Tabela cols={[{ h: "Dia", tl: true }, "Meta acumulada", "Realizado", "Diferença"]} rows={s.dias.filter((x) => x.real != null).reverse().map((x) => [dataBR(`${c.mes.slice(0, 8)}${String(x.d).padStart(2, "0")}`), brl(x.meta), brl(x.real), <span className={(x.real ?? 0) < x.meta ? "neg" : ""}>{brl((x.real ?? 0) - x.meta)}</span>])} />
        </Panel>
      </div>
    </>
  );
}

/* ======================= comercial ======================= */
export function filtrosComercialCliente(c: CtxC) {
  const opts = (vals: string[]) => [...new Set(vals.filter((v) => v && v !== "Não informado"))].sort().map((v) => ({ value: v, label: v }));
  const todos = c.b.meses.flatMap((m) => m.ag);
  const vds = c.b.meses.flatMap((m) => m.vd);
  return (
    <>
      <Combo k="funil" label="Funil" value={c.f.funil ?? ""} opts={opts([...todos.map((a) => a[0]), ...vds.map((v) => v[3])])} todos="Todos os funis" onChange={(v) => c.setF({ ...c.f, funil: v || undefined })} />
      <Combo k="closer" label="Closer" value={c.f.closer ?? ""} opts={opts([...todos.map((a) => a[2]), ...vds.map((v) => v[2])])} todos="Todos os closers" onChange={(v) => c.setF({ ...c.f, closer: v || undefined })} />
      <Combo k="sdr" label="SDR" value={c.f.sdr ?? ""} opts={opts(todos.map((a) => a[1]))} todos="Todos os SDRs" onChange={(v) => c.setF({ ...c.f, sdr: v || undefined })} />
    </>
  );
}
export function ComercialCliente({ c }: { c: CtxC }) {
  const k = calcMes(c.b, c.m, c.f);
  const serie = comoSerie(c.b);
  return (
    <>
      {k.filtrado && <div className="note" style={{ border: 0, margin: 0, padding: 0 }}>Filtro ativo: {[c.f.funil, c.f.closer && `closer ${c.f.closer}`, c.f.sdr && `SDR ${c.f.sdr}`].filter(Boolean).join(" · ")}{c.f.sdr ? ". As vendas não registram o SDR: com esse filtro, vendas vêm das marcações da agenda e o valor fica sem dado." : ""}</div>}
      <div className="kg">
        <Tile label="Reuniões com desfecho" valor={num(k.agendadas, 0)} sub={k.sem_desfecho ? `${k.sem_desfecho} sem desfecho` : "todas marcadas"} onClick={() => c.det("reunioes", c.f as any, "Reuniões do mês")} />
        <Tile label="Compareceram" valor={num(k.realizadas, 0)} sub={`${fp(k.presenca)} de presença`} onClick={() => c.det("reunioes", { ...(c.f as any), tipo: "realizadas" }, "Reuniões realizadas")} />
        <Tile label="No-show" valor={fp(k.presenca == null ? null : 1 - k.presenca)} cls={k.presenca != null && k.presenca < 0.5 ? "neg" : ""} sub={`${k.no_show} faltaram`} onClick={() => c.det("reunioes", { ...(c.f as any), tipo: "no_show" }, "No-show")} />
        <Tile label="Vendas" valor={num(k.vendas, 0)} sub={k.vdOk ? brl(k.receita) : "marcadas na agenda"} onClick={() => c.det("vendas", c.f as any, "Vendas do mês")} />
        <Tile label="Call → venda" valor={fp(k.conv)} sub="vendas sobre calls realizadas" />
        <Tile label="Calls sem decisão" valor={num(k.pendentes, 0)} cls={k.pendentes ? "neg" : ""} sub="compareceu e segue pendente" onClick={() => c.det("reunioes", { ...(c.f as any), tipo: "pendente" }, "Calls sem decisão")} />
      </div>
      <Panel titulo="Closers" sub="calls da agenda, vendas e valor pela regra do contrato">
        <Tabela cols={[{ h: "Closer", tl: true }, "Calls", "Vendas", "Conversão", "Sem decisão", "Vendido", "Ticket"]}
          rows={k.por_closer.map((x) => [<Lk onClick={() => c.setF({ ...c.f, closer: x.nome })}>{x.nome}</Lk>, x.realizadas, x.vendas, fp(pct(x.vendas, x.realizadas)), x.pendentes, brl(x.receita), brl(x.vendas ? x.receita / x.vendas : null)])} vazio="Sem closer no recorte." />
        <div className="note">Alvo do playbook: 5 calls por dia por closer. Meta do closer nível 1: R$ 141 a 180 mil por mês.</div>
      </Panel>
      <Panel titulo="SDRs" sub="agendamento e presença">
        <Tabela cols={[{ h: "SDR", tl: true }, "Com desfecho", "Realizadas", "No-show", "Presença", "Sem desfecho", "Vendas (agenda)"]}
          rows={k.por_sdr.map((x) => [<Lk onClick={() => c.setF({ ...c.f, sdr: x.nome })}>{x.nome}</Lk>, x.agendadas, x.realizadas, x.no_show, <span className={x.agendadas && x.realizadas / x.agendadas < 0.5 ? "neg" : ""}>{fp(pct(x.realizadas, x.agendadas))}</span>, x.sem_desfecho, x.vendas])} vazio="Sem SDR no recorte." />
        <div className="note">Meta do SDR nível 1 no playbook: 25 a 35 calls realizadas no mês.</div>
      </Panel>
      <div className="grid g2">
        <Panel titulo="Presença por tempo de espera" sub="dias entre o agendamento e a reunião">
          {(c.m.espera || []).map((e) => (
            <div key={e.faixa} className="fr go" onClick={() => c.det("reunioes", {}, `Reuniões · ${e.faixa}`)}>
              <span className="n">{e.faixa}</span>
              <div className="tr"><i className={e.agendadas && e.realizadas / e.agendadas < 0.4 ? "bad" : ""} style={{ width: `${Math.max((pct(e.realizadas, e.agendadas) ?? 0) * 100, 1)}%` }} /></div>
              <span className="v">{fp(pct(e.realizadas, e.agendadas))}</span>
              <span className="c">{e.realizadas} de {e.agendadas}</span>
            </div>
          ))}
          <div className="note">O playbook pede reunião no mesmo dia ou no dia seguinte.</div>
        </Panel>
        <Panel titulo="Por funil">
          <Tabela cols={[{ h: "Funil", tl: true }, "Reuniões", "Realizadas", "Vendas", "Vendido"]} rows={k.por_funil.map((x) => [<Lk onClick={() => c.setF({ ...c.f, funil: x.nome })}>{x.nome}</Lk>, x.agendadas, x.realizadas, x.vendas, brl(x.receita)])} />
        </Panel>
      </div>
      <div className="grid g2">
        <Panel titulo="Presença mês a mês"><Barras serie={serie} mes={c.mes} fn={(x) => (x.agendadas ? (x.realizadas ?? 0) / (x.agendadas ?? 1) : null)} fmt={(v) => fp(v)} sub={(x) => `${x.agendadas ?? 0} reun.`} onMes={c.setMes} /></Panel>
        <Panel titulo="Vendas mês a mês"><Barras serie={serie} mes={c.mes} fn={(x) => x.vendas} fmt={(v) => num(v, 0)} sub={(x) => kfmt(x.receita)} onMes={c.setMes} /></Panel>
      </div>
    </>
  );
}

/* ======================= financeiro ======================= */
export function FinanceiroCliente({ c }: { c: CtxC }) {
  const k = calcMes(c.b, c.m);
  const serie = comoSerie(c.b);
  const dia = c.b.sistema?.caixa_dia ?? {};
  const fim = new Date(Number(c.mes.slice(0, 4)), Number(c.mes.slice(5, 7)), 0).getDate();
  const itens = Array.from({ length: fim }, (_, i) => { const d = `${ym(c.mes)}-${String(i + 1).padStart(2, "0")}`; return { k: d, rot: String(i + 1), v: d in dia ? dia[d] : Object.keys(dia).some((x) => x.startsWith(ym(c.mes))) ? 0 : null }; });
  const temDia = itens.some((x) => x.v);
  return (
    <>
      <div className="kg">
        <Tile label="Caixa recebido" valor={brl(k.recebido)} sub={k.caixa ? `Eduzz ${brl(k.caixa.eduzz)} · Asaas ${brl(k.caixa.asaas)}` : "sem leitura neste mês"} />
        <Tile label="Reembolsos" valor={brl(k.reembolso)} cls={k.reembolso ? "neg" : ""} sub={k.recebido ? `${fp(pct(k.reembolso, k.recebido))} do recebido` : undefined} />
        <Tile label="Vendido no mês" valor={brl(k.receita)} sub={plural(k.vendas, "venda", "vendas")} onClick={() => c.det("vendas", {}, "Vendas do mês")} />
        <Tile label="Entrada registrada" valor={brl(k.entrada)} sub={k.receita ? `${fp(pct(k.entrada, k.receita))} do vendido` : undefined} />
        <Tile label="Custos do mês" valor="-" sub="sem fonte: planilha de custos pendente" />
        <Tile label="Lucro líquido" valor="-" sub="sem fonte: faltam os custos" />
      </div>
      {temDia && <Panel titulo="Caixa por dia" sub={mesLabel(c.mes)}><BarrasItens itens={itens} fmt={kfmt} denso /></Panel>}
      <div className="grid g2">
        <Panel titulo="Caixa mês a mês" sub="Eduzz e Asaas"><Barras serie={serie} mes={c.mes} fn={(x) => x.recebido} fmt={kfmt} onMes={c.setMes} /></Panel>
        <Panel titulo="Caixa por produto" sub={mesLabel(c.mes)}>
          <Tabela cols={[{ h: "Produto", tl: true }, "Recebido", "% do mês"]} rows={Object.entries(k.caixa?.por ?? {}).sort((a, b2) => b2[1] - a[1]).map(([p, v]) => [p, brl(v), fp(pct(v, k.recebido))])} vazio="Sem leitura do financeiro neste mês." />
          <div className="note">Pagamentos do Asaas chegam sem o nome do produto e aparecem como "Asaas sem produto".</div>
        </Panel>
      </div>
      <Panel titulo="Resultado do mês" sub="estrutura pronta; os custos ainda não têm fonte">
        <Tabela cols={[{ h: "Linha", tl: true }, "Valor", "% do recebido"]} hl={6} rows={[
          ["Caixa recebido", brl(k.recebido), "100%"],
          ["(–) Reembolsos", brl(k.reembolso), fp(pct(k.reembolso, k.recebido))],
          ["(–) Mídia e marketing", <Nd />, "sem fonte"],
          ["(–) Time comercial e comissões", <Nd />, "sem fonte"],
          ["(–) Entrega, taxas e ferramentas", <Nd />, "sem fonte"],
          ["(–) Estrutura fixa e impostos", <Nd />, "sem fonte"],
          ["= Lucro líquido", <Nd />, "faltam os custos"],
        ]} />
      </Panel>
    </>
  );
}

/* ======================= marketing ======================= */
export function MarketingCliente({ c }: { c: CtxC }) {
  const k = calcMes(c.b, c.m);
  const fap = c.b.sistema?.funil_fap;
  const meses = (fap?.mes as string[] | undefined) ?? [];
  const linhas = ["MQL", "SQL", "Call agendada", "Call realizada", "Venda realizada"].filter((l) => fap?.[l]);
  return (
    <>
      <div className="kg">
        <Tile label="Leads no funil de aplicação" valor={num(k.leads, 0)} />
        <Tile label="Leads qualificados (MQL)" valor={num(k.mqls, 0)} sub={k.leads ? `${fp(pct(k.mqls, k.leads))} dos leads` : undefined} />
        <Tile label="Investimento em mídia" valor="-" sub="sem fonte: gerenciador de anúncios pendente" />
        <Tile label="CPL" valor="-" sub="depende do investimento" />
        <Tile label="CAC" valor="-" sub="depende do investimento" />
      </div>
      {fap && meses.length > 0 && (
        <Panel titulo="Funil de aplicação mês a mês" sub="tela Funis do sistema interno">
          <Tabela cols={[{ h: "Etapa", tl: true }, ...meses.map((x) => x.slice(5, 7) + "/" + x.slice(2, 4))]} rows={linhas.map((l) => [l, ...(fap[l] as (number | null)[]).map((v) => (v == null ? <Nd /> : num(v, 0)))])} />
        </Panel>
      )}
      <Panel titulo="Vendas por origem" sub={mesLabel(c.mes)}>
        <Tabela cols={[{ h: "Origem", tl: true }, "Reuniões", "Realizadas", "Vendas", "Vendido"]} rows={k.por_funil.map((x) => [<Lk onClick={() => c.go({ view: "comercial", f: { funil: x.nome } })}>{x.nome}</Lk>, x.agendadas, x.realizadas, x.vendas, brl(x.receita)])} />
      </Panel>
    </>
  );
}

/* ======================= fontes ======================= */
export function FontesCliente({ c }: { c: CtxC }) {
  const s = c.b.sistema;
  return (
    <Panel titulo="De onde vem cada número">
      <Tabela cols={[{ h: "Fonte", tl: true }, { h: "O que traz", tl: true }, "Situação"]} rows={[
        ["Planilha de controle comercial", "agenda, vendas e funis de janeiro a setembro", <St ok tg="conectada, de hora em hora" />],
        ["Sistema interno", `vendas, agenda, caixa e funil desde outubro${s?.lido_em ? `, lido em ${s.lido_em}` : ""}`, <St ok={false} warn tw="leitura manual até sair a API" />],
        ["Playbook comercial", "metas de SDR e closer, regras de venda", <St ok tg="conectado" />],
        ["Gerenciador de anúncios", "investimento, CPL, CAC, ROAS", <St ok={false} tb="sem fonte" />],
        ["Custos e folha", "margem e lucro líquido", <St ok={false} tb="sem fonte" />],
      ]} />
      {s?.notas?.length ? <div className="note">{s.notas.map((n, i) => <div key={i}>{n}</div>)}</div> : null}
    </Panel>
  );
}

/* ======================= detalhe (registros) ======================= */
const TITULOS_DET: Record<string, string> = { vendas: "Vendas", reunioes: "Reuniões" };
export function DetalheCliente({ c, bloco, filtro }: { c: CtxC; bloco: string; filtro?: Record<string, string> }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => (bloco === "vendas" ? linhasVendas(c.b, c.m, filtro as any) : linhasReunioes(c.b, c.m, filtro as any)), [c.b, c.m, bloco, JSON.stringify(filtro ?? {})]); // eslint-disable-line react-hooks/exhaustive-deps
  const vis = rows.filter((r) => !q || Object.values(r).some((v) => v != null && esc(String(v)).includes(esc(q))));
  const vendas = bloco === "vendas";
  const total = vendas ? (vis as ReturnType<typeof linhasVendas>).reduce((s, r) => s + r.valor, 0) : 0;
  return (
    <>
      <div className="bar2">
        <div className="sub" style={{ maxWidth: 640 }}>{vendas ? "Vendas que contam pela regra: contrato assinado e data de contrato até hoje." : "Reuniões do mês com o desfecho marcado pelo comercial."} {mesLabel(c.mes)}. Sem nome de aluno: este link é compartilhado.</div>
        <div className="fs">
          <div className="cb" style={{ minWidth: 220 }}>
            <label>Buscar nos registros</label>
            <input className="cbb" style={{ cursor: "text" }} placeholder="Digite para filtrar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="kg">
        <Tile label={TITULOS_DET[bloco] ?? "Registros"} valor={num(vis.length, 0)} />
        {vendas && <Tile label="Valor" valor={brl(total)} />}
        {vendas && <Tile label="Ticket médio" valor={brl(vis.length ? total / vis.length : null)} />}
      </div>
      <div className="p wide">
        <div className="h"><b>Registros</b><span>{vis.length} {vis.length === 1 ? "linha" : "linhas"}</span></div>
        {vendas ? (
          <Tabela cols={["Data", { h: "Closer", tl: true }, { h: "Origem", tl: true }, "Valor", "Entrada", "Contrato", "Plataforma"]}
            rows={(vis as ReturnType<typeof linhasVendas>).map((r) => [dataBR(r.data), r.closer, r.origem, brlFull(r.valor), brlFull(r.entrada), r.contrato, r.plataforma])} vazio="Nenhuma venda com esse filtro." />
        ) : (
          <Tabela cols={["Data", { h: "SDR", tl: true }, { h: "Closer", tl: true }, { h: "Funil", tl: true }, "Situação", "Decisão", "Espera"]}
            rows={(vis as ReturnType<typeof linhasReunioes>).map((r) => [dataBR(r.data), r.sdr, r.closer, r.funil, r.situacao === "no-show" ? <span className="neg">{r.situacao}</span> : r.situacao, r.decisao, r.espera == null ? "-" : `${r.espera} ${r.espera === 1 ? "dia" : "dias"}`])} vazio="Nenhuma reunião com esse filtro." />
        )}
      </div>
    </>
  );
}

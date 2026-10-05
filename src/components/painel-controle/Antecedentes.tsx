// Indicadores antecedentes: o que ainda dá pra mudar. Reuniões já na agenda,
// pipeline aberto contra o que falta da meta, e a entrada de leads da semana.
// Tudo olha de hoje pra frente; o mês escolhido no topo não muda esta tela.
import type { Ctx } from "./ctx";
import type { Frente } from "./tipos";
import { BarrasItens, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, fp, num, plural } from "./fmt";
import { LINK } from "./util";

type Ant = NonNullable<Frente["antecedentes"]>;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSem = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()];
const cor = (nivel: string | null | undefined) => (nivel === "vermelho" ? "neg" : nivel === "ambar" ? "warn" : nivel === "verde" ? "pos" : "");
const FONTE: Record<string, string> = { funil: "histórico da etapa neste funil", geral: "histórico da etapa em todos os funis", fixa: "5% fixo, sem amostra" };

/** cartão "reuniões da semana" */
export function reunioesFrase(a: Ant | undefined): { valor: string; sub: string; cls: string } {
  if (!a) return { valor: "-", sub: "indisponível", cls: "" };
  const r = a.reunioes;
  const rel = r.media_semanal ? r.prox7 / r.media_semanal : null;
  return {
    valor: num(r.prox7, 0), cls: rel == null ? "" : rel < 0.6 ? "neg" : rel < 1 ? "warn" : "pos",
    sub: `nos próximos 7 dias. Média das últimas 4 semanas: ${num(r.media_semanal)} por semana. ${r.prox14 - r.prox7 === 0 ? "Semana seguinte ainda vazia" : `Mais ${r.prox14 - r.prox7} na semana seguinte`}`,
  };
}

/** cartão "cobertura do pipeline" */
export function coberturaFrase(a: Ant | undefined): { valor: string; sub: string; cls: string } {
  if (!a) return { valor: "-", sub: "indisponível", cls: "" };
  const p = a.pipeline;
  if (p.meta.meta == null) return { valor: "-", sub: `sem meta de vendas cadastrada no CRM pra este mês. Ponderado: ${brl(p.ponderado)}`, cls: "" };
  if (p.meta_batida) return { valor: "meta batida", sub: `${brl(p.vendido)} vendidos pra meta de ${brl(p.meta.meta)}`, cls: "pos" };
  return { valor: p.cobertura == null ? "-" : `${num(p.cobertura)}x`, cls: cor(p.nivel), sub: `${brl(p.ponderado)} ponderados pra ${brl(p.falta)} que faltam da meta de ${brl(p.meta.meta)}. Abaixo de 1x não fecha` };
}

export function Antecedentes({ c }: { c: Ctx }) {
  const a = c.d.frente?.antecedentes;
  if (!a) return <div className="err">Esse bloco não veio do banco. Recarregue o painel.</div>;
  const r = a.reunioes, p = a.pipeline, l = a.leads;
  const fr = reunioesFrase(a), fc = coberturaFrase(a);
  const delta = l.media4 ? (l.novos7 - l.media4) / l.media4 : null;
  const semAtivPct = l.abertos_14d ? l.sem_atividade / l.abertos_14d : null;

  return (
    <>
      <div className="kg">
        <Tile label="Reuniões nos próximos 7 dias" valor={fr.valor} cls={fr.cls} sub={fr.sub} onClick={() => c.det("reunioes_futuras", { de: a.hoje, ate: r.por_dia[6]?.dia }, "Reuniões dos próximos 7 dias")} />
        <Tile label="Reuniões nos próximos 14 dias" valor={num(r.prox14, 0)} sub={`${r.hoje} hoje. Últimos 28 dias: ${r.ultimos28} na agenda`} onClick={() => c.det("reunioes_futuras", {}, "Reuniões dos próximos 14 dias")} />
        <Tile label="Cobertura do pipeline" valor={fc.valor} cls={fc.cls} sub={fc.sub} onClick={() => c.det("pipeline_aberto", { grupo: "vivo" }, "Pipeline aberto")} />
        <Tile label="Pipeline ponderado" valor={brl(p.ponderado)} sub={`valor de cada lead x a conversão histórica da etapa em que ele está`} onClick={() => c.det("pipeline_aberto", { grupo: "vivo" }, "Pipeline aberto")} />
        <Tile label="Pipeline aberto" valor={brl(p.aberto_valor)} sub={`${plural(p.aberto_n, "lead", "leads")} com valor e movimento nos últimos 90 dias`} onClick={() => c.det("pipeline_aberto", { grupo: "vivo" }, "Pipeline aberto")} />
        <Tile label="Leads novos em 7 dias" valor={num(l.novos7, 0)} cls={delta == null ? "" : delta < -0.25 ? "neg" : delta < 0 ? "warn" : "pos"}
          sub={`funis que contam. Média das 4 semanas anteriores: ${num(l.media4)}${delta != null ? ` (${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%)` : ""}. No CRM inteiro: ${l.novos7_total}`} onClick={() => c.det("leads_atencao", { tipo: "novos7" }, "Leads novos dos últimos 7 dias")} />
        <Tile label="Leads sem dono" valor={num(l.sem_dono, 0)} cls={l.sem_dono ? "warn" : ""} sub={`de ${l.abertos_14d} abertos criados nos últimos 14 dias`} onClick={() => c.det("leads_atencao", { tipo: "sem_dono" }, "Leads sem dono")} />
        <Tile label="Leads sem primeira atividade" valor={num(l.sem_atividade, 0)} cls={semAtivPct != null && semAtivPct > 0.5 ? "neg" : l.sem_atividade ? "warn" : ""} sub={`${fp(semAtivPct)} dos abertos de 14 dias: sem atividade, sem mudança de etapa por pessoa e sem mensagem enviada`} onClick={() => c.det("leads_atencao", { tipo: "sem_atividade" }, "Leads sem primeira atividade")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Reuniões na agenda, dia a dia" sub="próximos 14 dias. Clique no dia pra ver quem.">
          <BarrasItens fmt={(v) => num(v, 0)} ativo={a.hoje}
            itens={r.por_dia.map((d) => ({ k: d.dia, rot: `${diaSem(d.dia)} ${d.dia.slice(8, 10)}`, v: d.n, tip: `${dataBR(d.dia)}: ${d.n ? d.por.map((x) => `${x.nome} ${x.n}`).join(", ") : "nenhuma reunião marcada"}` }))}
            onItem={(k) => c.det("reunioes_futuras", { de: k, ate: k }, `Reuniões de ${dataBR(k)}`)} />
          <div className="note">Reunião = atividade do CRM do tipo reunião, não cancelada, pela data marcada. As últimas 4 semanas tiveram {r.semanas_passadas.map((s) => s.n).join(", ")} na agenda.</div>
        </Panel>
        <Panel titulo="Por closer" sub="clique pra ver as reuniões de cada um">
          <Tabela cols={[{ h: "Closer", tl: true }, "7 dias", "14 dias", "Últimos 28", "Por semana"]}
            onRow={(i) => c.det("reunioes_futuras", r.por_closer[i].staff_id ? { staff_id: r.por_closer[i].staff_id! } : {}, `Reuniões na agenda · ${r.por_closer[i].nome}`)}
            rows={r.por_closer.map((x) => [x.nome, num(x.prox7, 0), num(x.prox14, 0), num(x.ultimos28, 0), num(x.ultimos28 / 4)])} vazio="Nenhuma reunião na agenda nem nas últimas 4 semanas." />
          <div className="note"><Lk onClick={() => c.abrir(LINK.reunioes)} ext>Abrir Reuniões no CRM</Lk></div>
        </Panel>
      </div>

      <Panel titulo="Pipeline aberto por etapa" sub="clique na etapa pra ver os leads. Ordenado pelo valor ponderado." cls="wide">
        <Tabela cols={[{ h: "Funil", tl: true }, { h: "Etapa", tl: true }, "Leads", "Valor", "Probabilidade", { h: "De onde vem a probabilidade", tl: true }, "Ponderado"]}
          onRow={(i) => c.det("pipeline_aberto", { grupo: "vivo", stage_id: p.etapas[i].stage_id }, `Pipeline · ${p.etapas[i].funil} · ${p.etapas[i].etapa}`)}
          rows={p.etapas.map((e) => [
            e.funil, e.etapa, num(e.n, 0), brlFull(e.valor), <b className={e.prob === 0 ? "nd" : ""}>{fp(e.prob)}</b>,
            <span className="nd">{FONTE[e.fonte]}{e.amostra_n != null ? `: ${e.amostra_ganhos} ganhos de ${e.amostra_n} que entraram` : ""}</span>, <b>{brlFull(e.ponderado)}</b>,
          ])} vazio="Nenhum lead aberto com valor e movimento nos últimos 90 dias." />
        <div className="note">
          Probabilidade = dos leads que entraram na etapa nos últimos 180 dias, quantos estão ganhos hoje. Etapa com 0% é cemitério: valor grande parado ali não é pipeline.
          {p.parado.n > 0 && <> Fora daqui: {plural(p.parado.n, "lead", "leads")} com valor e sem movimento há mais de 90 dias, somando {brl(p.parado.valor)} (funis antigos importados). <Lk onClick={() => c.det("pipeline_aberto", { grupo: "parado" }, "Leads com valor parados há mais de 90 dias")}>Ver a lista</Lk>.</>}
        </div>
      </Panel>

      <div className="grid g2">
        <Panel titulo="Meta do mês e cobertura" sub={`mês corrente, ${dataBR(p.meta.mes).slice(3)}`}>
          <Tabela cols={[{ h: "Linha", tl: true }, "Valor"]} rows={[
            ["Meta de vendas do time", p.meta.meta == null ? <Nd>sem meta cadastrada</Nd> : brlFull(p.meta.meta)],
            ["Já vendido no mês", brlFull(p.vendido)],
            ["Falta", p.falta == null ? <Nd /> : brlFull(p.falta)],
            ["Pipeline ponderado", brlFull(p.ponderado)],
            ["Cobertura (ponderado / falta)", p.meta_batida ? "meta batida" : p.cobertura == null ? <Nd /> : <b className={cor(p.nivel)}>{num(p.cobertura)}x</b>],
          ]} />
          <div className="note">
            Abaixo de 1x: o pipeline de hoje não fecha a meta, precisa de lead novo. De 1 a 3x: aperto. Acima de 3x: folga.
            {p.meta.com_meta.length > 0 && <> Meta cadastrada: {p.meta.com_meta.map((x) => `${x.nome} ${brl(x.meta)}`).join(", ")}.</>}
            {p.meta.sem_meta.length > 0 && <> <b className="warn">Sem meta de vendas no CRM: {p.meta.sem_meta.map((x) => x.nome).join(", ")}.</b> O que eles vendem conta no "já vendido", mas não tem meta do lado.</>}
          </div>
        </Panel>
        <Panel titulo="Leads novos por semana" sub="funis que contam entrada. A última barra são os últimos 7 dias.">
          <BarrasItens fmt={(v) => num(v, 0)} ativo={l.semanas[l.semanas.length - 1]?.de}
            itens={l.semanas.map((s) => ({ k: s.de, rot: `${ddmm(s.de)} a ${ddmm(s.ate)}`, v: s.n }))}
            onItem={() => c.det("leads_atencao", { tipo: "novos7" }, "Leads novos dos últimos 7 dias")} />
          <div className="note">
            <St ok={l.sem_dono === 0} warn tg="todos com dono" tw={`${l.sem_dono} sem dono`} /> · <Lk onClick={() => c.det("leads_atencao", { tipo: "sem_atividade" }, "Leads sem primeira atividade")}>{l.sem_atividade} sem primeira atividade</Lk> · <Lk onClick={() => c.det("leads")}>Leads do mês</Lk>
          </div>
        </Panel>
      </div>
    </>
  );
}

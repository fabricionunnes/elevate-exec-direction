// Painel de controle do Alpha: o placar é o lucro líquido, contra o planejado.
import { useState } from "react";
import { Tile, Panel, BarrasItens, BarH, Tabela } from "@/components/painel-controle/ui";
import { brl, fp, kfmt } from "@/components/painel-controle/fmt";
import type { DadosAlpha, Resumo } from "./tipos";
import {
  MESES_CURTO, MESES_NOME, SEMAFORO_TXT, lucroReal, lucroPlano, despesaFixa, despesaTotalReal, planoDoMes, trimestres, saldosMensais,
} from "./tipos";

const cor = (v: number | null) => (v == null ? "" : v >= 0 ? "pos" : "neg");

export function PainelAlpha({ d, anterior, r, irPara }: { d: DadosAlpha; anterior: DadosAlpha | null; r: Resumo; irPara: (aba: string) => void }) {
  const [mes, setMes] = useState(Math.max(r.fechado, 1));
  const sem = SEMAFORO_TXT[r.status];
  const tris = trimestres(d);
  const saldos = saldosMensais(d);
  const m = d.dre.find((x) => x.mes === mes)!;
  const p = planoDoMes(d, mes);
  const mAnt = anterior?.dre.find((x) => x.mes === mes) ?? null;
  const metasMes = d.metas.filter((x) => x.mes === mes || x.mes == null);
  const futuro = (k: number) => k > r.fechado;
  const totalDesp = d.despesas_categoria.reduce((a, b) => a + b.valor, 0);

  return (
    <>
      <div className={`al-sem ${sem.cls}`}>
        <div className="bola" />
        <div><b>{sem.titulo}</b><p>{sem.acao}</p></div>
        <div className="num">Lucro acumulado contra o plano<strong>{r.lucroPlanoAcum ? fp(r.lucroAcum / r.lucroPlanoAcum) : "-"}</strong></div>
      </div>

      <div className="grid k6">
        <Tile main label={`Lucro líquido ${r.fechado ? `jan a ${MESES_CURTO[r.fechado - 1].toLowerCase()}` : "do ano"}`} valor={r.temDados ? brl(r.lucroAcum) : "-"} cls={cor(r.lucroAcum)}
          sub={r.temPlano ? <>plano {brl(r.lucroPlanoAcum)} · ano projetado {brl(r.projecaoLucroAno)}</> : "monte o planejamento"} onClick={() => irPara("dre")} />
        <Tile label="Faturamento" valor={r.temDados ? brl(r.receitaAcum) : "-"} sub={r.temPlano ? <>plano {brl(r.receitaPlanoAcum)} ({fp(r.receitaPlanoAcum ? r.receitaAcum / r.receitaPlanoAcum : null)})</> : undefined} onClick={() => irPara("dre")} />
        <Tile label="Crescimento x ano anterior" valor={r.crescimento == null ? "-" : fp(r.crescimento)} cls={r.crescimento == null ? "" : r.crescimento >= 0.15 ? "pos" : r.crescimento >= 0 ? "warn" : "neg"}
          sub={r.crescimento == null ? "sem o ano anterior no sistema" : `meta: 15% ou mais · antes ${brl(r.receitaAnoAnteriorMesmoPeriodo)}`} />
        <Tile label="Margem líquida" valor={r.margem == null ? "-" : fp(r.margem)} cls={cor(r.margem)} sub="lucro sobre faturamento" onClick={() => irPara("dre")} />
        <Tile label="Despesas" valor={r.temDados ? brl(r.despesaAcum) : "-"} cls={r.despesaPlanoAcum && r.despesaAcum > r.despesaPlanoAcum ? "neg" : ""}
          sub={r.temPlano ? <>orçado {brl(r.despesaPlanoAcum)}</> : undefined} onClick={() => irPara("dre")} />
        <Tile label="Caixa hoje" valor={brl(r.caixaAtual)} cls={cor(r.caixaAtual)} sub={d.plano ? `reserva alvo ${brl(d.plano.reserva_caixa_alvo)}` : "saldo inicial não informado"} onClick={() => irPara("dfc")} />
      </div>

      <div className="grid">
        <Panel titulo="Lucro líquido mês a mês" sub="barra = realizado · embaixo, o planejado">
          <BarrasItens fmt={kfmt} ativo={String(mes)} onItem={(k) => setMes(Number(k))} itens={d.dre.map((x) => {
            const pl = planoDoMes(d, x.mes);
            return {
              k: String(x.mes), rot: MESES_CURTO[x.mes - 1], v: futuro(x.mes) && !x.lancamentos ? null : lucroReal(x),
              sub: <span style={{ display: "block", color: "var(--gold)" }}>plano {pl ? kfmt(lucroPlano(pl)) : "-"}</span>,
            };
          })} />
        </Panel>
        <Panel titulo="Faturamento mês a mês" sub="barra = realizado · embaixo, o planejado">
          <BarrasItens fmt={kfmt} ativo={String(mes)} onItem={(k) => setMes(Number(k))} itens={d.dre.map((x) => {
            const pl = planoDoMes(d, x.mes);
            return {
              k: String(x.mes), rot: MESES_CURTO[x.mes - 1], v: futuro(x.mes) && !x.lancamentos ? null : x.receita,
              sub: <span style={{ display: "block", color: "var(--gold)" }}>plano {pl ? kfmt(pl.receita) : "-"}</span>,
            };
          })} />
        </Panel>
      </div>

      <Panel titulo="Participação de lucro do ano" sub="lucro de cada trimestre e o que pode ir para o seu bolso" onClick={() => irPara("participacao")} more="Abrir participação de lucro">
        <div className="al-tri">
          {tris.map((t) => (
            <div key={t.t} className={`p ${t.fechado ? "" : "aberto"}`}>
              <div className="lbl">{t.t}º trimestre · {t.fechado ? "fechado" : "em andamento"}</div>
              <div className={`v ${cor(t.lucro)}`}>{brl(t.lucro)}</div>
              <div className="sub">plano {brl(t.lucroPlano)}</div>
              <div className="sub" style={{ marginTop: 6 }}>
                {t.registro?.status === "paga" ? <span className="st g">Pago {brl(t.registro.distribuido)}</span>
                  : t.registro?.status === "aprovada" ? <span className="st a">Aprovado {brl(t.registro.distribuido)}</span>
                  : t.fechado ? <span className="st a">Sugestão {brl(t.sugestao.distribuir)}</span> : <span className="st n">Aguardando fechamento</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid r2">
        <Panel titulo={`${MESES_NOME[mes - 1]} em detalhe`} sub={futuro(mes) ? "mês ainda não fechado" : `${m.lancamentos} lançamentos`}>
          <Tabela cols={[{ h: "", tl: true }, "Realizado", "Plano", "Ano anterior"]} rows={[
            ["Faturamento", brl(m.receita), brl(p?.receita), brl(mAnt?.receita)],
            ["Impostos e deduções", brl(m.deducao), brl(p?.deducoes), brl(mAnt?.deducao)],
            ["Custo variável", brl(m.custo_variavel), brl(p?.custo_variavel), brl(mAnt?.custo_variavel)],
            ["Despesas fixas", brl(despesaFixa(m)), brl(p?.despesa_fixa), brl(mAnt ? despesaFixa(mAnt) : null)],
            ["Financeiro", brl(m.financeiro), brl(p?.financeiro), brl(mAnt?.financeiro)],
            [<b key="l">Lucro líquido</b>, <b key="a" className={cor(lucroReal(m))}>{brl(lucroReal(m))}</b>, <b key="b">{brl(p ? lucroPlano(p) : null)}</b>, brl(mAnt ? lucroReal(mAnt) : null)],
            ["Margem líquida", fp(m.receita ? lucroReal(m) / m.receita : null), fp(p?.receita ? lucroPlano(p) / p.receita : null), fp(mAnt?.receita ? lucroReal(mAnt) / mAnt.receita : null)],
            ["Caixa no fim do mês", brl(saldos.find((s) => s.mes === mes)?.final), "", ""],
          ]} />
        </Panel>
        <Panel titulo="Onde vai o dinheiro" sub={`despesas do ano por categoria · ${brl(totalDesp)}`} onClick={() => irPara("lancamentos")}>
          {d.despesas_categoria.length === 0 && <div className="empty">Sem despesas lançadas no ano.</div>}
          {d.despesas_categoria.slice(0, 9).map((c) => (
            <BarH key={c.categoria + c.grupo} nome={c.categoria} p={totalDesp ? c.valor / totalDesp : 0} v={brl(c.valor)} bad={c.grupo === "sem_categoria"} />
          ))}
        </Panel>
      </div>

      <div className="grid g2">
        <Panel titulo={`Metas de ${MESES_NOME[mes - 1].toLowerCase()}`} sub="meta, realizado e ritmo" onClick={() => irPara("metas")} more="Abrir metas">
          {(() => {
            const linhas = [
              { nome: "Faturamento", meta: p?.receita ?? 0, real: m.receita, menor: false },
              { nome: "Lucro líquido", meta: p ? lucroPlano(p) : 0, real: lucroReal(m), menor: false },
              { nome: "Teto de despesas", meta: p ? p.deducoes + p.custo_variavel + p.despesa_fixa + p.financeiro : 0, real: despesaTotalReal(m), menor: true },
              ...metasMes.map((x) => ({ nome: x.nome, meta: x.meta, real: x.realizado ?? 0, menor: false })),
            ].filter((l) => l.meta);
            if (!linhas.length) return <div className="empty">Sem metas para o mês. Monte o planejamento e cadastre as metas.</div>;
            return linhas.slice(0, 8).map((l) => {
              const pc = l.meta ? l.real / l.meta : 0;
              const ok = l.menor ? pc <= 1 : pc >= 1;
              const cls = ok ? "g" : l.menor ? "r" : pc >= 0.85 ? "a" : "r";
              return (
                <div key={l.nome} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{l.nome}</span><span>{brl(l.real)} <span className="nd">de {brl(l.meta)}</span></span></div>
                  <div className="al-prog"><i className={cls} style={{ width: `${Math.min(Math.max(pc, 0), 1) * 100}%` }} /></div>
                </div>
              );
            });
          })()}
        </Panel>
        <Panel titulo="Compromissos do mês" sub="assumidos no encontro, cobrados no próximo" onClick={() => irPara("cronograma")} more="Abrir encontros do ano">
          {(() => {
            const c = d.compromissos.filter((x) => Number(x.mes.slice(5, 7)) === mes);
            if (!c.length) return <div className="empty">Nenhum compromisso registrado para {MESES_NOME[mes - 1].toLowerCase()}.</div>;
            return c.map((x) => (
              <div key={x.id} className="al-comp"><span>{x.texto}</span><span className={`st ${x.status === "cumprido" ? "g" : x.status === "nao_cumprido" ? "r" : "n"}`}>{x.status === "cumprido" ? "Cumprido" : x.status === "nao_cumprido" ? "Não cumprido" : "Aberto"}</span><span /></div>
            ));
          })()}
        </Panel>
      </div>

      <div className="note">
        DRE por competência (data de competência ou vencimento do lançamento). Caixa por data de pagamento. Lucro líquido = faturamento − impostos − custo variável − despesas fixas − financeiro.
        Investimentos e retiradas de lucro aparecem no fluxo de caixa, abaixo do lucro. Fonte: {d.fonte.receber + d.fonte.pagar} lançamentos do financeiro da empresa
        {d.fonte.categorias_sem_grupo ? `, ${d.fonte.categorias_sem_grupo} categorias ainda sem grupo do DRE` : ""}.
      </div>
    </>
  );
}

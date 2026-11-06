// DRE gerencial do Alpha por competência, mês a mês, com o planejado do ano ao lado.
import { Panel } from "@/components/painel-controle/ui";
import { brl, fp, kfmt } from "@/components/painel-controle/fmt";
import type { DadosAlpha, DreMes } from "./tipos";
import { MESES_CURTO, lucroReal, lucroPlano, despesaFixa, soma, ultimoMesFechado } from "./tipos";

type Linha = { nome: string; fn: (m: DreMes) => number; plano?: number | null; forte?: boolean; lucro?: boolean; pctRec?: boolean; neg?: boolean };

export function DreAlpha({ d }: { d: DadosAlpha }) {
  const fechado = ultimoMesFechado(d.ano);
  const pl = (k: "receita" | "deducoes" | "custo_variavel" | "despesa_fixa" | "financeiro") => soma(d.plano_meses.map((p) => p[k]));
  const recLiq = (m: DreMes) => m.receita - m.deducao;
  const margemC = (m: DreMes) => recLiq(m) - m.custo_variavel;
  const operacional = (m: DreMes) => margemC(m) - despesaFixa(m);
  const linhas: Linha[] = [
    { nome: "Faturamento bruto", fn: (m) => m.receita, plano: pl("receita"), forte: true },
    { nome: "(−) Impostos e deduções", fn: (m) => m.deducao, plano: pl("deducoes"), neg: true },
    { nome: "Receita líquida", fn: recLiq, plano: pl("receita") - pl("deducoes"), forte: true },
    { nome: "(−) Custo variável", fn: (m) => m.custo_variavel, plano: pl("custo_variavel"), neg: true },
    { nome: "Margem de contribuição", fn: margemC, plano: pl("receita") - pl("deducoes") - pl("custo_variavel"), forte: true },
    { nome: "(−) Pessoal", fn: (m) => m.pessoal, neg: true },
    { nome: "(−) Administrativas", fn: (m) => m.administrativa, neg: true },
    { nome: "(−) Comercial e marketing", fn: (m) => m.comercial, neg: true },
    { nome: "(−) Sem categoria", fn: (m) => m.sem_categoria, neg: true },
    { nome: "Despesas fixas (total)", fn: despesaFixa, plano: pl("despesa_fixa") },
    { nome: "Resultado operacional", fn: operacional, plano: soma(d.plano_meses.map((p) => p.receita - p.deducoes - p.custo_variavel - p.despesa_fixa)), forte: true },
    { nome: "(−) Financeiro", fn: (m) => m.financeiro, plano: pl("financeiro"), neg: true },
    { nome: "Lucro líquido", fn: lucroReal, plano: soma(d.plano_meses.map(lucroPlano)), lucro: true },
    { nome: "Margem líquida", fn: (m) => (m.receita ? lucroReal(m) / m.receita : 0), pctRec: true },
  ];
  const total = (l: Linha) => (l.pctRec ? (() => { const r = soma(d.dre.map((m) => m.receita)); return r ? soma(d.dre.map(lucroReal)) / r : 0; })() : soma(d.dre.map(l.fn)));
  const rec = soma(d.dre.map((m) => m.receita));

  return (
    <>
      <Panel titulo={`DRE ${d.ano}`} sub="regime de competência · valores dos meses em milhares (k) · meses ainda não fechados aparecem apagados" cls="wide">
        <div className="tw">
          <table className="al-grade">
            <thead><tr><th className="tl">Linha</th>{MESES_CURTO.map((m) => <th key={m}>{m}</th>)}<th>Ano</th><th>% fat.</th><th>Plano</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className={l.lucro ? "lucro" : l.forte ? "forte" : ""}>
                  <td className="tl">{l.nome}</td>
                  {d.dre.map((m) => (
                    <td key={m.mes} className={m.mes > fechado ? "fut" : ""}>{l.pctRec ? fp(l.fn(m)) : kfmt(l.fn(m))}</td>
                  ))}
                  <td>{l.pctRec ? fp(total(l)) : brl(total(l))}</td>
                  <td>{l.pctRec ? "" : fp(rec ? total(l) / rec : null)}</td>
                  <td>{l.plano == null ? "" : brl(l.plano)}</td>
                </tr>
              ))}
              <tr><td className="tl nd">Abaixo do lucro: investimentos</td>{d.dre.map((m) => <td key={m.mes} className="nd">{kfmt(m.investimento)}</td>)}<td className="nd">{brl(soma(d.dre.map((m) => m.investimento)))}</td><td /><td /></tr>
              <tr><td className="tl nd">Abaixo do lucro: retiradas e participação</td>{d.dre.map((m) => <td key={m.mes} className="nd">{kfmt(m.retirada)}</td>)}<td className="nd">{brl(soma(d.dre.map((m) => m.retirada)))}</td><td /><td /></tr>
            </tbody>
          </table>
        </div>
        <div className="note">Categorias sem grupo do DRE entram em "Sem categoria". Ajuste o grupo de cada categoria na aba Lançamentos para o DRE ficar exato.</div>
      </Panel>
    </>
  );
}

// Fluxo de caixa (DFC) do Alpha: o que entrou e saiu de verdade, por data de pagamento.
import { Panel, BarrasItens } from "@/components/painel-controle/ui";
import { brl, kfmt } from "@/components/painel-controle/fmt";
import type { DadosAlpha } from "./tipos";
import { MESES_CURTO, saldosMensais, soma, ultimoMesFechado } from "./tipos";

export function DfcAlpha({ d }: { d: DadosAlpha }) {
  const fechado = ultimoMesFechado(d.ano);
  const saldos = saldosMensais(d);
  const gera = (k: number) => {
    const f = d.dfc[k];
    return f.entradas - f.saidas_operacionais - f.saidas_financeiras - f.investimentos - f.retiradas;
  };
  const linhas: { nome: string; v: (i: number) => number; forte?: boolean; nd?: boolean }[] = [
    { nome: "Saldo inicial", v: (i) => saldos[i].inicial, forte: true },
    { nome: "(+) Recebimentos", v: (i) => d.dfc[i].entradas },
    { nome: "(−) Pagamentos operacionais", v: (i) => d.dfc[i].saidas_operacionais },
    { nome: "(−) Juros e tarifas", v: (i) => d.dfc[i].saidas_financeiras },
    { nome: "(−) Investimentos", v: (i) => d.dfc[i].investimentos },
    { nome: "(−) Retiradas e participação de lucro", v: (i) => d.dfc[i].retiradas },
    { nome: "Geração de caixa do mês", v: gera, forte: true },
    { nome: "Saldo final", v: (i) => saldos[i].final, forte: true },
    { nome: "Em aberto: a receber", v: (i) => d.dfc[i].a_receber, nd: true },
    { nome: "Em aberto: a pagar", v: (i) => d.dfc[i].a_pagar, nd: true },
  ];
  const somaAno = (nome: string, i: (k: number) => number) =>
    nome === "Saldo inicial" ? saldos[0].inicial : nome === "Saldo final" ? saldos[11].final : soma(d.dfc.map((_, k) => i(k)));

  return (
    <>
      <Panel titulo="Saldo de caixa no fim de cada mês" sub={d.plano ? `começa em ${brl(d.plano.saldo_caixa_inicial)} · reserva alvo ${brl(d.plano.reserva_caixa_alvo)}` : "informe o saldo de 1º de janeiro no Planejamento"}>
        <BarrasItens fmt={brl} itens={saldos.map((s) => ({ k: String(s.mes), rot: MESES_CURTO[s.mes - 1], v: s.mes > fechado && !d.dfc[s.mes - 1].entradas ? null : s.final }))} />
      </Panel>
      <Panel titulo={`Fluxo de caixa ${d.ano}`} sub="regime de caixa: data do pagamento · meses em milhares (k)" cls="wide">
        <div className="tw">
          <table className="al-grade">
            <thead><tr><th className="tl">Linha</th>{MESES_CURTO.map((m) => <th key={m}>{m}</th>)}<th>Ano</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className={l.forte ? "forte" : ""}>
                  <td className={`tl ${l.nd ? "nd" : ""}`}>{l.nome}</td>
                  {d.dfc.map((f, i) => <td key={f.mes} className={l.nd ? "nd" : f.mes > fechado ? "fut" : ""}>{kfmt(l.v(i))}</td>)}
                  <td className={l.nd ? "nd" : ""}>{brl(somaAno(l.nome, l.v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note">Lucro é diferente de caixa: venda a prazo entra no DRE no mês da competência e no caixa quando é paga. Os dois juntos mostram se o lucro está virando dinheiro.</div>
      </Panel>
    </>
  );
}

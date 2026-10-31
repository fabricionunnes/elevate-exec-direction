// O caixa da empresa: lucro previsto contra realizado mês a mês, quanto de
// dinheiro sobra acumulado, e as duas linhas que saem todo mês sem falhar —
// reserva de emergência e doações.
//
// Tudo é calculado aqui a partir das linhas do plano e do realizado que a RPC
// já trouxe: assim qualquer edição do planejado reflete na hora, igual à grade.
import { useMemo } from "react";
import { brl, fp } from "@/components/painel-controle/fmt";
import { Panel, Tile } from "@/components/painel-controle/ui";
import { planejadoDe, realizadoDa, receitaPlanejadaMes } from "./Grade";
import type { Linha, Realizado } from "./tipos";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function SaudeEmpresa({ linhas, realizado, ano, caixaInicial }: {
  linhas: Linha[];
  realizado: Realizado;
  ano: number;
  caixaInicial: number;
}) {
  const hoje = new Date();
  // meses já encerrados: é só contra eles que o realizado pode ser medido
  const fechados = ano < hoje.getFullYear() ? 12 : ano > hoje.getFullYear() ? 0 : hoje.getMonth();

  const d = useMemo(() => {
    const recMes = receitaPlanejadaMes(linhas);
    const soma = (grupo: string, i: number) =>
      linhas.filter((l) => l.grupo === grupo).reduce((a, l) => a + planejadoDe(l, recMes)[i], 0);
    const somaReal = (grupo: string, i: number) => {
      const vs = linhas.filter((l) => l.grupo === grupo && l.fonte)
        .map((l) => realizadoDa(l, realizado)[i]).filter((v): v is number => v != null);
      return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
    };
    const linhaPor = (nome: string, i: number) => {
      const l = linhas.find((x) => x.linha.toLowerCase().includes(nome));
      return l ? planejadoDe(l, recMes)[i] : 0;
    };

    const m = Array.from({ length: 12 }, (_, i) => {
      const recP = soma("receita", i), cusP = soma("custo", i), resP = soma("reserva", i);
      const recR = somaReal("receita", i), cusR = somaReal("custo", i);
      const temR = i < fechados && (recR != null || cusR != null);
      return {
        i,
        lucroP: recP - cusP - resP,
        lucroR: temR ? (recR ?? 0) - (cusR ?? 0) : null,
        reserva: resP,
        doacao: linhaPor("filantropia", i),
        distribuicao: soma("distribuicao", i),
      };
    });

    // o acúmulo usa o realizado enquanto existe e o plano daí para a frente
    let caixa = caixaInicial, reservaAc = 0, doacaoAc = 0;
    const acum = m.map((x) => {
      const lucro = x.lucroR ?? x.lucroP;
      caixa += lucro - x.distribuicao;
      reservaAc += x.reserva;
      doacaoAc += x.doacao;
      return { ...x, caixa, reservaAc, doacaoAc, total: caixa + reservaAc };
    });

    const lucroPAno = m.reduce((a, x) => a + x.lucroP, 0);
    const lucroRAte = m.slice(0, fechados).reduce((a, x) => a + (x.lucroR ?? 0), 0);
    const lucroPAte = m.slice(0, fechados).reduce((a, x) => a + x.lucroP, 0);
    const fim = acum[11];
    // quantos meses de custo fixo o caixa do fim do ano cobre
    const fixoMes = linhas.filter((l) => ["Administrativas"].includes(l.linha))
      .reduce((a, l) => a + (Number(l.valores[11]) || 0), 0) + 27680;
    return { m: acum, lucroPAno, lucroRAte, lucroPAte, fim, fixoMes, temRealizado: fechados > 0 && lucroRAte !== 0 };
  }, [linhas, realizado, caixaInicial, fechados]);

  const maxCaixa = Math.max(...d.m.map((x) => Math.max(x.total, 0)), 1);

  return (
    <>
      <div className="grid k5">
        <Tile
          main
          label={`Resultado planejado ${ano}`}
          valor={brl(d.lucroPAno)}
          sub={d.temRealizado
            ? <>realizado {brl(d.lucroRAte)} · {fp(d.lucroPAte ? d.lucroRAte / d.lucroPAte : null)} do esperado até aqui</>
            : "depois das reservas; ainda sem nada lançado neste ano"}
        />
        <Tile
          label="Caixa no fim do ano"
          valor={brl(d.fim.caixa)}
          sub={<>parte de {brl(caixaInicial)} em janeiro, só o caixa livre</>}
          cls={d.fim.caixa < 0 ? "neg" : "pos"}
        />
        <Tile
          label="Reserva acumulada"
          valor={brl(d.fim.reservaAc)}
          sub={<>cobre {(d.fim.reservaAc / d.fixoMes).toFixed(1).replace(".", ",")} mês de custo fixo</>}
        />
        <Tile label="Doações no ano" valor={brl(d.fim.doacaoAc)} sub="1% da receita, todo mês" />
        <Tile
          label="Caixa mais reserva"
          valor={brl(d.fim.total)}
          sub={<>{(d.fim.total / d.fixoMes).toFixed(1).replace(".", ",")} meses de custo fixo</>}
        />
      </div>

      <Panel titulo="Acúmulo de caixa mês a mês" sub="caixa livre e reserva, empilhados">
        <div className="pl-bars">
          {d.m.map((x) => {
            const hC = Math.max((Math.max(x.caixa, 0) / maxCaixa) * 100, 0.5);
            const hR = (x.reservaAc / maxCaixa) * 100;
            return (
              <div key={x.i} className="pl-bc" title={`${MES[x.i]}: caixa ${brl(x.caixa)} + reserva ${brl(x.reservaAc)}`}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ height: `${hR}%`, background: "var(--good)", borderRadius: "4px 4px 0 0", minHeight: 2 }} />
                  <div style={{ height: `${hC}%`, background: x.caixa < 0 ? "var(--bad)" : "var(--bar)" }} />
                </div>
                <small><b>{MES[x.i]}</b>{brl(x.total)}</small>
              </div>
            );
          })}
        </div>
        <div className="pl-leg">
          <span><i style={{ background: "var(--bar)" }} />caixa livre</span>
          <span><i style={{ background: "var(--good)" }} />reserva de emergência</span>
          <span><i style={{ background: "var(--bad)" }} />caixa negativo</span>
        </div>
      </Panel>

      <Panel titulo="Mês a mês" sub="previsto contra realizado, e para onde o dinheiro vai">
        <div className="pl-rolagem">
          <table className="pl-grade">
            <thead>
              <tr>
                <th className="nome">Mês</th>
                <th>Lucro previsto</th>
                <th>Lucro realizado</th>
                <th>Diferença</th>
                <th>Reserva</th>
                <th>Doação</th>
                <th>Sai para o sócio</th>
                <th className="tot">Caixa acumulado</th>
              </tr>
            </thead>
            <tbody>
              {d.m.map((x) => {
                const dif = x.lucroR == null ? null : x.lucroR - x.lucroP;
                return (
                  <tr key={x.i}>
                    <td className="nome"><b>{MES[x.i]}</b></td>
                    <td>{brl(x.lucroP)}</td>
                    <td>{x.lucroR == null ? <span className="nd">-</span> : brl(x.lucroR)}</td>
                    <td>{dif == null ? <span className="nd">-</span> : <span className={dif >= 0 ? "pos" : "neg"}>{brl(dif)}</span>}</td>
                    <td>{brl(x.reserva)}</td>
                    <td>{brl(x.doacao)}</td>
                    <td>{x.distribuicao ? brl(x.distribuicao) : <span className="nd">-</span>}</td>
                    <td className="tot">
                      {brl(x.caixa)}
                      <span className="pl-rz">+{brl(x.reservaAc)} de reserva</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-aviso">
          <b>Como o acúmulo é calculado:</b> parte do caixa de {brl(caixaInicial)} e soma o lucro de cada mês,
          descontando o que sai para o sócio em abril, julho e outubro. Enquanto o mês não fecha, usa o previsto;
          depois que fecha, passa a usar o realizado. A reserva de emergência sai do caixa livre mas continua
          sendo dinheiro da empresa, por isso aparece na coluna à parte e não some da conta.
          <br />
          <b>A doação</b> é 1% da receita do mês e é despesa: já está descontada do lucro, não some do caixa duas vezes.
          <br />
          <b>Uma ressalva honesta:</b> esta projeção trata todo lucro como caixa no mesmo mês. Na prática há
          descasamento — fatura que atrasa, inadimplência, imposto que vence depois. O número serve para enxergar
          a tendência e decidir a distribuição, não para programar pagamento em data certa. Para isso existe a
          projeção de 13 semanas no Painel de Controle, que lê fatura por fatura.
        </div>
      </Panel>
    </>
  );
}

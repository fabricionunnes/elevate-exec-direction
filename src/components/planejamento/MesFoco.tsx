// Um mês só, linha por linha. A grade do ano inteiro tem doze colunas e serve
// para enxergar tendência; esta tela serve para a outra pergunta, que é "como
// foi este mês", e por isso troca colunas de mês por colunas de comparação:
// planejado, realizado, diferença e quanto do plano saiu.
import { useMemo } from "react";
import { brl, fp, num } from "@/components/painel-controle/fmt";
import { GRUPOS, type Linha, type Realizado } from "./tipos";
import { planejadoDe, realizadoDa, receitaPlanejadaMes } from "./Grade";

const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
             "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function MesFoco({ linhas, realizado, mes, fechado }: {
  linhas: Linha[];
  realizado: Realizado;
  /** 0 a 11 */
  mes: number;
  /** o mês já encerrou: só aí faz sentido cornar o realizado de incompleto */
  fechado: boolean;
}) {
  const d = useMemo(() => {
    const recMes = receitaPlanejadaMes(linhas);
    const itens = linhas.map((l) => {
      const p = planejadoDe(l, recMes)[mes];
      const r = l.fonte ? realizadoDa(l, realizado)[mes] : null;
      return { l, p, r, dif: r == null ? null : r - p };
    });
    const soma = (g: string, campo: "p" | "r") =>
      itens.filter((x) => x.l.grupo === g)
        .reduce((a, x) => a + (campo === "p" ? x.p : (x.r ?? 0)), 0);
    const temR = (g: string) => itens.some((x) => x.l.grupo === g && x.r != null);

    const recP = soma("receita", "p"), cusP = soma("custo", "p"), resP = soma("reserva", "p");
    const recR = soma("receita", "r"), cusR = soma("custo", "r");
    return {
      itens, recP, cusP, resP, recR, cusR,
      lucroP: recP - cusP - resP,
      lucroR: temR("receita") || temR("custo") ? recR - cusR : null,
      temAlgum: temR("receita") || temR("custo"),
    };
  }, [linhas, realizado, mes]);

  const fmt = (l: Linha, v: number | null) =>
    v == null ? "-" : l.unidade === "qtd" ? num(v) : l.unidade === "pct" ? fp(v / 100) : brl(v);

  return (
    <>
      <div className="pl-mf-topo">
        <div>
          <b>Receita</b>
          <span>{brl(d.recP)}</span>
          <small>{d.temAlgum ? <>realizado {brl(d.recR)} · {fp(d.recP ? d.recR / d.recP : null)} do plano</> : "nada lançado ainda"}</small>
        </div>
        <div>
          <b>Custos</b>
          <span>{brl(d.cusP)}</span>
          <small>{d.temAlgum ? <>realizado {brl(d.cusR)} · {fp(d.cusP ? d.cusR / d.cusP : null)} do plano</> : "nada baixado ainda"}</small>
        </div>
        <div>
          <b>Resultado</b>
          <span className={d.lucroP >= 0 ? "pos" : "neg"}>{brl(d.lucroP)}</span>
          <small>
            {d.lucroR == null ? "depois das reservas"
              : <>realizado <b className={d.lucroR >= 0 ? "pos" : "neg"}>{brl(d.lucroR)}</b></>}
          </small>
        </div>
      </div>

      <div className="pl-rolagem">
        <table className="pl-grade">
          <thead>
            <tr>
              <th className="nome">Linha</th>
              <th>Planejado</th>
              <th>Realizado</th>
              <th>Diferença</th>
              <th className="tot">Do plano</th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((g) => {
              const doGrupo = d.itens.filter((x) => x.l.grupo === g.k);
              if (!doGrupo.length) return null;
              const tp = doGrupo.reduce((a, x) => a + x.p, 0);
              const tr = doGrupo.some((x) => x.r != null)
                ? doGrupo.reduce((a, x) => a + (x.r ?? 0), 0) : null;
              // em custo, gastar menos que o plano é bom: o sinal da cor inverte
              const bom = (v: number) => (g.sinal === -1 ? -v : v) >= 0;
              return (
                <tbody key={g.k}>
                  <tr className="gr"><td className="nome" colSpan={5}>{g.nome}</td></tr>
                  {doGrupo.map((x) => (
                    <tr key={x.l.id}>
                      <td className="nome" title={x.l.observacao ?? undefined}>
                        {x.l.observacao ? <u>{x.l.linha}</u> : x.l.linha}
                      </td>
                      <td>{fmt(x.l, x.p)}</td>
                      <td>{x.r == null ? <span className="nd">-</span> : fmt(x.l, x.r)}</td>
                      <td>
                        {x.dif == null ? <span className="nd">-</span>
                          : <span className={g.sinal === 0 ? undefined : bom(x.dif) ? "pos" : "neg"}>
                              {x.dif >= 0 ? "+" : ""}{fmt(x.l, x.dif)}
                            </span>}
                      </td>
                      <td className="tot">{x.r == null || !x.p ? <span className="nd">-</span> : fp(x.r / x.p)}</td>
                    </tr>
                  ))}
                  <tr className="tt">
                    <td className="nome"><b>Total de {g.nome.toLowerCase()}</b></td>
                    <td><b>{brl(tp)}</b></td>
                    <td><b>{tr == null ? <span className="nd">-</span> : brl(tr)}</b></td>
                    <td>
                      {tr == null ? <span className="nd">-</span>
                        : <b className={g.sinal === 0 ? undefined : bom(tr - tp) ? "pos" : "neg"}>
                            {tr - tp >= 0 ? "+" : ""}{brl(tr - tp)}
                          </b>}
                    </td>
                    <td className="tot"><b>{tr == null || !tp ? <span className="nd">-</span> : fp(tr / tp)}</b></td>
                  </tr>
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pl-aviso">
        {fechado
          ? <>O mês de <b>{MES[mes]}</b> já fechou, então o realizado aqui é o número final.</>
          : <>O mês de <b>{MES[mes]}</b> ainda não fechou: o realizado é parcial e vai subir até o último dia. Comparar com o plano cheio agora dá uma leitura pessimista de propósito.</>}
        {" "}Linha sublinhada tem premissa escrita, que aparece ao passar o mouse. Em custo e reserva, gastar menos que
        o planejado conta como positivo, por isso a cor da diferença é invertida nesses grupos.
      </div>
    </>
  );
}

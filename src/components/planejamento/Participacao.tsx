// Painel da participação nos lucros do sócio: o que cada trimestre libera, por
// que libera, e quanto já está garantido. A regra é do Fabrício (31/10/2026):
// tirar lucro a cada três meses, só se bater meta.
import { useMemo } from "react";
import { brl, fp, num } from "@/components/painel-controle/fmt";
import { Panel, Tile } from "@/components/painel-controle/ui";

export type Trimestre = {
  trimestre: number;
  rotulo: string;
  paga_em: string;
  lucro_planejado: number;
  lucro_realizado: number;
  reserva: number;
  atingido: number | null;
  percentual: number | null;
  situacao: "liberado" | "parcial" | "bloqueado" | "sem_plano";
  valor_planejado: number;
  valor_realizado: number | null;
};

export type SocioConfig = {
  ano: number;
  percentual: number;
  piso_cheio_pct: number;
  piso_parcial_pct: number;
  caixa_minimo_meses: number;
  custo_fixo_mes: number;
  observacao: string | null;
};

const SITUACAO: Record<string, { rot: string; cls: string }> = {
  liberado: { rot: "Libera cheio", cls: "pos" },
  parcial: { rot: "Libera metade", cls: "warn" },
  bloqueado: { rot: "Não libera", cls: "neg" },
  sem_plano: { rot: "sem plano", cls: "nd" },
};

export function Participacao({ config, trimestres, ano, proLabore }: {
  config: SocioConfig;
  trimestres: Trimestre[];
  /** ano exibido: define o que já fechou */
  ano: number;
  /** pró-labore anual, para mostrar o total que sai para o sócio */
  proLabore: number;
}) {
  const hoje = new Date();
  // ano futuro não fechou nada; ano passado fechou tudo; o corrente vai pelo mês
  const fechou = (tri: number) =>
    ano < hoje.getFullYear() ? true
      : ano > hoje.getFullYear() ? false
      : hoje.getMonth() + 1 > tri * 3;
  const t = useMemo(() => {
    const planoAno = trimestres.reduce((a, x) => a + Number(x.valor_planejado || 0), 0);
    // o 4º trimestre só é pago em janeiro do ano seguinte
    const caixaNoAno = trimestres.slice(0, 3).reduce((a, x) => a + Number(x.valor_planejado || 0), 0);
    const fechados = trimestres.filter((x) => fechou(x.trimestre));
    const realAte = fechados.reduce((a, x) => a + Number(x.valor_realizado || 0), 0);
    const planAte = fechados.reduce((a, x) => a + Number(x.valor_planejado || 0), 0);
    return { planoAno, caixaNoAno, realAte, planAte, fechados: fechados.length };
  }, [trimestres, ano]);

  return (
    <>
      <div className="grid k5">
        <Tile
          main
          label="Participação planejada no ano"
          valor={brl(t.planoAno)}
          sub={<>{num(config.percentual, 0)}% do lucro de cada trimestre</>}
        />
        <Tile
          label="Sai do caixa em 2027"
          valor={brl(t.caixaNoAno)}
          sub="o 4º trimestre só é pago em janeiro"
        />
        <Tile
          label="Já liberado"
          valor={t.fechados ? brl(t.realAte) : "-"}
          sub={t.fechados
            ? <>{t.fechados} {t.fechados === 1 ? "trimestre fechado" : "trimestres fechados"} · plano era {brl(t.planAte)}</>
            : "nenhum trimestre fechou ainda"}
          cls={t.fechados ? (t.realAte >= t.planAte ? "pos" : "neg") : undefined}
        />
        <Tile label="Pró-labore no ano" valor={brl(proLabore)} sub="mensal, fora da participação" />
        <Tile
          label="Total para o sócio"
          valor={brl(proLabore + t.planoAno)}
          sub="pró-labore mais participação planejada"
        />
      </div>

      <Panel titulo="Trimestre a trimestre" sub="apuração fechada, pagamento no mês seguinte">
        <table className="pl-grade">
          <thead>
            <tr>
              <th className="nome">Trimestre</th>
              <th>Lucro planejado</th>
              <th>Lucro realizado</th>
              <th>Entregue</th>
              <th>Libera</th>
              <th className="tot">A distribuir</th>
            </tr>
          </thead>
          <tbody>
            {trimestres.map((x) => {
              const st = SITUACAO[x.situacao] ?? SITUACAO.sem_plano;
              const fechado = fechou(x.trimestre);
              return (
                <tr key={x.trimestre}>
                  <td className="nome">
                    <b>{x.rotulo}</b>
                    <small>paga em {x.paga_em}</small>
                  </td>
                  <td>{brl(x.lucro_planejado)}</td>
                  <td>{fechado ? brl(x.lucro_realizado) : <span className="nd">-</span>}</td>
                  <td>{fechado && x.atingido != null ? <span className={x.atingido >= 0.9 ? "pos" : x.atingido >= 0.7 ? "warn" : "neg"}>{fp(x.atingido)}</span> : <span className="nd">-</span>}</td>
                  <td>{fechado ? <span className={st.cls}>{st.rot}</span> : <span className="nd">{ano > hoje.getFullYear() ? "ainda não começou" : "aguarda fechar"}</span>}</td>
                  <td className="tot">
                    {brl(x.valor_planejado)}
                    {fechado && <span className="pl-rz">{brl(x.valor_realizado)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pl-aviso">
          Em cima o planejado; embaixo, no trimestre já fechado, o que a regra de fato libera.
        </div>
      </Panel>

      <Panel titulo="A regra" sub="as três travas precisam bater juntas">
        <div className="pl-regra">
          <div>
            <b>1. Entrega do lucro</b>
            <p>
              Acima de {num(config.piso_cheio_pct, 0)}% do lucro planejado do trimestre, libera os {num(config.percentual, 0)}% cheios.
              Entre {num(config.piso_parcial_pct, 0)}% e {num(config.piso_cheio_pct, 0)}%, libera metade disso.
              Abaixo de {num(config.piso_parcial_pct, 0)}%, não distribui e o trimestre acumula para o seguinte.
            </p>
          </div>
          <div>
            <b>2. Imposto em dia</b>
            <p>
              Parcelamento do Simples sem atraso e provisão do mês corrente separada.
              Enquanto houver parcela vencida, não sai distribuição: é o erro de 2026 que não se repete.
            </p>
          </div>
          <div>
            <b>3. Caixa que sobra</b>
            <p>
              Depois da retirada, o caixa precisa ficar acima de {num(config.caixa_minimo_meses, 0)} mês de custo fixo,
              hoje {brl(config.custo_fixo_mes)}. A reserva de emergência não conta para esse piso: ela é intocável.
            </p>
          </div>
        </div>
        <div className="pl-aviso">
          <b>Por que trimestral e não mensal:</b> um mês ruim não deve travar a retirada, e um mês bom não deve
          antecipar dinheiro que o trimestre ainda pode perder. Três meses é o menor período em que o churn e a
          sazonalidade do evento já apareceram no número.
          <br />
          <b>Por que como lucro e não como pró-labore:</b> distribuição de lucro no Simples é isenta de imposto de
          renda na pessoa física. Os mesmos {brl(t.planoAno)} saindo como pró-labore custariam cerca de{" "}
          {brl(t.planoAno * 0.275)} a mais de imposto.
        </div>
      </Panel>
    </>
  );
}

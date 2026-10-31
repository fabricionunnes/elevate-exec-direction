// Receita e despesa lado a lado no mesmo mês, com o que sobrou embaixo. As duas
// barras do mesmo mês dividem a mesma escala, então a diferença entre elas é
// legível sem ler número. O realizado manda; enquanto o mês não fecha, mostra o
// planejado em tom apagado para a linha não sumir do gráfico.
import { brl } from "@/components/painel-controle/fmt";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function CruzaReceitaDespesa({ recP, recR, cusP, cusR, meses }: {
  recP: number[];
  recR: (number | null)[];
  cusP: number[];
  cusR: (number | null)[];
  /** índices dos meses que o ano mostra, para o ano que não começa em janeiro */
  meses: number[];
}) {
  const linha = meses.map((i) => {
    const r = recR[i] ?? null;
    const c = cusR[i] ?? null;
    const temReal = r != null || c != null;
    return {
      i,
      receita: temReal ? (r ?? 0) : recP[i],
      despesa: temReal ? (c ?? 0) : cusP[i],
      previsto: !temReal,
    };
  });

  const teto = Math.max(...linha.flatMap((m) => [m.receita, m.despesa]), 1);
  const sobra = linha.reduce((a, m) => a + (m.receita - m.despesa), 0);

  return (
    <>
      <div className="pl-cd">
        {linha.map((m) => {
          const res = m.receita - m.despesa;
          return (
            <div
              key={m.i}
              className={`pl-cdm ${m.previsto ? "prev" : ""}`}
              title={`${MES[m.i]}: receita ${brl(m.receita)}, despesa ${brl(m.despesa)}, ${res >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(res))}${m.previsto ? " (ainda planejado)" : ""}`}
            >
              <div className="par">
                <i className="rec" style={{ height: `${Math.max((m.receita / teto) * 100, 1)}%` }} />
                <i className="des" style={{ height: `${Math.max((m.despesa / teto) * 100, 1)}%` }} />
              </div>
              <small>
                <b>{MES[m.i]}</b>
                <span className={res >= 0 ? "pos" : "neg"}>{res >= 0 ? "+" : "−"}{brl(Math.abs(res))}</span>
              </small>
            </div>
          );
        })}
      </div>
      <div className="pl-leg">
        <span><i style={{ background: "var(--bar)" }} />receita</span>
        <span><i style={{ background: "var(--bad)" }} />despesa</span>
        <span>mês mais claro ainda não fechou, está mostrando o planejado</span>
        <span style={{ marginLeft: "auto" }}>
          no ano, {sobra >= 0 ? "sobram" : "faltam"}{" "}
          <b className={sobra >= 0 ? "pos" : "neg"}>{brl(Math.abs(sobra))}</b>
        </span>
      </div>
    </>
  );
}

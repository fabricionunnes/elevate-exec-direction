// Planejado é a moldura tracejada, realizado é o preenchimento. Dá pra ver num
// relance o mês que ficou curto sem precisar ler número nenhum.
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function BarrasPlano({ plan, real, fmt, bomSubir = true, onMes, ativo }: {
  plan: number[];
  real: (number | null)[];
  fmt: (v: number | null) => string;
  /** receita: passar do planejado é bom. Custo: é ruim. */
  bomSubir?: boolean;
  onMes?: (i: number) => void;
  ativo?: number;
}) {
  const teto = Math.max(...plan, ...real.map((v) => v ?? 0), 1);
  return (
    <>
      <div className="pl-bars">
        {plan.map((p, i) => {
          const r = real[i];
          const altP = Math.max((p / teto) * 100, 1);
          const altR = r == null ? 0 : Math.max((r / teto) * 100, 1);
          const cls = r == null ? "" : (r - p) * (bomSubir ? 1 : -1) >= 0 ? "ok" : "ruim";
          return (
            <button
              key={i}
              type="button"
              className={`pl-bc ${ativo === i ? "on" : ""}`}
              onClick={() => onMes?.(i)}
              title={`${MES[i]}: planejado ${fmt(p)}, realizado ${fmt(r)}`}
            >
              <div className="pil" style={{ height: `${altP}%` }}>
                <i className={cls} style={{ height: `${Math.min((altR / altP) * 100, 100)}%` }} />
              </div>
              <small><b>{MES[i]}</b>{fmt(r ?? p)}</small>
            </button>
          );
        })}
      </div>
      <div className="pl-leg">
        <span><i className="plan" />planejado</span>
        <span><i style={{ background: "var(--good)" }} />realizado no ou acima do plano</span>
        <span><i style={{ background: "var(--bad)" }} />abaixo do plano</span>
      </div>
    </>
  );
}

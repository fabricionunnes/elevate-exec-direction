// Grade de 12 meses do Planejamento: planejado editável em cima, realizado do
// sistema embaixo. Toda conta é feita aqui, no estado, pra que editar um valor
// mexa no total e no resultado na hora, sem ida ao banco.
import { Fragment, useMemo } from "react";
import { brl, kfmt, num } from "@/components/painel-controle/fmt";
import { GRUPOS, type Linha, type Realizado, type Unidade } from "./tipos";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type Visao = "ambos" | "planejado" | "realizado";

export const soma = (v: number[]) => v.reduce((a, b) => a + (Number(b) || 0), 0);

/** Realizado de uma linha, mês a mês. Mês sem lançamento vem nulo, não zero. */
export function realizadoDa(l: Linha, rz: Realizado): (number | null)[] {
  const f = l.fonte ? rz[l.fonte] : undefined;
  return Array.from({ length: 12 }, (_, i) => {
    if (!f) return null;
    const v = f[String(i + 1)];
    return v == null ? null : Number(v);
  });
}

const fmtPor = (u: Unidade) => (v: number | null) =>
  v == null ? "-" : u === "brl" ? brl(v) : u === "pct" ? `${num(v)}%` : num(v, 0);

const fmtCurto = (u: Unidade) => (v: number | null) =>
  v == null ? "-" : u === "brl" ? kfmt(v) : num(v, 0);

export function Grade({ linhas, realizado, visao, editando, mesAtual, anoCorrente, onValor, onDetalhe }: {
  linhas: Linha[];
  realizado: Realizado;
  visao: Visao;
  editando: boolean;
  /** 0 a 11; -1 quando o ano exibido não é o corrente */
  mesAtual: number;
  anoCorrente: boolean;
  onValor: (id: string, mes: number, valor: number) => void;
  onDetalhe: (l: Linha) => void;
}) {
  const porGrupo = useMemo(() => GRUPOS.map((g) => ({
    ...g,
    itens: linhas.filter((l) => l.grupo === g.k).sort((a, b) => a.ordem - b.ordem || a.linha.localeCompare(b.linha)),
  })).filter((g) => g.itens.length > 0), [linhas]);

  // subtotal de um grupo, mês a mês
  const totalGrupo = (itens: Linha[], fn: (l: Linha) => (number | null)[]) =>
    Array.from({ length: 12 }, (_, i) => {
      const vs = itens.map((l) => fn(l)[i]).filter((v): v is number => v != null);
      return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
    });

  const planDe = (l: Linha) => l.valores.map((v) => Number(v) || 0);
  const rzDe = (l: Linha) => realizadoDa(l, realizado);

  // resultado = receita − custo − reserva; indicador fica de fora
  const resultado = (fn: (l: Linha) => (number | null)[]) =>
    Array.from({ length: 12 }, (_, i) => {
      let t: number | null = null;
      for (const g of porGrupo) {
        if (g.sinal === 0) continue;
        for (const l of g.itens) {
          const v = fn(l)[i];
          if (v == null) continue;
          t = (t ?? 0) + v * g.sinal;
        }
      }
      return t;
    });

  const mostraPlan = visao !== "realizado";
  const mostraRz = visao !== "planejado";

  const celula = (l: Linha, i: number) => {
    const p = planDe(l)[i];
    const r = rzDe(l)[i];
    const fmt = fmtCurto(l.unidade);
    // custo acima do planejado é ruim; receita acima é bom
    const sinal = l.grupo === "receita" || l.grupo === "indicador" ? 1 : -1;
    const cls = r == null ? "vazio" : (r - p) * sinal >= 0 ? "ok" : "ruim";
    return (
      <td key={i} className={anoCorrente && i === mesAtual ? "hoje" : undefined}>
        {mostraPlan && (editando ? (
          <input
            className="pl-cel"
            type="number"
            step="any"
            value={Number.isFinite(p) ? p : 0}
            onChange={(e) => onValor(l.id, i, Number(e.target.value))}
            aria-label={`${l.linha}, ${MES[i]}`}
          />
        ) : fmt(p))}
        {mostraRz && <span className={`pl-rz ${cls}`}>{fmt(r)}</span>}
      </td>
    );
  };

  const linhaSoma = (nome: string, plan: (number | null)[], rz: (number | null)[], u: Unidade, cls: string) => {
    const fmt = fmtCurto(u);
    const fmtT = fmtPor(u);
    const somaN = (v: (number | null)[]) => {
      const xs = v.filter((x): x is number => x != null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
    };
    return (
      <tr className={cls}>
        <td className="nome"><b>{nome}</b></td>
        {Array.from({ length: 12 }, (_, i) => (
          <td key={i} className={anoCorrente && i === mesAtual ? "hoje" : undefined}>
            {mostraPlan && fmt(plan[i])}
            {mostraRz && <span className="pl-rz">{fmt(rz[i])}</span>}
          </td>
        ))}
        <td className="tot">
          {mostraPlan && fmtT(somaN(plan))}
          {mostraRz && <span className="pl-rz">{fmtT(somaN(rz))}</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="pl-rolagem">
      <table className="pl-grade">
        <thead>
          <tr>
            <th className="nome">Linha</th>
            {MES.map((m, i) => <th key={m} className={anoCorrente && i === mesAtual ? "hoje" : undefined}>{m}</th>)}
            <th className="tot">Ano</th>
          </tr>
        </thead>
        <tbody>
          {porGrupo.map((g) => (
            <Fragment key={g.k}>
              <tr className="gr"><td className="nome" colSpan={14}>{g.nome}</td></tr>
              {g.itens.map((l) => {
                const fmtT = fmtPor(l.unidade);
                const rz = rzDe(l).filter((v): v is number => v != null);
                return (
                  <tr key={l.id}>
                    <td className="nome">
                      <button type="button" className="lk" onClick={() => onDetalhe(l)} title={l.observacao ?? undefined}>
                        {l.linha}
                      </button>
                      {!l.fonte && <small>só no plano, o sistema não tem essa conta</small>}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => celula(l, i))}
                    <td className="tot">
                      {mostraPlan && fmtT(soma(l.valores))}
                      {mostraRz && <span className="pl-rz">{rz.length ? fmtT(rz.reduce((a, b) => a + b, 0)) : "-"}</span>}
                    </td>
                  </tr>
                );
              })}
              {g.k !== "indicador" && linhaSoma(
                `Total de ${g.nome.toLowerCase()}`,
                totalGrupo(g.itens, planDe),
                totalGrupo(g.itens, rzDe),
                "brl",
                "som",
              )}
            </Fragment>
          ))}
          {linhaSoma("Resultado", resultado(planDe), resultado(rzDe), "brl", "res")}
        </tbody>
      </table>
    </div>
  );
}

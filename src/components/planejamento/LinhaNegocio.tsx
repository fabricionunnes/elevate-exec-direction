// Uma linha de negócio sozinha: UNV Ads ou UNV Social, separada da principal.
//
// O recorte por linha não existe desde sempre, e a tela diz isso em vez de
// fingir que existe. A despesa passou a ter centro de custo em julho de 2025;
// a receita só em maio de 2026, quando a cobrança passou a ser emitida dentro
// do Nexus. Por isso o mês a mês mostra os dois períodos, e o resultado só é
// calculado onde as duas pontas existem.
import { useMemo } from "react";
import { brl, fp } from "@/components/painel-controle/fmt";
import { Panel, Tile } from "@/components/painel-controle/ui";

type LinhaMes = { ym: string; linha: string; r: number; d: number; qr: number; qd: number };
type ClienteMes = { ym: string; linha: string; q: number };
type Forn = { linha: string; cat: string; v: number; n: number };

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotulo = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

export function LinhaNegocio({ nome, linhas, clientes, fornecedores }: {
  nome: string;
  linhas: LinhaMes[];
  clientes: ClienteMes[];
  fornecedores: Forn[];
}) {
  const c = useMemo(() => {
    const meus = linhas.filter((l) => l.linha === nome).sort((a, b) => a.ym.localeCompare(b.ym));
    if (!meus.length) return null;
    const cli = new Map(clientes.filter((x) => x.linha === nome).map((x) => [x.ym, x.q]));

    const serie = meus.map((m) => ({
      ...m,
      clientes: cli.get(m.ym) ?? null,
      // só faz sentido falar em resultado onde a receita da linha é registrada
      completo: m.r > 0,
    }));

    const comReceita = serie.filter((m) => m.completo);
    const recTotal = comReceita.reduce((a, m) => a + m.r, 0);
    const despNoPeriodo = comReceita.reduce((a, m) => a + m.d, 0);
    const despAntes = serie.filter((m) => !m.completo).reduce((a, m) => a + m.d, 0);
    const res = recTotal - despNoPeriodo;

    const ultimo = comReceita[comReceita.length - 1];
    const primeiro = comReceita[0];
    const teto = Math.max(...serie.flatMap((m) => [m.r, m.d]), 1);
    const maxCli = Math.max(...serie.map((m) => m.clientes ?? 0), 0);

    return { serie, comReceita, recTotal, despNoPeriodo, despAntes, res,
             ultimo, primeiro, teto, maxCli,
             media: comReceita.length ? recTotal / comReceita.length : 0 };
  }, [nome, linhas, clientes]);

  const meusForn = fornecedores.filter((f) => f.linha === nome).sort((a, b) => b.v - a.v);

  if (!c) {
    return <Panel titulo={nome}><div className="pl-aviso">Ainda não há lançamento separado para {nome}.</div></Panel>;
  }

  const margem = c.recTotal ? c.res / c.recTotal : null;
  const janela = c.comReceita.length
    ? `${rotulo(c.primeiro.ym)} a ${rotulo(c.ultimo.ym)}`
    : "ainda sem receita separada";

  return (
    <>
      <div className="grid k5">
        <Tile
          main
          label={`${nome} · receita em ${c.comReceita.length} ${c.comReceita.length === 1 ? "mês" : "meses"}`}
          valor={brl(c.recTotal)}
          sub={<>{janela} · média de {brl(c.media)} por mês</>}
        />
        <Tile label="Despesa no mesmo período" valor={brl(c.despNoPeriodo)}
              sub={c.despAntes ? <>mais {brl(c.despAntes)} antes de a receita ser separada</> : "tudo dentro da janela"} />
        <Tile label="Resultado" valor={brl(c.res)}
              sub={margem == null ? "sem base" : <>margem de {fp(margem)}</>}
              cls={c.res >= 0 ? "pos" : "neg"} />
        <Tile label="Clientes no último mês" valor={c.ultimo?.clientes != null ? String(c.ultimo.clientes) : "-"}
              sub={c.maxCli ? <>máximo de {c.maxCli} num mês</> : "sem contagem"} />
        <Tile label="Ticket médio por cliente" valor={c.ultimo?.clientes ? brl(c.ultimo.r / c.ultimo.clientes) : "-"}
              sub={c.ultimo ? <>no mês de {rotulo(c.ultimo.ym)}</> : ""} />
      </div>

      <Panel titulo={`${nome}: receita contra despesa`} sub="mês com barra apagada ainda não tinha receita separada">
        <div className="pl-cd" style={{ height: 200 }}>
          {c.serie.map((m) => {
            const r = m.r - m.d;
            return (
              <div key={m.ym} className={`pl-cdm ${m.completo ? "" : "prev"}`}
                   title={`${rotulo(m.ym)}: receita ${brl(m.r)}, despesa ${brl(m.d)}${m.completo ? `, ${r >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(r))}` : " (receita ainda não separada)"}`}>
                <div className="par">
                  <i className="rec" style={{ height: `${Math.max((m.r / c.teto) * 100, 1)}%` }} />
                  <i className="des" style={{ height: `${Math.max((m.d / c.teto) * 100, 1)}%` }} />
                </div>
                <small>
                  <b>{rotulo(m.ym)}</b>
                  {m.completo
                    ? <span className={r >= 0 ? "pos" : "neg"}>{r >= 0 ? "+" : "−"}{brl(Math.abs(r))}</span>
                    : <span className="nd">só custo</span>}
                </small>
              </div>
            );
          })}
        </div>
        <div className="pl-leg">
          <span><i style={{ background: "var(--bar)" }} />receita</span>
          <span><i style={{ background: "var(--bad)" }} />despesa</span>
          <span>apagado = despesa já tinha centro de custo, receita ainda não</span>
        </div>
      </Panel>

      <Panel titulo="Mês a mês" sub="receita, despesa, resultado e clientes pagantes">
        <div className="pl-rolagem">
          <table className="pl-grade">
            <thead>
              <tr>
                <th className="nome">Mês</th>
                <th>Receita</th><th>Despesa</th><th>Resultado</th><th>Margem</th>
                <th>Clientes</th><th className="tot">Receita por cliente</th>
              </tr>
            </thead>
            <tbody>
              {c.serie.map((m) => {
                const r = m.r - m.d;
                return (
                  <tr key={m.ym}>
                    <td className="nome"><b>{rotulo(m.ym)}</b></td>
                    <td>{m.r ? brl(m.r) : <span className="nd">-</span>}</td>
                    <td>{m.d ? brl(m.d) : <span className="nd">-</span>}</td>
                    <td>{m.completo ? <span className={r >= 0 ? "pos" : "neg"}>{brl(r)}</span> : <span className="nd">-</span>}</td>
                    <td>{m.completo && m.r ? <span className={r >= 0 ? "pos" : "neg"}>{fp(r / m.r)}</span> : <span className="nd">-</span>}</td>
                    <td>{m.clientes ?? <span className="nd">-</span>}</td>
                    <td className="tot">{m.clientes ? brl(m.r / m.clientes) : <span className="nd">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-aviso">
          <b>Até onde dá para ir:</b> a despesa de {nome} é separável desde julho de 2025, quando os pagamentos
          passaram a levar centro de custo. A receita só desde maio de 2026, quando a cobrança passou a ser emitida
          dentro do Nexus com a linha marcada. Antes disso o faturamento de {nome} está dentro do caixa geral da
          empresa, sem como separar: o extrato bancário não diz que produto pagou o quê. Por isso os meses de 2025
          aparecem só com custo, e resultado e margem ficam em branco neles em vez de mostrar prejuízo falso.
        </div>
      </Panel>

      {meusForn.length > 0 && (
        <Panel titulo={`Para onde vai o custo de ${nome}`} sub="todo o histórico, não só a janela com receita">
          <div className="pl-rolagem">
            <table className="pl-grade">
              <thead>
                <tr>
                  <th className="nome">Fornecedor</th><th>Pagamentos</th>
                  <th>Total</th><th className="tot">Médio por pagamento</th>
                </tr>
              </thead>
              <tbody>
                {meusForn.map((f) => (
                  <tr key={f.cat}>
                    <td className="nome">{f.cat}</td>
                    <td>{f.n}</td>
                    <td>{brl(f.v)}</td>
                    <td className="tot">{brl(f.v / f.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-aviso">
            Pagamento com a palavra <b>lucro</b> ou <b>participação</b> na descrição é divisão de resultado com o
            sócio da linha, não custo de operar. Vale olhar separado dos demais na hora de calcular margem.
          </div>
        </Panel>
      )}
    </>
  );
}

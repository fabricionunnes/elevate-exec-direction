// Todos os anos lado a lado, lidos do financeiro. Enquanto a tela do plano
// mostra um ano por vez, aqui a pergunta é outra: de onde a empresa vem e em
// que ano ela ganhou ou perdeu dinheiro.
//
// Tudo vem da RPC planejamento_historico, em regime de caixa, pela data de
// pagamento. Nada aqui é digitado nem fica congelado: lançou no financeiro,
// muda aqui.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, fp } from "@/components/painel-controle/fmt";
import { Panel, Tile } from "@/components/painel-controle/ui";

type Mes = { ym: string; r: number; d: number };
type AnoH = { ano: string; r: number; d: number; meses: number };
type Cat = { ano: string; cat: string; v: number };
type Dados = { meses: Mes[]; anos: AnoH[]; categorias: Cat[] };

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function Historico() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [parA, setParA] = useState<string>("");
  const [parB, setParB] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc("planejamento_historico");
      if (error) { setErro(error.message); return; }
      const dd = data as Dados;
      setD(dd);
      // abre comparando os dois anos cheios mais recentes
      const cheios = dd.anos.filter((a) => a.meses >= 10).map((a) => a.ano);
      if (cheios.length >= 2) {
        setParB(cheios[cheios.length - 1]);
        setParA(cheios[cheios.length - 2]);
      }
    })();
  }, []);

  const calc = useMemo(() => {
    if (!d) return null;
    const anos = d.anos.map((a) => ({ ...a, res: a.r - a.d, media: a.meses ? a.r / a.meses : 0 }));
    const teto = Math.max(...anos.flatMap((a) => [a.r, a.d]), 1);
    const melhor = anos.reduce((m, a) => (a.r > m.r ? a : m), anos[0]);
    const tetoMes = Math.max(...d.meses.flatMap((m) => [m.r, m.d]), 1);
    const noAzul = anos.filter((a) => a.res >= 0).length;
    return { anos, teto, melhor, tetoMes, noAzul };
  }, [d]);

  const comparacao = useMemo(() => {
    if (!d || !parA || !parB) return [];
    const mapa = new Map<string, { cat: string; a: number; b: number }>();
    for (const c of d.categorias) {
      if (c.ano !== parA && c.ano !== parB) continue;
      const e = mapa.get(c.cat) ?? { cat: c.cat, a: 0, b: 0 };
      if (c.ano === parA) e.a = c.v; else e.b = c.v;
      mapa.set(c.cat, e);
    }
    return [...mapa.values()]
      .map((e) => ({ ...e, dif: e.b - e.a }))
      .sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif))
      .slice(0, 14);
  }, [d, parA, parB]);

  if (erro) return <Panel titulo="Histórico"><p className="pl-aviso">Não deu para ler o histórico: {erro}</p></Panel>;
  if (!d || !calc) return <Panel titulo="Histórico"><p className="pl-aviso">Carregando...</p></Panel>;

  const anosCheios = d.anos.filter((a) => a.meses >= 10).map((a) => a.ano);

  return (
    <>
      <div className="grid k5">
        <Tile
          main
          label="Melhor ano até hoje"
          valor={brl(calc.melhor.r)}
          sub={<>em {calc.melhor.ano}, média de {brl(calc.melhor.r / Math.max(calc.melhor.meses, 1))} por mês</>}
        />
        <Tile
          label="Anos no azul"
          valor={`${calc.noAzul} de ${calc.anos.length}`}
          sub="resultado positivo no caixa do ano"
          cls={calc.noAzul > calc.anos.length / 2 ? "pos" : "neg"}
        />
        {calc.anos.slice(-3).map((a) => (
          <Tile
            key={a.ano}
            label={a.ano + (a.meses < 12 ? ` · ${a.meses} meses` : "")}
            valor={brl(a.r)}
            sub={<>{a.res >= 0 ? "sobrou" : "faltou"} {brl(Math.abs(a.res))}</>}
            cls={a.res >= 0 ? "pos" : "neg"}
          />
        ))}
      </div>

      <Panel titulo="Receita contra despesa, ano a ano" sub="as duas barras do mesmo ano, na mesma escala">
        <div className="pl-cd" style={{ height: 210 }}>
          {calc.anos.map((a) => (
            <div
              key={a.ano}
              className="pl-cdm"
              title={`${a.ano}: receita ${brl(a.r)}, despesa ${brl(a.d)}, ${a.res >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(a.res))}`}
            >
              <div className="par">
                <i className="rec" style={{ height: `${Math.max((a.r / calc.teto) * 100, 1)}%` }} />
                <i className="des" style={{ height: `${Math.max((a.d / calc.teto) * 100, 1)}%` }} />
              </div>
              <small>
                <b>{a.ano}{a.meses < 12 ? ` (${a.meses}m)` : ""}</b>
                <span className={a.res >= 0 ? "pos" : "neg"}>{a.res >= 0 ? "+" : "−"}{brl(Math.abs(a.res))}</span>
              </small>
            </div>
          ))}
        </div>
        <div className="pl-leg">
          <span><i style={{ background: "var(--bar)" }} />receita</span>
          <span><i style={{ background: "var(--bad)" }} />despesa</span>
          <span>ano com menos de 12 meses de lançamento aparece marcado</span>
        </div>
      </Panel>

      <Panel titulo="Mês a mês, desde o começo" sub="cada barra é um mês; a de cima é receita, a de baixo é despesa">
        <div className="pl-hm">
          {d.meses.map((m) => {
            const res = m.r - m.d;
            const mes = Number(m.ym.slice(5, 7)) - 1;
            return (
              <div
                key={m.ym}
                className="pl-hmc"
                title={`${MES_CURTO[mes]}/${m.ym.slice(2, 4)}: receita ${brl(m.r)}, despesa ${brl(m.d)}, ${res >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(res))}`}
              >
                <div className="cima"><i style={{ height: `${(m.r / calc.tetoMes) * 100}%` }} /></div>
                <div className="baixo"><i style={{ height: `${(m.d / calc.tetoMes) * 100}%` }} /></div>
                {mes === 0 && <em>{m.ym.slice(0, 4)}</em>}
              </div>
            );
          })}
        </div>
        <div className="pl-leg">
          <span><i style={{ background: "var(--bar)" }} />receita, para cima</span>
          <span><i style={{ background: "var(--bad)" }} />despesa, para baixo</span>
          <span>{d.meses.length} meses lançados</span>
        </div>
      </Panel>

      <Panel titulo="Os anos lado a lado" sub="receita, despesa e o que sobrou">
        <div className="pl-rolagem">
          <table className="pl-grade">
            <thead>
              <tr>
                <th className="nome">Ano</th>
                <th>Receita</th>
                <th>Despesa</th>
                <th>Resultado</th>
                <th>Margem</th>
                <th>Média por mês</th>
                <th className="tot">Contra o ano anterior</th>
              </tr>
            </thead>
            <tbody>
              {calc.anos.map((a, i) => {
                const ant = calc.anos[i - 1];
                const var_ = ant && ant.media ? a.media / ant.media - 1 : null;
                return (
                  <tr key={a.ano}>
                    <td className="nome">
                      <b>{a.ano}</b>
                      {a.meses < 12 && <span className="pl-rz vazio">{a.meses} meses com lançamento</span>}
                    </td>
                    <td>{brl(a.r)}</td>
                    <td>{brl(a.d)}</td>
                    <td><span className={a.res >= 0 ? "pos" : "neg"}>{brl(a.res)}</span></td>
                    <td>{a.r ? fp(a.res / a.r) : <span className="nd">-</span>}</td>
                    <td>{brl(a.media)}</td>
                    <td className="tot">
                      {var_ == null
                        ? <span className="nd">-</span>
                        : <span className={var_ >= 0 ? "pos" : "neg"}>{var_ >= 0 ? "+" : ""}{fp(var_)}</span>}
                      <span className="pl-rz">comparando a média mensal</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pl-aviso">
          A comparação entre anos usa a <b>média por mês</b>, não o total, porque ano com menos de 12 meses de
          lançamento ficaria sempre pior na conta. Tudo em regime de caixa, pela data em que o dinheiro entrou ou saiu.
          Ano que ainda está correndo, ou ano sem extrato de algum período, aparece com o aviso de quantos meses têm
          lançamento: nesses, o total é piso, não retrato fechado.
        </div>
      </Panel>

      {anosCheios.length >= 2 && (
        <Panel titulo="O que mudou na despesa" sub="categoria por categoria, entre dois anos">
          <div className="pl-chips" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, color: "var(--mute)", alignSelf: "center", marginRight: 4 }}>de</span>
            {anosCheios.map((a) => (
              <button key={"a" + a} type="button" className={parA === a ? "on" : ""} onClick={() => setParA(a)}>{a}</button>
            ))}
            <span style={{ fontSize: 11.5, color: "var(--mute)", alignSelf: "center", margin: "0 4px" }}>para</span>
            {anosCheios.map((a) => (
              <button key={"b" + a} type="button" className={parB === a ? "on" : ""} onClick={() => setParB(a)}>{a}</button>
            ))}
          </div>
          <div className="pl-rolagem">
            <table className="pl-grade">
              <thead>
                <tr>
                  <th className="nome">Categoria</th>
                  <th>{parA}</th>
                  <th>{parB}</th>
                  <th className="tot">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {comparacao.map((c) => (
                  <tr key={c.cat}>
                    <td className="nome">{c.cat}</td>
                    <td>{c.a ? brl(c.a) : <span className="nd">-</span>}</td>
                    <td>{c.b ? brl(c.b) : <span className="nd">-</span>}</td>
                    <td className="tot">
                      {/* despesa subindo é ruim, por isso o sinal é invertido na cor */}
                      <span className={c.dif > 0 ? "neg" : "pos"}>{c.dif >= 0 ? "+" : "−"}{brl(Math.abs(c.dif))}</span>
                      {!c.a && c.b ? <span className="pl-rz ruim">não existia em {parA}</span> : null}
                      {c.a && !c.b ? <span className="pl-rz ok">saiu da conta</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-aviso">
            A categoria sai do que a importação do Conta Azul gravou na observação do lançamento. Conta sem categoria
            cai em <b>Sem categoria</b>, que é o caso de quase tudo em 2026, quando a empresa parou de usar o Conta Azul.
            Só aparecem categorias acima de R$ 5 mil no ano, e no máximo 14 linhas, ordenadas pela maior variação.
          </div>
        </Panel>
      )}
    </>
  );
}

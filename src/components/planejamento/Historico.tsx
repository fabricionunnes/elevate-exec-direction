// Todos os anos lado a lado. Enquanto o resto do menu mostra um ano por vez,
// aqui a pergunta é outra: de onde a empresa vem, em que ano ela ganhou ou
// perdeu dinheiro, e o que mudou de um ano para o outro.
//
// Tudo sai da RPC planejamento_historico, em regime de caixa pela data de
// pagamento. A RPC devolve o cru por mês; toda comparação (mesmo mês ano a ano,
// acumulado, trimestre, semestre, crescimento encadeado) é calculada aqui, para
// mudar recorte sem mexer no banco.
//
// Regra que vale em toda a tela: ano incompleto nunca é comparado por total,
// só por média mensal ou por acumulado até o mesmo mês. 2023 começa em março,
// quando a empresa abriu, e 2026 tem buraco de janeiro a abril.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, fp } from "@/components/painel-controle/fmt";
import { Panel, Tile } from "@/components/painel-controle/ui";

type Mes = { ym: string; r: number; d: number; qr: number; qd: number };
type AnoH = { ano: string; r: number; d: number; meses: number; qr: number; qd: number };
type Corte = { ano: string; cat: string; v: number; n?: number };
type Dados = { meses: Mes[]; anos: AnoH[]; categorias: Corte[]; centros: Corte[]; fornecedores: Corte[] };

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const VISOES = [
  { k: "ano", rot: "Ano a ano" },
  { k: "mes", rot: "Mês a mês" },
  { k: "onde", rot: "Onde vai o dinheiro" },
] as const;
type Visao = typeof VISOES[number]["k"];

const pct = (atual: number, antes: number) => (antes ? atual / antes - 1 : null);
const Var = ({ v, invertido = false }: { v: number | null; invertido?: boolean }) =>
  v == null ? <span className="nd">-</span>
    : <span className={(invertido ? -v : v) >= 0 ? "pos" : "neg"}>{v >= 0 ? "+" : ""}{fp(v)}</span>;

export function Historico() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("ano");
  const [corte, setCorte] = useState<"categorias" | "centros" | "fornecedores">("categorias");
  const [parA, setParA] = useState("");
  const [parB, setParB] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc("planejamento_historico");
      if (error) { setErro(error.message); return; }
      const dd = data as Dados;
      setD(dd);
      const cheios = dd.anos.filter((a) => a.meses >= 10).map((a) => a.ano);
      if (cheios.length >= 2) { setParB(cheios[cheios.length - 1]); setParA(cheios[cheios.length - 2]); }
    })();
  }, []);

  const c = useMemo(() => {
    if (!d || !d.anos.length) return null;
    const anos = d.anos.map((a) => ({
      ...a, res: a.r - a.d,
      margem: a.r ? (a.r - a.d) / a.r : null,
      mediaR: a.meses ? a.r / a.meses : 0,
      mediaD: a.meses ? a.d / a.meses : 0,
    }));
    const rot = anos.map((a) => a.ano);

    // valor de um mês específico de um ano, ou null quando não há lançamento
    const mapa = new Map(d.meses.map((m) => [m.ym, m]));
    const em = (ano: string, i: number) => mapa.get(`${ano}-${String(i + 1).padStart(2, "0")}`) ?? null;

    // até onde o ano mais recente foi: é o corte do acumulado justo
    const ultimo = d.meses[d.meses.length - 1].ym;
    const corteMes = Number(ultimo.slice(5, 7));

    const ytd = anos.map((a) => {
      let r = 0, dd2 = 0, n = 0;
      for (let i = 0; i < corteMes; i++) {
        const m = em(a.ano, i);
        if (!m) continue;
        r += m.r; dd2 += m.d; n++;
      }
      return { ano: a.ano, r, d: dd2, res: r - dd2, meses: n };
    });

    const periodo = (ano: string, de: number, ate: number) => {
      let r = 0, dd2 = 0, n = 0;
      for (let i = de; i <= ate; i++) {
        const m = em(ano, i);
        if (!m) continue;
        r += m.r; dd2 += m.d; n++;
      }
      return { r, d: dd2, res: r - dd2, n };
    };

    const sazonal = Array.from({ length: 12 }, (_, i) => ({
      i, porAno: rot.map((ano) => em(ano, i)),
    }));

    const serie = d.meses.map((m, i) => ({
      ...m, res: m.r - m.d,
      cresc: i > 0 ? pct(m.r, d.meses[i - 1].r) : null,
    }));

    const comLanc = serie.filter((m) => m.r > 0 || m.d > 0);
    const melhorMes = comLanc.reduce((a, b) => (b.r > a.r ? b : a), comLanc[0]);
    const piorMes = comLanc.reduce((a, b) => (b.res < a.res ? b : a), comLanc[0]);
    const azuis = comLanc.filter((m) => m.res >= 0).length;

    // maior sequência de meses seguidos no azul
    let seq = 0, maiorSeq = 0;
    for (const m of comLanc) { seq = m.res >= 0 ? seq + 1 : 0; maiorSeq = Math.max(maiorSeq, seq); }

    const melhorAno = anos.reduce((a, b) => (b.mediaR > a.mediaR ? b : a), anos[0]);
    const tetoAno = Math.max(...anos.flatMap((a) => [a.r, a.d]), 1);
    const tetoMes = Math.max(...d.meses.flatMap((m) => [m.r, m.d]), 1);

    return { anos, rot, em, ytd, corteMes, periodo, sazonal, serie, comLanc,
             melhorMes, piorMes, azuis, maiorSeq, melhorAno, tetoAno, tetoMes };
  }, [d]);

  const comparacao = useMemo(() => {
    if (!d || !c || !parA || !parB) return [];
    const fonte = d[corte];
    const recA = c.anos.find((a) => a.ano === parA)?.r ?? 0;
    const recB = c.anos.find((a) => a.ano === parB)?.r ?? 0;
    const mapa = new Map<string, { cat: string; a: number; b: number }>();
    for (const x of fonte) {
      if (x.ano !== parA && x.ano !== parB) continue;
      const e = mapa.get(x.cat) ?? { cat: x.cat, a: 0, b: 0 };
      if (x.ano === parA) e.a = x.v; else e.b = x.v;
      mapa.set(x.cat, e);
    }
    return [...mapa.values()]
      .map((e) => ({ ...e, dif: e.b - e.a, pa: recA ? e.a / recA : null, pb: recB ? e.b / recB : null }))
      .sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif))
      .slice(0, 18);
  }, [d, c, corte, parA, parB]);

  if (erro) return <Panel titulo="Histórico"><div className="pl-aviso">Não deu para ler o histórico: {erro}</div></Panel>;
  if (!d || !c) return <Panel titulo="Histórico"><div className="pl-aviso">Carregando...</div></Panel>;

  const cheios = d.anos.filter((a) => a.meses >= 10).map((a) => a.ano);
  const nomeCorte = corte === "categorias" ? "categoria" : corte === "centros" ? "centro de custo" : "fornecedor";

  return (
    <>
      <div className="grid k5">
        <Tile
          main
          label="Melhor ano por mês"
          valor={brl(c.melhorAno.mediaR)}
          sub={<>em {c.melhorAno.ano}, {brl(c.melhorAno.r)} no ano inteiro</>}
        />
        <Tile label="Anos no azul" valor={`${c.anos.filter((a) => a.res >= 0).length} de ${c.anos.length}`}
              sub="resultado positivo no caixa" cls={c.anos.filter((a) => a.res >= 0).length > 1 ? "pos" : "neg"} />
        <Tile label="Meses no azul" valor={`${c.azuis} de ${c.comLanc.length}`}
              sub={<>maior sequência: {c.maiorSeq} {c.maiorSeq === 1 ? "mês" : "meses"} seguidos</>}
              cls={c.azuis > c.comLanc.length / 2 ? "pos" : "neg"} />
        <Tile label="Melhor mês" valor={brl(c.melhorMes.r)}
              sub={<>{MES[Number(c.melhorMes.ym.slice(5, 7)) - 1]}/{c.melhorMes.ym.slice(2, 4)}</>} />
        <Tile label="Pior mês" valor={brl(c.piorMes.res)}
              sub={<>{MES[Number(c.piorMes.ym.slice(5, 7)) - 1]}/{c.piorMes.ym.slice(2, 4)}, receita menos despesa</>}
              cls="neg" />
      </div>

      <div className="pl-abas" style={{ marginBottom: 2 }}>
        {VISOES.map((v) => (
          <button key={v.k} type="button" className={visao === v.k ? "on" : ""} onClick={() => setVisao(v.k)}>{v.rot}</button>
        ))}
      </div>

      {visao === "ano" && (
        <>
          <Panel titulo="Receita contra despesa, ano a ano" sub="as duas barras do mesmo ano, na mesma escala">
            <div className="pl-cd" style={{ height: 210 }}>
              {c.anos.map((a) => (
                <div key={a.ano} className="pl-cdm"
                     title={`${a.ano}: receita ${brl(a.r)}, despesa ${brl(a.d)}, ${a.res >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(a.res))}`}>
                  <div className="par">
                    <i className="rec" style={{ height: `${Math.max((a.r / c.tetoAno) * 100, 1)}%` }} />
                    <i className="des" style={{ height: `${Math.max((a.d / c.tetoAno) * 100, 1)}%` }} />
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
              <span>(Nm) = meses com lançamento no ano</span>
            </div>
          </Panel>

          <Panel titulo="Os anos lado a lado" sub="a comparação usa média mensal, não total">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Ano</th>
                    <th>Receita</th><th>Despesa</th><th>Resultado</th><th>Margem</th>
                    <th>Receita/mês</th><th>Despesa/mês</th><th className="tot">Receita/mês vs ano anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {c.anos.map((a, i) => (
                    <tr key={a.ano}>
                      <td className="nome"><b>{a.ano}</b>
                        {a.meses < 12 && <span className="pl-rz vazio">{a.meses} meses com lançamento</span>}</td>
                      <td>{brl(a.r)}</td>
                      <td>{brl(a.d)}</td>
                      <td><span className={a.res >= 0 ? "pos" : "neg"}>{brl(a.res)}</span></td>
                      <td>{a.margem == null ? <span className="nd">-</span> : <span className={a.margem >= 0 ? "pos" : "neg"}>{fp(a.margem)}</span>}</td>
                      <td>{brl(a.mediaR)}</td>
                      <td>{brl(a.mediaD)}</td>
                      <td className="tot"><Var v={i ? pct(a.mediaR, c.anos[i - 1].mediaR) : null} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel titulo={`Acumulado de janeiro a ${MES[c.corteMes - 1]}`} sub="o mesmo pedaço do ano em cada ano, que é a comparação honesta">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Ano</th><th>Receita</th><th>Despesa</th><th>Resultado</th>
                    <th>Meses com dado</th><th className="tot">Receita vs ano anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {c.ytd.map((y, i) => (
                    <tr key={y.ano}>
                      <td className="nome"><b>{y.ano}</b></td>
                      <td>{y.r ? brl(y.r) : <span className="nd">-</span>}</td>
                      <td>{y.d ? brl(y.d) : <span className="nd">-</span>}</td>
                      <td><span className={y.res >= 0 ? "pos" : "neg"}>{brl(y.res)}</span></td>
                      <td>{y.meses} de {c.corteMes}</td>
                      <td className="tot"><Var v={i && c.ytd[i - 1].r ? pct(y.r, c.ytd[i - 1].r) : null} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pl-aviso">
              Compara só até <b>{MES[c.corteMes - 1]}</b> em todos os anos, porque é até onde o ano corrente chegou.
              Sem esse corte o ano em andamento sempre pareceria pior do que é.
            </div>
          </Panel>

          <Panel titulo="Por trimestre e por semestre" sub="receita de cada pedaço do ano">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Ano</th>
                    <th>1º tri</th><th>2º tri</th><th>3º tri</th><th>4º tri</th>
                    <th>1º semestre</th><th className="tot">2º semestre</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rot.map((ano) => {
                    const t = [[0, 2], [3, 5], [6, 8], [9, 11]].map(([a, b]) => c.periodo(ano, a, b));
                    const s1 = c.periodo(ano, 0, 5), s2 = c.periodo(ano, 6, 11);
                    return (
                      <tr key={ano}>
                        <td className="nome"><b>{ano}</b></td>
                        {t.map((x, i) => <td key={i}>{x.n ? brl(x.r) : <span className="nd">-</span>}</td>)}
                        <td>{s1.n ? brl(s1.r) : <span className="nd">-</span>}</td>
                        <td className="tot">
                          {s2.n ? brl(s2.r) : <span className="nd">-</span>}
                          {s1.n && s2.n ? <span className={`pl-rz ${s2.r >= s1.r ? "ok" : "ruim"}`}>
                            {s2.r >= s1.r ? "+" : ""}{fp(pct(s2.r, s1.r))} contra o 1º
                          </span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {visao === "mes" && (
        <>
          <Panel titulo="Mês a mês, desde o começo" sub="receita para cima, despesa para baixo, um par por mês">
            <div className="pl-hm">
              {c.serie.map((m) => {
                const mes = Number(m.ym.slice(5, 7)) - 1;
                return (
                  <div key={m.ym} className="pl-hmc"
                       title={`${MES[mes]}/${m.ym.slice(2, 4)}: receita ${brl(m.r)}, despesa ${brl(m.d)}, ${m.res >= 0 ? "sobrou" : "faltou"} ${brl(Math.abs(m.res))}`}>
                    <div className="cima"><i style={{ height: `${(m.r / c.tetoMes) * 100}%` }} /></div>
                    <div className="baixo"><i style={{ height: `${(m.d / c.tetoMes) * 100}%` }} /></div>
                    {mes === 0 && <em>{m.ym.slice(0, 4)}</em>}
                  </div>
                );
              })}
            </div>
            <div className="pl-leg">
              <span><i style={{ background: "var(--bar)" }} />receita</span>
              <span><i style={{ background: "var(--bad)" }} />despesa</span>
              <span>{c.serie.length} meses lançados</span>
            </div>
          </Panel>

          <Panel titulo="O mesmo mês, ano contra ano" sub="é aqui que a sazonalidade aparece">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Mês</th>
                    {c.rot.map((a) => <th key={a}>{a}</th>)}
                    <th className="tot">Último contra o anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {c.sazonal.map((s) => {
                    const vals = s.porAno.map((m) => (m ? m.r : null));
                    const comDado = vals.map((v, i) => ({ v, i })).filter((x) => x.v != null);
                    const ult = comDado[comDado.length - 1], pen = comDado[comDado.length - 2];
                    const maior = Math.max(...vals.map((v) => v ?? 0), 1);
                    return (
                      <tr key={s.i}>
                        <td className="nome"><b>{MES[s.i]}</b></td>
                        {vals.map((v, i) => (
                          <td key={i}>
                            {v == null ? <span className="nd">-</span> : brl(v)}
                            {v != null && v === maior && comDado.length > 1
                              ? <span className="pl-rz ok">melhor</span> : null}
                          </td>
                        ))}
                        <td className="tot">
                          <Var v={ult && pen && pen.v ? pct(ult.v as number, pen.v as number) : null} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pl-aviso">
              Só receita. Mês sem lançamento aparece como "-" e não entra em comparação nenhuma, para não
              virar queda falsa: é o caso de janeiro a junho de 2023, antes da primeira receita, e de janeiro
              a abril de 2026, que é o período sem extrato.
            </div>
          </Panel>

          <Panel titulo="Crescimento de um mês para o outro" sub="variação encadeada da receita">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Mês</th><th>Receita</th><th>Despesa</th>
                    <th>Resultado</th><th>Margem</th><th className="tot">Contra o mês anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {[...c.serie].reverse().slice(0, 24).map((m) => {
                    const mes = Number(m.ym.slice(5, 7)) - 1;
                    return (
                      <tr key={m.ym}>
                        <td className="nome"><b>{MES[mes]}/{m.ym.slice(2, 4)}</b></td>
                        <td>{brl(m.r)}</td>
                        <td>{brl(m.d)}</td>
                        <td><span className={m.res >= 0 ? "pos" : "neg"}>{brl(m.res)}</span></td>
                        <td>{m.r ? <span className={m.res >= 0 ? "pos" : "neg"}>{fp(m.res / m.r)}</span> : <span className="nd">-</span>}</td>
                        <td className="tot"><Var v={m.cresc} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pl-aviso">Os 24 meses mais recentes, do mais novo para o mais antigo.</div>
          </Panel>
        </>
      )}

      {visao === "onde" && (
        <>
          {cheios.length >= 2 ? (
            <Panel titulo="O que mudou na despesa" sub={`por ${nomeCorte}, entre dois anos`}>
              <div className="pl-chips" style={{ marginBottom: 10 }}>
                {(["categorias", "centros", "fornecedores"] as const).map((k) => (
                  <button key={k} type="button" className={corte === k ? "on" : ""} onClick={() => setCorte(k)}>
                    {k === "categorias" ? "Categoria" : k === "centros" ? "Centro de custo" : "Fornecedor"}
                  </button>
                ))}
              </div>
              <div className="pl-chips" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "var(--mute)", alignSelf: "center", marginRight: 4 }}>de</span>
                {cheios.map((a) => (
                  <button key={"a" + a} type="button" className={parA === a ? "on" : ""} onClick={() => setParA(a)}>{a}</button>
                ))}
                <span style={{ fontSize: 11.5, color: "var(--mute)", alignSelf: "center", margin: "0 4px" }}>para</span>
                {cheios.map((a) => (
                  <button key={"b" + a} type="button" className={parB === a ? "on" : ""} onClick={() => setParB(a)}>{a}</button>
                ))}
              </div>
              <div className="pl-rolagem">
                <table className="pl-grade">
                  <thead>
                    <tr>
                      <th className="nome">{nomeCorte[0].toUpperCase() + nomeCorte.slice(1)}</th>
                      <th>{parA}</th><th>% da receita</th>
                      <th>{parB}</th><th>% da receita</th>
                      <th className="tot">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacao.map((x) => (
                      <tr key={x.cat}>
                        <td className="nome">{x.cat}</td>
                        <td>{x.a ? brl(x.a) : <span className="nd">-</span>}</td>
                        <td>{x.a && x.pa != null ? fp(x.pa) : <span className="nd">-</span>}</td>
                        <td>{x.b ? brl(x.b) : <span className="nd">-</span>}</td>
                        <td>{x.b && x.pb != null ? fp(x.pb) : <span className="nd">-</span>}</td>
                        <td className="tot">
                          {/* despesa subindo é ruim: a cor é invertida de propósito */}
                          <span className={x.dif > 0 ? "neg" : "pos"}>{x.dif >= 0 ? "+" : "−"}{brl(Math.abs(x.dif))}</span>
                          {!x.a && x.b ? <span className="pl-rz ruim">não existia em {parA}</span> : null}
                          {x.a && !x.b ? <span className="pl-rz ok">saiu da conta</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pl-aviso">
                A <b>% da receita</b> é a coluna que vale olhar: valor absoluto sobe junto com a empresa, participação não.
                Categoria e centro de custo saem do que a importação do Conta Azul gravou, por isso 2026 cai quase todo
                em "Sem categoria", quando a empresa saiu do Conta Azul. Fornecedor mostra os 15 maiores de cada ano.
                Linhas abaixo de R$ 3 mil no ano ficam de fora, e a lista mostra as 18 maiores variações.
              </div>
            </Panel>
          ) : (
            <Panel titulo="O que mudou na despesa">
              <div className="pl-aviso">Precisa de pelo menos dois anos com dez ou mais meses lançados para comparar.</div>
            </Panel>
          )}

          <Panel titulo="Quanto a empresa movimenta" sub="volume de lançamento por ano, para dimensionar a operação">
            <div className="pl-rolagem">
              <table className="pl-grade">
                <thead>
                  <tr>
                    <th className="nome">Ano</th>
                    <th>Recebimentos</th><th>Valor médio recebido</th>
                    <th>Pagamentos</th><th>Valor médio pago</th>
                    <th className="tot">Pagamentos por mês</th>
                  </tr>
                </thead>
                <tbody>
                  {c.anos.map((a) => (
                    <tr key={a.ano}>
                      <td className="nome"><b>{a.ano}</b></td>
                      <td>{a.qr}</td>
                      <td>{a.qr ? brl(a.r / a.qr) : <span className="nd">-</span>}</td>
                      <td>{a.qd}</td>
                      <td>{a.qd ? brl(a.d / a.qd) : <span className="nd">-</span>}</td>
                      <td className="tot">{a.meses ? Math.round(a.qd / a.meses) : <span className="nd">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pl-aviso">
              O valor médio recebido não é ticket de cliente: um recebimento do extrato pode juntar várias
              mensalidades, e um cliente pode pagar em várias parcelas. Serve para medir volume, não preço.
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

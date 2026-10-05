// Projeção de caixa de 13 semanas: saldo de hoje mais o que está lançado pra
// entrar e sair, em dois cenários (contratado e realista). O banco devolve o
// saldo dia a dia; aqui só se desenha e se aplica a chave das vencidas antigas.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ctx } from "./ctx";
import type { Caixa as CaixaT } from "./tipos";
import { Lk, Panel, Tabela, Tile } from "./ui";
import { brl, brlFull, dataBR, num, plural } from "./fmt";
import { LINK } from "./util";

const ddmm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "-");

type Ponto = { d: string; c: number; r: number };
type Resumo = { em30: number; em60: number; em90: number; neg: string | null; pior: number; piorD: string };

/** cartões de um cenário, a partir da série diária (já com a chave aplicada) */
function resumir(dias: Ponto[], k: "c" | "r"): Resumo {
  let pior = dias[0]?.[k] ?? 0, piorD = dias[0]?.d ?? "", neg: string | null = null;
  dias.forEach((p) => { if (p[k] < pior) { pior = p[k]; piorD = p.d; } if (neg == null && p[k] < 0) neg = p.d; });
  const em = (n: number) => dias[Math.min(n, dias.length - 1)]?.[k] ?? 0;
  return { em30: em(30), em60: em(60), em90: em(90), neg, pior, piorD };
}

/** resumo curto do cenário realista, pro cartão da visão geral e do Financeiro */
export function caixaFrase(cx: CaixaT | undefined): { valor: string; sub: string; cls: string } {
  if (!cx) return { valor: "-", sub: "projeção indisponível", cls: "" };
  const r = cx.cenarios.realista;
  const neg = r.primeiro_negativo;
  return {
    valor: brl(r.em30),
    cls: r.em30 < 0 ? "neg" : "",
    sub: neg ? (neg === cx.hoje ? `já não cobre as contas de hoje. Pior ponto ${brl(r.pior_valor)} em ${ddmm(r.pior_data)}` : `fica negativo em ${ddmm(neg)}. Pior ponto ${brl(r.pior_valor)} em ${ddmm(r.pior_data)}`)
      : `não fica negativo em 90 dias. Menor saldo ${brl(r.pior_valor)} em ${ddmm(r.pior_data)}`,
  };
}

function Grafico({ dias: serie, inicio, semanas, onSemana }: { dias: Ponto[]; inicio: number; semanas: CaixaT["semanas"]; onSemana: (n: number) => void }) {
  // o primeiro ponto é o saldo de agora, antes de qualquer lançamento de hoje
  const dias: (Ponto & { agora?: boolean })[] = useMemo(() => (serie.length ? [{ d: serie[0].d, c: inicio, r: inicio, agora: true }, ...serie] : []), [serie, inicio]);
  const semanaDe = (i: number) => Math.floor(Math.max(0, i - 1) / 7) + 1;
  const caixa = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hov, setHov] = useState<number | null>(null);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const medir = () => setW(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 280, mL = 58, mR = 14, mT = 14, mB = 30;
  const n = dias.length;
  const vals = dias.flatMap((p) => [p.c, p.r]);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const folga = (hi - lo || 1) * 0.08;
  const y0 = lo - folga, y1 = hi + folga;
  const X = (i: number) => mL + (i / Math.max(1, n - 1)) * (w - mL - mR);
  const Y = (v: number) => mT + (1 - (v - y0) / (y1 - y0)) * (H - mT - mB);
  const linha = (k: "c" | "r") => dias.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(" ");
  const marcas = useMemo(() => { const passo = (y1 - y0) / 4; return [0, 1, 2, 3, 4].map((i) => y0 + passo * i); }, [y0, y1]);
  const mover = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - mL) / Math.max(1, w - mL - mR)) * (n - 1));
    setHov(i >= 0 && i < n ? i : null);
  };
  const p = hov != null ? dias[hov] : null;
  return (
    <div ref={caixa} style={{ position: "relative" }}>
      {w > 0 && (
        <svg width={w} height={H} onMouseMove={mover} onMouseLeave={() => setHov(null)} onClick={() => { if (hov != null) onSemana(semanaDe(hov)); }} style={{ display: "block", cursor: "pointer" }} role="img" aria-label="Saldo projetado por dia">
          {/* abaixo de zero: faixa vermelha */}
          {y0 < 0 && <rect x={mL} y={Y(0)} width={w - mL - mR} height={Math.max(0, H - mB - Y(0))} fill="rgba(255,107,107,.13)" />}
          {marcas.map((v, i) => (<g key={i}><line x1={mL} x2={w - mR} y1={Y(v)} y2={Y(v)} stroke="#2C2C2C" strokeWidth={1} /><text x={mL - 8} y={Y(v) + 3.5} textAnchor="end" fontSize={10} fill="#8E8B84">{brl(v).replace("R$ ", "")}</text></g>))}
          <line x1={mL} x2={w - mR} y1={Y(0)} y2={Y(0)} stroke="#FF6B6B" strokeWidth={1} strokeDasharray="4 3" />
          {semanas.map((s) => { const i = (s.n - 1) * 7 + 1; return (<g key={s.n}><line x1={X(i)} x2={X(i)} y1={mT} y2={H - mB} stroke="#242424" strokeWidth={1} />{(w > 700 || s.n % 2 === 1) && <text x={X(i) + 3} y={H - 10} fontSize={10} fill="#8E8B84">{ddmm(s.de)}</text>}</g>); })}
          <path d={linha("c")} fill="none" stroke="#3F5F9E" strokeWidth={2} strokeDasharray="6 4" />
          <path d={linha("r")} fill="none" stroke="#F4F2EC" strokeWidth={2.2} />
          {p && hov != null && (<g><line x1={X(hov)} x2={X(hov)} y1={mT} y2={H - mB} stroke="#8E8B84" strokeWidth={1} /><circle cx={X(hov)} cy={Y(p.r)} r={4} fill="#F4F2EC" /><circle cx={X(hov)} cy={Y(p.c)} r={3.5} fill="#3F5F9E" /></g>)}
        </svg>
      )}
      {p && hov != null && (
        <div style={{ position: "absolute", top: 6, left: Math.min(Math.max(X(hov) + 10, mL), Math.max(mL, w - 190)), background: "#000", border: "1px solid #2C2C2C", borderRadius: 4, padding: "6px 9px", fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap" }}>
          <b>{p.agora ? "Saldo de agora" : dataBR(p.d)}</b>{!p.agora && <> · semana {semanaDe(hov)}</>}<br />
          realista <b className={p.r < 0 ? "neg" : ""}>{brlFull(p.r)}</b><br />
          <span className="nd">contratado {brlFull(p.c)}</span>
        </div>
      )}
      <div className="msync" style={{ marginTop: 6 }}>
        <span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke="#F4F2EC" strokeWidth="2.2" /></svg> realista</span>
        <span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke="#3F5F9E" strokeWidth="2" strokeDasharray="6 4" /></svg> contratado</span>
        <span><svg width="14" height="10"><rect width="14" height="10" fill="rgba(255,107,107,.3)" /></svg> abaixo de zero</span>
        <span className="nd">Clique num ponto pra abrir as faturas e contas da semana.</span>
      </div>
    </div>
  );
}

export function Caixa({ c }: { c: Ctx }) {
  const cx = c.d.frente?.caixa;
  const [antigas, setAntigas] = useState(false);

  // A chave "incluir vencidas antigas" joga hoje o que está vencido há mais de 30
  // dias: conta a pagar nos dois cenários e fatura só no contratado (no realista
  // ela já entra pela taxa de recuperação).
  const dias: Ponto[] = useMemo(() => {
    if (!cx) return [];
    const dp = antigas ? cx.fora.pagar_antigas.valor : 0, dr = antigas ? cx.fora.receber_antigas.valor : 0;
    return cx.dias.map((p) => ({ d: p.d, c: p.c - dp + dr, r: p.r - dp }));
  }, [cx, antigas]);

  if (!cx) return <div className="err">A projeção de caixa não veio do banco. Recarregue o painel.</div>;

  const R = resumir(dias, "r"), C = resumir(dias, "c");
  const tx = cx.taxas, h = cx.historico, f = cx.fora;
  const abrirSemana = (n: number) => { const s = cx.semanas.find((x) => x.n === n); if (s) c.det("caixa_movimentos", { de: s.de, ate: s.ate }, `Caixa · semana de ${ddmm(s.de)} a ${ddmm(s.ate)}`); };
  const desloc = antigas ? f.pagar_antigas.valor : 0, deslocR = antigas ? f.receber_antigas.valor : 0;
  const negTxt = (d: string | null) => (d == null ? "não fica" : d === cx.hoje ? "hoje" : dataBR(d));

  return (
    <>
      <div className="p">
        <div className="msync">
          <span>Saldo de hoje <b>{brlFull(cx.saldo_inicial)}</b> em {cx.bancos_n} contas. A projeção só enxerga o que já está lançado: faturas em aberto e contas a pagar. <b>Venda nova não entra.</b></span>
          <button type="button" className={`back ${antigas ? "acc" : ""}`} onClick={() => setAntigas((v) => !v)} title="Contas e faturas vencidas há mais de 30 dias ficam fora por padrão, porque muita coisa antiga já não é devida.">
            {antigas ? "Incluindo vencidas há mais de 30 dias" : "Incluir vencidas há mais de 30 dias"}
          </button>
        </div>
      </div>

      <div className="kg">
        <Tile label="Caixa em 30 dias" valor={brl(R.em30)} cls={R.em30 < 0 ? "neg" : ""} sub={`realista. Contratado: ${brl(C.em30)}`} onClick={() => abrirSemana(5)} />
        <Tile label="Caixa em 60 dias" valor={brl(R.em60)} cls={R.em60 < 0 ? "neg" : ""} sub={`realista. Contratado: ${brl(C.em60)}`} onClick={() => abrirSemana(9)} />
        <Tile label="Caixa em 90 dias" valor={brl(R.em90)} cls={R.em90 < 0 ? "neg" : ""} sub={`realista. Contratado: ${brl(C.em90)}`} onClick={() => abrirSemana(13)} />
        <Tile label="Primeiro dia no negativo" valor={negTxt(R.neg)} cls={R.neg ? "neg" : "pos"} sub={`realista. Contratado: ${negTxt(C.neg)}`} onClick={() => abrirSemana(R.neg ? Math.floor((new Date(`${R.neg}T12:00:00`).getTime() - new Date(`${cx.hoje}T12:00:00`).getTime()) / 604800000) + 1 : 1)} />
        <Tile label="Pior ponto" valor={brl(R.pior)} cls={R.pior < 0 ? "neg" : ""} sub={`em ${dataBR(R.piorD)}, realista. Contratado: ${brl(C.pior)} em ${ddmm(C.piorD)}`} onClick={() => abrirSemana(Math.floor((new Date(`${R.piorD}T12:00:00`).getTime() - new Date(`${cx.hoje}T12:00:00`).getTime()) / 604800000) + 1)} />
        <Tile label="Taxa de recebimento usada" valor={tx.taxa_7d == null ? "-" : `${num(tx.taxa_7d * 100)}%`}
          sub={tx.taxa_7d == null ? "amostra pequena: o realista usa o valor cheio" : `${brl(tx.pago_7d_valor)} de ${brl(tx.amostra_valor)} pagos até 7 dias depois do vencimento (${tx.amostra_n} faturas, ${ddmm(tx.janela_de)} a ${ddmm(tx.janela_ate)}). Atraso médio: ${tx.atraso_medio_dias ?? 0} ${tx.atraso_medio_dias === 1 ? "dia" : "dias"}`}
          onClick={() => c.go({ view: "fontes" })} />
      </div>

      <Panel titulo="Saldo projetado" sub={`dia a dia, de ${ddmm(cx.hoje)} a ${ddmm(dias[dias.length - 1]?.d)}`}>
        <Grafico dias={dias} inicio={cx.saldo_inicial} semanas={cx.semanas} onSemana={abrirSemana} />
      </Panel>

      <Panel titulo="Semana a semana" sub="clique na semana pra abrir as faturas e contas dela" cls="wide">
        <Tabela cols={[{ h: "Semana", tl: true }, "Entra (contratado)", "Entra (realista)", "Sai", "Saldo contratado", "Saldo realista", "Menor saldo na semana", "Lançamentos"]}
          onRow={(i) => abrirSemana(cx.semanas[i].n)}
          rows={cx.semanas.map((s) => {
            const sc = s.saldo_c - desloc + deslocR, sr = s.saldo_r - desloc, mn = s.min_r - desloc;
            return [`${s.n}. ${ddmm(s.de)} a ${ddmm(s.ate)}`, brlFull(s.entra_c), brlFull(s.entra_r), brlFull(s.sai),
              <span className={sc < 0 ? "neg" : ""}>{brlFull(sc)}</span>, <b className={sr < 0 ? "neg" : ""}>{brlFull(sr)}</b>, <span className={mn < 0 ? "neg" : ""}>{brlFull(mn)}</span>,
              `${s.n_entradas} entram, ${s.n_saidas} saem`];
          })} />
        <div className="note">Semana 1 começa hoje e já recebe o que venceu nos últimos 30 dias. Saída é igual nos dois cenários: a conta é paga no vencimento.</div>
      </Panel>

      <div className="grid g2">
        <Panel titulo="O que ficou fora da linha" sub="clique pra ver os lançamentos">
          <Tabela cols={[{ h: "Grupo", tl: true }, "Lançamentos", "Valor"]}
            onRow={(i) => [
              () => c.det("caixa_movimentos", { tipo: "saida", classe: "vencida_antiga" }, "Contas a pagar vencidas há mais de 30 dias"),
              () => c.det("caixa_movimentos", { tipo: "entrada", classe: "vencida_antiga" }, "Faturas vencidas há mais de 30 dias"),
              () => c.det("caixa_movimentos", { tipo: "saida", classe: "vencida_recente" }, "Contas a pagar vencidas há até 30 dias"),
              () => c.det("caixa_movimentos", { tipo: "entrada" }, "Entradas previstas em 90 dias", "Veja a coluna Regra: é ela que diz por que a fatura entrou cheia, com desconto ou ficou fora do realista."),
              () => c.abrir(LINK.financeiro),
            ][i]()}
            rows={[
              ["Contas a pagar vencidas há mais de 30 dias (fora dos dois cenários)", num(f.pagar_antigas.n, 0), <span className="neg">{brlFull(f.pagar_antigas.valor)}</span>],
              ["Faturas vencidas há mais de 30 dias (fora do contratado)", num(f.receber_antigas.n, 0), brlFull(f.receber_antigas.valor)],
              ["Contas vencidas há até 30 dias (dentro, entram hoje)", num(f.pagar_recentes.n, 0), brlFull(f.pagar_recentes.valor)],
              ["Faturas fora do realista (empresa inativa, depois do aviso ou vencida demais)", num(f.fora_do_realista.n, 0), brlFull(f.fora_do_realista.valor)],
              ["Recebíveis antigos importados (legado, não são as faturas)", num(f.recebiveis_legado.n, 0), brlFull(f.recebiveis_legado.valor)],
            ]} />
          <div className="note">{plural(f.pagar_antigas.n, "conta vencida", "contas vencidas")} há mais de 30 dias somam {brl(f.pagar_antigas.valor)}. Se ainda são devidas, ligue a chave lá em cima; se não são, dê baixa ou exclua no Contas a Pagar.</div>
        </Panel>
        <Panel titulo="Leitura" sub="por que a linha desce">
          <Tabela cols={[{ h: "Comparação", tl: true }, "Valor"]} rows={[
            ["Recebido por mês, média dos últimos 3 meses fechados", brlFull(h.recebido_mes)],
            ["Já faturado pros próximos 30 dias", brlFull(h.faturado_30d)],
            ["Pago por mês, média dos últimos 3 meses fechados", brlFull(h.pago_mes)],
            ["A pagar lançado pros próximos 30 dias", brlFull(h.a_pagar_30d)],
            ["Taxa de recuperação de fatura com mais de 7 dias de atraso", tx.taxa_recuperacao == null ? "-" : `${num(tx.taxa_recuperacao * 100)}%`],
            ["Prazo médio de quem pagou atrasado", tx.dias_recuperacao == null ? "-" : `${tx.dias_recuperacao} dias`],
          ]} />
          <div className="note">A diferença entre o que costuma entrar ({brl(h.recebido_mes)} por mês) e o que já está faturado pros próximos 30 dias ({brl(h.faturado_30d)}) é venda nova e cobrança avulsa que ainda não existe no sistema. A projeção mostra o caixa se nada novo for vendido.{tx.taxa_recuperacao != null && ` Fatura vencida há 8 a 90 dias entra no realista valendo ${num(tx.taxa_recuperacao * 100)}% (${brl(tx.recuperado_valor)} recuperados de ${brl(tx.recuperacao_valor)} que passaram de 7 dias de atraso, ${tx.recuperacao_n} faturas).`}</div>
        </Panel>
      </div>
      <div className="note"><Lk onClick={() => c.det("caixa_movimentos", {}, "Todos os lançamentos da projeção")}>Ver todos os lançamentos considerados</Lk> · <Lk onClick={() => c.go({ view: "financeiro" })}>Financeiro do mês</Lk> · <Lk onClick={() => c.abrir(LINK.financeiro)} ext>Abrir Financeiro no Nexus</Lk></div>
    </>
  );
}

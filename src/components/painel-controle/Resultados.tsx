// Resultados dos clientes (14/10/2026): quanto da meta cada cliente ativo já entregou no
// KPI principal, contra o ritmo esperado do mês, com alerta de quem está sem meta e de quem
// não lançou resultado. Mesma régua da aba KPIs do projeto (RPC painel_resultados_interno).
// Tudo clicável: faixa, consultor e linha abrem a visão micro do cliente.
import type { Ctx } from "./ctx";
import { useBloco } from "./bloco";
import { BarH, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, dataBR, fp, num, plural } from "./fmt";

export type Ritmo = { ritmo: number; fechado: boolean; dias_uteis: number; dias_passados: number };
export type ResCliente = {
  company_id: string; empresa: string; project_id: string | null; em_aviso: boolean;
  consultant_id: string | null; consultor: string | null;
  kpi_id: string | null; kpi: string | null; tipo: string | null;
  /** "indicadores" = meta e resultado do menu Indicadores (Facunicamps), não dos KPIs */
  fonte?: "kpis" | "indicadores";
  meta: number | null; realizado: number | null; pct: number | null;
  lanc_mes: number; ultimo: string | null; dias_sem_lancar: number | null;
  situacao: Situacao;
};
export type Resultados = { mes: string; ritmo: Ritmo; clientes: ResCliente[]; meta_nao_necessaria?: number };
type Situacao = "batida" | "no_ritmo" | "atencao" | "abaixo" | "sem_meta" | "sem_resultado" | "sem_nada" | "sem_kpi";

export const SITUACAO: Record<Situacao, string> = {
  batida: "Meta batida",
  no_ritmo: "No ritmo",
  atencao: "Atenção",
  abaixo: "Abaixo do ritmo",
  sem_meta: "Sem meta",
  sem_resultado: "Sem resultado lançado",
  sem_nada: "Sem meta e sem resultado",
  sem_kpi: "Sem KPI cadastrado",
};
const ORDEM: Situacao[] = ["batida", "no_ritmo", "atencao", "abaixo", "sem_meta", "sem_resultado", "sem_nada", "sem_kpi"];

/** recortes clicáveis (tiles e barras) */
const FAIXA: Record<string, [string, (x: ResCliente) => boolean]> = {
  ok: ["Batendo ou no ritmo", (x) => x.situacao === "batida" || x.situacao === "no_ritmo"],
  abaixo_ritmo: ["Abaixo do ritmo", (x) => x.situacao === "atencao" || x.situacao === "abaixo"],
  sem_resultado_todos: ["Sem resultado lançado no mês", (x) => x.situacao === "sem_resultado" || x.situacao === "sem_nada"],
  sem_meta_todos: ["Sem meta no mês", (x) => x.situacao === "sem_meta" || x.situacao === "sem_nada" || x.situacao === "sem_kpi"],
  parado: ["Pararam de lançar (5 dias ou mais)", (x) => x.lanc_mes > 0 && (x.dias_sem_lancar ?? 0) >= 5],
  ...Object.fromEntries(ORDEM.map((s) => [s, [SITUACAO[s], (x: ResCliente) => x.situacao === s]])),
};

export const valorKpi = (v: number | null | undefined, tipo: string | null | undefined) =>
  v == null ? "-" : tipo === "monetary" ? brl(v) : num(v, 0);

const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function SitTag({ s }: { s: Situacao }) {
  const ok = s === "batida" || s === "no_ritmo";
  const warn = s === "atencao" || s === "sem_meta";
  return <St ok={ok} warn={warn} tg={SITUACAO[s]} tw={SITUACAO[s]} tb={SITUACAO[s]} />;
}

const esperadoTxt = (r: Ritmo) =>
  r.fechado ? "mês fechado: o esperado é 100%" : `esperado até ontem: ${fp(r.ritmo)} (${r.dias_passados} de ${r.dias_uteis} dias úteis)`;

const abrirCliente = (c: Ctx, x: ResCliente) =>
  c.go({ view: "resultado_cliente", titulo: x.empresa, filtro: { company_id: x.company_id } });

function resumo(dado: Resultados) {
  const cl = dado.clientes;
  const conta = (k: string) => cl.filter(FAIXA[k][1]).length;
  return {
    total: cl.length,
    mediana: mediana(cl.filter((x) => x.pct != null).map((x) => Number(x.pct))),
    comPct: cl.filter((x) => x.pct != null).length,
    ok: conta("ok"), abaixo: conta("abaixo_ritmo"), semRes: conta("sem_resultado_todos"), semMeta: conta("sem_meta_todos"), parado: conta("parado"), batida: conta("batida"),
  };
}

/* ---------- Card da visão geral ---------- */
export function ResultadosCard({ c }: { c: Ctx }) {
  const { dado, erro } = useBloco<Resultados>("resultados", c.mes);
  const abrir = (faixa?: string) => c.go({ view: "resultados", f: faixa ? { faixa } : {} });
  if (erro) return <Panel titulo="Resultados dos clientes · mês"><div className="empty">Não consegui carregar: {erro}</div></Panel>;
  if (!dado) return <Panel titulo="Resultados dos clientes · mês"><div className="load">Carregando...</div></Panel>;
  const r = resumo(dado);
  const alertas = dado.clientes.filter((x) => FAIXA.sem_resultado_todos[1](x) || FAIXA.sem_meta_todos[1](x) || x.situacao === "abaixo").slice(0, 6);
  return (
    <Panel titulo="Resultados dos clientes · mês" sub={`meta entregue no KPI principal de cada cliente ativo. ${esperadoTxt(dado.ritmo)}`} onClick={() => abrir()} more="Abrir detalhes">
      <div className="mini" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div onClick={(e) => { e.stopPropagation(); abrir(); }}><small>Meta entregue (mediana)</small><b>{fp(r.mediana)}</b></div>
        <div onClick={(e) => { e.stopPropagation(); abrir("ok"); }}><small>Batendo ou no ritmo</small><b>{num(r.ok, 0)}</b></div>
        <div onClick={(e) => { e.stopPropagation(); abrir("abaixo_ritmo"); }}><small>Abaixo do ritmo</small><b className={r.abaixo ? "neg" : ""}>{num(r.abaixo, 0)}</b></div>
        <div onClick={(e) => { e.stopPropagation(); abrir("sem_resultado_todos"); }}><small>Sem resultado lançado</small><b className={r.semRes ? "neg" : ""}>{num(r.semRes, 0)}</b></div>
        <div onClick={(e) => { e.stopPropagation(); abrir("sem_meta_todos"); }}><small>Sem meta</small><b className={r.semMeta ? "neg" : ""}>{num(r.semMeta, 0)}</b></div>
      </div>
      {/* a linha abre o cliente; sem isso o clique subia pro card e abria a tela inteira por cima */}
      <div onClick={(e) => e.stopPropagation()}>
        <Tabela cols={[{ h: "Cliente", tl: true }, "Entregue", "Situação", { h: "Consultor", tl: true }]}
          onRow={(i) => abrirCliente(c, alertas[i])}
          rows={alertas.map((x) => [x.empresa, x.pct == null ? <Nd /> : fp(x.pct), <SitTag s={x.situacao} />, x.consultor ?? <Nd />])}
          vazio="Nenhum cliente sem meta, sem resultado ou abaixo do ritmo." />
      </div>
    </Panel>
  );
}

/* ---------- Tela completa ---------- */
export function ResultadosClientes({ c }: { c: Ctx }) {
  const { dado, erro } = useBloco<Resultados>("resultados", c.mes);
  const { f } = c;
  if (erro) return <div className="err">Não consegui carregar os resultados dos clientes: {erro}</div>;
  if (!dado) return <div className="load">Carregando os resultados dos clientes...</div>;
  const r = resumo(dado);
  const faixa = f.faixa ? FAIXA[String(f.faixa)] : undefined;
  const consultor = f.consultor ? String(f.consultor) : "";
  const lista = dado.clientes.filter((x) => (!faixa || faixa[1](x)) && (!consultor || (x.consultant_id ?? "sem") === consultor));
  const setFaixa = (k?: string) => c.setF({ ...f, faixa: k });
  const setCons = (k?: string) => c.setF({ ...f, consultor: k });

  // por consultor
  const grupos = new Map<string, { nome: string; xs: ResCliente[] }>();
  for (const x of dado.clientes) {
    const k = x.consultant_id ?? "sem";
    if (!grupos.has(k)) grupos.set(k, { nome: x.consultor ?? "Sem consultor", xs: [] });
    grupos.get(k)!.xs.push(x);
  }
  const porCons = [...grupos.entries()].map(([k, g]) => ({
    k, nome: g.nome, n: g.xs.length,
    med: mediana(g.xs.filter((x) => x.pct != null).map((x) => Number(x.pct))),
    ok: g.xs.filter(FAIXA.ok[1]).length,
    abaixo: g.xs.filter(FAIXA.abaixo_ritmo[1]).length,
    semMeta: g.xs.filter(FAIXA.sem_meta_todos[1]).length,
    semRes: g.xs.filter(FAIXA.sem_resultado_todos[1]).length,
  })).sort((a, b) => (b.semRes + b.semMeta + b.abaixo) - (a.semRes + a.semMeta + a.abaixo) || a.nome.localeCompare(b.nome));
  const maxSit = Math.max(...ORDEM.map((s) => dado.clientes.filter((x) => x.situacao === s).length), 1);
  const alertas = dado.clientes.filter((x) => FAIXA.sem_resultado_todos[1](x) || FAIXA.sem_meta_todos[1](x) || FAIXA.parado[1](x));
  const consNome = consultor ? porCons.find((p) => p.k === consultor)?.nome : undefined;

  return (
    <>
      {(faixa || consultor) && (
        <div className="note" style={{ border: 0, margin: 0, padding: 0 }}>
          Filtro ativo: {[faixa?.[0], consNome && `consultor ${consNome}`].filter(Boolean).join(" · ")}. {plural(lista.length, "cliente", "clientes")}. <Lk onClick={() => c.setF({})}>Limpar</Lk>
        </div>
      )}
      <div className="kg">
        <Tile label="Meta entregue (mediana)" valor={fp(r.mediana)} sub={`${plural(r.comPct, "cliente com meta e resultado", "clientes com meta e resultado")}. ${esperadoTxt(dado.ritmo)}`} onClick={() => setFaixa(undefined)} />
        <Tile label="Meta batida" valor={num(r.batida, 0)} sub="realizado já passou da meta do mês" onClick={() => setFaixa("batida")} />
        <Tile label="Batendo ou no ritmo" valor={num(r.ok, 0)} sub="entregaram pelo menos 90% do esperado até ontem" onClick={() => setFaixa("ok")} />
        <Tile label="Abaixo do ritmo" valor={num(r.abaixo, 0)} cls={r.abaixo ? "neg" : ""} sub="menos de 90% do esperado até ontem" onClick={() => setFaixa("abaixo_ritmo")} />
        <Tile label="Sem resultado lançado" valor={num(r.semRes, 0)} cls={r.semRes ? "neg" : ""} sub="nenhum lançamento do KPI principal no mês" onClick={() => setFaixa("sem_resultado_todos")} />
        <Tile label="Sem meta" valor={num(r.semMeta, 0)} cls={r.semMeta ? "neg" : ""} sub="nem por vendedor, nem da empresa, nem padrão do KPI" onClick={() => setFaixa("sem_meta_todos")} />
        <Tile label="Pararam de lançar" valor={num(r.parado, 0)} cls={r.parado ? "neg" : ""} sub="lançaram no mês, mas nada há 5 dias ou mais" onClick={() => setFaixa("parado")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Situação dos clientes" sub="clique numa faixa pra filtrar a lista">
          {ORDEM.map((s) => {
            const n = dado.clientes.filter((x) => x.situacao === s).length;
            if (!n && s === "sem_kpi") return null;
            return <BarH key={s} nome={SITUACAO[s]} p={n / maxSit} v={num(n, 0)} bad={!(s === "batida" || s === "no_ritmo")} onClick={() => setFaixa(s)} />;
          })}
          <div className="note">Ritmo: {esperadoTxt(dado.ritmo)}. No ritmo = pelo menos 90% do esperado; atenção = de 70% a 90%; abaixo = menos de 70%.</div>
        </Panel>
        <Panel titulo="Exige cobrança" sub={`${plural(alertas.length, "cliente", "clientes")} sem resultado, sem meta ou parados`}>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
          <Tabela cols={[{ h: "Cliente", tl: true }, { h: "O que falta", tl: true }, "Último lançamento", { h: "Consultor", tl: true }]}
            onRow={(i) => abrirCliente(c, alertas[i])}
            rows={alertas.map((x) => [
              x.empresa,
              x.situacao === "sem_nada" ? "meta e resultado" : x.situacao === "sem_resultado" ? "resultado do mês" : x.situacao === "sem_meta" || x.situacao === "sem_kpi" ? "meta do mês" : `lançamento há ${x.dias_sem_lancar} dias`,
              x.ultimo ? `${dataBR(x.ultimo)}${x.dias_sem_lancar != null ? ` (${x.dias_sem_lancar} d)` : ""}` : <Nd>nunca</Nd>,
              x.consultor ?? <Nd />,
            ])} vazio="Todos os clientes com meta e resultado lançado." />
          </div>
        </Panel>
      </div>

      <Panel titulo="Por consultor" sub="clique no nome pra filtrar">
        <Tabela cols={[{ h: "Consultor", tl: true }, "Clientes", "Entregue (mediana)", "No ritmo", "Abaixo", "Sem meta", "Sem resultado", "Situação"]}
          hl={porCons.findIndex((p) => p.k === consultor)}
          onRow={(i) => setCons(porCons[i].k)}
          rows={porCons.map((p) => [
            p.nome, num(p.n, 0), p.med == null ? <Nd /> : fp(p.med), num(p.ok, 0), num(p.abaixo, 0), num(p.semMeta, 0), num(p.semRes, 0),
            <St ok={p.semMeta + p.semRes === 0 && p.abaixo === 0} warn={p.semMeta + p.semRes === 0} tg="em dia" tw="clientes abaixo" tb="cobrar lançamento" />,
          ])} />
      </Panel>

      <Panel titulo="Todos os clientes" sub={`${plural(lista.length, "cliente", "clientes")}. Clique numa linha pra abrir o cliente: vendedores, dia a dia e os últimos 6 meses.`}>
        <Tabela cols={[{ h: "Cliente", tl: true }, { h: "KPI principal", tl: true }, "Meta", "Realizado", "Entregue", "Situação", "Último lançamento", { h: "Consultor", tl: true }]}
          onRow={(i) => abrirCliente(c, lista[i])}
          rows={lista.map((x) => [
            <>{x.empresa}{x.em_aviso && <small className="nd"> · em aviso</small>}</>,
            x.kpi ?? <Nd />,
            valorKpi(x.meta, x.tipo),
            x.lanc_mes ? valorKpi(x.realizado ?? 0, x.tipo) : <Nd>sem lançamento</Nd>,
            x.pct == null ? <Nd /> : <span className={x.situacao === "abaixo" ? "neg" : ""}>{fp(x.pct)}</span>,
            <SitTag s={x.situacao} />,
            x.ultimo ? dataBR(x.ultimo) : <Nd>nunca</Nd>,
            x.consultor ?? <Nd />,
          ])} vazio="Nenhum cliente neste filtro." />
      </Panel>
      <div className="note">{dado.meta_nao_necessaria ? `${plural(dado.meta_nao_necessaria, "cliente marcado", "clientes marcados")} como "meta não é necessária" no cadastro ${dado.meta_nao_necessaria === 1 ? "fica" : "ficam"} fora desta tela. ` : ""}Facunicamps usa o menu Indicadores (matrículas do mês contra a meta de matrículas). Régua igual à aba KPIs do projeto de cada cliente: KPI marcado como meta principal; meta = soma das metas por vendedor, senão a meta da empresa, senão por unidade ou time, senão a meta padrão do KPI. Realizado = soma dos lançamentos do mês. Dias úteis contam de segunda a sexta, sem feriado.</div>
    </>
  );
}

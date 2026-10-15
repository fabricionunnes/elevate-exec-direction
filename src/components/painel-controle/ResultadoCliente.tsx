// Resultado de um cliente (visão micro do card "Resultados dos clientes"): KPI principal
// contra a meta e o ritmo, vendedores, dia a dia, últimos 6 meses e os outros KPIs.
// RPC painel_resultado_cliente (só master).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Ctx } from "./ctx";
import { BarrasItens, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { dataBR, fp, mesAno, num, plural } from "./fmt";
import { valorKpi, type Ritmo } from "./Resultados";

type Kpi = { kpi_id: string; kpi: string; tipo: string; principal: boolean; meta: number | null; realizado: number | null; lanc_mes: number; ultimo: string | null };
type Vendedor = { salesperson_id: string; nome: string; ativo: boolean; meta: number | null; realizado: number | null; lanc_mes: number; ultimo: string | null };
type Dado = {
  mes: string; ritmo: Ritmo; fonte?: "kpis" | "indicadores"; empresa: string; company_id: string; project_id: string | null; consultor: string | null; kpi_id: string | null;
  kpis: Kpi[]; vendedores: Vendedor[]; sem_vendedor: number | null;
  diario: { dia: string; valor: number }[]; serie: { mes: string; meta: number | null; realizado: number | null }[];
};

const guardado = new Map<string, Dado>();
/** "Maria Eduarda Rodrigues Costa" -> "Maria Costa": a tabela fica na metade da tela */
const curto = (nome: string) => { const p = nome.trim().split(/\s+/); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : nome; };

export function ResultadoCliente({ c, companyId }: { c: Ctx; companyId: string }) {
  const chave = `${companyId}|${c.mes}`;
  const [dado, setDado] = useState<Dado | null>(guardado.get(chave) ?? null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setErro(null);
    const ja = guardado.get(chave);
    setDado(ja ?? null);
    if (ja) return;
    (async () => {
      const { data, error } = await (supabase as any).rpc("painel_resultado_cliente", { p_month: c.mes, p_company: companyId });
      if (!vivo) return;
      if (error) { setErro(error.message); return; }
      guardado.set(chave, data as Dado);
      setDado(data as Dado);
    })();
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <div className="err">Não consegui carregar o cliente: {erro}</div>;
  if (!dado) return <div className="load">Carregando o cliente...</div>;

  const k = dado.kpis.find((x) => x.principal) ?? null;
  const tipo = k?.tipo ?? null;
  const v = (n: number | null | undefined) => valorKpi(n, tipo);
  const r = dado.ritmo;
  const meta = k?.meta ?? null;
  const real = k?.lanc_mes ? Number(k.realizado ?? 0) : null;
  const pctReal = meta && real != null ? real / meta : null;
  const projecao = real != null && !r.fechado && r.dias_passados > 0 ? (real / r.dias_passados) * r.dias_uteis : r.fechado ? real : null;
  const falta = meta != null && real != null ? Math.max(meta - real, 0) : null;
  const diasRestantes = r.fechado ? 0 : r.dias_uteis - r.dias_passados;
  const abrirProjeto = () => dado.project_id && c.abrir(`/onboarding-tasks/${dado.project_id}`);
  const vend = dado.vendedores;

  return (
    <>
      <div className="note" style={{ border: 0, margin: 0, padding: 0 }}>
        KPI principal: <b>{k?.kpi ?? "nenhum KPI cadastrado"}</b>{dado.consultor && <> · consultor {dado.consultor}</>}
        {dado.fonte === "indicadores" && <> · meta e resultado do menu Indicadores, não dos KPIs</>}
        {dado.project_id && <> · <Lk ext onClick={abrirProjeto}>{dado.fonte === "indicadores" ? "Abrir o cliente no Nexus (aba Indicadores)" : "Abrir os KPIs do cliente no Nexus"}</Lk></>}
      </div>
      <div className="kg">
        <Tile label="Meta do mês" valor={meta == null ? "-" : v(meta)} cls={meta == null ? "neg" : ""}
          sub={meta == null ? (dado.fonte === "indicadores" ? "sem meta do mês: cadastre no menu Indicadores" : "sem meta: cadastre por vendedor ou da empresa na aba KPIs") : `${plural(vend.filter((x) => x.meta).length, "vendedor com meta", "vendedores com meta")}`} onClick={abrirProjeto} />
        <Tile label="Realizado" valor={real == null ? "-" : v(real)} cls={real == null ? "neg" : ""}
          sub={k?.lanc_mes ? `${plural(k.lanc_mes, "lançamento", "lançamentos")} no mês` : "nenhum lançamento no mês"} onClick={abrirProjeto} />
        <Tile label="Meta entregue" valor={fp(pctReal)} cls={pctReal != null && pctReal < r.ritmo * 0.7 ? "neg" : ""}
          sub={r.fechado ? "mês fechado" : `esperado até ontem: ${fp(r.ritmo)} (${r.dias_passados} de ${r.dias_uteis} dias úteis)`} />
        <Tile label={r.fechado ? "Fechamento" : "Projeção do mês"} valor={projecao == null ? "-" : v(projecao)}
          sub={meta && projecao != null ? `${fp(projecao / meta)} da meta, no ritmo dos dias úteis até ontem` : "precisa de meta e de lançamento"} />
        <Tile label="Falta pra meta" valor={falta == null ? "-" : v(falta)}
          sub={falta && diasRestantes > 0 ? `${v(falta / diasRestantes)} por dia útil nos ${diasRestantes} que faltam` : falta === 0 ? "meta batida" : "sem meta ou sem lançamento"} />
        <Tile label="Último lançamento" valor={k?.ultimo ? dataBR(k.ultimo) : "nunca"} cls={!k?.ultimo ? "neg" : ""}
          sub={dado.sem_vendedor ? `${v(dado.sem_vendedor)} lançados sem vendedor` : "do KPI principal"} />
      </div>

      <div className="grid g2">
        <Panel titulo="Vendedores" sub={`${k?.kpi ?? "KPI principal"} no mês. Ativos e quem teve meta ou lançamento.`}>
          <Tabela cols={[{ h: "Vendedor", tl: true }, "Meta", "Realizado", "Entregue", "Lançamentos", "Último", "Situação"]}
            rows={vend.map((x) => {
              const p = x.meta && x.lanc_mes ? Number(x.realizado ?? 0) / x.meta : null;
              return [
                <span title={x.nome}>{curto(x.nome)}{!x.ativo && <small className="nd"> · inativo</small>}</span>,
                x.meta == null ? <Nd /> : v(x.meta),
                x.lanc_mes ? v(x.realizado ?? 0) : <Nd />,
                p == null ? <Nd /> : fp(p),
                num(x.lanc_mes, 0),
                x.ultimo ? dataBR(x.ultimo) : <Nd>nunca</Nd>,
                !x.meta && !x.lanc_mes ? <St ok={false} tg="" tb="sem meta e sem venda" />
                  : !x.meta ? <St ok={false} warn tg="" tw="sem meta" />
                  : !x.lanc_mes ? <St ok={false} tg="" tb="sem lançamento" />
                  : <St ok={p! >= r.ritmo * 0.9} warn={p! >= r.ritmo * 0.7} tg={p! >= 1 ? "meta batida" : "no ritmo"} tw="atenção" tb="abaixo" />,
              ];
            })} vazio="Nenhum vendedor cadastrado neste cliente." />
        </Panel>
        <Panel titulo="Últimos 6 meses" sub="quanto da meta foi entregue em cada mês. Clique num mês pra trocar o painel inteiro.">
          <BarrasItens itens={dado.serie.map((m) => ({
            k: m.mes, rot: mesAno(m.mes),
            v: m.meta && m.realizado != null ? Number(m.realizado) / m.meta : null,
            tip: `${mesAno(m.mes)}: realizado ${m.realizado == null ? "sem lançamento" : v(m.realizado)}, meta ${m.meta == null ? "sem meta" : v(m.meta)}`,
          }))} fmt={(x) => fp(x)} ativo={dado.mes} onItem={(m) => c.setMes(`${m}-01`)} />
        </Panel>
      </div>

      <Panel titulo="Dia a dia" sub={`${k?.kpi ?? "KPI principal"} lançado por dia no mês`}>
        {dado.diario.length
          ? <BarrasItens denso={dado.diario.length > 16} itens={dado.diario.map((d) => ({ k: d.dia, rot: d.dia.slice(8, 10), v: Number(d.valor), tip: `${dataBR(d.dia)}: ${v(d.valor)}` }))} fmt={(x) => v(x)} />
          : <div className="empty">Nenhum lançamento no mês.</div>}
      </Panel>

      <Panel titulo="Todos os KPIs do cliente" sub="mesma régua de meta pra cada um">
        <Tabela cols={[{ h: "KPI", tl: true }, "Meta", "Realizado", "Entregue", "Lançamentos", "Último"]}
          rows={dado.kpis.map((x) => [
            <>{x.kpi}{x.principal && <small className="nd"> · principal</small>}</>,
            x.meta == null ? <Nd /> : valorKpi(x.meta, x.tipo),
            x.lanc_mes ? valorKpi(x.realizado ?? 0, x.tipo) : <Nd />,
            x.meta && x.lanc_mes ? fp(Number(x.realizado ?? 0) / x.meta) : <Nd />,
            num(x.lanc_mes, 0),
            x.ultimo ? dataBR(x.ultimo) : <Nd>nunca</Nd>,
          ])} vazio="Nenhum KPI ativo." />
      </Panel>
    </>
  );
}

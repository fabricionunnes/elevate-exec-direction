// Clientes e entrega: base ativa, churn, renovação, health score, NPS, CSAT,
// tarefas atrasadas, checkup e o time de consultores.
import type { Ctx } from "./ctx";
import { Barras, BarH, Combo, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, dataBR, fp, nivelLabel, num, pct, plural, tendLabel } from "./fmt";

export function filtrosClientes(c: Ctx) {
  return <Combo k="consultor" label="Consultor" value={String(c.f.consultor ?? "")} todos="Todos" opts={c.d.clientes.por_consultor.map((p) => ({ value: p.staff_id, label: p.nome }))} onChange={(v) => c.setF({ ...c.f, consultor: v })} />;
}

export function Clientes({ c }: { c: Ctx }) {
  const { d, mes, f } = c;
  const cli = d.clientes;
  const cons = cli.por_consultor.find((p) => p.staff_id === f.consultor);
  const fc = f.consultor ? { consultant_id: String(f.consultor) } : {};
  const suf = cons ? ` · ${cons.nome}` : "";
  const h = cli.health;
  const niveis: [string, number][] = [["excellent", h.excellent], ["healthy", h.healthy], ["attention", h.attention], ["at_risk", h.at_risk], ["critical", h.critical]];
  const maxN = Math.max(...niveis.map((x) => x[1]), 1);
  return (
    <>
      {cons && <div className="note" style={{ border: 0, margin: 0, padding: 0 }}>Filtro ativo: consultor {cons.nome}. Os cards abaixo mostram o total; as listas abrem filtradas. <Lk onClick={() => c.setF({})}>Limpar</Lk></div>}
      <div className="kg">
        <Tile label="Clientes ativos" valor={num(cons ? cons.empresas : cli.ativas, 0)} sub={`${plural(cli.em_aviso, "em aviso de saída", "em aviso de saída")}`} onClick={() => c.det("clientes", { tipo: "ativos", ...fc }, `Clientes ativos${suf}`)} />
        <Tile label="Novos no mês" valor={num(cli.novos, 0)} sub="por data de início do contrato" onClick={() => c.det("clientes", { tipo: "novos", ...fc }, `Clientes novos${suf}`)} />
        <Tile label="Churn no mês" valor={num(cli.churn_n, 0)} sub={`${brl(cli.churn_valor)} de contrato encerrado`} onClick={() => c.det("clientes", { tipo: "churn", ...fc }, `Churn do mês${suf}`)} />
        <Tile label="Em aviso de saída" valor={num(cli.em_aviso, 0)} sub={`${brl(d.financeiro.mrr_em_aviso)} de mensalidade`} onClick={() => c.det("clientes", { tipo: "em_aviso", ...fc }, `Em aviso de saída${suf}`)} />
        <Tile label="Contratos vencendo (30 d)" valor={num(cli.vencendo_30d_n, 0)} sub="só contratos com prazo; mensal renova sozinho" onClick={() => c.det("clientes", { tipo: "vencendo", ...fc }, `Contratos vencendo${suf}`)} />
        <Tile label="Receita recorrente" valor={c.d.frente?.concentracao ? brl(c.d.frente.concentracao.mrr_base) : "-"} sub="o que fatura por mês. Ponte do MRR, LTV, churn de receita e renovações em 30, 60 e 90 dias" onClick={() => c.go({ view: "receita" })} />
        <Tile label="Por produto" valor="ver" sub="clientes, MRR, receita, churn e custo direto de cada produto" onClick={() => c.go({ view: "produtos" })} />
        <Tile label="Health score médio" valor={h.media == null ? "-" : num(h.media)} sub={`${h.n} clientes com score · ${h.critical + h.at_risk} críticos ou em risco`} onClick={() => c.det("clientes", { tipo: "health_baixo", ...fc }, `Health baixo${suf}`)} />
        <Tile label="NPS do mês" valor={cli.nps == null ? "-" : num(cli.nps)} sub={cli.nps_n ? `${plural(cli.nps_n, "resposta", "respostas")} · ${cli.nps_baixo_n} detratores` : "nenhuma resposta no mês"} onClick={() => c.det("nps")} />
        <Tile label="CSAT do mês" valor={cli.csat == null ? "-" : `${num(cli.csat)} de 5`} sub={cli.csat_n ? plural(cli.csat_n, "avaliação", "avaliações") : "nenhuma avaliação no mês"} onClick={() => c.det("csat")} />
        <Tile label="Tarefas atrasadas" valor={num(cons ? cons.tarefas_atrasadas : cli.tarefas_atrasadas, 0)} sub="pendentes com prazo vencido em clientes ativos" onClick={() => c.det("tarefas_atrasadas", f.consultor ? { staff_id: String(f.consultor) } : {}, `Tarefas atrasadas${suf}`)} />
        <Tile label="Checkup de hoje" valor={num(cli.checkup_pendentes, 0)} sub={cli.checkup_por_bloco.length ? cli.checkup_por_bloco.map((b) => `${b.bloco}: ${b.n}`).join(" · ") : "nenhuma pendência hoje"} onClick={() => c.det("checkup")} />
        {c.d.frente?.concentracao?.maior && <Tile label="Maior cliente nas mensalidades" valor={fp(c.d.frente.concentracao.maior.pct)} sub={`${c.d.frente.concentracao.maior.empresa} · 5 maiores: ${fp(c.d.frente.concentracao.top5_pct)}`} onClick={() => c.go({ view: "fundador" })} />}
      </div>

      <div className="grid g2">
        <Panel titulo="Health score · distribuição" sub="último score de cada cliente ativo. Clique pra listar.">
          {niveis.map(([k, n]) => <BarH key={k} nome={nivelLabel(k)} p={n / maxN} v={num(n, 0)} bad={k === "critical" || k === "at_risk"} onClick={() => c.det("clientes", { tipo: "ativos", nivel: k, ...fc }, `Clientes · ${nivelLabel(k)}${suf}`)} />)}
          <div className="note">Score de 0 a 100 calculado pelo motor de retenção (satisfação, metas, comercial, engajamento, suporte, tendência).</div>
        </Panel>
        <Panel titulo="Clientes em risco" sub={`${cli.health_baixo.length} com score crítico ou em risco`}>
          <Tabela cols={[{ h: "Empresa", tl: true }, "Score", "Nível", "Tendência", "Consultor"]} rows={cli.health_baixo.slice(0, 12).map((x) => [
            <Lk onClick={() => c.det("clientes", { tipo: "ativos", ...fc }, `Clientes ativos`)}>{x.empresa}</Lk>, num(x.score, 0), <St ok={false} warn={x.nivel === "at_risk"} tg="" tw="em risco" tb="crítico" />, x.tendencia ? tendLabel(x.tendencia) : <Nd />, x.consultor ?? <Nd />,
          ])} vazio="Nenhum cliente em risco." />
          {cli.health_baixo.length > 12 && <Lk onClick={() => c.det("clientes", { tipo: "health_baixo", ...fc })}>Ver todos os {cli.health_baixo.length}</Lk>}
        </Panel>
      </div>

      <Panel titulo="Por consultor" sub="carteira, saúde e atraso de cada um. Clique no nome pra filtrar, na linha pra ver os clientes.">
        <Tabela cols={[{ h: "Consultor", tl: true }, "Clientes", "Mensalidades", "Health médio", "Críticos", "Em aviso", "Tarefas atrasadas", "Situação"]}
          hl={cli.por_consultor.findIndex((p) => p.staff_id === f.consultor)}
          onRow={(i) => c.det("clientes", { tipo: "ativos", consultant_id: cli.por_consultor[i].staff_id }, `Clientes · ${cli.por_consultor[i].nome}`)}
          rows={cli.por_consultor.map((p) => [
            <Lk onClick={() => c.setF({ ...f, consultor: p.staff_id })}>{p.nome}</Lk>, num(p.empresas, 0), brl(p.mensalidades), p.health_media == null ? <Nd /> : num(p.health_media), num(p.criticas, 0), num(p.em_aviso, 0),
            <Lk onClick={() => c.det("tarefas_atrasadas", { staff_id: p.staff_id }, `Tarefas atrasadas · ${p.nome}`)}>{num(p.tarefas_atrasadas, 0)}</Lk>,
            <St ok={p.criticas === 0 && p.tarefas_atrasadas < 10} warn={p.tarefas_atrasadas < 30 && p.criticas <= 3} tg="em dia" tw="atenção" tb="cobrar plano" />,
          ])} />
      </Panel>

      <div className="grid g2">
        <Panel titulo="Tarefas atrasadas por responsável" sub="inclui quem não é consultor">
          <Tabela cols={[{ h: "Responsável", tl: true }, "Tarefas", "Clientes"]} onRow={(i) => { const r = cli.tarefas_por_responsavel[i]; c.det("tarefas_atrasadas", r.staff_id ? { staff_id: r.staff_id } : {}, `Tarefas atrasadas · ${r.nome}`); }}
            rows={cli.tarefas_por_responsavel.map((r) => [r.nome, num(r.n, 0), num(r.empresas, 0)])} vazio="Nenhuma tarefa atrasada." />
        </Panel>
        <Panel titulo="Churn e novos mês a mês" sub="projetos encerrados por mês; embaixo, novos contratos">
          <Barras serie={d.serie} mes={mes} fn={(m) => m.churn} fmt={(v) => num(v, 0)} sub={(m) => `${m.novos} novos`} onMes={c.setMes} />
        </Panel>
      </div>

      <div className="grid g2">
        <Panel titulo="Novos no mês" sub={`${cli.novos} contratos iniciados`}>
          <Tabela cols={[{ h: "Empresa", tl: true }, "Início", "Plano", "Valor cadastrado"]} rows={cli.novos_lista.map((x) => [<Lk onClick={() => c.det("clientes", { tipo: "novos" }, "Clientes novos")}>{x.empresa}</Lk>, dataBR(x.inicio), x.plano ?? <Nd />, brl(x.valor)])} vazio="Nenhum contrato iniciado no mês." />
        </Panel>
        <Panel titulo="Churn no mês" sub={`${cli.churn_n} projetos encerrados`}>
          <Tabela cols={[{ h: "Empresa", tl: true }, "Data", "Valor", { h: "Motivo", tl: true }]} rows={cli.churn_lista.map((x) => [<Lk onClick={() => c.det("clientes", { tipo: "churn" }, "Churn do mês")}>{x.empresa}</Lk>, dataBR(x.data), brl(x.valor), x.motivo ?? <Nd />])} vazio="Nenhum churn no mês." />
        </Panel>
      </div>
      <div className="note">Churn = projeto com churn_date no mês. Renovação: {fp(pct(cli.ativas - cli.em_aviso, cli.ativas))} da base ativa segue sem sinal de saída. O campo de renovação das empresas nunca foi preenchido no sistema (renewed_at vazio), por isso não existe "taxa de renovação" aqui.</div>
    </>
  );
}

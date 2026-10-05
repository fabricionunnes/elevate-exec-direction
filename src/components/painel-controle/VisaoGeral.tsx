// Visão geral: faixa de KPIs, funil único do mês, decisões, quatro áreas,
// financeiro mês a mês e "roda sozinho". Tudo clicável.
import type { Ctx } from "./ctx";
import { Barras, Panel, Rank, Tabela, Tile, Lk, Nd } from "./ui";
import { brl, fp, kfmt, num, pct, plural, usd } from "./fmt";
import { MetaSaldoTxt, MetaStatusTxt, contaTxt } from "./MetaSync";
import { FunilMes } from "./funil/FunilMes";
import { caixaFrase } from "./Caixa";
import { fundadorFrase } from "./Fundador";
import { coberturaFrase, reunioesFrase } from "./Antecedentes";
import { ritmoFrase } from "./Ritmo";
import type { EtapaFunil } from "./funil/geo";

export function VisaoGeral({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const fin = d.financeiro, com = d.comercial, tra = d.trafego, cli = d.clientes, ate = d.atendimento, ia = d.ia, roda = d.roda_sozinho;
  const prev = d.serie[d.serie.findIndex((m) => m.mes === mes) - 1];
  const dv = prev && prev.recebido ? (fin.recebido - prev.recebido) / prev.recebido : null;
  // Etapas do funil do mês. Investimento não é etapa: vira o selo no topo.
  const etapasFunil: EtapaFunil[] = [
    { k: "leads", nome: "Leads (funis que contam)", v: com.leads_inflow, conv: `${num(com.leads, 0)} no total do CRM`, onClick: () => c.det("leads") },
    { k: "pagos", nome: "Leads pagos no CRM", v: tra.leads_pagos_crm, conv: com.leads_inflow ? `${fp(pct(tra.leads_pagos_crm, com.leads_inflow))} dos leads` : "origem Meta ou utm paga",
      onClick: () => c.det("leads", { pago: true }, "Leads de origem paga") },
    { k: "agendadas", nome: "Reuniões agendadas", v: com.agendadas, conv: com.leads_inflow ? `${fp(pct(com.agendadas, com.leads_inflow))} dos leads` : "eventos do CRM",
      onClick: () => c.det("reunioes", { tipo: "scheduled" }, "Reuniões agendadas") },
    { k: "realizadas", nome: "Compareceram", v: com.realizadas,
      conv: com.presenca == null ? "sem reunião com desfecho" : `${fp(com.presenca)} de presença · ${com.no_show} no-show`,
      dica: com.realizadas > com.agendadas ? "Compareceram mais do que foram agendadas no mês: entra reunião marcada no mês anterior e realizada neste." : undefined,
      onClick: () => c.det("reunioes", { tipo: "realizadas" }, "Reuniões realizadas") },
    { k: "vendas", nome: "Vendas", v: com.vendas, conv: com.conv_reuniao_venda == null ? "sem reunião realizada no mês" : `${fp(com.conv_reuniao_venda)} das realizadas`, onClick: () => c.det("vendas") },
  ];
  const selo = !tra.tem_dados ? "Sem investimento registrado no mês"
    : tra.spend > 0 ? `${brl(tra.spend)} investidos${tra.cpl != null ? ` · CPL ${brl(tra.cpl)}` : ""}`
    : `R$ 0 investidos no mês${tra.meta?.nivel_saldo === "zerado" ? " · saldo do Meta zerado" : ""}`;
  const lucroCls = fin.lucro < 0 ? "neg" : "";

  return (
    <>
      <div className="grid k5">
        <Tile main label="Lucro do mês (caixa)" valor={brl(fin.lucro)} cls={lucroCls}
          sub={`recebido ${brl(fin.recebido)} menos pago ${brl(fin.pago)}. Regime de caixa, não competência.`} onClick={() => c.go({ view: "financeiro" })} />
        <Tile label="Recebido no mês" valor={brl(fin.recebido)} sub={<>{plural(fin.recebido_n, "fatura paga", "faturas pagas")}{dv != null && <> · {dv >= 0 ? "+" : ""}{Math.round(dv * 100)}% vs mês anterior</>}</>} onClick={() => c.det("faturas_pagas")} />
        <Tile label="Caixa (saldo nos bancos)" valor={brl(fin.saldo_bancos)} sub={`${fin.bancos.length} contas · ${brl(fin.a_pagar_7d)} a pagar em 7 dias`} onClick={() => c.det("bancos")} />
        <Tile label="MRR" valor={brl(fin.mrr)} sub={<>{plural(fin.mrr_n, "mensalidade ativa", "mensalidades ativas")} · {brl(fin.mrr_em_aviso)} em aviso{d.frente?.concentracao && <><br /><span className="nd">{brl(d.frente.concentracao.mrr_base)} com fatura a vencer</span></>}</>} onClick={() => c.go({ view: "receita" })} />
        <Tile label="Inadimplência" valor={brl(fin.vencidas)} sub={`${plural(fin.vencidas_n, "fatura vencida", "faturas vencidas")} · ${fin.vencidas_7d_n} há mais de 7 dias`} onClick={() => c.det("faturas_vencidas")} />
      </div>

      <div className="grid r2">
        <Panel titulo="Funil único · mês" sub="tráfego + comercial no mesmo número. Arraste pra girar, clique numa etapa pra ver os registros.">
          <FunilMes etapas={etapasFunil} selo={selo} onSelo={() => c.go({ view: "trafego" })} />
          <div className="ft">
            <div onClick={() => c.det("vendas")}><small>Receita vendida</small><b>{brl(com.receita)}</b></div>
            <div onClick={() => c.det("vendas")}><small>Ticket médio</small><b>{brl(com.ticket)}</b></div>
            <div onClick={() => c.go({ view: "trafego" })}><small>ROAS</small><b className={tra.roas == null ? "nd" : ""}>{tra.roas == null ? "-" : `${num(tra.roas)}x`}</b></div>
            <div onClick={() => c.go({ view: "trafego" })}><small>CAC (só mídia)</small><b className={tra.cac == null ? "nd" : ""}>{brl(tra.cac)}</b></div>
            <div onClick={() => c.det("reunioes", { tipo: "no_show" }, "No-show")}><small>No-show</small><b>{fp(com.presenca == null ? null : 1 - com.presenca)}</b></div>
          </div>
        </Panel>

        {/* O card acompanha a altura do funil ao lado e rola por dentro: com 10
            alertas ele esticava a linha inteira e o funil ficava com meio card vazio. */}
        <Panel cls="alertas" titulo="Exige sua decisão" sub={`${d.alertas.length} ${d.alertas.length === 1 ? "item" : "itens"}`}>
          <div className="alertas-lista">
            {d.alertas.length === 0 && <div className="empty">Nada fora do padrão neste mês.</div>}
            {d.alertas.map((a, i) => (
              <button type="button" key={i} className={`ai ${a.gravidade}`} onClick={() => alertaAbre(c, a.titulo, a.view)}>
                <div><b>{a.titulo}</b><em>{a.detalhe}</em></div>
                <span className="chip">Atuar</span>
              </button>
            ))}
          </div>
          <div className="note">Alertas calculados no banco a partir do estado de hoje. Clique pra ver os registros e resolver no Nexus.</div>
        </Panel>
      </div>

      {/* Pra frente: o que ainda dá pra mudar. Cada cartão abre a sua tela. */}
      <div className="p frente">
        <div className="h"><b>Pra frente</b><span>o que ainda dá pra mudar. Os números de cima contam o que já aconteceu.</span></div>
        <div className="kg">
          {(() => { const f = caixaFrase(d.frente?.caixa); return <Tile label="Caixa em 30 dias (realista)" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "caixa" })} />; })()}
          {(() => { const f = ritmoFrase(d.frente?.ritmo); return <Tile label="Ritmo da meta" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "meta" })} />; })()}
          {(() => { const f = reunioesFrase(d.frente?.antecedentes); return <Tile label="Reuniões da semana" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "antecedentes" })} />; })()}
          {(() => { const f = coberturaFrase(d.frente?.antecedentes); return <Tile label="Cobertura do pipeline" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "antecedentes" })} />; })()}
          {(() => { const f = fundadorFrase(d.frente?.fundador); return <Tile label="Dependência do fundador" valor={f.valor} cls={f.cls} sub={f.sub} onClick={() => c.go({ view: "fundador" })} />; })()}
        </div>
      </div>

      <div className="grid r4">
        <Panel titulo="Tráfego pago" onClick={() => c.go({ view: "trafego" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Gasto mês</small><b className={tra.tem_dados ? "" : "nd"}>{tra.tem_dados ? brl(tra.spend) : "-"}</b></div>
            <div><small>CPL (Meta)</small><b className={tra.cpl == null ? "nd" : ""}>{brl(tra.cpl)}</b></div>
            <div><small>ROAS</small><b className={tra.roas == null ? "nd" : ""}>{tra.roas == null ? "-" : `${num(tra.roas)}x`}</b></div>
          </div>
          {tra.tem_dados ? (
            <Tabela cols={[{ h: "Campanha", tl: true }, "Gasto", "Leads"]} rows={tra.campanhas.slice(0, 5).map((x) => [<span title={x.nome}>{x.nome.length > 28 ? x.nome.slice(0, 27) + "…" : x.nome}</span>, brl(x.spend), num(x.leads, 0)])} />
          ) : <div className="empty">Sem linhas da Meta neste mês.</div>}
          <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
            <MetaSaldoTxt meta={tra.meta} />
            {contaTxt(tra.meta) && <span className="msync"><span className="nd">{contaTxt(tra.meta)}</span></span>}
            <MetaStatusTxt meta={tra.meta} />
          </div>
        </Panel>

        <Panel titulo="Comercial" onClick={() => c.go({ view: "comercial" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Vendas mês</small><b>{num(com.vendas, 0)}</b></div>
            <div><small>Receita vendida</small><b>{brl(com.receita)}</b></div>
            <div><small>Reunião → venda</small><b>{fp(com.conv_reuniao_venda)}</b></div>
          </div>
          <div className="lbl" style={{ marginBottom: 7 }}>Quem agenda · presença</div>
          {com.por_sdr.filter((s) => s.agendadas + s.realizadas + s.no_show >= 3).map((s) => {
            const tot = s.realizadas + s.no_show;
            return <Rank key={s.id} nome={s.nome} p={tot ? s.realizadas / tot : 0} bad={tot > 0 && s.realizadas / tot < 0.5}
              det={<><b>{s.agendadas}</b> agendadas · <b>{s.realizadas}</b> realizadas · <b>{s.no_show}</b> no-show · <b>{s.vendas}</b> vendas</>}
              onClick={() => c.go({ view: "comercial", f: { sdr: s.id } })} />;
          })}
          {!com.por_sdr.length && <div className="empty">Sem reuniões creditadas no mês.</div>}
          <div className="lbl" style={{ margin: "12px 0 7px" }}>Closer · reunião para venda</div>
          {com.por_closer.map((s) => (
            <Rank key={s.id} nome={s.nome} p={s.realizadas ? Math.min(s.vendas / s.realizadas, 1) : 0} bad={s.realizadas > 3 && s.vendas / s.realizadas < 0.15}
              det={<><b>{s.realizadas}</b> realizadas · <b>{s.vendas}</b> vendas · <b>{brl(s.receita)}</b></>}
              onClick={() => c.go({ view: "comercial", f: { closer: s.id } })} />
          ))}
        </Panel>

        <Panel titulo="Clientes e entrega" onClick={() => c.go({ view: "clientes" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Clientes ativos</small><b>{num(cli.ativas, 0)}</b></div>
            <div><small>NPS do mês</small><b className={cli.nps == null ? "nd" : ""}>{cli.nps == null ? "-" : `${num(cli.nps)} (${cli.nps_n})`}</b></div>
            <div><small>Churn do mês</small><b>{num(cli.churn_n, 0)}</b></div>
          </div>
          <Tabela cols={[{ h: "Indicador", tl: true }, "Valor"]} rows={[
            ["Health score médio", cli.health.media == null ? <Nd /> : `${num(cli.health.media)} de 100`],
            ["Críticos ou em risco", <span className={cli.health.critical + cli.health.at_risk ? "neg" : ""}>{num(cli.health.critical + cli.health.at_risk, 0)}</span>],
            ["Em aviso de saída", num(cli.em_aviso, 0)],
            ["Novos no mês", num(cli.novos, 0)],
            ["Tarefas atrasadas", num(cli.tarefas_atrasadas, 0)],
            ["CSAT do mês", cli.csat == null ? <Nd /> : `${num(cli.csat)} de 5 (${cli.csat_n})`],
          ]} />
        </Panel>

        <Panel titulo="Atendimento e IA" onClick={() => c.go({ view: "atendimento" })} more="Abrir detalhes">
          <div className="mini">
            <div><small>Conversas mês</small><b>{num(ate.conversas, 0)}</b></div>
            <div><small>Sem resposta +24 h</small><b className={ate.esperando_24h ? "neg" : ""}>{num(ate.esperando_24h, 0)}</b></div>
            <div><small>Custo IA mês</small><b>{usd(ia.custo_usd)}</b></div>
          </div>
          <Tabela cols={[{ h: "Indicador", tl: true }, "Valor"]} rows={[
            ["Mensagens recebidas", num(ate.recebidas, 0)],
            ["Mensagens enviadas", `${num(ate.enviadas, 0)} (${fp(pct(ate.enviadas_ia, ate.enviadas))} pela IA)`],
            ["Agentes ativos", num(ia.agentes_ativos, 0)],
            ["Respostas de agente", num(ia.runs_auto, 0)],
            ["Follow-ups de agente", num(ia.runs_followup, 0)],
            ["WhatsApp oficial", `${num(ia.wa_msgs, 0)} msgs · ${brl(ia.wa_custo)}`],
          ]} />
        </Panel>
      </div>

      <div className="grid r3">
        <Panel titulo="Financeiro · mês a mês" sub="recebido por mês, últimos 12 meses. Clique num mês pra trocar o painel inteiro.">
          <div className="fin">
            <Barras serie={d.serie} mes={mes} fn={(m) => m.recebido} fmt={kfmt} sub={(m) => (m.recebido_n ? `${m.recebido_n} fat.` : "")} onMes={c.setMes} />
            <div>
              <Tabela cols={[{ h: "Linha", tl: true }, "Valor", "Obs."]} onRow={(i) => [() => c.det("faturas_pagas"), () => c.det("faturas_a_receber"), () => c.det("faturas_vencidas"), () => c.det("contas_pagas"), () => c.det("contas_a_pagar"), () => c.go({ view: "financeiro" }), () => c.det("bancos")][i]()} hl={5} rows={[
                ["Recebido", brl(fin.recebido), dv == null ? <Nd /> : `${dv >= 0 ? "+" : ""}${Math.round(dv * 100)}% vs mês ant.`],
                ["A receber no mês", brl(fin.a_receber), `${fin.a_receber_n} faturas`],
                ["Vencido (acumulado)", brl(fin.vencidas), `${fin.vencidas_n} faturas`],
                ["(–) Pago no mês", brl(fin.pago), `${fin.pago_n} contas`],
                ["A pagar no mês", brl(fin.a_pagar), `${fin.a_pagar_n} contas`],
                ["= Lucro (caixa)", <span className={lucroCls}>{brl(fin.lucro)}</span>, fp(pct(fin.lucro, fin.recebido)) + " do recebido"],
                ["Saldo nos bancos", brl(fin.saldo_bancos), `${fin.bancos.length} contas`],
              ]} />
              <button type="button" className="back" style={{ marginTop: 12 }} onClick={() => c.go({ view: "financeiro" })}>Abrir detalhes do financeiro</button>
            </div>
          </div>
        </Panel>
        <Panel titulo="Roda sozinho · mês" sub="sem passar por você" onClick={() => c.go({ view: "automacoes" })} more="Abrir detalhes">
          <Tabela cols={[{ h: "O que", tl: true }, "Qtd"]} rows={[
            ["Respostas de agente de IA", num(roda.agente_respostas, 0)],
            ["Follow-ups de agente", num(roda.agente_followups, 0)],
            ["Cobranças automáticas", num(roda.cobrancas, 0)],
            ["Disparos pela API oficial", num(roda.disparos, 0)],
            ["Automações do CRM", num(roda.automacoes_crm, 0)],
            ["Lembretes de reunião", num(roda.lembretes_reuniao, 0)],
            ["Leads do formulário da Meta", num(roda.leads_formulario_meta, 0)],
          ]} />
        </Panel>
      </div>

      <div className="foot">Dados reais do banco do Nexus. Onde aparece "-" ou "sem fonte", a informação ainda não existe no sistema. Clique em qualquer número pra ver os registros. <Lk onClick={() => c.go({ view: "fontes" })}>De onde vem cada número</Lk></div>
    </>
  );
}

/** cada alerta abre a lista certa, não só a área */
function alertaAbre(c: Ctx, titulo: string, view: string) {
  const t = titulo.toLowerCase();
  // Meta Ads (sem conta, sync parado, sem investimento): a tela de Tráfego tem o botão de atualizar e o gasto por dia
  if (t.includes("meta")) return c.go({ view: "trafego" });
  if (view === "caixa" && t.includes("vencidas há mais de 30 dias")) return c.det("caixa_movimentos", { tipo: "saida", classe: "vencida_antiga" }, "Contas a pagar vencidas há mais de 30 dias");
  if (view === "antecedentes" && t.includes("sem dono")) return c.det("leads_atencao", { tipo: "sem_dono" }, "Leads sem dono");
  if (view === "caixa" || view === "fundador" || view === "antecedentes") return c.go({ view });
  if (t.includes("fatura")) return c.det("faturas_vencidas");
  if (t.includes("saldo")) return c.det("contas_a_pagar", {}, "Contas a pagar dos próximos dias");
  if (t.includes("conta") && t.includes("pagar")) return c.det("contas_a_pagar");
  if (t.includes("contrato")) return c.det("clientes", { tipo: "vencendo" }, "Contratos vencendo em 30 dias");
  if (t.includes("aviso")) return c.det("clientes", { tipo: "em_aviso" }, "Clientes em aviso de saída");
  if (t.includes("venda")) return c.det("vendas");
  if (t.includes("conversa")) return c.det("conversas_esperando", { mais_24h: true }, "Conversas sem resposta há mais de 24 h");
  if (t.includes("custo de ia")) return c.det("ia_dia");
  if (t.includes("health")) return c.det("clientes", { tipo: "health_baixo" }, "Clientes com health score baixo");
  if (t.includes("tarefas atrasadas")) {
    const r = c.d.clientes.tarefas_por_responsavel.find((x) => titulo.startsWith(x.nome));
    return c.det("tarefas_atrasadas", r?.staff_id ? { staff_id: r.staff_id } : {}, r ? `Tarefas atrasadas de ${r.nome}` : undefined);
  }
  if (t.includes("checkup")) return c.det("checkup");
  if (t.includes("nps")) return c.det("nps");
  c.go({ view: view as any });
}


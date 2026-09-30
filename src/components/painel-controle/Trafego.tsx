// Tráfego pago: gasto, leads, CPL, ROAS, CAC e campanhas da Meta.
import type { Ctx } from "./ctx";
import { Barras, HRow, Lk, Nd, Panel, Tabela, Tile } from "./ui";
import { brl, fp, kfmt, num, pct } from "./fmt";
import { LINK } from "./util";

export function Trafego({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const tra = d.trafego, com = d.comercial;
  const tem = tra.tem_dados;
  const base = Math.max(tra.leads_meta, tra.leads_pagos_crm, 1);
  return (
    <>
      <div className="kg">
        <Tile label="Gasto em mídia" valor={tem ? brl(tra.spend) : "-"} sub={tem ? `${tra.campanhas.length} campanhas com gasto` : "sem linhas da Meta no mês"} onClick={() => c.det("campanhas")} />
        <Tile label="CPL (Meta)" valor={tem ? brl(tra.cpl) : "-"} sub={tem ? `${num(tra.leads_meta, 0)} leads reportados pela Meta` : undefined} onClick={() => c.det("campanhas")} />
        <Tile label="Leads pagos no CRM" valor={num(tra.leads_pagos_crm, 0)} sub="origem Meta ou utm de Facebook/Instagram" onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
        <Tile label="Custo por lead no CRM" valor={tem ? brl(tra.leads_pagos_crm ? tra.spend / tra.leads_pagos_crm : null) : "-"} sub="gasto / leads pagos que chegaram no CRM" onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
        <Tile label="Vendas de leads pagos" valor={num(tra.vendas_leads_pagos, 0)} sub={brl(tra.receita_leads_pagos) + " de receita"} onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
        <Tile label="ROAS" valor={tra.roas == null ? "-" : `${num(tra.roas)}x`} sub="receita de leads pagos / gasto" onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
        <Tile label="CAC (só mídia)" valor={brl(tra.cac)} sub={`gasto / ${num(com.vendas, 0)} vendas do mês. Sem custo do discador e do time.`} onClick={() => c.det("vendas")} />
        <Tile label="Custo por reunião agendada" valor={brl(tra.custo_reuniao_agendada)} sub={`realizada: ${brl(tra.custo_reuniao_realizada)}`} onClick={() => c.det("reunioes", { tipo: "scheduled" }, "Reuniões agendadas")} />
        <Tile label="Custo do discador" valor="-" sub="sem fonte. O discador da UNV não registra custo por ligação." onClick={() => c.go({ view: "fontes" })} />
        <Tile label="Impressões e cliques" valor={tem ? num(tra.impressoes, 0) : "-"} sub={tem ? `${num(tra.cliques, 0)} cliques · CTR ${fp(pct(tra.cliques, tra.impressoes))}` : undefined} onClick={() => c.det("campanhas_dia")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Funil do tráfego" sub="da Meta até a venda">
          <HRow nome="Leads na Meta" p={tem ? tra.leads_meta / base : null} v={tem ? num(tra.leads_meta, 0) : "-"} c="formulários e conversões" onClick={() => c.det("campanhas")} />
          <HRow nome="Leads pagos no CRM" p={tra.leads_pagos_crm / base} v={num(tra.leads_pagos_crm, 0)} c={tem ? `${fp(pct(tra.leads_pagos_crm, tra.leads_meta))} do reportado` : ""} onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
          <HRow nome="Vendas de leads pagos" p={tra.vendas_leads_pagos / base} v={num(tra.vendas_leads_pagos, 0)} c={fp(pct(tra.vendas_leads_pagos, tra.leads_pagos_crm)) + " dos leads pagos"} hi onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
          <div className="note">Lead pago = lead do CRM com meta_campaign_id, meta_lead_id ou utm_source de Facebook/Instagram. Diferença entre "leads na Meta" e "no CRM" é lead que a Meta contou e não virou cadastro (ou chegou por outro caminho).</div>
        </Panel>
        <Panel titulo="Gasto mês a mês" sub="Meta Ads, linhas diárias somadas"><Barras serie={d.serie} mes={mes} fn={(m) => m.spend} fmt={kfmt} sub={(m) => (m.leads_meta != null ? `${m.leads_meta} leads` : "")} onMes={c.setMes} /></Panel>
      </div>

      <Panel titulo="Campanhas" sub="clique na campanha pra ver dia a dia">
        <Tabela cols={[{ h: "Campanha", tl: true }, "Status", "Gasto", "Leads Meta", "CPL", "Impressões", "Cliques", "CTR"]}
          onRow={(i) => c.det("campanhas_dia", { campaign_id: tra.campanhas[i].campaign_id }, `Dia a dia · ${tra.campanhas[i].nome}`)}
          rows={tra.campanhas.map((x) => [x.nome, x.status ?? <Nd />, brl(x.spend), num(x.leads, 0), brl(x.leads ? x.spend / x.leads : null), num(x.impressoes, 0), num(x.cliques, 0), fp(pct(x.cliques, x.impressoes))])}
          vazio="Sem campanhas com dados neste mês." />
        <div className="note"><Lk onClick={() => c.det("campanhas")}>Ver campanhas com leads e vendas do CRM</Lk> · <Lk onClick={() => c.abrir(LINK.trafego)} ext>Abrir Tráfego pago no CRM</Lk></div>
      </Panel>
    </>
  );
}

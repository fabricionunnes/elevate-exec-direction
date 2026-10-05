// Tráfego pago: conexão do Meta Ads, gasto, leads, CPL, ROAS, CAC, gasto por dia
// e campanhas. Campanha abre os conjuntos, conjunto abre os anúncios.
import type { Ctx } from "./ctx";
import { Barras, BarrasItens, HRow, Lk, Nd, Panel, Tabela, Tile, type ItemBarra } from "./ui";
import { brl, brlFull, dataBR, fp, fp2, kfmt, num, pct } from "./fmt";
import { LINK } from "./util";
import { MetaSync } from "./MetaSync";

export function Trafego({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const tra = d.trafego, com = d.comercial;
  const tem = tra.tem_dados;
  const meta = tra.meta;
  const base = Math.max(tra.leads_meta, tra.leads_pagos_crm, 1);
  const comGasto = tra.campanhas.filter((x) => x.spend > 0).length;

  // todos os dias do mês, pra barra não esconder dia sem linha na Meta
  const porDia = new Map((tra.por_dia ?? []).map((x) => [x.dia, x]));
  const ano = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  const nDias = new Date(ano, m, 0).getDate();
  const dias: ItemBarra[] = Array.from({ length: nDias }, (_, i) => {
    const k = `${mes.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
    const x = porDia.get(k);
    return { k, rot: String(i + 1), v: x ? Number(x.spend) : null, tip: x ? `${dataBR(k)}: ${brlFull(x.spend)} · ${x.leads} leads · ${x.campanhas} campanhas com gasto` : `${dataBR(k)}: sem linha da Meta` };
  });
  const melhorDia = [...(tra.por_dia ?? [])].sort((a, b) => b.spend - a.spend)[0];

  return (
    <>
      <div className="p">
        <MetaSync meta={meta} sincronizando={c.sincronizando} onSync={c.syncMeta} abrir={c.abrir} completo />
      </div>

      <div className="kg">
        <Tile label="Gasto em mídia" valor={tem ? brl(tra.spend) : "-"}
          sub={!tem ? "sem linhas da Meta no mês" : comGasto ? `${comGasto} ${comGasto === 1 ? "campanha" : "campanhas"} com gasto` : `a Meta reportou zero no mês${meta?.ultimo_dia_com_gasto ? `. Último gasto em ${dataBR(meta.ultimo_dia_com_gasto)}` : ""}`}
          onClick={() => c.det("campanhas")} />
        <Tile label="CPL (Meta)" valor={tem ? brl(tra.cpl) : "-"} sub={tem ? `${num(tra.leads_meta, 0)} leads reportados pela Meta` : undefined} onClick={() => c.det("campanhas")} />
        <Tile label="Leads pagos no CRM" valor={num(tra.leads_pagos_crm, 0)} sub="origem Meta ou utm de Facebook/Instagram" onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
        <Tile label="Custo por lead no CRM" valor={tem ? brl(tra.leads_pagos_crm ? tra.spend / tra.leads_pagos_crm : null) : "-"} sub="gasto / leads pagos que chegaram no CRM" onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
        <Tile label="Vendas de leads pagos" valor={num(tra.vendas_leads_pagos, 0)} sub={brl(tra.receita_leads_pagos) + " de receita"} onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
        <Tile label="ROAS" valor={tra.roas == null ? "-" : `${num(tra.roas)}x`} sub="receita de leads pagos / gasto" onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
        <Tile label="CAC (só mídia)" valor={brl(tra.cac)} sub={`gasto / ${num(com.vendas, 0)} vendas do mês. Sem custo do discador e do time.`} onClick={() => c.det("vendas")} />
        <Tile label="Custo por reunião agendada" valor={brl(tra.custo_reuniao_agendada)} sub={`realizada: ${brl(tra.custo_reuniao_realizada)}`} onClick={() => c.det("reunioes", { tipo: "scheduled" }, "Reuniões agendadas")} />
        <Tile label="Impressões e cliques" valor={tem ? num(tra.impressoes, 0) : "-"}
          sub={tem ? `${num(tra.cliques, 0)} cliques · CTR ${fp2(pct(tra.cliques, tra.impressoes))} · CPC ${brlFull(tra.cliques ? tra.spend / tra.cliques : null)}` : undefined} onClick={() => c.det("meta_dia")} />
        <Tile label="CPM" valor={tem && tra.impressoes ? brlFull((tra.spend * 1000) / tra.impressoes) : "-"} sub="custo por mil impressões" onClick={() => c.det("meta_dia")} />
        <Tile label="Custo do discador" valor="-" sub="sem fonte. O discador da UNV não registra custo por ligação." onClick={() => c.go({ view: "fontes" })} />
      </div>

      <Panel titulo="Gasto por dia" sub={tem ? `clique num dia pra ver as campanhas dele${melhorDia && melhorDia.spend > 0 ? `. Maior gasto: ${dataBR(melhorDia.dia)}, ${brlFull(melhorDia.spend)}` : ""}` : "sem linhas da Meta neste mês"}>
        <BarrasItens denso itens={dias} fmt={(v) => brlFull(v)} onItem={(k) => c.det("campanhas_dia", { dia: k }, `Campanhas em ${dataBR(k)}`)} />
        <div className="note"><Lk onClick={() => c.det("meta_dia")}>Ver a tabela dia a dia com CTR, CPC, CPM e leads</Lk>. Dia sem barra é dia sem linha na Meta (nenhuma campanha entregando); barra zerada é dia que a Meta reportou sem gasto.</div>
      </Panel>

      <div className="grid g2">
        <Panel titulo="Funil do tráfego" sub="da Meta até a venda">
          <HRow nome="Leads na Meta" p={tem ? tra.leads_meta / base : null} v={tem ? num(tra.leads_meta, 0) : "-"} c="formulários e conversões" onClick={() => c.det("campanhas")} />
          <HRow nome="Leads pagos no CRM" p={tra.leads_pagos_crm / base} v={num(tra.leads_pagos_crm, 0)} c={tem ? `${fp(pct(tra.leads_pagos_crm, tra.leads_meta))} do reportado` : ""} onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
          <HRow nome="Vendas de leads pagos" p={tra.vendas_leads_pagos / base} v={num(tra.vendas_leads_pagos, 0)} c={fp(pct(tra.vendas_leads_pagos, tra.leads_pagos_crm)) + " dos leads pagos"} hi onClick={() => c.det("vendas", { pago: true }, "Vendas de leads pagos")} />
          <div className="note">Lead pago = lead do CRM com meta_campaign_id, meta_lead_id ou utm_source de Facebook/Instagram. Diferença entre "leads na Meta" e "no CRM" é lead que a Meta contou e não virou cadastro (ou chegou por outro caminho).</div>
        </Panel>
        <Panel titulo="Gasto mês a mês" sub="Meta Ads, linhas diárias somadas"><Barras serie={d.serie} mes={mes} fn={(x) => x.spend} fmt={kfmt} sub={(x) => (x.leads_meta != null ? `${x.leads_meta} leads` : "")} onMes={c.setMes} /></Panel>
      </div>

      <Panel titulo="Campanhas" sub="clique na campanha pra abrir os conjuntos; de lá, os anúncios" cls="wide">
        <Tabela cols={[{ h: "Campanha", tl: true }, "Status", "Gasto", "Impressões", "Cliques", "CTR", "CPC", "CPM", "Leads Meta", "CPL", "Leads no CRM", "Vendas", "Receita"]}
          onRow={(i) => c.det("meta_conjuntos", { campaign_id: tra.campanhas[i].campaign_id }, `Conjuntos · ${tra.campanhas[i].nome}`)}
          rows={tra.campanhas.map((x) => [
            x.nome, x.status ?? <Nd />, brlFull(x.spend), num(x.impressoes, 0), num(x.cliques, 0), fp2(pct(x.cliques, x.impressoes)),
            brlFull(x.cliques ? x.spend / x.cliques : null), brlFull(x.impressoes ? (x.spend * 1000) / x.impressoes : null),
            num(x.leads, 0), brlFull(x.leads ? x.spend / x.leads : null), num(x.leads_crm, 0), num(x.vendas_crm, 0), x.vendas_crm ? brl(x.receita_crm) : <Nd />,
          ])}
          vazio="Sem campanhas com dados neste mês." />
        <div className="note">
          <Lk onClick={() => c.det("meta_conjuntos", {}, "Todos os conjuntos do mês")}>Todos os conjuntos</Lk> · <Lk onClick={() => c.det("meta_anuncios", {}, "Todos os anúncios do mês")}>Todos os anúncios</Lk> · <Lk onClick={() => c.det("campanhas_dia")}>Campanha por dia</Lk> · <Lk onClick={() => c.abrir(LINK.crm)} ext>Abrir Tráfego Pago no CRM</Lk>.
          {" "}Leads no CRM, vendas e receita vêm do lead que guardou o id da campanha (meta_campaign_id).
        </div>
      </Panel>
    </>
  );
}

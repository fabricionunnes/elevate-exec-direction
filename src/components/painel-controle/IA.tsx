// IA e custos de automação: crédito da API, WhatsApp oficial, agentes.
import type { Ctx } from "./ctx";
import { Barras, Lk, Nd, Panel, St, Tabela, Tile } from "./ui";
import { brl, fp, num, pct, usd } from "./fmt";
import { LINK } from "./util";

export function IA({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const ia = d.ia;
  return (
    <>
      <div className="kg">
        <Tile label="Custo de IA no mês" valor={usd(ia.custo_usd)} sub={ia.custo_brl != null ? `${brl(ia.custo_brl)} a R$ ${num(ia.dolar ?? 0, 2)} · ${num(ia.chamadas, 0)} chamadas` : `${num(ia.chamadas, 0)} chamadas`} onClick={() => c.det("ia_dia")} />
        <Tile label="Hoje contra o teto diário" valor={ia.teto_dia_usd ? fp(ia.pct_teto_hoje) : "-"} sub={ia.teto_dia_usd ? `${usd(ia.custo_hoje_usd)} de ${usd(ia.teto_dia_usd)} por dia` : "sem teto configurado"} cls={ia.pct_teto_hoje != null && ia.pct_teto_hoje >= 0.8 ? "neg" : ""} onClick={() => c.det("ia_dia")} />
        <Tile label="Mês contra o teto" valor={ia.teto_mes_usd ? fp(ia.pct_teto_mes) : "-"} sub={ia.teto_mes_usd ? `teto do mês seria ${usd(ia.teto_mes_usd)} (diário x dias)` : undefined} onClick={() => c.det("ia_dia")} />
        <Tile label="WhatsApp oficial" valor={brl(ia.wa_custo)} sub={`${num(ia.wa_msgs, 0)} mensagens enviadas · teto ${ia.wa_teto ? num(ia.wa_teto, 0) + " msgs" : "-"}`} cls={ia.wa_teto && ia.wa_msgs >= ia.wa_teto ? "neg" : ""} onClick={() => c.det("wa_numeros")} />
        <Tile label="Agentes ativos" valor={num(ia.agentes_ativos, 0)} sub={`${num(ia.runs, 0)} execuções no mês`} onClick={() => c.det("automacoes")} />
        <Tile label="Mensagens de agente" valor={num(ia.runs_enviadas, 0)} sub={`${num(ia.runs_auto, 0)} respostas · ${num(ia.runs_followup, 0)} follow-ups`} onClick={() => c.det("agente_runs", { outcome: "sent" }, "Mensagens enviadas por agente")} />
        <Tile label="Opt-out" valor={num(ia.runs_opt_out, 0)} sub={fp(pct(ia.runs_opt_out, ia.runs_enviadas)) + " das mensagens enviadas"} onClick={() => c.det("agente_runs", { outcome: "opt_out" }, "Pedidos de opt-out")} />
        <Tile label="Automações ativas" valor={num(ia.automacoes_ativas, 0)} sub={`${num(ia.automacoes_runs, 0)} execuções no mês`} onClick={() => c.det("automacoes")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Custo de IA mês a mês" sub="em dólar, estimado pelos tokens"><Barras serie={d.serie} mes={mes} fn={(m) => m.custo_ia} fmt={(v) => `$${num(v, 0)}`} onMes={c.setMes} /></Panel>
        <Panel titulo="Custo por função" sub="clique pra ver dia a dia">
          <Tabela cols={[{ h: "Função", tl: true }, "Custo", "Chamadas", "Por chamada", "% do mês"]} onRow={(i) => c.det("ia_dia", { fn: ia.por_fn[i].nome }, `Custo por dia · ${ia.por_fn[i].nome}`)}
            rows={ia.por_fn.map((x) => [x.nome, usd(x.custo), num(x.chamadas, 0), usd(x.chamadas ? x.custo / x.chamadas : null), fp(pct(x.custo, ia.custo_usd))])} vazio="Sem uso medido no mês." />
        </Panel>
      </div>

      <Panel titulo="Agentes de IA" sub="execuções por agente no mês. Clique na linha pra ver cada mensagem.">
        <Tabela cols={[{ h: "Agente", tl: true }, "Ativo", "Execuções", "Enviadas", "Follow-ups", "Opt-out", "Situação"]}
          onRow={(i) => c.det("agente_runs", { agent_id: (ia.por_agente[i] as any).id }, `Ações · ${ia.por_agente[i].nome}`)}
          rows={ia.por_agente.map((x) => [x.nome, x.ativo ? "sim" : <Nd>não</Nd>, num(x.runs, 0), num(x.enviadas, 0), num(x.followups, 0), num(x.opt_out, 0),
            <St ok={x.enviadas > 0 && x.opt_out / Math.max(x.enviadas, 1) < 0.1} warn={x.enviadas > 0} tg="rodando" tw="muito opt-out" tb="sem envio" />])} vazio="Nenhum agente rodou no mês." />
        <div className="note"><Lk onClick={() => c.abrir(LINK.agentes)} ext>Abrir Agentes de IA no CRM</Lk> · <Lk onClick={() => c.abrir(LINK.custoIa)} ext>Abrir Custo de IA</Lk> · <Lk onClick={() => c.det("wa_templates")}>Disparos por template</Lk></div>
      </Panel>
    </>
  );
}

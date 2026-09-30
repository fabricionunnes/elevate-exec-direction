// Roda sozinho: o que os agentes e automações fizeram no mês sem passar pelo dono.
import type { Ctx } from "./ctx";
import { Barras, Lk, Panel, Tabela, Tile } from "./ui";
import { num } from "./fmt";
import { LINK } from "./util";

export function Automacoes({ c }: { c: Ctx }) {
  const { d, mes } = c;
  const r = d.roda_sozinho;
  return (
    <>
      <div className="kg">
        <Tile label="Respostas de agente de IA" valor={num(r.agente_respostas, 0)} sub="WhatsApp e Instagram, modo automático" onClick={() => c.det("agente_runs", { mode: "auto", outcome: "sent" }, "Respostas automáticas de agente")} />
        <Tile label="Follow-ups de agente" valor={num(r.agente_followups, 0)} sub="lead que parou de responder" onClick={() => c.det("agente_runs", { mode: "followup", outcome: "sent" }, "Follow-ups de agente")} />
        <Tile label="Cobranças automáticas" valor={num(r.cobrancas, 0)} sub="régua de cobrança por WhatsApp" onClick={() => c.det("cobrancas")} />
        <Tile label="Disparos pela API oficial" valor={num(r.disparos, 0)} sub="mensagens de template enviadas" onClick={() => c.det("wa_templates")} />
        <Tile label="Automações do CRM" valor={num(r.automacoes_crm, 0)} sub="distribuição de lead e regras" onClick={() => c.det("automacao_runs")} />
        <Tile label="Lembretes de reunião" valor={num(r.lembretes_reuniao, 0)} sub="enviados ao lead antes da reunião" onClick={() => c.det("lembretes")} />
        <Tile label="Leads do formulário da Meta" valor={num(r.leads_formulario_meta, 0)} sub="entraram no CRM sem digitação" onClick={() => c.det("leads", { pago: true }, "Leads de origem paga")} />
        <Tile label="Leads criados sem usuário" valor={num(r.leads_sem_criador, 0)} sub="integração, formulário ou prospecção" onClick={() => c.det("leads")} />
        <Tile label="Follow-ups personalizados" valor={num(r.followups_personalizados, 0)} sub="com notícia da empresa do lead" onClick={() => c.det("automacoes")} />
        <Tile label="Atividades automáticas" valor={num(r.atividades_automaticas, 0)} sub="tarefas criadas por automação de etapa" onClick={() => c.det("automacoes")} />
      </div>
      <div className="grid g2">
        <Panel titulo="Mensagens de agente mês a mês" sub="respostas e follow-ups enviados"><Barras serie={d.serie} mes={mes} fn={(m) => m.agente_msgs} fmt={(v) => num(v, 0)} onMes={c.setMes} /></Panel>
        <Panel titulo="Cadastro" sub="tudo que pode rodar sozinho">
          <Tabela cols={[{ h: "Tipo", tl: true }, "Ativas"]} onRow={() => c.det("automacoes")} rows={[
            ["Agentes de IA", num(d.ia.agentes_ativos, 0)],
            ["Automações do CRM e regras do Nexus", num(d.ia.automacoes_ativas, 0)],
            ["Números na API oficial", num(d.ia.wa_msgs ? 1 : 0, 0)],
          ]} />
          <div className="note"><Lk onClick={() => c.det("automacoes")}>Ver a lista completa com execuções</Lk> · <Lk onClick={() => c.abrir(LINK.automacoes)} ext>Automações no CRM</Lk> · <Lk onClick={() => c.abrir(LINK.automacoesNexus)} ext>Automações do Nexus</Lk></div>
        </Panel>
      </div>
    </>
  );
}

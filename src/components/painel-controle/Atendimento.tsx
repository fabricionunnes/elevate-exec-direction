// Atendimento: WhatsApp e Instagram do CRM. Volume do mês e o que está parado.
import type { Ctx } from "./ctx";
import { Lk, Nd, Panel, Tabela, Tile } from "./ui";
import { fp, num, pct } from "./fmt";
import { LINK } from "./util";

export function Atendimento({ c }: { c: Ctx }) {
  const { d } = c;
  const a = d.atendimento;
  return (
    <>
      <div className="kg">
        <Tile label="Conversas com mensagem" valor={num(a.conversas, 0)} sub="no mês" onClick={() => c.det("conversas")} />
        <Tile label="Mensagens recebidas" valor={num(a.recebidas, 0)} sub="inbound no mês" onClick={() => c.det("conversas")} />
        <Tile label="Mensagens enviadas" valor={num(a.enviadas, 0)} sub={`${fp(pct(a.enviadas_ia, a.enviadas))} pela IA`} onClick={() => c.det("conversas")} />
        <Tile label="Enviadas pela IA" valor={num(a.enviadas_ia, 0)} sub="agentes respondendo" onClick={() => c.det("agente_runs", { outcome: "sent" }, "Mensagens enviadas por agente")} />
        <Tile label="Esperando resposta" valor={num(a.esperando, 0)} sub="última mensagem foi do cliente" onClick={() => c.det("conversas_esperando")} />
        <Tile label="Sem resposta há +24 h" valor={num(a.esperando_24h, 0)} sub={fp(pct(a.esperando_24h, a.esperando)) + " das que esperam"} cls={a.esperando_24h ? "neg" : ""} onClick={() => c.det("conversas_esperando", { mais_24h: true }, "Sem resposta há mais de 24 h")} />
      </div>

      <div className="grid g2">
        <Panel titulo="Esperando por atendente" sub="conversas abertas com a última mensagem do cliente">
          <Tabela cols={[{ h: "Atendente", tl: true }, "Esperando", "Mais de 24 h"]} onRow={() => c.det("conversas_esperando")}
            rows={a.por_atendente.map((x) => [x.nome, num(x.esperando, 0), <span className={x.mais_24h ? "neg" : ""}>{num(x.mais_24h, 0)}</span>])} vazio="Ninguém esperando." />
          <div className="note">"Sem atendente" é conversa que ninguém assumiu. Boa parte é grupo ou número de cliente na instância do consultor.</div>
        </Panel>
        <Panel titulo="Mais antigas sem resposta" sub="clique pra abrir no Atendimento">
          <Tabela cols={[{ h: "Contato", tl: true }, "Esperando há", "Atendente", { h: "Última mensagem", tl: true }]} rows={a.esperando_lista.slice(0, 15).map((x) => [
            <Lk ext onClick={() => c.abrir(LINK.conversa(x.conversation_id))}>{x.nome || "(sem nome)"}</Lk>, x.horas >= 48 ? `${Math.round(x.horas / 24)} dias` : `${x.horas} h`, x.atendente ?? <Nd />, <span className="nd">{(x.ultima || "").slice(0, 60)}</span>,
          ])} vazio="Nada parado." />
          <Lk onClick={() => c.det("conversas_esperando", { mais_24h: true }, "Sem resposta há mais de 24 h")}>Ver todas</Lk>
        </Panel>
      </div>
      <div className="note">Contagem de conversas e mensagens por created_at da mensagem; "esperando" é o estado de agora, não do mês. Última mensagem do cliente sem resposta = last_message_direction inbound em conversa aberta. Custo do WhatsApp oficial fica na tela de IA e automações.</div>
    </>
  );
}

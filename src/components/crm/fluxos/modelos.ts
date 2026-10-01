// Modelos prontos de fluxo. Todos nascem desligados, como qualquer fluxo novo.
// Posições em colunas pra já abrir organizado no canvas.
import { uid } from "./catalogo";

export interface ModeloFluxo {
  key: string; label: string; desc: string;
  build: () => { trigger_type: string; trigger_config: Record<string, any>; nodes: any[]; edges: any[] };
}

const col = (i: number, x = 260) => ({ x, y: 40 + i * 150 });
const ESQ = 20; const DIR = 500;
const ligar = (pares: [string, string, string?][]) =>
  pares.map(([source, target, h]) => ({ id: `${source}-${h || "default"}-${target}`, source, sourceHandle: h || "default", target }));

export const MODELOS: ModeloFluxo[] = [
  {
    key: "vazio", label: "Em branco", desc: "Só o gatilho. Você monta o resto.",
    build: () => ({ trigger_type: "manual", trigger_config: {}, nodes: [{ id: "t", type: "trigger", position: col(0), data: {} }], edges: [] }),
  },
  {
    key: "sla15", label: "SLA 15 minutos",
    desc: "Cliente escreveu e ninguém respondeu em 15 minutos úteis: avisa o responsável no app e no WhatsApp.",
    build: () => {
      const n = uid(), e = uid(), nota = uid();
      return {
        trigger_type: "no_reply", trigger_config: { minutes: 15, business_hours: true, only_new: true },
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: n, type: "notify", position: col(1), data: { label: "Avisar o responsável", message: "{nome} está sem resposta desde {esperando_desde} ({minutos_sla} min). Responde agora: {link_lead}", to: "owner", channel: "both", staff_ids: [], instance_id: "" } },
          { id: e, type: "end", position: col(2), data: {} },
          { id: nota, type: "note", position: { x: 560, y: 40 }, data: { text: "Conta só minutos em horário de trabalho. Conversa sem lead vinculado e grupo não entram. Quando alguém responde, o caso some sozinho." } },
        ],
        edges: ligar([["t", n], [n, e]]),
      };
    },
  },
  {
    key: "escalada60", label: "Escalada 60 minutos",
    desc: "Uma hora útil sem resposta: sobe pros gestores e cria tarefa urgente pro responsável.",
    build: () => {
      const n = uid(), k = uid(), e = uid();
      return {
        trigger_type: "no_reply", trigger_config: { minutes: 60, business_hours: true, only_new: true },
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: n, type: "notify", position: col(1), data: { label: "Avisar gestores", message: "ESCALADA: {nome} ({etapa}) está há mais de 1 hora sem resposta. Responsável: {responsavel}. {link_lead}", to: "managers", channel: "both", staff_ids: [], instance_id: "" } },
          { id: k, type: "create_task", position: col(2), data: { title: "Responder {primeiro_nome} agora (1 h sem resposta)", description: "Criada pela escalada de SLA.", activity_type: "whatsapp", days: 0, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
          { id: e, type: "end", position: col(3), data: {} },
        ],
        edges: ligar([["t", n], [n, k], [k, e]]),
      };
    },
  },
  {
    key: "parado3", label: "Lead parado 3 dias",
    desc: "Três dias sem movimento: negócio de R$ 5 mil ou mais avisa os gestores e cria tarefa; abaixo disso, só a tarefa de retomada.",
    build: () => {
      const c = uid(), n = uid(), k1 = uid(), k2 = uid(), e1 = uid(), e2 = uid();
      return {
        trigger_type: "lead_idle", trigger_config: { days: 3, only_new: true },
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: c, type: "condition", position: col(1), data: { label: "Negócio de R$ 5 mil ou mais?", logic: "and", rules: [{ field: "opportunity_value", op: "gte", value: "5000" }] } },
          { id: n, type: "notify", position: { x: ESQ, y: 340 }, data: { message: "{nome} ({valor}) está parado desde {parado_desde} em {etapa}. Responsável: {responsavel}. {link_lead}", to: "managers", channel: "app", staff_ids: [], instance_id: "" } },
          { id: k1, type: "create_task", position: { x: ESQ, y: 490 }, data: { title: "Retomar {primeiro_nome} hoje (negócio parado, {valor})", activity_type: "call", days: 0, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
          { id: k2, type: "create_task", position: { x: DIR, y: 340 }, data: { title: "Retomar {primeiro_nome} (parado desde {parado_desde})", activity_type: "followup", days: 1, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
          { id: e1, type: "end", position: { x: ESQ, y: 640 }, data: {} },
          { id: e2, type: "end", position: { x: DIR, y: 490 }, data: {} },
        ],
        edges: ligar([["t", c], [c, n, "yes"], [c, k2, "no"], [n, k1], [k1, e1], [k2, e2]]),
      };
    },
  },
  {
    key: "tarefa_atrasada", label: "Tarefa atrasada",
    desc: "Tarefa vencida há 2 horas: cobra o responsável. Se o negócio vale R$ 5 mil ou mais, os gestores também ficam sabendo.",
    build: () => {
      const n = uid(), c = uid(), g = uid(), e1 = uid(), e2 = uid();
      return {
        trigger_type: "activity_overdue", trigger_config: { hours: 2, only_new: true },
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: n, type: "notify", position: col(1), data: { label: "Cobrar o responsável", message: "Tarefa atrasada: \"{tarefa}\" (era pra {tarefa_data}) no lead {nome}. {link_lead}", to: "owner", channel: "both", staff_ids: [], instance_id: "" } },
          { id: c, type: "condition", position: col(2), data: { label: "Negócio de R$ 5 mil ou mais?", logic: "and", rules: [{ field: "opportunity_value", op: "gte", value: "5000" }] } },
          { id: g, type: "notify", position: { x: ESQ, y: 490 }, data: { label: "Avisar gestores", message: "Tarefa atrasada em negócio de {valor}: \"{tarefa}\" de {tarefa_responsavel}, lead {nome}. {link_lead}", to: "managers", channel: "app", staff_ids: [], instance_id: "" } },
          { id: e1, type: "end", position: { x: ESQ, y: 640 }, data: {} },
          { id: e2, type: "end", position: { x: DIR, y: 490 }, data: {} },
        ],
        edges: ligar([["t", n], [n, c], [c, g, "yes"], [c, e2, "no"], [g, e1]]),
      };
    },
  },
  {
    key: "boas_vindas", label: "Boas-vindas ao lead novo",
    desc: "Lead novo recebe a mensagem no horário de trabalho. Respondeu em 24 h: avisa o responsável. Não respondeu: tarefa de ligação.",
    build: () => {
      const w = uid(), m = uid(), r = uid(), n = uid(), k = uid(), e1 = uid(), e2 = uid(), nota = uid();
      return {
        trigger_type: "lead_created", trigger_config: {},
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: w, type: "wait", position: col(1), data: { label: "Esperar o expediente", mode: "business", value: 1, unit: "hours", respect_window: false } },
          { id: m, type: "send_whatsapp", position: col(2), data: { message: "Oi {primeiro_nome}, tudo bem? Aqui é da UNV. Recebi seu contato e quero entender seu cenário comercial. Posso te fazer duas perguntas rápidas?", instance_mode: "fixed", instance_kind: "evolution", instance_id: "", respect_window: true } },
          { id: r, type: "wait_reply", position: col(3), data: { hours: 24 } },
          { id: n, type: "notify", position: { x: ESQ, y: 640 }, data: { message: "{nome} respondeu a boas-vindas. Assume a conversa: {link_lead}", to: "owner", channel: "app", staff_ids: [], instance_id: "" } },
          { id: k, type: "create_task", position: { x: DIR, y: 640 }, data: { title: "Ligar pra {primeiro_nome} (não respondeu a boas-vindas)", activity_type: "call", days: 0, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
          { id: e1, type: "end", position: { x: ESQ, y: 790 }, data: {} },
          { id: e2, type: "end", position: { x: DIR, y: 790 }, data: {} },
          { id: nota, type: "note", position: { x: 560, y: 190 }, data: { text: "Antes de ativar: escolha o número que envia e use o filtro de funil no gatilho. Importação em massa não dispara este fluxo." } },
        ],
        edges: ligar([["t", w], [w, m], [m, r], [r, n, "replied"], [r, k, "timeout"], [n, e1], [k, e2]]),
      };
    },
  },
  {
    key: "no_show", label: "No-show: reagendar",
    desc: "Lead faltou à reunião: manda mensagem pra remarcar. Respondeu em 48 h: avisa o responsável. Não respondeu: tarefa de ligação.",
    build: () => {
      const m = uid(), r = uid(), n = uid(), k = uid(), e1 = uid(), e2 = uid(), nota = uid();
      return {
        trigger_type: "meeting_no_show", trigger_config: {},
        nodes: [
          { id: "t", type: "trigger", position: col(0), data: {} },
          { id: m, type: "send_whatsapp", position: col(1), data: { message: "{primeiro_nome}, não conseguimos nos falar no horário combinado. Sem problema, acontece. Qual o melhor dia e horário pra remarcarmos?", instance_mode: "conversation", instance_kind: "evolution", instance_id: "", respect_window: true } },
          { id: r, type: "wait_reply", position: col(2), data: { hours: 48 } },
          { id: n, type: "notify", position: { x: ESQ, y: 490 }, data: { message: "{nome} respondeu depois do no-show. Remarca a reunião: {link_lead}", to: "owner", channel: "both", staff_ids: [], instance_id: "" } },
          { id: k, type: "create_task", position: { x: DIR, y: 490 }, data: { title: "Ligar pra reagendar com {primeiro_nome} (no-show sem resposta)", activity_type: "call", days: 0, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
          { id: e1, type: "end", position: { x: ESQ, y: 640 }, data: {} },
          { id: e2, type: "end", position: { x: DIR, y: 640 }, data: {} },
          { id: nota, type: "note", position: { x: 560, y: 40 }, data: { text: "A mensagem sai pelo número por onde o lead já conversa. Se ele nunca conversou por nenhum número conectado, o envio falha e aparece nas Execuções." } },
        ],
        edges: ligar([["t", m], [m, r], [r, n, "replied"], [r, k, "timeout"], [n, e1], [k, e2]]),
      };
    },
  },
];

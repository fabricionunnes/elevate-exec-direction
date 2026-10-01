// Catálogo dos blocos do construtor de Fluxos (migration 20261001020000_crm_fluxos_motor).
// O que está aqui precisa bater com crm_flow_exec_node no banco: tipo do bloco, chaves do
// data e nomes das saídas. Portado do UNV Sales e adaptado ao schema do Nexus.
import {
  Play, GitBranch, Shuffle, Clock, MessageCircleReply, MessageCircle, ListTodo, Bell, ArrowRightLeft,
  Tag, Tags, UserCheck, PenLine, Calculator, Globe, Repeat2, Square, Workflow, StopCircle, StickyNote, type LucideIcon,
} from "lucide-react";

export type NodeType =
  | "trigger" | "condition" | "split" | "wait" | "wait_reply"
  | "send_whatsapp" | "create_task" | "notify" | "move_stage" | "add_tag" | "remove_tag"
  | "assign_owner" | "set_field" | "formula" | "webhook" | "enroll_cadence" | "stop_cadence" | "start_flow"
  | "note" | "end";

export interface Saida { id: string; label: string }
export type Grupo = "Início" | "Lógica" | "Mensagens" | "Ações" | "Dados" | "Organização";
export interface BlocoDef {
  label: string; desc: string; grupo: Grupo;
  icon: LucideIcon; cor: string; saidas: Saida[]; entrada: boolean; padrao: Record<string, any>;
}

export const CATALOGO: Record<NodeType, BlocoDef> = {
  trigger: { label: "Gatilho", desc: "Onde o fluxo começa", grupo: "Início", icon: Play, cor: "#16a34a", entrada: false, saidas: [{ id: "default", label: "" }], padrao: {} },
  condition: { label: "Condição", desc: "Se a regra vale, segue por Sim; senão, por Não", grupo: "Lógica", icon: GitBranch, cor: "#d97706", entrada: true, saidas: [{ id: "yes", label: "Sim" }, { id: "no", label: "Não" }], padrao: { logic: "and", rules: [{ field: "phone", op: "not_empty", value: "" }] } },
  split: { label: "Randomizador A/B", desc: "Sorteia o caminho por percentual", grupo: "Lógica", icon: Shuffle, cor: "#7c3aed", entrada: true, saidas: [{ id: "a", label: "A" }, { id: "b", label: "B" }], padrao: { percent_a: 50 } },
  wait: { label: "Esperar", desc: "Pausa por um tempo, até um horário ou até o horário de trabalho", grupo: "Lógica", icon: Clock, cor: "#64748b", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { mode: "duration", value: 1, unit: "hours", respect_window: false } },
  wait_reply: { label: "Esperar resposta", desc: "Aguarda o lead responder no WhatsApp", grupo: "Lógica", icon: MessageCircleReply, cor: "#0284c7", entrada: true, saidas: [{ id: "replied", label: "Respondeu" }, { id: "timeout", label: "Não respondeu" }], padrao: { hours: 24 } },
  send_whatsapp: { label: "Enviar WhatsApp", desc: "Mensagem de texto pro lead, com variáveis", grupo: "Mensagens", icon: MessageCircle, cor: "#16a34a", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { message: "", instance_mode: "conversation", instance_kind: "evolution", instance_id: "", respect_window: true } },
  notify: { label: "Avisar pessoas", desc: "Notificação no app e/ou WhatsApp do time", grupo: "Mensagens", icon: Bell, cor: "#ea580c", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { message: "", to: "owner", channel: "app", staff_ids: [], instance_id: "" } },
  create_task: { label: "Criar tarefa", desc: "Tarefa no lead, com responsável e prazo", grupo: "Ações", icon: ListTodo, cor: "#2563eb", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { title: "", description: "", activity_type: "followup", days: 0, hours: 0, assignee_mode: "owner", staff_ids: [], notify: true } },
  move_stage: { label: "Mover de etapa", desc: "Leva o negócio pra outra etapa", grupo: "Ações", icon: ArrowRightLeft, cor: "#4f46e5", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { stage_id: "" } },
  assign_owner: { label: "Trocar responsável", desc: "Pessoa fixa ou rodízio", grupo: "Ações", icon: UserCheck, cor: "#0891b2", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { assignee_mode: "round_robin", staff_ids: [] } },
  add_tag: { label: "Aplicar etiqueta", desc: "", grupo: "Ações", icon: Tag, cor: "#db2777", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { tag_id: "" } },
  remove_tag: { label: "Remover etiqueta", desc: "", grupo: "Ações", icon: Tags, cor: "#be185d", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { tag_id: "" } },
  enroll_cadence: { label: "Inscrever em cadência", desc: "", grupo: "Ações", icon: Repeat2, cor: "#7c3aed", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { cadence_id: "" } },
  stop_cadence: { label: "Parar cadência", desc: "Tira o lead das cadências em andamento", grupo: "Ações", icon: StopCircle, cor: "#a21caf", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { cadence_id: "" } },
  start_flow: { label: "Iniciar outro fluxo", desc: "", grupo: "Ações", icon: Workflow, cor: "#0d9488", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { flow_id: "" } },
  webhook: { label: "Webhook", desc: "Chama outro sistema, com mapeamento de campos", grupo: "Ações", icon: Globe, cor: "#475569", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { url: "", method: "POST", headers: [], body_mode: "lead", fields: [], body: "", wait_response: false, map: [] } },
  set_field: { label: "Operação de campo", desc: "Define ou formata um campo do lead ou uma variável", grupo: "Dados", icon: PenLine, cor: "#ca8a04", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { field: "ctx.", value: "", transform: "none" } },
  formula: { label: "Fórmula", desc: "Conta simples com números do lead", grupo: "Dados", icon: Calculator, cor: "#b45309", entrada: true, saidas: [{ id: "default", label: "" }], padrao: { a: "{valor}", op: "*", b: "1", result: "ctx.resultado" } },
  note: { label: "Nota", desc: "Anotação no canvas. Não executa nada.", grupo: "Organização", icon: StickyNote, cor: "#a16207", entrada: false, saidas: [], padrao: { text: "" } },
  end: { label: "Fim", desc: "Encerra o fluxo", grupo: "Organização", icon: Square, cor: "#dc2626", entrada: true, saidas: [], padrao: {} },
};

export const GRUPOS: Grupo[] = ["Lógica", "Mensagens", "Ações", "Dados", "Organização"];

export const TRIGGERS: { value: string; label: string; hint: string; tempo?: boolean; massa?: boolean }[] = [
  { value: "manual", label: "Manual", hint: "Roda só quando alguém manda: teste com um lead ou outro fluxo chamando este" },
  { value: "lead_created", label: "Lead criado", hint: "Quando um negócio novo entra no CRM", massa: true },
  { value: "stage_changed", label: "Mudança de etapa", hint: "Quando o negócio entra numa etapa", massa: true },
  { value: "tag_added", label: "Etiqueta aplicada", hint: "Quando o negócio recebe uma etiqueta", massa: true },
  { value: "owner_changed", label: "Responsável trocado", hint: "Quando o dono do negócio muda", massa: true },
  { value: "meeting_scheduled", label: "Reunião agendada", hint: "Quando uma reunião é marcada no negócio" },
  { value: "meeting_realized", label: "Reunião realizada", hint: "Quando a reunião é marcada como realizada" },
  { value: "meeting_no_show", label: "No-show", hint: "Quando o lead não aparece na reunião" },
  { value: "lead_won", label: "Ganho", hint: "Quando o negócio vai pra uma etapa de ganho", massa: true },
  { value: "lead_lost", label: "Perdido", hint: "Quando o negócio vai pra uma etapa de perda", massa: true },
  { value: "lead_idle", label: "Lead parado há N dias", hint: "Sem mudança de etapa, atividade concluída nem mensagem há N dias", tempo: true },
  { value: "activity_overdue", label: "Tarefa atrasada", hint: "Tarefa pendente vencida há N horas", tempo: true },
  { value: "no_reply", label: "Sem resposta do vendedor (SLA)", hint: "O cliente escreveu e ninguém respondeu em N minutos", tempo: true },
  { value: "lead_no_reply", label: "Sem resposta do lead há N dias", hint: "A última mensagem foi nossa e o lead não respondeu", tempo: true },
];
export const triggerLabel = (t: string) => TRIGGERS.find((x) => x.value === t)?.label || t;

type TipoCampo = "texto" | "numero" | "bool" | "etapa" | "funil" | "origem" | "dono" | "hora" | "semana";
// Campos que a Condição enxerga (crm_flow_field / crm_flow_rule_ok no banco)
export const CAMPOS: { value: string; label: string; tipo: TipoCampo }[] = [
  { value: "stage_id", label: "Etapa", tipo: "etapa" },
  { value: "pipeline_id", label: "Funil", tipo: "funil" },
  { value: "origin_id", label: "Origem", tipo: "origem" },
  { value: "owner_staff_id", label: "Responsável", tipo: "dono" },
  { value: "has_tag", label: "Tem a etiqueta", tipo: "bool" },
  { value: "opportunity_value", label: "Valor do negócio", tipo: "numero" },
  { value: "name", label: "Nome", tipo: "texto" },
  { value: "phone", label: "Telefone", tipo: "texto" },
  { value: "email", label: "E-mail", tipo: "texto" },
  { value: "company", label: "Empresa", tipo: "texto" },
  { value: "city", label: "Cidade", tipo: "texto" },
  { value: "state", label: "Estado", tipo: "texto" },
  { value: "segment", label: "Segmento", tipo: "texto" },
  { value: "role", label: "Cargo", tipo: "texto" },
  { value: "estimated_revenue", label: "Faturamento informado", tipo: "texto" },
  { value: "employee_count", label: "Número de funcionários", tipo: "texto" },
  { value: "urgency", label: "Urgência", tipo: "texto" },
  { value: "main_pain", label: "Dor principal", tipo: "texto" },
  { value: "utm_source", label: "UTM source", tipo: "texto" },
  { value: "utm_medium", label: "UTM medium", tipo: "texto" },
  { value: "utm_campaign", label: "UTM campaign", tipo: "texto" },
  { value: "campaign_name", label: "Campanha (Meta)", tipo: "texto" },
  { value: "ad_name", label: "Anúncio (Meta)", tipo: "texto" },
  { value: "days_in_stage", label: "Dias na etapa", tipo: "numero" },
  { value: "days_since_created", label: "Dias desde a criação", tipo: "numero" },
  { value: "hours_since_last_inbound", label: "Horas desde a última mensagem do lead", tipo: "numero" },
  { value: "tags_count", label: "Quantidade de etiquetas", tipo: "numero" },
  { value: "is_won", label: "Está ganho", tipo: "bool" },
  { value: "is_lost", label: "Está perdido", tipo: "bool" },
  { value: "in_cadence", label: "Está numa cadência", tipo: "bool" },
  { value: "replied_since", label: "Respondeu nas últimas X horas", tipo: "bool" },
  { value: "in_business_hours", label: "Agora é horário de trabalho", tipo: "bool" },
  { value: "now_time", label: "Horário agora (Brasília)", tipo: "hora" },
  { value: "now_weekday", label: "Dia da semana", tipo: "semana" },
  { value: "ctx.", label: "Variável do fluxo", tipo: "texto" },
];

export const OPS_TEXTO = [
  { value: "equals", label: "é igual a" }, { value: "not_equals", label: "é diferente de" }, { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" }, { value: "starts_with", label: "começa com" }, { value: "in", label: "é um de (separe por vírgula)" },
  { value: "is_empty", label: "está vazio" }, { value: "not_empty", label: "está preenchido" },
];
export const OPS_NUMERO = [
  { value: "equals", label: "é igual a" }, { value: "not_equals", label: "é diferente de" }, { value: "gt", label: "maior que" },
  { value: "gte", label: "maior ou igual a" }, { value: "lt", label: "menor que" }, { value: "lte", label: "menor ou igual a" }, { value: "is_empty", label: "está vazio" },
];
export const OPS_BOOL = [{ value: "is_true", label: "sim" }, { value: "is_false", label: "não" }];
export const OPS_BOOL_VALOR = [{ value: "equals", label: "sim" }, { value: "not", label: "não" }];
export const OPS_ID = [{ value: "equals", label: "é" }, { value: "not_equals", label: "não é" }, { value: "is_empty", label: "está vazio" }, { value: "not_empty", label: "está preenchido" }];
export const OPS_HORA = [{ value: "gte", label: "a partir das" }, { value: "lt", label: "antes das" }];
export const OPS_SEMANA = [{ value: "equals", label: "é" }, { value: "not_equals", label: "não é" }, { value: "in", label: "é um de (ex.: 1,2,3)" }];
export const DIAS_SEMANA = [
  { value: "1", label: "Segunda" }, { value: "2", label: "Terça" }, { value: "3", label: "Quarta" }, { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" }, { value: "6", label: "Sábado" }, { value: "0", label: "Domingo" },
];

export function opsDe(field: string) {
  if (["has_tag", "in_cadence", "replied_since"].includes(field)) return OPS_BOOL_VALOR;
  const c = CAMPOS.find((x) => x.value === field);
  if (!c) return OPS_TEXTO;
  if (c.tipo === "numero") return OPS_NUMERO;
  if (c.tipo === "bool") return OPS_BOOL;
  if (c.tipo === "hora") return OPS_HORA;
  if (c.tipo === "semana") return OPS_SEMANA;
  if (["etapa", "funil", "origem", "dono"].includes(c.tipo)) return OPS_ID;
  return OPS_TEXTO;
}

export const CAMPOS_GRAVAVEIS = [
  { value: "ctx.", label: "Variável do fluxo (use depois com {{nome}})" },
  { value: "name", label: "Nome" }, { value: "phone", label: "Telefone" }, { value: "email", label: "E-mail" }, { value: "company", label: "Empresa" },
  { value: "trade_name", label: "Nome fantasia" }, { value: "document", label: "Documento (CPF ou CNPJ)" },
  { value: "city", label: "Cidade" }, { value: "state", label: "Estado" }, { value: "segment", label: "Segmento" }, { value: "role", label: "Cargo" },
  { value: "opportunity_value", label: "Valor do negócio" }, { value: "probability", label: "Probabilidade (%)" }, { value: "fit_score", label: "Nota de fit" },
  { value: "estimated_revenue", label: "Faturamento informado" }, { value: "employee_count", label: "Número de funcionários" },
  { value: "notes", label: "Observações" }, { value: "main_pain", label: "Dor principal" }, { value: "urgency", label: "Urgência" },
  { value: "instagram", label: "Instagram" },
  { value: "utm_source", label: "UTM source" }, { value: "utm_medium", label: "UTM medium" }, { value: "utm_campaign", label: "UTM campaign" },
];
export const TRANSFORMS = [
  { value: "none", label: "Como está" },
  { value: "phone_br", label: "Telefone: só dígitos com 55 (5531999990000)" },
  { value: "phone_mask", label: "Telefone: (31) 99999-0000" },
  { value: "date_br", label: "Data: dia/mês/ano" },
  { value: "date_iso", label: "Data: ano-mês-dia" },
  { value: "number", label: "Número (1.234,56 vira 1234.56)" },
  { value: "digits", label: "Só dígitos (CPF, CNPJ)" },
  { value: "capitalize", label: "Primeira Letra Maiúscula" },
  { value: "upper", label: "MAIÚSCULAS" }, { value: "lower", label: "minúsculas" },
  { value: "trim", label: "Sem espaços sobrando" }, { value: "first_word", label: "Só a primeira palavra" },
];
// crm_activities.type só aceita estes valores (CHECK da tabela)
export const ACTIVITY_TYPES = [
  { value: "followup", label: "Follow-up" }, { value: "call", label: "Ligação" }, { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" }, { value: "meeting", label: "Reunião" }, { value: "proposal", label: "Proposta" }, { value: "other", label: "Outra" },
];
export const WHO = [
  { value: "owner", label: "Responsável pelo lead" }, { value: "managers", label: "Gestores (master, admin e head comercial)" },
  { value: "fixed", label: "Pessoas específicas" },
];
export const WHO_TASK = [
  { value: "owner", label: "Responsável pelo lead" }, { value: "fixed", label: "Pessoas específicas (uma tarefa pra cada)" },
  { value: "round_robin", label: "Rodízio entre as escolhidas" },
];
export const WHO_OWNER = [{ value: "fixed", label: "Pessoa específica" }, { value: "round_robin", label: "Rodízio entre as escolhidas" }];
export const CHANNELS = [{ value: "app", label: "Notificação do app" }, { value: "whatsapp", label: "WhatsApp" }, { value: "both", label: "App e WhatsApp" }];
export const SEND_MODES = [
  { value: "conversation", label: "O número por onde o lead já conversa" },
  { value: "owner", label: "O número do responsável pelo lead" },
  { value: "fixed", label: "Um número específico" },
];

export const VARS_LEAD = ["{primeiro_nome}", "{nome}", "{telefone}", "{email}", "{empresa}", "{etapa}", "{funil}", "{responsavel}", "{valor}", "{origem}", "{cidade}", "{link_lead}", "{data_hoje}", "{data_reuniao}", "{hora_reuniao}", "{link_reuniao}"];
export const VARS_GATILHO: Record<string, string[]> = {
  lead_idle: ["{parado_desde}", "{dias_parado}"],
  activity_overdue: ["{tarefa}", "{tarefa_data}", "{tarefa_responsavel}"],
  no_reply: ["{esperando_desde}", "{minutos_sla}"],
  lead_no_reply: ["{ultima_mensagem}", "{dias_sem_resposta}"],
};

export interface Opcao { value: string; label: string }
export interface Listas {
  stages: Opcao[];
  pipelines: Opcao[];
  origins: Opcao[];
  tags: Opcao[];
  cadences: Opcao[];
  staff: { id: string; name: string }[];
  instances: Opcao[];        // só Evolution do CRM (avisos internos)
  sendInstances: Opcao[];    // Evolution + API oficial, valor "evolution:<id>" ou "official:<id>"
  flows: Opcao[];
}
export const LISTAS_VAZIAS: Listas = { stages: [], pipelines: [], origins: [], tags: [], cadences: [], staff: [], instances: [], sendInstances: [], flows: [] };

const nomeDe = (lista: Opcao[], id?: string) => lista.find((x) => x.value === id)?.label || "";
const UNIDADE: Record<string, string> = { minutes: "min", hours: "h", days: "dia(s)" };

// Uma linha de resumo pro cartão do bloco no canvas
export function resumoBloco(type: NodeType, d: Record<string, any>, L: Listas, trigger?: string): string {
  switch (type) {
    case "trigger": return triggerLabel(trigger || "manual");
    case "condition": { const n = (d.rules || []).length; return n ? `${n} regra${n > 1 ? "s" : ""} (${d.logic === "or" ? "qualquer uma" : "todas"})` : "Sem regras: sempre Sim"; }
    case "split": return `${d.percent_a ?? 50}% pra A, ${100 - (d.percent_a ?? 50)}% pra B`;
    case "wait":
      if (d.mode === "business") return "Até o horário de trabalho";
      if (d.mode === "time") return `Até às ${d.until_time || "09:00"}`;
      return `${d.value ?? 1} ${UNIDADE[d.unit as string] || d.unit}${d.respect_window ? ", só em horário de trabalho" : ""}`;
    case "wait_reply": return `Até ${d.hours ?? 24} h`;
    case "send_whatsapp": return String(d.message || "").slice(0, 70) || "Sem mensagem";
    case "create_task": return d.title || "Sem título";
    case "notify": return String(d.message || "").slice(0, 70) || "Sem mensagem";
    case "move_stage": return nomeDe(L.stages, d.stage_id) || "Escolha a etapa";
    case "add_tag": case "remove_tag": return nomeDe(L.tags, d.tag_id) || "Escolha a etiqueta";
    case "assign_owner": return d.assignee_mode === "round_robin" ? `Rodízio entre ${(d.staff_ids || []).length}` : L.staff.find((s) => s.id === (d.staff_ids || [])[0])?.name || "Escolha a pessoa";
    case "enroll_cadence": return nomeDe(L.cadences, d.cadence_id) || "Escolha a cadência";
    case "stop_cadence": return d.cadence_id ? nomeDe(L.cadences, d.cadence_id) : "Todas as cadências";
    case "start_flow": return nomeDe(L.flows, d.flow_id) || "Escolha o fluxo";
    case "webhook": return `${d.method || "POST"} ${String(d.url || "").replace(/^https?:\/\//, "").slice(0, 40) || "Sem URL"}${d.wait_response ? " (lê a resposta)" : ""}`;
    case "set_field": {
      const campo = String(d.field || "").startsWith("ctx.") ? `{{${String(d.field).slice(4) || "?"}}}` : CAMPOS_GRAVAVEIS.find((c) => c.value === d.field)?.label || "?";
      return `${campo} = ${String(d.value || "").slice(0, 30) || "(vazio)"}`;
    }
    case "formula": return `${String(d.result || "ctx.resultado").replace(/^ctx\./, "")} = ${d.a || "?"} ${d.op === "%" ? "% de" : d.op || "+"} ${d.b || "?"}`;
    case "note": return String(d.text || "");
    default: return "";
  }
}

// Pendências que impedem ativar o fluxo
export interface Pendencia { texto: string; nodeId: string | null }

// Cada pendência sabe em qual bloco está, pra tela levar a pessoa direto nele.
export function validarFluxoDetalhe(nodes: any[], edges: any[], trigger: string): Pendencia[] {
  const lista: Pendencia[] = [];
  let atual: string | null = null;
  const erros = { push: (texto: string) => { lista.push({ texto, nodeId: atual }); } };
  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) erros.push("O fluxo precisa de exatamente um bloco de Gatilho");
  const t = triggers[0];
  atual = t?.id ?? null;
  if (t && !edges.some((e) => e.source === t.id)) erros.push("O Gatilho precisa estar ligado a um bloco");
  if (!trigger) erros.push("Escolha o gatilho");
  for (const n of nodes) {
    atual = n.id;
    const d = n.data || {};
    const def = CATALOGO[n.type as NodeType];
    if (!def) { erros.push(`Bloco desconhecido: ${n.type}`); continue; }
    const nome = d.label || def.label;
    if (def.entrada && !edges.some((e) => e.target === n.id)) erros.push(`"${nome}" não recebe ligação de ninguém`);
    if (n.type === "send_whatsapp" && !String(d.message || "").trim()) erros.push(`${nome}: escreva a mensagem`);
    if (n.type === "send_whatsapp" && d.instance_mode === "fixed" && !d.instance_id) erros.push(`${nome}: escolha o número que envia`);
    if (n.type === "move_stage" && !d.stage_id) erros.push(`${nome}: escolha a etapa`);
    if ((n.type === "add_tag" || n.type === "remove_tag") && !d.tag_id) erros.push(`${nome}: escolha a etiqueta`);
    if (n.type === "enroll_cadence" && !d.cadence_id) erros.push(`${nome}: escolha a cadência`);
    if (n.type === "start_flow" && !d.flow_id) erros.push(`${nome}: escolha o fluxo`);
    if (n.type === "webhook" && !/^https?:\/\//.test(String(d.url || ""))) erros.push(`${nome}: informe a URL (https://...)`);
    if (n.type === "create_task" && !String(d.title || "").trim()) erros.push(`${nome}: escreva o título`);
    if (n.type === "notify" && !String(d.message || "").trim()) erros.push(`${nome}: escreva a mensagem`);
    if ((n.type === "create_task" || n.type === "assign_owner") && ["fixed", "round_robin"].includes(d.assignee_mode) && !(d.staff_ids || []).length) erros.push(`${nome}: escolha as pessoas`);
    if (n.type === "notify" && d.to === "fixed" && !(d.staff_ids || []).length) erros.push(`${nome}: escolha as pessoas`);
    if (n.type === "set_field" && (!d.field || d.field === "ctx.")) erros.push(`${nome}: escolha o campo ou dê nome à variável`);
    if (n.type === "condition") for (const r of d.rules || []) {
      const semValor = !["is_empty", "not_empty", "is_true", "is_false"].includes(r.op) && r.field !== "in_cadence" && !String(r.value ?? "").trim();
      if (!r.field || r.field === "ctx." || semValor) { erros.push(`${nome}: há regra incompleta`); break; }
    }
  }
  return lista;
}

export function validarFluxo(nodes: any[], edges: any[], trigger: string): string[] {
  return validarFluxoDetalhe(nodes, edges, trigger).map((p) => p.texto);
}

export const uid = () => "n" + Math.random().toString(36).slice(2, 9);

export interface FluxoExportado {
  versao: number; name: string; description?: string | null; trigger_type: string;
  trigger_config: Record<string, any>; filters: Record<string, any>; nodes: any[]; edges: any[];
}
// Confere um JSON importado: tipos de bloco conhecidos, um gatilho, ligações apontando pra blocos que existem.
export function conferirImportado(j: any): { ok: boolean; erro?: string; fluxo?: FluxoExportado } {
  if (!j || typeof j !== "object" || !Array.isArray(j.nodes) || !Array.isArray(j.edges)) return { ok: false, erro: "O arquivo não parece um fluxo exportado" };
  const ids = new Set<string>();
  for (const n of j.nodes) {
    if (!n?.id || !CATALOGO[n.type as NodeType]) return { ok: false, erro: `Bloco desconhecido no arquivo: ${n?.type ?? "sem tipo"}` };
    ids.add(String(n.id));
  }
  if (j.nodes.filter((n: any) => n.type === "trigger").length !== 1) return { ok: false, erro: "O arquivo precisa ter exatamente um Gatilho" };
  for (const e of j.edges) if (!ids.has(String(e?.source)) || !ids.has(String(e?.target))) return { ok: false, erro: "O arquivo tem ligação apontando pra bloco que não existe" };
  const trigger = TRIGGERS.some((t) => t.value === j.trigger_type) ? j.trigger_type : "manual";
  return {
    ok: true,
    fluxo: {
      versao: 1, name: String(j.name || "Fluxo importado").slice(0, 120), description: j.description || null, trigger_type: trigger,
      trigger_config: j.trigger_config && typeof j.trigger_config === "object" ? j.trigger_config : {},
      filters: j.filters && typeof j.filters === "object" ? j.filters : {},
      nodes: j.nodes.map((n: any) => ({ id: String(n.id), type: n.type, position: n.position || { x: 0, y: 0 }, data: n.data || {} })),
      edges: j.edges.map((e: any) => ({ id: e.id || `${e.source}-${e.sourceHandle || "default"}-${e.target}`, source: String(e.source), sourceHandle: e.sourceHandle || "default", target: String(e.target) })),
    },
  };
}

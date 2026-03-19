// Trigger definitions for the automation engine

export interface TriggerDefinition {
  type: string;
  label: string;
  module: string;
  moduleLabel: string;
  moduleColor: string;
  conditionFields: ConditionField[];
}

export interface ConditionField {
  key: string;
  label: string;
  type: "number" | "text" | "select";
  options?: { value: string; label: string }[];
}

export interface ActionDefinition {
  type: string;
  label: string;
  icon: string;
  configFields: ActionConfigField[];
}

export interface ActionConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "staff_select";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    type: "lead_stage_changed",
    label: "Lead mudou de etapa",
    module: "crm",
    moduleLabel: "CRM",
    moduleColor: "bg-blue-100 text-blue-800",
    conditionFields: [
      { key: "pipeline_id", label: "Pipeline específico", type: "text" },
    ],
  },
  {
    type: "lead_created",
    label: "Lead criado",
    module: "crm",
    moduleLabel: "CRM",
    moduleColor: "bg-blue-100 text-blue-800",
    conditionFields: [],
  },
  {
    type: "lead_won",
    label: "Lead ganho",
    module: "crm",
    moduleLabel: "CRM",
    moduleColor: "bg-blue-100 text-blue-800",
    conditionFields: [],
  },
  {
    type: "lead_lost",
    label: "Lead perdido",
    module: "crm",
    moduleLabel: "CRM",
    moduleColor: "bg-blue-100 text-blue-800",
    conditionFields: [],
  },
  {
    type: "nps_received",
    label: "NPS recebido",
    module: "onboarding",
    moduleLabel: "Onboarding",
    moduleColor: "bg-green-100 text-green-800",
    conditionFields: [
      { key: "score", label: "Nota máxima (≤)", type: "number" },
    ],
  },
  {
    type: "health_score_changed",
    label: "Health Score alterado",
    module: "onboarding",
    moduleLabel: "Onboarding",
    moduleColor: "bg-green-100 text-green-800",
    conditionFields: [
      { key: "score", label: "Score abaixo de", type: "number" },
    ],
  },
  {
    type: "task_overdue",
    label: "Tarefa atrasada",
    module: "onboarding",
    moduleLabel: "Onboarding",
    moduleColor: "bg-green-100 text-green-800",
    conditionFields: [
      { key: "days_overdue", label: "Dias de atraso (≥)", type: "number" },
    ],
  },
  {
    type: "payment_confirmed",
    label: "Pagamento confirmado",
    module: "financial",
    moduleLabel: "Financeiro",
    moduleColor: "bg-amber-100 text-amber-800",
    conditionFields: [],
  },
  {
    type: "payment_overdue",
    label: "Pagamento atrasado",
    module: "financial",
    moduleLabel: "Financeiro",
    moduleColor: "bg-amber-100 text-amber-800",
    conditionFields: [
      { key: "days_overdue", label: "Dias de atraso (≥)", type: "number" },
    ],
  },
  {
    type: "lead_inactive",
    label: "Lead inativo",
    module: "crm",
    moduleLabel: "CRM",
    moduleColor: "bg-blue-100 text-blue-800",
    conditionFields: [
      { key: "days_inactive", label: "Dias sem atividade (≥)", type: "number" },
    ],
  },
];

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    type: "send_notification",
    label: "Enviar notificação",
    icon: "Bell",
    configFields: [
      {
        key: "target",
        label: "Destinatário",
        type: "select",
        options: [
          { value: "cs_responsible", label: "CS Responsável" },
          { value: "consultant_responsible", label: "Consultor Responsável" },
          { value: "both_responsible", label: "CS + Consultor" },
          { value: "specific_staff", label: "Staff específico" },
        ],
      },
      { key: "title", label: "Título", type: "text", placeholder: "Ex: ⚠️ Alerta de {event}" },
      { key: "message", label: "Mensagem", type: "textarea", placeholder: "Use {company_name}, {score}, {lead_name}..." },
    ],
  },
  {
    type: "send_whatsapp",
    label: "Enviar WhatsApp",
    icon: "MessageSquare",
    configFields: [
      {
        key: "target",
        label: "Destinatário",
        type: "select",
        options: [
          { value: "cs_responsible", label: "CS Responsável" },
          { value: "consultant_responsible", label: "Consultor Responsável" },
          { value: "client_phone", label: "Telefone do cliente" },
        ],
      },
      { key: "message", label: "Mensagem", type: "textarea", placeholder: "Mensagem do WhatsApp..." },
    ],
  },
  {
    type: "create_task",
    label: "Criar tarefa",
    icon: "CheckSquare",
    configFields: [
      { key: "title", label: "Título da tarefa", type: "text", placeholder: "Ex: Follow-up com {company_name}" },
      { key: "description", label: "Descrição", type: "textarea" },
    ],
  },
  {
    type: "move_lead_stage",
    label: "Mover lead de etapa",
    icon: "ArrowRight",
    configFields: [
      { key: "target_stage_name", label: "Nome da etapa destino", type: "text", placeholder: "Ex: Sem Retorno" },
    ],
  },
  {
    type: "create_crm_activity",
    label: "Criar atividade CRM",
    icon: "Calendar",
    configFields: [
      { key: "title", label: "Título da atividade", type: "text", placeholder: "Ex: Follow-up agendado" },
      { key: "description", label: "Descrição", type: "textarea" },
      {
        key: "activity_type",
        label: "Tipo",
        type: "select",
        options: [
          { value: "call", label: "Ligação" },
          { value: "meeting", label: "Reunião" },
          { value: "email", label: "Email" },
          { value: "task", label: "Tarefa" },
        ],
      },
    ],
  },
];

export const getTriggerDefinition = (type: string) =>
  TRIGGER_DEFINITIONS.find((t) => t.type === type);

export const getActionDefinition = (type: string) =>
  ACTION_DEFINITIONS.find((a) => a.type === type);

export const TRIGGER_MODULES = [
  { key: "crm", label: "CRM", color: "bg-blue-100 text-blue-800" },
  { key: "onboarding", label: "Onboarding", color: "bg-green-100 text-green-800" },
  { key: "financial", label: "Financeiro", color: "bg-amber-100 text-amber-800" },
];

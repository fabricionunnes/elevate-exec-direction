/** normaliza pra busca: minúsculas e sem acento */
export const esc = (s: string): string => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** agrupa por chave */
export function grp<T>(rows: T[], key: (r: T) => string | null | undefined, semNome = "Não informado"): Record<string, T[]> {
  const g: Record<string, T[]> = {};
  rows.forEach((r) => { const k = key(r) || semNome; (g[k] ??= []).push(r); });
  return g;
}

export const soma = <T,>(rows: T[], f: (r: T) => number | null | undefined): number => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);

/** links do Nexus pra abrir o registro de verdade */
export const LINK = {
  empresa: (id: string) => `/onboarding-tasks/companies/${id}`,
  lead: (id: string) => `/crm/leads/${id}`,
  conversa: (id: string) => `/crm/inbox?conversation=${id}`,
  financeiro: "/onboarding-tasks/financeiro",
  recorrencias: "/onboarding-tasks/financeiro/recorrencias",
  empresas: "/onboarding-tasks/companies",
  tarefas: "/onboarding-tasks",
  checkup: "/onboarding-tasks/checkup",
  custoIa: "/onboarding-tasks/custo-ia",
  inbox: "/crm/inbox",
  leads: "/crm/leads",
  pipeline: "/crm/pipeline",
  reunioes: "/crm/meetings",
  agentes: "/crm/agents",
  automacoes: "/crm/automacoes",
  disparos: "/crm/disparos",
  trafego: "/crm/trafego-pago/api",
  equipe: "/onboarding-tasks/staff",
  automacoesNexus: "/onboarding-tasks/automations",
};

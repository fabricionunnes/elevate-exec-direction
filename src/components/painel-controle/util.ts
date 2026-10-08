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
  /** página inicial do CRM: a aba Tráfego Pago (onde conecta o Meta Ads) fica aqui */
  crm: "/crm",
  /** Configurações do CRM, aba Metas: onde se cadastra a meta de vendas de cada um */
  metasCrm: "/crm/settings?tab=goals",
  horarioCrm: "/crm/settings?tab=horario",
  equipe: "/onboarding-tasks/staff",
  automacoesNexus: "/onboarding-tasks/automations",
};

/** Abre uma tela do Nexus em outra aba. O app usa HashRouter: caminho interno precisa do "/#" na
 *  frente, senão o servidor devolve a home pública (foi o que aconteceu ao clicar num lead do pop-up
 *  da Gestão à vista em 07/10/2026). Links externos (http) passam direto. */
export function abrirNexus(url: string) {
  const alvo = /^https?:\/\//i.test(url) || url.startsWith("/#") ? url : `/#${url.startsWith("/") ? url : `/${url}`}`;
  window.open(alvo, "_blank", "noopener");
}

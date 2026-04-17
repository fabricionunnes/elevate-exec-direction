/**
 * Mapeia cada menu de cliente (CLIENT_MENU_KEYS) ao módulo do tenant white-label
 * (chave usada em whitelabel_tenants.enabled_modules / TenantModulesManager).
 *
 * Se o tenant NÃO tem o módulo habilitado, o admin WL não pode liberar o(s)
 * menu(s) correspondentes para nenhum projeto cliente.
 *
 * Menus sem entrada aqui são considerados "núcleo" e sempre disponíveis.
 */
export const MENU_TO_MODULE: Record<string, string> = {
  // Onboarding / núcleo do portal
  jornada_trilha: "onboarding",
  jornada_lista: "onboarding",
  jornada_cronograma: "onboarding",
  diagnostico: "onboarding",
  contrato_rotina: "onboarding",
  acoes_comerciais: "onboarding",

  // CRM Comercial
  crm_comercial: "crm",
  crm_comercial_dashboard: "crm",
  crm_comercial_negocios: "crm",
  crm_comercial_contatos: "crm",
  crm_comercial_atividades: "crm",
  crm_comercial_atendimentos: "crm",
  crm_comercial_transcricoes: "crm",
  crm_comercial_contratos: "crm",
  crm_comercial_reunioes: "crm",
  funil_vendas: "crm",
  crm_unv: "crm",

  // Tarefas / Reuniões
  reunioes: "meetings",

  // Financeiro
  gestao_financeiro: "financial",
  minhas_faturas: "financial",
  sf_comissoes: "financial",

  // KPIs
  kpis: "kpis",
  kpis_dashboard: "kpis",
  kpis_endomarketing: "kpis",
  kpis_sales_links: "kpis",
  kpis_config: "kpis",
  pontuacao: "kpis",

  // WhatsApp / Comunicação
  unv_disparador: "whatsapp",
  chamados: "whatsapp",

  // Social
  unv_social: "social",
  instagram: "social",
  meta_ads: "social",
  trafego_pago: "social",

  // Academy
  unv_academy: "academy",

  // RH
  rh: "hr",

  // B2B
  prospeccao_b2b: "b2b",
};

/**
 * Retorna true se o menu está liberado para uso, considerando os módulos
 * habilitados no tenant. Menus não mapeados são sempre liberados.
 */
export function isMenuAllowedByTenant(
  menuKey: string,
  enabledModules: Record<string, boolean> | null | undefined,
): boolean {
  const moduleKey = MENU_TO_MODULE[menuKey];
  if (!moduleKey) return true; // núcleo / não controlado por módulo
  if (!enabledModules) return true; // sem tenant = master UNV libera tudo
  return Boolean(enabledModules[moduleKey]);
}

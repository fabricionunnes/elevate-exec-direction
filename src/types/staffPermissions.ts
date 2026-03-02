// Staff roles including master
export type StaffRole = 
  | "master"
  | "admin" 
  | "cs" 
  | "consultant"
  | "head_comercial"
  | "closer"
  | "sdr"
  | "social_setter"
  | "bdr"
  | "rh"
  | "financeiro"
  | "marketing";

// Menu permission keys for staff
export const STAFF_MENU_KEYS = {
  dashboard: "dashboard",
  companies: "companies",
  tasks: "tasks",
  calendar: "calendar",
  announcements: "announcements",
  results: "results",
  crm: "crm",
  hr: "hr",
  circle: "circle",
  academy: "academy",
  financial: "financial",
  ceo_dashboard: "ceo_dashboard",
  settings: "settings",
  admin_menu: "admin_menu",
} as const;

// Financial sub-permission keys
export const FINANCIAL_PERMISSION_KEYS = {
  fin_dashboard: "fin_dashboard",
  fin_receivables_view: "fin_receivables_view",
  fin_receivables_create: "fin_receivables_create",
  fin_receivables_confirm: "fin_receivables_confirm",
  fin_receivables_revert: "fin_receivables_revert",
  fin_payables_view: "fin_payables_view",
  fin_payables_create: "fin_payables_create",
  fin_categories: "fin_categories",
  fin_dre: "fin_dre",
  fin_dfc: "fin_dfc",
  fin_banks: "fin_banks",
  fin_cfo_executive: "fin_cfo_executive",
  fin_cfo_mrr: "fin_cfo_mrr",
  fin_cfo_churn: "fin_cfo_churn",
  fin_cfo_unit_economics: "fin_cfo_unit_economics",
  fin_cfo_costs: "fin_cfo_costs",
  fin_cfo_cash: "fin_cfo_cash",
  fin_cfo_delinquency: "fin_cfo_delinquency",
  fin_cfo_ai: "fin_cfo_ai",
  fin_overdue: "fin_overdue",
  fin_bank_balances: "fin_bank_balances",
  fin_billing_rules: "fin_billing_rules",
} as const;

export type FinancialPermissionKey = typeof FINANCIAL_PERMISSION_KEYS[keyof typeof FINANCIAL_PERMISSION_KEYS];

// Financial sub-permission structure for the dialog
export const FINANCIAL_PERMISSION_STRUCTURE = [
  { key: FINANCIAL_PERMISSION_KEYS.fin_dashboard, label: "Dashboard", description: "Visualizar dashboard financeiro", group: "Visão Geral" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_receivables_view, label: "Contas a Receber - Visualizar", description: "Ver faturas e contas a receber", group: "Contas a Receber" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_receivables_create, label: "Contas a Receber - Criar", description: "Lançar novas contas a receber", group: "Contas a Receber" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm, label: "Contas a Receber - Dar Baixa", description: "Confirmar pagamento (baixa manual)", group: "Contas a Receber" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_receivables_revert, label: "Contas a Receber - Estornar", description: "Reverter pagamentos confirmados", group: "Contas a Receber" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_payables_view, label: "Contas a Pagar - Visualizar", description: "Ver despesas e contas a pagar", group: "Contas a Pagar" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_payables_create, label: "Contas a Pagar - Criar", description: "Lançar novas contas a pagar", group: "Contas a Pagar" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_categories, label: "Categorias / Plano de Contas", description: "Gerenciar categorias financeiras", group: "Relatórios" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_dre, label: "DRE", description: "Visualizar Demonstrativo de Resultados", group: "Relatórios" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_dfc, label: "DFC", description: "Visualizar Demonstrativo de Fluxo de Caixa", group: "Relatórios" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_banks, label: "Bancos", description: "Gerenciar contas bancárias", group: "Administração" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_executive, label: "CFO - Executive Board", description: "Visão executiva com KPIs estratégicos", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_mrr, label: "CFO - Receita & MRR", description: "MRR Breakdown, Ticket Médio", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_churn, label: "CFO - Churn & Retenção", description: "Churn rate, cohort, retenção", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_unit_economics, label: "CFO - Unit Economics", description: "CAC, LTV, Payback, Margem", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_costs, label: "CFO - Custos & Estrutura", description: "Custos fixos/variáveis, colaboradores", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_cash, label: "CFO - Caixa & Projeção", description: "Fluxo de caixa, runway, projeção 12m", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_delinquency, label: "CFO - Inadimplência", description: "Aging list, taxa de recuperação", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_cfo_ai, label: "CFO IA", description: "Inteligência artificial financeira com insights salvos", group: "Dashboard CFO" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_overdue, label: "Atrasados", description: "Visualizar e gerenciar faturas em atraso", group: "Contas a Receber" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_bank_balances, label: "Saldos por Conta", description: "Visualizar saldos bancários no dashboard", group: "Visão Geral" },
  { key: FINANCIAL_PERMISSION_KEYS.fin_billing_rules, label: "Régua de Cobranças", description: "Acessar régua de cobranças automatizada", group: "Operacional" },
] as const;

export type StaffMenuKey = typeof STAFF_MENU_KEYS[keyof typeof STAFF_MENU_KEYS];

// Menu structure for permission configuration
export const STAFF_MENU_STRUCTURE = [
  { 
    key: STAFF_MENU_KEYS.dashboard, 
    label: "Dashboard", 
    description: "Painel principal com métricas",
    group: "Principal" 
  },
  { 
    key: STAFF_MENU_KEYS.companies, 
    label: "Empresas", 
    description: "Visualizar e gerenciar empresas",
    group: "Principal" 
  },
  { 
    key: STAFF_MENU_KEYS.tasks, 
    label: "Tarefas", 
    description: "Gerenciar tarefas e atividades",
    group: "Principal" 
  },
  { 
    key: STAFF_MENU_KEYS.calendar, 
    label: "Calendário", 
    description: "Agendar e visualizar reuniões",
    group: "Principal" 
  },
  { 
    key: STAFF_MENU_KEYS.announcements, 
    label: "Comunicados", 
    description: "Publicar e ver comunicados",
    group: "Principal" 
  },
  { 
    key: STAFF_MENU_KEYS.results, 
    label: "Resultados", 
    description: "Dashboards de KPIs e análises",
    group: "Análises" 
  },
  { 
    key: STAFF_MENU_KEYS.crm, 
    label: "CRM", 
    description: "Pipeline de vendas e leads",
    group: "Comercial" 
  },
  { 
    key: STAFF_MENU_KEYS.hr, 
    label: "Vagas / RH", 
    description: "Recrutamento e seleção",
    group: "Recursos" 
  },
  { 
    key: STAFF_MENU_KEYS.circle, 
    label: "UNV Circle", 
    description: "Rede social e comunidade",
    group: "Recursos" 
  },
  { 
    key: STAFF_MENU_KEYS.academy, 
    label: "Academy", 
    description: "Trilhas e capacitação",
    group: "Recursos" 
  },
  { 
    key: STAFF_MENU_KEYS.financial, 
    label: "Módulo Financeiro", 
    description: "Gestão financeira interna",
    group: "Administração" 
  },
  { 
    key: STAFF_MENU_KEYS.ceo_dashboard, 
    label: "Painel do CEO", 
    description: "Dashboard exclusivo CEO",
    group: "Administração" 
  },
  { 
    key: STAFF_MENU_KEYS.admin_menu, 
    label: "Menu Administrar", 
    description: "Acesso ao menu administrativo",
    group: "Administração" 
  },
  { 
    key: STAFF_MENU_KEYS.settings, 
    label: "Configurações", 
    description: "Configurações do sistema",
    group: "Administração" 
  },
] as const;

// Role labels in Portuguese
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  master: "Master",
  admin: "Administrador",
  cs: "CS",
  consultant: "Consultor",
  head_comercial: "Head Comercial",
  closer: "Closer",
  sdr: "SDR",
  social_setter: "Social Setter",
  bdr: "BDR",
  rh: "RH",
  financeiro: "Financeiro",
  marketing: "Marketing",
};

// Role colors for badges
export const STAFF_ROLE_COLORS: Record<StaffRole, string> = {
  master: "bg-gradient-to-r from-amber-500 to-yellow-400 text-white",
  admin: "bg-purple-100 text-purple-800",
  cs: "bg-blue-100 text-blue-800",
  consultant: "bg-green-100 text-green-800",
  head_comercial: "bg-orange-100 text-orange-800",
  closer: "bg-cyan-100 text-cyan-800",
  sdr: "bg-teal-100 text-teal-800",
  social_setter: "bg-indigo-100 text-indigo-800",
  bdr: "bg-emerald-100 text-emerald-800",
  rh: "bg-pink-100 text-pink-800",
  financeiro: "bg-slate-100 text-slate-800",
  marketing: "bg-rose-100 text-rose-800",
};

// Commercial roles that can access CRM
export const CRM_ELIGIBLE_ROLES = ["closer", "sdr", "head_comercial", "social_setter", "bdr"] as const;

// Check if a role is master (full access)
export const isMasterRole = (role: string): boolean => {
  return role === "master";
};

// Check if a role has admin-level access (master or admin)
export const hasAdminAccess = (role: string): boolean => {
  return role === "master" || role === "admin";
};

// Check if a role has CS-level access (master, admin, or cs)
export const hasCSAccess = (role: string): boolean => {
  return role === "master" || role === "admin" || role === "cs";
};

// Check if a role has consultant-level access (master, admin, cs, or consultant)
export const hasConsultantAccess = (role: string): boolean => {
  return role === "master" || role === "admin" || role === "cs" || role === "consultant";
};

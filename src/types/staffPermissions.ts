// Staff roles including master
export type StaffRole = 
  | "master"
  | "admin" 
  | "cs" 
  | "consultant"
  | "head_comercial"
  | "closer"
  | "sdr"
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
  rh: "bg-pink-100 text-pink-800",
  financeiro: "bg-indigo-100 text-indigo-800",
  marketing: "bg-rose-100 text-rose-800",
};

// Check if a role is master (full access)
export const isMasterRole = (role: string): boolean => {
  return role === "master";
};

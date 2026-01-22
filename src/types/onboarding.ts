// Shared types for onboarding module

// All possible roles in the onboarding system
export type OnboardingRole = 
  | "admin" 
  | "cs" 
  | "consultant" 
  | "client" 
  | "gerente" 
  | "vendedor" 
  | "rh_client" 
  | "estoque" 
  | "financeiro";

// Staff-only roles (for internal team)
export type StaffRole = "admin" | "cs" | "consultant";

// Client-side roles (for client portal users)
export type ClientRole = "client" | "gerente" | "vendedor" | "rh_client" | "estoque" | "financeiro";

// User in onboarding system
export interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  role: OnboardingRole;
  password_changed?: boolean;
  user_id?: string;
  salesperson_id?: string | null;
  temp_password?: string;
}

// Menu permission keys for client portal
export const CLIENT_MENU_KEYS = {
  kpis: "kpis",
  jornada_trilha: "jornada_trilha",
  jornada_lista: "jornada_lista",
  jornada_cronograma: "jornada_cronograma",
  gestao_clientes: "gestao_clientes",
  gestao_vendas: "gestao_vendas",
  gestao_financeiro: "gestao_financeiro",
  gestao_estoque: "gestao_estoque",
  chamados: "chamados",
  reunioes: "reunioes",
  testes: "testes",
  rh: "rh",
  board: "board",
  indicar: "indicar",
} as const;

export type ClientMenuKey = typeof CLIENT_MENU_KEYS[keyof typeof CLIENT_MENU_KEYS];

// Menu structure for permission configuration
export const CLIENT_MENU_STRUCTURE = [
  { 
    key: CLIENT_MENU_KEYS.kpis, 
    label: "KPIs", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.jornada_trilha, 
    label: "Jornada > Trilha", 
    group: "Jornada" 
  },
  { 
    key: CLIENT_MENU_KEYS.jornada_lista, 
    label: "Jornada > Lista", 
    group: "Jornada" 
  },
  { 
    key: CLIENT_MENU_KEYS.jornada_cronograma, 
    label: "Jornada > Cronograma", 
    group: "Jornada" 
  },
  { 
    key: CLIENT_MENU_KEYS.gestao_clientes, 
    label: "Gestão > Clientes", 
    group: "Gestão" 
  },
  { 
    key: CLIENT_MENU_KEYS.gestao_vendas, 
    label: "Gestão > Vendas", 
    group: "Gestão" 
  },
  { 
    key: CLIENT_MENU_KEYS.gestao_financeiro, 
    label: "Gestão > Financeiro", 
    group: "Gestão" 
  },
  { 
    key: CLIENT_MENU_KEYS.gestao_estoque, 
    label: "Gestão > Estoque", 
    group: "Gestão" 
  },
  { 
    key: CLIENT_MENU_KEYS.chamados, 
    label: "Chamados", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.reunioes, 
    label: "Reuniões", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.testes, 
    label: "Testes", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.rh, 
    label: "RH", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.board, 
    label: "Board", 
    group: null 
  },
  { 
    key: CLIENT_MENU_KEYS.indicar, 
    label: "Indicar", 
    group: null 
  },
] as const;

// Role labels in Portuguese
export const ROLE_LABELS: Record<OnboardingRole, string> = {
  admin: "Admin",
  cs: "CS",
  consultant: "Consultor",
  client: "Cliente (Admin)",
  gerente: "Gerente",
  vendedor: "Vendedor",
  rh_client: "RH",
  estoque: "Estoque",
  financeiro: "Financeiro",
};

// Role colors for badges
export const ROLE_COLORS: Record<OnboardingRole, string> = {
  admin: "bg-purple-100 text-purple-800",
  cs: "bg-blue-100 text-blue-800",
  consultant: "bg-green-100 text-green-800",
  client: "bg-emerald-100 text-emerald-800",
  gerente: "bg-amber-100 text-amber-800",
  vendedor: "bg-cyan-100 text-cyan-800",
  rh_client: "bg-pink-100 text-pink-800",
  estoque: "bg-orange-100 text-orange-800",
  financeiro: "bg-indigo-100 text-indigo-800",
};

// Roles that can be created by client managers
export const CLIENT_CREATABLE_ROLES: ClientRole[] = [
  "gerente",
  "vendedor", 
  "rh_client", 
  "estoque", 
  "financeiro"
];

// Check if a role is a client-side role (not staff)
export const isClientRole = (role: OnboardingRole): role is ClientRole => {
  return ["client", "gerente", "vendedor", "rh_client", "estoque", "financeiro"].includes(role);
};

// Check if a role is a staff role
export const isStaffRole = (role: OnboardingRole): role is StaffRole => {
  return ["admin", "cs", "consultant"].includes(role);
};

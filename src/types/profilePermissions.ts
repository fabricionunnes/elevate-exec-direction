// Permissões de menu específicas do UNV Profile (RH)
// Reaproveita a tabela `staff_menu_permissions` usando o prefixo `profile_`.

export const PROFILE_MENU_KEYS = {
  profile_home: "profile_home",
  profile_dashboard: "profile_dashboard",
  profile_employees: "profile_employees",
  profile_org_chart: "profile_org_chart",
  profile_positions: "profile_positions",
  profile_recruitment: "profile_recruitment",
  profile_talent_pool: "profile_talent_pool",
  profile_disc: "profile_disc",
  profile_onboarding: "profile_onboarding",
  profile_pdi: "profile_pdi",
  profile_career: "profile_career",
  profile_trainings: "profile_trainings",
  profile_evaluations: "profile_evaluations",
  profile_feedbacks: "profile_feedbacks",
  profile_climate: "profile_climate",
  profile_ai: "profile_ai",
  profile_reports: "profile_reports",
  profile_me: "profile_me",
  profile_admin: "profile_admin",
  profile_integrations: "profile_integrations",
  profile_permissions: "profile_permissions",
} as const;

export type ProfileMenuKey = typeof PROFILE_MENU_KEYS[keyof typeof PROFILE_MENU_KEYS];

export interface ProfileMenuItem {
  key: ProfileMenuKey;
  label: string;
  description: string;
  group: string;
  path: string;
}

export const PROFILE_MENU_STRUCTURE: ProfileMenuItem[] = [
  { key: "profile_home", label: "Home", description: "Página inicial do UNV Profile", group: "Visão Geral", path: "/unv-profile" },
  { key: "profile_dashboard", label: "Dashboard", description: "Métricas e indicadores de RH", group: "Visão Geral", path: "/unv-profile/dashboard" },

  { key: "profile_employees", label: "Colaboradores", description: "Cadastro e gestão de colaboradores", group: "Pessoas", path: "/unv-profile/employees" },
  { key: "profile_org_chart", label: "Organograma", description: "Estrutura organizacional", group: "Pessoas", path: "/unv-profile/org-chart" },
  { key: "profile_positions", label: "Cargos & Salários", description: "Gestão de cargos e remuneração", group: "Pessoas", path: "/unv-profile/positions" },

  { key: "profile_recruitment", label: "Recrutamento", description: "Vagas e processos seletivos", group: "Atração", path: "/unv-profile/recruitment" },
  { key: "profile_talent_pool", label: "Banco de Talentos", description: "Pool de candidatos", group: "Atração", path: "/unv-profile/talent-pool" },

  { key: "profile_disc", label: "Perfil DISC", description: "Avaliações comportamentais", group: "Desenvolvimento", path: "/unv-profile/disc" },
  { key: "profile_onboarding", label: "Onboarding", description: "Integração de novos colaboradores", group: "Desenvolvimento", path: "/unv-profile/onboarding" },
  { key: "profile_pdi", label: "PDI", description: "Plano de Desenvolvimento Individual", group: "Desenvolvimento", path: "/unv-profile/pdi" },
  { key: "profile_career", label: "Plano de Carreira", description: "Trilhas e progressão de carreira", group: "Desenvolvimento", path: "/unv-profile/career" },
  { key: "profile_trainings", label: "Treinamentos", description: "Capacitações e cursos", group: "Desenvolvimento", path: "/unv-profile/trainings" },

  { key: "profile_evaluations", label: "Avaliações", description: "Avaliações de desempenho", group: "Performance", path: "/unv-profile/evaluations" },
  { key: "profile_feedbacks", label: "Feedbacks & 1:1", description: "Feedbacks e reuniões individuais", group: "Performance", path: "/unv-profile/feedbacks" },
  { key: "profile_climate", label: "Clima & eNPS", description: "Pesquisa de clima organizacional", group: "Performance", path: "/unv-profile/climate" },

  { key: "profile_ai", label: "UNV IA", description: "Inteligência artificial de RH", group: "Inteligência", path: "/unv-profile/ai" },
  { key: "profile_reports", label: "Relatórios", description: "Relatórios e exportações", group: "Inteligência", path: "/unv-profile/reports" },

  { key: "profile_me", label: "Minha Área", description: "Área pessoal do colaborador", group: "Pessoal", path: "/unv-profile/me" },

  { key: "profile_admin", label: "Admin UNV", description: "Administração geral do Profile", group: "Administração", path: "/unv-profile/admin" },
  { key: "profile_integrations", label: "Integrações", description: "Integrações com serviços externos", group: "Administração", path: "/unv-profile/integrations" },
  { key: "profile_permissions", label: "Permissões", description: "Gerenciar permissões dos usuários do Profile", group: "Administração", path: "/unv-profile/permissions" },
];

export const PROFILE_GROUPS = [
  "Visão Geral",
  "Pessoas",
  "Atração",
  "Desenvolvimento",
  "Performance",
  "Inteligência",
  "Pessoal",
  "Administração",
];

// Mapeia path -> chave de permissão para o Layout
export const PATH_TO_PROFILE_KEY: Record<string, ProfileMenuKey> = PROFILE_MENU_STRUCTURE.reduce(
  (acc, item) => {
    acc[item.path] = item.key;
    return acc;
  },
  {} as Record<string, ProfileMenuKey>,
);

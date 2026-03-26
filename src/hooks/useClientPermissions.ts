import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OnboardingUser, ClientMenuKey } from "@/types/onboarding";
import { CLIENT_MENU_KEYS } from "@/types/onboarding";

interface UseClientPermissionsResult {
  loading: boolean;
  currentUser: OnboardingUser | null;
  permissions: string[];
  hasPermission: (menuKey: ClientMenuKey | string) => boolean;
  hasAnyPermission: (menuKeys: (ClientMenuKey | string)[]) => boolean;
  isFullAccess: boolean; // client or gerente roles have full access
  salespersonId: string | null;
}

export function useClientPermissions(projectId: string | undefined): UseClientPermissionsResult {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<OnboardingUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [projectEnabledMenus, setProjectEnabledMenus] = useState<Set<string> | null>(null);
  const [projectAllKeys, setProjectAllKeys] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const fetchUserAndPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch project-level menu permissions and user data in parallel
        const [onboardingUserResult, projectMenuResult] = await Promise.all([
          supabase
            .from("onboarding_users")
            .select("*")
            .eq("user_id", user.id)
            .eq("project_id", projectId)
            .maybeSingle(),
          supabase
            .from("project_menu_permissions")
            .select("menu_key, is_enabled")
            .eq("project_id", projectId),
        ]);

        const onboardingUser = onboardingUserResult.data;

        // Process project-level menu permissions
        if (projectMenuResult.data && projectMenuResult.data.length > 0) {
          const allKeys = new Set(projectMenuResult.data.map((p) => p.menu_key));
          const enabled = new Set(
            projectMenuResult.data
              .filter((p) => p.is_enabled)
              .map((p) => p.menu_key)
          );
          setProjectAllKeys(allKeys);
          setProjectEnabledMenus(enabled);
        } else {
          // No config = all menus enabled
          setProjectAllKeys(null);
          setProjectEnabledMenus(null);
        }

        if (!onboardingUser) {
          setLoading(false);
          return;
        }

        setCurrentUser(onboardingUser as OnboardingUser);

        // Only "client" role has full access - gerente now needs permissions
        if (onboardingUser.role === "client") {
          setPermissions([]);
          setLoading(false);
          return;
        }

        // Fetch permissions for restricted roles
        const { data: permsData } = await supabase
          .from("client_user_permissions")
          .select("menu_key")
          .eq("user_id", onboardingUser.id);

        setPermissions((permsData || []).map(p => p.menu_key));
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndPermissions();
  }, [projectId]);

  const isFullAccess = useMemo(() => {
    if (!currentUser) return false;
    // Only "client" role has full access
    return currentUser.role === "client";
  }, [currentUser]);

  const hasPermission = (menuKey: ClientMenuKey | string): boolean => {
    if (!currentUser) return false;
    // Check project-level permissions first - if menu is disabled at project level, deny
    // But only deny if the key was explicitly configured (exists in the saved config)
    if (projectEnabledMenus !== null && !projectEnabledMenus.has(menuKey)) {
      // If the key was never saved in project config, allow it by default (new keys)
      // We check if the key exists in any form in the saved data
      if (projectAllKeys !== null && projectAllKeys.has(menuKey)) {
        return false;
      }
      // Key not in saved config at all - allow by default (new permission added after config was saved)
    }
    // Full access roles
    if (isFullAccess) return true;
    // For restricted roles, check permissions
    return permissions.includes(menuKey);
  };

  const hasAnyPermission = (menuKeys: (ClientMenuKey | string)[]): boolean => {
    return menuKeys.some(key => hasPermission(key));
  };

  return {
    loading,
    currentUser,
    permissions,
    hasPermission,
    hasAnyPermission,
    isFullAccess,
    salespersonId: currentUser?.salesperson_id || null,
  };
}

// ViewType to MenuKey mapping for filtering menus
export const VIEW_TO_MENU_KEY: Record<string, ClientMenuKey> = {
  kpis: CLIENT_MENU_KEYS.kpis,
  trail: CLIENT_MENU_KEYS.jornada_trilha,
  list: CLIENT_MENU_KEYS.jornada_lista,
  timeline: CLIENT_MENU_KEYS.jornada_cronograma,
  customers: CLIENT_MENU_KEYS.gestao_clientes,
  sales: CLIENT_MENU_KEYS.gestao_vendas,
  financial: CLIENT_MENU_KEYS.gestao_financeiro,
  inventory: CLIENT_MENU_KEYS.gestao_estoque,
  tickets: CLIENT_MENU_KEYS.chamados,
  meetings: CLIENT_MENU_KEYS.reunioes,
  assessments: CLIENT_MENU_KEYS.testes,
  rh: CLIENT_MENU_KEYS.rh,
  board: CLIENT_MENU_KEYS.board,
  referrals: CLIENT_MENU_KEYS.indicar,
  appointments: CLIENT_MENU_KEYS.gestao_agendamentos,
  billing: CLIENT_MENU_KEYS.minhas_faturas,
  paid_traffic: CLIENT_MENU_KEYS.trafego_pago,
  sales_funnel: CLIENT_MENU_KEYS.funil_vendas,
  instagram: CLIENT_MENU_KEYS.instagram,
  commercial_director: CLIENT_MENU_KEYS.diretor_comercial_ia,
  other_services: CLIENT_MENU_KEYS.outros_servicos,
  social: CLIENT_MENU_KEYS.unv_social,
  routine_contract: CLIENT_MENU_KEYS.contrato_rotina,
  commercial_actions: CLIENT_MENU_KEYS.acoes_comerciais,
  meta_ads: CLIENT_MENU_KEYS.meta_ads,
  crm_comercial: CLIENT_MENU_KEYS.crm_comercial,
  b2b_prospection: CLIENT_MENU_KEYS.prospeccao_b2b,
};

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMasterRole, type FinancialPermissionKey, FINANCIAL_PERMISSION_KEYS } from "@/types/staffPermissions";

interface UseFinancialPermissionsResult {
  loading: boolean;
  staffId: string | null;
  userRole: string | null;
  isMaster: boolean;
  financialPermissions: string[];
  hasFinancialPermission: (key: FinancialPermissionKey | string) => boolean;
  hasAnyFinancialPermission: (keys: (FinancialPermissionKey | string)[]) => boolean;
  hasFinancialAccess: boolean;
  refetch: () => Promise<void>;
}

export function useFinancialPermissions(): UseFinancialPermissionsResult {
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [financialPermissions, setFinancialPermissions] = useState<string[]>([]);
  const [hasFinancialMenuAccess, setHasFinancialMenuAccess] = useState(false);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) { setLoading(false); return; }

      setStaffId(staff.id);
      setUserRole((staff as any).role);

      // Master has full access
      if (isMasterRole((staff as any).role)) {
        setHasFinancialMenuAccess(true);
        setFinancialPermissions([]);
        setLoading(false);
        return;
      }

      // Check main financial menu permission
      const { data: menuPerm } = await supabase
        .from("staff_menu_permissions")
        .select("id")
        .eq("staff_id", staff.id)
        .eq("menu_key", "financial")
        .maybeSingle();

      setHasFinancialMenuAccess(!!menuPerm);

      if (!menuPerm) {
        setFinancialPermissions([]);
        setLoading(false);
        return;
      }

      // Fetch granular financial permissions
      const { data: finPerms } = await supabase
        .from("staff_financial_permissions")
        .select("permission_key")
        .eq("staff_id", staff.id);

      setFinancialPermissions((finPerms || []).map(p => p.permission_key));
    } catch (error) {
      console.error("Error fetching financial permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPermissions(); }, []);

  const isMaster = useMemo(() => userRole ? isMasterRole(userRole) : false, [userRole]);

  const hasFinancialPermission = (key: FinancialPermissionKey | string): boolean => {
    if (isMaster) return true;
    if (!hasFinancialMenuAccess) return false;
    return financialPermissions.includes(key);
  };

  const hasAnyFinancialPermission = (keys: (FinancialPermissionKey | string)[]): boolean => {
    return keys.some(k => hasFinancialPermission(k));
  };

  return {
    loading,
    staffId,
    userRole,
    isMaster,
    financialPermissions,
    hasFinancialPermission,
    hasAnyFinancialPermission,
    hasFinancialAccess: isMaster || hasFinancialMenuAccess,
    refetch: fetchPermissions,
  };
}

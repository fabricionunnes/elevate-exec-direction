import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMenuKey, StaffRole } from "@/types/staffPermissions";
import { STAFF_MENU_KEYS, isMasterRole } from "@/types/staffPermissions";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  avatar_url?: string | null;
  is_active: boolean;
}

interface UseStaffPermissionsResult {
  loading: boolean;
  currentStaff: StaffMember | null;
  permissions: string[];
  hasPermission: (menuKey: StaffMenuKey | string) => boolean;
  hasAnyPermission: (menuKeys: (StaffMenuKey | string)[]) => boolean;
  isMaster: boolean;
  refetch: () => Promise<void>;
}

export function useStaffPermissions(): UseStaffPermissionsResult {
  const [loading, setLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchStaffAndPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get staff member
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, email, role, avatar_url, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) {
        setLoading(false);
        return;
      }

      setCurrentStaff(staff as StaffMember);

      // Master role has full access - no need to fetch permissions
      if (isMasterRole(staff.role)) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Fetch permissions for non-master roles
      const { data: permsData } = await supabase
        .from("staff_menu_permissions")
        .select("menu_key")
        .eq("staff_id", staff.id);

      setPermissions((permsData || []).map(p => p.menu_key));
    } catch (error) {
      console.error("Error fetching staff permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffAndPermissions();
  }, []);

  const isMaster = useMemo(() => {
    if (!currentStaff) return false;
    return isMasterRole(currentStaff.role);
  }, [currentStaff]);

  const hasPermission = (menuKey: StaffMenuKey | string): boolean => {
    if (!currentStaff) return false;
    // Master has all permissions
    if (isMaster) return true;
    // Check permissions
    return permissions.includes(menuKey);
  };

  const hasAnyPermission = (menuKeys: (StaffMenuKey | string)[]): boolean => {
    return menuKeys.some(key => hasPermission(key));
  };

  return {
    loading,
    currentStaff,
    permissions,
    hasPermission,
    hasAnyPermission,
    isMaster,
    refetch: fetchStaffAndPermissions,
  };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

/**
 * Define o "escopo de visualização" do UNV Profile.
 * - Master OU staff com permissão `profile_admin` => vê tudo da empresa.
 * - Demais => vê apenas o que se refere ao seu próprio profile_employees.id.
 */
export function useProfileViewerScope() {
  const { currentStaff, isMaster, hasPermission, loading: permsLoading } = useStaffPermissions();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = isMaster || hasPermission("profile_admin");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (permsLoading) return;
      if (!currentStaff?.id) {
        if (!cancelled) {
          setEmployeeId(null);
          setLoading(false);
        }
        return;
      }
      // Busca o profile_employees vinculado ao staff atual.
      const { data } = await supabase
        .from("profile_employees")
        .select("id")
        .eq("staff_id", currentStaff.id)
        .maybeSingle();
      if (!cancelled) {
        setEmployeeId(data?.id || null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentStaff?.id, permsLoading]);

  return {
    loading: loading || permsLoading,
    isAdmin,
    employeeId,
  };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user is a Circle admin
 * Admins can edit/delete any content in the Circle network
 */
export function useCircleAdmin() {
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["circle-is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_circle_admin");
      if (error) {
        console.error("Error checking admin status:", error);
        return false;
      }
      return data as boolean;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    isAdmin: isAdmin ?? false,
    isLoading,
  };
}

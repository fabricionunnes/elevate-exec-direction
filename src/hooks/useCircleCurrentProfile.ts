import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";

type CircleProfile = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  company_name?: string | null;
  role_title?: string | null;
  current_level?: number;
  level_name?: string;
  total_points?: number;
};

function deriveDisplayNameFromEmail(email?: string | null) {
  if (!email) return "Usuário";
  const base = email.split("@")[0] || "Usuário";
  return base
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function useCircleCurrentProfile() {
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);

  // Listen for auth state changes to properly track user
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUser = session?.user ?? null;
        setAuthUser(newUser);
        
        // Invalidate profile query when auth changes
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          queryClient.invalidateQueries({ queryKey: ["circle-profile-current"] });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: ["circle-profile-current", authUser?.id],
    queryFn: async () => {
      // Wait for auth to be determined
      if (authUser === undefined) return null;
      if (!authUser) return null;

      const { data: existing, error: existingError } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing as CircleProfile;

      // Try to hydrate basic info from existing Nexus tables (best-effort).
      const [staffRes, onboardingUserRes] = await Promise.all([
        supabase
          .from("onboarding_staff")
          .select("name, role")
          .eq("user_id", authUser.id)
          .maybeSingle(),
        supabase
          .from("onboarding_users")
          .select("name, role")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ]);

      const displayName =
        staffRes.data?.name ||
        onboardingUserRes.data?.name ||
        (authUser.user_metadata as any)?.display_name ||
        (authUser.user_metadata as any)?.full_name ||
        deriveDisplayNameFromEmail(authUser.email);

      const roleTitle = staffRes.data?.role || onboardingUserRes.data?.role || null;

      const { data: created, error: createError } = await supabase
        .from("circle_profiles")
        .insert({
          user_id: authUser.id,
          display_name: displayName,
          role_title: roleTitle,
          total_points: 0,
          current_level: 1,
          level_name: "Iniciante",
          is_active: true,
        } as any)
        .select("*")
        .single();

      if (createError) throw createError;
      return created as CircleProfile;
    },
    // Only run when we know the auth state (not undefined)
    enabled: authUser !== undefined,
    // Keep data fresh but don't refetch too aggressively
    staleTime: 30000,
    gcTime: 60000,
  });
}

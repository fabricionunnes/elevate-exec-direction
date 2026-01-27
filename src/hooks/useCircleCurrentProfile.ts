import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  return useQuery({
    queryKey: ["circle-profile-current"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data: existing, error: existingError } = await supabase
        .from("circle_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing as CircleProfile;

      // Try to hydrate basic info from existing Nexus tables (best-effort).
      const [staffRes, onboardingUserRes] = await Promise.all([
        supabase
          .from("onboarding_staff")
          .select("name, role")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("onboarding_users")
          .select("name, role")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const displayName =
        staffRes.data?.name ||
        onboardingUserRes.data?.name ||
        (user.user_metadata as any)?.display_name ||
        (user.user_metadata as any)?.full_name ||
        deriveDisplayNameFromEmail(user.email);

      const roleTitle = staffRes.data?.role || onboardingUserRes.data?.role || null;

      const { data: created, error: createError } = await supabase
        .from("circle_profiles")
        .insert({
          user_id: user.id,
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
  });
}

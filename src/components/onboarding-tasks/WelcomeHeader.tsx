import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WelcomeHeaderProps {
  className?: string;
}

export const WelcomeHeader = ({ className }: WelcomeHeaderProps) => {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to get staff name first
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff?.name) {
        setUserName(staff.name);
        return;
      }

      // Try to get onboarding user name
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser?.name) {
        setUserName(onboardingUser.name);
        return;
      }

      // Fallback to email
      setUserName(user.email?.split("@")[0] || null);
    };

    fetchUserName();
  }, []);

  if (!userName) return null;

  // Get first name only
  const firstName = userName.split(" ")[0];

  return (
    <span className={className}>
      Bem-vindo, <strong>{firstName}</strong>
    </span>
  );
};

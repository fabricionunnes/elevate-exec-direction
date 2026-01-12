import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface WelcomeHeaderProps {
  className?: string;
  showAvatar?: boolean;
}

export const WelcomeHeader = ({ className, showAvatar = false }: WelcomeHeaderProps) => {
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to get staff name first
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff?.name) {
        setUserName(staff.name);
        setAvatarUrl(staff.avatar_url);
        return;
      }

      // Try to get onboarding user name
      const { data: onboardingUser } = await supabase
        .from("onboarding_users")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (onboardingUser?.name) {
        setUserName(onboardingUser.name);
        setAvatarUrl(onboardingUser.avatar_url);
        return;
      }

      // Fallback to email
      setUserName(user.email?.split("@")[0] || null);
    };

    fetchUserData();
  }, []);

  if (!userName) return null;

  // Get first name only
  const firstName = userName.split(" ")[0];
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {showAvatar && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl || undefined} alt={userName} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
      )}
      <span>
        Bem-vindo, <strong>{firstName}</strong>
      </span>
    </div>
  );
};

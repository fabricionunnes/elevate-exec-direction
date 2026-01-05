import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeNotifications } from "./RealtimeNotifications";
import { NpsCelebrationPopup } from "./NpsCelebrationPopup";
import GlobalChatWidget from "@/components/virtual-office/GlobalChatWidget";

export const OnboardingStaffLayout = () => {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkStaffStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Não logado, redireciona para login
        if (!location.pathname.includes('/login')) {
          navigate("/onboarding-tasks/login");
        }
        setIsStaff(false);
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      setIsStaff(!!staff);
    };

    checkStaffStatus();
  }, [location.pathname, navigate]);

  // Se está na página de login, não mostra notificações
  if (location.pathname.includes('/login')) {
    return <Outlet />;
  }

  // Enquanto verifica, não renderiza nada (ou pode mostrar loading)
  if (isStaff === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Notificações globais para staff */}
      {isStaff && <RealtimeNotifications />}
      {/* Celebração NPS 10 para staff */}
      {isStaff && <NpsCelebrationPopup />}
      {/* Chat global para staff */}
      {isStaff && <GlobalChatWidget />}
      <Outlet />
    </>
  );
};

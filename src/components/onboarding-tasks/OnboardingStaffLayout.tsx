import { useEffect, useState, Suspense, lazy } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";

// Lazy load heavy components to prevent white screen issues
const RealtimeNotifications = lazy(() => import("./RealtimeNotifications").then(m => ({ default: m.RealtimeNotifications })));
const NpsCelebrationPopup = lazy(() => import("./NpsCelebrationPopup").then(m => ({ default: m.NpsCelebrationPopup })));
const GlobalChatWidget = lazy(() => import("@/components/virtual-office/GlobalChatWidget"));
const ChatNotifications = lazy(() => import("@/components/virtual-office/ChatNotifications").then(m => ({ default: m.ChatNotifications })));
const AnnouncementPopup = lazy(() => import("./AnnouncementPopup").then(m => ({ default: m.AnnouncementPopup })));

// Simple fallback that doesn't break layout
const LoadingFallback = () => null;

export const OnboardingStaffLayout = () => {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hook global de presença - mantém online enquanto logado
  useGlobalPresence(staffId);

  useEffect(() => {
    let isMounted = true;
    
    const checkStaffStatus = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!isMounted) return;
        
        if (authError || !user) {
          // Não logado, redireciona para login
          if (!location.pathname.includes('/login')) {
            navigate("/onboarding-tasks/login");
          }
          setIsStaff(false);
          setStaffId(null);
          setStaffRole(null);
          setAuthChecked(true);
          return;
        }

        const { data: staff, error: staffError } = await supabase
          .from("onboarding_staff")
          .select("id, is_active, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (!isMounted) return;

        if (staffError) {
          console.warn("Error checking staff status:", staffError);
        }

        setIsStaff(!!staff);
        setStaffId(staff?.id || null);
        setStaffRole(staff?.role || null);
        setAuthChecked(true);
      } catch (error) {
        console.error("Error in checkStaffStatus:", error);
        if (isMounted) {
          setIsStaff(false);
          setStaffId(null);
          setStaffRole(null);
          setAuthChecked(true);
        }
      }
    };

    checkStaffStatus();
    
    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate]);

  // Se está na página de login, não mostra notificações
  if (location.pathname.includes('/login')) {
    return <Outlet />;
  }

  // Enquanto verifica auth, mostra loading spinner
  if (!authChecked || isStaff === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Notificações globais para staff - wrapped in Suspense */}
      {isStaff && (
        <Suspense fallback={<LoadingFallback />}>
          <RealtimeNotifications />
        </Suspense>
      )}
      {/* Notificações de chat em tempo real */}
      {isStaff && (
        <Suspense fallback={<LoadingFallback />}>
          <ChatNotifications />
        </Suspense>
      )}
      {/* Celebração NPS 10 para staff */}
      {isStaff && (
        <Suspense fallback={<LoadingFallback />}>
          <NpsCelebrationPopup />
        </Suspense>
      )}
      {/* Popup de comunicados - aparece até o usuário marcar como ciente */}
      {isStaff && staffId && staffRole && (
        <Suspense fallback={<LoadingFallback />}>
          <AnnouncementPopup staffId={staffId} staffRole={staffRole} />
        </Suspense>
      )}
      {/* Chat global para staff */}
      {isStaff && (
        <Suspense fallback={<LoadingFallback />}>
          <GlobalChatWidget />
        </Suspense>
      )}
      <Outlet />
    </>
  );
};

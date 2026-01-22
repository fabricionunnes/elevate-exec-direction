import { useEffect, useState, Suspense, lazy } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";
import { useGoogleCalendarTokenSync } from "@/hooks/useGoogleCalendarTokenSync";

// Lazy load heavy components to prevent white screen issues
const RealtimeNotifications = lazy(() => import("./RealtimeNotifications").then(m => ({ default: m.RealtimeNotifications })));
const NpsCelebrationPopup = lazy(() => import("./NpsCelebrationPopup").then(m => ({ default: m.NpsCelebrationPopup })));
const GlobalChatWidget = lazy(() => import("@/components/virtual-office/GlobalChatWidget"));
const ChatNotifications = lazy(() => import("@/components/virtual-office/ChatNotifications").then(m => ({ default: m.ChatNotifications })));
const AnnouncementPopup = lazy(() => import("./AnnouncementPopup").then(m => ({ default: m.AnnouncementPopup })));
const GlobalSupportNotification = lazy(() => import("./GlobalSupportNotification").then(m => ({ default: m.GlobalSupportNotification })));

// Simple fallback that doesn't break layout
const LoadingFallback = () => null;

export const OnboardingStaffLayout = () => {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [clientRedirecting, setClientRedirecting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hook global de presença - mantém online enquanto logado
  useGlobalPresence(staffId);

  // Sincroniza tokens do Google Calendar após retorno do OAuth
  useGoogleCalendarTokenSync();

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

        // If user is NOT staff, try to redirect them to the client portal (first active project).
        if (!staff && !location.pathname.includes("/login")) {
          setClientRedirecting(true);
          const { data: clientMemberships, error: clientMembershipError } = await supabase
            .from("onboarding_users")
            .select(
              "project_id, role, project:onboarding_projects(status)"
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (!isMounted) return;

          if (clientMembershipError) {
            console.warn("Error checking client membership:", clientMembershipError);
          }

          const firstActiveProject = (clientMemberships || []).find((m: any) => {
            const status = m?.project?.status;
            return status !== "closed" && status !== "completed";
          });

          if (firstActiveProject?.project_id) {
            navigate(`/onboarding-client/${firstActiveProject.project_id}`);
            return;
          }
        }

        setClientRedirecting(false);
        setIsStaff(!!staff);
        setStaffId(staff?.id || null);
        setStaffRole(staff?.role || null);
        setAuthChecked(true);

        // Redirect commercial roles to CRM as home page
        const commercialRoles = ["head_comercial", "closer", "sdr"];
        if (staff && commercialRoles.includes(staff.role) && location.pathname === "/onboarding-tasks") {
          navigate("/crm");
        }
      } catch (error) {
        console.error("Error in checkStaffStatus:", error);
        if (isMounted) {
          setIsStaff(false);
          setStaffId(null);
          setStaffRole(null);
          setClientRedirecting(false);
          setAuthChecked(true);
        }
      }
    };

    checkStaffStatus();
    
    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate]);

  // Se está na página de login, permite acesso
  if (location.pathname.includes('/login')) {
    return <Outlet />;
  }

  // Enquanto verifica auth (ou redireciona cliente), mostra loading spinner
  if (!authChecked || isStaff === null || clientRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // SECURITY: Block access if user is not staff
  // Client users should only access /onboarding-client/:projectId routes
  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para acessar esta área. 
            Esta seção é exclusiva para a equipe interna.
          </p>
        </div>
        <button 
          onClick={() => navigate("/onboarding-tasks/login")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Ir para Login
        </button>
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
      {/* Notificações globais de suporte ao vivo */}
      {isStaff && (
        <Suspense fallback={<LoadingFallback />}>
          <GlobalSupportNotification />
        </Suspense>
      )}
      <Outlet />
    </>
  );
};

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CRMContext, type CRMContextType } from "./CRMLayout";
import CRMDialerPage from "./CRMDialerPage";
import { Button } from "@/components/ui/button";
import { LogOut, Phone } from "lucide-react";

// Discador acessível ao cliente do portal (onboarding_users com dialer_enabled) OU staff,
// no mesmo login, fora do gate de staff do CRM.
export default function CRMDialerStandalonePage() {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<CRMContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/onboarding-tasks/login"); return; }

      // 1) é staff? (usa o discador normal do CRM via tenant do staff)
      const { data: staff } = await supabase
        .from("onboarding_staff").select("id, name, role, tenant_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();

      let agentId: string | null = null, tenantId: string | null = null, name = "", role: string | null = null, isAdmin = false;
      if (staff) {
        agentId = staff.id; tenantId = staff.tenant_id; name = staff.name; role = staff.role;
        isAdmin = ["master", "admin", "head_comercial"].includes(staff.role);
      } else {
        // 2) cliente do portal com discador habilitado
        const { data: pu } = await supabase
          .from("onboarding_users").select("id, name, tenant_id, dialer_tenant_id, dialer_enabled")
          .eq("user_id", user.id).eq("dialer_enabled", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (pu?.dialer_enabled) { agentId = pu.id; tenantId = pu.dialer_tenant_id || pu.tenant_id; name = pu.name; role = "client"; }
      }

      if (!agentId) { setDenied(true); setLoading(false); return; }

      setCtx({
        staffRole: role, staffName: name, staffId: agentId, tenantId,
        isAdmin, isMaster: false,
        selectedOrigin: null, setSelectedOrigin: () => {},
        selectedPipeline: null, setSelectedPipeline: () => {},
      });
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }
  if (denied || !ctx) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <Phone className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">Discador não habilitado</h1>
        <p className="text-sm text-muted-foreground max-w-md">Sua conta não tem o discador liberado. Fale com a UNV para contratar.</p>
        <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate("/onboarding-tasks/login"); }}>Sair</Button>
      </div>
    );
  }

  return (
    <CRMContext.Provider value={ctx}>
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 font-semibold"><Phone className="h-5 w-5 text-primary" /> Discador</div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={async () => { await supabase.auth.signOut(); navigate("/onboarding-tasks/login"); }}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </header>
        <div className="flex-1 overflow-hidden">
          <CRMDialerPage />
        </div>
      </div>
    </CRMContext.Provider>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { KPIDashboardTab } from "@/components/onboarding-tasks/kpis/KPIDashboardTab";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

interface SalespersonInfo {
  id: string;
  name: string;
  email: string | null;
  company_id: string;
  company_name?: string;
}

export default function VendedorKPIPage() {
  const { salespersonId } = useParams<{ salespersonId: string }>();
  const navigate = useNavigate();
  const [salesperson, setSalesperson] = useState<SalespersonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [salespersonId]);

  const checkAuth = async () => {
    try {
      // Verify the logged-in user owns this salesperson profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: sp, error } = await supabase
        .from("company_salespeople")
        .select("id, name, email, company_id, is_active")
        .eq("id", salespersonId!)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !sp) {
        toast.error("Acesso não autorizado");
        navigate("/onboarding-tasks/login");
        return;
      }

      // Fetch company name
      const { data: company } = await supabase
        .from("onboarding_companies")
        .select("name")
        .eq("id", sp.company_id)
        .maybeSingle();

      setSalesperson({ ...sp, company_name: company?.name });
      setAuthorized(true);
    } catch (err) {
      console.error("Auth check error:", err);
      navigate("/onboarding-tasks/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/onboarding-tasks/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!authorized || !salesperson) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{salesperson.name}</p>
              {salesperson.company_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{salesperson.company_name}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground gap-2">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* KPI Dashboard filtered to this salesperson */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <KPIDashboardTab
          companyId={salesperson.company_id}
          salespersonId={salesperson.id}
          canDeleteEntries={false}
          canEditSalesHistory={true}
          isClientView={true}
          isSalespersonView={true}
        />
      </div>
    </div>
  );
}

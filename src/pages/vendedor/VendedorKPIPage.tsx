import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { KPIDashboardTab } from "@/components/onboarding-tasks/kpis/KPIDashboardTab";
import { Button } from "@/components/ui/button";
import { LogOut, User, GraduationCap, ChevronRight, BookOpen } from "lucide-react";
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
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">{salesperson.name}</p>
              {salesperson.company_name && (
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{salesperson.company_name}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground gap-1.5 text-xs hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Banner UNV Academy */}
        <div className="relative overflow-hidden rounded-2xl shadow-lg">
          {/* Fundo gradiente */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
          {/* Brilho decorativo */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-5 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
          {/* Padrão de pontos */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px"}} />

          <div className="relative px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-lg shrink-0">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-bold text-base leading-none">UNV Academy</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-violet-200 bg-white/15 px-1.5 py-0.5 rounded-full">Novo</span>
                </div>
                <p className="text-white/70 text-xs leading-snug">Treinamentos e trilhas para você vender mais</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-white text-violet-700 hover:bg-white/90 font-bold gap-1.5 shadow-xl rounded-xl px-4 h-9 shrink-0 transition-all hover:scale-105"
              onClick={() => navigate('/academy')}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Acessar
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* KPI Dashboard filtered to this salesperson */}
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

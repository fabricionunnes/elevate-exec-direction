import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Building2, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Company {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  cs_id: string | null;
  consultant_id: string | null;
  cs?: Staff;
  consultant?: Staff;
  kickoff_date: string | null;
  created_at: string;
}

const OnboardingCompaniesPage = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserPermissions();
    fetchCompanies();
  }, []);

  const checkUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        if (staffMember) {
          setCurrentUserRole(staffMember.role);
        }
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select(`
          *,
          cs:onboarding_staff!onboarding_companies_cs_id_fkey(id, name, role),
          consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name, role)
        `)
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.segment && c.segment.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativa</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inativa</Badge>;
      case "churned":
        return <Badge variant="destructive">Churned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Only admin and CS can create new companies
  const canCreateCompany = currentUserRole === "admin" || currentUserRole === "cs";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Empresas</h1>
              <p className="text-muted-foreground">
                Gerencie empresas e kickoffs
              </p>
            </div>
          </div>
          {canCreateCompany && (
            <Button onClick={() => navigate("/onboarding-tasks/companies/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou segmento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{companies.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">
                {companies.filter((c) => c.status === "active").length}
              </div>
              <div className="text-sm text-muted-foreground">Ativas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-500">
                {companies.filter((c) => !c.kickoff_date).length}
              </div>
              <div className="text-sm text-muted-foreground">Sem Kickoff</div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Grid */}
        {filteredCompanies.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma empresa encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {canCreateCompany ? "Cadastre sua primeira empresa para começar" : "Aguarde o cadastro de empresas pelo CS ou Admin"}
            </p>
            {canCreateCompany && (
              <Button onClick={() => navigate("/onboarding-tasks/companies/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                    {getStatusBadge(company.status)}
                  </div>
                  {company.segment && (
                    <p className="text-sm text-muted-foreground">{company.segment}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* CS */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CS:</span>
                      <span className="font-medium">
                        {company.cs?.name || <span className="text-amber-500">Não definido</span>}
                      </span>
                    </div>

                    {/* Consultor */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Consultor:</span>
                      <span className="font-medium">
                        {company.consultant?.name || <span className="text-amber-500">Não definido</span>}
                      </span>
                    </div>

                    {/* Kickoff */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Kickoff:</span>
                      <span className="font-medium">
                        {company.kickoff_date ? (
                          format(new Date(company.kickoff_date), "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span className="text-amber-500">Pendente</span>
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingCompaniesPage;

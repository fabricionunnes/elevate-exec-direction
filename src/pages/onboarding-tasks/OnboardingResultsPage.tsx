import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { KPIDashboardTab } from "@/components/onboarding-tasks/kpis/KPIDashboardTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  TrendingUp, 
  Building2,
  Users,
  Package,
  Search,
  ArrowLeft,
  ChevronRight,
  X
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Company {
  id: string;
  name: string;
  segment: string | null;
  cs_id: string | null;
  consultant_id: string | null;
  status: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  onboarding_company_id: string | null;
  status: string;
}

const OnboardingResultsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // Selected company for detailed view
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => searchParams.get("company"));
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConsultant, setFilterConsultant] = useState<string>(() => searchParams.get("consultant") || "all");
  const [filterService, setFilterService] = useState<string>(() => searchParams.get("service") || "all");
  
  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Check staff permissions
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staff || (staff.role !== "admin" && staff.role !== "cs")) {
        toast.error("Acesso restrito a Admin e CS");
        navigate("/onboarding-tasks");
        return;
      }

      setCurrentStaff(staff);
    };

    checkAuth();
  }, [navigate]);

  // Fetch data
  useEffect(() => {
    if (currentStaff) {
      fetchData();
    }
  }, [currentStaff]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("company", selectedCompanyId);
    if (filterConsultant !== "all") params.set("consultant", filterConsultant);
    if (filterService !== "all") params.set("service", filterService);
    setSearchParams(params, { replace: true });
  }, [selectedCompanyId, filterConsultant, filterService, setSearchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companiesRes, staffRes, servicesRes, projectsRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name, segment, cs_id, consultant_id, status").eq("status", "active").order("name"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("onboarding_services").select("id, name").order("name"),
        supabase.from("onboarding_projects").select("id, product_id, product_name, onboarding_company_id, status").eq("status", "active"),
      ]);

      setCompanies(companiesRes.data || []);
      setConsultants((staffRes.data || []).filter(s => s.role === "consultant" || s.role === "cs"));
      setServices(servicesRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Consultant filter
      const matchesConsultant = filterConsultant === "all" || 
        company.cs_id === filterConsultant || 
        company.consultant_id === filterConsultant;
      
      // Service filter
      let matchesService = filterService === "all";
      if (!matchesService) {
        const companyProjects = projects.filter(p => p.onboarding_company_id === company.id);
        matchesService = companyProjects.some(p => p.product_id === filterService);
      }
      
      return matchesSearch && matchesConsultant && matchesService;
    });
  }, [companies, searchTerm, filterConsultant, filterService, projects]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterConsultant("all");
    setFilterService("all");
  };

  const hasActiveFilters = filterConsultant !== "all" || filterService !== "all" || searchTerm !== "";

  // Get selected company data
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [selectedCompanyId, companies]);

  // Get consultant name
  const getConsultantName = (id: string | null) => {
    if (!id) return null;
    return consultants.find(c => c.id === id)?.name || null;
  };

  // Get project for company
  const getProjectForCompany = (companyId: string) => {
    return projects.find(p => p.onboarding_company_id === companyId);
  };

  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => {
                if (selectedCompanyId) {
                  setSelectedCompanyId(null);
                } else {
                  navigate("/onboarding-tasks");
                }
              }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader showTitle={false} />
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {selectedCompany ? selectedCompany.name : "Resultados"}
                </h1>
                {selectedCompany && (
                  <p className="text-xs text-muted-foreground">
                    Dashboard de KPIs
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Show company list or KPI Dashboard */}
        {selectedCompanyId && selectedCompany ? (
          /* KPI Dashboard for selected company */
          <div>
            {/* Company Info Bar */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{selectedCompany.name}</h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {selectedCompany.segment && (
                          <span>{selectedCompany.segment}</span>
                        )}
                        {getConsultantName(selectedCompany.consultant_id) && (
                          <>
                            <span>•</span>
                            <span>{getConsultantName(selectedCompany.consultant_id)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const project = getProjectForCompany(selectedCompanyId);
                        if (project) {
                          navigate(`/onboarding-tasks/${project.id}?tab=kpis`);
                        } else {
                          navigate(`/onboarding-tasks/companies/${selectedCompanyId}`);
                        }
                      }}
                    >
                      Ver Projeto Completo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI Dashboard Component */}
            <KPIDashboardTab 
              companyId={selectedCompanyId} 
              projectId={getProjectForCompany(selectedCompanyId)?.id}
              canDeleteEntries={currentStaff.role === "admin" || currentStaff.role === "cs"}
            />
          </div>
        ) : (
          /* Company List */
          <>
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Buscar empresa</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite o nome da empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Consultor/CS</Label>
                    <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                      <SelectTrigger className="w-[180px]">
                        <Users className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {consultants.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Serviço</Label>
                    <Select value={filterService} onValueChange={setFilterService}>
                      <SelectTrigger className="w-[180px]">
                        <Package className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os serviços</SelectItem>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Companies List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma empresa encontrada</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''} encontrada{filteredCompanies.length !== 1 ? 's' : ''}
                </p>
                {filteredCompanies.map((company) => {
                  const project = getProjectForCompany(company.id);
                  const consultantName = getConsultantName(company.consultant_id);
                  const csName = getConsultantName(company.cs_id);
                  
                  return (
                    <Card 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">{company.name}</h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                {company.segment && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {company.segment}
                                  </Badge>
                                )}
                                {project && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {project.product_name}
                                  </Badge>
                                )}
                                {consultantName && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {consultantName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingResultsPage;

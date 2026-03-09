import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Loader2, LayoutDashboard, AlertTriangle, FileText,
  XCircle, ShieldCheck, PieChart, Brain, Filter,
} from "lucide-react";
import { CRDashboardTab } from "@/components/cancellations-retention/CRDashboardTab";
import { CRCompaniesInNoticeTab } from "@/components/cancellations-retention/CRCompaniesInNoticeTab";
import { CRCancellationRequestsTab } from "@/components/cancellations-retention/CRCancellationRequestsTab";
import { CRConfirmedCancellationsTab } from "@/components/cancellations-retention/CRConfirmedCancellationsTab";
import { CRRetentionsTab } from "@/components/cancellations-retention/CRRetentionsTab";
import { CRReasonsTab } from "@/components/cancellations-retention/CRReasonsTab";
import { CRChartsTab } from "@/components/cancellations-retention/CRChartsTab";
import { CRAIInsightsTab } from "@/components/cancellations-retention/CRAIInsightsTab";

export default function CancellationsRetentionModulePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [projects, setProjects] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [retentionAttempts, setRetentionAttempts] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    period: "all",
    consultant: "all",
    segment: "all",
    reason: "all",
  });

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/onboarding-tasks/login"); return false; }

    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staffData || !["master", "admin", "cs", "head_comercial"].includes(staffData.role)) {
      toast.error("Acesso restrito");
      navigate("/onboarding-tasks");
      return false;
    }

    setIsAdmin(staffData.role === "admin" || staffData.role === "master");
    return true;
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all projects with company data
      const { data: projectsData } = await supabase
        .from("onboarding_projects")
        .select(`
          id, product_name, status, 
          cancellation_signal_date, cancellation_signal_reason, cancellation_signal_notes,
          notice_end_date, retention_status, retention_notes,
          churn_date, churn_reason, churn_notes, churn_risk,
          onboarding_company_id, consultant_id, cs_id,
          onboarding_company:onboarding_company_id(
            id, name, contract_value, segment, contract_start_date, contract_end_date, status, status_changed_at, created_at,
            consultant:consultant_id(id, name),
            cs:cs_id(id, name)
          )
        `)
        .order("created_at", { ascending: false });

      const formattedProjects = (projectsData || []).map((p: any) => ({
        ...p,
        company_name: p.onboarding_company?.name || p.product_name,
        consultant_name: p.onboarding_company?.consultant?.name || null,
        cs_name: p.onboarding_company?.cs?.name || null,
      }));

      // Fetch companies
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select(`
          id, name, status, segment, contract_value, contract_start_date, contract_end_date,
          status_changed_at, created_at,
          consultant:consultant_id(id, name),
          cs:cs_id(id, name)
        `);

      // Fetch staff
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true);

      // Fetch retention attempts
      const { data: attemptsData } = await supabase
        .from("retention_attempts" as any)
        .select(`
          id, project_id, company_id, staff_id, attempt_date, strategy, notes, result, created_at
        `)
        .order("attempt_date", { ascending: false });

      // Enrich attempts with names
      const enrichedAttempts = (attemptsData || []).map((a: any) => {
        const project = formattedProjects.find((p: any) => p.id === a.project_id);
        const staffMember = (staffData || []).find((s: any) => s.id === a.staff_id);
        return {
          ...a,
          company_name: project?.company_name || null,
          project_name: project?.product_name || null,
          staff_name: staffMember?.name || null,
        };
      });

      setProjects(formattedProjects);
      setCompanies(companiesData || []);
      setStaff(staffData || []);
      setRetentionAttempts(enrichedAttempts);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth().then(ok => {
      if (ok) fetchData();
    });
  }, [checkAuth, fetchData]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Modern glassmorphism header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")} className="rounded-xl hover:bg-muted/80">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">Cancelamentos & Retenção</h1>
                  <p className="text-xs text-muted-foreground">Inteligência de churn e estratégias de retenção</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={filters.segment} onValueChange={v => handleFilterChange("segment", v)}>
                <SelectTrigger className="w-[160px] rounded-xl border-0 bg-muted/60 backdrop-blur-sm">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Segmentos</SelectItem>
                  {[...new Set(companies.map(c => c.segment).filter(Boolean))].sort().map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={fetchData} variant="outline" size="sm" className="rounded-xl border-0 bg-muted/60 backdrop-blur-sm hover:bg-muted">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-card/60 backdrop-blur-sm p-1.5 rounded-2xl border shadow-sm">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="notice" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <AlertTriangle className="h-3.5 w-3.5" /> Em Aviso
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <FileText className="h-3.5 w-3.5" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <XCircle className="h-3.5 w-3.5" /> Confirmados
            </TabsTrigger>
            <TabsTrigger value="retentions" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <ShieldCheck className="h-3.5 w-3.5" /> Retenções
            </TabsTrigger>
            <TabsTrigger value="reasons" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <PieChart className="h-3.5 w-3.5" /> Motivos
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <PieChart className="h-3.5 w-3.5" /> Gráficos
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-fuchsia-500 data-[state=active]:to-pink-400 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Brain className="h-3.5 w-3.5" /> IA de Retenção
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="dashboard">
              <CRDashboardTab projects={projects} companies={companies} retentionAttempts={retentionAttempts} filters={filters} />
            </TabsContent>
            <TabsContent value="notice">
              <CRCompaniesInNoticeTab projects={projects} onRefresh={fetchData} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="requests">
              <CRCancellationRequestsTab projects={projects} staff={staff} filters={filters} onFilterChange={handleFilterChange} />
            </TabsContent>
            <TabsContent value="confirmed">
              <CRConfirmedCancellationsTab projects={projects} companies={companies} />
            </TabsContent>
            <TabsContent value="retentions">
              <CRRetentionsTab retentionAttempts={retentionAttempts} />
            </TabsContent>
            <TabsContent value="reasons">
              <CRReasonsTab projects={projects} companies={companies} />
            </TabsContent>
            <TabsContent value="charts">
              <CRChartsTab projects={projects} companies={companies} retentionAttempts={retentionAttempts} />
            </TabsContent>
            <TabsContent value="ai">
              <CRAIInsightsTab projects={projects} companies={companies} retentionAttempts={retentionAttempts} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

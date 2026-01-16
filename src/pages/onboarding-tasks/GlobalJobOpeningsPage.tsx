import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Filter,
  Building2,
  CalendarX,
  Play,
  Pause,
  XCircle,
  ExternalLink,
  Edit,
  Eye,
  TrendingUp,
  Calendar,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS, JOB_TYPES } from "@/components/hr-recruitment/types";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { JobDetailDialog } from "@/components/hr-recruitment/dialogs/JobDetailDialog";
import { JobOpeningDialog } from "@/components/hr-recruitment/dialogs/JobOpeningDialog";

interface JobOpeningWithDetails {
  id: string;
  project_id: string;
  company_id: string | null;
  title: string;
  area: string;
  job_type: string;
  description: string | null;
  requirements: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  target_date: string | null;
  sla_days: number | null;
  responsible_rh_id: string | null;
  consultant_id: string | null;
  internal_notes: string | null;
  candidates_count: number;
  company_name: string;
  project_name: string;
  responsible_rh_name: string | null;
  consultant_name: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Company {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "#22c55e",
  in_progress: "#3b82f6",
  paused: "#f59e0b",
  closed: "#6b7280",
};

const GlobalJobOpeningsPage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobOpeningWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterConsultant, setFilterConsultant] = useState("all");
  const [filterRH, setFilterRH] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDelayed, setFilterDelayed] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Dialogs
  const [selectedJob, setSelectedJob] = useState<JobOpeningWithDetails | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();

        if (staffMember) {
          const role = (staffMember.role || "").trim().toLowerCase();
          setCurrentUserRole(role);
          setCurrentStaffId(staffMember.id);
          
          // Redirect if not authorized
          if (!["admin", "cs", "consultant", "rh"].includes(role)) {
            toast.error("Você não tem permissão para acessar esta página");
            navigate("/onboarding-tasks");
          } else {
            // Fetch data after we know user role
            fetchData(role, staffMember.id);
          }
        } else {
          navigate("/onboarding-tasks/login");
        }
      } else {
        navigate("/onboarding-tasks/login");
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchData = async (role?: string, staffId?: string) => {
    setLoading(true);
    try {
      const userRole = role || currentUserRole;
      const userStaffId = staffId || currentStaffId;
      const isConsultant = userRole === "consultant";

      // Fetch staff first (needed for all)
      const staffResult = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name");

      if (staffResult.error) throw staffResult.error;

      // For consultants, first get the projects they are linked to
      let allowedProjectIds: string[] = [];
      if (isConsultant && userStaffId) {
        const { data: linkedProjects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .or(`consultant_id.eq.${userStaffId},cs_id.eq.${userStaffId}`);
        
        allowedProjectIds = (linkedProjects || []).map(p => p.id);
      }

      // Fetch jobs
      let jobsQuery = supabase
        .from("job_openings")
        .select(`
          *,
          candidates:candidates(count),
          project:onboarding_projects!job_openings_project_id_fkey(
            id, 
            product_name,
            consultant_id,
            cs_id,
            onboarding_company:onboarding_companies!onboarding_projects_onboarding_company_id_fkey(id, name)
          ),
          company:onboarding_companies!job_openings_company_id_fkey(id, name),
          responsible_rh:onboarding_staff!job_openings_responsible_rh_id_fkey(id, name),
          consultant:onboarding_staff!job_openings_consultant_id_fkey(id, name)
        `)
        .order("created_at", { ascending: false });

      // If consultant, filter by allowed projects
      if (isConsultant && allowedProjectIds.length > 0) {
        jobsQuery = jobsQuery.in("project_id", allowedProjectIds);
      } else if (isConsultant && allowedProjectIds.length === 0) {
        // Consultant with no linked projects - show empty
        setJobs([]);
        setCompanies([]);
        setStaff(staffResult.data || []);
        setLoading(false);
        return;
      }

      const jobsResult = await jobsQuery;
      if (jobsResult.error) throw jobsResult.error;

      // Get unique company IDs from jobs for filtering (for consultants, show only their companies)
      const jobCompanyIds = new Set<string>();
      (jobsResult.data || []).forEach((job: any) => {
        const compId = job.company_id || job.project?.onboarding_company?.id;
        if (compId) jobCompanyIds.add(compId);
      });

      // Fetch companies based on role
      let companiesQuery = supabase
        .from("onboarding_companies")
        .select("id, name")
        .neq("status", "inactive")
        .order("name");

      // For consultants, only show companies from their jobs
      if (isConsultant && jobCompanyIds.size > 0) {
        companiesQuery = companiesQuery.in("id", Array.from(jobCompanyIds));
      }

      const companiesResult = await companiesQuery;
      if (companiesResult.error) throw companiesResult.error;

      const jobsWithDetails = (jobsResult.data || []).map((job: any) => {
        // Prioritize job.company, fallback to project's onboarding_company
        const companyName = job.company?.name || job.project?.onboarding_company?.name || "Sem empresa";
        const companyId = job.company_id || job.project?.onboarding_company?.id || null;
        
        return {
          ...job,
          candidates_count: job.candidates?.[0]?.count || 0,
          company_name: companyName,
          company_id: companyId, // Ensure we have the correct company_id for filtering
          project_name: job.project?.product_name || "Sem projeto",
          responsible_rh_name: job.responsible_rh?.name || null,
          consultant_name: job.consultant?.name || null,
        };
      });

      setJobs(jobsWithDetails);
      setCompanies(companiesResult.data || []);
      setStaff(staffResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Calculate if job is delayed
  const isJobDelayed = (job: JobOpeningWithDetails): boolean => {
    if (job.status === "closed" || job.status === "paused") return false;
    
    const today = startOfDay(new Date());
    
    // Check target_date
    if (job.target_date) {
      const targetDate = new Date(job.target_date);
      if (isBefore(targetDate, today)) return true;
    }
    
    // Check SLA days
    if (job.sla_days) {
      const createdAt = new Date(job.created_at);
      const daysSinceCreation = differenceInDays(today, createdAt);
      if (daysSinceCreation > job.sla_days) return true;
    }
    
    return false;
  };

  // Calculate days open
  const getDaysOpen = (job: JobOpeningWithDetails): number => {
    const startDate = new Date(job.created_at);
    const endDate = job.closed_at ? new Date(job.closed_at) : new Date();
    return differenceInDays(endDate, startDate);
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchTerm === "" ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.project_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCompany = filterCompany === "all" || job.company_id === filterCompany;
      const matchesConsultant = filterConsultant === "all" || job.consultant_id === filterConsultant;
      const matchesRH = filterRH === "all" || job.responsible_rh_id === filterRH;
      const matchesStatus = filterStatus === "all" || job.status === filterStatus;
      const matchesType = filterType === "all" || job.job_type === filterType;
      const matchesDelayed =
        filterDelayed === "all" ||
        (filterDelayed === "delayed" && isJobDelayed(job)) ||
        (filterDelayed === "on_time" && !isJobDelayed(job));

      return (
        matchesSearch &&
        matchesCompany &&
        matchesConsultant &&
        matchesRH &&
        matchesStatus &&
        matchesType &&
        matchesDelayed
      );
    });
  }, [jobs, searchTerm, filterCompany, filterConsultant, filterRH, filterStatus, filterType, filterDelayed]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const openJobs = filteredJobs.filter((j) => j.status === "open").length;
    const inProgressJobs = filteredJobs.filter((j) => j.status === "in_progress").length;
    const pausedJobs = filteredJobs.filter((j) => j.status === "paused").length;
    const closedJobs = filteredJobs.filter((j) => j.status === "closed").length;
    const delayedJobs = filteredJobs.filter((j) => isJobDelayed(j)).length;
    const totalCandidates = filteredJobs.reduce((sum, j) => sum + j.candidates_count, 0);
    
    const activeJobs = filteredJobs.filter((j) => j.status !== "closed");
    const avgDaysOpen = activeJobs.length > 0
      ? Math.round(activeJobs.reduce((sum, j) => sum + getDaysOpen(j), 0) / activeJobs.length)
      : 0;

    return {
      openJobs,
      inProgressJobs,
      pausedJobs,
      closedJobs,
      delayedJobs,
      totalCandidates,
      avgDaysOpen,
    };
  }, [filteredJobs]);

  // Chart data
  const statusChartData = useMemo(() => [
    { name: "Abertas", value: metrics.openJobs, color: STATUS_COLORS.open },
    { name: "Em andamento", value: metrics.inProgressJobs, color: STATUS_COLORS.in_progress },
    { name: "Pausadas", value: metrics.pausedJobs, color: STATUS_COLORS.paused },
    { name: "Encerradas", value: metrics.closedJobs, color: STATUS_COLORS.closed },
  ], [metrics]);

  // Delayed by consultant chart
  const delayedByConsultantData = useMemo(() => {
    const delayedMap = new Map<string, number>();
    
    filteredJobs.filter(isJobDelayed).forEach((job) => {
      const name = job.consultant_name || "Sem consultor";
      delayedMap.set(name, (delayedMap.get(name) || 0) + 1);
    });
    
    return Array.from(delayedMap.entries())
      .map(([name, count]) => ({ name, atrasadas: count }))
      .sort((a, b) => b.atrasadas - a.atrasadas)
      .slice(0, 5);
  }, [filteredJobs]);

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("job_openings")
        .update({
          status: newStatus,
          closed_at: newStatus === "closed" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
      
      toast.success("Status atualizado");
      fetchData(currentUserRole || undefined, currentStaffId || undefined);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    if (!confirm(`Tem certeza que deseja excluir a vaga "${jobTitle}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from("job_openings")
        .delete()
        .eq("id", jobId);

      if (error) throw error;
      
      toast.success("Vaga excluída com sucesso");
      fetchData(currentUserRole || undefined, currentStaffId || undefined);
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Erro ao excluir vaga");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-green-500/10 text-green-600 border-green-500/20",
      in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      paused: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      closed: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", colors[status] || colors.closed)}>
        {JOB_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const consultants = staff.filter((s) => s.role === "consultant");
  const rhStaff = staff.filter((s) => s.role === "rh");

  const canEdit = currentUserRole === "admin" || currentUserRole === "rh" || currentUserRole === "cs" || currentUserRole === "consultant";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/98 backdrop-blur-md border-b">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Painel Global de Vagas</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus("open")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Play className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.openJobs}</p>
                  <p className="text-xs text-muted-foreground">Abertas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus("in_progress")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.inProgressJobs}</p>
                  <p className="text-xs text-muted-foreground">Em andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus("paused")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Pause className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.pausedJobs}</p>
                  <p className="text-xs text-muted-foreground">Pausadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterStatus("closed")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-500/10 rounded-lg">
                  <XCircle className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.closedJobs}</p>
                  <p className="text-xs text-muted-foreground">Encerradas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setFilterDelayed("delayed")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{metrics.delayedJobs}</p>
                  <p className="text-xs text-muted-foreground">Em atraso</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.totalCandidates}</p>
                  <p className="text-xs text-muted-foreground">Candidatos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.avgDaysOpen}</p>
                  <p className="text-xs text-muted-foreground">Dias médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vagas por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vagas em Atraso por Consultor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {delayedByConsultantData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={delayedByConsultantData} layout="vertical">
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="atrasadas" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Nenhuma vaga em atraso
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vagas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[180px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos consultores</SelectItem>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterRH} onValueChange={setFilterRH}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="RH responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos RH</SelectItem>
                  {rhStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="closed">Encerrada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {JOB_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDelayed} onValueChange={setFilterDelayed}>
                <SelectTrigger className="w-[150px]">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Atraso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="delayed">Apenas atrasadas</SelectItem>
                  <SelectItem value="on_time">No prazo</SelectItem>
                </SelectContent>
              </Select>

              {(filterCompany !== "all" || filterConsultant !== "all" || filterRH !== "all" || filterStatus !== "all" || filterType !== "all" || filterDelayed !== "all" || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCompany("all");
                    setFilterConsultant("all");
                    setFilterRH("all");
                    setFilterStatus("all");
                    setFilterType("all");
                    setFilterDelayed("all");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {filteredJobs.length} {filteredJobs.length === 1 ? "vaga" : "vagas"} encontradas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Vaga</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Prazo/SLA</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-center">Atraso</TableHead>
                    <TableHead>RH</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-center">Candidatos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        Nenhuma vaga encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => {
                      const delayed = isJobDelayed(job);
                      const daysOpen = getDaysOpen(job);
                      
                      return (
                        <TableRow key={job.id} className={cn(delayed && "bg-red-500/5")}>
                          <TableCell className="font-medium">{job.company_name}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{job.title}</p>
                              <p className="text-xs text-muted-foreground">{job.project_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{job.job_type}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(job.created_at), "dd/MM/yy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.target_date ? (
                              <span className={cn(delayed && "text-red-600 font-medium")}>
                                {format(new Date(job.target_date), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            ) : job.sla_days ? (
                              <span className={cn(delayed && "text-red-600 font-medium")}>
                                {job.sla_days} dias
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="text-xs">
                              {daysOpen}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {delayed ? (
                              <Badge variant="destructive" className="text-xs">Sim</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Não</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.responsible_rh_name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {job.consultant_name || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {job.candidates_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Ações
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedJob(job);
                                  setShowDetailDialog(true);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => {
                                    setEditingJobId(job.id);
                                    setShowEditDialog(true);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {canEdit && job.status !== "paused" && job.status !== "closed" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(job.id, "paused")}>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pausar
                                  </DropdownMenuItem>
                                )}
                                {canEdit && job.status === "paused" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(job.id, "in_progress")}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Retomar
                                  </DropdownMenuItem>
                                )}
                                {canEdit && job.status !== "closed" && (
                                  <DropdownMenuItem 
                                    onClick={() => handleStatusChange(job.id, "closed")}
                                    className="text-red-600"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Encerrar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => navigate(`/onboarding-tasks/${job.project_id}`)}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Ir para projeto
                                </DropdownMenuItem>
                                {canEdit && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteJob(job.id, job.title)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir vaga
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Detail Dialog */}
      {selectedJob && (
        <JobDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          job={selectedJob}
          staff={staff}
          canEdit={canEdit}
          onUpdate={() => fetchData(currentUserRole || undefined, currentStaffId || undefined)}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && editingJobId && (
        <JobOpeningDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          projectId={filteredJobs.find(j => j.id === editingJobId)?.project_id || ""}
          companyId={filteredJobs.find(j => j.id === editingJobId)?.company_id || undefined}
          job={jobs.find(j => j.id === editingJobId) as any}
          onSuccess={() => {
            setShowEditDialog(false);
            setEditingJobId(null);
            fetchData(currentUserRole || undefined, currentStaffId || undefined);
          }}
        />
      )}
    </div>
  );
};

export default GlobalJobOpeningsPage;

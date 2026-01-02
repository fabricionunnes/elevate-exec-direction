import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, FolderOpen, Search, ArrowLeft, Users, Calendar, CheckCircle2, Filter, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateProjectDialog } from "@/components/onboarding-tasks/CreateProjectDialog";

interface OnboardingProject {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  created_at: string;
  onboarding_company_id: string | null;
  onboarding_company?: { name: string } | null;
  tasks_count?: number;
  completed_count?: number;
}

interface ServiceStats {
  product_id: string;
  product_name: string;
  count: number;
}

const OnboardingTasksPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<OnboardingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select(`
          *,
          onboarding_company:onboarding_companies(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch task counts for each project
      const projectsWithCounts = await Promise.all(
        (data || []).map(async (project) => {
          const { count: tasksCount } = await supabase
            .from("onboarding_tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);

          const { count: completedCount } = await supabase
            .from("onboarding_tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "completed");

          return {
            ...project,
            tasks_count: tasksCount || 0,
            completed_count: completedCount || 0,
          };
        })
      );

      setProjects(projectsWithCounts);

      // Calculate service stats
      const statsMap = new Map<string, ServiceStats>();
      (data || []).forEach((project) => {
        const existing = statsMap.get(project.product_id);
        if (existing) {
          existing.count++;
        } else {
          statsMap.set(project.product_id, {
            product_id: project.product_id,
            product_name: project.product_name,
            count: 1,
          });
        }
      });
      setServiceStats(Array.from(statsMap.values()).sort((a, b) => b.count - a.count));
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast.error("Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const companyName = project.onboarding_company?.name || "";
    const matchesSearch =
      project.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedService === "all" || project.product_id === selectedService;
    return matchesSearch && matchesService;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">Concluído</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestão de Onboarding</h1>
              <p className="text-muted-foreground">
                Gerencie tarefas e acompanhamento de clientes
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </div>

        {/* Service Stats */}
        {serviceStats.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6 mb-6">
            {serviceStats.slice(0, 6).map((stat) => (
              <Card 
                key={stat.product_id} 
                className={`cursor-pointer transition-all hover:shadow-md ${selectedService === stat.product_id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedService(selectedService === stat.product_id ? "all" : stat.product_id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{stat.product_name}</p>
                      <p className="text-2xl font-bold">{stat.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[220px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {serviceStats.map((stat) => (
                <SelectItem key={stat.product_id} value={stat.product_id}>
                  {stat.product_name} ({stat.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum projeto encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro projeto de onboarding para começar
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Projeto
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.product_name}</CardTitle>
                    {getStatusBadge(project.status)}
                  </div>
                  {project.onboarding_company?.name && (
                    <p className="text-sm text-muted-foreground">{project.onboarding_company.name}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Progresso</span>
                      </div>
                      <span className="font-medium">
                        {project.completed_count}/{project.tasks_count} tarefas
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            project.tasks_count
                              ? (project.completed_count! / project.tasks_count) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Criado em {format(new Date(project.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProjectCreated={fetchProjects}
      />
    </div>
  );
};

export default OnboardingTasksPage;

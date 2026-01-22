import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Download, 
  ArrowLeft,
  Building2,
  Calendar,
  Loader2,
  Star,
  Sparkles,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface TalentPoolResume {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_primary: boolean;
  created_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    talent_pool_notes: string | null;
    talent_pool_added_at: string | null;
    ai_summary: string | null;
    ai_match_score: number | null;
    disc_profile: string | null;
    project: {
      id: string;
      product_name: string;
      company: {
        id: string;
        name: string;
      } | null;
    } | null;
    last_job?: {
      title: string;
    } | null;
  };
}

interface Company {
  id: string;
  name: string;
}

export default function GlobalTalentPoolResumesPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<TalentPoolResume[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterDisc, setFilterDisc] = useState<string>("all");

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!staff || !["admin", "cs", "consultant", "rh"].includes(staff.role?.toLowerCase())) {
        toast.error("Acesso não autorizado");
        navigate("/onboarding-tasks");
        return;
      }

      fetchData();
    } catch (error) {
      console.error("Error checking permissions:", error);
      navigate("/onboarding-tasks/login");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch resumes from talent pool candidates across all projects
      const { data: resumesData, error: resumesError } = await supabase
        .from("candidate_resumes")
        .select(`
          id,
          file_name,
          file_url,
          file_type,
          file_size,
          is_primary,
          created_at,
          candidate:candidates!inner(
            id,
            full_name,
            email,
            phone,
            talent_pool_notes,
            talent_pool_added_at,
            ai_summary,
            ai_match_score,
            job_opening:job_openings(title),
            project:onboarding_projects(
              id,
              product_name,
              company:onboarding_companies(id, name)
            )
          )
        `)
        .eq("candidate.current_stage", "talent_pool")
        .order("created_at", { ascending: false });

      if (resumesError) {
        console.error("Error fetching resumes:", resumesError);
        throw resumesError;
      }

      // Fetch DISC results for each candidate
      const candidateIds = [...new Set((resumesData || []).map((r: any) => r.candidate?.id).filter(Boolean))];
      
      let discByCandidate: Record<string, string | null> = {};
      if (candidateIds.length > 0) {
        const { data: discData } = await supabase
          .from("candidate_disc_results")
          .select("candidate_id, dominant_profile")
          .in("candidate_id", candidateIds)
          .eq("status", "completed");

        discByCandidate = (discData || []).reduce((acc: any, d: any) => {
          acc[d.candidate_id] = d.dominant_profile;
          return acc;
        }, {});
      }

      // Map resumes with DISC profile
      const mappedResumes = (resumesData || []).map((r: any) => ({
        ...r,
        candidate: {
          ...r.candidate,
          disc_profile: discByCandidate[r.candidate?.id] || null,
          last_job: r.candidate?.job_opening || null,
          project: r.candidate?.project || null,
        }
      }));

      setResumes(mappedResumes);

      // Get unique companies for filter
      const uniqueCompanies: Company[] = [];
      const seenIds = new Set<string>();
      mappedResumes.forEach((r: TalentPoolResume) => {
        const company = r.candidate?.project?.company;
        if (company && !seenIds.has(company.id)) {
          seenIds.add(company.id);
          uniqueCompanies.push(company);
        }
      });
      setCompanies(uniqueCompanies.sort((a, b) => a.name.localeCompare(b.name)));

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar currículos");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const filteredResumes = resumes.filter((r) => {
    const matchesSearch = 
      r.candidate.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.file_name.toLowerCase().includes(search.toLowerCase()) ||
      r.candidate.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesCompany = filterCompany === "all" || 
      r.candidate.project?.company?.id === filterCompany;
    
    const matchesDisc = filterDisc === "all" || 
      r.candidate.disc_profile === filterDisc;

    return matchesSearch && matchesCompany && matchesDisc;
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const getDISCColor = (profile: string | null) => {
    switch (profile) {
      case 'D': return 'bg-red-500';
      case 'I': return 'bg-yellow-500';
      case 'S': return 'bg-green-500';
      case 'C': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  // Stats
  const totalCandidates = new Set(resumes.map(r => r.candidate.id)).size;
  const candidatesWithDisc = new Set(
    resumes.filter(r => r.candidate.disc_profile).map(r => r.candidate.id)
  ).size;
  const candidatesWithAI = new Set(
    resumes.filter(r => r.candidate.ai_summary).map(r => r.candidate.id)
  ).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/onboarding-tasks")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Star className="h-6 w-6 text-amber-500" />
                Currículos do Banco de Talentos
              </h1>
              <p className="text-sm text-muted-foreground hidden md:block">
                Todos os currículos de candidatos no banco de talentos de todas as empresas
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{resumes.length}</p>
              <p className="text-sm text-muted-foreground">Currículos</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalCandidates}</p>
              <p className="text-sm text-muted-foreground">Talentos</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{candidatesWithDisc}</p>
              <p className="text-sm text-muted-foreground">Com DISC</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{candidatesWithAI}</p>
              <p className="text-sm text-muted-foreground">Com Resumo IA</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-56">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDisc} onValueChange={setFilterDisc}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="DISC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos DISC</SelectItem>
              <SelectItem value="D">Dominância (D)</SelectItem>
              <SelectItem value="I">Influência (I)</SelectItem>
              <SelectItem value="S">Estabilidade (S)</SelectItem>
              <SelectItem value="C">Conformidade (C)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resumes List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredResumes.length === 0 ? (
          <Card className="p-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum currículo encontrado</h3>
            <p className="text-muted-foreground">
              Candidatos movidos para o banco de talentos aparecerão aqui
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredResumes.map((resume) => (
              <Card key={resume.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(resume.candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium">{resume.candidate.full_name}</h4>
                        {resume.candidate.disc_profile && (
                          <Badge className={`${getDISCColor(resume.candidate.disc_profile)} text-white`}>
                            {resume.candidate.disc_profile}
                          </Badge>
                        )}
                        {resume.candidate.ai_match_score && (
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            {resume.candidate.ai_match_score}%
                          </Badge>
                        )}
                        {resume.is_primary && (
                          <Badge variant="secondary">Principal</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{resume.candidate.email}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        {resume.candidate.project?.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {resume.candidate.project.company.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {resume.file_name}
                          {resume.file_size && ` (${formatFileSize(resume.file_size)})`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(resume.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>

                      {resume.candidate.last_job && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última vaga: {resume.candidate.last_job.title}
                        </p>
                      )}

                      {/* AI Summary */}
                      {resume.candidate.ai_summary && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Sparkles className="h-3 w-3" />
                            Resumo IA
                          </div>
                          <p className="line-clamp-2">{resume.candidate.ai_summary}</p>
                        </div>
                      )}

                      {/* Talent Pool Notes */}
                      {resume.candidate.talent_pool_notes && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-sm">
                          <FileText className="h-3 w-3 inline mr-1 text-yellow-600" />
                          <span className="line-clamp-2">{resume.candidate.talent_pool_notes}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(resume.file_url, resume.file_name)}
                      title="Baixar currículo"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

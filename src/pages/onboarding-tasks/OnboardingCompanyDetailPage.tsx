import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Building2,
  Users,
  FileText,
  Target,
  Briefcase,
  Plus,
  Trash2,
  FolderOpen,
  ExternalLink,
  UserCircle,
} from "lucide-react";
import { format } from "date-fns";
import { CreateProjectDialog } from "@/components/onboarding-tasks/CreateProjectDialog";
import { COMPANY_SEGMENTS } from "@/data/companySegments";
import { ContactsContractsPanel } from "@/components/onboarding-tasks/ContactsContractsPanel";

interface Staff {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface Stakeholder {
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface CompanyForm {
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  cs_id: string;
  consultant_id: string;
  kickoff_date: string;
  contract_start_date: string;
  contract_end_date: string;
  contract_value: string;
  billing_day: string;
  company_description: string;
  main_challenges: string;
  goals_short_term: string;
  goals_long_term: string;
  target_audience: string;
  competitors: string;
  stakeholders: Stakeholder[];
  status: string;
  notes: string;
}

interface Project {
  id: string;
  product_name: string;
  status: string;
  created_at: string;
}

const OnboardingCompanyDetailPage = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const isNew = companyId === "new";
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  const [form, setForm] = useState<CompanyForm>({
    name: "",
    cnpj: "",
    segment: "",
    website: "",
    phone: "",
    email: "",
    address: "",
    cs_id: "",
    consultant_id: "",
    kickoff_date: "",
    contract_start_date: "",
    contract_end_date: "",
    contract_value: "",
    billing_day: "",
    company_description: "",
    main_challenges: "",
    goals_short_term: "",
    goals_long_term: "",
    target_audience: "",
    competitors: "",
    stakeholders: [],
    status: "active",
    notes: "",
  });

  useEffect(() => {
    checkUserPermissions();
    fetchStaff();
    if (!isNew) {
      fetchCompany();
      fetchProjects();
    }
  }, [companyId]);

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

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setStaffList(data || []);
  };

  const fetchCompany = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      
      const stakeholdersData = Array.isArray(data.stakeholders) 
        ? (data.stakeholders as unknown as Stakeholder[]) 
        : [];
      
      setForm({
        name: data.name || "",
        cnpj: data.cnpj || "",
        segment: data.segment || "",
        website: data.website || "",
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        cs_id: data.cs_id || "",
        consultant_id: data.consultant_id || "",
        kickoff_date: data.kickoff_date || "",
        contract_start_date: data.contract_start_date || "",
        contract_end_date: data.contract_end_date || "",
        contract_value: data.contract_value?.toString() || "",
        billing_day: data.billing_day?.toString() || "",
        company_description: data.company_description || "",
        main_challenges: data.main_challenges || "",
        goals_short_term: data.goals_short_term || "",
        goals_long_term: data.goals_long_term || "",
        target_audience: data.target_audience || "",
        competitors: data.competitors || "",
        stakeholders: stakeholdersData,
        status: data.status || "active",
        notes: data.notes || "",
      });
    } catch (error: any) {
      console.error("Error fetching company:", error);
      toast.error("Erro ao carregar empresa");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("onboarding_projects")
      .select("*")
      .eq("onboarding_company_id", companyId)
      .order("created_at", { ascending: false });
    setProjects(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        cnpj: form.cnpj || null,
        segment: form.segment || null,
        website: form.website || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        cs_id: form.cs_id || null,
        consultant_id: form.consultant_id || null,
        kickoff_date: form.kickoff_date || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        billing_day: form.billing_day ? parseInt(form.billing_day) : null,
        company_description: form.company_description || null,
        main_challenges: form.main_challenges || null,
        goals_short_term: form.goals_short_term || null,
        goals_long_term: form.goals_long_term || null,
        target_audience: form.target_audience || null,
        competitors: form.competitors || null,
        stakeholders: JSON.parse(JSON.stringify(form.stakeholders)),
        status: form.status,
        notes: form.notes || null,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("onboarding_companies")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        toast.success("Empresa cadastrada com sucesso");
        navigate(`/onboarding-tasks/companies/${data.id}`);
      } else {
        const { error } = await supabase
          .from("onboarding_companies")
          .update(payload)
          .eq("id", companyId);

        if (error) throw error;
        toast.success("Empresa atualizada com sucesso");
      }
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const addStakeholder = () => {
    setForm({
      ...form,
      stakeholders: [...form.stakeholders, { name: "", role: "", email: "", phone: "" }],
    });
  };

  const updateStakeholder = (index: number, field: keyof Stakeholder, value: string) => {
    const updated = [...form.stakeholders];
    updated[index][field] = value;
    setForm({ ...form, stakeholders: updated });
  };

  const removeStakeholder = (index: number) => {
    setForm({
      ...form,
      stakeholders: form.stakeholders.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const csOptions = staffList.filter((s) => s.role === "cs");
  const consultantOptions = staffList.filter((s) => s.role === "consultant");

  // Permission logic:
  // - Admin: can edit everything including CS assignment
  // - CS: can edit consultant assignment and other fields, but not CS assignment
  // - Consultant: read-only on company data
  const canEditCompany = currentUserRole === "admin" || currentUserRole === "cs";
  const canEditCS = currentUserRole === "admin";
  const canEditConsultant = currentUserRole === "admin" || currentUserRole === "cs";
  const canDeleteCompany = currentUserRole === "admin";

  const handleDeleteCompany = async () => {
    if (!companyId || isNew) return;
    
    setDeleting(true);
    try {
      // First delete all related projects
      const { error: projectsError } = await supabase
        .from("onboarding_projects")
        .delete()
        .eq("onboarding_company_id", companyId);
      
      if (projectsError) throw projectsError;

      // Then delete the company
      const { error } = await supabase
        .from("onboarding_companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;
      
      toast.success("Empresa excluída com sucesso");
      navigate("/onboarding-tasks/companies");
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast.error(error.message || "Erro ao excluir empresa");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks/companies")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? "Nova Empresa" : form.name || "Empresa"}
              </h1>
              <p className="text-muted-foreground">
                {isNew ? "Cadastre uma nova empresa" : "Edite as informações da empresa"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteCompany && !isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? "Excluindo..." : "Excluir"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir a empresa "{form.name}"? 
                      Esta ação irá excluir também todos os projetos associados e não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="info" className="gap-2">
                <Building2 className="h-4 w-4" />
                Informações
              </TabsTrigger>
              {!isNew && (
                <TabsTrigger value="projects" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Projetos ({projects.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Equipe
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2">
                <UserCircle className="h-4 w-4" />
                Contatos
              </TabsTrigger>
              <TabsTrigger value="contract" className="gap-2">
                <FileText className="h-4 w-4" />
                Contrato
              </TabsTrigger>
              <TabsTrigger value="briefing" className="gap-2">
                <Target className="h-4 w-4" />
                Briefing & Metas
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>Informações básicas da empresa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Empresa *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={form.cnpj}
                        onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Segmento</Label>
                      <Select value={form.segment} onValueChange={(value) => setForm({ ...form, segment: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o segmento" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANY_SEGMENTS.map((seg) => (
                            <SelectItem key={seg} value={seg}>
                              {seg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={form.website}
                        onChange={(e) => setForm({ ...form, website: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={form.status} 
                      onValueChange={(v) => setForm({ ...form, status: v })}
                      disabled={currentUserRole !== "admin" && currentUserRole !== "cs"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="cancellation_signaled">Sinalizou Cancelamento</SelectItem>
                        <SelectItem value="notice_period">Cumprindo Aviso</SelectItem>
                        <SelectItem value="closed">Encerrado</SelectItem>
                      </SelectContent>
                    </Select>
                    {currentUserRole !== "admin" && currentUserRole !== "cs" && (
                      <p className="text-xs text-muted-foreground">
                        Apenas CS ou Admin podem alterar o status
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Projects Tab */}
            {!isNew && (
              <TabsContent value="projects">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Projetos de Onboarding</CardTitle>
                        <CardDescription>Gerencie os projetos desta empresa</CardDescription>
                      </div>
                      <Button type="button" onClick={() => setShowCreateProject(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Projeto
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {projects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum projeto cadastrado</p>
                        <Button type="button" variant="outline" className="mt-4" onClick={() => setShowCreateProject(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Primeiro Projeto
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {projects.map((project) => (
                          <Card
                          key={project.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => navigate(`/onboarding-tasks/${project.id}`)}
                          >
                            <CardContent className="py-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FolderOpen className="h-5 w-5 text-primary" />
                                  <div>
                                    <p className="font-medium">{project.product_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Criado em {format(new Date(project.created_at), "dd/MM/yyyy")}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={project.status === "active" ? "default" : "secondary"}>
                                    {project.status === "active" ? "Ativo" : project.status}
                                  </Badge>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Team Tab */}
            <TabsContent value="team">
              <Card>
                <CardHeader>
                  <CardTitle>Equipe Responsável</CardTitle>
                  <CardDescription>Vincule CS e Consultor à empresa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cs">CS Responsável</Label>
                      <Select 
                        value={form.cs_id || "none"} 
                        onValueChange={(v) => setForm({ ...form, cs_id: v === "none" ? "" : v })}
                        disabled={!canEditCS}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um CS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {csOptions.map((cs) => (
                            <SelectItem key={cs.id} value={cs.id}>
                              {cs.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!canEditCS && (
                        <p className="text-xs text-muted-foreground">Apenas administradores podem alterar o CS</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consultant">Consultor Responsável</Label>
                      <Select
                        value={form.consultant_id || "none"}
                        onValueChange={(v) => setForm({ ...form, consultant_id: v === "none" ? "" : v })}
                        disabled={!canEditConsultant}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um consultor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {consultantOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!canEditConsultant && (
                        <p className="text-xs text-muted-foreground">Apenas CS ou administradores podem alterar o consultor</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kickoff_date">Data do Kickoff</Label>
                    <Input
                      id="kickoff_date"
                      type="date"
                      value={form.kickoff_date}
                      onChange={(e) => setForm({ ...form, kickoff_date: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contacts Tab */}
            {!isNew && companyId && (
              <TabsContent value="contacts">
                <ContactsContractsPanel 
                  companyId={companyId} 
                  isAdmin={canEditCompany}
                />
              </TabsContent>
            )}

            {/* Contract Tab */}
            <TabsContent value="contract">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Contrato</CardTitle>
                  <CardDescription>Informações contratuais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contract_start_date">Início do Contrato</Label>
                      <Input
                        id="contract_start_date"
                        type="date"
                        value={form.contract_start_date}
                        onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contract_end_date">Fim do Contrato</Label>
                      <Input
                        id="contract_end_date"
                        type="date"
                        value={form.contract_end_date}
                        onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contract_value">Valor do Contrato (R$)</Label>
                      <Input
                        id="contract_value"
                        type="number"
                        step="0.01"
                        value={form.contract_value}
                        onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_day">Dia de Faturamento</Label>
                      <Input
                        id="billing_day"
                        type="number"
                        min="1"
                        max="31"
                        value={form.billing_day}
                        onChange={(e) => setForm({ ...form, billing_day: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Briefing Tab */}
            <TabsContent value="briefing">
              <Card>
                <CardHeader>
                  <CardTitle>Briefing & Metas</CardTitle>
                  <CardDescription>Informações estratégicas da empresa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_description">Descrição da Empresa</Label>
                    <Textarea
                      id="company_description"
                      value={form.company_description}
                      onChange={(e) => setForm({ ...form, company_description: e.target.value })}
                      rows={3}
                      placeholder="O que a empresa faz, produtos/serviços principais..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="main_challenges">Principais Desafios</Label>
                    <Textarea
                      id="main_challenges"
                      value={form.main_challenges}
                      onChange={(e) => setForm({ ...form, main_challenges: e.target.value })}
                      rows={3}
                      placeholder="Quais são os maiores desafios que a empresa enfrenta?"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goals_short_term">Metas de Curto Prazo (3-6 meses)</Label>
                      <Textarea
                        id="goals_short_term"
                        value={form.goals_short_term}
                        onChange={(e) => setForm({ ...form, goals_short_term: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goals_long_term">Metas de Longo Prazo (12+ meses)</Label>
                      <Textarea
                        id="goals_long_term"
                        value={form.goals_long_term}
                        onChange={(e) => setForm({ ...form, goals_long_term: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="target_audience">Público-Alvo</Label>
                      <Textarea
                        id="target_audience"
                        value={form.target_audience}
                        onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="competitors">Concorrentes</Label>
                      <Textarea
                        id="competitors"
                        value={form.competitors}
                        onChange={(e) => setForm({ ...form, competitors: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </form>

        {/* Create Project Dialog */}
        {!isNew && companyId && (
          <CreateProjectDialog
            open={showCreateProject}
            onOpenChange={setShowCreateProject}
            preselectedCompanyId={companyId}
            onSuccess={() => {
              setShowCreateProject(false);
              fetchProjects();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default OnboardingCompanyDetailPage;

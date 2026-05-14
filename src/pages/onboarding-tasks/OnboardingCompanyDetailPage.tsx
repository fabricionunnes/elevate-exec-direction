import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Trophy,
  DollarSign,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { CreateProjectDialog } from "@/components/onboarding-tasks/CreateProjectDialog";
import { SegmentSelect } from "@/components/ui/segment-select";
import { ContactsContractsPanel } from "@/components/onboarding-tasks/ContactsContractsPanel";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { CompanyFinancialPanel } from "@/components/company-financial/CompanyFinancialPanel";
import { AddressFields } from "@/components/ui/address-fields";
import { useFinancialPermissions } from "@/hooks/useFinancialPermissions";
import { FINANCIAL_PERMISSION_KEYS } from "@/types/staffPermissions";
import { CompanyDataView } from "@/components/company/CompanyDataView";
import { Database } from "lucide-react";


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
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_zipcode: string;
  address_city: string;
  address_state: string;
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
  is_simulator: boolean;
  goal_not_required: boolean;
  owner_name: string;
  owner_phone: string;
  owner_cpf: string;
  owner_rg: string;
  owner_marital_status: string;
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
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "info";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const originalStatusRef = useRef<string>("active");
  const formRef = useRef<CompanyForm>(null!);
  const { hasFinancialPermission, isMaster } = useFinancialPermissions();
  
  const [form, setForm] = useState<CompanyForm>({
    name: "",
    cnpj: "",
    segment: "",
    website: "",
    phone: "",
    email: "",
    address: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_zipcode: "",
    address_city: "",
    address_state: "",
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
    is_simulator: false,
    goal_not_required: false,
    owner_name: "",
    owner_phone: "",
    owner_cpf: "",
    owner_rg: "",
    owner_marital_status: "",
  });

  // Keep ref in sync with latest form state
  formRef.current = form;

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
          .select("id, role")
          .eq("user_id", user.id)
          .single();
        
        if (staffMember) {
          setCurrentUserRole(staffMember.role);
          
          // For consultants, verify they have access to this company
          if (staffMember.role === "consultant" && !isNew && companyId) {
            const { data: companyData } = await supabase
              .from("onboarding_companies")
              .select("consultant_id, cs_id")
              .eq("id", companyId)
              .single();
            
            if (companyData && companyData.consultant_id !== staffMember.id && companyData.cs_id !== staffMember.id) {
              toast.error("Você não tem acesso a esta empresa");
              navigate("/onboarding-tasks");
              return;
            }
          }
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
        address_number: (data as any).address_number || "",
        address_complement: (data as any).address_complement || "",
        address_neighborhood: (data as any).address_neighborhood || "",
        address_zipcode: (data as any).address_zipcode || "",
        address_city: (data as any).address_city || "",
        address_state: (data as any).address_state || "",
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
        is_simulator: data.is_simulator || false,
        goal_not_required: data.goal_not_required || false,
        owner_name: (data as any).owner_name || "",
        owner_phone: (data as any).owner_phone || data.phone || "",
        owner_cpf: (data as any).owner_cpf || "",
        owner_rg: (data as any).owner_rg || "",
        owner_marital_status: (data as any).owner_marital_status || "",
      });
      originalStatusRef.current = data.status || "active";
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
      // Use formRef to get the latest state (avoids stale closures from auto-save race conditions)
      const currentForm = formRef.current;
      const payload = {
        name: currentForm.name,
        cnpj: currentForm.cnpj || null,
        segment: currentForm.segment || null,
        website: currentForm.website || null,
        phone: currentForm.phone || null,
        email: currentForm.email || null,
        address: currentForm.address || null,
        address_number: currentForm.address_number || null,
        address_complement: currentForm.address_complement || null,
        address_neighborhood: currentForm.address_neighborhood || null,
        address_zipcode: currentForm.address_zipcode || null,
        address_city: currentForm.address_city || null,
        address_state: currentForm.address_state || null,
        cs_id: currentForm.cs_id || null,
        consultant_id: currentForm.consultant_id || null,
        kickoff_date: currentForm.kickoff_date || null,
        contract_start_date: currentForm.contract_start_date || null,
        contract_end_date: currentForm.contract_end_date || null,
        contract_value: currentForm.contract_value ? parseFloat(currentForm.contract_value) : null,
        billing_day: currentForm.billing_day ? parseInt(currentForm.billing_day) : null,
        company_description: currentForm.company_description || null,
        main_challenges: currentForm.main_challenges || null,
        goals_short_term: currentForm.goals_short_term || null,
        goals_long_term: currentForm.goals_long_term || null,
        target_audience: currentForm.target_audience || null,
        competitors: currentForm.competitors || null,
        stakeholders: JSON.parse(JSON.stringify(currentForm.stakeholders)),
        status: currentForm.status,
        notes: currentForm.notes || null,
        is_simulator: currentForm.is_simulator,
        goal_not_required: currentForm.goal_not_required,
        owner_name: currentForm.owner_name || null,
        owner_phone: currentForm.owner_phone || null,
        owner_cpf: currentForm.owner_cpf || null,
        owner_rg: currentForm.owner_rg || null,
        owner_marital_status: currentForm.owner_marital_status || null,
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
        // If transitioning to "closed", capture the previous status_changed_at BEFORE saving
        // (because the trigger will overwrite it with the new date)
        let cancellationSignalDate: string | null = null;
        const willClose = currentForm.status === "closed" && originalStatusRef.current !== "closed";
        if (willClose && companyId) {
          const { data: prevData } = await supabase
            .from("onboarding_companies")
            .select("status_changed_at, status")
            .eq("id", companyId)
            .single();
          // Only use the previous date if company was in cancellation_signaled state
          if (prevData?.status === "cancellation_signaled" && prevData?.status_changed_at) {
            cancellationSignalDate = prevData.status_changed_at;
          }
        }

        // segment is now included in the payload directly

        console.log("[CompanyDetail] Saving payload, companyId:", companyId);
        const { data: updateData, error } = await supabase
          .from("onboarding_companies")
          .update(payload)
          .eq("id", companyId)
          .select("id");

        if (error) throw error;
        console.log("[CompanyDetail] Update returned:", updateData);

        // Only cancel recurring charges when status changes to "closed"
        // Use the date the company signaled cancellation as the 30-day reference
        const wasNotClosed = originalStatusRef.current !== "closed";
        const isNowClosed = currentForm.status === "closed";
        
        if (wasNotClosed && isNowClosed && companyId) {
          toast.info("Processando cancelamento de recorrências...");
          try {
            // Use the cancellation signal date if available, otherwise today
            const signalDate = cancellationSignalDate || new Date().toISOString();

            const { data: activeCharges } = await supabase
              .from("company_recurring_charges")
              .select("id, pagarme_plan_id, asaas_account_id")
              .eq("company_id", companyId)
              .eq("is_active", true);

            if (activeCharges && activeCharges.length > 0) {
              // Cancel Asaas subscriptions for each charge that has one
              for (const charge of activeCharges) {
                if (charge.pagarme_plan_id) {
                  try {
                    await supabase.functions.invoke("asaas-cancel-subscription", {
                      body: { subscription_id: charge.pagarme_plan_id, asaas_account_id: (charge as any).asaas_account_id },
                    });
                  } catch (asaasErr) {
                    console.error(`Error cancelling Asaas subscription ${charge.pagarme_plan_id}:`, asaasErr);
                  }
                }
              }

              // Inactivate all recurring charges
              await supabase
                .from("company_recurring_charges")
                .update({ is_active: false } as any)
                .eq("company_id", companyId)
                .eq("is_active", true);

              // Cleanup future invoices using the signal date as 30-day reference
              for (const charge of activeCharges) {
                await supabase.functions.invoke("generate-invoices", {
                  body: { 
                    action: "cleanup_future_invoices", 
                    recurring_charge_id: charge.id,
                    signal_date: signalDate,
                  },
                });
              }
              toast.success(`${activeCharges.length} recorrência(s) inativada(s). Faturas após 30 dias da sinalização excluídas.`);
            }
          } catch (recurErr) {
            console.error("Error deactivating recurring charges:", recurErr);
            toast.error("Erro ao processar recorrências");
          }
        }

        originalStatusRef.current = currentForm.status;
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

  const csOptions = staffList.filter((s) => s.role === "cs" || s.role === "admin" || s.role === "master");
  const consultantOptions = staffList.filter((s) => s.role === "consultant" || s.role === "admin" || s.role === "cs" || s.role === "master");

  // Permission logic:
  // - Master/Admin: can edit everything including CS assignment
  // - CS: can edit consultant assignment and other fields, but not CS assignment
  // - Consultant: read-only on company data
  const isMasterOrAdmin = currentUserRole === "master" || currentUserRole === "admin";
  const canEditCompany = isMasterOrAdmin || currentUserRole === "cs";
  const canEditCS = isMasterOrAdmin;
  const canEditConsultant = isMasterOrAdmin || currentUserRole === "cs";
  const canDeleteCompany = isMasterOrAdmin;
  const canViewCompanyFinancial = isMasterOrAdmin || hasFinancialPermission(FINANCIAL_PERMISSION_KEYS.fin_company_detail);

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
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" onClick={() => navigate("/onboarding-tasks/companies")}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <NexusHeader title={isNew ? "Nova Empresa" : (form.name || "Empresa")} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDeleteCompany && !isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleting}>
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{deleting ? "Excluindo..." : "Excluir"}</span>
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
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{saving ? "Salvando..." : "Salvar"}</span>
              <span className="sm:hidden">{saving ? "..." : "Salvar"}</span>
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
              <TabsList className="mb-4 sm:mb-6 h-auto gap-1 inline-flex w-max sm:w-full sm:flex-wrap justify-start">
                <TabsTrigger value="info" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Informações</span>
                  <span className="sm:hidden">Info</span>
                </TabsTrigger>
                {!isNew && (
                  <TabsTrigger value="projects" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                    <FolderOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Projetos ({projects.length})</span>
                    <span className="sm:hidden">Proj. ({projects.length})</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="team" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Equipe
                </TabsTrigger>
                <TabsTrigger value="contacts" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                  <UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Contatos</span>
                  <span className="sm:hidden">Cont.</span>
                </TabsTrigger>
                <TabsTrigger value="contract" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Contrato
                </TabsTrigger>
                <TabsTrigger value="briefing" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Briefing & Metas</span>
                  <span className="sm:hidden">Brief.</span>
                </TabsTrigger>
                {!isNew && (
                  <TabsTrigger value="points" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                    <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Pontuação</span>
                    <span className="sm:hidden">Pts</span>
                  </TabsTrigger>
                )}
                {!isNew && canViewCompanyFinancial && (
                  <TabsTrigger value="financial" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Financeiro</span>
                    <span className="sm:hidden">Fin.</span>
                  </TabsTrigger>
                )}
                {!isNew && (
                  <TabsTrigger value="dados" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                    <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Dados</span>
                    <span className="sm:hidden">Dados</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>Informações básicas da empresa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="relative">
                        <Input
                          id="cnpj"
                          value={form.cnpj}
                          placeholder="00.000.000/0000-00"
                          onChange={async (e) => {
                            const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                            const masked = raw
                              .replace(/^(\d{2})(\d)/, "$1.$2")
                              .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
                              .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
                              .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
                            setForm(prev => ({ ...prev, cnpj: masked }));

                            // Auto-lookup when CNPJ is complete (14 digits)
                            if (raw.length === 14) {
                              // Validate CNPJ first
                              if (/^(\d)\1{13}$/.test(raw)) return;
                              const calc = (slice: string, weights: number[]) => {
                                const sum = slice.split("").reduce((s, d, i) => s + parseInt(d) * weights[i], 0);
                                const r = sum % 11;
                                return r < 2 ? 0 : 11 - r;
                              };
                              const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
                              const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
                              const d1 = calc(raw.slice(0,12), w1);
                              const d2 = calc(raw.slice(0,13), w2);
                              if (d1 !== parseInt(raw[12]) || d2 !== parseInt(raw[13])) return;

                              setLoadingCnpj(true);
                              try {
                                const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
                                if (!res.ok) {
                                  toast.error("CNPJ não encontrado na base da Receita");
                                  return;
                                }
                                const data = await res.json();
                                setForm(prev => ({
                                  ...prev,
                                  cnpj: masked,
                                  name: prev.name || data.razao_social || "",
                                  phone: prev.phone || (() => {
                                    const ddd = data.ddd_telefone_1?.replace(/\D/g, "") || "";
                                    if (ddd.length >= 10) {
                                      return ddd.length === 11
                                        ? `(${ddd.slice(0,2)}) ${ddd.slice(2,7)}-${ddd.slice(7)}`
                                        : `(${ddd.slice(0,2)}) ${ddd.slice(2,6)}-${ddd.slice(6)}`;
                                    }
                                    return "";
                                  })(),
                                  email: prev.email || data.email || "",
                                  address: prev.address || data.logradouro || "",
                                  address_number: prev.address_number || data.numero || "",
                                  address_complement: prev.address_complement || data.complemento || "",
                                  address_neighborhood: prev.address_neighborhood || data.bairro || "",
                                  address_zipcode: prev.address_zipcode || (() => {
                                    const cep = (data.cep || "").replace(/\D/g, "");
                                    return cep.length === 8 ? `${cep.slice(0,5)}-${cep.slice(5)}` : cep;
                                  })(),
                                  address_city: prev.address_city || data.municipio || "",
                                  address_state: prev.address_state || data.uf || "",
                                  company_description: prev.company_description || (() => {
                                    const fantasia = data.nome_fantasia ? `Nome Fantasia: ${data.nome_fantasia}` : "";
                                    const atividade = data.cnae_fiscal_descricao ? `Atividade: ${data.cnae_fiscal_descricao}` : "";
                                    return [fantasia, atividade].filter(Boolean).join("\n");
                                  })(),
                                }));
                                toast.success("Dados do CNPJ preenchidos automaticamente");
                              } catch {
                                toast.error("Erro ao consultar CNPJ");
                              } finally {
                                setLoadingCnpj(false);
                              }
                            }
                          }}
                        />
                        {loadingCnpj && (
                          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {form.cnpj && form.cnpj.replace(/\D/g, "").length > 0 && form.cnpj.replace(/\D/g, "").length < 14 && (
                        <p className="text-xs text-destructive">CNPJ incompleto</p>
                      )}
                      {form.cnpj && form.cnpj.replace(/\D/g, "").length === 14 && (() => {
                        const digits = form.cnpj.replace(/\D/g, "");
                        if (/^(\d)\1{13}$/.test(digits)) return true;
                        const calc = (slice: string, weights: number[]) => {
                          const sum = slice.split("").reduce((s, d, i) => s + parseInt(d) * weights[i], 0);
                          const r = sum % 11;
                          return r < 2 ? 0 : 11 - r;
                        };
                        const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
                        const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
                        const d1 = calc(digits.slice(0,12), w1);
                        const d2 = calc(digits.slice(0,13), w2);
                        return d1 !== parseInt(digits[12]) || d2 !== parseInt(digits[13]);
                      })() && (
                        <p className="text-xs text-destructive">CNPJ inválido</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Segmento</Label>
                      <SegmentSelect value={form.segment} onValueChange={(value) => {
                        const previousSegment = formRef.current.segment;
                        // Only auto-save if value actually changed
                        if (value === previousSegment) return;
                        // Prevent auto-saving empty when a valid segment was already set
                        // (Radix Select can fire onValueChange spuriously on re-render)
                        if (!value && previousSegment) {
                          return;
                        }
                        setForm(prev => ({ ...prev, segment: value }));
                        if (!isNew && companyId) {
                          supabase
                            .from("onboarding_companies")
                            .update({ segment: value || null })
                            .eq("id", companyId)
                            .then(({ error }) => {
                              if (error) {
                                console.error("Error auto-saving segment:", error);
                                toast.error("Erro ao salvar segmento");
                              } else {
                                console.log("[CompanyDetail] Segment saved:", value);
                                toast.success("Segmento atualizado");
                              }
                            });
                        }
                      }} />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        placeholder="(00) 00000-0000"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                          let masked = raw;
                          if (raw.length > 2 && raw.length <= 6) {
                            masked = `(${raw.slice(0,2)}) ${raw.slice(2)}`;
                          } else if (raw.length > 6 && raw.length <= 10) {
                            masked = `(${raw.slice(0,2)}) ${raw.slice(2,6)}-${raw.slice(6)}`;
                          } else if (raw.length > 10) {
                            masked = `(${raw.slice(0,2)}) ${raw.slice(2,7)}-${raw.slice(7)}`;
                          } else if (raw.length > 0) {
                            masked = `(${raw}`;
                          }
                          setForm({ ...form, phone: masked });
                        }}
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
                  <AddressFields
                    value={{
                      address: form.address,
                      address_number: form.address_number,
                      address_complement: form.address_complement,
                      address_neighborhood: form.address_neighborhood,
                      address_zipcode: form.address_zipcode,
                      address_city: form.address_city,
                      address_state: form.address_state,
                    }}
                    onChange={(addr) => setForm({ ...form, ...addr })}
                  />

                  {/* Responsável pela Empresa */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      Responsável pela Empresa
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="owner_name">Nome Completo</Label>
                        <Input
                          id="owner_name"
                          value={form.owner_name}
                          onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                          placeholder="Nome completo do responsável"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner_phone">Telefone de Contato</Label>
                        <Input
                          id="owner_phone"
                          value={form.owner_phone}
                          placeholder="(00) 00000-0000"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                            let masked = raw;
                            if (raw.length > 2 && raw.length <= 7) {
                              masked = `(${raw.slice(0,2)}) ${raw.slice(2)}`;
                            } else if (raw.length > 7) {
                              masked = `(${raw.slice(0,2)}) ${raw.slice(2,7)}-${raw.slice(7)}`;
                            } else if (raw.length > 0) {
                              masked = `(${raw}`;
                            }
                            setForm({ ...form, owner_phone: masked });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner_cpf">CPF</Label>
                        <Input
                          id="owner_cpf"
                          value={form.owner_cpf}
                          placeholder="000.000.000-00"
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                            const masked = raw
                              .replace(/^(\d{3})(\d)/, "$1.$2")
                              .replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2")
                              .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
                            setForm({ ...form, owner_cpf: masked });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner_rg">RG</Label>
                        <Input
                          id="owner_rg"
                          value={form.owner_rg}
                          onChange={(e) => setForm({ ...form, owner_rg: e.target.value })}
                          placeholder="Número do RG"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner_marital_status">Estado Civil</Label>
                        <Select
                          value={form.owner_marital_status}
                          onValueChange={(v) => setForm({ ...form, owner_marital_status: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                            <SelectItem value="casado">Casado(a)</SelectItem>
                            <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                            <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                            <SelectItem value="uniao_estavel">União Estável</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={form.status} 
                      onValueChange={(v) => setForm({ ...form, status: v })}
                      disabled={currentUserRole !== "master" && currentUserRole !== "admin" && currentUserRole !== "cs"}
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
                    {currentUserRole !== "master" && currentUserRole !== "admin" && currentUserRole !== "cs" && (
                      <p className="text-xs text-muted-foreground">
                        Apenas CS, Admin ou Master podem alterar o status
                      </p>
                    )}
                  </div>
                  
                  {/* Simulator Toggle - Master/Admin only */}
                  {(currentUserRole === "master" || currentUserRole === "admin") && (
                    <div className="flex items-center justify-between rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/20">
                      <div className="space-y-0.5">
                        <Label htmlFor="is_simulator" className="text-base font-medium">
                          Empresa Simuladora
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Empresas simuladoras não contabilizam nas métricas do sistema (NPS, Churn, Metas, Health Score, etc.)
                        </p>
                      </div>
                      <Switch
                        id="is_simulator"
                        checked={form.is_simulator}
                        onCheckedChange={(checked) => setForm({ ...form, is_simulator: checked })}
                      />
                    </div>
                  )}

                  {/* Goal Not Required Toggle - Master/Admin/CS only */}
                  {(currentUserRole === "master" || currentUserRole === "admin" || currentUserRole === "cs") && (
                    <div className="flex items-center justify-between rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                      <div className="space-y-0.5">
                        <Label htmlFor="goal_not_required" className="text-base font-medium">
                          Meta Não Necessária
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Empresa não precisa de meta cadastrada. Não aparecerá como "Sem Meta" nos dashboards e relatórios.
                        </p>
                      </div>
                      <Switch
                        id="goal_not_required"
                        checked={form.goal_not_required}
                        onCheckedChange={(checked) => setForm({ ...form, goal_not_required: checked })}
                      />
                    </div>
                  )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Points Tab */}
            {!isNew && companyId && (
              <TabsContent value="points">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          Pontuação de Clientes
                        </CardTitle>
                        <CardDescription>
                          Gerencie o sistema de pontuação e gamificação para clientes finais desta empresa
                        </CardDescription>
                      </div>
                      <Button 
                        type="button"
                        onClick={() => navigate(`/customer-points/${companyId}`)}
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        Acessar Módulo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
                            <h3 className="font-semibold">Dashboard</h3>
                            <p className="text-sm text-muted-foreground">
                              Visualize ranking e pontuação
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                            <h3 className="font-semibold">Clientes Finais</h3>
                            <p className="text-sm text-muted-foreground">
                              Cadastre e gerencie clientes
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <ExternalLink className="h-8 w-8 text-primary mx-auto mb-2" />
                            <h3 className="font-semibold">QR Codes</h3>
                            <p className="text-sm text-muted-foreground">
                              Crie campanhas com QR Code
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Financial Tab */}
            {!isNew && companyId && canViewCompanyFinancial && (
              <TabsContent value="financial">
                <CompanyFinancialPanel
                  companyId={companyId}
                  companyName={form.name}
                  contractValue={form.contract_value ? parseFloat(form.contract_value) : undefined}
                  billingDay={form.billing_day ? parseInt(form.billing_day) : undefined}
                  customerEmail={form.email}
                  customerPhone={form.phone}
                  customerDocument={form.cnpj}
                />
              </TabsContent>
            )}

            {!isNew && (
              <TabsContent value="dados">
                <CompanyDataView
                  form={form}
                  staffList={staffList}
                  csId={form.cs_id}
                  consultantId={form.consultant_id}
                />
              </TabsContent>
            )}

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

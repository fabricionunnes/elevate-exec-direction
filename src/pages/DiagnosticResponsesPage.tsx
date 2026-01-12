import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import AdminDiagnosticPDFReport from "@/components/AdminDiagnosticPDFReport";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  LogOut,
  Users,
  UserCheck,
  Trash2,
  MessageCircle,
  Download,
  FileText,
  Target,
  TrendingUp
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoUnv from "@/assets/logo-unv.png";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";

interface DiagnosticResponse {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string;
  whatsapp: string;
  email: string | null;
  revenue: string;
  team_size: string;
  main_pain: string;
  has_sales_process: boolean;
  biggest_challenge: string | null;
  urgency: string;
  recommended_product: string | null;
  status: string;
  notes: string | null;
  why_diagnostic: string | null;
}

interface CloserDiagnostic {
  id: string;
  created_at: string;
  client_name: string;
  company: string;
  role: string | null;
  segment: string | null;
  revenue: string | null;
  team_size: string | null;
  main_pains: string[] | null;
  why_now: string | null;
  why_scheduled: string | null;
  pain_details: string | null;
  goal_12_months: string | null;
  budget: string | null;
  timeline: string | null;
  commitment_level: number | null;
  recommended_products: any;
  recommended_trail: any;
  summary: string | null;
  status: string;
  notes: string | null;
}

interface ChatAdvisorLead {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  messages: any[];
  recommended_services: any;
  status: string;
}

interface PortalPlanDiagnostic {
  id: string;
  company_id: string;
  company_name: string;
  user_name: string | null;
  user_email: string | null;
  plan_status: string;
  plan_created_at: string;
  context_data: {
    current_revenue?: string;
    annual_revenue_goal?: string;
    avg_ticket?: string;
    target_avg_ticket?: string;
    salespeople_count?: string;
    ideal_salespeople_count?: string;
    leads_month?: string;
    proposals_month?: string;
    sales_month?: string;
    conversion?: string;
    sales_cycle_days?: string;
    main_bottleneck?: string;
    bottleneck_reason?: string;
    owner_role?: string;
    has_sales_manager?: string;
    needs_process_crm?: string;
    needs_sales_management?: string;
    tracked_indicators?: string[];
    first_action_after_planning?: string;
    action_if_not_meet_60_days?: string;
    [key: string]: any;
  };
}
const revenueLabels: Record<string, string> = {
  "menos-50k": "< R$ 50k",
  "50k-100k": "R$ 50k-100k",
  "100k-200k": "R$ 100k-200k",
  "200k-500k": "R$ 200k-500k",
  "500k-1m": "R$ 500k-1M",
  "acima-1m": "> R$ 1M",
  "under-50k": "< R$ 50k",
  "200k-400k": "R$ 200k-400k",
  "400k-600k": "R$ 400k-600k",
  "600k-1m": "R$ 600k-1M",
  "1m-2m": "R$ 1M-2M",
  "over-2m": "> R$ 2M",
};

const painLabels: Record<string, string> = {
  "sem-processo": "Sem processo comercial",
  "inconsistencia": "Vendas inconsistentes",
  "time-desalinhado": "Time desalinhado",
  "poucos-leads": "Poucos leads",
  "conversao-baixa": "Conversão baixa",
  "escala": "Dificuldade escalar",
  "autoridade": "Falta autoridade",
  "lideranca-fraca": "Liderança fraca",
  "sem-diretor-comercial": "Sem diretor comercial",
  "rotatividade-time": "Rotatividade/contratação",
  "sem-clareza-financeira": "Sem clareza financeira",
  "sobrecarga-decisao": "Sobrecarga/solidão",
  "atendimento-lento": "Atendimento lento",
  "no-process": "Sem processo",
  "inconsistent-execution": "Execução inconsistente",
  "low-conversion": "Conversão baixa",
  "owner-dependent": "Dependente do dono",
  "team-scaling": "Escalar time",
  "no-direction": "Sem direção",
  "high-turnover": "Alta rotatividade",
  "slow-onboarding": "Onboarding lento",
  "no-leads": "Sem leads",
  "no-authority": "Sem autoridade",
  "no-metrics": "Sem métricas",
  "long-cycle": "Ciclo longo",
};

const teamLabels: Record<string, string> = {
  "sozinho": "Vende sozinho",
  "1-3": "1 a 3 vendedores",
  "4-10": "4 a 10 vendedores",
  "11-20": "11 a 20 vendedores",
  "20+": "Mais de 20 vendedores",
  "0": "Sem time",
  "1": "1 vendedor",
  "2-3": "2-3 vendedores",
  "4-5": "4-5 vendedores",
  "6-10": "6-10 vendedores",
  "over-20": "20+ vendedores",
};

const urgencyLabels: Record<string, string> = {
  "imediata": "Urgente",
  "alta": "Alta (30d)",
  "normal": "Normal (90d)",
  "exploratoria": "Explorando",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  contacted: "bg-blue-500/20 text-blue-600",
  qualified: "bg-emerald-500/20 text-emerald-600",
  closed: "bg-accent/20 text-accent",
  lost: "bg-destructive/20 text-destructive",
};

export default function DiagnosticResponsesPage() {
  const [responses, setResponses] = useState<DiagnosticResponse[]>([]);
  const [closerDiagnostics, setCloserDiagnostics] = useState<CloserDiagnostic[]>([]);
  const [chatLeads, setChatLeads] = useState<ChatAdvisorLead[]>([]);
  const [portalPlans, setPortalPlans] = useState<PortalPlanDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<DiagnosticResponse | null>(null);
  const [selectedCloser, setSelectedCloser] = useState<CloserDiagnostic | null>(null);
  const [selectedChatLead, setSelectedChatLead] = useState<ChatAdvisorLead | null>(null);
  const [selectedPortalPlan, setSelectedPortalPlan] = useState<PortalPlanDiagnostic | null>(null);
  const [activeTab, setActiveTab] = useState("clients");
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Check admin role
  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      
      if (error) {
        console.error("Error checking admin role");
        return false;
      }
      
      return !!data;
    } catch {
      return false;
    }
  };

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id).then(setIsAdmin);
          }, 0);
        } else {
          setIsAdmin(false);
        }
        
        setAuthLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkAdminRole(session.user.id).then(setIsAdmin);
      }
      
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const [clientsResult, closersResult, chatResult, portalResult] = await Promise.all([
        supabase
          .from("client_diagnostics")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("closer_diagnostics" as any)
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("chat_advisor_leads" as any)
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("portal_plans" as any)
          .select(`
            id,
            company_id,
            status,
            context_data,
            created_at,
            portal_companies!inner(id, name)
          `)
          .not('context_data', 'eq', '{}')
          .order("created_at", { ascending: false })
      ]);

      if (clientsResult.error) {
        if (clientsResult.error.code === 'PGRST116' || clientsResult.error.message.includes('policy')) {
          setAuthError("Você não tem permissão para acessar esses dados.");
          setResponses([]);
        } else {
          throw clientsResult.error;
        }
      } else {
        setResponses(clientsResult.data || []);
        setAuthError(null);
      }

      if (closersResult.error) {
        console.error("Error fetching closer diagnostics:", closersResult.error);
        setCloserDiagnostics([]);
      } else {
        setCloserDiagnostics((closersResult.data as unknown as CloserDiagnostic[]) || []);
      }

      if (chatResult.error) {
        console.error("Error fetching chat leads:", chatResult.error);
        setChatLeads([]);
      } else {
        setChatLeads((chatResult.data as unknown as ChatAdvisorLead[]) || []);
      }

      if (portalResult.error) {
        console.error("Error fetching portal plans:", portalResult.error);
        setPortalPlans([]);
      } else {
        // Fetch users for each company
        const companyIds = [...new Set((portalResult.data || []).map((p: any) => p.company_id))];
        const { data: usersData } = await supabase
          .from("portal_users" as any)
          .select("company_id, name, email")
          .in("company_id", companyIds);
        
        const usersByCompany = (usersData || []).reduce((acc: any, u: any) => {
          if (!acc[u.company_id]) acc[u.company_id] = u;
          return acc;
        }, {});
        
        const plans: PortalPlanDiagnostic[] = (portalResult.data || []).map((p: any) => {
          const user = usersByCompany[p.company_id];
          return {
            id: p.id,
            company_id: p.company_id,
            company_name: p.portal_companies?.name || "Empresa",
            user_name: user?.name || null,
            user_email: user?.email || null,
            plan_status: p.status,
            plan_created_at: p.created_at,
            context_data: p.context_data || {},
          };
        });
        setPortalPlans(plans);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchResponses();
    }
  }, [user, isAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login")) {
          setAuthError("E-mail ou senha inválidos");
        } else {
          setAuthError(error.message);
        }
        return;
      }

      if (data.user) {
        const hasAdminRole = await checkAdminRole(data.user.id);
        if (!hasAdminRole) {
          await supabase.auth.signOut();
          setAuthError("Usuário não possui permissão de administrador");
          return;
        }
        setIsAdmin(true);
        toast.success("Login realizado com sucesso");
      }
    } catch {
      setAuthError("Erro ao fazer login");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setResponses([]);
    setCloserDiagnostics([]);
    toast.success("Logout realizado");
  };

  const updateStatus = async (id: string, newStatus: string, isCloser: boolean = false) => {
    try {
      const { error } = await supabase
        .from(isCloser ? ("closer_diagnostics" as any) : "client_diagnostics")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      if (isCloser) {
        setCloserDiagnostics(prev => 
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        );
      } else {
        setResponses(prev => 
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        );
      }
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const deleteDiagnostic = async (id: string, isCloser: boolean = false) => {
    try {
      const { error } = await supabase
        .from(isCloser ? ("closer_diagnostics" as any) : "client_diagnostics")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      if (isCloser) {
        setCloserDiagnostics(prev => prev.filter(r => r.id !== id));
      } else {
        setResponses(prev => prev.filter(r => r.id !== id));
      }
      toast.success("Diagnóstico excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const deleteChatLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("chat_advisor_leads" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setChatLeads(prev => prev.filter(r => r.id !== id));
      toast.success("Lead do chat excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const generateClientPDF = async (response: DiagnosticResponse) => {
    const diagnosticDate = new Date(response.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const pains = response.main_pain.split(',').map(p => p.trim());

    const pdfRevenueLabels: Record<string, string> = {
      "menos-50k": "Menos de R$ 50k/mês",
      "50k-100k": "R$ 50k a R$ 100k/mês",
      "100k-200k": "R$ 100k a R$ 200k/mês",
      "200k-500k": "R$ 200k a R$ 500k/mês",
      "500k-1m": "R$ 500k a R$ 1M/mês",
      "acima-1m": "Acima de R$ 1M/mês",
    };

    const pdfTeamLabels: Record<string, string> = {
      "sozinho": "Vende sozinho",
      "1-3": "1 a 3 vendedores",
      "4-10": "4 a 10 vendedores",
      "11-20": "11 a 20 vendedores",
      "20+": "Mais de 20 vendedores",
    };

    const pdfPainLabels: Record<string, string> = {
      "sem-processo": "Sem processo comercial definido",
      "inconsistencia": "Vendas inconsistentes mês a mês",
      "time-desalinhado": "Time desalinhado ou sem padrão",
      "poucos-leads": "Poucos leads qualificados",
      "conversao-baixa": "Baixa conversão de propostas",
      "escala": "Dificuldade em escalar vendas",
      "lideranca-fraca": "Líderes não cobram ou desenvolvem",
      "autoridade": "Falta de autoridade no mercado",
      "sem-diretor-comercial": "Sem diretor comercial ou gestor",
      "rotatividade-time": "Alta rotatividade ou dificuldade de contratar",
      "sem-clareza-financeira": "Sem clareza financeira",
      "sobrecarga-decisao": "Peso da solidão e sobrecarga de decisões",
      "atendimento-lento": "Atendimento lento ou time não dá conta",
    };

    const pdfUrgencyLabels: Record<string, string> = {
      "imediata": "Imediata",
      "alta": "Nos próximos 30 dias",
      "normal": "Nos próximos 90 dias",
      "exploratoria": "Exploratório",
    };

    // Create temporary hidden div
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.width = "800px";
    container.style.backgroundColor = "#0f172a";
    container.style.color = "white";
    container.style.padding = "48px";
    container.style.borderRadius = "16px";
    container.style.fontFamily = "system-ui, sans-serif";

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 24px; margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${logoUnv}" alt="UNV" style="height: 48px;" />
          <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 16px;">
            <h1 style="font-size: 20px; font-weight: bold; color: white; margin: 0;">Relatório de Diagnóstico</h1>
            <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0 0;">Análise Comercial Personalizada</p>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; color: #9ca3af; margin: 0;">Data do diagnóstico</p>
          <p style="font-size: 14px; font-weight: 500; color: white; margin: 4px 0 0 0;">${diagnosticDate}</p>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="font-size: 18px; font-weight: bold; color: white; margin: 0 0 16px 0;">📊 Dados da Empresa</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Empresa</p>
            <p style="font-weight: 600; color: white; margin: 0;">${response.company_name}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Responsável</p>
            <p style="font-weight: 600; color: white; margin: 0;">${response.contact_name}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Faturamento</p>
            <p style="font-weight: 600; color: white; margin: 0;">${pdfRevenueLabels[response.revenue] || response.revenue}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Equipe Comercial</p>
            <p style="font-weight: 600; color: white; margin: 0;">${pdfTeamLabels[response.team_size] || response.team_size}</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px;">
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">WhatsApp</p>
            <p style="font-weight: 600; color: white; margin: 0;">${response.whatsapp}</p>
          </div>
          ${response.email ? `<div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">E-mail</p>
            <p style="font-weight: 600; color: white; margin: 0;">${response.email}</p>
          </div>` : ""}
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="font-size: 18px; font-weight: bold; color: white; margin: 0 0 16px 0;">🎯 Diagnóstico Identificado</h2>
        <div style="margin-bottom: 16px;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">Desafios Principais</p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${pains.map(pain => `<span style="padding: 6px 12px; background: rgba(196,30,58,0.2); color: #C41E3A; font-size: 14px; border-radius: 8px; border: 1px solid rgba(196,30,58,0.3);">${pdfPainLabels[pain] || pain}</span>`).join("")}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Urgência</p>
            <p style="font-weight: 500; color: white; margin: 0;">${pdfUrgencyLabels[response.urgency] || response.urgency}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Processo Comercial</p>
            <p style="font-weight: 500; color: white; margin: 0;">${response.has_sales_process ? "Sim, possui" : "Não possui"}</p>
          </div>
        </div>
        ${response.why_diagnostic ? `<div style="margin-top: 16px;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Motivação do Diagnóstico</p>
          <p style="font-size: 14px; color: #d1d5db; font-style: italic; margin: 0;">"${response.why_diagnostic}"</p>
        </div>` : ""}
        ${response.biggest_challenge ? `<div style="margin-top: 16px;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">Maior Desafio</p>
          <p style="font-size: 14px; color: #d1d5db; margin: 0;">"${response.biggest_challenge}"</p>
        </div>` : ""}
      </div>

      ${response.recommended_product ? `<div style="background: rgba(196,30,58,0.1); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 2px solid #C41E3A;">
        <h2 style="font-size: 20px; font-weight: bold; color: white; margin: 0 0 16px 0;">✨ Serviço Recomendado</h2>
        <span style="display: inline-block; padding: 8px 16px; background: #C41E3A; color: white; font-weight: bold; border-radius: 8px; font-size: 18px;">${response.recommended_product}</span>
        <p style="font-size: 14px; color: #9ca3af; margin: 16px 0 0 0;">Este serviço foi selecionado com base no seu perfil, faturamento, tamanho de equipe e desafios identificados.</p>
      </div>` : ""}

      <div style="background: linear-gradient(to right, rgba(196,30,58,0.2), transparent); border-radius: 12px; padding: 24px; border: 1px solid rgba(196,30,58,0.3);">
        <h3 style="font-size: 18px; font-weight: bold; color: white; margin: 0 0 12px 0;">📈 Próximos Passos</h3>
        <p style="font-size: 14px; color: #d1d5db; margin: 0 0 16px 0;">Nossa equipe entrará em contato pelo WhatsApp para agendar sua reunião de diagnóstico aprofundado. Nessa conversa, vamos entender melhor seu cenário e definir juntos o melhor caminho.</p>
        <div style="display: flex; align-items: center; gap: 16px; font-size: 14px;">
          <span style="color: #9ca3af;">Contato:</span>
          <span style="color: white; font-weight: 500;">${response.whatsapp}</span>
        </div>
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoUnv}" alt="UNV" style="height: 32px; opacity: 0.6;" />
          <p style="font-size: 12px; color: #6b7280; margin: 0;">© ${new Date().getFullYear()} UNV. Todos os direitos reservados.</p>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Relatório gerado a partir do diagnóstico realizado em ${diagnosticDate}.</p>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#0f172a"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Diagnostico_UNV_${response.company_name.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } finally {
      document.body.removeChild(container);
    }
  };

  const filteredResponses = responses.filter(r => 
    r.company_name.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    r.whatsapp.includes(search)
  );

  const filteredCloserDiagnostics = closerDiagnostics.filter(r => 
    r.company.toLowerCase().includes(search.toLowerCase()) ||
    r.client_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredChatLeads = chatLeads.filter(r => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      (r.name?.toLowerCase().includes(searchLower)) ||
      (r.email?.toLowerCase().includes(searchLower)) ||
      (r.phone?.includes(search))
    );
  });

  const filteredPortalPlans = portalPlans.filter(r => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      r.company_name.toLowerCase().includes(searchLower) ||
      (r.user_name?.toLowerCase().includes(searchLower)) ||
      (r.user_email?.toLowerCase().includes(searchLower))
    );
  });

  // Loading state
  if (authLoading) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </section>
      </Layout>
    );
  }

  // Not authenticated or not admin
  if (!user || !isAdmin) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full p-8 card-premium">
            <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
              Área Restrita
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              Faça login com sua conta de administrador para acessar as respostas dos diagnósticos.
            </p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  required
                  autoComplete="current-password"
                />
              </div>
              
              {authError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive">{authError}</p>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Respostas dos Diagnósticos
              </h1>
              <p className="text-muted-foreground">
                {responses.length} clientes • {closerDiagnostics.length} closers • {chatLeads.length} chat • {portalPlans.length} planejamentos
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" onClick={fetchResponses} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <Button variant="outline" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="clients" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clientes ({responses.length})
              </TabsTrigger>
              <TabsTrigger value="closers" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Closers ({closerDiagnostics.length})
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Chat IA ({chatLeads.length})
              </TabsTrigger>
              <TabsTrigger value="portal" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Planejamento ({portalPlans.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="clients">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : filteredResponses.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma resposta encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Dor</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResponses.map((response) => (
                        <TableRow key={response.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(response.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{response.company_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{response.contact_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {response.whatsapp}
                              </div>
                              {response.email && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {response.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>{revenueLabels[response.revenue] || response.revenue}</p>
                              <p className="text-muted-foreground">{response.team_size}</p>
                              {response.has_sales_process && (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Tem processo
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="secondary" className="text-xs">
                                {painLabels[response.main_pain] || response.main_pain}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs block w-fit",
                                  response.urgency === "imediata" && "border-destructive text-destructive",
                                  response.urgency === "alta" && "border-orange-500 text-orange-500"
                                )}
                              >
                                {urgencyLabels[response.urgency] || response.urgency}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-accent text-accent-foreground">
                              {response.recommended_product}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <select
                              value={response.status}
                              onChange={(e) => updateStatus(response.id, e.target.value, false)}
                              className={cn(
                                "px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer",
                                statusColors[response.status] || "bg-secondary"
                              )}
                            >
                              <option value="pending">Pendente</option>
                              <option value="contacted">Contatado</option>
                              <option value="qualified">Qualificado</option>
                              <option value="closed">Fechado</option>
                              <option value="lost">Perdido</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => generateClientPDF(response)}
                                title="Baixar PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedResponse(response)}
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const phone = response.whatsapp.replace(/\D/g, "");
                                  const text = `Olá ${response.contact_name}! Recebi seu diagnóstico da ${response.company_name}. Vamos conversar sobre o ${response.recommended_product}?`;
                                  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_top");
                                }}
                                title="WhatsApp"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Excluir"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir diagnóstico?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O diagnóstico de {response.company_name} será permanentemente excluído.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteDiagnostic(response.id, false)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="closers">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : filteredCloserDiagnostics.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum diagnóstico de closer encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Dores</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCloserDiagnostics.map((diagnostic) => (
                        <TableRow key={diagnostic.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(diagnostic.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{diagnostic.company}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{diagnostic.client_name}</p>
                              {diagnostic.role && (
                                <p className="text-xs text-muted-foreground">{diagnostic.role}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <p>{diagnostic.revenue ? (revenueLabels[diagnostic.revenue] || diagnostic.revenue) : "N/I"}</p>
                              <p className="text-muted-foreground">
                                {diagnostic.team_size ? (teamLabels[diagnostic.team_size] || diagnostic.team_size) : "N/I"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {diagnostic.main_pains?.slice(0, 2).map((pain, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {painLabels[pain] || pain}
                                </Badge>
                              ))}
                              {(diagnostic.main_pains?.length || 0) > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(diagnostic.main_pains?.length || 0) - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {diagnostic.recommended_products?.slice(0, 2).map((p: any, i: number) => (
                                <Badge 
                                  key={i} 
                                  className={cn(
                                    "text-xs",
                                    p.priority === "primary" ? "bg-accent text-accent-foreground" : "bg-secondary"
                                  )}
                                >
                                  {p.name?.replace("UNV ", "")}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              value={diagnostic.status}
                              onChange={(e) => updateStatus(diagnostic.id, e.target.value, true)}
                              className={cn(
                                "px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer",
                                statusColors[diagnostic.status] || "bg-secondary"
                              )}
                            >
                              <option value="pending">Pendente</option>
                              <option value="contacted">Contatado</option>
                              <option value="qualified">Qualificado</option>
                              <option value="closed">Fechado</option>
                              <option value="lost">Perdido</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedCloser(diagnostic)}
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Excluir"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir diagnóstico?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O diagnóstico de {diagnostic.company} será permanentemente excluído.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteDiagnostic(diagnostic.id, true)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Chat IA Leads */}
            <TabsContent value="chat">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : filteredChatLeads.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum lead do chat encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Mensagens</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChatLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(lead.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{lead.name || "Não informado"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {lead.email && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {lead.email}
                                </div>
                              )}
                              {lead.phone && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone}
                                </div>
                              )}
                              {!lead.email && !lead.phone && (
                                <span className="text-xs text-muted-foreground">Não informado</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {Array.isArray(lead.messages) ? lead.messages.length : 0} msgs
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[lead.status] || statusColors.pending}>
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedChatLead(lead)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteChatLead(lead.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Portal Plans Tab */}
            <TabsContent value="portal">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                </div>
              ) : filteredPortalPlans.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum planejamento encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Situação Atual</TableHead>
                        <TableHead>Diagnóstico</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPortalPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(plan.plan_created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{plan.company_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {plan.user_name && (
                                <p className="font-medium text-sm">{plan.user_name}</p>
                              )}
                              {plan.user_email && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {plan.user_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              {plan.context_data.current_revenue && (
                                <p><span className="text-muted-foreground">Fat.:</span> R$ {plan.context_data.current_revenue}</p>
                              )}
                              {plan.context_data.salespeople_count && (
                                <p><span className="text-muted-foreground">Vendedores:</span> {plan.context_data.salespeople_count}</p>
                              )}
                              {plan.context_data.leads_month && (
                                <p><span className="text-muted-foreground">Leads/mês:</span> {plan.context_data.leads_month}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {plan.context_data.main_bottleneck && (
                                <Badge variant="secondary" className="text-xs">
                                  {plan.context_data.main_bottleneck === 'process' ? 'Processo' : 
                                   plan.context_data.main_bottleneck === 'leads' ? 'Leads' : 
                                   plan.context_data.main_bottleneck === 'team' ? 'Time' : 
                                   plan.context_data.main_bottleneck === 'conversion' ? 'Conversão' : 
                                   plan.context_data.main_bottleneck}
                                </Badge>
                              )}
                              {plan.context_data.needs_sales_management === 'yes' && (
                                <Badge variant="outline" className="text-xs block w-fit">
                                  Precisa de gestão
                                </Badge>
                              )}
                              {plan.context_data.needs_process_crm === 'yes' && (
                                <Badge variant="outline" className="text-xs block w-fit">
                                  Precisa de CRM
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              plan.plan_status === 'published' ? 'bg-emerald-500/20 text-emerald-600' :
                              plan.plan_status === 'draft' ? 'bg-yellow-500/20 text-yellow-600' :
                              'bg-secondary'
                            )}>
                              {plan.plan_status === 'published' ? 'Publicado' : 
                               plan.plan_status === 'draft' ? 'Rascunho' : plan.plan_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPortalPlan(plan)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Modal de Detalhes - Cliente */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-accent" />
              {selectedResponse?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedResponse && (
            <div className="space-y-6 mt-4">
              {/* Contato */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Contato</p>
                  <p className="font-semibold text-foreground">{selectedResponse.contact_name}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
                  <p className="font-semibold text-foreground">{selectedResponse.whatsapp}</p>
                </div>
                {selectedResponse.email && (
                  <div className="bg-secondary/50 rounded-lg p-4 sm:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                    <p className="font-semibold text-foreground">{selectedResponse.email}</p>
                  </div>
                )}
              </div>

              {/* Perfil */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Perfil da Empresa</h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
                    <p className="font-medium text-foreground">{revenueLabels[selectedResponse.revenue] || selectedResponse.revenue}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <p className="font-medium text-foreground">{teamLabels[selectedResponse.team_size] || selectedResponse.team_size}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Processo</p>
                    <p className="font-medium text-foreground">{selectedResponse.has_sales_process ? "Tem processo" : "Sem processo"}</p>
                  </div>
                </div>
              </div>

              {/* Dores */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Dores Identificadas</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedResponse.main_pain.split(',').map((pain, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {painLabels[pain.trim()] || pain.trim()}
                    </Badge>
                  ))}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-sm",
                      selectedResponse.urgency === "imediata" && "border-destructive text-destructive",
                      selectedResponse.urgency === "alta" && "border-orange-500 text-orange-500"
                    )}
                  >
                    {urgencyLabels[selectedResponse.urgency] || selectedResponse.urgency}
                  </Badge>
                </div>
                
                {selectedResponse.biggest_challenge && (
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-2">Maior desafio descrito</p>
                    <p className="text-foreground">{selectedResponse.biggest_challenge}</p>
                  </div>
                )}
              </div>

              {/* Produto Recomendado */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Produto Recomendado</h4>
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                  <Badge className="bg-accent text-accent-foreground text-base px-4 py-1">
                    {selectedResponse.recommended_product}
                  </Badge>
                </div>
              </div>

              {/* Briefing para o Closer - Baseado nas 12 Fases */}
              <div className="border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  📋 Briefing para o Closer — Guia das 12 Fases
                </h4>
                
                <div className="space-y-4">
                  {/* Fase 1: Rapport e Contexto */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-blue-400 uppercase mb-2">Fase 1 — Rapport e Contexto</h5>
                    <p className="text-sm text-foreground mb-2">
                      <span className="font-semibold">Quem é:</span> {selectedResponse.contact_name} da {selectedResponse.company_name}
                    </p>
                    <p className="text-sm text-foreground mb-2">
                      <span className="font-semibold">Perfil:</span> {revenueLabels[selectedResponse.revenue] || selectedResponse.revenue} de faturamento, 
                      {teamLabels[selectedResponse.team_size]?.toLowerCase() || selectedResponse.team_size}
                    </p>
                    {selectedResponse.why_diagnostic && (
                      <div className="mt-2 bg-background/50 rounded p-2">
                        <p className="text-xs text-muted-foreground mb-1">Por que buscou o diagnóstico:</p>
                        <p className="text-sm text-foreground italic">"{selectedResponse.why_diagnostic}"</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      💡 Dica: Use as palavras dele para criar conexão. Repita o motivo que ele trouxe.
                    </p>
                  </div>

                  {/* Fase 2: Dores e Sintomas */}
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-orange-400 uppercase mb-2">Fase 2 — Dores e Sintomas</h5>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedResponse.main_pain.split(',').map((pain, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {painLabels[pain.trim()] || pain.trim()}
                        </Badge>
                      ))}
                    </div>
                    {selectedResponse.biggest_challenge && (
                      <p className="text-sm text-foreground mt-2">
                        <span className="font-semibold">Maior desafio descrito:</span> {selectedResponse.biggest_challenge}
                      </p>
                    )}
                    <div className="mt-3 text-xs text-muted-foreground">
                      <p className="font-semibold mb-1">Perguntas de aprofundamento:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Há quanto tempo você convive com esse problema?</li>
                        <li>O que esse problema está te custando hoje? (tempo, dinheiro, energia)</li>
                        <li>Como isso afeta sua vida pessoal e sua rotina?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Fase 3: Tentativas Anteriores */}
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-purple-400 uppercase mb-2">Fase 3 — Tentativas Anteriores</h5>
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedResponse.has_sales_process 
                        ? "Já possui algum processo comercial (investigar eficácia)" 
                        : "Não tem processo comercial estruturado"}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold mb-1">Perguntas para explorar:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>O que você já tentou fazer para resolver isso?</li>
                        <li>Por que você acha que não funcionou?</li>
                        <li>Já investiu em alguma consultoria ou treinamento antes?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Fase 4: Urgência e Timeline */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-red-400 uppercase mb-2">Fase 4 — Urgência e Timeline</h5>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-sm mb-2",
                        selectedResponse.urgency === "imediata" && "border-destructive text-destructive",
                        selectedResponse.urgency === "alta" && "border-orange-500 text-orange-500"
                      )}
                    >
                      {urgencyLabels[selectedResponse.urgency] || selectedResponse.urgency}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-2">
                      <p className="font-semibold mb-1">Perguntas para validar urgência real:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>O que acontece se você não resolver isso nos próximos 90 dias?</li>
                        <li>Por que agora? O que mudou?</li>
                        <li>Quando você precisa ver os primeiros resultados?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Fase 5: Metas e Expectativas */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase mb-2">Fase 5 — Metas e Expectativas</h5>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold mb-1">Perguntas para alinhar expectativas:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Qual é sua meta de faturamento para os próximos 12 meses?</li>
                        <li>O que muda na sua vida quando você atingir essa meta?</li>
                        <li>O que você espera que a UNV faça por você?</li>
                        <li>Você entende que a UNV direciona e cobra, mas quem executa é você e seu time?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Fase 6: Decisor e Processo */}
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-cyan-400 uppercase mb-2">Fase 6 — Decisor e Processo de Decisão</h5>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold mb-1">Perguntas obrigatórias:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Você é quem decide sobre esse investimento?</li>
                        <li>Existe um sócio ou parceiro(a) que precisa estar nessa conversa?</li>
                        <li>Como você costuma tomar decisões de investimento na empresa?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Fase 7: Produto Recomendado */}
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-accent uppercase mb-2">Fase 7 — Apresentação da Solução</h5>
                    <Badge className="bg-accent text-accent-foreground text-sm px-3 py-1 mb-3">
                      {selectedResponse.recommended_product}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-2">
                      <p className="font-semibold mb-1">Por que este serviço (argumentos):</p>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedResponse.main_pain.split(',').slice(0, 3).map((pain, i) => (
                          <li key={i}>
                            Resolve a dor: {painLabels[pain.trim()] || pain.trim()}
                          </li>
                        ))}
                        <li>Adequado ao perfil de {revenueLabels[selectedResponse.revenue] || selectedResponse.revenue}</li>
                        {!selectedResponse.has_sales_process && <li>Ideal para quem ainda não tem processo estruturado</li>}
                      </ul>
                    </div>
                  </div>

                  {/* Fases 8-12: Fechamento */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <h5 className="text-xs font-bold text-amber-400 uppercase mb-2">Fases 8-12 — Compromisso e Fechamento</h5>
                    <div className="text-xs text-muted-foreground space-y-2">
                      <div>
                        <p className="font-semibold">8. Admissão:</p>
                        <p className="italic">"Você concorda que precisa de ajuda externa para resolver isso?"</p>
                      </div>
                      <div>
                        <p className="font-semibold">9. Compromisso:</p>
                        <p className="italic">"De 0 a 10, qual seu nível de comprometimento para resolver isso agora?"</p>
                      </div>
                      <div>
                        <p className="font-semibold">10. Coachability:</p>
                        <p className="italic">"Você está aberto a ser cobrado e confrontado quando necessário?"</p>
                      </div>
                      <div>
                        <p className="font-semibold">11. Investimento:</p>
                        <p className="italic">Apresentar valor apenas após validar compromisso e coachability</p>
                      </div>
                      <div>
                        <p className="font-semibold">12. Próximos Passos:</p>
                        <p className="italic">Definir data de início, forma de pagamento e onboarding</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF Report */}
              <div className="border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  📄 Relatório em PDF
                </h4>
                <AdminDiagnosticPDFReport diagnostic={selectedResponse} />
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const phone = selectedResponse.whatsapp.replace(/\D/g, "");
                    const text = `Olá ${selectedResponse.contact_name}! Recebi seu diagnóstico da ${selectedResponse.company_name}. Vamos conversar sobre o ${selectedResponse.recommended_product}?`;
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_top");
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Chamar no WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes - Closer */}
      <Dialog open={!!selectedCloser} onOpenChange={() => setSelectedCloser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-accent" />
              Diagnóstico: {selectedCloser?.company}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCloser && (
            <div className="space-y-6 mt-4">
              {/* Info básica */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                  <p className="font-semibold text-foreground">{selectedCloser.client_name}</p>
                  {selectedCloser.role && <p className="text-sm text-muted-foreground">{selectedCloser.role}</p>}
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Segmento</p>
                  <p className="font-semibold text-foreground">{selectedCloser.segment || "N/I"}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Compromisso</p>
                  <p className="font-semibold text-foreground">{selectedCloser.commitment_level || 0}/5</p>
                </div>
              </div>

              {/* Perfil */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Perfil Comercial</h4>
                <div className="grid sm:grid-cols-4 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
                    <p className="font-medium text-foreground">{selectedCloser.revenue ? (revenueLabels[selectedCloser.revenue] || selectedCloser.revenue) : "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <p className="font-medium text-foreground">{selectedCloser.team_size ? (teamLabels[selectedCloser.team_size] || selectedCloser.team_size) : "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Budget</p>
                    <p className="font-medium text-foreground">{selectedCloser.budget || "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Timeline</p>
                    <p className="font-medium text-foreground">{selectedCloser.timeline || "N/I"}</p>
                  </div>
                </div>
              </div>

              {/* Dores */}
              {selectedCloser.main_pains && selectedCloser.main_pains.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Dores Identificadas</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedCloser.main_pains.map((pain, i) => (
                      <Badge key={i} variant="secondary" className="text-sm">
                        {painLabels[pain] || pain}
                      </Badge>
                    ))}
                  </div>
                  {selectedCloser.pain_details && (
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-2">Detalhes das dores</p>
                      <p className="text-foreground">{selectedCloser.pain_details}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Por que / Por que agora */}
              {(selectedCloser.why_scheduled || selectedCloser.why_now) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {selectedCloser.why_scheduled && (
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-2">Por que marcou</p>
                      <p className="text-foreground text-sm">{selectedCloser.why_scheduled}</p>
                    </div>
                  )}
                  {selectedCloser.why_now && (
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-2">Por que agora</p>
                      <p className="text-foreground text-sm">{selectedCloser.why_now}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Meta */}
              {selectedCloser.goal_12_months && (
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">Meta 12 meses</p>
                  <p className="text-foreground">{selectedCloser.goal_12_months}</p>
                </div>
              )}

              {/* Produtos Recomendados */}
              {selectedCloser.recommended_products && selectedCloser.recommended_products.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Produtos Recomendados</h4>
                  <div className="space-y-3">
                    {selectedCloser.recommended_products.map((product: any, i: number) => (
                      <div key={i} className={cn(
                        "rounded-lg p-4 border",
                        product.priority === "primary" ? "bg-accent/10 border-accent/20" : "bg-secondary/50 border-border"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={cn(
                            product.priority === "primary" ? "bg-accent text-accent-foreground" : "bg-secondary"
                          )}>
                            {product.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {product.priority === "primary" ? "Principal" : product.priority === "secondary" ? "Secundário" : "Complementar"}
                          </span>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {product.reasons?.map((reason: string, j: number) => (
                            <li key={j}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trilha */}
              {selectedCloser.recommended_trail && selectedCloser.recommended_trail.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Trilha de Evolução</h4>
                  <div className="space-y-2">
                    {selectedCloser.recommended_trail.map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                        <Badge variant="outline">{step.phase}</Badge>
                        <span className="font-medium text-foreground">{step.product}</span>
                        <span className="text-muted-foreground text-sm">— {step.objective}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedCloser.summary && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">Resumo</p>
                  <p className="text-foreground">{selectedCloser.summary}</p>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedCloser(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes - Chat Lead */}
      <Dialog open={!!selectedChatLead} onOpenChange={() => setSelectedChatLead(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversa do Chat</DialogTitle>
          </DialogHeader>
          {selectedChatLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedChatLead.name || "Não informado"}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="font-medium">{selectedChatLead.email || "Não informado"}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedChatLead.phone || "Não informado"}</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Histórico da Conversa</p>
                {Array.isArray(selectedChatLead.messages) && selectedChatLead.messages.map((msg: any, i: number) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg text-sm",
                    msg.role === "user" ? "bg-primary/10 ml-8" : "bg-secondary mr-8"
                  )}>
                    <p className="text-xs text-muted-foreground mb-1">
                      {msg.role === "user" ? "Visitante" : "Consultor UNV"}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setSelectedChatLead(null)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes - Portal Plan */}
      <Dialog open={!!selectedPortalPlan} onOpenChange={() => setSelectedPortalPlan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Target className="h-5 w-5 text-accent" />
              Planejamento: {selectedPortalPlan?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedPortalPlan && (
            <div className="space-y-6 mt-4">
              {/* Info básica */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Empresa</p>
                  <p className="font-semibold text-foreground">{selectedPortalPlan.company_name}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                  <p className="font-semibold text-foreground">{selectedPortalPlan.user_name || "N/I"}</p>
                  {selectedPortalPlan.user_email && (
                    <p className="text-xs text-muted-foreground">{selectedPortalPlan.user_email}</p>
                  )}
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={cn(
                    selectedPortalPlan.plan_status === 'published' ? 'bg-emerald-500/20 text-emerald-600' :
                    selectedPortalPlan.plan_status === 'draft' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-secondary'
                  )}>
                    {selectedPortalPlan.plan_status === 'published' ? 'Publicado' : 
                     selectedPortalPlan.plan_status === 'draft' ? 'Rascunho' : selectedPortalPlan.plan_status}
                  </Badge>
                </div>
              </div>

              {/* Situação Atual */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Situação Atual
                </h4>
                <div className="grid sm:grid-cols-4 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Faturamento Atual</p>
                    <p className="font-medium text-foreground">
                      {selectedPortalPlan.context_data.current_revenue ? `R$ ${selectedPortalPlan.context_data.current_revenue}` : "N/I"}
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Meta Anual</p>
                    <p className="font-medium text-foreground">
                      {selectedPortalPlan.context_data.annual_revenue_goal ? `R$ ${selectedPortalPlan.context_data.annual_revenue_goal}` : "N/I"}
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Ticket Médio</p>
                    <p className="font-medium text-foreground">
                      {selectedPortalPlan.context_data.avg_ticket ? `R$ ${selectedPortalPlan.context_data.avg_ticket}` : "N/I"}
                    </p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Ticket Meta</p>
                    <p className="font-medium text-foreground">
                      {selectedPortalPlan.context_data.target_avg_ticket ? `R$ ${selectedPortalPlan.context_data.target_avg_ticket}` : "N/I"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vendas */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Indicadores de Vendas
                </h4>
                <div className="grid sm:grid-cols-5 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Vendedores</p>
                    <p className="font-medium text-foreground">{selectedPortalPlan.context_data.salespeople_count || "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Leads/mês</p>
                    <p className="font-medium text-foreground">{selectedPortalPlan.context_data.leads_month || "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Propostas/mês</p>
                    <p className="font-medium text-foreground">{selectedPortalPlan.context_data.proposals_month || "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Vendas/mês</p>
                    <p className="font-medium text-foreground">{selectedPortalPlan.context_data.sales_month || "N/I"}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Ciclo (dias)</p>
                    <p className="font-medium text-foreground">{selectedPortalPlan.context_data.sales_cycle_days || "N/I"}</p>
                  </div>
                </div>
              </div>

              {/* Diagnóstico */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Diagnóstico</h4>
                <div className="space-y-3">
                  {selectedPortalPlan.context_data.main_bottleneck && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">Principal Gargalo</p>
                      <Badge variant="secondary" className="mb-2">
                        {selectedPortalPlan.context_data.main_bottleneck === 'process' ? 'Processo' : 
                         selectedPortalPlan.context_data.main_bottleneck === 'leads' ? 'Leads' : 
                         selectedPortalPlan.context_data.main_bottleneck === 'team' ? 'Time' : 
                         selectedPortalPlan.context_data.main_bottleneck === 'conversion' ? 'Conversão' : 
                         selectedPortalPlan.context_data.main_bottleneck}
                      </Badge>
                      {selectedPortalPlan.context_data.bottleneck_reason && (
                        <p className="text-sm text-foreground mt-2">{selectedPortalPlan.context_data.bottleneck_reason}</p>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Tem gestor comercial?</p>
                      <Badge variant={selectedPortalPlan.context_data.has_sales_manager === 'yes' ? 'default' : 'outline'}>
                        {selectedPortalPlan.context_data.has_sales_manager === 'yes' ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Precisa de gestão?</p>
                      <Badge variant={selectedPortalPlan.context_data.needs_sales_management === 'yes' ? 'destructive' : 'outline'}>
                        {selectedPortalPlan.context_data.needs_sales_management === 'yes' ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Precisa de CRM/Processo?</p>
                      <Badge variant={selectedPortalPlan.context_data.needs_process_crm === 'yes' ? 'destructive' : 'outline'}>
                        {selectedPortalPlan.context_data.needs_process_crm === 'yes' ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                  </div>

                  {selectedPortalPlan.context_data.owner_role && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Papel do Dono</p>
                      <p className="font-medium text-foreground">
                        {selectedPortalPlan.context_data.owner_role === 'operational' ? 'Operacional (vendendo)' :
                         selectedPortalPlan.context_data.owner_role === 'manager' ? 'Gestor (gerenciando time)' :
                         selectedPortalPlan.context_data.owner_role === 'strategic' ? 'Estratégico (visão do negócio)' :
                         selectedPortalPlan.context_data.owner_role}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Próximos Passos */}
              {(selectedPortalPlan.context_data.first_action_after_planning || selectedPortalPlan.context_data.action_if_not_meet_60_days) && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Próximos Passos</h4>
                  <div className="space-y-3">
                    {selectedPortalPlan.context_data.first_action_after_planning && (
                      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Primeira ação após planejamento</p>
                        <p className="text-sm text-foreground">{selectedPortalPlan.context_data.first_action_after_planning}</p>
                      </div>
                    )}
                    {selectedPortalPlan.context_data.action_if_not_meet_60_days && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground mb-1">Se não bater meta em 60 dias</p>
                        <p className="text-sm text-foreground">{selectedPortalPlan.context_data.action_if_not_meet_60_days}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Indicadores Acompanhados */}
              {selectedPortalPlan.context_data.tracked_indicators && selectedPortalPlan.context_data.tracked_indicators.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Indicadores que acompanha</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPortalPlan.context_data.tracked_indicators.map((indicator, i) => (
                      <Badge key={i} variant="outline">{indicator}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedPortalPlan(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

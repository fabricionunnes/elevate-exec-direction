import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
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
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  LogOut,
  Crown,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  HelpCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";

interface MastermindApplication {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  role_other: string | null;
  monthly_revenue: string;
  company_age: string;
  employees_count: number;
  salespeople_count: number;
  main_challenge: string;
  upcoming_decision: string;
  energy_drain: string;
  feels_alone: string;
  willing_to_share_numbers: boolean;
  reaction_to_confrontation: string;
  contribution_to_group: string;
  validation_or_confrontation: string;
  available_for_meetings: boolean;
  understands_mansion_costs: boolean;
  agrees_confidentiality: boolean;
  aware_of_investment: boolean;
  why_right_moment: string;
  success_definition: string;
  is_decision_maker: boolean;
  understands_not_operational: boolean;
  understands_may_be_refused: boolean;
  commits_confidentiality: boolean;
  status: string;
  notes: string | null;
}

interface EligibilityAnalysis {
  isEligible: boolean;
  score: number;
  flags: {
    type: "positive" | "negative" | "warning";
    message: string;
  }[];
  recommendation: "approved" | "waitlist" | "rejected" | "review";
}

const analyzeEligibility = (app: MastermindApplication): EligibilityAnalysis => {
  const flags: EligibilityAnalysis["flags"] = [];
  let score = 0;

  // Revenue check (required: R$ 300k+)
  if (app.monthly_revenue.includes("300k") || app.monthly_revenue.includes("500k") || 
      app.monthly_revenue.includes("1M") || app.monthly_revenue.includes("3M")) {
    score += 20;
    flags.push({ type: "positive", message: `Faturamento: ${app.monthly_revenue}` });
  } else {
    flags.push({ type: "negative", message: "Faturamento abaixo do mínimo exigido" });
  }

  // Role check (must be decision maker)
  if (["Fundador", "Sócio", "CEO"].includes(app.role)) {
    score += 15;
    flags.push({ type: "positive", message: `Cargo: ${app.role} (decisor)` });
  } else if (app.role === "Diretor") {
    score += 10;
    flags.push({ type: "warning", message: "Cargo: Diretor (verificar poder de decisão)" });
  } else {
    flags.push({ type: "negative", message: `Cargo: ${app.role_other || app.role} (pode não ser decisor)` });
  }

  // Willing to share numbers (required)
  if (app.willing_to_share_numbers) {
    score += 15;
    flags.push({ type: "positive", message: "Disposto a compartilhar números reais" });
  } else {
    flags.push({ type: "negative", message: "NÃO disposto a compartilhar números - RECUSA AUTOMÁTICA" });
  }

  // Validation vs confrontation
  if (app.validation_or_confrontation === "Confronto" || 
      app.validation_or_confrontation === "Ambos, mas priorizo confronto") {
    score += 15;
    flags.push({ type: "positive", message: `Busca: ${app.validation_or_confrontation}` });
  } else if (app.validation_or_confrontation === "Validação") {
    score -= 10;
    flags.push({ type: "negative", message: "Busca validação (tendência à recusa)" });
  }

  // Availability
  if (app.available_for_meetings) {
    score += 10;
    flags.push({ type: "positive", message: "Disponibilidade para encontros confirmada" });
  } else {
    flags.push({ type: "negative", message: "Sem disponibilidade para encontros" });
  }

  // Understands mansion costs
  if (app.understands_mansion_costs) {
    score += 5;
  } else {
    flags.push({ type: "warning", message: "Não entende custos da Mansão" });
  }

  // Agrees confidentiality
  if (app.agrees_confidentiality && app.commits_confidentiality) {
    score += 10;
    flags.push({ type: "positive", message: "Concorda com confidencialidade" });
  } else {
    flags.push({ type: "negative", message: "Não concorda com confidencialidade" });
  }

  // Investment awareness
  if (app.aware_of_investment) {
    score += 5;
    flags.push({ type: "positive", message: "Ciente do investimento de R$ 36.000" });
  } else {
    flags.push({ type: "warning", message: "Não confirmou ciência do investimento" });
  }

  // Feels alone in decisions (positive indicator)
  if (app.feels_alone === "Sim, frequentemente" || app.feels_alone === "Às vezes") {
    score += 5;
    flags.push({ type: "positive", message: `Se sente sozinho nas decisões: ${app.feels_alone}` });
  }

  // Company maturity
  if (app.company_age === "5 a 10 anos" || app.company_age === "Mais de 10 anos") {
    score += 5;
    flags.push({ type: "positive", message: `Empresa madura: ${app.company_age}` });
  }

  // Calculate recommendation
  let recommendation: EligibilityAnalysis["recommendation"];
  const isEligible = score >= 70 && app.willing_to_share_numbers;

  if (!app.willing_to_share_numbers || app.validation_or_confrontation === "Validação") {
    recommendation = "rejected";
  } else if (score >= 80) {
    recommendation = "approved";
  } else if (score >= 60) {
    recommendation = "review";
  } else if (score >= 40) {
    recommendation = "waitlist";
  } else {
    recommendation = "rejected";
  }

  return { isEligible, score, flags, recommendation };
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-emerald-500/20 text-emerald-600",
  waitlist: "bg-blue-500/20 text-blue-600",
  rejected: "bg-destructive/20 text-destructive",
  contacted: "bg-purple-500/20 text-purple-600",
};

const recommendationLabels: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  approved: { label: "Apto", color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30", icon: ThumbsUp },
  review: { label: "Análise", color: "bg-amber-500/20 text-amber-600 border-amber-500/30", icon: HelpCircle },
  waitlist: { label: "Lista de Espera", color: "bg-blue-500/20 text-blue-600 border-blue-500/30", icon: Clock },
  rejected: { label: "Não Apto", color: "bg-destructive/20 text-destructive border-destructive/30", icon: ThumbsDown },
};

export default function MastermindApplicationsPage() {
  const [applications, setApplications] = useState<MastermindApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<MastermindApplication | null>(null);
  
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

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mastermind_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('policy')) {
          setAuthError("Você não tem permissão para acessar esses dados.");
          setApplications([]);
        } else {
          throw error;
        }
      } else {
        setApplications(data || []);
        setAuthError(null);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchApplications();
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
    setApplications([]);
    toast.success("Logout realizado");
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("mastermind_applications")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      setApplications(prev => 
        prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
      );
      toast.success("Status atualizado");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const filteredApplications = applications.filter(a => 
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.company.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  // Loading state
  if (authLoading) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
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
            <div className="flex items-center justify-center gap-2 mb-6">
              <Crown className="h-8 w-8 text-amber-500" />
              <h1 className="text-2xl font-bold text-foreground">
                Mastermind Admin
              </h1>
            </div>
            <p className="text-muted-foreground text-center mb-6">
              Faça login com sua conta de administrador para acessar as aplicações do Mastermind.
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
                className="w-full bg-amber-500 hover:bg-amber-600" 
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

  const selectedAnalysis = selectedApplication ? analyzeEligibility(selectedApplication) : null;

  return (
    <Layout>
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-amber-500" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Aplicações Mastermind
                </h1>
                <p className="text-muted-foreground">
                  {applications.length} aplicações recebidas
                </p>
              </div>
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
              <Button variant="outline" onClick={fetchApplications} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              <Button variant="outline" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="text-center py-20">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma aplicação encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Faturamento</TableHead>
                    <TableHead>Aptidão</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => {
                    const analysis = analyzeEligibility(app);
                    const recLabel = recommendationLabels[analysis.recommendation];
                    const RecIcon = recLabel.icon;
                    
                    return (
                      <TableRow key={app.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(app.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{app.full_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {app.email}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {app.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{app.company}</span>
                              <p className="text-xs text-muted-foreground">{app.role}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{app.monthly_revenue}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", recLabel.color)}>
                            <RecIcon className="h-3 w-3 mr-1" />
                            {recLabel.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "text-lg font-bold",
                            analysis.score >= 70 ? "text-emerald-500" : 
                            analysis.score >= 50 ? "text-amber-500" : "text-destructive"
                          )}>
                            {analysis.score}%
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={app.status}
                            onChange={(e) => updateStatus(app.id, e.target.value)}
                            className={cn(
                              "px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer",
                              statusColors[app.status] || "bg-secondary"
                            )}
                          >
                            <option value="pending">Pendente</option>
                            <option value="approved">Aprovado</option>
                            <option value="waitlist">Lista de Espera</option>
                            <option value="rejected">Recusado</option>
                            <option value="contacted">Contatado</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedApplication(app)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const phone = app.phone.replace(/\D/g, "");
                                const text = `Olá ${app.full_name}! Recebi sua aplicação para o UNV Mastermind. Vamos agendar uma conversa de curadoria?`;
                                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_top");
                              }}
                              title="WhatsApp"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Aplicação Mastermind - {selectedApplication?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedApplication && selectedAnalysis && (
            <div className="space-y-6">
              {/* Eligibility Summary */}
              <div className={cn(
                "p-6 rounded-lg border-2",
                selectedAnalysis.isEligible 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : selectedAnalysis.recommendation === "review"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-destructive/10 border-destructive/30"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedAnalysis.isEligible ? (
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    ) : selectedAnalysis.recommendation === "review" ? (
                      <HelpCircle className="h-8 w-8 text-amber-500" />
                    ) : (
                      <XCircle className="h-8 w-8 text-destructive" />
                    )}
                    <div>
                      <h3 className="text-xl font-bold">
                        {selectedAnalysis.isEligible ? "CANDIDATO APTO" : 
                         selectedAnalysis.recommendation === "review" ? "REQUER ANÁLISE" : 
                         "CANDIDATO NÃO APTO"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Score: {selectedAnalysis.score}/100
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-lg px-4 py-2", recommendationLabels[selectedAnalysis.recommendation].color)}>
                    {recommendationLabels[selectedAnalysis.recommendation].label}
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  {selectedAnalysis.flags.map((flag, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {flag.type === "positive" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : flag.type === "negative" ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className={cn(
                        "text-sm",
                        flag.type === "positive" ? "text-emerald-600" :
                        flag.type === "negative" ? "text-destructive" :
                        "text-amber-600"
                      )}>
                        {flag.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground border-b border-border pb-2">
                    Dados do Candidato
                  </h4>
                  <p><span className="text-muted-foreground">Nome:</span> {selectedApplication.full_name}</p>
                  <p><span className="text-muted-foreground">E-mail:</span> {selectedApplication.email}</p>
                  <p><span className="text-muted-foreground">Telefone:</span> {selectedApplication.phone}</p>
                  <p><span className="text-muted-foreground">Cargo:</span> {selectedApplication.role} {selectedApplication.role_other && `(${selectedApplication.role_other})`}</p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground border-b border-border pb-2">
                    Dados da Empresa
                  </h4>
                  <p><span className="text-muted-foreground">Empresa:</span> {selectedApplication.company}</p>
                  <p><span className="text-muted-foreground">Faturamento:</span> {selectedApplication.monthly_revenue}</p>
                  <p><span className="text-muted-foreground">Tempo:</span> {selectedApplication.company_age}</p>
                  <p><span className="text-muted-foreground">Colaboradores:</span> {selectedApplication.employees_count}</p>
                  <p><span className="text-muted-foreground">Vendedores:</span> {selectedApplication.salespeople_count}</p>
                </div>
              </div>

              {/* Challenges */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground border-b border-border pb-2">
                  Momento e Desafios
                </h4>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Principal desafio estratégico:</p>
                  <p className="text-foreground">{selectedApplication.main_challenge}</p>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Decisão importante nos próximos 6 meses:</p>
                  <p className="text-foreground">{selectedApplication.upcoming_decision}</p>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">O que consome energia como líder:</p>
                  <p className="text-foreground">{selectedApplication.energy_drain}</p>
                </div>
                
                <p><span className="text-muted-foreground">Se sente sozinho nas decisões:</span> {selectedApplication.feels_alone}</p>
              </div>

              {/* Maturity */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground border-b border-border pb-2">
                  Maturidade e Postura
                </h4>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Reação ao ser confrontado:</p>
                  <p className="text-foreground">{selectedApplication.reaction_to_confrontation}</p>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Contribuição para o grupo:</p>
                  <p className="text-foreground">{selectedApplication.contribution_to_group}</p>
                </div>
                
                <p><span className="text-muted-foreground">Busca:</span> {selectedApplication.validation_or_confrontation}</p>
              </div>

              {/* Investment */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground border-b border-border pb-2">
                  Investimento e Expectativa
                </h4>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Por que este é o momento certo:</p>
                  <p className="text-foreground">{selectedApplication.why_right_moment}</p>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Definição de sucesso em 12 meses:</p>
                  <p className="text-foreground">{selectedApplication.success_definition}</p>
                </div>
              </div>

              {/* Declarations */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground border-b border-border pb-2">
                  Declarações
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    {selectedApplication.is_decision_maker ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="text-sm">É decisor na empresa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedApplication.understands_not_operational ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="text-sm">Entende que não é operacional</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedApplication.understands_may_be_refused ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="text-sm">Entende que pode ser recusado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedApplication.commits_confidentiality ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="text-sm">Compromete-se com confidencialidade</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button 
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => {
                    const phone = selectedApplication.phone.replace(/\D/g, "");
                    const text = `Olá ${selectedApplication.full_name}! Recebi sua aplicação para o UNV Mastermind. Vamos agendar uma conversa de curadoria?`;
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_top");
                  }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Contatar via WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setSelectedApplication(null)}>
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

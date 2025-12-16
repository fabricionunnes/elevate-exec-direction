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
  UserCheck
} from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<DiagnosticResponse | null>(null);
  const [selectedCloser, setSelectedCloser] = useState<CloserDiagnostic | null>(null);
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
      const [clientsResult, closersResult] = await Promise.all([
        supabase
          .from("client_diagnostics")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("closer_diagnostics" as any)
          .select("*")
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

  const filteredResponses = responses.filter(r => 
    r.company_name.toLowerCase().includes(search.toLowerCase()) ||
    r.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    r.whatsapp.includes(search)
  );

  const filteredCloserDiagnostics = closerDiagnostics.filter(r => 
    r.company.toLowerCase().includes(search.toLowerCase()) ||
    r.client_name.toLowerCase().includes(search.toLowerCase())
  );

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
                {responses.length} de clientes • {closerDiagnostics.length} de closers
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
                                  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
                                }}
                                title="WhatsApp"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCloser(diagnostic)}
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

              {/* Briefing para o Closer */}
              <div className="border-t border-border pt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">📋 Briefing para o Closer</h4>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Resumo do Lead</p>
                    <p className="text-sm text-foreground">
                      {selectedResponse.contact_name} da {selectedResponse.company_name}, 
                      faturando {revenueLabels[selectedResponse.revenue] || selectedResponse.revenue}, 
                      com {teamLabels[selectedResponse.team_size]?.toLowerCase() || selectedResponse.team_size}. 
                      {selectedResponse.has_sales_process ? " Já possui processo comercial." : " Ainda não tem processo comercial estruturado."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Principais Dores</p>
                    <p className="text-sm text-foreground">
                      {selectedResponse.main_pain.split(',').map(p => painLabels[p.trim()] || p.trim()).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Perguntas Sugeridas</p>
                    <ul className="text-sm text-foreground list-disc list-inside space-y-1">
                      <li>Qual foi o gatilho que te fez buscar ajuda agora?</li>
                      <li>Quanto está deixando de faturar por não ter isso resolvido?</li>
                      <li>O que já tentou fazer para resolver?</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const phone = selectedResponse.whatsapp.replace(/\D/g, "");
                    const text = `Olá ${selectedResponse.contact_name}! Recebi seu diagnóstico da ${selectedResponse.company_name}. Vamos conversar sobre o ${selectedResponse.recommended_product}?`;
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
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
    </Layout>
  );
}

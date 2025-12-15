import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Crown, 
  FileText, 
  Loader2, 
  LogOut, 
  Users, 
  ArrowRight,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import logoUNV from "@/assets/logo-unv.png";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
  };

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
    toast.success("Logout realizado");
  };

  if (authLoading) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </section>
      </Layout>
    );
  }

  if (!user || !isAdmin) {
    return (
      <Layout>
        <section className="section-padding bg-background min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full p-8 card-premium">
            <div className="text-center mb-8">
              <img src={logoUNV} alt="UNV" className="h-12 mx-auto mb-4" />
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">
                  Área Restrita
                </h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Faça login para acessar o painel administrativo
              </p>
            </div>
            
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
      <section className="section-padding bg-background min-h-screen">
        <div className="container-premium">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Área Restrita
                </h1>
                <p className="text-muted-foreground">
                  Painel Administrativo UNV
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
            {/* Mastermind Applications */}
            <Link to="/mastermind/applications" className="group">
              <div className="card-highlight p-8 h-full transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <Crown className="h-7 w-7 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Aplicações Mastermind
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Curadoria de candidatos
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">
                  Visualize e analise as aplicações para o UNV Mastermind com score de aptidão automático.
                </p>
                <div className="flex items-center text-amber-500 font-medium">
                  Acessar
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Diagnostic Responses */}
            <Link to="/diagnostic-responses" className="group">
              <div className="card-highlight p-8 h-full transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Diagnósticos de Clientes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Respostas do formulário
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">
                  Visualize as respostas dos diagnósticos de clientes com recomendações de produtos.
                </p>
                <div className="flex items-center text-primary font-medium">
                  Acessar
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* For Closers Tool */}
            <Link to="/for-closers" className="group">
              <div className="card-highlight p-8 h-full transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Users className="h-7 w-7 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Ferramenta do Closer
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Diagnóstico de vendas
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4">
                  Ferramenta de diagnóstico para closers qualificarem leads e recomendar produtos.
                </p>
                <div className="flex items-center text-emerald-500 font-medium">
                  Acessar
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

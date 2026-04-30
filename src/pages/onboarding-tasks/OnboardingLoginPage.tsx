import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoNexus from "@/assets/logo-unv-nexus.png";
import { isClientRole } from "@/types/onboarding";

const OnboardingLoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupShowPassword, setSignupShowPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        // First, check if user is a staff member (admin, cs, consultant)
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role, name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (staffMember) {
          // Staff member found - redirect to appropriate page
          toast.success(`Bem-vindo, ${staffMember.name}!`);
          // If there's a redirect URL, use it
          if (redirectTo) {
            navigate(redirectTo);
            return;
          }

          // For master/admin, go to default dashboard
          if (staffMember.role === "master" || staffMember.role === "admin") {
            navigate("/onboarding-tasks");
            return;
          }

          // Query permissions to determine the best landing page
          const { data: perms } = await supabase
            .from("staff_menu_permissions")
            .select("menu_key")
            .eq("staff_id", staffMember.id);

          const permKeys = (perms || []).map((p: any) => p.menu_key);

          // If ONLY has CRM permission → go to CRM
          if (permKeys.includes("crm") && !permKeys.includes("financial") && !permKeys.some((k: string) => !["crm"].includes(k))) {
            navigate("/crm");
            return;
          }
          // If ONLY has financial permission → go to financial
          if (permKeys.includes("financial") && !permKeys.includes("crm") && !permKeys.some((k: string) => !["financial"].includes(k) && !k.startsWith("fin_"))) {
            navigate("/onboarding-tasks/financeiro/recorrencias");
            return;
          }
          // If has CRM among permissions (commercial roles), prefer CRM
          const commercialRoles = ["head_comercial", "closer", "sdr", "social_setter", "bdr"];
          if (commercialRoles.includes(staffMember.role) && permKeys.includes("crm")) {
            navigate("/crm");
            return;
          }

          navigate("/onboarding-tasks");
          return;
        }

        // Se existe staff com este email mas ainda não está vinculado ao login
        const normalizedEmail = email.trim().toLowerCase();
        const { data: staffByEmail } = await supabase
          .from("onboarding_staff")
          .select("id, user_id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (staffByEmail && !staffByEmail.user_id) {
          toast.error("Seu usuário existe, mas o login ainda não está vinculado. Peça ao admin para recriar/vincular o acesso.");
          await supabase.auth.signOut();
          return;
        }

        // Check if user exists in onboarding_users
        const { data: onboardingUsers, error: onboardingError } = await supabase
          .from("onboarding_users")
          .select("id, role, password_changed, project_id")
          .eq("user_id", data.user.id);

        if (onboardingError || !onboardingUsers || onboardingUsers.length === 0) {
          toast.error("Usuário não encontrado no sistema de onboarding");
          await supabase.auth.signOut();
          return;
        }

        const onboardingUser = onboardingUsers[0];

        toast.success("Login realizado com sucesso!");
        
        // If there's a redirect URL, use it
        if (redirectTo) {
          navigate(redirectTo);
          return;
        }
        
        // Redirect based on role - all client roles go to client portal
        if (isClientRole(onboardingUser.role)) {
          navigate(`/onboarding-client/${onboardingUser.project_id}`);
        } else {
          navigate("/onboarding-tasks");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupName || !signupEmail || !signupPassword) {
      toast.error("Preencha nome, email e senha");
      return;
    }
    if (signupPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSignupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("self-service-signup", {
        body: {
          name: signupName.trim(),
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
          company_name: signupCompany.trim() || signupName.trim(),
        },
      });

      // Edge function retornou status != 2xx → ler body do FunctionsHttpError
      if (error) {
        let serverMsg: string | undefined;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            serverMsg = body?.error;
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }

        const finalMsg = serverMsg || error.message || "Erro ao criar conta";
        if (/já está cadastrado|already/i.test(finalMsg)) {
          toast.error("Este email já está cadastrado. Faça login na aba \"Entrar\".");
        } else {
          toast.error(finalMsg);
        }
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Login automático
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
      });

      if (loginErr) {
        toast.success("Conta criada! Faça login para continuar.");
        return;
      }

      toast.success("Conta criada com sucesso!");
      navigate(`/onboarding-client/${data.project_id}`);
    } catch (err: any) {
      console.error("Signup error:", err);
      toast.error(err?.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo UNV Nexus */}
        <div className="flex items-center justify-center mb-8">
          <img
            src={logoNexus}
            alt="UNV Nexus"
            className="h-16 w-auto"
          />
        </div>

        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardContent className="pt-6">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700">
                <TabsTrigger value="login" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950">
                  Criar conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Entrar</h2>
                  <p className="text-sm text-slate-400">Acesse sua conta</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-300">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Criar conta</h2>
                  <p className="text-sm text-slate-400">Acesso liberado ao Dashboard e KPIs</p>
                </div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-slate-300">Nome completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={signupLoading}
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-company" className="text-slate-300">Empresa (opcional)</Label>
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Nome da empresa"
                      value={signupCompany}
                      onChange={(e) => setSignupCompany(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={signupLoading}
                      maxLength={150}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-slate-300">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={signupLoading}
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-300">Senha</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={signupShowPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                        disabled={signupLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setSignupShowPassword(!signupShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {signupShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                    disabled={signupLoading}
                  >
                    {signupLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      "Criar conta gratuita"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          UNV Nexus - Direção Comercial como Serviço.
        </p>
      </div>
    </div>
  );
};

export default OnboardingLoginPage;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OnboardingLoginPage = () => {
  const navigate = useNavigate();
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
        
        // Redirect based on role
        if (onboardingUser.role === "client") {
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


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Sistema de Onboarding</h1>
            <p className="text-xs text-slate-400">Gestão de Tarefas e Projetos</p>
          </div>
        </div>

        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <h2 className="text-lg font-semibold text-white">Entrar</h2>
            <p className="text-sm text-slate-400">Acesse sua conta para gerenciar tarefas</p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          Acesso restrito a membros do projeto. Contate seu administrador para obter acesso.
        </p>
      </div>
    </div>
  );
};

export default OnboardingLoginPage;

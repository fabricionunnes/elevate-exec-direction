import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PortalLoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/portal/app";
  
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
        // Check if user has portal profile
        const { data: portalUser } = await supabase
          .from("portal_users")
          .select("id, company_id, lgpd_consent_at")
          .eq("user_id", data.user.id)
          .single();

        if (!portalUser) {
          toast.error("Usuário não encontrado no portal. Crie uma conta primeiro.");
          await supabase.auth.signOut();
          return;
        }

        toast.success("Login realizado com sucesso!");
        navigate(redirectTo);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Digite seu email para recuperar a senha");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/portal/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      }
    } catch (error) {
      toast.error("Erro ao enviar email de recuperação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/portal" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
            <Target className="w-7 h-7 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Portal do Planejamento</h1>
            <p className="text-xs text-slate-400">Mansão Empreendedora 2026</p>
          </div>
        </Link>

        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Entrar</CardTitle>
            <CardDescription className="text-slate-400">
              Acesse seu planejamento estratégico
            </CardDescription>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300">Senha</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Esqueci a senha
                  </button>
                </div>
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
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
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

            <div className="mt-6 text-center">
              <p className="text-slate-400 text-sm">
                Não tem conta?{" "}
                <Link to="/portal/signup" className="text-amber-400 hover:text-amber-300 font-medium">
                  Criar conta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          Ao entrar, você concorda com nossos{" "}
          <Link to="/terms" className="text-slate-400 hover:text-slate-300">Termos</Link>
          {" "}e{" "}
          <Link to="/privacy" className="text-slate-400 hover:text-slate-300">Política de Privacidade</Link>
        </p>
      </div>
    </div>
  );
};

export default PortalLoginPage;

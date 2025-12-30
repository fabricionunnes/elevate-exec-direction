import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Eye, EyeOff, Loader2, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PortalSignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const companyCode = searchParams.get("company");
  const isCompleting = searchParams.get("complete") === "true";
  
  const [mode, setMode] = useState<"new" | "join">(inviteToken || companyCode ? "join" : "new");
  const [loading, setLoading] = useState(false);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [existingUser, setExistingUser] = useState<{ id: string; email: string } | null>(null);
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteToken || companyCode || "");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  
  // Invite data
  const [inviteData, setInviteData] = useState<{
    company_id: string;
    company_name: string;
    email?: string;
    role: string;
  } | null>(null);

  // Check if user is already logged in (completing signup)
  useEffect(() => {
    const checkExistingSession = async () => {
      if (isCompleting) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setExistingUser({ id: session.user.id, email: session.user.email || "" });
          setEmail(session.user.email || "");
        }
      }
    };
    checkExistingSession();
  }, [isCompleting]);

  // Check invite on load
  useEffect(() => {
    if (inviteToken) {
      checkInviteToken(inviteToken);
    } else if (companyCode) {
      checkCompanyCode(companyCode);
    }
  }, [inviteToken, companyCode]);

  const checkInviteToken = async (token: string) => {
    setCheckingInvite(true);
    try {
      const { data: invite, error } = await supabase
        .from("portal_invites")
        .select("*, portal_companies(id, name)")
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !invite) {
        toast.error("Convite inválido ou expirado");
        setInviteCode("");
        return;
      }

      setInviteData({
        company_id: invite.company_id,
        company_name: (invite.portal_companies as any)?.name || "Empresa",
        email: invite.email,
        role: invite.role,
      });
      
      if (invite.email) {
        setEmail(invite.email);
      }
      
      setMode("join");
    } catch (error) {
      console.error("Error checking invite:", error);
    } finally {
      setCheckingInvite(false);
    }
  };

  const checkCompanyCode = async (code: string) => {
    setCheckingInvite(true);
    try {
      const { data: company, error } = await supabase
        .from("portal_companies")
        .select("id, name")
        .eq("invite_code", code)
        .single();

      if (error || !company) {
        toast.error("Código da empresa inválido");
        setInviteCode("");
        return;
      }

      setInviteData({
        company_id: company.id,
        company_name: company.name,
        role: "member",
      });
      
      setMode("join");
    } catch (error) {
      console.error("Error checking company code:", error);
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleCheckInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error("Digite o código de convite");
      return;
    }

    // Try as invite token first
    if (inviteCode.length > 16) {
      await checkInviteToken(inviteCode.trim());
    } else {
      await checkCompanyCode(inviteCode.trim());
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim() || !email.trim() || (!existingUser && !password)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (!existingUser) {
      if (password !== confirmPassword) {
        toast.error("As senhas não conferem");
        return;
      }

      if (password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
    }

    if (!lgpdConsent) {
      toast.error("Você precisa aceitar a política de privacidade");
      return;
    }

    if (mode === "new" && !companyName.trim()) {
      toast.error("Digite o nome da sua empresa");
      return;
    }

    if (mode === "join" && !inviteData) {
      toast.error("Código de convite inválido");
      return;
    }

    setLoading(true);

    try {
      let userId: string;
      let userEmail: string;

      if (existingUser) {
        // User already has auth, just need to create portal_user
        userId = existingUser.id;
        userEmail = existingUser.email;
      } else {
        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal/app`,
          },
        });

        if (authError) {
          if (authError.message.includes("already registered")) {
            toast.error("Este email já está cadastrado. Faça login.");
            navigate("/portal/login");
          } else {
            toast.error(authError.message);
          }
          return;
        }

        if (!authData.user) {
          toast.error("Erro ao criar usuário");
          return;
        }

        userId = authData.user.id;
        userEmail = email.trim();
      }

      let companyId: string;
      let userRole: "admin_company" | "member" = "member";

      if (mode === "new") {
        // 2a. Create new company
        const { data: company, error: companyError } = await supabase
          .from("portal_companies")
          .insert({ name: companyName.trim() })
          .select()
          .single();

        if (companyError) {
          console.error("Company creation error:", companyError);
          toast.error("Erro ao criar empresa");
          return;
        }

        companyId = company.id;
        userRole = "admin_company";
      } else {
        // 2b. Use existing company from invite
        companyId = inviteData!.company_id;
        userRole = inviteData!.role as "admin_company" | "member";
      }

      // 3. Create portal user
      const { error: userError } = await supabase
        .from("portal_users")
        .insert({
          user_id: userId,
          company_id: companyId,
          name: name.trim(),
          email: userEmail,
          role: userRole,
          lgpd_consent_at: new Date().toISOString(),
        });

      if (userError) {
        console.error("Portal user creation error:", userError);
        toast.error("Erro ao criar perfil no portal");
        return;
      }

      // 4. Mark invite as used (if applicable)
      if (inviteToken && inviteData) {
        await supabase
          .from("portal_invites")
          .update({ used_at: new Date().toISOString() })
          .eq("token", inviteToken);
      }

      toast.success("Conta criada com sucesso!");
      navigate("/portal/app");
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 py-12">
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
            <CardTitle className="text-2xl text-white">Criar Conta</CardTitle>
            <CardDescription className="text-slate-400">
              {inviteData 
                ? `Você foi convidado para ${inviteData.company_name}`
                : "Comece seu planejamento estratégico"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mode Toggle (only if no invite) */}
            {!inviteData && (
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${
                    mode === "new"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Nova Empresa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("join")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${
                    mode === "join"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Tenho Convite</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Join mode - Invite code */}
              {mode === "join" && !inviteData && (
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-slate-300">Código de Convite</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inviteCode"
                      placeholder="Digite o código ou link"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      onClick={handleCheckInviteCode}
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                      disabled={loading}
                    >
                      Verificar
                    </Button>
                  </div>
                </div>
              )}

              {/* Show company info if invite valid */}
              {inviteData && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-amber-400 text-sm font-medium">
                    Você será adicionado à empresa: <span className="text-white">{inviteData.company_name}</span>
                  </p>
                </div>
              )}

              {/* New company mode - Company name */}
              {mode === "new" && (
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-slate-300">Nome da Empresa</Label>
                  <Input
                    id="companyName"
                    placeholder="Sua Empresa Ltda"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Seu Nome</Label>
                <Input
                  id="name"
                  placeholder="João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={loading || !!existingUser || (inviteData?.email ? true : false)}
                />
              </div>

              {!existingUser && (
                <>
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

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="lgpd"
                  checked={lgpdConsent}
                  onCheckedChange={(checked) => setLgpdConsent(checked as boolean)}
                  className="border-slate-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 mt-1"
                />
                <label htmlFor="lgpd" className="text-sm text-slate-400 cursor-pointer">
                  Li e concordo com a{" "}
                  <Link to="/privacy" className="text-amber-400 hover:text-amber-300">
                    Política de Privacidade
                  </Link>
                  {" "}e{" "}
                  <Link to="/terms" className="text-amber-400 hover:text-amber-300">
                    Termos de Uso
                  </Link>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold mt-4"
                disabled={loading || (mode === "join" && !inviteData)}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-400 text-sm">
                Já tem conta?{" "}
                <Link to="/portal/login" className="text-amber-400 hover:text-amber-300 font-medium">
                  Entrar
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PortalSignupPage;

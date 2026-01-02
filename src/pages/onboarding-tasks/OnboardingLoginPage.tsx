import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Eye, EyeOff, Loader2, Building2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

const availableProducts: Product[] = [
  { id: "core", name: "UNV Core" },
  { id: "control", name: "UNV Control" },
  { id: "sales-acceleration", name: "UNV Sales Acceleration" },
  { id: "growth-room", name: "UNV Growth Room" },
  { id: "partners", name: "UNV Partners" },
  { id: "sales-ops", name: "UNV Sales Ops" },
  { id: "ads", name: "UNV Ads" },
  { id: "social", name: "UNV Social" },
  { id: "finance", name: "UNV Finance" },
  { id: "people", name: "UNV People" },
  { id: "leadership", name: "UNV Leadership" },
  { id: "safe", name: "UNV Safe" },
  { id: "fractional-cro", name: "Diretor Comercial Fracionado" },
  { id: "execution-partnership", name: "Execution Partnership" },
  { id: "ai-sales-system", name: "AI Sales System" },
  { id: "mastermind", name: "Mastermind" },
];

const OnboardingLoginPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"cs" | "consultant" | "client" | "">("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  
  // Password change dialog
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [onboardingUserId, setOnboardingUserId] = useState<string | null>(null);

  // Load companies for CS/consultant signup
  useEffect(() => {
    if (signupRole === "cs" || signupRole === "consultant") {
      loadCompanies();
    }
  }, [signupRole]);

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from("portal_companies")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error loading companies:", error);
    } finally {
      setLoadingCompanies(false);
    }
  };

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

        // Check if password needs to be changed
        if (!onboardingUser.password_changed) {
          setOnboardingUserId(onboardingUser.id);
          setShowPasswordChange(true);
          return;
        }

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupName || !signupEmail || !signupPassword || !signupRole) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (signupPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (signupRole === "client") {
      if (selectedProducts.length === 0) {
        toast.error("Selecione pelo menos um produto");
        return;
      }
      if (!companyName.trim()) {
        toast.error("Informe o nome da sua empresa");
        return;
      }
    }

    if ((signupRole === "cs" || signupRole === "consultant") && selectedCompanies.length === 0) {
      toast.error("Selecione pelo menos uma empresa");
      return;
    }

    setSigningUp(true);

    try {
      const response = await supabase.functions.invoke("create-onboarding-user", {
        body: {
          email: signupEmail.trim(),
          password: signupPassword,
          name: signupName.trim(),
          role: signupRole,
          company_name: signupRole === "client" ? companyName.trim() : null,
          selected_products: signupRole === "client" ? selectedProducts : null,
          selected_companies: (signupRole === "cs" || signupRole === "consultant") ? selectedCompanies : null,
          is_signup: true,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar conta");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Conta criada com sucesso! Faça login para acessar.");
      setActiveTab("login");
      setEmail(signupEmail);
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupRole("");
      setSelectedCompanies([]);
      setSelectedProducts([]);
      setCompanyName("");
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar conta");
    } finally {
      setSigningUp(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setChangingPassword(true);

    try {
      // Update password in auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      // Mark password as changed
      const { error: updateError } = await supabase
        .from("onboarding_users")
        .update({ password_changed: true, temp_password: null })
        .eq("id", onboardingUserId);

      if (updateError) {
        console.error("Error updating password_changed:", updateError);
      }

      // Get user info for redirect
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: onboardingUsers } = await supabase
          .from("onboarding_users")
          .select("role, project_id")
          .eq("user_id", user.id);

        toast.success("Senha alterada com sucesso!");
        setShowPasswordChange(false);

        const onboardingUser = onboardingUsers?.[0];
        if (onboardingUser?.role === "client") {
          navigate(`/onboarding-client/${onboardingUser.project_id}`);
        } else {
          navigate("/onboarding-tasks");
        }
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
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
          <CardHeader className="text-center pb-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                <TabsTrigger value="login" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950">
                  Cadastrar
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {activeTab === "login" ? (
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
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signupName" className="text-slate-300">Nome completo</Label>
                  <Input
                    id="signupName"
                    type="text"
                    placeholder="Seu nome"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={signingUp}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signupEmail" className="text-slate-300">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={signingUp}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signupPassword" className="text-slate-300">Senha</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    disabled={signingUp}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo de usuário</Label>
                  <Select value={signupRole} onValueChange={(v) => setSignupRole(v as "cs" | "consultant" | "client")}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue placeholder="Selecione seu perfil" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="client">Cliente</SelectItem>
                      <SelectItem value="cs">CS (Customer Success)</SelectItem>
                      <SelectItem value="consultant">Consultor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Client-specific fields */}
                {signupRole === "client" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Nome da sua empresa</Label>
                      <Input
                        type="text"
                        placeholder="Nome da empresa"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        disabled={signingUp}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Quais produtos você adquiriu?
                      </Label>
                      <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                        {availableProducts.map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => toggleProduct(product.id)}
                              className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <label
                              htmlFor={`product-${product.id}`}
                              className="text-sm text-slate-300 cursor-pointer"
                            >
                              {product.name}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedProducts.length > 0 && (
                        <p className="text-xs text-emerald-400">
                          {selectedProducts.length} produto(s) selecionado(s)
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* CS/Consultant-specific fields */}
                {(signupRole === "cs" || signupRole === "consultant") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Quais empresas você atende?
                    </Label>
                    {loadingCompanies ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      </div>
                    ) : companies.length === 0 ? (
                      <p className="text-sm text-slate-500 p-3 bg-slate-800/30 rounded-lg">
                        Nenhuma empresa cadastrada ainda.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                        {companies.map((company) => (
                          <div key={company.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`company-${company.id}`}
                              checked={selectedCompanies.includes(company.id)}
                              onCheckedChange={() => toggleCompany(company.id)}
                              className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <label
                              htmlFor={`company-${company.id}`}
                              className="text-sm text-slate-300 cursor-pointer"
                            >
                              {company.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedCompanies.length > 0 && (
                      <p className="text-xs text-emerald-400">
                        {selectedCompanies.length} empresa(s) selecionada(s)
                      </p>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                  disabled={signingUp}
                >
                  {signingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          {activeTab === "login" 
            ? "Acesso restrito a membros do projeto" 
            : "Após o cadastro, suas tarefas serão liberadas automaticamente"
          }
        </p>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordChange} onOpenChange={() => {}}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Alterar Senha</DialogTitle>
            <DialogDescription className="text-slate-400">
              Por segurança, você precisa alterar sua senha temporária no primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Confirmar Nova Senha</Label>
              <Input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950"
              disabled={changingPassword}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar Senha"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnboardingLoginPage;

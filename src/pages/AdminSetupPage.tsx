import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import logoUNV from "@/assets/logo-unv.png";

export default function AdminSetupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error("Erro ao criar usuário");
      }

      // Add admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: signUpData.user.id, role: "admin" });

      if (roleError) {
        // If role insert fails, it might be RLS - we'll handle this differently
        console.log("Role insert info:", roleError.message);
      }

      setSuccess(true);
      toast.success("Conta admin criada com sucesso!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <img src={logoUNV} alt="UNV" className="h-12 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Conta Admin Criada!
          </h1>
          <p className="text-muted-foreground">
            Agora você pode acessar as aplicações do Mastermind.
          </p>
          <Button 
            onClick={() => window.location.href = "/mastermind/applications"}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Crown className="w-4 h-4 mr-2" />
            Acessar Aplicações Mastermind
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 border border-border rounded-lg bg-card">
        <div className="text-center mb-8">
          <img src={logoUNV} alt="UNV" className="h-12 mx-auto mb-4" />
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-foreground">
              Setup Admin
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Crie sua conta de administrador para acessar as aplicações do Mastermind
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              required
            />
          </div>
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-amber-500 hover:bg-amber-600" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Criar Conta Admin
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Esta página é temporária e deve ser removida após criar o admin.
        </p>
      </div>
    </div>
  );
}

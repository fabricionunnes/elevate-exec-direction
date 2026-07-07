// Login PÚBLICO do UNV Start (rota /start, sem token).
// O cliente que já criou senha entra por e-mail + senha e é redirecionado
// pro portal em /start/{token}. Quem ainda não tem senha usa o link mágico
// que chega por e-mail/WhatsApp após a compra.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, LockKeyhole, Mail, ArrowRight } from "lucide-react";
import logoUnvBoard from "@/assets/logo-unv-board.png";

const NAVY = "#0D2B5E";

/** Invoca a engine e extrai a mensagem de erro real do corpo, quando houver. */
async function invokeEngine(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("unv-start-engine", { body });
  if (error) {
    let msg = "Não conseguimos falar com o servidor. Tente novamente em instantes.";
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
      } catch {
        // corpo não era JSON — mantém a mensagem genérica
      }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function UNVStartLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      const data = await invokeEngine({
        action: "login",
        email: email.trim().toLowerCase(),
        password,
      });
      if (!data?.token) throw new Error("Não foi possível entrar. Confira seus dados.");
      navigate(`/start/${data.token}`);
    } catch (err: any) {
      console.error("Erro no login UNV Start:", err);
      toast.error(err?.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex flex-col">
      {/* HEADER */}
      <div style={{ backgroundColor: NAVY }} className="text-white">
        <div className="container mx-auto px-4 py-7 max-w-md">
          <img src={logoUnvBoard} alt="UNV Start" className="h-16" />
          <p className="text-sm text-blue-100/80 mt-3">
            Sua estrutura comercial, construída por você.
          </p>
          <div className="mt-3 h-1 w-14 bg-[#CC1B1B] rounded-full" />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-md w-full">
        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-6 space-y-5">
            <div>
              <h1 className="text-lg font-bold" style={{ color: NAVY }}>
                Entrar no UNV Start
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acesse com o e-mail da compra e a senha que você criou.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-medium flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                E-mail
              </Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="voce@empresa.com.br"
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-medium flex items-center gap-1.5">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                Senha
              </Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                placeholder="Sua senha"
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>

            <Button
              onClick={login}
              disabled={loading}
              className="w-full h-11 bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Entrar
            </Button>

            <div className="pt-1 border-t">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="text-sm font-medium text-[#0D2B5E] dark:text-blue-300 hover:underline mt-3"
              >
                Recebi um link de acesso
              </button>
              {showHelp && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Logo após a compra você recebe um link exclusivo por e-mail e
                  WhatsApp. É só abrir esse link — ele já entra direto na sua área,
                  sem senha. Na primeira vez, você pode criar uma senha lá dentro
                  para voltar quando quiser.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Universidade Nacional de Vendas · UNV Start
      </footer>
    </div>
  );
}

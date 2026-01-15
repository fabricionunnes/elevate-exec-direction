import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Link2, ExternalLink, CheckCircle } from "lucide-react";

interface ContextType {
  companyId: string;
  pointsName: string;
}

export default function CustomerPointsSalespersonTokens() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [companyToken, setCompanyToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicDomain = getPublicBaseUrl();

  useEffect(() => {
    if (companyId) {
      fetchOrCreateToken();
    }
  }, [companyId]);

  const fetchOrCreateToken = async () => {
    setLoading(true);
    try {
      // Check if company already has a general token
      const { data: config } = await supabase
        .from("customer_points_config")
        .select("id")
        .eq("company_id", companyId)
        .single();

      if (config) {
        // Use the company_id as the token (simple approach)
        setCompanyToken(companyId);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  };

  const getFormUrl = () => {
    // Use query-based public links to survive apps that strip the URL fragment (#/...)
    return `${publicDomain}/?public=points-salesperson&company=${companyId}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getFormUrl());
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Link para Vendedores</h1>
        <p className="text-muted-foreground">
          Compartilhe este link para os vendedores registrarem {pointsName.toLowerCase()} de clientes
        </p>
      </div>

      {/* Main Link Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link Único de Registro
          </CardTitle>
          <CardDescription>
            Qualquer vendedor pode usar este link para registrar pontos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={getFormUrl()} 
              readOnly 
              className="font-mono text-sm bg-muted"
            />
            <Button 
              onClick={copyLink} 
              variant={copied ? "default" : "outline"}
              className="gap-2 min-w-[120px]"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => window.open(getFormUrl(), "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Copie o link acima e envie para sua equipe de vendas</p>
          <p>2. O vendedor abre o link no celular e informa seu nome</p>
          <p>3. Depois, digita o CPF do cliente para registrar os pontos</p>
          <p>4. Não é necessário login - basta o link</p>
          <p>5. Você pode ver todas as transações na aba "Transações"</p>
        </CardContent>
      </Card>
    </div>
  );
}

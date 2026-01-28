import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Link, 
  Copy, 
  ExternalLink, 
  RefreshCw,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { useCultureFormLink, useCreateFormLink } from "./useCultureManual";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface CultureFormLinkSectionProps {
  projectId: string;
  canEdit: boolean;
}

export function CultureFormLinkSection({ projectId, canEdit }: CultureFormLinkSectionProps) {
  const { data: formLink, isLoading } = useCultureFormLink(projectId);
  const createFormLink = useCreateFormLink(projectId);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const getPublicUrl = () => {
    const baseUrl = "https://elevate-exec-direction.lovable.app";
    return `${baseUrl}/#/cultura/${formLink?.access_token}`;
  };

  const handleCopyLink = async () => {
    const url = getPublicUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async () => {
    if (!formLink) return;

    const { error } = await supabase
      .from("culture_form_links")
      .update({ is_active: !formLink.is_active })
      .eq("id", formLink.id);

    if (error) {
      toast.error("Erro ao atualizar status do link");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["culture-form-link", projectId] });
    toast.success(formLink.is_active ? "Link desativado" : "Link ativado");
  };

  const handleRegenerateToken = async () => {
    if (!formLink) return;

    const newToken = crypto.randomUUID().replace(/-/g, "");
    
    const { error } = await supabase
      .from("culture_form_links")
      .update({ access_token: newToken })
      .eq("id", formLink.id);

    if (error) {
      toast.error("Erro ao regenerar token");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["culture-form-link", projectId] });
    toast.success("Token regenerado com sucesso!");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!formLink) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link do Formulário Público
          </CardTitle>
          <CardDescription>
            Crie um link único para o empresário responder o formulário de cultura
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nenhum link foi criado ainda. Clique no botão abaixo para gerar um link público.
            </p>
            <Button 
              onClick={() => createFormLink.mutate()}
              disabled={!canEdit || createFormLink.isPending}
            >
              {createFormLink.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Criar Link do Formulário
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Link do Formulário Público
            </CardTitle>
            <CardDescription>
              Compartilhe este link com o empresário para que ele preencha o formulário
            </CardDescription>
          </div>
          <Badge variant={formLink.is_active ? "default" : "secondary"}>
            {formLink.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Link Display */}
        <div className="space-y-2">
          <Label>Link Público</Label>
          <div className="flex gap-2">
            <Input 
              value={getPublicUrl()} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => window.open(getPublicUrl(), "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-3">
            <Switch 
              id="link-active"
              checked={formLink.is_active}
              onCheckedChange={handleToggleActive}
              disabled={!canEdit}
            />
            <Label htmlFor="link-active">
              {formLink.is_active ? "Link ativo" : "Link desativado"}
            </Label>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRegenerateToken}
            disabled={!canEdit}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerar Token
          </Button>
        </div>

        {/* Info */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-sm">
          <p className="text-blue-700 dark:text-blue-400">
            <strong>Dica:</strong> Envie este link para o empresário ou sócio da empresa 
            preencher. As respostas serão usadas para gerar o Manual de Cultura automaticamente.
          </p>
        </div>

        {/* Metadata */}
        <div className="text-sm text-muted-foreground">
          <p>Criado em: {new Date(formLink.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}</p>
        </div>
      </CardContent>
    </Card>
  );
}

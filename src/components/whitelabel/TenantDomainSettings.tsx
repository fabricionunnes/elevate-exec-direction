import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Save, Info } from "lucide-react";
import { toast } from "sonner";

export function TenantDomainSettings() {
  const { tenant, refetchTenant } = useTenant();
  const [customDomain, setCustomDomain] = useState(tenant?.custom_domain || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tenant) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whitelabel_tenants")
        .update({
          custom_domain: customDomain.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (error) throw error;

      await refetchTenant();
      toast.success("Domínio atualizado!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant ativo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configuração de Domínio
          </CardTitle>
          <CardDescription>
            Configure um domínio customizado para sua plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current access URLs */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Endereços de Acesso Atuais</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                <Badge variant="secondary" className="text-xs shrink-0">Subdomínio</Badge>
                <code className="text-sm text-foreground">
                  {tenant.slug}.nexus.com.br
                </code>
              </div>
              {tenant.custom_domain && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                  <Badge className="text-xs shrink-0">Domínio Próprio</Badge>
                  <code className="text-sm text-foreground">{tenant.custom_domain}</code>
                  <a
                    href={`https://${tenant.custom_domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Custom domain input */}
          <div className="space-y-2">
            <Label>Domínio Customizado</Label>
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="app.suaempresa.com.br"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar apenas o subdomínio padrão
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Domínio"}
          </Button>
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5" />
            Instruções de DNS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para usar um domínio customizado, configure os seguintes registros DNS no seu provedor:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-foreground">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Nome</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><Badge variant="outline">A</Badge></td>
                  <td className="py-2 px-3 text-muted-foreground">@</td>
                  <td className="py-2 px-3 font-mono text-foreground">185.158.133.1</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3"><Badge variant="outline">A</Badge></td>
                  <td className="py-2 px-3 text-muted-foreground">www</td>
                  <td className="py-2 px-3 font-mono text-foreground">185.158.133.1</td>
                </tr>
                <tr>
                  <td className="py-2 px-3"><Badge variant="outline">TXT</Badge></td>
                  <td className="py-2 px-3 text-muted-foreground">_lovable</td>
                  <td className="py-2 px-3 font-mono text-xs text-foreground">
                    lovable_verify=...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            A propagação DNS pode levar até 72 horas. O certificado SSL será provisionado automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

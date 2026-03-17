import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Paintbrush, Upload, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { ColorCustomizer } from "@/components/settings/ColorCustomizer";
import { ThemeColors } from "@/contexts/ThemeCustomizationContext";

export function TenantBrandingSettings() {
  const { tenant, refetchTenant } = useTenant();
  const queryClient = useQueryClient();

  const [platformName, setPlatformName] = useState(tenant?.platform_name || "");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url || "");
  const [faviconUrl, setFaviconUrl] = useState(tenant?.favicon_url || "");
  const [isDarkMode, setIsDarkMode] = useState(tenant?.is_dark_mode || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tenant) {
      toast.error("Nenhum tenant encontrado");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whitelabel_tenants")
        .update({
          platform_name: platformName,
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          is_dark_mode: isDarkMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (error) throw error;

      await refetchTenant();
      toast.success("Branding atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `whitelabel/${tenant.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("whitelabel-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("whitelabel-assets")
      .getPublicUrl(filePath);

    setLogoUrl(data.publicUrl);
    toast.success("Logo enviado!");
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `whitelabel/${tenant.id}/favicon.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("whitelabel-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("whitelabel-assets")
      .getPublicUrl(filePath);

    setFaviconUrl(data.publicUrl);
    toast.success("Favicon enviado!");
  };

  if (!tenant) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant ativo. Configure um tenant para personalizar o branding.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>
            Personalize a aparência da sua plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Nome da Plataforma</Label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="Nome que aparecerá no sistema"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Logomarca</Label>
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-12 w-12 rounded-lg object-contain bg-muted p-1"
                  />
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG ou SVG recomendado, fundo transparente
                  </p>
                </div>
              </div>
              {logoUrl && (
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="Ou cole uma URL da logo"
                  className="text-xs"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Favicon</Label>
              <div className="flex items-center gap-3">
                {faviconUrl && (
                  <img
                    src={faviconUrl}
                    alt="Favicon"
                    className="h-8 w-8 rounded object-contain bg-muted p-0.5"
                  />
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFaviconUpload}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ICO ou PNG 32x32
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Modo Escuro</Label>
              <p className="text-xs text-muted-foreground">
                Ativar tema escuro como padrão
              </p>
            </div>
            <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Branding"}
          </Button>
        </CardContent>
      </Card>

      <ColorCustomizer />
    </div>
  );
}

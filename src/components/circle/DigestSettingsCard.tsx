import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCircleCurrentProfile } from "@/hooks/useCircleCurrentProfile";
import { Mail, Save, Loader2 } from "lucide-react";

export function DigestSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useCircleCurrentProfile();

  const [settings, setSettings] = useState({
    is_enabled: true,
    frequency: "daily",
    include_feed_highlights: true,
    include_community_activity: true,
    include_ranking: true,
    include_marketplace: true,
    email: "",
  });

  const { data: digestSettings, isLoading } = useQuery({
    queryKey: ["circle-digest-settings", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("circle_digest_settings")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (digestSettings) {
      setSettings({
        is_enabled: digestSettings.is_enabled,
        frequency: digestSettings.frequency,
        include_feed_highlights: digestSettings.include_feed_highlights,
        include_community_activity: digestSettings.include_community_activity,
        include_ranking: digestSettings.include_ranking,
        include_marketplace: digestSettings.include_marketplace,
        email: digestSettings.email || "",
      });
    }
  }, [digestSettings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("circle_digest_settings")
        .upsert({
          profile_id: profile.id,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configurações de digest salvas!" });
      queryClient.invalidateQueries({ queryKey: ["circle-digest-settings"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Digest Automático
        </CardTitle>
        <CardDescription>
          Receba um resumo das atividades por e-mail
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Ativar Digest</p>
            <p className="text-sm text-muted-foreground">
              Receber resumos periódicos por e-mail
            </p>
          </div>
          <Switch
            checked={settings.is_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
          />
        </div>

        {settings.is_enabled && (
          <>
            {/* Email */}
            <div className="space-y-2">
              <Label>E-mail para receber o digest</Label>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="seu@email.com"
              />
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={settings.frequency}
                onValueChange={(value) => setSettings({ ...settings, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="none">Desativado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content Options */}
            <div className="space-y-4">
              <Label>Incluir no digest</Label>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Destaques do feed</span>
                <Switch
                  checked={settings.include_feed_highlights}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, include_feed_highlights: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Atividades das comunidades</span>
                <Switch
                  checked={settings.include_community_activity}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, include_community_activity: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Ranking</span>
                <Switch
                  checked={settings.include_ranking}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, include_ranking: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Novos anúncios do marketplace</span>
                <Switch
                  checked={settings.include_marketplace}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, include_marketplace: checked })
                  }
                />
              </div>
            </div>
          </>
        )}

        <Button 
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="w-full"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

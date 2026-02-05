import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, Loader2, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhatsAppGroupSettingsProps {
  projectId: string;
}

interface WhatsAppSettings {
  id?: string;
  group_jid: string | null;
  send_to_group: boolean;
  group_name: string | null;
}

export const WhatsAppGroupSettings = ({ projectId }: WhatsAppGroupSettingsProps) => {
  const [settings, setSettings] = useState<WhatsAppSettings>({
    group_jid: null,
    send_to_group: false,
    group_name: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [projectId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("social_whatsapp_settings")
        .select("id, group_jid, send_to_group, group_name")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSettings({
          id: data.id,
          group_jid: data.group_jid,
          send_to_group: data.send_to_group || false,
          group_name: data.group_name,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from("social_whatsapp_settings")
          .update({
            group_jid: settings.group_jid,
            send_to_group: settings.send_to_group,
            group_name: settings.group_name,
          })
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("social_whatsapp_settings")
          .insert({
            project_id: projectId,
            group_jid: settings.group_jid,
            send_to_group: settings.send_to_group,
            group_name: settings.group_name,
            is_active: true,
          });

        if (error) throw error;
      }

      toast.success("Configurações de grupo salvas!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Aprovação via Grupo</CardTitle>
            <CardDescription className="text-xs">
              Enviar links de aprovação para um grupo do WhatsApp
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="send-to-group">Enviar para grupo</Label>
            <p className="text-xs text-muted-foreground">
              Ao ativar, os links serão enviados para o grupo ao invés do telefone individual
            </p>
          </div>
          <Switch
            id="send-to-group"
            checked={settings.send_to_group}
            onCheckedChange={(checked) => 
              setSettings((s) => ({ ...s, send_to_group: checked }))
            }
          />
        </div>

        {settings.send_to_group && (
          <>
            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="group-name">Nome do grupo</Label>
              <Input
                id="group-name"
                placeholder="Ex: Aprovações - Cliente XYZ"
                value={settings.group_name || ""}
                onChange={(e) => 
                  setSettings((s) => ({ ...s, group_name: e.target.value }))
                }
              />
            </div>

            {/* Group JID */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="group-jid">ID do grupo (JID)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        O JID é o identificador único do grupo no WhatsApp. 
                        Formato: <code>123456789-123456@g.us</code>
                        <br /><br />
                        Para obter: Use a API Evolution para listar os grupos da instância.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="group-jid"
                placeholder="Ex: 123456789012345678@g.us"
                value={settings.group_jid || ""}
                onChange={(e) => 
                  setSettings((s) => ({ ...s, group_jid: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                O JID do grupo pode ser obtido na API do Evolution. Geralmente termina com @g.us
              </p>
            </div>
          </>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
};
